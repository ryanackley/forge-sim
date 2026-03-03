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

// ── WebSocket Connection ────────────────────────────────────────────────

let ws: WebSocket | null = null;
let wsReady = false;
let wsUrl = 'ws://localhost:5174';
const pendingRequests = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void }>();
let requestCounter = 0;

/** Reconcile listeners — stored on globalThis to survive module duplication by Vite */
type ReconcileListener = (forgeDoc: any) => void;

// Vite may create multiple copies of this module (pre-bundled deps vs source).
// Using globalThis ensures all copies share the same listener list and buffer.
const G = globalThis as any;
if (!G.__forgeSim) {
  G.__forgeSim = {
    reconcileListeners: [] as ReconcileListener[],
    lastForgeDoc: null as any,
  };
}
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
  if (ws && wsReady) return Promise.resolve();

  return new Promise((resolve, reject) => {
    if (ws && ws.readyState === WebSocket.CONNECTING) {
      ws.addEventListener('open', () => resolve(), { once: true });
      return;
    }

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      wsReady = true;
      console.log('[forge-bridge-shim] Connected to forge-sim');
      resolve();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.requestId && pendingRequests.has(msg.requestId)) {
          const pending = pendingRequests.get(msg.requestId)!;
          pendingRequests.delete(msg.requestId);
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

    ws.onclose = () => {
      wsReady = false;
      console.log('[forge-bridge-shim] Disconnected, will reconnect...');
      // Reject all pending requests
      for (const [id, pending] of pendingRequests) {
        pending.reject(new Error('WebSocket disconnected'));
        pendingRequests.delete(id);
      }
      // Auto-reconnect after 2s
      setTimeout(() => ensureConnection(), 2000);
    };

    ws.onerror = () => {
      wsReady = false;
      reject(new Error('WebSocket connection failed'));
    };
  });
}

/** Send a request to forge-sim and wait for the response */
async function rpc(method: string, params: any = {}): Promise<any> {
  await ensureConnection();

  const requestId = `rpc-${++requestCounter}-${Date.now()}`;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error(`RPC timeout: ${method}`));
    }, 30000);

    pendingRequests.set(requestId, {
      resolve: (v) => { clearTimeout(timeout); resolve(v); },
      reject: (e) => { clearTimeout(timeout); reject(e); },
    });

    ws!.send(JSON.stringify({ type: 'rpc', requestId, method, params }));
  });
}

// ── Configure ───────────────────────────────────────────────────────────

/** Set the WebSocket URL for the forge-sim backend */
export function configure(opts: { wsUrl?: string }) {
  if (opts.wsUrl) wsUrl = opts.wsUrl;
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
      return rpc('getContext');

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
  getContext: () => rpc('getContext'),
  submit: (payload?: any) => rpc('viewSubmit', { payload }),
  close: (payload?: any) => rpc('viewClose', { payload }),
  onClose: (_cb: () => Promise<void>) => Promise.resolve(),
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
  constructor(opts?: any) { this.opts = opts; }
  open() { return rpc('modalOpen', this.opts); }
  close(payload?: any) { return rpc('modalClose', { payload }); }
  onClose(_cb: () => void) { return Promise.resolve(); }
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
