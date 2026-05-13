/**
 * N10 regression — waitForContent's "Did you forget setMacroConfig?" hint
 * should only fire for macros that actually call useConfig().
 *
 * Before the fix, the hint fired on EVERY macro timeout, including macros
 * that never touched inline config. The run-4 agent hit this and spent
 * ~5 minutes following the false lead.
 *
 * Cases covered:
 *   A) Macro that uses useConfig but config wasn't seeded → hint fires (good)
 *   B) Macro that does NOT use useConfig → hint does NOT fire (the N10 fix)
 *   C) Macro that uses useConfig AND was seeded → hint does NOT fire (already worked)
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

  it('B: macro NOT using useConfig() → hint does NOT mention setMacroConfig (N10 fix)', async () => {
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
    // The misleading hint should NOT appear.
    expect(caught!.message).not.toMatch(/setMacroConfig/);
    expect(caught!.message).not.toMatch(/useConfig\(\) returns \{\}/);
    // Should still give the generic "inspect the tree" hint since the doc rendered.
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
