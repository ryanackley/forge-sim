/**
 * ForgeSimShell — embedded dev-chrome + iframe auto-resize emitter.
 *
 * Macro / custom-field / workflow dev pages nest the renderer in a child
 * iframe. The dev chrome (gear popover + render badge) now lives on the
 * TOP-LEVEL parent page (ForgeSimModulePage) so `position:fixed` pins to the
 * real browser viewport instead of a child iframe's viewport. Inside a content
 * iframe the shell therefore renders content ONLY — no gear, no badge — and:
 *   - posts `{ type:'resize', height }` (pure content height) so the parent
 *     grows the frame to fit (no internal scrollbar),
 *   - mirrors its render count up via `{ type:'forge-sim:renderCount', count }`
 *     so the parent badge reflects the visible iframe.
 * Top-level (standard) surfaces are unchanged: the shell renders the gear +
 * badge itself, and never posts (posting to self is pointless).
 *
 * jsdom's ResizeObserver is a no-op stub (see setup.ts), so the observed
 * resize callback never fires here — but the emitter also posts once
 * immediately on attach, which is what the resize tests assert.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
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

function messagesOfType(calls: any[][], type: string): any[] {
  return calls.map((c) => c[0]).filter((m) => m && m.type === type);
}

describe('ForgeSimShell — embedded chrome + auto-resize', () => {
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

  function embed(postMessage = vi.fn()) {
    // Fake a distinct parent window → embedded (window.parent !== window).
    Object.defineProperty(window, 'parent', {
      configurable: true,
      value: { postMessage },
    });
    return postMessage;
  }

  function topLevel() {
    // window.parent === window → not embedded.
    Object.defineProperty(window, 'parent', { configurable: true, value: window });
  }

  it('posts a resize height to the parent when embedded in an iframe', async () => {
    const postMessage = embed();

    await act(async () => {
      render(<ForgeSimShell />);
    });
    await act(async () => {
      reconcileMinimalDoc();
    });

    const resizes = messagesOfType(postMessage.mock.calls, 'resize');
    expect(resizes.length).toBeGreaterThan(0);
    expect(typeof resizes[0].height).toBe('number');
    // Includes the +48 card-margin allowance, so always positive even when
    // jsdom reports a 0-height getBoundingClientRect.
    expect(resizes[0].height).toBeGreaterThanOrEqual(48);
  });

  it('does NOT post when running as a top-level page (not embedded)', async () => {
    topLevel();
    const spy = vi.spyOn(window, 'postMessage').mockImplementation(() => {});

    await act(async () => {
      render(<ForgeSimShell />);
    });
    await act(async () => {
      reconcileMinimalDoc();
    });

    expect(messagesOfType(spy.mock.calls, 'resize').length).toBe(0);
  });

  it('renders neither gear nor badge when embedded (parent owns the chrome)', async () => {
    embed();

    await act(async () => {
      render(<ForgeSimShell />);
    });
    await act(async () => {
      reconcileMinimalDoc();
    });

    expect(document.querySelector('[aria-label="forge-sim settings"]')).toBeNull();
    expect(document.body.textContent).not.toContain('🔥 renders:');
  });

  it('renders both gear and badge when top-level (standard surface)', async () => {
    topLevel();

    await act(async () => {
      render(<ForgeSimShell />);
    });
    await act(async () => {
      reconcileMinimalDoc();
    });

    expect(document.querySelector('[aria-label="forge-sim settings"]')).not.toBeNull();
    expect(document.body.textContent).toContain('🔥 renders:');
  });

  it('mirrors its render count to the parent when embedded', async () => {
    const postMessage = embed();

    await act(async () => {
      render(<ForgeSimShell />);
    });
    await act(async () => {
      reconcileMinimalDoc();
    });

    const counts = messagesOfType(postMessage.mock.calls, 'forge-sim:renderCount');
    expect(counts.length).toBeGreaterThan(0);
    expect(typeof counts[counts.length - 1].count).toBe('number');
  });
});
