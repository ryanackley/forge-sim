/**
 * ForgeSimShell — iframe auto-resize emitter.
 *
 * Macro / custom-field / workflow dev pages nest the renderer in a child
 * iframe pinned at `min-height: 200px` and listen for a
 * `{ type: 'resize', height }` postMessage to grow the frame to fit. Nothing
 * ever emitted that message, so config/view/field sub-iframes were stuck at
 * 200px regardless of content. The shell now measures its content card and
 * posts the height to the parent — but ONLY when actually embedded
 * (`window.parent !== window`); top-level module pages grow on their own.
 *
 * jsdom's ResizeObserver is a no-op stub (see setup.ts), so the observed
 * resize callback never fires here — but the emitter also posts once
 * immediately on attach, which is what these tests assert.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import React from 'react';
import { ForgeSimShell } from '../ForgeSimShell';
import * as bridgeShim from '../bridge/forge-bridge-shim';

// Atlaskit editor-core needs browser APIs jsdom lacks — stub as the other
// shell tests do.
vi.mock('../editors/ForgeEditors', () => ({
  ForgeChromelessEditor: () => <div data-testid="chromeless-editor" />,
  ForgeCommentEditor: () => <div data-testid="comment-editor" />,
}));

const G = globalThis as any;

// The shell only renders its content card once a ForgeDoc arrives on the
// reconcile stream — until then it shows "Loading Forge app...". Drive a
// minimal view tree through the bridge to get past that gate.
function reconcileMinimalDoc() {
  G.__bridge.callBridge('reconcile', {
    forgeDoc: {
      type: 'Root',
      props: {},
      children: [{ type: 'String', props: { text: 'app view' }, children: [], key: 's' }],
      key: 'root',
    },
  });
}

function resetShimState() {
  if (!G.__forgeSim) return;
  G.__forgeSim.reconcileListeners.length = 0;
  G.__forgeSim.macroConfigReconcileListeners.length = 0;
  G.__forgeSim.lastForgeDoc = null;
  G.__forgeSim.lastMacroConfigDoc = null;
  G.__forgeSim.activeSubmitTree = 'view';
}

function resizeMessages(calls: any[][]): any[] {
  return calls.map((c) => c[0]).filter((m) => m && m.type === 'resize');
}

function lastResizeHeight(calls: any[][]): number {
  const msgs = resizeMessages(calls);
  return msgs[msgs.length - 1].height;
}

describe('ForgeSimShell — iframe auto-resize emitter', () => {
  let originalParent: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.restoreAllMocks();
    resetShimState();
    // Keep RPCs benign so the acting-user fetch neither hangs nor throws.
    vi.spyOn(bridgeShim, 'rpc').mockResolvedValue({} as any);
    originalParent = Object.getOwnPropertyDescriptor(window, 'parent');
  });

  afterEach(() => {
    if (originalParent) Object.defineProperty(window, 'parent', originalParent);
  });

  it('posts a resize height to the parent when embedded in an iframe', async () => {
    const postMessage = vi.fn();
    // Fake a distinct parent window → embedded (window.parent !== window).
    Object.defineProperty(window, 'parent', {
      configurable: true,
      value: { postMessage },
    });

    await act(async () => {
      render(<ForgeSimShell />);
    });
    await act(async () => {
      reconcileMinimalDoc();
    });

    const resizes = resizeMessages(postMessage.mock.calls);
    expect(resizes.length).toBeGreaterThan(0);
    expect(typeof resizes[0].height).toBe('number');
    // Includes the +48 card-margin allowance, so always positive even when
    // jsdom reports a 0-height getBoundingClientRect.
    expect(resizes[0].height).toBeGreaterThanOrEqual(48);
  });

  it('does NOT post when running as a top-level page (not embedded)', async () => {
    // window.parent === window → the guard suppresses the emit.
    Object.defineProperty(window, 'parent', { configurable: true, value: window });
    const spy = vi.spyOn(window, 'postMessage').mockImplementation(() => {});

    await act(async () => {
      render(<ForgeSimShell />);
    });
    await act(async () => {
      reconcileMinimalDoc();
    });

    expect(resizeMessages(spy.mock.calls).length).toBe(0);
  });

  it('floors the posted height to make room for the open gear popover', async () => {
    const postMessage = vi.fn();
    Object.defineProperty(window, 'parent', {
      configurable: true,
      value: { postMessage },
    });

    await act(async () => {
      render(<ForgeSimShell />);
    });
    await act(async () => {
      reconcileMinimalDoc();
    });

    // Baseline: closed popover posts the (short) content height.
    const closedHeight = lastResizeHeight(postMessage.mock.calls);

    // Open the gear popover — it opens UPWARD from a fixed-bottom anchor, so
    // the shell must grow the iframe to keep it from clipping at the top.
    const gear = document.querySelector(
      '[aria-label="forge-sim settings"]',
    ) as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(gear);
    });

    const openHeight = lastResizeHeight(postMessage.mock.calls);
    // Popover geometry floor: 12 (gear offset) + 36 (panel offset) + panel
    // height + 12 breathing room — strictly taller than the short content.
    expect(openHeight).toBeGreaterThan(closedHeight);
    expect(openHeight).toBeGreaterThanOrEqual(60);
  });

  it('reserves extra upward room for the user-search menu when a switcher is present', async () => {
    const postMessage = vi.fn();
    Object.defineProperty(window, 'parent', {
      configurable: true,
      value: { postMessage },
    });
    // A dev-server switcher makes the "Acting as" AsyncSelect render; its menu
    // opens upward (menuPlacement="top", maxMenuHeight 220), so the floor must
    // reserve ~240px above the panel.
    (bridgeShim.rpc as any).mockImplementation((method: string) => {
      if (method === 'getActingUserState') {
        return Promise.resolve({
          mode: 'offline',
          current: { accountId: 'sim-user-001', displayName: 'Ryan Ackley' },
          users: [{ accountId: 'sim-user-001', displayName: 'Ryan Ackley' }],
          site: null,
        });
      }
      return Promise.resolve({});
    });

    await act(async () => {
      render(<ForgeSimShell />);
    });
    await act(async () => {
      reconcileMinimalDoc();
    });

    const gear = document.querySelector(
      '[aria-label="forge-sim settings"]',
    ) as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(gear);
    });

    const openHeight = lastResizeHeight(postMessage.mock.calls);
    // 12 + 36 + panelHeight (>=0) + 240 (menu reserve) + 12 ≥ 300.
    expect(openHeight).toBeGreaterThanOrEqual(300);
  });
});
