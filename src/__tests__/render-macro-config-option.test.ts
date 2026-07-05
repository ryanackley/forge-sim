/**
 * sim.ui.render(moduleKey, { macroConfig }) — one-shot config injection.
 *
 * F3 from skill run #8: the in-process render accepted `macroConfig` in
 * its options shape but silently ignored it, while the MCP forge.ui_render
 * tool described it as "values useConfig() resolves to on this render."
 * Now both paths honor it one-shot per render. Sticky values still use
 * `sim.ui.setMacroConfig`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { createSimulator, type ForgeSimulator } from '../simulator.js';

const FIXTURE = join(import.meta.dirname, 'fixtures/macro-inline-config');

describe('sim.ui.render — macroConfig option', () => {
  let sim: ForgeSimulator;

  beforeAll(async () => {
    sim = createSimulator();
    await sim.deploy(FIXTURE);
  });

  afterAll(async () => {
    await sim.stop();
  });

  it('per-render macroConfig surfaces via useConfig() in the view', async () => {
    await sim.ui.render('pet-card', {
      macroConfig: { name: 'Rex', tier: 'platinum' },
    });
    const doc = sim.ui.getForgeDoc('pet-card')!;
    expect(sim.ui.getTextContent(doc)).toBe('Pet: Rex — Tier: platinum');
  });

  it('omitted macroConfig leaves the view to use its own defaults', async () => {
    // Fresh sim state — no prior setMacroConfig.
    const sim2 = createSimulator();
    try {
      await sim2.deploy(FIXTURE);
      await sim2.ui.render('pet-card');
      const doc = sim2.ui.getForgeDoc('pet-card')!;
      expect(sim2.ui.getTextContent(doc)).toBe('Pet: (unnamed) — Tier: standard');
    } finally {
      await sim2.stop();
    }
  });

  it('per-render macroConfig wins over a previously setMacroConfig value', async () => {
    // Sticky value via setMacroConfig.
    sim.ui.setMacroConfig('pet-card', { name: 'Mittens', tier: 'gold' });
    // One-shot override on this specific render.
    await sim.ui.render('pet-card', {
      macroConfig: { name: 'Override', tier: 'standard' },
    });
    const doc = sim.ui.getForgeDoc('pet-card')!;
    expect(sim.ui.getTextContent(doc)).toBe('Pet: Override — Tier: standard');
  });

  it('per-render macroConfig does NOT pollute the sticky macroConfigs map', async () => {
    // Set a sticky baseline.
    sim.ui.setMacroConfig('pet-card', { name: 'Sticky', tier: 'gold' });
    // One-shot render with an override.
    await sim.ui.render('pet-card', {
      macroConfig: { name: 'OneShot', tier: 'platinum' },
    });
    // The OPTION value must not leak into the sticky storage — that's the
    // contract distinguishing the per-render option from `setMacroConfig`.
    expect(sim.ui.getMacroConfig('pet-card')).toEqual({ name: 'Sticky', tier: 'gold' });
  });

  it('after a one-shot render, refresh() falls back to the sticky value', async () => {
    // Sticky baseline.
    sim.ui.setMacroConfig('pet-card', { name: 'Sticky', tier: 'gold' });
    // First render uses one-shot override.
    await sim.ui.render('pet-card', {
      macroConfig: { name: 'OneShot', tier: 'platinum' },
    });
    expect(sim.ui.getTextContent(sim.ui.getForgeDoc('pet-card')!)).toBe(
      'Pet: OneShot — Tier: platinum'
    );
    // `refresh()` is the canonical "render fresh with whatever's current" —
    // no macroConfig option means it should re-read from the sticky map.
    await sim.ui.refresh('pet-card');
    expect(sim.ui.getTextContent(sim.ui.getForgeDoc('pet-card')!)).toBe(
      'Pet: Sticky — Tier: gold'
    );
  });

  it('combines naturally with other render options (e.g. spaceKey for Confluence context)', async () => {
    // macroConfig and context-hydrating options are independent.
    await sim.ui.render('pet-card', {
      spaceKey: 'DEMO',
      macroConfig: { name: 'Combo', tier: 'gold' },
    });
    const doc = sim.ui.getForgeDoc('pet-card')!;
    expect(sim.ui.getTextContent(doc)).toBe('Pet: Combo — Tier: gold');
  });

  it('empty-object macroConfig clears the sticky config for this render', async () => {
    // Edge case: passing `{}` should NOT inherit from setMacroConfig —
    // empty IS a value the caller chose. The macro's own defaults take over.
    sim.ui.setMacroConfig('pet-card', { name: 'StickyAgain', tier: 'platinum' });
    await sim.ui.render('pet-card', { macroConfig: {} });
    const doc = sim.ui.getForgeDoc('pet-card')!;
    expect(sim.ui.getTextContent(doc)).toBe('Pet: (unnamed) — Tier: standard');
  });
});
