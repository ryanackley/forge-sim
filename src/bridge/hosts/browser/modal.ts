/**
 * Modal.open() — the host-drawn dialog real Forge renders around a module.
 *
 * We draw an overlay + dialog in the opener's document and load the target
 * module into a child iframe, tagged `_modal=true`. The modal's own bridge
 * sees that tag (`isInModal`) and routes `view.submit()` / `view.close()`
 * back here by postMessage instead of to the dev server, which is what
 * resolves the promise the opener is awaiting.
 *
 * Ported from the UI Kit renderer shim so every browser surface — Custom UI,
 * proxied pages, UI Kit — gets the same modal. Custom UI previously had no
 * openModal case at all: it fell to the default arm and resolved undefined.
 */

const SIZES: Record<string, number> = {
  small: 400,
  medium: 600,
  large: 800,
  'x-large': 968,
};

/** Query flag the opener puts on the modal's iframe URL. */
export const MODAL_URL_FLAG = '_modal';

interface ActiveModal {
  overlay: HTMLElement;
  messageHandler: (e: MessageEvent) => void;
  escapeHandler: (e: KeyboardEvent) => void;
  resolve: (payload?: unknown) => void;
  onClose?: (payload?: unknown) => void;
}

/** True when THIS frame is a modal opened by the code above. */
export function isInModalFrame(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window === window.parent) return false;
  } catch {
    // Cross-origin parent — we cannot be anything but embedded.
    return true;
  }
  return new URLSearchParams(window.location.search).get(MODAL_URL_FLAG) === 'true';
}

export function buildModalIframeURL(resource: string, context?: unknown): string {
  let url = `/module/${encodeURIComponent(resource)}/?${MODAL_URL_FLAG}=true`;
  if (context != null) {
    // Same encoding the context reader expects: base64 of the JSON.
    url += `&context=${encodeURIComponent(btoa(JSON.stringify(context)))}`;
  }
  return url;
}

export interface ModalSurface {
  open(data: any): Promise<unknown>;
  /** Dismiss the open modal, resolving the opener's promise. */
  close(payload?: unknown): void;
}

export function createModalSurface(): ModalSurface {
  let active: ActiveModal | null = null;

  function close(payload?: unknown): void {
    const modal = active;
    if (!modal) return;
    window.removeEventListener('message', modal.messageHandler);
    document.removeEventListener('keydown', modal.escapeHandler);
    modal.overlay.remove();
    active = null;
    if (modal.onClose) {
      try { modal.onClose(payload); } catch { /* app callback */ }
    }
    modal.resolve(payload);
  }

  return {
    close,
    open(data: any): Promise<unknown> {
      // Only one modal at a time; opening a second resolves the first.
      if (active) close();

      const size = SIZES[data?.size] ?? SIZES.medium;
      const closeOnOverlayClick = data?.closeOnOverlayClick !== false;
      const closeOnEscape = data?.closeOnEscape !== false;

      const overlay = document.createElement('div');
      overlay.setAttribute('data-testid', 'forge-sim-modal-overlay');
      Object.assign(overlay.style, {
        position: 'fixed', top: '0', left: '0', right: '0', bottom: '0',
        backgroundColor: 'rgba(9, 30, 66, 0.54)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: '1000',
      });

      const dialog = document.createElement('div');
      dialog.setAttribute('data-testid', 'forge-sim-modal-dialog');
      dialog.setAttribute('role', 'dialog');
      Object.assign(dialog.style, {
        backgroundColor: '#fff', borderRadius: '3px',
        boxShadow: '0 0 0 1px rgba(9,30,66,0.08), 0 2px 1px rgba(9,30,66,0.08), 0 0 20px -6px rgba(9,30,66,0.31)',
        width: `${size}px`, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      });

      if (data?.title) {
        const titleBar = document.createElement('div');
        Object.assign(titleBar.style, {
          padding: '16px 20px', borderBottom: '1px solid #ebecf0',
          fontSize: '20px', fontWeight: '500',
        });
        titleBar.textContent = data.title;
        dialog.appendChild(titleBar);
      }

      const iframe = document.createElement('iframe');
      iframe.setAttribute('data-testid', 'forge-sim-modal-iframe');
      iframe.src = buildModalIframeURL(data?.resource, data?.context);
      Object.assign(iframe.style, {
        width: '100%', flex: '1', border: 'none', minHeight: '200px',
      });
      dialog.appendChild(iframe);
      overlay.appendChild(dialog);

      return new Promise((resolve) => {
        const messageHandler = (e: MessageEvent) => {
          const d: any = e.data;
          if (!d || typeof d !== 'object') return;
          if (d.type === 'forge-sim-modal-submit' || d.type === 'forge-sim-modal-close') {
            close(d.payload);
          }
        };
        const escapeHandler = (e: KeyboardEvent) => {
          if (closeOnEscape && e.key === 'Escape') close();
        };
        if (closeOnOverlayClick) {
          overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
          });
        }
        window.addEventListener('message', messageHandler);
        document.addEventListener('keydown', escapeHandler);

        active = { overlay, messageHandler, escapeHandler, resolve, onClose: data?.onClose };
        document.body.appendChild(overlay);
      });
    },
  };
}
