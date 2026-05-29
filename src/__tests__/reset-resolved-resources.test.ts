/**
 * Tests for N1: `sim.reset()` (and `sim.ui.reset()`) must clear the
 * moduleKey → resourcePath cache (`resolvedResources`).
 *
 * Repro from the field audit: deploy with `path: src/foo.jsx`. Render fails
 * (we don't transpile .jsx — separate bug, N2). Edit manifest to .tsx,
 * reset, redeploy. Render STILL fails because the cache still serves the
 * stale .jsx path.
 *
 * The cache is a perf optimization inside SimulatorUI. `resetAll()` already
 * cleared it; `reset()` did not. Documented contract says reset clears UI
 * state — the cache is part of UI state. Fixed by adding one line.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { ForgeSimulator } from '../simulator.js';

const SIMPLE_PANEL = join(import.meta.dirname, 'fixtures/simple-panel');
const DUAL_PANEL = join(import.meta.dirname, 'fixtures/dual-panel');

// Probe the private cache via a typed any-cast. This is the data structure
// the test is asserting on — using the public surface alone wouldn't prove
// the cache itself is cleared (it would only prove that the next render
// re-resolves, which can happen for other reasons).
function cacheSize(sim: ForgeSimulator): number {
  return (sim.ui as any).resolvedResources.size;
}

describe('N1: sim.ui.reset() clears resolvedResources cache', () => {
  let sim: ForgeSimulator | null = null;

  afterEach(async () => {
    if (sim) {
      sim.ui.resetAll();
      await sim.stop();
      sim = null;
    }
  });

  it('resolvedResources is populated after a successful render', async () => {
    sim = new ForgeSimulator();
    await sim.deploy(SIMPLE_PANEL);
    expect(cacheSize(sim)).toBe(0);

    await sim.ui.render('simple-panel');
    expect(cacheSize(sim)).toBeGreaterThan(0);
  });

  it('sim.ui.reset() clears the resolvedResources cache', async () => {
    sim = new ForgeSimulator();
    await sim.deploy(SIMPLE_PANEL);
    await sim.ui.render('simple-panel');
    expect(cacheSize(sim)).toBeGreaterThan(0);

    sim.ui.reset();
    expect(cacheSize(sim)).toBe(0);
  });

  it('sim.reset() (simulator-level) also clears the resolvedResources cache', async () => {
    // sim.reset() calls this.ui.reset() under the hood, so the fix needs
    // to apply through that path too — not just direct sim.ui.reset() calls.
    sim = new ForgeSimulator();
    await sim.deploy(SIMPLE_PANEL);
    await sim.ui.render('simple-panel');
    expect(cacheSize(sim)).toBeGreaterThan(0);

    await sim.reset();
    expect(cacheSize(sim)).toBe(0);
  });
});

describe('N1: reset → redeploy → render uses the new app dir, not stale paths', () => {
  let sim: ForgeSimulator | null = null;

  afterEach(async () => {
    if (sim) {
      sim.ui.resetAll();
      await sim.stop();
      sim = null;
    }
  });

  it('functional repro: switching app dirs picks up the new resource paths', async () => {
    sim = new ForgeSimulator();

    // Phase 1 — deploy simple-panel, render, observe its cached path
    await sim.deploy(SIMPLE_PANEL);
    await sim.ui.render('simple-panel');
    const cachedAfterFirst = new Map((sim.ui as any).resolvedResources);
    expect(cachedAfterFirst.size).toBeGreaterThan(0);
    const firstPath = [...cachedAfterFirst.values()][0] as string;
    expect(firstPath).toContain('simple-panel');

    // Phase 2 — reset + redeploy a DIFFERENT app, render its module
    await sim.reset();
    await sim.deploy(DUAL_PANEL);
    // dual-panel has its own module keys, so render one of those
    const manifest = sim.getManifest();
    const dualModuleKey = manifest!.uiModules[0].key;
    await sim.ui.render(dualModuleKey);

    // The cache should now reflect DUAL_PANEL's path, not stale SIMPLE_PANEL data
    const cachedAfterSecond = (sim.ui as any).resolvedResources as Map<string, string>;
    expect(cachedAfterSecond.size).toBeGreaterThan(0);
    expect(cachedAfterSecond.has('simple-panel')).toBe(false);
    expect(cachedAfterSecond.has(dualModuleKey)).toBe(true);
    expect(cachedAfterSecond.get(dualModuleKey)!).toContain('dual-panel');
    expect(cachedAfterSecond.get(dualModuleKey)!).not.toContain('simple-panel');
  });
});
