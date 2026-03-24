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

        // (forgeEvent relay moved to postMessage — see window message listener below)

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
      // Endpoint invocations: invokeRemote → 'ui-remote-fetch', invokeService → 'ui-container-fetch'
      if (data?.invokeType?.startsWith('ui-') && data.invokeType.endsWith('-fetch')) {
        return rpc('invokeRemote', {
          path: data.path,
          method: data.method,
          headers: data.headers,
          body: data.body,
          moduleKey: getModuleKeyFromURL(),
        });
      }
      // Route to forge-sim backend
      return rpc('invoke', {
        functionKey: data?.functionKey,
        payload: data?.payload,
        moduleKey: getModuleKeyFromURL(),
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
  refresh: (_payload?: any) => {
    // Trigger a page reload to re-render the module
    if (typeof window !== 'undefined') window.location.reload();
    return Promise.resolve();
  },
  createHistory: () => Promise.reject(new Error('createHistory not supported in forge-sim')),
  theme: {
    enable: () => {
      // Apply dark mode tokens by setting the Atlaskit theme attribute
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-color-mode', 'dark');
      }
      return Promise.resolve();
    },
  },
  changeWindowTitle: (title: string) => {
    if (typeof document !== 'undefined') document.title = title;
    return Promise.resolve();
  },
  emitReadyEvent: () => {
    // Dispatch a custom event that the shell can listen for
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('forge-sim:ready'));
    }
    return Promise.resolve();
  },
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

// ── showFlag — browser toast notifications ──────────────────────────────

const FLAG_COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  info:    { bg: '#DEEBFF', border: '#0052CC', icon: 'ℹ️' },
  success: { bg: '#E3FCEF', border: '#00875A', icon: '✅' },
  warning: { bg: '#FFFAE6', border: '#FF8B00', icon: '⚠️' },
  error:   { bg: '#FFEBE6', border: '#DE350B', icon: '❌' },
};

let flagContainer: HTMLElement | null = null;

function ensureFlagContainer(): HTMLElement {
  if (flagContainer && document.body.contains(flagContainer)) return flagContainer;
  flagContainer = document.createElement('div');
  flagContainer.setAttribute('data-testid', 'forge-sim-flag-container');
  Object.assign(flagContainer.style, {
    position: 'fixed', bottom: '24px', left: '24px',
    display: 'flex', flexDirection: 'column-reverse', gap: '8px',
    zIndex: '1100', maxWidth: '400px',
  });
  document.body.appendChild(flagContainer);
  return flagContainer;
}

export function showFlag(options: {
  id?: number | string;
  title?: string;
  description?: string;
  type?: string;
  appearance?: string;
  actions?: Array<{ text: string; onClick?: () => void }>;
  isAutoDismiss?: boolean;
}): { close: () => Promise<boolean | void> } {
  const type = options.appearance ?? options.type ?? 'info';
  const colors = FLAG_COLORS[type] || FLAG_COLORS.info;

  const container = ensureFlagContainer();
  const flag = document.createElement('div');
  flag.setAttribute('data-testid', 'forge-sim-flag');
  Object.assign(flag.style, {
    background: colors.bg, borderLeft: `3px solid ${colors.border}`,
    borderRadius: '4px', padding: '12px 16px',
    boxShadow: '0 1px 1px rgba(9,30,66,0.25), 0 0 1px rgba(9,30,66,0.31)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '14px', color: '#172B4D',
    animation: 'forge-sim-flag-in 0.2s ease-out',
    transition: 'opacity 0.2s, transform 0.2s',
  });

  // Title
  if (options.title) {
    const title = document.createElement('div');
    title.style.fontWeight = '600';
    title.textContent = `${colors.icon} ${options.title}`;
    flag.appendChild(title);
  }

  // Description
  if (options.description) {
    const desc = document.createElement('div');
    desc.style.marginTop = '4px';
    desc.style.color = '#6B778C';
    desc.textContent = options.description;
    flag.appendChild(desc);
  }

  // Actions
  if (options.actions?.length) {
    const actions = document.createElement('div');
    actions.style.marginTop = '8px';
    actions.style.display = 'flex';
    actions.style.gap = '8px';
    for (const action of options.actions) {
      const btn = document.createElement('button');
      Object.assign(btn.style, {
        background: 'none', border: 'none', color: colors.border,
        cursor: 'pointer', fontWeight: '600', fontSize: '13px', padding: '0',
      });
      btn.textContent = action.text;
      if (action.onClick) btn.addEventListener('click', action.onClick);
      actions.appendChild(btn);
    }
    flag.appendChild(actions);
  }

  container.appendChild(flag);

  const close = () => {
    flag.style.opacity = '0';
    flag.style.transform = 'translateX(-20px)';
    setTimeout(() => flag.remove(), 200);
    return Promise.resolve();
  };

  // Auto-dismiss after 5s unless explicitly disabled
  if (options.isAutoDismiss !== false) {
    setTimeout(close, 5000);
  }

  return { close };
}

// ── Router — product navigation ─────────────────────────────────────────

export const NavigationTarget = {
  ContentView: 'contentView' as const,
  ContentEdit: 'contentEdit' as const,
  ContentList: 'contentList' as const,
  SpaceView: 'spaceView' as const,
  Module: 'module' as const,
  UserProfile: 'userProfile' as const,
  Dashboard: 'dashboard' as const,
  Issue: 'issue' as const,
  ProjectSettingsDetails: 'projectSettingsDetails' as const,
};

type NavigationLocation = { target: string; [key: string]: any };

function resolveNavigationUrl(location: string | NavigationLocation): string {
  if (typeof location === 'string') return location;

  // Build product URLs from navigation targets
  switch (location.target) {
    case NavigationTarget.Issue:
      return `/browse/${location.issueKey}`;
    case NavigationTarget.ContentView:
      return `/wiki/pages/${location.contentId}`;
    case NavigationTarget.ContentEdit:
      return `/wiki/pages/edit-v2/${location.contentId}`;
    case NavigationTarget.SpaceView:
      return `/wiki/spaces/${location.spaceKey}`;
    case NavigationTarget.Dashboard:
      return `/jira/dashboards/${location.dashboardId}`;
    case NavigationTarget.UserProfile:
      return `/people/${location.accountId}`;
    case NavigationTarget.Module:
      return `/module/${location.moduleKey}/`;
    case NavigationTarget.ContentList:
      return `/wiki/spaces/${location.spaceKey}/pages`;
    case NavigationTarget.ProjectSettingsDetails:
      return `/jira/software/projects/${location.projectKey}/settings`;
    default:
      return '/';
  }
}

export const router = {
  navigate: (location: string | NavigationLocation): Promise<void> => {
    const url = resolveNavigationUrl(location);
    if (typeof window !== 'undefined') window.location.href = url;
    return Promise.resolve();
  },
  open: (location: string | NavigationLocation): Promise<void> => {
    const url = resolveNavigationUrl(location);
    if (typeof window !== 'undefined') window.open(url, '_blank');
    return Promise.resolve();
  },
  getUrl: (location: string | NavigationLocation): Promise<URL | null> => {
    try {
      const url = resolveNavigationUrl(location);
      const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
      return Promise.resolve(new URL(url, base));
    } catch {
      return Promise.resolve(null);
    }
  },
  reload: (): Promise<void> => {
    if (typeof window !== 'undefined') window.location.reload();
    return Promise.resolve();
  },
};

// ── Events — cross-module pub/sub ───────────────────────────────────────

const eventListeners = new Map<string, Set<(payload?: any) => any>>();

export const events = {
  async emit(event: string, payload?: any): Promise<void> {
    // Dispatch locally
    const listeners = eventListeners.get(event);
    if (listeners) {
      for (const cb of listeners) {
        try { cb(payload); } catch (e) { console.error('[forge-bridge-shim] Event handler error:', e); }
      }
    }
    // Post to parent for cross-module relay (parent page brokers between iframes)
    if (typeof window !== 'undefined' && window.parent) {
      window.parent.postMessage({ type: 'forgeEvent', eventName: event, payload, isPublic: false }, '*');
    }
  },

  async on(event: string, callback: (payload?: any) => any): Promise<{ unsubscribe: () => void }> {
    if (!eventListeners.has(event)) eventListeners.set(event, new Set());
    eventListeners.get(event)!.add(callback);
    return { unsubscribe: () => eventListeners.get(event)?.delete(callback) };
  },

  async emitPublic(event: string, payload?: any): Promise<void> {
    // Dispatch locally with public prefix
    const listeners = eventListeners.get(`public:${event}`);
    if (listeners) {
      for (const cb of listeners) {
        try { cb(payload); } catch (e) { console.error('[forge-bridge-shim] Event handler error:', e); }
      }
    }
    // Post to parent for cross-module relay
    if (typeof window !== 'undefined' && window.parent) {
      window.parent.postMessage({ type: 'forgeEvent', eventName: event, payload, isPublic: true }, '*');
    }
  },

  async onPublic(event: string, callback: (payload?: any) => any): Promise<{ unsubscribe: () => void }> {
    return events.on(`public:${event}`, callback);
  },
};

// ── Forge events relay via postMessage (parent page brokers between frames) ──
if (typeof window !== 'undefined') {
  window.addEventListener('message', (e: MessageEvent) => {
    if (!e.data || e.data.type !== 'forgeEvent') return;
    // Only dispatch events from OTHER windows (the broker or sibling frames)
    if (e.source === window) return;
    const eventKey = e.data.isPublic ? `public:${e.data.eventName}` : e.data.eventName;
    const listeners = eventListeners.get(eventKey);
    if (listeners) {
      for (const cb of listeners) {
        try { cb(e.data.payload); } catch (err) { console.error('[forge-bridge-shim] Event handler error:', err); }
      }
    }
  });
}

// ── Permissions ─────────────────────────────────────────────────────────

export const permissions = {
  check: (): Promise<{ hasPermission: boolean }> => Promise.resolve({ hasPermission: true }),
  request: (scopes: string[]): Promise<{ granted: boolean }> => {
    console.log('[forge-bridge-shim] permissions.request:', scopes);
    return Promise.resolve({ granted: true });
  },
};

// ── i18n (bridge-level) ─────────────────────────────────────────────────

export const i18n = {
  getLocale: (): Promise<string> => {
    if (typeof navigator !== 'undefined') return Promise.resolve(navigator.language);
    return Promise.resolve('en-US');
  },
  getTranslations: (locale?: string, options?: any) => rpc('getContext').then((ctx: any) => {
    return rpc('i18nGetTranslations', { locale: locale ?? ctx.locale, options });
  }).catch(() => ({ locale: locale ?? 'en-US', translations: null })),
  createTranslationFunction: (locale?: string) => rpc('getContext').then((ctx: any) => {
    return rpc('i18nCreateTranslationFunction', { locale: locale ?? ctx.locale });
  }).catch(() => ((key: string, defaultValue?: string) => defaultValue ?? key)),
  resetTranslationsCache: (): void => {
    rpc('i18nResetTranslationsCache', {}).catch(() => {});
  },
};

// ── Feature flags (stub) ────────────────────────────────────────────────

export const featureFlags = {
  evaluate: (_flag: string, _defaultValue?: any): Promise<any> => Promise.resolve(undefined),
  checkBooleanFlag: (_flag: string): Promise<boolean> => Promise.resolve(false),
  checkStringFlag: (_flag: string): Promise<string> => Promise.resolve(''),
};
