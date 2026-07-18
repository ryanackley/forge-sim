/**
 * Eval-7 F7 — showFlag in the Custom UI dev bridge.
 *
 * The inline bridge script installed for pre-built Custom UI apps
 * (generateBridgeInlineScript) dispatched showFlag to the `default` case:
 * a console.warn and a silent no-op. Flags are a top-5 bridge API —
 * @forge/bridge's showFlag() posts callBridge('showFlag', options) and
 * Flag.close() posts callBridge('closeFlag', {id}), and both must work.
 *
 * These tests eval the ACTUAL generated script in jsdom and drive it
 * through window.__bridge.callBridge, exactly like the real @forge/bridge
 * npm package does (same-realm, so action onClick handlers arrive as live
 * function references).
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateBridgeInlineScript } from '../dev-command.js';

type CallBridge = (cmd: string, data?: any) => Promise<any>;

/**
 * The script eagerly opens a WebSocket to the dev server at load (for the
 * event/history relay). Nothing listens in jsdom, so stub it out — the
 * flag path never touches the wire.
 */
class FakeWebSocket {
  static CONNECTING = 0;
  readyState = 0;
  onopen: null | (() => void) = null;
  onmessage: null | ((e: unknown) => void) = null;
  onclose: null | (() => void) = null;
  onerror: null | (() => void) = null;
  addEventListener() {}
  send() {}
  close() {}
}

function installBridge(): CallBridge {
  delete (window as any).__bridge;
  delete (window as any).__forgeSim;
  (window as any).WebSocket = FakeWebSocket;
  document.body.innerHTML = '';
  // eslint-disable-next-line no-new-func
  new Function(generateBridgeInlineScript(5174))();
  return (window as any).__bridge.callBridge;
}

const flagEls = () => document.querySelectorAll('[data-testid="forge-sim-flag"]');

describe('eval-7 F7 — showFlag / closeFlag in the inline Custom UI bridge', () => {
  let callBridge: CallBridge;

  beforeEach(() => {
    callBridge = installBridge();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('showFlag renders a toast with title and description (no unhandled-command warning)', async () => {
    const warn = vi.spyOn(console, 'warn');
    await callBridge('showFlag', {
      id: 'save-ok',
      title: 'Settings saved',
      description: 'Your changes are live.',
      type: 'success',
      isAutoDismiss: false,
    });

    const flags = flagEls();
    expect(flags).toHaveLength(1);
    expect(flags[0].textContent).toContain('Settings saved');
    expect(flags[0].textContent).toContain('Your changes are live.');
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('Unhandled command'));
    warn.mockRestore();
  });

  it('appearance/type pick the color scheme, unknown types fall back to info', async () => {
    await callBridge('showFlag', { id: 'e', title: 'Boom', type: 'error', isAutoDismiss: false });
    await callBridge('showFlag', { id: 'x', title: 'Odd', type: 'nonsense', isAutoDismiss: false });

    const [errorFlag, fallbackFlag] = Array.from(flagEls()) as HTMLElement[];
    expect(errorFlag.style.background).toBe('rgb(255, 235, 230)'); // #FFEBE6
    expect(fallbackFlag.style.background).toBe('rgb(222, 235, 255)'); // #DEEBFF (info)
  });

  it('action buttons render and fire their live onClick handlers', async () => {
    const onClick = vi.fn();
    await callBridge('showFlag', {
      id: 'act',
      title: 'Deploy failed',
      type: 'error',
      isAutoDismiss: false,
      actions: [{ text: 'Retry', onClick }],
    });

    const btn = document.querySelector<HTMLButtonElement>('[data-testid="forge-sim-flag"] button');
    expect(btn?.textContent).toBe('Retry');
    btn!.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('closeFlag removes the flag by id and reports whether it existed', async () => {
    vi.useFakeTimers();
    await callBridge('showFlag', { id: 'f1', title: 'One', isAutoDismiss: false });
    expect(flagEls()).toHaveLength(1);

    await expect(callBridge('closeFlag', { id: 'f1' })).resolves.toBe(true);
    vi.advanceTimersByTime(250); // fade-out removal
    expect(flagEls()).toHaveLength(0);

    await expect(callBridge('closeFlag', { id: 'f1' })).resolves.toBe(false);
  });

  it('re-showing the same id replaces the flag instead of stacking a duplicate', async () => {
    vi.useFakeTimers();
    await callBridge('showFlag', { id: 'dup', title: 'First', isAutoDismiss: false });
    await callBridge('showFlag', { id: 'dup', title: 'Second', isAutoDismiss: false });
    vi.advanceTimersByTime(250);

    const flags = flagEls();
    expect(flags).toHaveLength(1);
    expect(flags[0].textContent).toContain('Second');
  });

  it('auto-dismisses after 5s unless isAutoDismiss is false', async () => {
    vi.useFakeTimers();
    await callBridge('showFlag', { id: 'auto', title: 'Fleeting' });
    await callBridge('showFlag', { id: 'sticky', title: 'Pinned', isAutoDismiss: false });
    expect(flagEls()).toHaveLength(2);

    vi.advanceTimersByTime(5300); // 5s dismiss + 200ms fade
    const flags = flagEls();
    expect(flags).toHaveLength(1);
    expect(flags[0].textContent).toContain('Pinned');
  });

  it('flags stack in one shared container', async () => {
    await callBridge('showFlag', { id: 'a', title: 'A', isAutoDismiss: false });
    await callBridge('showFlag', { id: 'b', title: 'B', isAutoDismiss: false });

    const containers = document.querySelectorAll('[data-testid="forge-sim-flag-container"]');
    expect(containers).toHaveLength(1);
    expect(containers[0].querySelectorAll('[data-testid="forge-sim-flag"]')).toHaveLength(2);
  });

  it('truly unknown commands still hit the unhandled warning (dispatch sanity)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await callBridge('definitelyNotACommand');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Unhandled command: definitelyNotACommand'));
    warn.mockRestore();
  });
});
