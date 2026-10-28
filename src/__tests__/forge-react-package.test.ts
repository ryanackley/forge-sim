/**
 * The REAL @forge/react, with no shim and no patch in front of it.
 *
 * Headless `sim.ui.render()` bundles a source UI Kit entry per render
 * (src/bundler.ts, platform browser) into a fresh directory, so every render
 * — first or fifth — is a real evaluation of the bundle: top-level
 * `ForgeReconciler.render()` runs, a reconcile frame lands. That is what
 * retired N9, the vite-node cache workaround that captured the React element
 * on first evaluation and replayed it later. This file is the regression for
 * the case N9 existed for, measured rather than assumed:
 *
 *   vite-node TRANSFORMS files inside the project root and honours a `?t=`
 *   cache-bust on them; it EXTERNALIZES files outside the root — an app
 *   deployed to os.tmpdir(), the common pattern for scratch apps — and strips
 *   the query, so a plain re-import was a cache hit. The second suite builds
 *   its fixture in tmpdir for exactly that reason, and asserts a FRESH effect
 *   result ("render-2"), which no stale doc can produce.
 */
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { linkNodeModules } from './helpers/scratch-app.js';
import { mkdirSync, writeFileSync, rmSync, symlinkSync, existsSync, readdirSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ForgeSimulator, createSimulator } from '../simulator.js';
import { onRender } from '../ui/bridge.js';
import { listBundleCache } from '../bundler.js';

const settle = () => new Promise((r) => setTimeout(r, 300));

/** Render `key` and count the reconcile frames that land. */
async function renderAndCount(sim: ForgeSimulator, key: string): Promise<number> {
  let pulses = 0;
  const unbind = onRender(() => { pulses++; });
  await sim.ui.render(key);
  await settle();
  unbind();
  return pulses;
}

const text = (sim: ForgeSimulator, key: string) => sim.ui.getTextContent(sim.ui.getForgeDoc(key)!);

// ── In-root fixture ───────────────────────────────────────────────────────

describe('@forge/react runs for real — fixture inside the project root', () => {
  const APP_DIR = join(import.meta.dirname, 'fixtures/macro-inline-config');
  const KEY = 'pet-card';
  let sim: ForgeSimulator;
  afterEach(async () => { sim?.ui.resetAll(); await sim?.stop(); });

  it('a second render() of the same module is a fresh evaluation', async () => {
    sim = new ForgeSimulator();
    await sim.deploy(APP_DIR);
    sim.ui.setMacroConfig(KEY, { name: 'Whiskers', tier: 'gold' });
    expect(await renderAndCount(sim, KEY)).toBeGreaterThan(0);
    expect(await renderAndCount(sim, KEY)).toBeGreaterThan(0);
  });

  it('a re-render after new config shows the NEW config (no stale doc)', async () => {
    sim = new ForgeSimulator();
    await sim.deploy(APP_DIR);
    sim.ui.setMacroConfig(KEY, { name: 'Whiskers', tier: 'gold' });
    await sim.ui.render(KEY);
    expect(text(sim, KEY)).toContain('Whiskers');
    sim.ui.setMacroConfig(KEY, { name: 'Mittens', tier: 'gold' });
    await sim.ui.render(KEY);
    expect(text(sim, KEY)).toContain('Mittens');
    expect(text(sim, KEY)).not.toContain('Whiskers');
  });

  it('vi.resetModules() between renders is harmless', async () => {
    sim = new ForgeSimulator();
    await sim.deploy(APP_DIR);
    sim.ui.setMacroConfig(KEY, { name: 'Whiskers', tier: 'gold' });
    expect(await renderAndCount(sim, KEY)).toBeGreaterThan(0);
    vi.resetModules();
    expect(await renderAndCount(sim, KEY)).toBeGreaterThan(0);
  });

  it('the render bundle is removed after import and the build is cached for the next render', async () => {
    // A private copy of the fixture: other workers render the shared one
    // concurrently and would have their own render-* dir in flight.
    const own = join(tmpdir(), `forge-sim-render-cleanup-${Date.now()}`);
    cpSync(APP_DIR, own, { recursive: true, filter: (p) => !p.includes('.forge-sim') });
    // Out of the repo the copy has no node_modules chain to resolve from.
    linkNodeModules(own);
    try {
      sim = new ForgeSimulator();
      await sim.deploy(own);
      sim.ui.setMacroConfig(KEY, { name: 'Whiskers', tier: 'gold' });
      await sim.ui.render(KEY);
      await settle();
      const bundles = join(own, '.forge-sim', 'bundles');
      expect(readdirSync(bundles).filter((n) => n.startsWith('render-'))).toEqual([]);
      // The render's browser bundle is cached (plus the deploy's node bundle
      // when the app has backend functions — this macro fixture has none).
      expect((await listBundleCache(own)).length).toBeGreaterThanOrEqual(1);
      expect(existsSync(bundles)).toBe(true);
    } finally {
      rmSync(own, { recursive: true, force: true });
    }
  });
});

// ── Out-of-root fixture: the case vite-node externalizes (ex-N9) ─────────

const MANIFEST = `
modules:
  jira:issuePanel:
    - key: panel
      title: Panel
      icon: https://example.com/icon.svg
      resource: fe
      render: native
      resolver:
        function: backend
  function:
    - key: backend
      handler: index.handler
resources:
  - key: fe
    path: src/fe.tsx
app:
  id: ari:cloud:ecosystem::app/render-bundle-tmpdir
  runtime:
    name: nodejs22.x
permissions:
  scopes: []
`;

const FRONTEND = `
import ForgeReconciler, { Text } from '@forge/react';
import { invoke } from '@forge/bridge';
import React, { useEffect, useState } from 'react';
const App = () => {
  const [v, setV] = useState('loading');
  useEffect(() => { invoke('value').then(setV); }, []);
  return <Text>value: {v}</Text>;
};
ForgeReconciler.render(<App />);
`;

const BACKEND = `
import Resolver from '@forge/resolver';
const resolver = new Resolver();
let n = 0;
resolver.define('value', () => 'render-' + (++n));
export const handler = resolver.getDefinitions();
`;

describe('@forge/react runs for real — fixture OUTSIDE the project root', () => {
  let dir: string;
  let sim: ForgeSimulator;

  beforeAll(async () => {
    dir = join(tmpdir(), `forge-sim-render-bundle-${Date.now()}`);
    mkdirSync(join(dir, 'src'), { recursive: true });
    // Repo node_modules so react and the JSX runtime resolve as in a real checkout.
    symlinkSync(join(import.meta.dirname, '..', '..', 'node_modules'), join(dir, 'node_modules'), 'dir');
    writeFileSync(join(dir, 'manifest.yml'), MANIFEST);
    writeFileSync(join(dir, 'src', 'fe.tsx'), FRONTEND);
    writeFileSync(join(dir, 'src', 'index.js'), BACKEND);
    sim = createSimulator();
    await sim.deploy(dir, { fireScheduledTriggers: false });
  });

  afterAll(async () => {
    await sim.stop();
    rmSync(dir, { recursive: true, force: true });
  });

  afterEach(() => { sim.ui.resetAll(); });

  it('first render lands', async () => {
    await sim.ui.render('panel');
    await sim.ui.waitForContent('panel', 'value: render-1');
  });

  it('second render of the same module, after a reset, lands with FRESH effects', async () => {
    // "render-2" proves the effect ran again, not that a stale doc was read.
    // Under the old direct import this hung: the externalized bundle was a
    // cache hit and no frame ever arrived.
    await sim.ui.render('panel');
    await sim.ui.waitForContent('panel', 'value: render-2');
  });

  it('and a third', async () => {
    await sim.ui.render('panel');
    await sim.ui.waitForContent('panel', 'value: render-3');
  });
});
