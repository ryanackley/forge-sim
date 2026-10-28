/**
 * sim.deploy() bundles the backend the way `forge deploy` does: one esbuild
 * build per deploy, one output per handler file, EVERY dependency inlined,
 * nothing left for a module loader to resolve at runtime. These tests pin
 * what that buys and what it must not break (src/bundler.ts for the why).
 *
 * The app lives in os.tmpdir() with a `node_modules` linked to the repo's
 * (helpers/scratch-app.ts): forge-sim resolves only from the app's own
 * node_modules chain, as `forge deploy` does.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSimulator, type ForgeSimulator } from '../simulator.js';
import { listBundleCache } from '../bundler.js';
import { linkNodeModules } from './helpers/scratch-app.js';

const MANIFEST = `
modules:
  jira:issuePanel:
    - key: panel-a
      title: A
      icon: https://example.com/icon.svg
      resource: fe
      render: native
      resolver:
        function: fn-a
    - key: panel-b
      title: B
      icon: https://example.com/icon.svg
      resource: fe
      render: native
      resolver:
        function: fn-b
  function:
    - key: fn-a
      handler: index.handler
    - key: fn-b
      handler: other.handler
resources:
  - key: fe
    path: src/fe.tsx
app:
  id: ari:cloud:ecosystem::app/deploy-bundle-test
  runtime:
    name: nodejs22.x
permissions:
  scopes: []
`;

/** The four documented default-import styles, plus a shared-singleton probe and a counter. */
const INDEX = (greeting: string) => `
import kvs from '@forge/kvs';
import sql, { migrationRunner } from '@forge/sql';
import api, { route, i18n } from '@forge/api';
import Resolver from '@forge/resolver';
import * as sqlNs from '@forge/sql';
import { helperValue } from './helper';

globalThis.__fsProbeRunner = migrationRunner;
let calls = 0;
const resolver = new Resolver();
resolver.define('probeA', () => ({
  kvsGet: typeof kvs.get,
  sqlPrepare: typeof sql.prepare,
  sqlDefaultIsNamed: sql === sqlNs.sql,
  apiAsApp: typeof api.asApp,
  route: typeof route,
  helperValue,
  greeting: ${JSON.stringify(greeting)},
}));
resolver.define('count', () => ++calls);
resolver.define('greet', async () => {
  const t = await i18n.createTranslationFunction('en-US');
  return t('greeting');
});
export const handler = resolver.getDefinitions();
`;

const OTHER = `
import { migrationRunner } from '@forge/sql';
import Resolver from '@forge/resolver';
const resolver = new Resolver();
resolver.define('probeB', () => ({ sameRunnerAsIndex: migrationRunner === globalThis.__fsProbeRunner }));
export const handler = resolver.getDefinitions();
`;

const FE = `
import ForgeReconciler, { Text } from '@forge/react';
ForgeReconciler.render(<Text>hi</Text>);
`;

let dir: string;
let sim: ForgeSimulator;

async function writeApp(opts: { helper?: string; greeting?: string; extraImport?: string } = {}) {
  await mkdir(join(dir, 'src'), { recursive: true });
  linkNodeModules(dir);
  // `"type": "module"` is the shape CLAUDE.md tells apps to ship (ESM as .js).
  // It is also what flips esbuild into Node-style default-import interop,
  // which would break `import kvs from '@forge/kvs'` — the bundler forces the
  // bundler convention back (forceBundlerInterop); this app pins that.
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'deploy-bundle-test', type: 'module' }));
  await writeFile(join(dir, 'manifest.yml'), MANIFEST);
  await writeFile(join(dir, 'src', 'index.ts'), (opts.extraImport ?? '') + INDEX(opts.greeting ?? 'hello'));
  await writeFile(join(dir, 'src', 'other.ts'), OTHER);
  await writeFile(join(dir, 'src', 'helper.ts'), `export const helperValue = ${JSON.stringify(opts.helper ?? 'v1')};\n`);
  await writeFile(join(dir, 'src', 'fe.tsx'), FE);
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'forge-sim-deploy-bundle-'));
  sim = createSimulator();
});

afterEach(async () => {
  await sim.stop();
  await rm(dir, { recursive: true, force: true });
});

describe('deploy bundles the backend like forge deploy', () => {
  it('the documented default-import styles work end to end — no loader hooks, no facade', async () => {
    await writeApp();
    await sim.deploy(dir, { fireScheduledTriggers: false });
    expect(await sim.invoke('probeA')).toMatchObject({
      kvsGet: 'function',
      sqlPrepare: 'function',
      sqlDefaultIsNamed: true,
      apiAsApp: 'function',
      route: 'function',
      helperValue: 'v1',
    });
  });

  it('no bare @forge/* specifier survives in the output (the app is shape 2 now)', async () => {
    await writeApp();
    await sim.deploy(dir, { fireScheduledTriggers: false });
    const bundles = join(dir, '.forge-sim', 'bundles');
    const deployDirs = (await readdir(bundles)).filter((n) => n.startsWith('deploy-'));
    expect(deployDirs).toHaveLength(1);
    const files = await collect(join(bundles, deployDirs[0]));
    expect(files.map((f) => f.slice(join(bundles, deployDirs[0]).length + 1)).sort())
      .toEqual(['src/index.cjs', 'src/other.cjs']); // one output per handler file, like forge deploy
    for (const f of files) {
      const text = await readFile(f, 'utf8');
      // Strip inline sourcemaps: the ORIGINAL sources (with their imports)
      // live in there as text, and are not what runs. Match real import
      // syntax only — @forge/api carries the string "from '@forge/api'" inside
      // an error message, which is not an import.
      const code = text.replace(/\/\/# sourceMappingURL=.*$/m, '');
      expect(code, f).not.toMatch(/^\s*(?:import|export)\b[^;]*?\bfrom\s*["']@forge\//m);
      expect(code, f).not.toMatch(/\b(?:import|require)\(\s*["']@forge\//);
    }
  });

  it('each handler file carries its own @forge/* copies (one output per entry, no chunk splitting, like Forge)', async () => {
    await writeApp();
    await sim.deploy(dir, { fireScheduledTriggers: false });
    expect(await sim.invoke('probeB')).toEqual({ sameRunnerAsIndex: false });
  });

  it('a redeploy is a fresh evaluation: module state resets, like a cold Forge process', async () => {
    await writeApp();
    await sim.deploy(dir, { fireScheduledTriggers: false });
    expect(await sim.invoke('count')).toBe(1);
    expect(await sim.invoke('count')).toBe(2);
    await sim.deploy(dir, { fireScheduledTriggers: false });
    expect(await sim.invoke('count')).toBe(1);
  });

  it('an unchanged redeploy is a cache hit; editing a TRANSITIVE file is a miss and the new code runs', async () => {
    await writeApp({ helper: 'v1' });
    const first = await sim.deploy(dir, { fireScheduledTriggers: false });
    expect(first.bundle?.cached).toBe(false);
    expect(await listBundleCache(dir)).toHaveLength(1);

    const second = await sim.deploy(dir, { fireScheduledTriggers: false });
    expect(second.bundle?.cached).toBe(true);
    expect((await sim.invoke('probeA')).helperValue).toBe('v1');

    // Only helper.ts changes — the entry file is untouched. This is the F3
    // story (edits to transitive files must land) with the cache in the way.
    await writeFile(join(dir, 'src', 'helper.ts'), `export const helperValue = 'v2-edited';\n`);
    const third = await sim.deploy(dir, { fireScheduledTriggers: false });
    expect(third.bundle?.cached).toBe(false);
    expect((await sim.invoke('probeA')).helperValue).toBe('v2-edited');
    expect(await listBundleCache(dir)).toHaveLength(1); // same key, refreshed entry
  });

  it('reports which @forge/* packages were inlined', async () => {
    await writeApp();
    const result = await sim.deploy(dir, { fireScheduledTriggers: false });
    expect(result.bundle?.inlinedForgePackages).toEqual(
      expect.arrayContaining(['@forge/api', '@forge/kvs', '@forge/sql']),
    );
  });

  it('warns at deploy about a DIRECT import of an @forge/* package the sim does not simulate', async () => {
    // @forge/manifest is installed (a dependency of @forge/api) but is not a
    // runtime surface the sim answers. A direct import gets the advisory; the
    // transitive one @forge/api itself makes does not.
    await writeApp({ extraImport: `import * as __m from '@forge/manifest'; void __m;\n` });
    const result = await sim.deploy(dir, { fireScheduledTriggers: false });
    const advisories = result.warnings.filter((w) => /is not simulated by forge-sim/.test(w.message));
    expect(advisories.map((w) => w.message)).toEqual([expect.stringContaining('"@forge/manifest"')]);
  });

  it('warns at deploy when a backend function imports a frontend package (@forge/bridge works here, throws on Forge)', async () => {
    await writeApp({ extraImport: `import { invoke } from '@forge/bridge'; void invoke;\n` });
    const result = await sim.deploy(dir, { fireScheduledTriggers: false });
    const advisories = result.warnings.filter((w) => /a frontend package, from a backend function/.test(w.message));
    expect(advisories.map((w) => w.message)).toEqual([
      expect.stringMatching(/^src\/index\.ts imports @forge\/bridge, a frontend package/),
    ]);
    expect(advisories[0].message).toContain('Unable to establish a connection with the Custom UI bridge');
    // The file-level attribution survives a cache hit.
    const again = await sim.deploy(dir, { fireScheduledTriggers: false });
    expect(again.bundle?.cached).toBe(true);
    expect(again.warnings.filter((w) => /a frontend package, from a backend function/.test(w.message))).toHaveLength(1);
  });

  it('a normal app gets no "not simulated" advisory', async () => {
    await writeApp();
    const result = await sim.deploy(dir, { fireScheduledTriggers: false });
    expect(result.warnings.filter((w) => /is not simulated by forge-sim/.test(w.message))).toEqual([]);
    expect(result.warnings.filter((w) => /a frontend package, from a backend function/.test(w.message))).toEqual([]);
  });

  it('sim.i18n.setTranslations() invalidates the @forge/api cache INSIDE the bundle', async () => {
    // @forge/api's TranslationsGetter is a module-level singleton that
    // memoizes per locale. The sim's store resets forge-sim's own copy via a
    // deep require; the copy inlined in the app bundle is a different module
    // and is reached through the registration src/bundler.ts appends to it.
    await writeApp();
    await sim.deploy(dir, { fireScheduledTriggers: false });
    sim.i18n.setTranslations('en-US', { greeting: 'Hello' });
    expect(await sim.invoke('greet')).toBe('Hello');
    sim.i18n.setTranslations('en-US', { greeting: 'Hello again' });
    expect(await sim.invoke('greet')).toBe('Hello again');
  });
});

async function collect(root: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const p = join(root, entry.name);
    if (entry.isDirectory()) out.push(...(await collect(p)));
    else if (/\.(mjs|cjs)$/.test(entry.name)) out.push(p);
  }
  return out;
}
