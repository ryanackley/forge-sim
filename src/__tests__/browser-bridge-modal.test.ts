/**
 * Modal.open() in the browser bridge host.
 *
 * Custom UI never had an openModal case — it hit the default arm and
 * resolved undefined — and the first cut of the shared browser host left
 * openModal as an injected capability that nothing injected, so it threw.
 * Now it is a real surface (src/bridge/hosts/browser/modal.ts) shared by
 * every browser surface, and these drive it through window.__bridge exactly
 * as @forge/bridge's Modal.open() does.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installBrowserBridge } from './helpers/browser-bridge-harness.js';
import { buildModalIframeURL, isInModalFrame, MODAL_URL_FLAG } from '../bridge/hosts/browser/modal.js';

type CallBridge = (cmd: string, data?: any) => Promise<any>;

const overlay = () => document.querySelector('[data-testid="forge-sim-modal-overlay"]');
const dialog = () => document.querySelector('[data-testid="forge-sim-modal-dialog"]');
const iframe = () => document.querySelector('[data-testid="forge-sim-modal-iframe"]') as HTMLIFrameElement | null;

/** The modal resolves on a postMessage from the child frame. */
function postFromModal(type: string, payload?: unknown) {
  window.dispatchEvent(new MessageEvent('message', { data: { type, payload } }));
}

describe('Modal.open() through the browser bridge host', () => {
  let callBridge: CallBridge;

  beforeEach(() => {
    callBridge = installBrowserBridge().callBridge;
  });

  it('renders an overlay, dialog and module iframe', async () => {
    void callBridge('openModal', { resource: 'settings-page', title: 'Settings' });
    await Promise.resolve();

    expect(overlay()).not.toBeNull();
    expect(dialog()?.getAttribute('role')).toBe('dialog');
    expect(overlay()?.textContent).toContain('Settings');
    expect(iframe()?.getAttribute('src')).toBe('/module/settings-page/?_modal=true');
  });

  it('sizes the dialog from the size option, defaulting to medium', async () => {
    void callBridge('openModal', { resource: 'r' });
    await Promise.resolve();
    expect((dialog() as HTMLElement).style.width).toBe('600px');

    void callBridge('openModal', { resource: 'r', size: 'x-large' });
    await Promise.resolve();
    expect((dialog() as HTMLElement).style.width).toBe('968px');
  });

  it('resolves the opener promise with the payload when the modal submits', async () => {
    const result = callBridge('openModal', { resource: 'r' });
    await Promise.resolve();

    postFromModal('forge-sim-modal-submit', { saved: true });
    await expect(result).resolves.toEqual({ saved: true });
    expect(overlay()).toBeNull();
  });

  it('resolves and tears down when the modal closes itself', async () => {
    const result = callBridge('openModal', { resource: 'r' });
    await Promise.resolve();

    postFromModal('forge-sim-modal-close');
    await expect(result).resolves.toBeUndefined();
    expect(overlay()).toBeNull();
  });

  it('Escape closes by default and is suppressed by closeOnEscape: false', async () => {
    const first = callBridge('openModal', { resource: 'r' });
    await Promise.resolve();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await expect(first).resolves.toBeUndefined();
    expect(overlay()).toBeNull();

    void callBridge('openModal', { resource: 'r', closeOnEscape: false });
    await Promise.resolve();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await Promise.resolve();
    expect(overlay()).not.toBeNull();
  });

  it('a click on the overlay closes, a click inside the dialog does not', async () => {
    void callBridge('openModal', { resource: 'r' });
    await Promise.resolve();

    (dialog() as HTMLElement).click();
    await Promise.resolve();
    expect(overlay()).not.toBeNull();

    (overlay() as HTMLElement).click();
    await Promise.resolve();
    expect(overlay()).toBeNull();
  });

  it('closeOnOverlayClick: false keeps it open on an overlay click', async () => {
    void callBridge('openModal', { resource: 'r', closeOnOverlayClick: false });
    await Promise.resolve();
    (overlay() as HTMLElement).click();
    await Promise.resolve();
    expect(overlay()).not.toBeNull();
  });

  it('fires the app onClose callback with the payload', async () => {
    const onClose = vi.fn();
    void callBridge('openModal', { resource: 'r', onClose });
    await Promise.resolve();

    postFromModal('forge-sim-modal-submit', 'done');
    await Promise.resolve();
    expect(onClose).toHaveBeenCalledWith('done');
  });

  it('opening a second modal resolves the first instead of stacking', async () => {
    const first = callBridge('openModal', { resource: 'a' });
    await Promise.resolve();
    void callBridge('openModal', { resource: 'b' });
    await Promise.resolve();

    await expect(first).resolves.toBeUndefined();
    expect(document.querySelectorAll('[data-testid="forge-sim-modal-overlay"]')).toHaveLength(1);
    expect(iframe()?.getAttribute('src')).toContain('/module/b/');
  });

  it('stale postMessages after close do not throw', async () => {
    const result = callBridge('openModal', { resource: 'r' });
    await Promise.resolve();
    postFromModal('forge-sim-modal-close');
    await result;
    expect(() => postFromModal('forge-sim-modal-close')).not.toThrow();
  });
});

describe('modal iframe URL + frame detection', () => {
  it('tags the URL so the child frame knows it is a modal', () => {
    expect(buildModalIframeURL('my-page')).toBe('/module/my-page/?_modal=true');
  });

  it('round-trips context as base64 JSON, matching what the bridge decodes', () => {
    const url = buildModalIframeURL('p', { issueKey: 'T-1' });
    const b64 = new URLSearchParams(url.slice(url.indexOf('?'))).get('context')!;
    expect(JSON.parse(atob(b64))).toEqual({ issueKey: 'T-1' });
  });

  it('isInModalFrame is false in a top-level frame', () => {
    // jsdom: window === window.parent, so this is the opener, not a modal.
    expect(isInModalFrame()).toBe(false);
  });

  it('the flag the opener sets is the one the child looks for', () => {
    // Regression guard: the first cut of the host checked `modal=1` while
    // the URL builder wrote `_modal=true`, so a modal frame never knew it
    // was one and its view.submit() went to the dev server instead of the
    // opener — the modal would hang open.
    expect(buildModalIframeURL('p')).toContain(`${MODAL_URL_FLAG}=true`);
  });
});
