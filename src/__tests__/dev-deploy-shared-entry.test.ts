/**
 * `forge-sim dev` deploys the backend through `devDeploy`, a thin wrapper
 * over `deployer.deploy()` with the options that make it a tunnel session:
 * no reset, no throw, no type check, and no deploy-time scheduled-trigger
 * fire on a save-triggered reload. Pinned here:
 *
 *  - a source file shared by N function entries evaluates once per pass
 *  - a second pass serves edits to a transitive helper
 *  - a hot reload swaps definitions silently, keeps KVS and does not re-fire
 *    scheduled triggers
 *  - the dev path gets everything deploy() has: the function registry with
 *    the manifest's kinds, the function-reference check, the upstream
 *    manifest validator, and a build failure on reload that leaves the
 *    previous handlers serving
 *  - app.storage.entities schemas register on every pass
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createSimulator, type ForgeSimulator } from '../simulator.js';
import { devDeploy } from '../dev-command.js';
import { linkNodeModules } from './helpers/scratch-app.js';

const FIXTURE = join(import.meta.dirname, 'fixtures/dev-shared-entry');
const ENTITY_FIXTURE = join(import.meta.dirname, 'fixtures/manifest-entities');
const HELPER_FILE = join(FIXTURE, 'src/helper.js');

const HELPER_V2 = `// Transitive helper — the test rewrites this file mid-flight to verify a
// second dev deploy pass picks up the new code.
export function greet() {
  return { message: 'dev v2', edited: true };
}
`;

declare global {
  // eslint-disable-next-line no-var
  var __devSharedEntryEvals: number | undefined;
  // eslint-disable-next-line no-var
  var __devSharedEntryTicks: number | undefined;
  // eslint-disable-next-line no-var
  var __devSharedEntryLastEvent: any;
}

describe('devDeploy — the dev deploy path', () => {
  let sim: ForgeSimulator;
  let originalHelper: string;

  beforeEach(async () => {
    globalThis.__devSharedEntryEvals = 0;
    globalThis.__devSharedEntryTicks = 0;
    globalThis.__devSharedEntryLastEvent = undefined;
    originalHelper ??= await readFile(HELPER_FILE, 'utf-8');
    await writeFile(HELPER_FILE, originalHelper, 'utf-8');
    sim = createSimulator();
  });

  afterAll(async () => {
    await writeFile(HELPER_FILE, originalHelper, 'utf-8');
    await sim.stop();
  });

  it('evaluates a shared source file exactly once per deploy pass', async () => {
    const result = await devDeploy(sim, FIXTURE);

    expect(result.errors).toEqual([]);
    expect(result.loadedFunctions.sort()).toEqual(['fn-cleanup', 'fn-main', 'fn-run']);
    // Three function entries, ONE evaluation of src/index.js.
    expect(globalThis.__devSharedEntryEvals).toBe(1);
  });

  it('registers all handlers without overwrite-warning spam', async () => {
    const warnSpy = vi.spyOn(console, 'warn');
    try {
      await devDeploy(sim, FIXTURE);

      const overwriteWarnings = warnSpy.mock.calls.filter((args) =>
        String(args[0]).includes('overwriting an existing definition')
      );
      expect(overwriteWarnings).toEqual([]);

      // Resolver definitions from the shim AND plain function exports all
      // land. The scheduled trigger lives in the function registry, not the
      // resolver map: it is fired by key, never invoked as a resolver.
      expect(await sim.resolver.invoke('greet')).toEqual({ message: 'dev v1' });
      expect(await sim.resolver.invoke('stats')).toEqual({ ok: true });
      expect((await sim.fireScheduledTrigger('tick')).statusCode).toBe(204);
      expect(await sim.resolver.invoke('fn-cleanup')).toEqual({ cleaned: true });
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('a second deploy pass picks up edits to a transitive helper', async () => {
    await devDeploy(sim, FIXTURE);
    expect(await sim.resolver.invoke('greet')).toEqual({ message: 'dev v1' });

    // Edit ONLY the transitive helper — the entry file is untouched.
    await writeFile(HELPER_FILE, HELPER_V2, 'utf-8');

    await sim.reset();
    await devDeploy(sim, FIXTURE);

    expect(await sim.resolver.invoke('greet')).toEqual({ message: 'dev v2', edited: true });
  });

  // ── Hot redeploy ({ reload: true }) — the save-triggered dev path ──────
  //
  // `forge-sim dev` wires the file watcher to `devDeploy(sim, dir,
  // { reload: true })`. Forge tunnel parity: a local rebuild, not a fresh
  // install — definitions swap cleanly, scheduled work doesn't re-run,
  // simulator state survives.

  it('hot redeploy serves fresh transitive code without reset or warnings', async () => {
    const warnSpy = vi.spyOn(console, 'warn');
    try {
      await devDeploy(sim, FIXTURE);
      expect(await sim.resolver.invoke('greet')).toEqual({ message: 'dev v1' });

      await writeFile(HELPER_FILE, HELPER_V2, 'utf-8');

      // No sim.reset() — this is the live watcher path. The deploy epoch
      // replaces definitions, so re-registration must be silent.
      const result = await devDeploy(sim, FIXTURE, { reload: true });
      expect(result.errors).toEqual([]);
      expect(result.loadedFunctions.sort()).toEqual(['fn-cleanup', 'fn-main', 'fn-run']);

      const overwriteWarnings = warnSpy.mock.calls.filter((args) =>
        String(args[0]).includes('overwriting an existing definition')
      );
      expect(overwriteWarnings).toEqual([]);

      expect(await sim.resolver.invoke('greet')).toEqual({ message: 'dev v2', edited: true });
      expect(await sim.resolver.invoke('stats')).toEqual({ ok: true });
      expect(await sim.resolver.invoke('fn-cleanup')).toEqual({ cleaned: true });
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('scheduled trigger handlers receive the real Forge request shape', async () => {
    const result = await devDeploy(sim, FIXTURE);

    expect(result.errors).toEqual([]);
    const event = globalThis.__devSharedEntryLastEvent;
    expect(event?.context?.moduleKey).toBe('tick');
    expect(event?.context?.cloudId).toBeDefined();
    expect(event?.contextToken).toBeDefined();
    expect(event?.scheduledTrigger).toBeUndefined();
  });

  it('scheduled triggers fire on the initial pass but NOT on hot redeploys', async () => {
    await devDeploy(sim, FIXTURE);
    expect(globalThis.__devSharedEntryTicks).toBe(1);

    await devDeploy(sim, FIXTURE, { reload: true });
    await devDeploy(sim, FIXTURE, { reload: true });
    expect(globalThis.__devSharedEntryTicks).toBe(1);
  });

  it('KVS state survives a hot redeploy pass', async () => {
    await devDeploy(sim, FIXTURE);

    await sim.kvs.set('sticky', { keep: 'me' });
    await devDeploy(sim, FIXTURE, { reload: true });

    expect(await sim.kvs.get('sticky')).toEqual({ keep: 'me' });
  });

  // ── Custom Entity Store schemas ─────────────────────────────────────────
  //
  // app.storage.entities schemas register before code loads. Without them
  // the KVS engine runs schema-less: entity queries drop partition/range
  // filtering and every schema-gated check is inert.

  it('registers app.storage.entities schemas like the full deployer', async () => {
    await devDeploy(sim, ENTITY_FIXTURE);

    const schemas = sim.kvs.getEntitySchemas();
    expect(schemas.has('task')).toBe(true);
    expect(schemas.has('comment')).toBe(true);

    await sim.kvs.entity('task').set('t1', {
      title: 'Fix the thing',
      status: 'available',
      priority: 1,
      projectId: 'P1',
      createdAt: '2026-07-18',
    });

    const hit = await sim.kvs
      .entity('task')
      .query()
      .index('by-status', { partition: ['available'] })
      .getMany();
    expect(hit.results).toHaveLength(1);

    const miss = await sim.kvs
      .entity('task')
      .query()
      .index('by-status', { partition: ['loaned'] })
      .getMany();
    expect(miss.results).toHaveLength(0);

    expect(() => sim.kvs.entity('Ghost').query()).toThrow(/ENTITY_NOT_FOUND/);
  });

  it('re-registers schemas idempotently on hot redeploy', async () => {
    await devDeploy(sim, ENTITY_FIXTURE);

    await sim.kvs.entity('task').set('t1', {
      title: 'Survives redeploy',
      status: 'available',
      priority: 2,
      projectId: 'P1',
      createdAt: '2026-07-18',
    });

    await devDeploy(sim, ENTITY_FIXTURE, { reload: true });

    expect(sim.kvs.getEntitySchemas().has('task')).toBe(true);
    const rows = await sim.kvs
      .entity('task')
      .query()
      .index('by-status', { partition: ['available'] })
      .getMany();
    expect(rows.results).toHaveLength(1);
  });

  // ── Everything deploy() has, the dev path has ─────────────────────────

  it('registers functions in the registry under the kind the manifest gives them', async () => {
    await devDeploy(sim, FIXTURE);
    expect(sim.functions.getType('fn-run')).toBe('scheduledTrigger');
    expect(sim.functions.getType('fn-cleanup')).toBe('generic');
    await devDeploy(sim, FIXTURE, { reload: true });
    expect(sim.functions.getType('fn-run')).toBe('scheduledTrigger');
  });

  describe('on a scratch app', () => {
    let dir: string;
    const MANIFEST = (extra = '') => `
modules:
  webtrigger:
    - key: hook
      function: fn-hook
${extra}
  function:
    - key: fn-hook
      handler: index.hook
app:
  id: ari:cloud:ecosystem::app/dev-deploy-scratch
  runtime:
    name: nodejs22.x
`;
    const HOOK = (body: string) => `export const hook = async () => ({ statusCode: 200, body: ${JSON.stringify(body)} });\n`;

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), 'forge-sim-dev-deploy-'));
      await mkdir(join(dir, 'src'), { recursive: true });
      await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'dev-deploy-scratch', private: true, type: 'module' }));
      await writeFile(join(dir, 'manifest.yml'), MANIFEST());
      await writeFile(join(dir, 'src', 'index.js'), HOOK('v1'));
      linkNodeModules(dir);
    });

    afterEach(async () => {
      await rm(dir, { recursive: true, force: true });
    });

    it('reports a module that references an undeclared function, as Forge lint does', async () => {
      await writeFile(join(dir, 'manifest.yml'), MANIFEST(`  trigger:
    - key: on-issue
      function: fn-missing
      events:
        - avi:jira:created:issue`));
      const result = await devDeploy(sim, dir);
      expect(result.loadedFunctions).toEqual(['fn-hook']);
      expect(result.errors.some((e) => /references function "fn-missing"/.test(e.error))).toBe(true);
    });

    it('runs the upstream manifest validator', async () => {
      await writeFile(join(dir, 'manifest.yml'), MANIFEST().replace('ari:cloud:ecosystem::app/dev-deploy-scratch', 'bad-id'));
      const result = await devDeploy(sim, dir);
      expect(result.errors.some((e) => e.functionKey === 'manifest' && /must match pattern/.test(e.error))).toBe(true);
    });

    it('a build failure on reload leaves the previous handlers serving', async () => {
      const first = await devDeploy(sim, dir);
      expect(first.errors).toEqual([]);
      expect((await sim.fireWebTrigger('hook')).body).toBe('v1');

      await writeFile(join(dir, 'src', 'index.js'), "import { nope } from './missing.js';\nexport const hook = async () => nope();\n");
      const broken = await devDeploy(sim, dir, { reload: true });
      expect(broken.loadedFunctions).toEqual([]);
      expect(broken.errors.some((e) => /Could not resolve/.test(e.error))).toBe(true);
      // forge deploy uploads nothing when the bundle fails: v1 still answers.
      expect((await sim.fireWebTrigger('hook')).body).toBe('v1');

      await writeFile(join(dir, 'src', 'index.js'), HOOK('v2'));
      const fixed = await devDeploy(sim, dir, { reload: true });
      expect(fixed.errors).toEqual([]);
      expect((await sim.fireWebTrigger('hook')).body).toBe('v2');
    });
  });
});
