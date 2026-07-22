/**
 * ForgeSimModulePage — the top-level parent page for nested dev surfaces
 * (macros, custom fields, workflows).
 *
 * It replaces the old vanilla-HTML parent wrappers with a real Atlaskit React
 * document so the dev chrome (gear popover + render badge) pins to the browser
 * viewport instead of a child content iframe's viewport. The per-mode content
 * still renders in child iframes (JS-realm isolation, parity-correct); this
 * page owns the tabs, the Save action, the chrome, and the reload-on-update
 * plumbing.
 *
 * These tests assert the parent-page contract: header + badge + tabs render,
 * the gear + badge live at the top level, tabs toggle the visible iframe, the
 * badge reflects the visible iframe's mirrored render count, and a macro
 * Config-Save WS broadcast flips back to the View tab.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act, fireEvent, screen } from '@testing-library/react';
import React from 'react';
import { ForgeSimModulePage, ForgeSimModulePageProps } from '../ForgeSimModulePage';
import * as bridgeShim from '../bridge/forge-bridge-shim';

const macroProps: ForgeSimModulePageProps = {
  baseKey: 'hello-macro',
  title: 'Hello Macro',
  surface: 'macro',
  modes: [
    { mode: 'view', label: 'View' },
    { mode: 'config', label: 'Config' },
  ],
  wsPort: 4000,
};

// Capture the WebSocket instance the page opens so we can drive onmessage.
let lastWs: any = null;
const OriginalWebSocket = globalThis.WebSocket;

class CapturingWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static CONNECTING = 0;
  readyState = 1;
  url: string;
  onopen: ((e: any) => void) | null = null;
  onmessage: ((e: any) => void) | null = null;
  onclose: ((e: any) => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  constructor(url: string) {
    this.url = url;
    lastWs = this;
  }
  send() {}
  close() {
    this.readyState = 3;
  }
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return false;
  }
}

function iframeForLabel(label: string): HTMLIFrameElement {
  const el = document.querySelector(
    `iframe[title="${macroProps.baseKey} (${label})"]`,
  );
  if (!el) throw new Error(`no iframe for ${label}`);
  return el as HTMLIFrameElement;
}

async function renderMacroPage(props: ForgeSimModulePageProps = macroProps) {
  await act(async () => {
    render(<ForgeSimModulePage {...props} />);
  });
}

describe('ForgeSimModulePage — nested-surface parent page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    lastWs = null;
    globalThis.WebSocket = CapturingWebSocket as any;
    // Benign RPC so the acting-user fetch neither hangs nor throws.
    vi.spyOn(bridgeShim, 'rpc').mockResolvedValue({} as any);
  });

  afterEach(() => {
    globalThis.WebSocket = OriginalWebSocket;
  });

  it('renders the header, surface badge, and mode tabs', async () => {
    await renderMacroPage();

    // baseKey heading + subtitle title.
    expect(document.body.textContent).toContain('hello-macro');
    expect(document.body.textContent).toContain('Hello Macro');
    // Surface lozenge.
    expect(document.body.textContent).toContain('Macro');
    // One tab button per mode.
    expect(screen.getByRole('button', { name: 'View' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Config' })).toBeTruthy();
    // "Back to modules" nav.
    expect(document.body.textContent).toContain('Back to modules');
  });

  it('renders the gear popover and render badge at the top level', async () => {
    await renderMacroPage();

    expect(document.querySelector('[aria-label="forge-sim settings"]')).not.toBeNull();
    expect(document.body.textContent).toContain('🔥 renders:');
  });

  it('shows the first mode by default and toggles the visible iframe on tab click', async () => {
    await renderMacroPage();

    // View is first → visible; Config hidden.
    expect(iframeForLabel('View').style.display).toBe('block');
    expect(iframeForLabel('Config').style.display).toBe('none');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Config' }));
    });

    expect(iframeForLabel('View').style.display).toBe('none');
    expect(iframeForLabel('Config').style.display).toBe('block');
    expect(screen.getByRole('button', { name: 'Config' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('updates the badge from a forge-sim:renderCount message on the visible iframe', async () => {
    await renderMacroPage();

    // Badge starts at 0.
    expect(document.body.textContent).toContain('🔥 renders: 0');

    // A renderCount message must be attributed to a mode by matching e.source
    // to that mode's iframe contentWindow.
    const viewWin = iframeForLabel('View').contentWindow;
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'forge-sim:renderCount', count: 5 },
          source: viewWin as any,
        }),
      );
    });

    expect(document.body.textContent).toContain('🔥 renders: 5');
  });

  it('switches back to the View tab on a macro Config-Save WS broadcast', async () => {
    await renderMacroPage();

    // Move to Config first.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Config' }));
    });
    expect(iframeForLabel('Config').style.display).toBe('block');

    // The dev server broadcasts after storing the new config; the page flips
    // back to View so useConfig() re-reads.
    expect(lastWs).not.toBeNull();
    await act(async () => {
      lastWs.onmessage?.({
        data: JSON.stringify({ type: 'macroConfigUpdate', macroKey: macroProps.baseKey }),
      });
    });

    expect(iframeForLabel('View').style.display).toBe('block');
    expect(iframeForLabel('Config').style.display).toBe('none');
    expect(screen.getByRole('button', { name: 'View' }).getAttribute('aria-pressed')).toBe('true');
  });
});
