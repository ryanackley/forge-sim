/**
 * @forge/bridge browser shim — drop-in replacement for @forge/bridge
 * that routes backend calls (invoke, requestProduct, getContext) over
 * WebSocket to forge-sim, while keeping everything else client-side.
 *
 * This enables the real Forge architecture:
 *   - @forge/react reconciler runs in the browser (debuggable in CDT)
 *   - Event handlers, useState, useEffect run in the browser
 *   - Only resolver invocations and product API calls cross to the backend
 *
 * Usage: Vite aliases @forge/bridge → this file
 */

// ── Shared State (survives Vite module duplication) ────────────────────
//
// Vite may create multiple copies of this module (pre-bundled deps vs source).
// ALL mutable state must live on globalThis.__forgeSim so every copy shares it.

type ReconcileListener = (forgeDoc: any) => void;
type ModalCloseCallback = (payload?: any) => void;

interface ActiveModal {
  overlay: HTMLElement;
  dialog: HTMLElement;
  iframe: HTMLIFrameElement;
  messageHandler: (e: MessageEvent) => void;
  escapeHandler: (e: KeyboardEvent) => void;
  resolve: (payload?: any) => void;
  onClose?: ModalCloseCallback;
}

const G = globalThis as any;
if (!G.__forgeSim) {
  G.__forgeSim = {
    // WebSocket connection
    ws: null as WebSocket | null,
    wsReady: false,
    wsUrl: 'ws://localhost:5174',
    pendingRequests: new Map<string, { resolve: (v: any) => void; reject: (e: any) => void }>(),
    requestCounter: 0,
    // Reconcile
    reconcileListeners: [] as ReconcileListener[],
    lastForgeDoc: null as any,
    // Modal
    activeModal: null as ActiveModal | null,
    viewOnCloseCallback: null as ModalCloseCallback | null,
  };
}

// Local references for convenience
const reconcileListeners: ReconcileListener[] = G.__forgeSim.reconcileListeners;

export function onReconcile(listener: ReconcileListener): () => void {
  reconcileListeners.push(listener);
  // Replay the last ForgeDoc immediately if we already have one
  // This handles the case where ForgeReconciler.render() fires before
  // the React DOM shell mounts and registers its listener
  if (G.__forgeSim.lastForgeDoc) {
    try { listener(G.__forgeSim.lastForgeDoc); } catch {}
  }
  return () => {
    const idx = reconcileListeners.indexOf(listener);
    if (idx >= 0) reconcileListeners.splice(idx, 1);
  };
}

function ensureConnection(): Promise<void> {
  const S = G.__forgeSim;
  if (S.ws && S.wsReady) return Promise.resolve();

  return new Promise((resolve, reject) => {
    if (S.ws && S.ws.readyState === WebSocket.CONNECTING) {
      S.ws.addEventListener('open', () => resolve(), { once: true });
      return;
    }

    S.ws = new WebSocket(S.wsUrl);

    S.ws.onopen = () => {
      S.wsReady = true;
      console.log('[forge-bridge-shim] Connected to forge-sim');
      resolve();
    };

    S.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.requestId && S.pendingRequests.has(msg.requestId)) {
          const pending = S.pendingRequests.get(msg.requestId)!;
          S.pendingRequests.delete(msg.requestId);
          if (msg.error) {
            pending.reject(new Error(msg.error));
          } else {
            pending.resolve(msg.result);
          }
        }
      } catch (err) {
        console.error('[forge-bridge-shim] Failed to parse message:', err);
      }
    };

    S.ws.onclose = () => {
      S.wsReady = false;
      console.log('[forge-bridge-shim] Disconnected, will reconnect...');
      for (const [id, pending] of S.pendingRequests) {
        pending.reject(new Error('WebSocket disconnected'));
        S.pendingRequests.delete(id);
      }
      setTimeout(() => ensureConnection(), 2000);
    };

    S.ws.onerror = () => {
      S.wsReady = false;
      reject(new Error('WebSocket connection failed'));
    };
  });
}

/** Send a request to forge-sim and wait for the response */
async function rpc(method: string, params: any = {}): Promise<any> {
  await ensureConnection();

  const S = G.__forgeSim;
  const requestId = `rpc-${++S.requestCounter}-${Date.now()}`;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      S.pendingRequests.delete(requestId);
      reject(new Error(`RPC timeout: ${method}`));
    }, 30000);

    S.pendingRequests.set(requestId, {
      resolve: (v: any) => { clearTimeout(timeout); resolve(v); },
      reject: (e: any) => { clearTimeout(timeout); reject(e); },
    });

    S.ws!.send(JSON.stringify({ type: 'rpc', requestId, method, params }));
  });
}

// ── URL-based context extraction ────────────────────────────────────────

/**
 * Extract the module key from the current URL path.
 * Pattern: /module/<key>/...
 */
function getModuleKeyFromURL(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const match = window.location.pathname.match(/^\/module\/([^/]+)/);
  return match?.[1];
}

/**
 * Extract context options from URL query params.
 * Supports:
 *   ?issueKey=TEST-1
 *   ?contentId=12345
 *   ?spaceKey=DEV
 *   ?context=<base64-encoded JSON>
 */
function getContextFromURL(): Record<string, any> | undefined {
  if (typeof window === 'undefined') return undefined;
  const params = new URLSearchParams(window.location.search);

  const result: Record<string, any> = {};
  let hasAny = false;

  const issueKey = params.get('issueKey');
  if (issueKey) { result.issueKey = issueKey; hasAny = true; }

  const contentId = params.get('contentId');
  if (contentId) { result.contentId = contentId; hasAny = true; }

  const spaceKey = params.get('spaceKey');
  if (spaceKey) { result.spaceKey = spaceKey; hasAny = true; }

  const contextB64 = params.get('context');
  if (contextB64) {
    try {
      const decoded = JSON.parse(atob(contextB64));
      Object.assign(result, decoded);
      hasAny = true;
    } catch {
      console.warn('[forge-bridge-shim] Failed to decode ?context param');
    }
  }

  return hasAny ? result : undefined;
}

// ── Configure ───────────────────────────────────────────────────────────

/** Set the WebSocket URL for the forge-sim backend */
export function configure(opts: { wsUrl?: string }) {
  if (opts.wsUrl) G.__forgeSim.wsUrl = opts.wsUrl;
}

// ── Modal helpers ────────────────────────────────────────────────────────

const MODAL_SIZES: Record<string, number> = {
  small: 400,
  medium: 600,
  large: 800,
  'x-large': 968,
};

export function isInModal(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window === window.parent) return false;
  } catch {
    // cross-origin — assume modal
    return true;
  }
  const params = new URLSearchParams(window.location.search);
  return params.get('_modal') === 'true';
}

export function buildModalIframeURL(resource: string, context?: any): string {
  let url = `/module/${encodeURIComponent(resource)}/?_modal=true`;
  if (context != null) {
    const b64 = btoa(JSON.stringify(context));
    url += `&context=${encodeURIComponent(b64)}`;
  }
  return url;
}

function closeActiveModal(payload?: any) {
  const S = G.__forgeSim;
  const modal = S.activeModal as ActiveModal | null;
  if (!modal) return;

  window.removeEventListener('message', modal.messageHandler);
  document.removeEventListener('keydown', modal.escapeHandler);
  modal.overlay.remove();
  S.activeModal = null;

  if (modal.onClose) {
    try { modal.onClose(payload); } catch {}
  }
  modal.resolve(payload);
}

function openModalOverlay(data: any): Promise<any> {
  const S = G.__forgeSim;

  // Close existing modal if one is open
  if (S.activeModal) closeActiveModal();

  const size = MODAL_SIZES[data?.size] || MODAL_SIZES.medium;
  const closeOnOverlayClick = data?.closeOnOverlayClick !== false;
  const closeOnEscape = data?.closeOnEscape !== false;

  // Create overlay
  const overlay = document.createElement('div');
  overlay.setAttribute('data-testid', 'forge-sim-modal-overlay');
  Object.assign(overlay.style, {
    position: 'fixed', top: '0', left: '0', right: '0', bottom: '0',
    backgroundColor: 'rgba(9, 30, 66, 0.54)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: '1000',
  });

  // Create dialog
  const dialog = document.createElement('div');
  dialog.setAttribute('data-testid', 'forge-sim-modal-dialog');
  dialog.setAttribute('role', 'dialog');
  Object.assign(dialog.style, {
    backgroundColor: '#fff', borderRadius: '3px',
    boxShadow: '0 0 0 1px rgba(9,30,66,0.08), 0 2px 1px rgba(9,30,66,0.08), 0 0 20px -6px rgba(9,30,66,0.31)',
    width: `${size}px`, maxHeight: '90vh',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  });

  // Optional title bar
  if (data?.title) {
    const titleBar = document.createElement('div');
    Object.assign(titleBar.style, {
      padding: '16px 20px', borderBottom: '1px solid #ebecf0',
      fontSize: '20px', fontWeight: '500',
    });
    titleBar.textContent = data.title;
    dialog.appendChild(titleBar);
  }

  // Create iframe
  const iframe = document.createElement('iframe');
  iframe.setAttribute('data-testid', 'forge-sim-modal-iframe');
  iframe.src = buildModalIframeURL(data?.resource, data?.context);
  Object.assign(iframe.style, {
    width: '100%', flex: '1', border: 'none', minHeight: '200px',
  });
  dialog.appendChild(iframe);
  overlay.appendChild(dialog);

  return new Promise((resolve) => {
    // Message handler for submit/close from modal iframe
    const messageHandler = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === 'forge-sim-modal-submit' || e.data.type === 'forge-sim-modal-close') {
        closeActiveModal(e.data.payload);
      }
    };

    // Escape key handler
    const escapeHandler = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        closeActiveModal();
      }
    };

    // Overlay click handler
    if (closeOnOverlayClick) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeActiveModal();
      });
    }

    window.addEventListener('message', messageHandler);
    document.addEventListener('keydown', escapeHandler);

    S.activeModal = {
      overlay, dialog, iframe, messageHandler, escapeHandler, resolve,
      onClose: data?.onClose,
    } satisfies ActiveModal;

    document.body.appendChild(overlay);
  });
}

// ── callBridge (used internally by @forge/react reconciler) ─────────────

/**
 * The bridge dispatch function. @forge/react calls this via
 * globalThis.__bridge.callBridge() for reconcile, invoke, etc.
 *
 * - reconcile: handled locally (stays in browser)
 * - invoke: routed to forge-sim backend
 * - fetchProduct: routed to forge-sim backend
 * - getContext: routed to forge-sim backend
 */
async function callBridge(cmd: string, data?: any): Promise<any> {
  switch (cmd) {
    case 'reconcile':
      // ForgeDoc stays in the browser — notify local listeners
      if (data?.forgeDoc) {
        G.__forgeSim.lastForgeDoc = data.forgeDoc;
        for (const listener of reconcileListeners) {
          try { listener(data.forgeDoc); } catch {}
        }
      }
      return;

    case 'invoke':
      // Route to forge-sim backend
      return rpc('invoke', {
        functionKey: data?.functionKey,
        payload: data?.payload,
      });

    case 'fetchProduct':
      // Route to forge-sim backend
      return rpc('fetchProduct', {
        product: data?.product,
        restPath: data?.restPath,
        fetchRequestInit: data?.fetchRequestInit,
      });

    case 'getContext':
      return rpc('getContext', {
        moduleKey: getModuleKeyFromURL(),
        contextOptions: getContextFromURL(),
      });

    case 'openModal':
      return openModalOverlay(data);

    case 'submit':
      if (isInModal()) {
        window.parent.postMessage({ type: 'forge-sim-modal-submit', payload: data?.payload ?? data }, '*');
        return;
      }
      return rpc('viewSubmit', { payload: data?.payload ?? data });

    case 'close':
      if (isInModal()) {
        window.parent.postMessage({ type: 'forge-sim-modal-close', payload: data?.payload ?? data }, '*');
        return;
      }
      return rpc('viewClose', { payload: data?.payload ?? data });

    case 'onClose': {
      const S = G.__forgeSim;
      S.viewOnCloseCallback = data;
      return;
    }

    case 'onError':
      console.error('[forge-bridge-shim] App error:', data?.error);
      return;

    default:
      console.warn(`[forge-bridge-shim] Unhandled bridge command: "${cmd}"`);
      return;
  }
}

// ── Install on globalThis ───────────────────────────────────────────────

/**
 * Install the bridge shim on globalThis so @forge/react finds it.
 * Call this before importing any @forge/react code.
 */
export function installBridgeShim() {
  const bridge = { callBridge };
  (globalThis as any).__bridge = bridge;
  if (typeof (globalThis as any).window !== 'undefined') {
    (globalThis as any).window.__bridge = bridge;
  }
}

// Auto-install on import
installBridgeShim();

// ── @forge/bridge public API ────────────────────────────────────────────
// These match the real @forge/bridge exports so this file works as a drop-in

export async function invoke<T = any>(functionKey: string, payload?: Record<string, any>): Promise<T> {
  return rpc('invoke', { functionKey, payload });
}

export function makeInvoke() {
  return invoke;
}

export const view = {
  getContext: () => rpc('getContext', {
    moduleKey: getModuleKeyFromURL(),
    contextOptions: getContextFromURL(),
  }),
  submit: (payload?: any) => callBridge('submit', { payload }),
  close: (payload?: any) => callBridge('close', { payload }),
  onClose: (cb: () => Promise<void>) => { callBridge('onClose', cb); return Promise.resolve(); },
  open: () => Promise.resolve(),
  refresh: (payload?: any) => rpc('viewRefresh', { payload }),
  createHistory: () => Promise.reject(new Error('createHistory not supported in forge-sim')),
  theme: {
    enable: () => Promise.resolve(),
  },
  changeWindowTitle: (title: string) => {
    document.title = title;
    return Promise.resolve();
  },
  emitReadyEvent: () => Promise.resolve(),
  createAdfRendererIframeProps: () => Promise.reject(new Error('ADF renderer not supported in forge-sim')),
};

/** Product fetch API — routes through forge-sim's product API mocks */
function makeProductFetch(product: string) {
  return async (restPath: string, fetchOptions?: RequestInit): Promise<Response> => {
    const result = await rpc('fetchProduct', {
      product,
      restPath,
      fetchRequestInit: fetchOptions ? {
        method: fetchOptions.method,
        headers: fetchOptions.headers,
        body: fetchOptions.body,
      } : undefined,
    });

    return new Response(result.body, {
      status: result.status,
      statusText: result.statusText,
      headers: result.headers,
    });
  };
}

export const requestJira = makeProductFetch('jira');
export const requestConfluence = makeProductFetch('confluence');
export const requestBitbucket = makeProductFetch('bitbucket');

/** Remote fetch — for external API calls via Forge's remote module */
export async function requestRemote(remoteKey: string, fetchOptions?: RequestInit & { path?: string }): Promise<Response> {
  const result = await rpc('fetchRemote', {
    remoteKey,
    path: fetchOptions?.path,
    fetchRequestInit: fetchOptions ? {
      method: fetchOptions.method,
      headers: fetchOptions.headers,
      body: fetchOptions.body,
    } : undefined,
  });
  return new Response(result.body, {
    status: result.status,
    statusText: result.statusText,
    headers: result.headers,
  });
}

/** Modal API */
export const Modal = class {
  private opts: any;
  constructor(opts?: any) { this.opts = opts || {}; }
  open() { return callBridge('openModal', this.opts); }
  close(payload?: any) { closeActiveModal(payload); return Promise.resolve(); }
  onClose(cb: () => void) { this.opts.onClose = cb; return Promise.resolve(); }
};

/** Flag API */
export const Flag = class {
  private opts: any;
  constructor(opts?: any) { this.opts = opts; }
  show() { return rpc('flagShow', this.opts); }
};

/** Router */
export const router = {
  open: (url: string) => { window.open(url, '_blank'); return Promise.resolve(); },
  navigate: (url: string) => { window.location.href = url; return Promise.resolve(); },
  reload: () => { window.location.reload(); return Promise.resolve(); },
};

export const NavigationTarget = {
  url: (url: string) => url,
  module: (key: string) => key,
};

/** Events API (pub/sub) */
export const events = {
  on: (_event: string, _cb: Function) => ({ unsubscribe: () => {} }),
  emit: (event: string, payload?: any) => rpc('eventEmit', { event, payload }),
};

/** Permissions */
export const permissions = {
  request: (scopes: string[]) => rpc('permissionsRequest', { scopes }),
};

/** i18n */
export const i18n = {
  getText: (key: string) => Promise.resolve(key),
};

/** Feature flags (stub) */
export const featureFlags = {
  checkBooleanFlag: (_flag: string) => Promise.resolve(false),
  checkStringFlag: (_flag: string) => Promise.resolve(''),
};
