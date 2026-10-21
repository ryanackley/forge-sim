/**
 * The REAL @forge/react, with no shim in front of it (Phase 4e).
 *
 * What stands in for the shim is a patch on the real ForgeReconciler object
 * (installReconcilerCapture in src/ui/bridge.ts) that captures the element a
 * bundle passes to render()/addConfig(), so a 2nd+ sim.ui.render() of the
 * same module can be replayed when the test runner hands back a cached
 * bundle (N9). This file is the end-to-end regression for exactly the case
 * that triggers it, measured rather than assumed:
 *
 *   vite-node TRANSFORMS files inside the project root and honours the
 *   `?t=` cache-bust on them, so an in-repo fixture re-evaluates on its own.
 *   It EXTERNALIZES files outside the root — an app deployed to os.tmpdir(),
 *   the common pattern for scratch apps — and strips the query on the way to
 *   Node's loader, so the second import is a cache hit: no re-evaluation, no
 *   reconcile frame, a hang or a stale doc. The second suite below builds its
 *   fixture in tmpdir for that reason; the first proves the in-root case
 *   needs nothing.
 */
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ForgeSimulator, createSimulator } from '../simulator.js';
import { onRender, clearCapturedElements } from '../ui/bridge.js';

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

// ── In-root fixture: the runner re-evaluates the bundle by itself ─────────

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

  it('vi.resetModules() between renders is a safe escape hatch', async () => {
    sim = new ForgeSimulator();
    await sim.deploy(APP_DIR);
    sim.ui.setMacroConfig(KEY, { name: 'Whiskers', tier: 'gold' });
    expect(await renderAndCount(sim, KEY)).toBeGreaterThan(0);
    vi.resetModules();
    expect(await renderAndCount(sim, KEY)).toBeGreaterThan(0);
  });
});

// ── Out-of-root fixture: the N9 case, needs the capture + replay ──────────

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
  id: ari:cloud:ecosystem::app/n9-tmpdir
  runtime:
    name: nodejs22.x
permissions:
  scopes: []
`;

const FRONTEND = `
import ForgeReconciler, { Text } from '@forge/react';
import { invoke } from '@forge/bridge';
import { useEffect, useState } from 'react';
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

describe('@forge/react runs for real — fixture OUTSIDE the project root (the N9 case)', () => {
  let dir: string;
  let sim: ForgeSimulator;

  beforeAll(async () => {
    dir = join(tmpdir(), `forge-sim-n9-tmpdir-${Date.now()}`);
    mkdirSync(join(dir, 'src'), { recursive: true });
    // Same shape realtime-doc-parity-round2 uses: repo node_modules so react
    // and the JSX runtime resolve as they would in a real checkout.
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

  it('first render lands (and is captured for later replay)', async () => {
    await sim.ui.render('panel');
    await sim.ui.waitForContent('panel', 'value: render-1');
  });

  it('second render of the same module, after a reset, lands with FRESH effects — this is N9', async () => {
    // Without the capture + replay this hangs: the externalized bundle is a
    // cache hit, its top-level render() never re-runs, no frame arrives.
    // "render-2" proves the effect ran again, not that a stale doc was read.
    await sim.ui.render('panel');
    await sim.ui.waitForContent('panel', 'value: render-2');
  });

  it('negative control: with the capture cleared, the same second render does NOT land (so the pin above is load-bearing)', async () => {
    clearCapturedElements();
    await sim.ui.render('panel');
    await expect(sim.ui.waitForContent('panel', 'value: render-3', 800)).rejects.toThrow(/Timed out/);
  });
});
