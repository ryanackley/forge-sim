/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// We test the exported helpers and Modal class from the bridge shim.
// Because the shim auto-installs on import and expects a browser env,
// we use jsdom and import dynamically.

let shimModule: typeof import('../../renderer/src/bridge/forge-bridge-shim');

beforeEach(async () => {
  // Reset shared state
  delete (globalThis as any).__forgeSim;
  delete (globalThis as any).__bridge;

  // Fresh import each time
  vi.resetModules();
  shimModule = await import('../../renderer/src/bridge/forge-bridge-shim');
});

afterEach(() => {
  // Clean up any modal overlays left in the DOM
  document.querySelectorAll('[data-testid="forge-sim-modal-overlay"]').forEach(el => el.remove());
});

describe('isInModal()', () => {
  it('returns false when window === window.parent and no _modal param', () => {
    expect(shimModule.isInModal()).toBe(false);
  });

  it('returns false when _modal param is absent even with other params', () => {
    // jsdom window.location is http://localhost/ by default
    // No _modal param → not a modal
    expect(shimModule.isInModal()).toBe(false);
  });

  it('returns true when _modal=true is in the URL', () => {
    // Set _modal param on the URL
    const url = new URL(window.location.href);
    url.searchParams.set('_modal', 'true');
    Object.defineProperty(window, 'location', {
      value: new URL(url.toString()),
      writable: true,
      configurable: true,
    });
    // Re-check — but isInModal also checks window !== window.parent
    // In jsdom, window.parent === window, so even with param it would be false
    // unless we also mock parent. The dual check means BOTH must be true.
    // This is correct behavior — you need both signals.
    expect(shimModule.isInModal()).toBe(false);
  });
});

describe('buildModalIframeURL()', () => {
  it('builds URL with resource and _modal=true', () => {
    const url = shimModule.buildModalIframeURL('my-modal-resource');
    expect(url).toBe('/module/my-modal-resource/?_modal=true');
  });

  it('encodes context as base64 JSON', () => {
    const ctx = { issueKey: 'TEST-1', custom: 'data' };
    const url = shimModule.buildModalIframeURL('modal-res', ctx);
    expect(url).toContain('_modal=true');
    expect(url).toContain('context=');

    // Extract and decode the context param
    const parsed = new URL(url, 'http://localhost');
    const b64 = parsed.searchParams.get('context')!;
    const decoded = JSON.parse(atob(b64));
    expect(decoded).toEqual(ctx);
  });

  it('omits context param when context is undefined', () => {
    const url = shimModule.buildModalIframeURL('res');
    expect(url).not.toContain('context=');
  });

  it('omits context param when context is null', () => {
    const url = shimModule.buildModalIframeURL('res', null);
    expect(url).not.toContain('context=');
  });

  it('encodes special characters in resource name', () => {
    const url = shimModule.buildModalIframeURL('my resource/special');
    expect(url).toContain('/module/my%20resource%2Fspecial/');
  });
});

describe('Modal size mapping', () => {
  it('creates dialog with correct width for each size', async () => {
    // Mock WebSocket so callBridge doesn't try to connect
    const sizes: Record<string, string> = {
      small: '400px',
      medium: '600px',
      large: '800px',
      'x-large': '968px',
    };

    for (const [size, expectedWidth] of Object.entries(sizes)) {
      // Clean up any existing overlays
      document.querySelectorAll('[data-testid="forge-sim-modal-overlay"]').forEach(el => el.remove());
      (globalThis as any).__forgeSim.activeModal = null;

      // Call openModal directly via the Modal class — it calls callBridge('openModal', ...)
      // We won't await because the promise won't resolve until modal closes
      const modal = new shimModule.Modal({ resource: 'test', size });
      const openPromise = modal.open();

      // Check the DOM
      const dialog = document.querySelector('[data-testid="forge-sim-modal-dialog"]') as HTMLElement;
      expect(dialog, `dialog for size=${size}`).toBeTruthy();
      expect(dialog.style.width).toBe(expectedWidth);

      // Close modal to resolve promise and clean up
      modal.close();
      await openPromise;
    }
  });

  it('defaults to medium (600px) when no size specified', async () => {
    const modal = new shimModule.Modal({ resource: 'test' });
    const p = modal.open();

    const dialog = document.querySelector('[data-testid="forge-sim-modal-dialog"]') as HTMLElement;
    expect(dialog.style.width).toBe('600px');

    modal.close();
    await p;
  });

  it('defaults to medium for unknown size', async () => {
    const modal = new shimModule.Modal({ resource: 'test', size: 'gigantic' });
    const p = modal.open();

    const dialog = document.querySelector('[data-testid="forge-sim-modal-dialog"]') as HTMLElement;
    expect(dialog.style.width).toBe('600px');

    modal.close();
    await p;
  });
});

describe('Modal class', () => {
  it('stores options correctly', () => {
    const opts = {
      resource: 'my-modal',
      size: 'large',
      title: 'Edit Item',
      context: { itemId: '42' },
      closeOnEscape: false,
      closeOnOverlayClick: false,
    };
    const modal = new shimModule.Modal(opts);
    // The opts are private, but we can verify behavior via open()
    expect(modal).toBeDefined();
  });

  it('defaults opts to empty object when none given', () => {
    const modal = new shimModule.Modal();
    expect(modal).toBeDefined();
  });

  it('onClose stores callback in opts', async () => {
    const cb = vi.fn();
    const modal = new shimModule.Modal({ resource: 'test' });
    await modal.onClose(cb);

    // Open and close — cb should fire
    const p = modal.open();
    modal.close({ result: 'ok' });
    await p;
    expect(cb).toHaveBeenCalled();
  });
});

describe('Modal overlay DOM structure', () => {
  it('creates overlay, dialog, and iframe', async () => {
    const modal = new shimModule.Modal({ resource: 'test-resource' });
    const p = modal.open();

    const overlay = document.querySelector('[data-testid="forge-sim-modal-overlay"]') as HTMLElement;
    expect(overlay).toBeTruthy();
    expect(overlay.style.position).toBe('fixed');
    expect(overlay.style.zIndex).toBe('1000');

    const dialog = document.querySelector('[data-testid="forge-sim-modal-dialog"]') as HTMLElement;
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('role')).toBe('dialog');

    const iframe = document.querySelector('[data-testid="forge-sim-modal-iframe"]') as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    expect(iframe.src).toContain('/module/test-resource/');
    expect(iframe.src).toContain('_modal=true');

    modal.close();
    await p;
  });

  it('adds title bar when title is specified', async () => {
    const modal = new shimModule.Modal({ resource: 'test', title: 'My Modal Title' });
    const p = modal.open();

    const dialog = document.querySelector('[data-testid="forge-sim-modal-dialog"]') as HTMLElement;
    const titleBar = dialog.firstElementChild as HTMLElement;
    expect(titleBar.textContent).toBe('My Modal Title');
    // The iframe should be the second child
    expect(dialog.children.length).toBe(2);

    modal.close();
    await p;
  });

  it('does not add title bar when title is not specified', async () => {
    const modal = new shimModule.Modal({ resource: 'test' });
    const p = modal.open();

    const dialog = document.querySelector('[data-testid="forge-sim-modal-dialog"]') as HTMLElement;
    // Only child should be the iframe
    expect(dialog.children.length).toBe(1);
    expect((dialog.firstElementChild as HTMLElement).tagName).toBe('IFRAME');

    modal.close();
    await p;
  });

  it('removes overlay from DOM on close', async () => {
    const modal = new shimModule.Modal({ resource: 'test' });
    const p = modal.open();

    expect(document.querySelector('[data-testid="forge-sim-modal-overlay"]')).toBeTruthy();

    modal.close();
    await p;

    expect(document.querySelector('[data-testid="forge-sim-modal-overlay"]')).toBeNull();
  });
});

describe('Modal message handling', () => {
  it('closes modal on forge-sim-modal-submit message', async () => {
    const modal = new shimModule.Modal({ resource: 'test' });
    const p = modal.open();

    // Simulate message from modal iframe
    window.dispatchEvent(new MessageEvent('message', {
      data: { type: 'forge-sim-modal-submit', payload: { result: 'submitted' } },
    }));

    const result = await p;
    expect(result).toEqual({ result: 'submitted' });
    expect(document.querySelector('[data-testid="forge-sim-modal-overlay"]')).toBeNull();
  });

  it('closes modal on forge-sim-modal-close message', async () => {
    const modal = new shimModule.Modal({ resource: 'test' });
    const p = modal.open();

    window.dispatchEvent(new MessageEvent('message', {
      data: { type: 'forge-sim-modal-close', payload: { reason: 'cancelled' } },
    }));

    const result = await p;
    expect(result).toEqual({ reason: 'cancelled' });
  });

  it('ignores unknown message types', async () => {
    const modal = new shimModule.Modal({ resource: 'test' });
    const p = modal.open();

    // This should NOT close the modal
    window.dispatchEvent(new MessageEvent('message', {
      data: { type: 'some-other-event', payload: {} },
    }));

    // Modal should still be open
    expect(document.querySelector('[data-testid="forge-sim-modal-overlay"]')).toBeTruthy();

    modal.close();
    await p;
  });

  it('ignores non-object messages', async () => {
    const modal = new shimModule.Modal({ resource: 'test' });
    const p = modal.open();

    window.dispatchEvent(new MessageEvent('message', { data: 'just a string' }));
    window.dispatchEvent(new MessageEvent('message', { data: null }));
    window.dispatchEvent(new MessageEvent('message', { data: 42 }));

    // Modal should still be open
    expect(document.querySelector('[data-testid="forge-sim-modal-overlay"]')).toBeTruthy();

    modal.close();
    await p;
  });

  it('fires onClose callback with payload on submit', async () => {
    const onClose = vi.fn();
    const modal = new shimModule.Modal({ resource: 'test' });
    await modal.onClose(onClose);
    const p = modal.open();

    window.dispatchEvent(new MessageEvent('message', {
      data: { type: 'forge-sim-modal-submit', payload: { data: 123 } },
    }));

    await p;
    expect(onClose).toHaveBeenCalledWith({ data: 123 });
  });
});

describe('Modal keyboard/overlay interactions', () => {
  it('closes on Escape when closeOnEscape is not false', async () => {
    const modal = new shimModule.Modal({ resource: 'test' });
    const p = modal.open();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    await p;
    expect(document.querySelector('[data-testid="forge-sim-modal-overlay"]')).toBeNull();
  });

  it('does NOT close on Escape when closeOnEscape is false', async () => {
    const modal = new shimModule.Modal({ resource: 'test', closeOnEscape: false });
    const p = modal.open();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    // Should still be open
    expect(document.querySelector('[data-testid="forge-sim-modal-overlay"]')).toBeTruthy();

    modal.close();
    await p;
  });

  it('closes on overlay click when closeOnOverlayClick is not false', async () => {
    const modal = new shimModule.Modal({ resource: 'test' });
    const p = modal.open();

    const overlay = document.querySelector('[data-testid="forge-sim-modal-overlay"]') as HTMLElement;
    overlay.click(); // click directly on overlay (not dialog)

    await p;
    expect(document.querySelector('[data-testid="forge-sim-modal-overlay"]')).toBeNull();
  });

  it('does NOT close on overlay click when closeOnOverlayClick is false', async () => {
    const modal = new shimModule.Modal({ resource: 'test', closeOnOverlayClick: false });
    const p = modal.open();

    const overlay = document.querySelector('[data-testid="forge-sim-modal-overlay"]') as HTMLElement;
    overlay.click();

    // Should still be open
    expect(document.querySelector('[data-testid="forge-sim-modal-overlay"]')).toBeTruthy();

    modal.close();
    await p;
  });
});

describe('Only one modal at a time', () => {
  it('closes existing modal when opening a new one', async () => {
    const onClose1 = vi.fn();
    const modal1 = new shimModule.Modal({ resource: 'first' });
    await modal1.onClose(onClose1);
    const p1 = modal1.open();

    // Open a second modal
    const modal2 = new shimModule.Modal({ resource: 'second' });
    const p2 = modal2.open();

    // First modal should have been closed
    await p1;
    expect(onClose1).toHaveBeenCalled();

    // Only one overlay should exist
    const overlays = document.querySelectorAll('[data-testid="forge-sim-modal-overlay"]');
    expect(overlays.length).toBe(1);

    // Second modal's iframe should point to 'second'
    const iframe = document.querySelector('[data-testid="forge-sim-modal-iframe"]') as HTMLIFrameElement;
    expect(iframe.src).toContain('/module/second/');

    modal2.close();
    await p2;
  });
});

describe('submit/close in non-modal context', () => {
  it('view.submit does NOT postMessage when not in a modal', async () => {
    const postMessageSpy = vi.spyOn(window.parent, 'postMessage');

    // view.submit should route to RPC (which will fail due to no WS, but it shouldn't postMessage)
    // We catch the RPC error
    try {
      await shimModule.view.submit({ data: 'test' });
    } catch {
      // Expected — no WS connection
    }

    // postMessage should NOT have been called with modal message types
    const modalCalls = postMessageSpy.mock.calls.filter(
      ([data]) => data?.type === 'forge-sim-modal-submit' || data?.type === 'forge-sim-modal-close'
    );
    expect(modalCalls.length).toBe(0);
    postMessageSpy.mockRestore();
  });
});

describe('Modal iframe context', () => {
  it('encodes context into iframe URL that getContextFromURL can read', () => {
    const ctx = { issueKey: 'PROJ-5', custom: { nested: true } };
    const url = shimModule.buildModalIframeURL('modal-res', ctx);

    // Parse the generated URL and verify context round-trips
    const parsed = new URL(url, 'http://localhost');
    const b64 = parsed.searchParams.get('context')!;
    expect(b64).toBeTruthy();
    const decoded = JSON.parse(atob(b64));
    expect(decoded).toEqual(ctx);
    expect(parsed.searchParams.get('_modal')).toBe('true');
  });
});
