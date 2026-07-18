/**
 * Dev-path deploy regressions (F8 + F3 in `deployResolversOnly`).
 *
 * `forge-sim dev` loads manifest functions through `deployResolversOnly`,
 * a sibling of `deployer.deploy()` that historically missed two fixes:
 *
 *  - F8: a source file shared by N function entries (okr-tracker routes
 *    5 entries through src/index.ts) was imported once per entry under a
 *    unique URL, re-running its top-level `resolver.define()` calls N times
 *    and spamming "overwriting an existing definition" warnings.
 *  - F3: the old `?t=Date.now()` cache-buster only busted the entry file;
 *    transitive relative imports kept plain URLs and stayed cached, so a
 *    second deploy pass in the same process served stale helper code.
 *
 * Fixed 2026-07-12 (4e15d27) by sharing the deployer's esbuild bundling +
 * a per-deploy module cache. These tests pin that behavior.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { createSimulator, type ForgeSimulator } from '../simulator.js';
import { parseManifest } from '../manifest.js';
import { deployResolversOnly } from '../dev-command.js';

const FIXTURE = join(import.meta.dirname, 'fixtures/dev-shared-entry');
const HELPER_FILE = join(FIXTURE, 'src/helper.js');

const HELPER_V2 = `// Transitive helper — the test rewrites this file mid-flight to verify a
// second dev deploy pass picks up the new code (F3 in the dev path).
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

describe('deployResolversOnly — shared entry file (F8/F3 dev path)', () => {
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
    const manifest = await parseManifest(join(FIXTURE, 'manifest.yml'));
    const result = await deployResolversOnly(sim, FIXTURE, manifest);

    expect(result.errors).toEqual([]);
    expect(result.loadedFunctions.sort()).toEqual(['fn-cleanup', 'fn-main', 'fn-run']);
    // Three function entries, ONE evaluation of src/index.js.
    expect(globalThis.__devSharedEntryEvals).toBe(1);
  });

  it('registers all handlers without overwrite-warning spam', async () => {
    const warnSpy = vi.spyOn(console, 'warn');
    try {
      const manifest = await parseManifest(join(FIXTURE, 'manifest.yml'));
      await deployResolversOnly(sim, FIXTURE, manifest);

      const overwriteWarnings = warnSpy.mock.calls.filter((args) =>
        String(args[0]).includes('overwriting an existing definition')
      );
      expect(overwriteWarnings).toEqual([]);

      // Resolver definitions from the shim AND plain function exports all land.
      expect(await sim.resolver.invoke('greet')).toEqual({ message: 'dev v1' });
      expect(await sim.resolver.invoke('stats')).toEqual({ ok: true });
      expect(await sim.resolver.invoke('fn-run')).toEqual({ statusCode: 204 });
      expect(await sim.resolver.invoke('fn-cleanup')).toEqual({ cleaned: true });
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('a second deploy pass picks up edits to a transitive helper', async () => {
    const manifest = await parseManifest(join(FIXTURE, 'manifest.yml'));

    await deployResolversOnly(sim, FIXTURE, manifest);
    expect(await sim.resolver.invoke('greet')).toEqual({ message: 'dev v1' });

    // Edit ONLY the transitive helper — the entry file is untouched, so the
    // old `?t=` cache-buster would have served the stale helper here.
    await writeFile(HELPER_FILE, HELPER_V2, 'utf-8');

    await sim.reset();
    const manifest2 = await parseManifest(join(FIXTURE, 'manifest.yml'));
    await deployResolversOnly(sim, FIXTURE, manifest2);

    expect(await sim.resolver.invoke('greet')).toEqual({ message: 'dev v2', edited: true });
  });

  // ── Hot redeploy ({ reload: true }) — the save-triggered dev path ──────
  //
  // `forge-sim dev` wires the file watcher to `deployResolversOnly(sim, dir,
  // manifest, { reload: true })`. Forge tunnel parity: a local rebuild, not a
  // fresh install — definitions swap cleanly, scheduled work doesn't re-run,
  // simulator state survives.

  it('hot redeploy serves fresh transitive code without reset or warnings', async () => {
    const warnSpy = vi.spyOn(console, 'warn');
    try {
      const manifest = await parseManifest(join(FIXTURE, 'manifest.yml'));
      await deployResolversOnly(sim, FIXTURE, manifest);
      expect(await sim.resolver.invoke('greet')).toEqual({ message: 'dev v1' });

      await writeFile(HELPER_FILE, HELPER_V2, 'utf-8');

      // No sim.reset() — this is the live watcher path. reload: true clears
      // definitions itself, so re-registration must be silent.
      const result = await deployResolversOnly(sim, FIXTURE, manifest, { reload: true });
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
    // report-gen (2026-07-16): the dev path hand-rolled a made-up
    // `{ scheduledTrigger: { key, interval } }` payload, so apps that switch
    // on `event.context.moduleKey` — the documented way to tell which
    // schedule fired — saw `undefined` locally but worked in production.
    const manifest = await parseManifest(join(FIXTURE, 'manifest.yml'));
    const result = await deployResolversOnly(sim, FIXTURE, manifest);

    expect(result.errors).toEqual([]);
    const event = globalThis.__devSharedEntryLastEvent;
    expect(event?.context?.moduleKey).toBe('tick');
    expect(event?.context?.cloudId).toBeDefined();
    expect(event?.contextToken).toBeDefined();
    // The invented dev-only shape must be gone.
    expect(event?.scheduledTrigger).toBeUndefined();
  });

  it('scheduled triggers fire on the initial pass but NOT on hot redeploys', async () => {
    const manifest = await parseManifest(join(FIXTURE, 'manifest.yml'));

    await deployResolversOnly(sim, FIXTURE, manifest);
    expect(globalThis.__devSharedEntryTicks).toBe(1);

    await deployResolversOnly(sim, FIXTURE, manifest, { reload: true });
    await deployResolversOnly(sim, FIXTURE, manifest, { reload: true });
    expect(globalThis.__devSharedEntryTicks).toBe(1);
  });

  it('KVS state survives a hot redeploy pass', async () => {
    const manifest = await parseManifest(join(FIXTURE, 'manifest.yml'));
    await deployResolversOnly(sim, FIXTURE, manifest);

    await sim.kvs.set('sticky', { keep: 'me' });
    await deployResolversOnly(sim, FIXTURE, manifest, { reload: true });

    expect(await sim.kvs.get('sticky')).toEqual({ keep: 'me' });
  });

  // ── Custom Entity Store schemas (eval-9 E9-3) ───────────────────────────
  //
  // deployer.deploy() step 1c registers app.storage.entities schemas before
  // loading code. The dev path skipped that step, so `forge-sim dev` ran the
  // KVS engine in permissive (schema-less) mode: entity queries silently
  // dropped partition/range filtering (every partition returned every row)
  // and all schema-gated enforcement — type validation, INDEX_NOT_FOUND,
  // ENTITY_NOT_FOUND, partition arity — was inert in dev mode while working
  // correctly in tests and via MCP.

  it('registers app.storage.entities schemas like the full deployer (E9-3)', async () => {
    const ENTITY_FIXTURE = join(import.meta.dirname, 'fixtures/manifest-entities');
    const manifest = await parseManifest(join(ENTITY_FIXTURE, 'manifest.yml'));
    await deployResolversOnly(sim, ENTITY_FIXTURE, manifest);

    const schemas = sim.kvs.getEntitySchemas();
    expect(schemas.has('Task')).toBe(true);
    expect(schemas.has('Comment')).toBe(true);

    // Partition filtering must actually apply — the eval's repro was every
    // partition returning every row in dev mode.
    await sim.kvs.entity('Task').set('t1', {
      title: 'Fix the thing',
      status: 'available',
      priority: 1,
      projectId: 'P1',
      createdAt: '2026-07-18',
    });

    const hit = await sim.kvs
      .entity('Task')
      .query()
      .index('by-status', { partition: ['available'] })
      .getMany();
    expect(hit.results).toHaveLength(1);

    const miss = await sim.kvs
      .entity('Task')
      .query()
      .index('by-status', { partition: ['loaned'] })
      .getMany();
    expect(miss.results).toHaveLength(0);

    // Schema-gated enforcement is live: undeclared entities throw instead of
    // silently returning phantom-empty results.
    expect(() => sim.kvs.entity('Ghost').query()).toThrow(/ENTITY_NOT_FOUND/);
  });

  it('re-registers schemas idempotently on hot redeploy (E9-3)', async () => {
    const ENTITY_FIXTURE = join(import.meta.dirname, 'fixtures/manifest-entities');
    const manifest = await parseManifest(join(ENTITY_FIXTURE, 'manifest.yml'));
    await deployResolversOnly(sim, ENTITY_FIXTURE, manifest);

    await sim.kvs.entity('Task').set('t1', {
      title: 'Survives redeploy',
      status: 'available',
      priority: 2,
      projectId: 'P1',
      createdAt: '2026-07-18',
    });

    await deployResolversOnly(sim, ENTITY_FIXTURE, manifest, { reload: true });

    expect(sim.kvs.getEntitySchemas().has('Task')).toBe(true);
    const rows = await sim.kvs
      .entity('Task')
      .query()
      .index('by-status', { partition: ['available'] })
      .getMany();
    expect(rows.results).toHaveLength(1);
  });
});
