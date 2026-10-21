/**
 * N10 — waitForContent's "Did you forget setMacroConfig?" hint.
 *
 * History: the hint once fired on EVERY macro timeout, and an agent spent
 * minutes chasing it on a macro that never used inline config. The fix gated
 * it on a useConfig() wrapper in the @forge/react shim. That shim is gone
 * (the app runs the real @forge/react, which exposes no hook for "this
 * bundle called useConfig"), so the gate is gone too. What replaces it is
 * HONEST WORDING: the hint fires for any un-seeded macro, and says in the
 * same breath that it only matters if the macro calls useConfig(). That is
 * the red-herring guard now, and B pins it.
 *
 * Cases covered:
 *   A) Macro that uses useConfig but config wasn't seeded → hint fires
 *   B) Macro that does NOT use useConfig → hint fires but is hedged
 *   C) Macro that uses useConfig AND was seeded → hint does NOT fire
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { ForgeSimulator } from '../simulator.js';

const NO_CONFIG_FIXTURE = join(import.meta.dirname, 'fixtures/macro-no-config');
const INLINE_CONFIG_FIXTURE = join(import.meta.dirname, 'fixtures/macro-inline-config');

describe('N10 — useConfig hint gating', () => {
  let sim: ForgeSimulator;

  afterEach(async () => {
    if (sim) {
      sim.ui.resetAll();
      await sim.stop();
      sim = undefined as unknown as ForgeSimulator;
    }
  });

  it('A: macro using useConfig() with no seeded config → hint suggests setMacroConfig', async () => {
    sim = new ForgeSimulator();
    await sim.deploy(INLINE_CONFIG_FIXTURE);

    // Don't seed config. The bundle's App calls useConfig(), so once we
    // wait for text that doesn't exist, the hint should mention setMacroConfig.
    await sim.ui.render('pet-card');
    let caught: Error | null = null;
    try {
      await sim.ui.waitForContent('pet-card', 'NEVER GOING TO MATCH', 200);
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).not.toBeNull();
    expect(caught!.message).toMatch(/calls useConfig\(\)/);
    expect(caught!.message).toMatch(/setMacroConfig\("pet-card"/);
  });

  it('B: macro NOT using useConfig() → the setMacroConfig hint is hedged, not asserted', async () => {
    sim = new ForgeSimulator();
    await sim.deploy(NO_CONFIG_FIXTURE);

    await sim.ui.render('simple-macro');
    let caught: Error | null = null;
    try {
      // The fixture renders "Hello from a simple macro" successfully — we
      // wait for text it doesn't include, so we get a timeout.
      await sim.ui.waitForContent('simple-macro', 'NEVER GOING TO MATCH', 200);
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).not.toBeNull();
    // The hint may appear, but must carry the hedge that keeps it from
    // reading as a diagnosis for a macro that never uses config.
    expect(caught!.message).toMatch(/Only relevant if the macro calls useConfig\(\)/);
    // And the generic "inspect the tree" hint is still there, since the doc rendered.
    expect(caught!.message).toMatch(/sim\.ui\.getForgeDoc/);
  });

  it('C: macro using useConfig() WITH seeded config → no setMacroConfig hint', async () => {
    sim = new ForgeSimulator();
    await sim.deploy(INLINE_CONFIG_FIXTURE);

    sim.ui.setMacroConfig('pet-card', { name: 'Whiskers', tier: 'gold' });
    await sim.ui.render('pet-card');
    let caught: Error | null = null;
    try {
      await sim.ui.waitForContent('pet-card', 'NEVER GOING TO MATCH', 200);
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).not.toBeNull();
    // Config was set, so even though useConfig() is called, no nag hint.
    expect(caught!.message).not.toMatch(/Did you forget sim\.ui\.setMacroConfig/);
  });
});
