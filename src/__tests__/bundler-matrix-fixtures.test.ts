/**
 * Real bundler output, end to end. Each fixture under fixtures/bundler-matrix
 * is the SAME tiny Forge app built by a different bundler — a replica of
 * @forge/bundler's own webpack config, Rspack, Vite (the Forge docs'
 * canonical multi-entry example), Rollup, Parcel, user-run esbuild, and the
 * docs' unbundled "plain TypeScript" layout — then deployed manual-packaged
 * exactly as uploaded. The lab at lab/bundler-matrix generates them; this
 * test keeps the sim honest against every shape without installing a single
 * bundler.
 *
 * What each shape proves is in the fixture's manifest-adjacent layout:
 * classic <script defer> pages with splitChunks (webpack/Rspack), absolute
 * and hashed module scripts with a modulepreload polyfill (Vite), a
 * single-file ESM bundle that evaluates iframe-resizer eagerly (Rollup),
 * unquoted attributes + importmap + shared bundles (Parcel), a minified IIFE
 * behind a classic tag (esbuild), bare `require('@forge/*')` resolved from
 * out/node_modules (tsc-unbundled). Vite's backend is ESM under
 * "type": "module" on purpose — the standard requires CommonJS, so it is the
 * negative control: deploy must warn.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join, resolve } from 'node:path';
import { readdirSync, existsSync, lstatSync, unlinkSync, symlinkSync } from 'node:fs';
import { createSimulator, type ForgeSimulator } from '../simulator.js';
import { deploy } from '../deployer.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const FIXTURES = resolve(import.meta.dirname, 'fixtures', 'bundler-matrix');

interface Variant { name: string; multi: boolean; expectWarning?: RegExp }
const VARIANTS: Variant[] = readdirSync(FIXTURES, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => ({
    name: d.name,
    multi: existsSync(join(FIXTURES, d.name, 'frontend-multi')),
    ...(d.name === 'vite' ? { expectWarning: /requires manual-packaged handlers to be CommonJS/ } : {}),
  }));

describe.each(VARIANTS)('bundler-matrix fixture: $name', (v) => {
  const appDir = join(FIXTURES, v.name);
  let sim: ForgeSimulator;
  let warnings: string[] = [];

  beforeAll(async () => {
    // The docs' unbundled layout keeps dependencies in <package.path>/node_modules;
    // the fixture can't check that in, so point it at the repo's.
    const nm = join(appDir, 'out', 'node_modules');
    if (v.name === 'tsc-unbundled') {
      try { if (lstatSync(nm)) unlinkSync(nm); } catch { /* absent */ }
      symlinkSync(join(REPO_ROOT, 'node_modules'), nm, 'dir');
    }
    sim = createSimulator();
    sim.mockProductRoutes('jira', {
      '/rest/api/3/issue/LAB-1': { key: 'LAB-1', fields: { summary: 'From the mocked Jira' } },
    });
    const result = await deploy(sim, appDir, { fireScheduledTriggers: false, throwOnError: false });
    expect(result.errors, JSON.stringify(result.errors)).toEqual([]);
    warnings = result.warnings.map((w) => w.message);
  }, 60_000);

  afterAll(async () => { await sim.stop(); });

  it('backend: inlined @forge/resolver + @forge/kvs reach the sim through the seams', async () => {
    expect(await sim.invoke('save', { id: 'a1' })).toBe('saved a1');
    expect(await sim.kvs.get('saved:a1')).toEqual({ id: 'a1', by: 'matrix-backend' });
  });

  it('backend: @forge/api requestJira(route`…`) hits the mocked product route', async () => {
    expect(await sim.invoke('issue', { key: 'LAB-1' })).toBe('From the mocked Jira');
  });

  it('frontend: the single-entry UI Kit page renders and round-trips invoke', async () => {
    const doc = await sim.ui.waitForContent('panel', 'ui saved by matrix-backend', 20_000);
    expect(sim.ui.getTextContent(doc)).toContain('ui saved by matrix-backend');
  }, 30_000);

  it.runIf(v.multi)('frontend: both entries of the multi-entry resource render (shared chunk + entry)', async () => {
    const home = await sim.ui.waitForContent('page-home', 'entry:home', 20_000);
    expect(sim.ui.getTextContent(home)).toContain('ui saved by matrix-backend');
    const settings = await sim.ui.waitForContent('page-settings', 'entry:settings', 20_000);
    expect(sim.ui.getTextContent(settings)).toContain('ui saved by matrix-backend');
  }, 30_000);

  it.runIf(!!v.expectWarning)('negative control: the off-standard shape is flagged at deploy', () => {
    expect(warnings.some((w) => v.expectWarning!.test(w)), warnings.join('\n')).toBe(true);
  });

  it.runIf(!v.expectWarning)('a standard-conforming backend deploys without a CommonJS warning', () => {
    expect(warnings.filter((w) => /CommonJS/.test(w))).toEqual([]);
  });
});
