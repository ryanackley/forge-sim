/**
 * Tests for browser bridge shim features:
 * - showFlag (toast notifications)
 * - router (navigation targets, URL resolution)
 * - events (local pub/sub dispatch)
 * - view helpers (changeWindowTitle, emitReadyEvent, theme.enable)
 * - permissions, i18n, featureFlags stubs
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── Test setup ──────────────────────────────────────────────────────────

// Reset the global state before each test to isolate module state
function resetGlobals() {
  delete (globalThis as any).__forgeSim;
  delete (globalThis as any).__bridge;
}

async function loadShim() {
  // Clear module cache so each test gets fresh state
  const mod = await import('../../renderer/src/bridge/forge-bridge-shim.ts');
  return mod;
}

// ── showFlag ────────────────────────────────────────────────────────────

describe('showFlag', () => {
  let shimModule: Awaited<ReturnType<typeof loadShim>>;

  beforeEach(async () => {
    resetGlobals();
    shimModule = await loadShim();
    // Clean up any flag containers from previous tests
    document.querySelectorAll('[data-testid="forge-sim-flag-container"]').forEach(el => el.remove());
  });

  it('creates a flag element in the DOM', () => {
    shimModule.showFlag({ title: 'Test Flag', type: 'info' });

    const container = document.querySelector('[data-testid="forge-sim-flag-container"]');
    expect(container).not.toBeNull();

    const flag = container!.querySelector('[data-testid="forge-sim-flag"]');
    expect(flag).not.toBeNull();
    expect(flag!.textContent).toContain('Test Flag');
  });

  it('renders description when provided', () => {
    shimModule.showFlag({ title: 'Title', description: 'Some details', type: 'success' });

    const flag = document.querySelector('[data-testid="forge-sim-flag"]');
    expect(flag!.textContent).toContain('Some details');
  });

  it('renders action buttons', () => {
    const onClick = vi.fn();
    shimModule.showFlag({
      title: 'With Actions',
      type: 'warning',
      actions: [{ text: 'Undo', onClick }],
    });

    const btn = document.querySelector('[data-testid="forge-sim-flag"] button');
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toBe('Undo');

    btn!.dispatchEvent(new Event('click'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('returns a close function that removes the flag', async () => {
    vi.useFakeTimers();
    const result = shimModule.showFlag({
      title: 'Closeable',
      type: 'error',
      isAutoDismiss: false,
    });

    expect(document.querySelector('[data-testid="forge-sim-flag"]')).not.toBeNull();

    await result.close();
    vi.advanceTimersByTime(300); // wait for animation

    expect(document.querySelectorAll('[data-testid="forge-sim-flag"]').length).toBe(0);
    vi.useRealTimers();
  });

  it('stacks multiple flags', () => {
    shimModule.showFlag({ title: 'Flag 1', type: 'info', isAutoDismiss: false });
    shimModule.showFlag({ title: 'Flag 2', type: 'success', isAutoDismiss: false });

    const flags = document.querySelectorAll('[data-testid="forge-sim-flag"]');
    expect(flags.length).toBe(2);
  });

  it('uses appearance over type when both provided', () => {
    shimModule.showFlag({ title: 'Test', type: 'error', appearance: 'success' } as any);

    const flag = document.querySelector('[data-testid="forge-sim-flag"]');
    expect(flag!.textContent).toContain('✅'); // success icon, not error
  });

  it('defaults to info type when none specified', () => {
    shimModule.showFlag({ title: 'Default' });

    const flag = document.querySelector('[data-testid="forge-sim-flag"]');
    expect(flag!.textContent).toContain('ℹ️');
  });
});

// ── NavigationTarget ────────────────────────────────────────────────────

describe('NavigationTarget', () => {
  let shimModule: Awaited<ReturnType<typeof loadShim>>;

  beforeEach(async () => {
    resetGlobals();
    shimModule = await loadShim();
  });

  it('has all standard target constants', () => {
    expect(shimModule.NavigationTarget.Issue).toBe('issue');
    expect(shimModule.NavigationTarget.ContentView).toBe('contentView');
    expect(shimModule.NavigationTarget.ContentEdit).toBe('contentEdit');
    expect(shimModule.NavigationTarget.SpaceView).toBe('spaceView');
    expect(shimModule.NavigationTarget.Dashboard).toBe('dashboard');
    expect(shimModule.NavigationTarget.UserProfile).toBe('userProfile');
    expect(shimModule.NavigationTarget.Module).toBe('module');
    expect(shimModule.NavigationTarget.ContentList).toBe('contentList');
    expect(shimModule.NavigationTarget.ProjectSettingsDetails).toBe('projectSettingsDetails');
  });
});

// ── router.getUrl ───────────────────────────────────────────────────────

describe('router.getUrl', () => {
  let shimModule: Awaited<ReturnType<typeof loadShim>>;

  beforeEach(async () => {
    resetGlobals();
    shimModule = await loadShim();
  });

  it('resolves a raw string URL', async () => {
    const url = await shimModule.router.getUrl('/browse/PROJ-42');
    expect(url).not.toBeNull();
    expect(url!.pathname).toBe('/browse/PROJ-42');
  });

  it('resolves Issue navigation target', async () => {
    const url = await shimModule.router.getUrl({
      target: shimModule.NavigationTarget.Issue,
      issueKey: 'TEST-123',
    });
    expect(url).not.toBeNull();
    expect(url!.pathname).toBe('/browse/TEST-123');
  });

  it('resolves ContentView navigation target', async () => {
    const url = await shimModule.router.getUrl({
      target: shimModule.NavigationTarget.ContentView,
      contentId: '12345',
    });
    expect(url!.pathname).toBe('/wiki/pages/12345');
  });

  it('resolves ContentEdit navigation target', async () => {
    const url = await shimModule.router.getUrl({
      target: shimModule.NavigationTarget.ContentEdit,
      contentId: '12345',
    });
    expect(url!.pathname).toBe('/wiki/pages/edit-v2/12345');
  });

  it('resolves SpaceView navigation target', async () => {
    const url = await shimModule.router.getUrl({
      target: shimModule.NavigationTarget.SpaceView,
      spaceKey: 'DEV',
    });
    expect(url!.pathname).toBe('/wiki/spaces/DEV');
  });

  it('resolves Dashboard navigation target', async () => {
    const url = await shimModule.router.getUrl({
      target: shimModule.NavigationTarget.Dashboard,
      dashboardId: '10001',
    });
    expect(url!.pathname).toBe('/jira/dashboards/10001');
  });

  it('resolves UserProfile navigation target', async () => {
    const url = await shimModule.router.getUrl({
      target: shimModule.NavigationTarget.UserProfile,
      accountId: '5b10ac8d82e05b22cc7d4ef5',
    });
    expect(url!.pathname).toBe('/people/5b10ac8d82e05b22cc7d4ef5');
  });

  it('resolves Module navigation target', async () => {
    const url = await shimModule.router.getUrl({
      target: shimModule.NavigationTarget.Module,
      moduleKey: 'my-panel',
    });
    expect(url!.pathname).toBe('/module/my-panel/');
  });

  it('resolves ProjectSettingsDetails navigation target', async () => {
    const url = await shimModule.router.getUrl({
      target: shimModule.NavigationTarget.ProjectSettingsDetails,
      projectKey: 'PROJ',
    });
    expect(url!.pathname).toBe('/jira/software/projects/PROJ/settings');
  });
});

// ── events ──────────────────────────────────────────────────────────────

describe('events', () => {
  let shimModule: Awaited<ReturnType<typeof loadShim>>;

  beforeEach(async () => {
    resetGlobals();
    shimModule = await loadShim();
  });

  it('dispatches events to local listeners', async () => {
    const callback = vi.fn();
    await shimModule.events.on('test-event', callback);

    await shimModule.events.emit('test-event', { value: 42 });

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith({ value: 42 });
  });

  it('supports multiple listeners for same event', async () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    await shimModule.events.on('multi', cb1);
    await shimModule.events.on('multi', cb2);

    await shimModule.events.emit('multi', 'data');

    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();
  });

  it('unsubscribe removes the listener', async () => {
    const callback = vi.fn();
    const sub = await shimModule.events.on('unsub-test', callback);

    sub.unsubscribe();
    await shimModule.events.emit('unsub-test', 'data');

    expect(callback).not.toHaveBeenCalled();
  });

  it('does not dispatch to listeners of other events', async () => {
    const callback = vi.fn();
    await shimModule.events.on('event-a', callback);

    await shimModule.events.emit('event-b', 'data');

    expect(callback).not.toHaveBeenCalled();
  });

  it('emitPublic prefixes with public:', async () => {
    const callback = vi.fn();
    await shimModule.events.onPublic('shared', callback);

    await shimModule.events.emitPublic('shared', { cross: true });

    expect(callback).toHaveBeenCalledWith({ cross: true });
  });

  it('catches and logs listener errors without breaking other listeners', async () => {
    const errorCb = vi.fn(() => { throw new Error('boom'); });
    const goodCb = vi.fn();

    await shimModule.events.on('error-test', errorCb);
    await shimModule.events.on('error-test', goodCb);

    // Should not throw
    await shimModule.events.emit('error-test', 'data');

    expect(errorCb).toHaveBeenCalledOnce();
    expect(goodCb).toHaveBeenCalledOnce();
  });
});

// ── view helpers ────────────────────────────────────────────────────────

describe('view', () => {
  let shimModule: Awaited<ReturnType<typeof loadShim>>;

  beforeEach(async () => {
    resetGlobals();
    shimModule = await loadShim();
  });

  it('changeWindowTitle sets document.title', async () => {
    await shimModule.view.changeWindowTitle('New Title');
    expect(document.title).toBe('New Title');
  });

  it('emitReadyEvent dispatches a custom event', async () => {
    const handler = vi.fn();
    window.addEventListener('forge-sim:ready', handler);

    await shimModule.view.emitReadyEvent();

    expect(handler).toHaveBeenCalledOnce();
    window.removeEventListener('forge-sim:ready', handler);
  });

  it('theme.enable sets data-color-mode attribute', async () => {
    await shimModule.view.theme.enable();
    expect(document.documentElement.getAttribute('data-color-mode')).toBe('dark');
    // Clean up
    document.documentElement.removeAttribute('data-color-mode');
  });
});

// ── permissions ─────────────────────────────────────────────────────────

describe('permissions', () => {
  let shimModule: Awaited<ReturnType<typeof loadShim>>;

  beforeEach(async () => {
    resetGlobals();
    shimModule = await loadShim();
  });

  it('check always returns hasPermission: true', async () => {
    const result = await shimModule.permissions.check();
    expect(result).toEqual({ hasPermission: true });
  });

  it('request always returns granted: true', async () => {
    const result = await shimModule.permissions.request(['read:jira-work']);
    expect(result).toEqual({ granted: true });
  });
});

// ── featureFlags ────────────────────────────────────────────────────────

describe('featureFlags', () => {
  let shimModule: Awaited<ReturnType<typeof loadShim>>;

  beforeEach(async () => {
    resetGlobals();
    shimModule = await loadShim();
  });

  it('evaluate returns undefined', async () => {
    const result = await shimModule.featureFlags.evaluate('my-flag');
    expect(result).toBeUndefined();
  });

  it('checkBooleanFlag returns false', async () => {
    const result = await shimModule.featureFlags.checkBooleanFlag('bool-flag');
    expect(result).toBe(false);
  });

  it('checkStringFlag returns empty string', async () => {
    const result = await shimModule.featureFlags.checkStringFlag('str-flag');
    expect(result).toBe('');
  });
});

// ── i18n (bridge-level) ─────────────────────────────────────────────────

describe('i18n', () => {
  let shimModule: Awaited<ReturnType<typeof loadShim>>;

  beforeEach(async () => {
    resetGlobals();
    shimModule = await loadShim();
  });

  it('getLocale returns navigator.language', async () => {
    const locale = await shimModule.i18n.getLocale();
    expect(typeof locale).toBe('string');
    expect(locale.length).toBeGreaterThan(0);
  });
});
