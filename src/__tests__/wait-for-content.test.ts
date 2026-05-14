/**
 * Tests for `sim.ui.waitForContent(moduleKey, text, timeout?)`.
 *
 * The function has two modes:
 *   1. Auto-render — if the module has never been rendered, do a default
 *      render() once before observing. Removes a footgun where tests forgot
 *      to call render() and got silent 5-second timeouts.
 *   2. Pure observation — if a doc already exists, waitForContent does NOT
 *      re-render. It observes until the text appears or the timeout fires.
 *      Critical: this preserves the use case of waiting for async state
 *      changes (useEffect, in-flight invokes) without clobbering them.
 *
 * Timeout errors include a contextual hint (e.g. "did you forget
 * setMacroConfig?") to make diagnosis faster.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { ForgeSimulator } from '../simulator.js';

const MACRO_FIXTURE = join(import.meta.dirname, 'fixtures/macro-inline-config');
const MACRO_KEY = 'pet-card';

describe('waitForContent — auto-render', () => {
  let sim: ForgeSimulator;

  beforeEach(async () => {
    sim = new ForgeSimulator();
    await sim.deploy(MACRO_FIXTURE);
  });

  afterEach(() => {
    sim.ui.resetAll();
  });

  it('auto-renders the module if it has never been rendered', async () => {
    // No explicit sim.ui.render() call — waitForContent should do it.
    expect(sim.ui.getForgeDoc(MACRO_KEY)).toBeNull();

    const doc = await sim.ui.waitForContent(MACRO_KEY, '(unnamed)');

    expect(doc).not.toBeNull();
    expect(sim.ui.getTextContent(doc)).toContain('(unnamed)');
    // Now a doc is cached
    expect(sim.ui.getForgeDoc(MACRO_KEY)).not.toBeNull();
  });

  it('auto-renders picks up setMacroConfig() seeded BEFORE the call', async () => {
    sim.ui.setMacroConfig(MACRO_KEY, { name: 'Rex', tier: 'platinum' });

    // Still no explicit render — auto-render should pick up the seeded config
    const doc = await sim.ui.waitForContent(MACRO_KEY, 'Pet: Rex — Tier: platinum');

    expect(sim.ui.getTextContent(doc)).toContain('Rex');
    expect(sim.ui.getTextContent(doc)).toContain('platinum');
  });

  it('is idempotent — does NOT re-render on subsequent calls', async () => {
    // First call auto-renders
    await sim.ui.waitForContent(MACRO_KEY, '(unnamed)');

    // Spy on render() to detect any re-render
    const renderSpy = vi.spyOn(sim.ui, 'render');

    // Second call should hit the "already there" fast path and NOT re-render
    const doc = await sim.ui.waitForContent(MACRO_KEY, '(unnamed)');
    expect(doc).not.toBeNull();
    expect(renderSpy).not.toHaveBeenCalled();

    renderSpy.mockRestore();
  });

  it('does NOT re-render after an explicit render() was called', async () => {
    // Explicit render first (simulating the async-observation use case)
    await sim.ui.render(MACRO_KEY);

    const renderSpy = vi.spyOn(sim.ui, 'render');

    // waitForContent should observe, not re-render
    await sim.ui.waitForContent(MACRO_KEY, '(unnamed)');
    expect(renderSpy).not.toHaveBeenCalled();

    renderSpy.mockRestore();
  });
});

describe('waitForContent — error messages', () => {
  let sim: ForgeSimulator;

  beforeEach(async () => {
    sim = new ForgeSimulator();
    await sim.deploy(MACRO_FIXTURE);
  });

  afterEach(() => {
    sim.ui.resetAll();
  });

  it('includes the current text content when the target is missing', async () => {
    // Seed config so render produces deterministic content
    sim.ui.setMacroConfig(MACRO_KEY, { name: 'Whiskers', tier: 'gold' });

    await expect(
      sim.ui.waitForContent(MACRO_KEY, 'this text does not appear', 200)
    ).rejects.toThrow(/Current content: "Pet: Whiskers — Tier: gold"/);
  });

  it('hints about missing setMacroConfig when timing out on an un-seeded macro', async () => {
    // No setMacroConfig() call — macro renders with empty config
    await expect(
      sim.ui.waitForContent(MACRO_KEY, 'Pet: Rex', 200)
    ).rejects.toThrow(/Did you forget sim\.ui\.setMacroConfig\("pet-card", \{\.\.\.\}\)/);
  });

  it('hints about inspecting the doc when content is present but text mismatched', async () => {
    sim.ui.setMacroConfig(MACRO_KEY, { name: 'Felix', tier: 'standard' });
    await sim.ui.render(MACRO_KEY);

    await expect(
      sim.ui.waitForContent(MACRO_KEY, 'completely-unrelated-string', 200)
    ).rejects.toThrow(/Inspect the tree with sim\.ui\.getForgeDoc/);
  });

  it('reports timeout duration in the message', async () => {
    sim.ui.setMacroConfig(MACRO_KEY, { name: 'Whiskers', tier: 'gold' });

    await expect(
      sim.ui.waitForContent(MACRO_KEY, 'will-not-appear', 137)
    ).rejects.toThrow(/after 137ms/);
  });
});
