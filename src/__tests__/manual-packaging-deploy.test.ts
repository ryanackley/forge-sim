/**
 * Manual packaging (#40), phase 2: handler resolution + as-is execution.
 *
 * Under app.package.bundler: manual@2026, handlers resolve ONLY inside
 * app.package.path and load WITHOUT esbuild — real Forge uploads the package
 * dir unmodified. That unlocks exactly the things bundling broke:
 * CommonJS output (require/module.exports/__dirname), data-file reads
 * relative to the module, CJS requires of @forge/* (routed to shims via
 * Module._resolveFilename — the ESM hooks never see require()), and .wasm
 * imports (Node-native, no bundler in the way).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { linkNodeModules } from './helpers/scratch-app.js';
import { resolve, join } from 'node:path';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'os';
import { createSimulator, ForgeSimulator } from '../simulator.js';
import { deploy } from '../deployer.js';

const FIXTURE_DIR = resolve(import.meta.dirname, 'fixtures/manual-packaging-app');

// The package dir requires @forge/resolver and @forge/kvs. Forge uploads only
// app.package.path, and so only that directory's node_modules count — the
// fixture cannot check one in, so link the repo's in (gitignored).
linkNodeModules(join(FIXTURE_DIR, 'out'));

describe('manual packaging: fixture app deploys and runs as-is', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    sim = createSimulator();
  });

  it('deploys with no errors and resolves handlers from app.package.path', async () => {
    const result = await deploy(sim, FIXTURE_DIR);
    expect(result.errors).toEqual([]);
    expect(result.loadedFunctions).toContain('main-fn');
    expect(result.loadedFunctions).toContain('hook-fn');
  });

  it('CJS handler runs unbundled: __dirname data read, relative require, @forge/* requires hit the sim', async () => {
    await deploy(sim, FIXTURE_DIR);

    // getText reads out/data.txt via __dirname, pulls `greeting` from a
    // relative require, and writes to KVS through require('@forge/kvs').
    const text = await sim.invoke('getText', {});
    expect(text).toBe('hello: manual data');

    // The KVS write proves require('@forge/kvs') reached the simulator's
    // store, not some real package talking to Atlassian.
    expect(await sim.kvs.get('manual-pkg-key')).toBe('manual data');
  });

  it('web trigger handler in a nested package directory responds', async () => {
    await deploy(sim, FIXTURE_DIR);
    const response = await sim.fireWebTrigger('hook');
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('from-manual-package');
  });
});

describe('manual packaging: resolution and redeploy semantics', () => {
  let appDir: string;
  let sim: ForgeSimulator;

  const MANIFEST = `
app:
  id: ari:cloud:ecosystem::app/11111111-2222-3333-4444-555555555555
  runtime:
    name: nodejs22.x
  package:
    bundler: manual@2026
    path: out
modules:
  webtrigger:
    - key: hook
      function: main
  function:
    - key: main
      handler: index.run
`;

  beforeEach(async () => {
    appDir = await mkdtemp(join(tmpdir(), 'forge-sim-manual-pkg-'));
    await writeFile(join(appDir, 'manifest.yml'), MANIFEST, 'utf8');
    // Real apps ship their own package.json; without one, Node walks up to
    // whatever package.json the tmpdir ancestry offers to decide if .js is
    // CJS or ESM. No `type` field → CommonJS, the typical compiled output.
    await writeFile(join(appDir, 'package.json'), '{ "name": "tmp-app", "private": true }', 'utf8');
    sim = createSimulator();
  });

  afterEach(async () => {
    await rm(appDir, { recursive: true, force: true }).catch(() => undefined);
  });

  it('does NOT fall back to src/ — the package dir must contain the handler', async () => {
    await mkdir(join(appDir, 'src'), { recursive: true });
    await writeFile(
      join(appDir, 'src', 'index.js'),
      'module.exports.run = () => ({ statusCode: 200 });',
      'utf8'
    );
    const result = await deploy(sim, appDir, { throwOnError: false });
    const notFound = result.errors.find((e) => e.functionKey === 'main');
    expect(notFound?.error).toMatch(/under app\.package\.path/);
    expect(notFound?.error).toMatch(/out\/index/);
  });

  it('redeploy picks up an edited CJS entry file', async () => {
    // Transitive-file edits are covered by the clearAppRequireCache unit test
    // below: under vitest, vite-node owns the module graph for these imports
    // (its cache is separate from require.cache), so the full
    // edit-transitive-file-and-redeploy flow is only exercisable in plain
    // Node — which is where it matters (forge-sim dev / MCP daemon).
    await mkdir(join(appDir, 'out'), { recursive: true });
    const write = (tag: string) =>
      writeFile(
        join(appDir, 'out', 'index.js'),
        `module.exports.run = () => ({ statusCode: 200, body: '${tag}' });`,
        'utf8'
      );

    await write('v1');
    await deploy(sim, appDir);
    expect((await sim.fireWebTrigger('hook')).body).toBe('v1');

    await write('v2');
    await deploy(sim, appDir);
    expect((await sim.fireWebTrigger('hook')).body).toBe('v2');
  });

  it('clearAppRequireCache evicts transitively-required CJS modules (incl. realpath keys)', async () => {
    const { clearAppRequireCache } = await import('../deployer.js');
    const { createRequire } = await import('node:module');
    const nativeRequire = createRequire(import.meta.url);

    await mkdir(join(appDir, 'out'), { recursive: true });
    const entry = join(appDir, 'out', 'entry.cjs');
    const helper = join(appDir, 'out', 'helper.cjs');
    await writeFile(entry, `module.exports.tag = require('./helper.cjs').tag;`, 'utf8');
    await writeFile(helper, `module.exports.tag = 'v1';`, 'utf8');

    expect(nativeRequire(entry).tag).toBe('v1');

    // Edit only the transitive file. Without eviction the cached copy wins —
    // note appDir is a tmpdir symlink on macOS (/var → /private/var), which
    // is exactly the realpath mismatch the implementation must handle.
    await writeFile(helper, `module.exports.tag = 'v2';`, 'utf8');
    expect(nativeRequire(entry).tag).toBe('v1');

    clearAppRequireCache(appDir);
    expect(nativeRequire(entry).tag).toBe('v2');
  });

  it('does not resolve .mjs handlers (Forge lint rejects them) — one consistent error', async () => {
    // Adversarial finding #6: the validator rejected index.mjs while the
    // deployer happily loaded it, producing contradictory errors. The
    // deployer must agree with lint: .mjs is not a handler extension.
    await mkdir(join(appDir, 'out'), { recursive: true });
    await writeFile(
      join(appDir, 'out', 'index.mjs'),
      'export const run = () => ({ statusCode: 200 });',
      'utf8'
    );
    const result = await deploy(sim, appDir, { throwOnError: false });
    const notFound = result.errors.find(
      (e) => e.functionKey === 'main' && /Could not find handler file/.test(e.error)
    );
    expect(notFound?.error).toMatch(/\.mjs is not\s+accepted by Forge lint/);
    // And crucially: no "Failed to load"-style error proving we imported it anyway.
    expect(result.errors.some((e) => /Failed to load/.test(e.error))).toBe(false);
  });

  it('does not resolve .tsx/.jsx handlers — Node cannot load JSX, so Forge would crash', async () => {
    // Packaging standard: "<path>.js (or the same path with a different
    // extension that Node.js can load)". The sim's loader hooks CAN
    // transpile .tsx/.jsx, which is exactly why resolving them here would be
    // the inverse parity violation: found by forge-sim, crashes on Forge.
    await mkdir(join(appDir, 'out'), { recursive: true });
    for (const ext of ['tsx', 'jsx']) {
      await writeFile(join(appDir, 'out', `index.${ext}`), 'export const run = () => ({ statusCode: 200 });', 'utf8');
    }
    const result = await deploy(sim, appDir, { throwOnError: false });
    const notFound = result.errors.find(
      (e) => e.functionKey === 'main' && /Could not find handler file/.test(e.error)
    );
    expect(notFound?.error).toMatch(/\.tsx\/\.jsx are not loadable by Node/);
    expect(result.errors.some((e) => /Failed to load/.test(e.error))).toBe(false);
  });

  it('warns when a handler resolves to a TypeScript source under manual packaging', async () => {
    await mkdir(join(appDir, 'out'), { recursive: true });
    await writeFile(
      join(appDir, 'out', 'index.ts'),
      'export const run = () => ({ statusCode: 200 });',
      'utf8'
    );
    const result = await deploy(sim, appDir, { throwOnError: false });
    expect(result.errors).toEqual([]);
    expect(
      result.warnings.some((w) => /resolved to a TypeScript source file/.test(w.message))
    ).toBe(true);
  });

  it('warns when a manual-packaged .js handler is ESM via "type": "module" (standard requires CommonJS)', async () => {
    // Packaging standard: "a CommonJS module file <path>.js". Node (and the
    // sim's import()) load an ESM .js fine when the nearest package.json says
    // "type": "module", so the app runs here while being off-standard in
    // production — surface it at deploy. Bundler-matrix lab: Vite's SSR
    // build is ESM-only and passed silently before this.
    await mkdir(join(appDir, 'out'), { recursive: true });
    await writeFile(join(appDir, 'package.json'), '{ "name": "esm-probe", "private": true, "type": "module" }', 'utf8');
    await writeFile(join(appDir, 'out', 'index.js'), 'export const run = () => ({ statusCode: 200 });', 'utf8');
    const result = await deploy(sim, appDir, { throwOnError: false });
    expect(result.errors).toEqual([]);
    expect(
      result.warnings.some((w) => /requires manual-packaged handlers to be CommonJS/.test(w.message))
    ).toBe(true);
  });

  it('does not warn about a CommonJS .js handler under manual packaging', async () => {
    await mkdir(join(appDir, 'out'), { recursive: true });
    await writeFile(join(appDir, 'package.json'), '{ "name": "cjs-ok", "private": true }', 'utf8');
    await writeFile(join(appDir, 'out', 'index.js'), 'exports.run = () => ({ statusCode: 200 });', 'utf8');
    const result = await deploy(sim, appDir, { throwOnError: false });
    expect(result.errors).toEqual([]);
    expect(result.warnings.some((w) => /CommonJS/.test(w.message))).toBe(false);
  });

  it('redeploy refreshes web trigger handlers under DEFAULT packaging too (regression)', async () => {
    // Pre-existing bug surfaced by this work: web-trigger registration was
    // guarded by `!sim.functions.has(key)`, which can't tell "registered
    // earlier in this deploy" from "registered by the previous deploy" — so
    // redeploys kept serving deploy #1's handler regardless of bundling mode.
    await writeFile(
      join(appDir, 'manifest.yml'),
      MANIFEST.replace(/  package:[\s\S]*?path: out\n/, ''),
      'utf8'
    );
    await mkdir(join(appDir, 'src'), { recursive: true });
    const write = (tag: string) =>
      writeFile(
        join(appDir, 'src', 'index.js'),
        `export const run = () => ({ statusCode: 200, body: '${tag}' });`,
        'utf8'
      );

    await write('bundled-v1');
    await deploy(sim, appDir);
    expect((await sim.fireWebTrigger('hook')).body).toBe('bundled-v1');

    await write('bundled-v2');
    await deploy(sim, appDir);
    expect((await sim.fireWebTrigger('hook')).body).toBe('bundled-v2');
  });

  it('imports .wasm from unbundled handlers (Node-native wasm modules)', async () => {
    // ESM-output app: `type: module` makes out/index.js an ES module. The
    // handler must be .js — upstream lint's handler extension set is
    // (tsx|jsx|ts|js|cjs), so .mjs handlers are rejected by real Forge too.
    await writeFile(
      join(appDir, 'package.json'),
      '{ "name": "tmp-app", "private": true, "type": "module" }',
      'utf8'
    );
    // Minimal valid wasm module exporting add(i32, i32) -> i32.
    const WASM_ADD = Buffer.from(
      '0061736d0100000001070160027f7f017f03020100070701036164640000' +
        '0a09010700200020016a0b',
      'hex'
    );
    await mkdir(join(appDir, 'out'), { recursive: true });
    await writeFile(join(appDir, 'out', 'add.wasm'), WASM_ADD);
    await writeFile(
      join(appDir, 'out', 'index.js'),
      `import { add } from './add.wasm';\nexport const run = () => ({ statusCode: 200, body: String(add(2, 3)) });`,
      'utf8'
    );
    const result = await deploy(sim, appDir, { throwOnError: false });
    expect(result.errors).toEqual([]);
    expect((await sim.fireWebTrigger('hook')).body).toBe('5');
  });
});
