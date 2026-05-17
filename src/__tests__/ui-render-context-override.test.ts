/**
 * sim.ui.render({ context }) — per-render context override.
 *
 * Run #11 Finding #2: multi-user Forge apps (admin gating, role-based UI)
 * couldn't be validated through the UI surface because `sim.ui.render({
 * context: { accountId: 'admin' } })`:
 *   1. spread accountId into `extension.accountId` instead of promoting to
 *      the top-level ForgeContext field;
 *   2. clobbered any sticky `sim.resolver.setContext()` the user had set
 *      before render.
 *
 * The parallel mental model for `sim.invoke('fn', payload, { context })`
 * already existed (one-shot non-mutating, with canonical top-level fields
 * at the top level). This file pins the same shape for `sim.ui.render`:
 *
 *   Merge order (lowest → highest):
 *     defaults < sticky `setContext()` < `options.context` < per-render overlay applied to invokes
 *
 *   sticky state after render: unchanged.
 *   renderOverlay is cleared on `sim.ui.reset()` / `sim.ui.resetAll()`.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fileURLToPath } from 'node:url';
import { createSimulator, type ForgeSimulator } from '../simulator.js';
import { buildForgeContext } from '../context.js';

const SIMPLE_PANEL_FIXTURE = fileURLToPath(new URL('./fixtures/simple-panel', import.meta.url));

describe('sim.ui.render({ context }) — canonical top-level promotion', () => {
  let sim: ForgeSimulator;

  beforeEach(async () => {
    sim = createSimulator();
    await sim.deploy(SIMPLE_PANEL_FIXTURE);
  });

  afterEach(async () => {
    await sim.stop();
  });

  it('promotes accountId to the top-level ForgeContext field, not extension', async () => {
    await sim.ui.render('simple-panel', { context: { accountId: 'admin-001' } });
    const ctx = sim.ui.getContext('simple-panel')!;

    expect(ctx.accountId).toBe('admin-001');
    expect((ctx.extension as Record<string, unknown>).accountId).toBeUndefined();
  });

  it('promotes the full canonical field set to top-level', async () => {
    await sim.ui.render('simple-panel', {
      context: {
        accountId: 'admin-001',
        cloudId: 'my-cloud',
        siteUrl: 'https://acme.atlassian.net',
        locale: 'fr-FR',
        timezone: 'Europe/Paris',
        environmentId: 'env-prod-1',
        environmentType: 'PRODUCTION',
        localId: 'panel-abc',
        license: { active: true, type: 'PAID', isEvaluation: false },
        theme: { colorMode: 'dark' },
        surfaceColor: '#ffffff',
        userAccess: { enabled: true, hasAccess: true },
        permissions: { scopes: ['read:jira-work'] },
      },
    });

    const ctx = sim.ui.getContext('simple-panel')!;
    expect(ctx.accountId).toBe('admin-001');
    expect(ctx.cloudId).toBe('my-cloud');
    expect(ctx.siteUrl).toBe('https://acme.atlassian.net');
    expect(ctx.locale).toBe('fr-FR');
    expect(ctx.timezone).toBe('Europe/Paris');
    expect(ctx.environmentId).toBe('env-prod-1');
    expect(ctx.environmentType).toBe('PRODUCTION');
    expect(ctx.localId).toBe('panel-abc');
    expect(ctx.license).toEqual({ active: true, type: 'PAID', isEvaluation: false });
    expect(ctx.theme).toEqual({ colorMode: 'dark' });
    expect(ctx.surfaceColor).toBe('#ffffff');
    expect(ctx.userAccess).toEqual({ enabled: true, hasAccess: true });
    expect(ctx.permissions).toEqual({ scopes: ['read:jira-work'] });

    // ...and none of those leaked into extension.
    for (const field of [
      'accountId', 'cloudId', 'siteUrl', 'locale', 'timezone',
      'environmentId', 'environmentType', 'localId',
      'license', 'theme', 'surfaceColor', 'userAccess', 'permissions',
    ]) {
      expect((ctx.extension as Record<string, unknown>)[field]).toBeUndefined();
    }
  });

  it('keeps non-canonical fields in extension (issueKey, custom data)', async () => {
    await sim.ui.render('simple-panel', {
      context: {
        accountId: 'admin-001',          // canonical → top
        issueKey: 'PROJ-99',             // non-canonical, Jira issue module → smart-hydrated
        customFieldValue: 'sample',      // non-canonical → extension
      },
    });

    const ctx = sim.ui.getContext('simple-panel')!;
    expect(ctx.accountId).toBe('admin-001');
    expect(ctx.extension.issueKey).toBe('PROJ-99');
    expect(ctx.extension.customFieldValue).toBe('sample');
    // issueKey smart-hydration still fires on jira:issuePanel
    expect(ctx.extension.projectKey).toBe('PROJ');
  });
});

describe('sim.ui.render({ context }) — resolver invokes during render', () => {
  let sim: ForgeSimulator;

  beforeEach(async () => {
    sim = createSimulator();
    await sim.deploy(SIMPLE_PANEL_FIXTURE);

    sim.resolver.define('whoami', async (req: any) => ({
      accountId: req.context.accountId,
      cloudId: req.context.cloudId,
      moduleKey: req.context.moduleKey,
    }));
  });

  afterEach(async () => {
    await sim.stop();
  });

  it('resolver invoked after render sees the rendered accountId', async () => {
    await sim.ui.render('simple-panel', { context: { accountId: 'admin-001' } });
    const result = await sim.invoke('whoami');
    expect(result.accountId).toBe('admin-001');
    expect(result.moduleKey).toBe('simple-panel');
  });

  it('two adjacent renders with different accountIds — each invoke sees the matching one (run-11 use case)', async () => {
    await sim.ui.render('simple-panel', { context: { accountId: 'admin' } });
    const asAdmin = await sim.invoke('whoami');

    await sim.ui.render('simple-panel', { context: { accountId: 'user' } });
    const asUser = await sim.invoke('whoami');

    expect(asAdmin.accountId).toBe('admin');
    expect(asUser.accountId).toBe('user');
  });

  it('per-call invoke context still wins over the render overlay', async () => {
    await sim.ui.render('simple-panel', { context: { accountId: 'render-user' } });
    const result = await sim.invoke('whoami', {}, { context: { accountId: 'one-shot-user' } });
    expect(result.accountId).toBe('one-shot-user');

    // Render overlay unchanged — next invoke without per-call override sees 'render-user' again
    const next = await sim.invoke('whoami');
    expect(next.accountId).toBe('render-user');
  });
});

describe('sim.ui.render({ context }) — sticky context preservation', () => {
  let sim: ForgeSimulator;

  beforeEach(async () => {
    sim = createSimulator();
    await sim.deploy(SIMPLE_PANEL_FIXTURE);

    sim.resolver.define('whoami', async (req: any) => ({
      accountId: req.context.accountId,
      cloudId: req.context.cloudId,
      tenantTag: (req.context as Record<string, unknown>).tenantTag,
    }));
  });

  afterEach(async () => {
    await sim.stop();
  });

  it('render does NOT mutate sticky setContext', async () => {
    sim.resolver.setContext({ accountId: 'sticky-alice', cloudId: 'sticky-cloud' });

    await sim.ui.render('simple-panel', { context: { accountId: 'one-shot-bob' } });

    // Sticky state preserved verbatim
    expect(sim.resolver.getContextOverrides()).toEqual({
      accountId: 'sticky-alice',
      cloudId: 'sticky-cloud',
    });
  });

  it('sticky accountId surfaces to ForgeContext when render is called with no options.context (parity with sim.invoke)', async () => {
    sim.resolver.setContext({ accountId: 'sticky-alice', cloudId: 'sticky-cloud' });

    await sim.ui.render('simple-panel');
    const ctx = sim.ui.getContext('simple-panel')!;

    // useProductContext() should see what cold invokes see, no need to repeat
    expect(ctx.accountId).toBe('sticky-alice');
    expect(ctx.cloudId).toBe('sticky-cloud');

    // And invokes during the render see them too
    const result = await sim.invoke('whoami');
    expect(result.accountId).toBe('sticky-alice');
    expect(result.cloudId).toBe('sticky-cloud');
  });

  it('options.context wins over sticky for canonical fields it names', async () => {
    sim.resolver.setContext({ accountId: 'sticky-alice', cloudId: 'sticky-cloud' });

    await sim.ui.render('simple-panel', { context: { accountId: 'one-shot-bob' } });
    const ctx = sim.ui.getContext('simple-panel')!;

    // accountId is overridden by options.context; cloudId falls through to sticky
    expect(ctx.accountId).toBe('one-shot-bob');
    expect(ctx.cloudId).toBe('sticky-cloud');

    // Same view in resolver invokes
    const result = await sim.invoke('whoami');
    expect(result.accountId).toBe('one-shot-bob');
    expect(result.cloudId).toBe('sticky-cloud');
  });

  it('sticky non-canonical fields (custom keys) survive a render that does not touch them', async () => {
    // The user set a custom sticky field that has no ForgeContext slot
    sim.resolver.setContext({ accountId: 'sticky-alice', tenantTag: 'pro' } as any);

    await sim.ui.render('simple-panel');

    // Sticky still preserved as-is
    expect(sim.resolver.getContextOverrides()).toEqual({
      accountId: 'sticky-alice',
      tenantTag: 'pro',
    });

    // Resolver invokes see sticky tenantTag (no render overlay collision on it)
    const result = await sim.invoke('whoami');
    expect(result.accountId).toBe('sticky-alice');
    expect(result.tenantTag).toBe('pro');
  });
});

describe('sim.ui.render({ context }) — render overlay lifecycle', () => {
  let sim: ForgeSimulator;

  beforeEach(async () => {
    sim = createSimulator();
    await sim.deploy(SIMPLE_PANEL_FIXTURE);

    sim.resolver.define('whoami', async (req: any) => ({
      accountId: req.context.accountId,
      issueKey: req.context.issueKey,
    }));
  });

  afterEach(async () => {
    await sim.stop();
  });

  it('next render() replaces the overlay (not merges)', async () => {
    await sim.ui.render('simple-panel', {
      context: { accountId: 'first', issueKey: 'PROJ-1' },
    });
    await sim.ui.render('simple-panel', {
      context: { accountId: 'second' },
    });

    const result = await sim.invoke('whoami');
    expect(result.accountId).toBe('second');
    // issueKey from first render is gone — overlay was replaced
    expect(result.issueKey).toBeUndefined();
  });

  it('sim.ui.reset() clears the overlay — invokes drop back to defaults+sticky', async () => {
    sim.resolver.setContext({ accountId: 'sticky-alice' });
    await sim.ui.render('simple-panel', { context: { accountId: 'render-bob' } });

    // During/after render: overlay wins
    expect((await sim.invoke('whoami')).accountId).toBe('render-bob');

    // After UI reset: overlay cleared, sticky surfaces
    sim.ui.reset();
    expect((await sim.invoke('whoami')).accountId).toBe('sticky-alice');
  });

  it('overlay is empty by default (no render() called yet)', () => {
    expect(sim.resolver.getRenderContext()).toEqual({});
  });
});

describe('buildForgeContext directly — unit-level coverage', () => {
  it('top-level fields promote, non-canonical stays in extension', async () => {
    const sim = createSimulator();
    try {
      const ctx = await buildForgeContext(sim, 'my-panel', 'jira:globalPage', {
        context: {
          accountId: 'alice',
          cloudId: 'cloud-x',
          customExtFlag: true,
        },
      });
      expect(ctx.accountId).toBe('alice');
      expect(ctx.cloudId).toBe('cloud-x');
      expect(ctx.extension.customExtFlag).toBe(true);
      expect((ctx.extension as Record<string, unknown>).accountId).toBeUndefined();
    } finally {
      await sim.stop();
    }
  });

  it('moduleKey from options.context is ignored — argument wins', async () => {
    const sim = createSimulator();
    try {
      const ctx = await buildForgeContext(sim, 'arg-key', 'jira:globalPage', {
        context: { moduleKey: 'context-key' },
      });
      // moduleKey is excluded from the canonical promotion set; it lands in
      // extension instead. Top-level is always the render argument.
      expect(ctx.moduleKey).toBe('arg-key');
      expect(ctx.extension.moduleKey).toBe('context-key');
    } finally {
      await sim.stop();
    }
  });

  it('layers sticky onto base before options.context override', async () => {
    const sim = createSimulator();
    try {
      sim.resolver.setContext({ accountId: 'sticky', siteUrl: 'https://sticky.example.com' });
      const ctx = await buildForgeContext(sim, 'panel', 'jira:globalPage', {
        context: { accountId: 'options-win' },
      });
      // options.context.accountId wins
      expect(ctx.accountId).toBe('options-win');
      // sticky siteUrl falls through (no options.context.siteUrl)
      expect(ctx.siteUrl).toBe('https://sticky.example.com');
    } finally {
      await sim.stop();
    }
  });
});
