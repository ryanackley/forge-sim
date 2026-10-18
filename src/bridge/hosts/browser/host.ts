/**
 * Browser BridgeHost — answers `window.__bridge` inside an app iframe served
 * by `forge-sim dev`, for Custom UI and UI Kit alike.
 *
 * Transport: WebSocket RPC to the dev server. Environment: a real DOM, so
 * flags, history and navigation are drawn/performed here rather than being
 * inert as they are headless.
 *
 * Two server-pushed streams are consumed:
 *  - `realtime` events, filtered by the channel key the SERVER assigned when
 *    the app subscribed (see subscribeRealtime — the key algorithm stays on
 *    the server so this bundle needs no part of it).
 *  - cross-frame `forgeEvent` relays, which arrive by postMessage from the
 *    parent page rather than the socket.
 */

import type {
  BridgeFetchResponse,
  BridgeHost,
  BridgeNavigationLocation,
  BridgeRequestInit,
  BridgeSubscription,
} from '../../protocol/index.js';
import type { Transport } from './transport.js';
import { createFlagSurface } from './flags.js';
import { createBrowserHistory, createMemoryHistory } from './history.js';
import { createModalSurface } from './modal.js';

export interface BrowserHostOptions {
  transport: Transport;
  /** Module key for this frame (parsed from the page URL). */
  getModuleKey(): string | undefined;
  /** Placement overrides from the page query string, if any. */
  getContextOptions(): unknown;
  /** Called with each ForgeDoc from @forge/react so the shell can render it. */
  onReconcile(doc: unknown, kind: 'view' | 'macroConfig'): void;
  /** Which reconcile tree a submit belongs to (UI Kit macro config). */
  getSubmitTree?(): string | undefined;
  /** True when this frame is itself a modal, so submit/close go to the opener. */
  isInModal?(): boolean;
  /**
   * 'browser' (default): view.createHistory() drives window.history — Custom
   * UI SPAs, whose routes the dev server serves under /module/<key>/.
   * 'memory': in-memory stack — UI Kit pages, where the module key lives in
   * the URL path and must not be navigated away.
   */
  historyMode?: 'browser' | 'memory';
}

function eventKey(event: string, isPublic: boolean): string {
  return isPublic ? `public:${event}` : event;
}

export function createBrowserHost(options: BrowserHostOptions): BridgeHost {
  const { transport, getModuleKey, getContextOptions, onReconcile } = options;
  const flags = createFlagSurface();
  const modals = createModalSurface();

  // channelKey (assigned by the server) → callbacks in this frame.
  const realtimeSubs = new Map<string, Set<(payload?: unknown) => unknown>>();
  transport.onPush((msg) => {
    if (msg?.type !== 'realtime') return;
    const subs = realtimeSubs.get(msg.channelKey);
    if (!subs) return;
    for (const cb of subs) {
      try { cb(msg.payload); } catch (err) { console.error('[forge-sim bridge] realtime callback error:', err); }
    }
  });

  // Cross-module events. The parent page brokers between sibling iframes, so
  // emit goes out by postMessage and arrives the same way.
  const eventListeners = new Map<string, Set<(payload?: unknown) => unknown>>();
  window.addEventListener('message', (e: MessageEvent) => {
    const data: any = e.data;
    if (!data || data.type !== 'forgeEvent') return;
    if (e.source === window) return; // our own emit, already dispatched locally
    const subs = eventListeners.get(eventKey(data.eventName, !!data.isPublic));
    if (!subs) return;
    for (const cb of subs) {
      try { cb(data.payload); } catch (err) { console.error('[forge-sim bridge] event handler error:', err); }
    }
  });

  /**
   * Map a NavigationLocation to a product path, same table the UI Kit shim
   * used. Done in the frame rather than over RPC: these are static route
   * shapes, and router.getUrl must stay synchronous-ish for the real
   * package, which immediately runs `new URL()` on what we return.
   */
  const resolveUrl = (location: BridgeNavigationLocation): string | null => {
    if (typeof location === 'string') return location;
    const l = location as Record<string, any>;
    if (typeof l.url === 'string') return l.url;
    switch (l.target) {
      case 'issue': return `/browse/${l.issueKey}`;
      case 'contentView': return `/wiki/pages/${l.contentId}`;
      case 'contentEdit': return `/wiki/pages/edit-v2/${l.contentId}`;
      case 'contentList': return `/wiki/spaces/${l.spaceKey}/pages`;
      case 'spaceView': return `/wiki/spaces/${l.spaceKey}`;
      case 'dashboard': return `/jira/dashboards/${l.dashboardId}`;
      case 'userProfile': return `/people/${l.accountId}`;
      case 'projectSettingsDetails': return `/jira/software/projects/${l.projectKey}/settings`;
      case 'module': return `/module/${l.moduleKey}/`;
      default: return null;
    }
  };

  async function fetchVia(method: string, params: Record<string, unknown>): Promise<BridgeFetchResponse> {
    const r = await transport.rpc(method, params);
    return {
      status: r.status,
      statusText: r.statusText,
      body: r.body,
      headers: r.headers ?? {},
      isAttachment: !!r.isAttachment,
    };
  }

  return {
    // ── Reconciler ─────────────────────────────────────────────────────
    async reconcile(forgeDoc, kind) { onReconcile(forgeDoc, kind); },
    async onError(error) { console.error('[forge-sim bridge] App error:', error); },

    // ── Resolver + HTTP ────────────────────────────────────────────────
    invoke: (functionKey, payload) => transport.rpc('invoke', {
      functionKey, payload, moduleKey: getModuleKey(), contextOptions: getContextOptions(),
    }),
    invokeRemote: (path, init: BridgeRequestInit) => transport.rpc('invokeRemote', {
      path, method: init.method, headers: init.headers, body: init.body, moduleKey: getModuleKey(),
    }),
    fetchProduct: (product, restPath, init) => fetchVia('fetchProduct', {
      product, restPath, fetchRequestInit: { method: init.method, headers: init.headers, body: init.body },
    }),
    fetchRemote: (remoteKey, path, init) => fetchVia('fetchRemote', {
      remoteKey, path, fetchRequestInit: { path, method: init.method, headers: init.headers, body: init.body },
    }),

    // ── View ───────────────────────────────────────────────────────────
    getContext: () => transport.rpc('getContext', {
      moduleKey: getModuleKey(), contextOptions: getContextOptions(),
    }),
    async submit(payload) {
      // Inside a modal the opener, not the dev server, owns the result.
      if (options.isInModal?.()) {
        window.parent.postMessage({ type: 'forge-sim-modal-submit', payload }, '*');
        return undefined;
      }
      return transport.rpc('viewSubmit', {
        payload, moduleKey: getModuleKey(), submitTree: options.getSubmitTree?.(),
      });
    },
    async close(payload) {
      if (options.isInModal?.()) {
        window.parent.postMessage({ type: 'forge-sim-modal-close', payload }, '*');
        return undefined;
      }
      return transport.rpc('viewClose', { payload });
    },
    async refresh() { window.location.reload(); },
    async open() { /* view.open() has no host surface in dev */ },
    async onClose() { /* the opener drives close; nothing to register here */ },
    async createHistory() {
      return options.historyMode === 'memory' ? createMemoryHistory() : createBrowserHistory();
    },
    async enableTheming() {
      document.documentElement.setAttribute('data-color-mode', 'dark');
    },
    async changeWindowTitle(title) { if (title) document.title = title; },
    async emitReadyEvent() { window.dispatchEvent(new CustomEvent('forge-sim:ready')); },

    // ── Router ─────────────────────────────────────────────────────────
    async navigate(location, tab) {
      const url = resolveUrl(location);
      if (!url) return;
      if (tab === 'new-tab') window.open(url, '_blank');
      else window.location.href = url;
    },
    async getUrl(location) {
      const url = resolveUrl(location);
      if (url === null) return null;
      // Must be ABSOLUTE: the real package runs `new URL()` on the result.
      try { return new URL(url, window.location.origin).toString(); } catch { return null; }
    },
    async reload() { window.location.reload(); },

    // ── Flags / modal ──────────────────────────────────────────────────
    async showFlag(opts) { flags.show(opts); },
    async closeFlag(id) { return flags.close(id); },
    openModal: (opts) => modals.open(opts),

    // ── Cross-module events ────────────────────────────────────────────
    async emitEvent(event, payload, isPublic) {
      const subs = eventListeners.get(eventKey(event, isPublic));
      if (subs) {
        for (const cb of subs) {
          try { cb(payload); } catch (err) { console.error('[forge-sim bridge] event handler error:', err); }
        }
      }
      window.parent.postMessage({ type: 'forgeEvent', eventName: event, payload, isPublic }, '*');
    },
    async onEvent(event, callback, isPublic): Promise<BridgeSubscription> {
      if (typeof event !== 'string' || typeof callback !== 'function') {
        return { unsubscribe: () => {} };
      }
      const key = eventKey(event, isPublic);
      if (!eventListeners.has(key)) eventListeners.set(key, new Set());
      eventListeners.get(key)!.add(callback);
      return { unsubscribe: () => { eventListeners.get(key)?.delete(callback); } };
    },

    // ── Realtime ───────────────────────────────────────────────────────
    publishRealtime: (channel, payload, opts, global) => transport.rpc('realtimePublish', {
      channel, payload, options: opts, global,
      ...(global ? {} : { moduleKey: getModuleKey(), contextOptions: getContextOptions() }),
    }),
    async subscribeRealtime(channel, onEvent, opts, global): Promise<BridgeSubscription> {
      // The SERVER computes the channel key (same algorithm a backend
      // subscribe uses) and rejects a bad channel/token, so this bundle
      // carries none of that logic and dev/headless key identically.
      const { channelKey } = await transport.rpc('realtimeSubscribe', {
        channel, options: opts, global, moduleKey: getModuleKey(), contextOptions: getContextOptions(),
      });
      if (!realtimeSubs.has(channelKey)) realtimeSubs.set(channelKey, new Set());
      const cb = onEvent as (payload?: unknown) => unknown;
      realtimeSubs.get(channelKey)!.add(cb);
      return { unsubscribe: () => { realtimeSubs.get(channelKey)?.delete(cb); } };
    },

    // ── Telemetry / platform ───────────────────────────────────────────
    async trackObjectStoreAction() {},
    async getFrameId() { return `forge-sim-frame-${getModuleKey() ?? 'unknown'}`; },
    async initFeatureFlags() {},
    async isRovoEnabled() { return false; },
    async emitFrontendCustomMetric() {},
  };
}
