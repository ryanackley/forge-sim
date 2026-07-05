/**
 * B2 repro — Does `sim.reset()` + new `setMacroConfig()` actually re-thread
 * the new value through useConfig() on the next render?
 *
 * Scenario from the field: an agent wrote two `it` blocks in the same file,
 * each setting a different macro config + rendering. The second one came
 * back with stale state from the first.
 *
 * This test pins down whether forge-sim's reset/macroConfig path is at fault
 * vs. an artifact of the agent's chosen workaround.
 *
 * Three angles:
 *   A) Sequential set→render→set→render in ONE test (no reset)
 *      → tests the macroConfigs map + per-render context wiring.
 *   B) Set→render→reset→deploy→set→render in ONE test
 *      → tests the full reset cycle, mid-test.
 *   C) Two separate `it` blocks with a beforeEach reset+deploy, each with a
 *      different macro config.
 *      → tests cross-test ForgeReconciler isolation.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { ForgeSimulator } from '../simulator.js';

const APP_DIR = join(import.meta.dirname, 'fixtures/macro-inline-config');
const MODULE_KEY = 'pet-card';

// ── Angle A: same simulator, no reset between renders ─────────────────────

describe('B2 repro — sequential setMacroConfig within ONE test', () => {
  let sim: ForgeSimulator;

  beforeEach(async () => {
    sim = new ForgeSimulator();
    await sim.deploy(APP_DIR);
  });

  afterEach(() => {
    sim.ui.resetAll();
  });

  it('useConfig sees the latest setMacroConfig value on each render', async () => {
    // Render 1 — cat
    sim.ui.setMacroConfig(MODULE_KEY, { name: 'Whiskers', tier: 'gold' });
    let doc = await sim.ui.render(MODULE_KEY);
    doc = await sim.ui.waitForContent(MODULE_KEY, 'Pet: Whiskers — Tier: gold');
    expect(sim.ui.getTextContent(doc)).toContain('Whiskers');
    expect(sim.ui.getTextContent(doc)).toContain('gold');

    // Render 2 — dog (no reset, just change the config + re-render)
    sim.ui.setMacroConfig(MODULE_KEY, { name: 'Rex', tier: 'platinum' });
    doc = await sim.ui.render(MODULE_KEY);
    doc = await sim.ui.waitForContent(MODULE_KEY, 'Pet: Rex — Tier: platinum');
    expect(sim.ui.getTextContent(doc)).toContain('Rex');
    expect(sim.ui.getTextContent(doc)).toContain('platinum');
    // Critical: NO stale "Whiskers" leakage
    expect(sim.ui.getTextContent(doc)).not.toContain('Whiskers');
  });
});

// ── Angle B: full reset() + redeploy mid-test ─────────────────────────────

describe('B2 repro — sim.reset() between renders', () => {
  it('useConfig sees the new value after sim.reset() + sim.deploy() + setMacroConfig()', async () => {
    const sim = new ForgeSimulator();
    try {
      // Render 1 — cat
      await sim.deploy(APP_DIR);
      sim.ui.setMacroConfig(MODULE_KEY, { name: 'Whiskers', tier: 'gold' });
      let doc = await sim.ui.render(MODULE_KEY);
      doc = await sim.ui.waitForContent(MODULE_KEY, 'Pet: Whiskers — Tier: gold');
      expect(sim.ui.getTextContent(doc)).toContain('Whiskers');

      // Full reset (clears KVS, SQL, manifest, UI state)
      await sim.reset();

      // Re-deploy from scratch
      await sim.deploy(APP_DIR);
      sim.ui.setMacroConfig(MODULE_KEY, { name: 'Rex', tier: 'platinum' });
      doc = await sim.ui.render(MODULE_KEY);
      doc = await sim.ui.waitForContent(MODULE_KEY, 'Pet: Rex — Tier: platinum');
      expect(sim.ui.getTextContent(doc)).toContain('Rex');
      expect(sim.ui.getTextContent(doc)).toContain('platinum');
      expect(sim.ui.getTextContent(doc)).not.toContain('Whiskers');
    } finally {
      sim.ui.resetAll();
      await sim.stop();
    }
  });
});

// ── Angle C: cross-test isolation (the agent's actual situation) ──────────

describe('B2 repro — cross-test isolation in ONE file', () => {
  let sim: ForgeSimulator;

  beforeEach(async () => {
    sim = new ForgeSimulator();
    await sim.deploy(APP_DIR);
  });

  afterEach(() => {
    sim.ui.resetAll();
  });

  it('first test: sees Whiskers/gold', async () => {
    sim.ui.setMacroConfig(MODULE_KEY, { name: 'Whiskers', tier: 'gold' });
    await sim.ui.render(MODULE_KEY);
    const doc = await sim.ui.waitForContent(MODULE_KEY, 'Pet: Whiskers — Tier: gold');
    expect(sim.ui.getTextContent(doc)).toContain('Whiskers');
    expect(sim.ui.getTextContent(doc)).toContain('gold');
  });

  it('second test: sees Rex/platinum (no leak from first test)', async () => {
    sim.ui.setMacroConfig(MODULE_KEY, { name: 'Rex', tier: 'platinum' });
    await sim.ui.render(MODULE_KEY);
    const doc = await sim.ui.waitForContent(MODULE_KEY, 'Pet: Rex — Tier: platinum');
    expect(sim.ui.getTextContent(doc)).toContain('Rex');
    expect(sim.ui.getTextContent(doc)).toContain('platinum');
    expect(sim.ui.getTextContent(doc)).not.toContain('Whiskers');
  });

  it('third test: setMacroConfig with NEW values after two prior renders', async () => {
    sim.ui.setMacroConfig(MODULE_KEY, { name: 'Felix', tier: 'standard' });
    await sim.ui.render(MODULE_KEY);
    const doc = await sim.ui.waitForContent(MODULE_KEY, 'Pet: Felix — Tier: standard');
    expect(sim.ui.getTextContent(doc)).toContain('Felix');
    expect(sim.ui.getTextContent(doc)).toContain('standard');
    expect(sim.ui.getTextContent(doc)).not.toContain('Whiskers');
    expect(sim.ui.getTextContent(doc)).not.toContain('Rex');
  });
});
