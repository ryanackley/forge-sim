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

describe('waitForContent — async-effect chain (the MCP ui_wait_for premise)', () => {
  // The `forge.ui_wait_for` MCP tool exists because `forge.ui_render` only
  // awaits the INITIAL reconcile. Modules that fetch data via
  // useEffect -> invoke() show `<Text>Loading...</Text>` in the initial doc;
  // the real content only appears after the resolver resolves and React
  // re-renders. These tests pin the contract that waitForContent settles
  // that chain — if this breaks, the MCP tool silently regresses.
  const MY_ISSUES_FIXTURE = join(import.meta.dirname, 'fixtures/my-issues');
  const MY_ISSUES_KEY = 'my-issues-panel';
  let sim: ForgeSimulator;

  beforeEach(async () => {
    sim = new ForgeSimulator();

    sim.mockProductRoutes('jira', {
      'GET /rest/api/3/myself': {
        accountId: 'acc-1',
        displayName: 'Test User',
        emailAddress: 'test@example.com',
        avatarUrls: { '48x48': 'https://avatar.example.com/48.png' },
        active: true,
      },
      'POST /rest/api/3/search/jql': {
        total: 1,
        issues: [
          {
            key: 'PROJ-42',
            fields: {
              summary: 'Settle the async chain',
              status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } },
              priority: { name: 'High' },
              issuetype: { name: 'Bug' },
              project: { name: 'My Project', key: 'PROJ' },
              updated: '2026-05-19T12:00:00.000Z',
            },
          },
        ],
      },
    });

    await sim.deploy(MY_ISSUES_FIXTURE);
  });

  afterEach(() => {
    sim.ui.resetAll();
  });

  it('initial render shows the loading state — confirms the gap forge.ui_wait_for closes', async () => {
    // First render — captures whatever ForgeReconciler emits on the FIRST
    // reconcile. The useEffect kicks off invoke() calls but the render
    // returns before they resolve.
    const initialDoc = await sim.ui.render(MY_ISSUES_KEY);
    expect(initialDoc).not.toBeNull();
    expect(sim.ui.getTextContent(initialDoc!)).toContain('Loading your issues');
  });

  it('settles the useEffect -> invoke -> setState -> re-render chain', async () => {
    // Render first so we observe the post-mount transition rather than the
    // auto-render path (which already has a doc cached by the time it
    // subscribes).
    await sim.ui.render(MY_ISSUES_KEY);

    // The resolver-driven content should arrive after the effect resolves.
    const settled = await sim.ui.waitForContent(MY_ISSUES_KEY, 'PROJ-42');
    const text = sim.ui.getTextContent(settled);
    expect(text).toContain('PROJ-42');
    expect(text).toContain('Test User');
    // And the loading state is GONE — proves we observed a real re-render,
    // not just a substring inside the loading tree.
    expect(text).not.toContain('Loading your issues');
  });

  it('auto-render path also settles the async chain', async () => {
    // No explicit render() — let waitForContent kick it off itself.
    const settled = await sim.ui.waitForContent(MY_ISSUES_KEY, 'PROJ-42');
    expect(sim.ui.getTextContent(settled)).toContain('PROJ-42');
  });
});
