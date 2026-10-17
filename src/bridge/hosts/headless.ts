/**
 * Headless BridgeHost — answers `window.__bridge` in process, against a
 * ForgeSimulator, for the test API and the MCP server.
 *
 * Transport: direct `sim.*` calls. Environment: no window, no DOM. Surface
 * commands (flags, navigation, theming) resolve inertly; the two that cannot
 * be meaningfully faked — a modal needs a window to draw into — throw with a
 * reason. Every call still reaches the dispatcher's `onCall` recorder, so a
 * test can assert that the app asked.
 *
 * State that belongs to the render lifecycle (ForgeDoc capture and waiters,
 * the forge context, history) stays in `src/ui/bridge.ts` and is supplied
 * here as dependencies; this file owns everything that touches the simulator.
 */

import type { ForgeSimulator } from '../../simulator.js';
import { emitViewEvent } from '../../shims/forge-bridge.js';
import type {
  BridgeHost,
  BridgeFetchResponse,
  BridgeNavigationLocation,
  BridgeRequestInit,
  BridgeSubscription,
} from '../protocol/index.js';

export interface HeadlessHostDeps {
  getSimulator(): ForgeSimulator | null;
  /** True after resetBridge(): stale effects from unmounted React trees must not reach the sim. */
  isTornDown(): boolean;
  /** ForgeDoc capture + waiter resolution (owned by src/ui/bridge.ts). */
  reconcile(forgeDoc: unknown, kind: 'view' | 'macroConfig'): Promise<void>;
  /** The context view.getContext() / useProductContext() report. */
  getContext(): Promise<unknown>;
  /** The placement `extension` used to scope realtime channels, if a context is set. */
  getContextExtension(): Record<string, unknown> | null;
  /** In-memory / WS-proxied history (owned by src/ui/bridge.ts). */
  createHistory(): Promise<unknown>;
  /** Surface a "no resolver defined" invoke so waitForContent can hint at it. */
  recordMissingResolver(err: Error): void;
}

export interface HeadlessHost extends BridgeHost {
  /** Drop same-frame event subscriptions between renders. */
  reset(): void;
}

const NEVER = new Promise<never>(() => {});

/** The simulator's "this key isn't registered" error, raised before any app code ran. */
function isMissingResolverError(err: unknown): boolean {
  const msg = (err as { message?: unknown })?.message;
  return typeof msg === 'string' && /^No resolver defined for "/.test(msg);
}

function noSimulator(): never {
  throw new Error('forge-sim bridge: No simulator connected. Call connectSimulator() first.');
}

async function toFetchResponse(response: {
  status: number; statusText: string; headers: Record<string, string>; text(): Promise<string>;
}): Promise<BridgeFetchResponse> {
  return {
    status: response.status,
    statusText: response.statusText,
    body: await response.text(),
    headers: response.headers,
    isAttachment: false,
  };
}

export function createHeadlessHost(deps: HeadlessHostDeps): HeadlessHost {
  const sim = () => deps.getSimulator() ?? noSimulator();

  /**
   * The module the current frontend work belongs to: an explicit test knob
   * wins, then the module most recently rendered headlessly.
   */
  const activeModuleKey = (): string | undefined => {
    const s = deps.getSimulator();
    return s?.currentModuleKey ?? s?.ui?.getActiveModule?.() ?? undefined;
  };

  /**
   * Same-frame listener registry for events.on / onPublic. Headless there are
   * no sibling frames to relay between, but a subscription inside one render
   * is real: emitEvent dispatches to it, so an app that talks to itself
   * through the events API behaves as it would in a browser.
   */
  const eventListeners = new Map<string, Set<(payload?: unknown) => unknown>>();
  const eventKey = (event: string, isPublic: boolean) => (isPublic ? `public:${event}` : event);

  return {
    reset() {
      eventListeners.clear();
    },

    // ── Reconciler ─────────────────────────────────────────────────────
    reconcile: (doc, kind) => deps.reconcile(doc, kind),
    async onError(error) {
      console.error('[forge-sim bridge] App error:', error);
    },

    // ── Resolver + HTTP ────────────────────────────────────────────────
    async invoke(functionKey, payload) {
      // After teardown, a stale invoke from an unmounted React effect must
      // not reach the sim; nobody is listening, so leave it pending.
      if (deps.isTornDown()) return NEVER;
      const s = sim();
      try {
        return await s.invoke(functionKey, payload as any);
      } catch (err) {
        // A resolver that does not exist is a sim/deploy configuration
        // failure the app never guards (`invoke(...).then(setState)`).
        // Rejecting would be an unhandled rejection that takes down the test
        // runner. A browser logs it and the UI stays on its loading state;
        // reproduce that: record it for waitForContent's hint, stay pending.
        if (isMissingResolverError(err)) {
          const e = err instanceof Error ? err : new Error(String(err));
          deps.recordMissingResolver(e);
          console.error(`[forge-sim] UI invoke("${functionKey}") failed: ${e.message}`);
          return NEVER;
        }
        throw err;
      }
    },

    async invokeRemote(path, init) {
      const s = sim();
      const moduleKey = activeModuleKey();
      const endpointKey = s.resolveModuleEndpoint(moduleKey);
      const moduleType = moduleKey ? s.getModuleType(moduleKey) : undefined;
      return s.remotes.invokeFromBridge({
        path,
        method: init.method,
        headers: init.headers,
        body: init.body,
        endpointKey,
        moduleKey,
        moduleType,
      } as any);
    },

    async fetchProduct(product, restPath, init: BridgeRequestInit) {
      return toFetchResponse(await sim().productApi.request(product, restPath, {
        method: init.method,
        headers: init.headers,
        body: init.body,
      } as any));
    },

    async fetchRemote(remoteKey, path, init) {
      return toFetchResponse(await sim().remotes.request(remoteKey, {
        path: path ?? '/',
        method: init.method,
        headers: init.headers,
        body: init.body,
      } as any));
    },

    // ── View ───────────────────────────────────────────────────────────
    getContext: () => deps.getContext(),
    // Headless, the host product is the test: view.submit/close/refresh feed
    // the same stream sim.ui.onSubmit/onClose/onRefresh listen to, so a
    // bundle running the REAL @forge/bridge is observable exactly like a
    // source-mode app using the Node shim.
    async submit(payload) { emitViewEvent('submit', payload); return true; },
    async close(payload) { emitViewEvent('close', payload); return true; },
    async refresh(payload) { emitViewEvent('refresh', payload); return true; },
    async open() { return true; },
    async onClose() { /* no host-driven close in a headless render */ },
    createHistory: () => deps.createHistory(),
    async enableTheming() {},
    async changeWindowTitle() {},
    async emitReadyEvent() {},

    // ── Router ─────────────────────────────────────────────────────────
    async navigate() {},
    async getUrl(location: BridgeNavigationLocation) {
      // No site to resolve against headless; echo a string url so the real
      // package's `new URL()` has something well-formed to parse.
      if (typeof location === 'string') return location;
      const url = (location as Record<string, unknown>).url;
      return typeof url === 'string' ? url : null;
    },
    async reload() {},

    // ── Flags / modal ──────────────────────────────────────────────────
    async showFlag() {},
    async closeFlag() {},
    async openModal() {
      throw new Error(
        '[forge-sim] Modal.open() needs a host to draw the modal — there is no ' +
          'window in a headless render. Use forge-sim dev to exercise modals, or ' +
          'render the modal module directly by its own module key.',
      );
    },

    // ── Cross-module events ────────────────────────────────────────────
    async emitEvent(event, payload, isPublic) {
      const subs = eventListeners.get(eventKey(event, isPublic));
      if (!subs) return;
      for (const cb of subs) {
        try { await cb(payload); } catch (err) {
          console.error('[forge-sim bridge] Event handler error:', err);
        }
      }
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
    async publishRealtime(channel, payload, options, global) {
      const s = sim();
      if (global) return s.realtime.publishGlobalFromBridge(channel, payload as any, options as any);
      return s.realtime.publishFromBridge(
        channel,
        payload as any,
        activeModuleKey() ?? null,
        options as any,
        deps.getContextExtension(),
      );
    },
    async subscribeRealtime(channel, onEvent, options, global) {
      const s = sim();
      // sim.realtime.subscribe/subscribeGlobal ARE the bridge-side API: they
      // throw on a bad channel/token exactly as the docs require, which
      // surfaces as the rejected Promise the app sees.
      if (global) return s.realtime.subscribeGlobal(channel, onEvent as any, options as any);
      // Same placement data view.getContext() reports, so a UI subscribe and
      // a backend publish derive the same scoped channel key.
      return s.realtime.subscribe(
        channel,
        onEvent as any,
        activeModuleKey() ?? null,
        options as any,
        deps.getContextExtension(),
      );
    },

    // ── Telemetry / platform ───────────────────────────────────────────
    async trackObjectStoreAction() {},
    async getFrameId() { return 'forge-sim-frame-headless'; },
    async initFeatureFlags() {},
    async isRovoEnabled() { return false; },
    async emitFrontendCustomMetric() {},
  };
}
