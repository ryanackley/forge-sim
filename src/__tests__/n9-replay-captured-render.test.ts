/**
 * N9 regression — ForgeReconciler element capture & replay.
 *
 * Background: vitest's vite-node loader caches user bundles by file path and
 * ignores query strings, so simulator-ui's `?t=${Date.now()}` cache-bust is
 * a no-op there. On the 2nd+ render of the same module the bundle's
 * top-level `ForgeReconciler.render(<App/>)` call doesn't re-run, no
 * reconcile pulse fires, and moduleDocs[key] stays null forever.
 *
 * Fix: the @forge/react shim wraps ForgeReconciler.render/addConfig and
 * captures the React element under the active module key. simulator-ui
 * calls replayCapturedRender() when it sees "no doc after import" — re-
 * invoking the captured element against a fresh container produces a new
 * reconcile pulse equivalent to a real bundle re-evaluation.
 *
 * These tests pin down the primitives. The e2e regression (real vitest
 * bundle cache across `it` blocks) lives in the test apps (inside-jokes).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { ForgeSimulator } from '../simulator.js';
import {
  setActiveCaptureModule,
  captureRenderElement,
  captureAddConfigElement,
  hasCapturedRenderElement,
  replayCapturedRender,
  clearCapturedElements,
  onRender,
  onMacroConfigRender,
  installBridge,
} from '../ui/bridge.js';

const APP_DIR = join(import.meta.dirname, 'fixtures/macro-inline-config');
const MODULE_KEY = 'pet-card';

describe('N9 — ForgeReconciler element capture & replay', () => {
  let sim: ForgeSimulator;

  beforeEach(async () => {
    sim = new ForgeSimulator();
    await sim.deploy(APP_DIR);
  });

  afterEach(async () => {
    sim.ui.resetAll();
    clearCapturedElements();
    await sim.stop();
  });

  it('captures the render element when ForgeReconciler.render is called via shim', async () => {
    expect(hasCapturedRenderElement(MODULE_KEY)).toBe(false);

    sim.ui.setMacroConfig(MODULE_KEY, { name: 'Whiskers', tier: 'gold' });
    await sim.ui.render(MODULE_KEY);

    // The bundle's top-level ForgeReconciler.render(<App />) went through the
    // shim wrapper, which captured the element.
    expect(hasCapturedRenderElement(MODULE_KEY)).toBe(true);
  });

  it('replay produces a brand-new reconcile pulse on demand', async () => {
    sim.ui.setMacroConfig(MODULE_KEY, { name: 'Whiskers', tier: 'gold' });
    await sim.ui.render(MODULE_KEY);

    let reconcilesAfterReplay = 0;
    const unbind = onRender(() => { reconcilesAfterReplay++; });

    try {
      // Simulate the vitest "bundle is cached" case: the dynamic import
      // doesn't re-run the bundle, so ForgeReconciler.render() doesn't fire.
      // Replay the captured element directly — should produce a new pulse.
      const replayed = await replayCapturedRender(MODULE_KEY);
      expect(replayed).toBe(true);

      // Give the reconciler a microtask to commit
      await new Promise<void>(resolve => setTimeout(resolve, 50));
      expect(reconcilesAfterReplay).toBeGreaterThanOrEqual(1);
    } finally {
      unbind();
    }
  });

  it('replay also re-emits the MacroConfig tree when addConfig was captured', async () => {
    sim.ui.setMacroConfig(MODULE_KEY, { name: 'Whiskers', tier: 'gold' });
    await sim.ui.render(MODULE_KEY);

    let macroConfigPulses = 0;
    const unbind = onMacroConfigRender(() => { macroConfigPulses++; });

    try {
      const replayed = await replayCapturedRender(MODULE_KEY);
      expect(replayed).toBe(true);
      await new Promise<void>(resolve => setTimeout(resolve, 50));
      // pet-card calls ForgeReconciler.addConfig(<Config />) at top level,
      // so the replay should produce a MacroConfig tree too.
      expect(macroConfigPulses).toBeGreaterThanOrEqual(1);
    } finally {
      unbind();
    }
  });

  it('replay returns false when no element was captured for the module', async () => {
    const replayed = await replayCapturedRender('never-rendered-key');
    expect(replayed).toBe(false);
  });

  it('captures are attributed to the active module key, not the global state', async () => {
    // Install bridge so the shim has a valid globalThis.__bridge to call.
    installBridge();

    // Manually exercise the capture API without going through render().
    // This proves the per-module attribution works.
    setActiveCaptureModule('module-A');
    captureRenderElement('elementA');
    captureAddConfigElement('configA');

    setActiveCaptureModule('module-B');
    captureRenderElement('elementB');

    setActiveCaptureModule(null);
    captureRenderElement('should-be-ignored');

    expect(hasCapturedRenderElement('module-A')).toBe(true);
    expect(hasCapturedRenderElement('module-B')).toBe(true);
    expect(hasCapturedRenderElement('module-null')).toBe(false);
  });

  it('captured elements survive sim.reset() — needed for cross-test replay', async () => {
    sim.ui.setMacroConfig(MODULE_KEY, { name: 'Whiskers', tier: 'gold' });
    await sim.ui.render(MODULE_KEY);
    expect(hasCapturedRenderElement(MODULE_KEY)).toBe(true);

    await sim.reset();

    // Capture survives reset — this is what unblocks the next render() under
    // vitest's bundle-cache regime.
    expect(hasCapturedRenderElement(MODULE_KEY)).toBe(true);
  });
});

// ── End-to-end: B2 angle C with same simulator + sim.reset() in beforeEach
// (Node-native loader does cache-bust correctly, so this passes without the
// replay path. Kept as a smoke test for the same-sim+reset+deploy pattern.)
describe('N9 — cross-it-block reset+deploy on same simulator (smoke)', () => {
  let sim: ForgeSimulator;

  beforeEach(async () => {
    if (!sim) sim = new ForgeSimulator();
    await sim.reset();
    await sim.deploy(APP_DIR);
  });

  afterEach(async () => {
    if (sim) {
      sim.ui.resetAll();
      await sim.stop();
      sim = undefined as unknown as ForgeSimulator;
    }
  });

  it('A: first render produces a doc', async () => {
    sim.ui.setMacroConfig(MODULE_KEY, { name: 'A', tier: 'gold' });
    const doc = await sim.ui.render(MODULE_KEY);
    expect(doc).not.toBeNull();
    expect(sim.ui.getTextContent(doc!)).toContain('A');
  });

  it('B: second render produces a doc', async () => {
    sim.ui.setMacroConfig(MODULE_KEY, { name: 'B', tier: 'platinum' });
    const doc = await sim.ui.render(MODULE_KEY);
    expect(doc).not.toBeNull();
    expect(sim.ui.getTextContent(doc!)).toContain('B');
    expect(sim.ui.getTextContent(doc!)).not.toContain('A');
  });
});
