/**
 * Browser bridge host surface behaviours, driven the way the real
 * @forge/bridge drives them: through window.__bridge.callBridge with the
 * package's own frames (file references inline). This replaces a suite that
 * called a forge-sim shim's exports; app code now imports the real package,
 * so the host is the only thing left to test on this side.
 *
 * - showFlag / closeFlag   (out/flag/flag.js)
 * - router.getUrl          (out/router/router.js — must return an ABSOLUTE url)
 * - events                 (out/events/events.js)
 * - view helpers           (out/view/*.js)
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installBrowserBridge } from './helpers/browser-bridge-harness.js';

type CallBridge = (cmd: string, data?: any) => Promise<any>;
let callBridge: CallBridge;

beforeEach(() => {
  document.querySelectorAll('[data-testid="forge-sim-flag-container"]').forEach((el) => el.remove());
  document.title = '';
  document.documentElement.removeAttribute('data-color-mode');
  callBridge = installBrowserBridge({ moduleKey: 'test-module' }).callBridge;
});

afterEach(() => {
  vi.useRealTimers();
});

const flag = () => document.querySelector('[data-testid="forge-sim-flag"]');
const flags = () => document.querySelectorAll('[data-testid="forge-sim-flag"]');

// ── showFlag ────────────────────────────────────────────────────────────

describe('showFlag', () => {
  it('creates a flag element in the DOM', async () => {
    await callBridge('showFlag', { id: 'a', title: 'Test Flag', type: 'info' });
    const container = document.querySelector('[data-testid="forge-sim-flag-container"]');
    expect(container).not.toBeNull();
    expect(container!.querySelector('[data-testid="forge-sim-flag"]')!.textContent).toContain('Test Flag');
  });

  it('renders description when provided', async () => {
    await callBridge('showFlag', { id: 'a', title: 'Title', description: 'Some details', type: 'success' });
    expect(flag()!.textContent).toContain('Some details');
  });

  it('renders action buttons and fires their live onClick', async () => {
    const onClick = vi.fn();
    await callBridge('showFlag', { id: 'a', title: 'With Actions', type: 'warning', actions: [{ text: 'Undo', onClick }] });
    const btn = document.querySelector('[data-testid="forge-sim-flag"] button')!;
    expect(btn.textContent).toBe('Undo');
    btn.dispatchEvent(new Event('click'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('closeFlag removes the flag by id and reports whether it existed', async () => {
    vi.useFakeTimers();
    await callBridge('showFlag', { id: 'close-me', title: 'Closeable', isAutoDismiss: false });
    expect(flag()).not.toBeNull();
    await expect(callBridge('closeFlag', { id: 'close-me' })).resolves.toBe(true);
    vi.advanceTimersByTime(300); // exit animation
    expect(flags().length).toBe(0);
    await expect(callBridge('closeFlag', { id: 'close-me' })).resolves.toBe(false);
  });

  it('stacks multiple flags in one container', async () => {
    await callBridge('showFlag', { id: '1', title: 'One', isAutoDismiss: false });
    await callBridge('showFlag', { id: '2', title: 'Two', isAutoDismiss: false });
    expect(flags().length).toBe(2);
    expect(document.querySelectorAll('[data-testid="forge-sim-flag-container"]').length).toBe(1);
  });

  it('uses appearance over type when both provided; unknown types fall back to info', async () => {
    // jsdom normalises colour strings, so read the scheme off the icon the
    // title is prefixed with rather than the border style.
    await callBridge('showFlag', { id: 'a', title: 'Mixed', type: 'info', appearance: 'error' });
    expect(flag()!.textContent).toContain('❌');
    await callBridge('showFlag', { id: 'b', title: 'Odd', type: 'nonsense' });
    expect(flags()[1].textContent).toContain('ℹ️');
  });

  it('defaults to info when no type is given', async () => {
    await callBridge('showFlag', { id: 'a', title: 'Default' });
    expect(flag()!.textContent).toContain('ℹ️');
  });
});

// ── router.getUrl ───────────────────────────────────────────────────────
// The real package does `new URL(await callBridge('getUrl', location))`, so
// the host must return an ABSOLUTE string.

describe('router.getUrl', () => {
  const abs = async (location: any) => {
    const s = await callBridge('getUrl', location);
    expect(typeof s).toBe('string');
    return new URL(s);
  };

  it('resolves a raw string URL', async () => {
    expect((await abs('/browse/PROJ-42')).pathname).toBe('/browse/PROJ-42');
  });

  it.each([
    [{ target: 'issue', issueKey: 'TEST-123' }, '/browse/TEST-123'],
    [{ target: 'contentView', contentId: '12345' }, '/wiki/pages/12345'],
    [{ target: 'contentEdit', contentId: '12345' }, '/wiki/pages/edit-v2/12345'],
    [{ target: 'spaceView', spaceKey: 'DEV' }, '/wiki/spaces/DEV'],
    [{ target: 'contentList', spaceKey: 'DEV' }, '/wiki/spaces/DEV/pages'],
    [{ target: 'dashboard', dashboardId: '10001' }, '/jira/dashboards/10001'],
    [{ target: 'userProfile', accountId: '5b10ac8d82e05b22cc7d4ef5' }, '/people/5b10ac8d82e05b22cc7d4ef5'],
    [{ target: 'module', moduleKey: 'my-panel' }, '/module/my-panel/'],
    [{ target: 'projectSettingsDetails', projectKey: 'PROJ' }, '/jira/software/projects/PROJ/settings'],
  ])('resolves navigation target %j', async (location, pathname) => {
    expect((await abs(location)).pathname).toBe(pathname);
  });

  it('returns null for an unknown target (the package then throws "Failed to get URL")', async () => {
    await expect(callBridge('getUrl', { target: 'nope' })).resolves.toBeNull();
  });
});

// ── events ──────────────────────────────────────────────────────────────

describe('events', () => {
  it('dispatches events to local listeners', async () => {
    const cb = vi.fn();
    await callBridge('on', { event: 'test-event', callback: cb });
    await callBridge('emit', { event: 'test-event', payload: { value: 42 } });
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith({ value: 42 });
  });

  it('supports multiple listeners for the same event', async () => {
    const cb1 = vi.fn(); const cb2 = vi.fn();
    await callBridge('on', { event: 'multi', callback: cb1 });
    await callBridge('on', { event: 'multi', callback: cb2 });
    await callBridge('emit', { event: 'multi', payload: 'data' });
    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();
  });

  it('unsubscribe removes the listener', async () => {
    const cb = vi.fn();
    const sub = await callBridge('on', { event: 'unsub-test', callback: cb });
    sub.unsubscribe();
    await callBridge('emit', { event: 'unsub-test', payload: 'data' });
    expect(cb).not.toHaveBeenCalled();
  });

  it('does not dispatch to listeners of other events', async () => {
    const cb = vi.fn();
    await callBridge('on', { event: 'event-a', callback: cb });
    await callBridge('emit', { event: 'event-b', payload: 'data' });
    expect(cb).not.toHaveBeenCalled();
  });

  it('public and private channels are separate', async () => {
    const pub = vi.fn(); const priv = vi.fn();
    await callBridge('onPublic', { event: 'x', callback: pub });
    await callBridge('on', { event: 'x', callback: priv });
    await callBridge('emitPublic', { event: 'x', payload: { cross: true } });
    expect(pub).toHaveBeenCalledWith({ cross: true });
    expect(priv).not.toHaveBeenCalled();
  });

  it('catches and logs listener errors without breaking other listeners', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad = vi.fn(() => { throw new Error('boom'); });
    const good = vi.fn();
    await callBridge('on', { event: 'error-test', callback: bad });
    await callBridge('on', { event: 'error-test', callback: good });
    await callBridge('emit', { event: 'error-test', payload: 'data' });
    expect(bad).toHaveBeenCalledOnce();
    expect(good).toHaveBeenCalledOnce();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

// ── view helpers ────────────────────────────────────────────────────────

describe('view', () => {
  it('changeWindowTitle sets document.title (the title IS the frame)', async () => {
    await callBridge('changeWindowTitle', 'New Title');
    expect(document.title).toBe('New Title');
  });

  it('emitReadyEvent dispatches forge-sim:ready on window', async () => {
    const handler = vi.fn();
    window.addEventListener('forge-sim:ready', handler);
    await callBridge('emitReadyEvent');
    expect(handler).toHaveBeenCalledOnce();
    window.removeEventListener('forge-sim:ready', handler);
  });

  it('enableTheming sets data-color-mode', async () => {
    await callBridge('enableTheming');
    expect(document.documentElement.getAttribute('data-color-mode')).toBe('dark');
  });

  it('getFrameId is stable and names the module', async () => {
    await expect(callBridge('getFrameId')).resolves.toBe('forge-sim-frame-test-module');
  });
});
