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
 * the forge context) stays in `src/ui/bridge.ts` and is supplied here as
 * dependencies; this file owns everything that touches the simulator and
 * every headless-specific answer. Nothing in `src/ui/bridge.ts` branches on
 * "which host" — that is what this interface is for.
 */

import type { ForgeSimulator } from '../../simulator.js';
import { emitViewEvent } from '../../ui/view-events.js';
import { createProductBridgeSurfaces } from './product-surfaces.js';
import { resolveNavigationUrl } from './navigation-urls.js';
import { createMemoryHistory } from '../memory-history.js';
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
  /** The placement `extension` of the render's forge context, if one is set. */
  getContextExtension(): Record<string, unknown> | null;
  /**
   * Surface an invoke the sim refused before any app code ran (the module's
   * resolver has no such key, the module has no resolver) so waitForContent
   * can hint at it.
   */
  recordMissingResolver(err: Error): void;
}

export interface HeadlessHost extends BridgeHost {
  /** Drop same-frame event subscriptions between renders. */
  reset(): void;
}

const NEVER = new Promise<never>(() => {});

/**
 * An invoke the simulator refused before any app code ran: the module's
 * resolver function defines no such key, or the module has no resolver
 * (`validateResolverAccess` and `SimulatedResolver.dispatch` in
 * src/simulator.ts and src/resolver.ts are the producers).
 */
function isResolverRoutingError(err: unknown): boolean {
  const msg = (err as { message?: unknown })?.message;
  return (
    typeof msg === 'string' &&
    /^(?:No resolver defined for "|Function ".*" belongs to resolver|Module ".*" (?:is configured with endpoint|has no resolver))/.test(msg)
  );
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
   * Placement data for a frontend realtime call — what scopes the channel
   * key. The explicit test knob wins (`sim.currentExtension`, paired with
   * `currentModuleKey` for direct bridge calls with no render), then the
   * render's forge context, then the rendered module's own context.
   */
  const placementExtension = (moduleKey: string | undefined): Record<string, unknown> | null => {
    const s = deps.getSimulator();
    if (s?.currentExtension) return s.currentExtension;
    const fromRender = deps.getContextExtension();
    if (fromRender) return fromRender;
    if (moduleKey) return (s?.ui?.getContext?.(moduleKey)?.extension as Record<string, unknown> | undefined) ?? null;
    return null;
  };

  /**
   * Bind a realtime subscriber to the module that subscribed. The callback
   * runs later, from a publish on the resolver side, outside any render
   * scope; without this the setState re-render it causes is attributed to
   * whichever module rendered most recently (ForgeDoc filed under the wrong
   * key). Applies to global channels too: no module in the key, but the
   * re-render still belongs to the subscriber.
   */
  const boundToModule = <F extends (...args: any[]) => any>(callback: F, moduleKey: string | undefined): F => {
    const ui = deps.getSimulator()?.ui;
    if (!ui?.runInModuleScope || moduleKey === undefined) return callback;
    return ((...args: any[]) => ui.runInModuleScope(moduleKey, () => callback(...args))) as F;
  };

  /** The simulated site, so getUrl can hand the real package an absolute url. */
  const siteOrigin = (): string => sim().getDefaultContext().siteUrl;

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
        // The platform routes a bridge invoke through the module that owns
        // the frame: that module's `resolver.function`, and nothing else.
        // Name the rendering module, as the browser host names the module
        // in its page URL, so the sim applies the same rule here.
        return await s.invoke(functionKey, payload as any, { moduleKey: activeModuleKey() });
      } catch (err) {
        // A key the module's resolver does not define (or a module with no
        // resolver) is a sim/deploy configuration failure the app never
        // guards (`invoke(...).then(setState)`). Rejecting would be an
        // unhandled rejection that takes down the test runner. A browser
        // logs it and the UI stays on its loading state; reproduce that:
        // record it for waitForContent's hint, stay pending.
        if (isResolverRoutingError(err)) {
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
    // In-memory, one instance per call (the shared implementation the
    // browser host uses for UI Kit pages). Headless there is no URL to move
    // and no browser to proxy to; the WebSocket-proxied history that used to
    // live in src/ui/bridge.ts had no browser-side counterpart any more.
    async createHistory() { return createMemoryHistory(); },
    async enableTheming() {},
    async changeWindowTitle() {},
    async emitReadyEvent() {},

    // ── Router ─────────────────────────────────────────────────────────
    async navigate() {},
    // Shared target table (navigation-urls.ts) against the simulated site:
    // the real package runs `new URL()` on the answer and throws on null.
    async getUrl(location: BridgeNavigationLocation) { return resolveNavigationUrl(location, siteOrigin()); },
    async reload() {},

    // ── Flags / modal ──────────────────────────────────────────────────
    async showFlag() {},
    async closeFlag() { return false; }, // no flag surface headless
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
      const moduleKey = activeModuleKey();
      return s.realtime.publishFromBridge(
        channel,
        payload as any,
        moduleKey ?? null,
        options as any,
        placementExtension(moduleKey),
      );
    },
    async subscribeRealtime(channel, onEvent, options, global) {
      const s = sim();
      const moduleKey = activeModuleKey();
      const callback = boundToModule(onEvent as (payload?: unknown) => unknown, moduleKey);
      // sim.realtime.subscribe/subscribeGlobal ARE the bridge-side API: they
      // throw on a bad channel/token exactly as the docs require, which
      // surfaces as the rejected Promise the app sees.
      if (global) return s.realtime.subscribeGlobal(channel, callback as any, options as any);
      // Same placement data view.getContext() reports, so a UI subscribe and
      // a backend publish derive the same scoped channel key.
      return s.realtime.subscribe(
        channel,
        callback as any,
        moduleKey ?? null,
        options as any,
        placementExtension(moduleKey),
      );
    },

    // ── Telemetry / platform ───────────────────────────────────────────
    async trackObjectStoreAction() {},
    async getFrameId() { return 'forge-sim-frame-headless'; },
    async initFeatureFlags() {},
    async isRovoEnabled() { return false; },
    // No consent banner is ever shown around a simulated app, so the host has
    // nothing published; null is the package's documented answer for that.
    async getCookieConsentPreferences() { return null; },
    async emitFrontendCustomMetric() {},

    // ── Product bridges ────────────────────────────────────────────────
    // Shared with the browser host: no forge-sim surface renders a product
    // around the app, so the inert answer is the same in both.
    ...createProductBridgeSurfaces(),
  };
}
