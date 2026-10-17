/**
 * Forge Bridge — connects @forge/react's reconciler to the ForgeSimulator.
 *
 * @forge/react and @forge/bridge communicate via globalThis.__bridge.callBridge().
 * This module sets up that bridge so that:
 *   - "reconcile" → captures the ForgeDoc tree
 *   - "invoke" → routes to sim.invoke() (the real simulated resolvers), or to
 *     sim.remotes when real @forge/bridge tags it `invokeType: 'ui-remote-fetch'`
 *   - "fetchProduct" → routes to sim.productApi.request()
 *   - "fetchRemote" → routes to sim.remotes.request()
 *   - "getContext" → returns simulated context
 * 
 * Must be set up BEFORE any @forge/react or @forge/bridge imports.
 */

import type { ForgeSimulator } from '../simulator.js';
import { isRawHtmlType } from './html-elements.js';
import { warnOnForgeReactMajorMismatch } from '../forge-package-versions.js';

// ── Types ───────────────────────────────────────────────────────────────

export interface ForgeDoc {
  type: string;
  props: Record<string, any>;
  children: ForgeDoc[];
  key: string;
  forgeReactMajorVersion?: number;
}

export interface BridgeCall {
  cmd: string;
  data: any;
  timestamp: number;
}

import type { ForgeContext } from '../context.js';
import { BRIDGE_COMMANDS, bridgeNotImplementedError } from '../bridge-commands.js';

// ── State ───────────────────────────────────────────────────────────────

interface RenderWaiter {
  resolve: (doc: ForgeDoc) => void;
  reject: (err: Error) => void;
}

let simulator: ForgeSimulator | null = null;
let latestForgeDoc: ForgeDoc | null = null;
let renderResolvers: RenderWaiter[] = [];
let renderListeners: Array<(doc: ForgeDoc) => void> = [];
// Macro inline config — second tree emitted by ForgeReconciler.addConfig().
// Tracked separately from the main view tree so headless tests can render
// both without confusion.
let latestMacroConfigDoc: ForgeDoc | null = null;
let macroConfigRenderResolvers: RenderWaiter[] = [];
let macroConfigRenderListeners: Array<(doc: ForgeDoc) => void> = [];
// Set when a reconcile is rejected (raw HTML, UIK-003). Cleared by the next
// successful reconcile. simulator-ui.render() consumes this to throw even
// when its waitForRender promise wasn't directly awaited (N9 race paths).
let latestRenderError: Error | null = null;
/**
 * Set when a UI-driven invoke asked for a resolver key that does not exist.
 * Surfaced as a hint by waitForContent's timeout (see simulator-ui), which
 * is where the symptom actually shows up — the UI just sits on its loading
 * state forever.
 */
let latestMissingResolverError: Error | null = null;
const bridgeCalls: BridgeCall[] = [];
let tornDown = false;
let currentForgeContext: ForgeContext | null = null;

// ── Captured ForgeReconciler elements (N9: vitest bundle-cache replay) ──
//
// Vitest's vite-node module loader caches bundles by file path and IGNORES
// query strings. Our cache-bust trick (`?t=${Date.now()}`) is a no-op there:
// the second dynamic import returns the cached evaluated module, the bundle's
// top-level `ForgeReconciler.render(<App />)` doesn't re-run, and no reconcile
// pulse fires → moduleDocs[key] stays null forever.
//
// Workaround: the @forge/react shim wraps render/addConfig to capture the
// React element on first evaluation. When simulator-ui detects "no doc after
// import", it calls replayCapturedRender() to re-render the same element into
// a fresh ForgeReconciler container — producing a brand-new reconcile pulse
// equivalent to a real bundle re-evaluation.
const capturedRenderElements = new Map<string, unknown>();
const capturedAddConfigElements = new Map<string, unknown>();
let activeCaptureModuleKey: string | null = null;

// N10: track which modules actually call useConfig(). Used to gate the
// "did you forget setMacroConfig?" timeout hint — without this, the hint
// fires on every macro timeout including macros that don't use config,
// sending devs on red-herring debugging trips.
const modulesThatUseConfig = new Set<string>();

// ── Raw HTML rejection (spec UIK-003) ───────────────────────────────────
//
// Real Forge UI Kit cannot render arbitrary HTML: apps are restricted to
// components exported from '@forge/react', and a host element like <div>
// surfaces a render error instead of the app. The sim must match — silently
// passing raw HTML through would give false confidence that dies in prod.
//
// Detection: a ForgeDoc type that is a known HTML/SVG/MathML tag, or a
// custom element (hyphenated name, per the HTML spec) — see
// html-elements.ts. In headless mode (test API + MCP) this is a HARD FAIL:
// pending waitForRender promises reject with UIKitRawHtmlError and
// sim.ui.render() throws. The dev-server browser shim (dev-command.ts)
// instead shows a visual error panel — right UX for each surface.

/** Thrown when a UI Kit render contains raw HTML host elements (UIK-003). */
export class UIKitRawHtmlError extends Error {
  constructor(public readonly rawTags: string[]) {
    super(
      `UI Kit does not support raw HTML elements (found: ` +
      `${rawTags.map((t) => `<${t}>`).join(', ')}). Apps are restricted to ` +
      `components exported from '@forge/react' — real Forge rejects this render.`
    );
    this.name = 'UIKitRawHtmlError';
  }
}

function collectRawHtmlTypes(doc: ForgeDoc, found: Set<string> = new Set()): Set<string> {
  if (isRawHtmlType(doc.type)) {
    found.add(doc.type);
  }
  for (const child of doc.children ?? []) {
    collectRawHtmlTypes(child, found);
  }
  return found;
}

// ── Bridge command handlers ─────────────────────────────────────────────

async function handleReconcile(data: any): Promise<void> {
  if (!data?.forgeDoc) return;

  // Manual-packaged bundles ship their own @forge/react; the payload is the
  // only place its version is visible. One-time warning per mismatched major.
  // Statically imported: an `await import()` here suspends the handler
  // mid-capture and reorders waiter resolution against a fast follow-up
  // reconcile (broke the render-race tests).
  warnOnForgeReactMajorMismatch(data.forgeDoc.forgeReactMajorVersion);

  const isMacroConfig = data.forgeDoc.type === 'MacroConfig';

  // Parity (UIK-003): HARD FAIL on raw HTML host elements. The doc is not
  // published — pending waiters reject, and the error is recorded so
  // sim.ui.render() throws even if no waiter was pending.
  const rawTypes = collectRawHtmlTypes(data.forgeDoc);
  if (rawTypes.size > 0) {
    const error = new UIKitRawHtmlError([...rawTypes]);
    console.error(
      `[forge-sim] UI Kit render rejected: raw HTML element(s) ` +
      `${error.rawTags.map((t) => `<${t}>`).join(', ')} are not supported. ` +
      `UI Kit apps may only render components exported from '@forge/react'. ` +
      `Real Forge fails this render — fix the app, don't rely on passthrough.`
    );
    latestRenderError = error;
    const waiters = isMacroConfig ? macroConfigRenderResolvers : renderResolvers;
    if (isMacroConfig) macroConfigRenderResolvers = [];
    else renderResolvers = [];
    for (const { reject } of waiters) {
      reject(error);
    }
    return;
  }
  latestRenderError = null;

  // The reconciler emits two roots when a macro uses inline config:
  //   - { type: 'Root' }        from ForgeReconciler.render(<App />)
  //   - { type: 'MacroConfig' } from ForgeReconciler.addConfig(<Config />)
  // Route them to separate listener pools so headless tests can subscribe
  // to each tree independently — same shape as the browser bridge shim.
  if (isMacroConfig) {
    latestMacroConfigDoc = data.forgeDoc;
    const resolvers = macroConfigRenderResolvers;
    macroConfigRenderResolvers = [];
    for (const { resolve } of resolvers) {
      resolve(latestMacroConfigDoc!);
    }
    for (const listener of macroConfigRenderListeners) {
      try { listener(latestMacroConfigDoc!); } catch {}
    }
    return;
  }

  latestForgeDoc = data.forgeDoc;
  const resolvers = renderResolvers;
  renderResolvers = [];
  for (const { resolve } of resolvers) {
    resolve(latestForgeDoc!);
  }
  // Notify persistent listeners (e.g., dev server)
  for (const listener of renderListeners) {
    try { listener(latestForgeDoc!); } catch {}
  }
}

async function handleInvoke(data: any): Promise<any> {
  // After teardown, reject stale invoke calls from unmounted React effects.
  // This prevents the app code from trying to use the result, and React
  // swallows errors from unmounted component effects.
  if (tornDown) {
    return new Promise(() => {}); // Hang forever — effect is stale, nobody's listening
  }
  if (!simulator) {
    throw new Error('forge-sim bridge: No simulator connected. Call connectSimulator() first.');
  }

  // Real @forge/bridge multiplexes invokeRemote()/invokeService() onto the
  // SAME 'invoke' command as resolver calls, distinguished only by
  // `invokeType: 'ui-remote-fetch' | 'ui-container-fetch'`
  // (node_modules/@forge/bridge/out/invoke-endpoint/invoke-endpoint.js).
  // Those payloads carry { path, method, headers, body } and no functionKey,
  // so treating them as a resolver call lands in the missing-resolver path
  // and the app's promise hangs forever. The browser bridge (dev-command.ts)
  // already branches here; this is the headless equivalent. Our own
  // forge-bridge shim never hits this — it calls sim.remotes directly — so
  // only PREBUILT bundles (real inlined @forge/bridge) reach it.
  const remoteInvoke = parseRemoteInvokeType(data?.invokeType);
  if (remoteInvoke === 'container') {
    throw new Error(
      'invokeService is not yet implemented in forge-sim (Container services are ' +
        'an Atlassian developer preview, tracked as roadmap watch item #19).',
    );
  }
  if (remoteInvoke === 'remote') {
    return handleInvokeRemote(data);
  }

  const { functionKey, payload } = data;

  try {
    return await simulator.invoke(functionKey, payload);
  } catch (err: any) {
    // A resolver that does not exist is a SIM/DEPLOY configuration failure,
    // not something the app can meaningfully handle — and app code almost
    // never guards it (`invoke(...).then(setState)` is the canonical shape).
    // Rejecting here becomes an unhandled rejection in the app's effect,
    // which in Node takes down the whole test runner: every test reports
    // "passed" and the process still exits 1, with the blame attached to
    // whichever test happened to run last.
    //
    // In a real browser that same rejection logs to the console and the UI
    // simply stays on its loading state — the page keeps running. So we
    // reproduce the browser: record the error (waitForContent surfaces it
    // as an actionable hint) and leave the app's promise pending.
    //
    // Errors THROWN BY a resolver that does exist still reject normally —
    // apps do catch those, and swallowing them would break real error-state
    // UIs and hide genuine bugs.
    if (isMissingResolverError(err)) {
      latestMissingResolverError = err instanceof Error ? err : new Error(String(err));
      console.error(
        `[forge-sim] UI invoke("${functionKey}") failed: ${latestMissingResolverError.message}`,
      );
      return new Promise(() => {}); // stays pending, like the browser's dangling fetch
    }
    throw err;
  }
}

/**
 * Classify real @forge/bridge's `invokeType` marker. Resolver invokes carry
 * no marker; endpoint invokes carry `ui-<Remote|Container>-fetch`
 * (lower-cased by the package). Anything else is treated as a resolver call
 * so a future marker degrades to today's behavior rather than being dropped.
 */
function parseRemoteInvokeType(invokeType: unknown): 'remote' | 'container' | null {
  if (typeof invokeType !== 'string') return null;
  const m = /^ui-(remote|container)-fetch$/.exec(invokeType);
  return m ? (m[1] as 'remote' | 'container') : null;
}

/**
 * The module the current frontend work belongs to. Same resolution order as
 * the forge-bridge shim's getCurrentModuleKeyForBridge(): an explicit test
 * knob wins, then the module most recently rendered headlessly.
 */
function activeModuleKey(): string | undefined {
  return simulator?.currentModuleKey ?? simulator?.ui?.getActiveModule?.() ?? undefined;
}

/**
 * invokeRemote() from a prebuilt bundle. Mirrors dev-server.ts's
 * 'invokeRemote' RPC: resolve the module's manifest endpoint, thread module
 * key/type through for FIT claims, and return the `{ success, payload,
 * error }` envelope `_setupInvokeEndpointFn` unwraps.
 */
async function handleInvokeRemote(data: any): Promise<any> {
  const { path, method, headers, body } = data ?? {};
  const moduleKey = activeModuleKey();
  const endpointKey = simulator!.resolveModuleEndpoint(moduleKey);
  const moduleType = moduleKey ? simulator!.getModuleType(moduleKey) : undefined;
  return simulator!.remotes.invokeFromBridge({
    path,
    method,
    headers: normalizeBridgeHeaders(headers),
    body,
    endpointKey,
    moduleKey,
    moduleType,
  });
}

/**
 * requestRemote() from a prebuilt bundle — real @forge/bridge sends
 * `callBridge('fetchRemote', { remoteKey, fetchRequestInit })` with the path
 * inside fetchRequestInit (node_modules/@forge/bridge/out/fetch/fetch.js).
 * Response framing is the same shape as fetchProduct.
 */
async function handleFetchRemote(data: any): Promise<any> {
  if (!simulator) {
    throw new Error('forge-sim bridge: No simulator connected. Call connectSimulator() first.');
  }
  const { remoteKey, fetchRequestInit } = data ?? {};
  const response = await simulator.remotes.request(remoteKey, {
    path: data?.path ?? fetchRequestInit?.path ?? '/',
    method: fetchRequestInit?.method,
    headers: normalizeBridgeHeaders(fetchRequestInit?.headers),
    body: fetchRequestInit?.body,
  });
  return {
    status: response.status,
    statusText: response.statusText,
    body: await response.text(),
    headers: response.headers,
    isAttachment: false,
  };
}

/**
 * Real @forge/bridge serializes request headers as `[...headers.entries()]`
 * — an array of [name, value] pairs — before crossing the bridge. Our
 * backends take a plain record (spreading an array into one yields numeric
 * keys), so normalize here. Records and undefined pass through.
 */
export function normalizeBridgeHeaders(headers: unknown): Record<string, string> | undefined {
  if (headers == null) return undefined;
  if (Array.isArray(headers)) {
    const out: Record<string, string> = {};
    for (const pair of headers) {
      if (Array.isArray(pair) && pair.length >= 2) out[String(pair[0])] = String(pair[1]);
    }
    return out;
  }
  if (typeof headers === 'object') return headers as Record<string, string>;
  return undefined;
}

/**
 * events.emit / emitPublic headless. There is no sibling frame to relay to,
 * but same-frame subscribers registered through `on`/`onPublic` are real, so
 * dispatch to them.
 */
async function handleEventEmit(data: any): Promise<void> {
  const event = data?.event;
  const subs = headlessEventListeners.get(event);
  if (subs) {
    for (const cb of subs) {
      try { await cb(data?.payload); } catch (err) {
        console.error('[forge-sim bridge] Event handler error:', err);
      }
    }
  }
}

/**
 * realtime.subscribe headless. Routes to the simulator's realtime store, so
 * a backend `realtime.publish()` reaches a UI subscriber in the same test.
 */
async function handleRealtimeSubscribe(data: any): Promise<{ unsubscribe: () => void }> {
  if (!simulator) {
    throw new Error('forge-sim bridge: No simulator connected. Call connectSimulator() first.');
  }
  const channel = data?.channelName;
  const onEvent = data?.onEvent;
  // sim.realtime.subscribe/subscribeGlobal ARE the bridge-side API (they
  // throw on a bad channel/token exactly as the docs require, which surfaces
  // as the rejected Promise the app sees).
  if (data?.isGlobal) {
    return simulator.realtime.subscribeGlobal(channel, onEvent, data?.options);
  }
  // Same placement data view.getContext() reports, so a UI subscribe and a
  // backend publish derive the same scoped channel key.
  return simulator.realtime.subscribe(
    channel,
    onEvent,
    activeModuleKey() ?? null,
    data?.options,
    currentForgeContext?.extension ?? null,
  );
}

/** The simulator's "this key isn't registered" error, raised before any app code ran. */
function isMissingResolverError(err: unknown): boolean {
  const msg = (err as { message?: unknown })?.message;
  return typeof msg === 'string' && /^No resolver defined for "/.test(msg);
}

/**
 * Consume the most recent missing-resolver invoke failure, if any.
 * Returns it once and clears it.
 */
export function consumeMissingResolverError(): Error | null {
  const err = latestMissingResolverError;
  latestMissingResolverError = null;
  return err;
}

async function handleFetchProduct(data: any): Promise<any> {
  if (!simulator) {
    throw new Error('forge-sim bridge: No simulator connected. Call connectSimulator() first.');
  }
  const { product, restPath, fetchRequestInit } = data;
  const response = await simulator.productApi.request(product, restPath, {
    method: fetchRequestInit?.method,
    headers: normalizeBridgeHeaders(fetchRequestInit?.headers),
    body: fetchRequestInit?.body,
  });

  // Return in the format @forge/bridge expects
  return {
    status: response.status,
    statusText: response.statusText,
    body: await response.text(),
    headers: response.headers,
    isAttachment: false,
  };
}

async function handleGetContext(): Promise<ForgeContext> {
  if (currentForgeContext) {
    return currentForgeContext;
  }

  // Fallback — no context has been set
  const { buildDefaultContext } = await import('../context.js');
  return buildDefaultContext('sim-module');
}

/**
 * No-op subscriber for cross-module event subscriptions (e.g. useConfig()
 * subscribes to `FORGE_CORE_MACRO_CONFIG_CHANGED` via @forge/bridge events.on).
 *
 * In headless mode we don't dispatch these events to subscribers — the test
 * drives state synchronously via sim.ui.render(). Returning a stub unsubscribe
 * keeps the calling code happy without leaking a "Unhandled bridge command"
 * warning on every render.
 */
/**
 * Same-frame listener registry for events.on / onPublic. Headless there are
 * no sibling frames to relay between, but a subscription inside one render
 * is real: `emit` below dispatches to it, so an app that talks to itself
 * through the events API behaves as it would in a browser.
 */
const headlessEventListeners = new Map<string, Set<(payload?: any) => any>>();

async function handleEventSubscribe(data: any): Promise<{ unsubscribe: () => void }> {
  const event = data?.event;
  const callback = data?.callback;
  if (typeof event !== 'string' || typeof callback !== 'function') {
    return { unsubscribe: () => {} };
  }
  if (!headlessEventListeners.has(event)) headlessEventListeners.set(event, new Set());
  headlessEventListeners.get(event)!.add(callback);
  return { unsubscribe: () => { headlessEventListeners.get(event)?.delete(callback); } };
}

// ── createHistory (server-side bridge — headless/MCP mode) ──────────────
//
// In the normal dev server flow, both UIKit and Custom UI app code runs in
// the browser, so createHistory is handled by the inline bridge script
// (dev-command.ts) using window.history directly — this code is NOT involved.
//
// This handler is only used when app code runs through the server-side bridge
// (headless/MCP mode). It supports optional WS proxying to a browser if one
// is connected, otherwise falls back to an in-memory history.

/**
 * Listeners registered via history.listen().
 * Notified by notifyHistoryListeners() when location changes.
 *
 * Parity: real Forge's bridge history uses the history v4 listener signature
 * (location, action) — NOT v5's ({action, location}). @forge/react's Router
 * and @forge/bridge's createHistory wrapper both destructure the first arg
 * as the location, so v5-style notify breaks Route matching after navigation.
 */
type HistoryListener = (location: any, action: string) => void;
const historyListeners: HistoryListener[] = [];
const initialHistoryLocation = () => ({ pathname: '/', search: '', hash: '', state: null, key: 'default' });
let currentHistoryLocation: any = initialHistoryLocation();
let currentHistoryAction = 'POP';

// In-memory entries stack for the no-WS (headless/MCP) path — makes
// go()/goBack()/goForward() actually navigate instead of silently no-oping,
// so @forge/react/router's useNavigate(-1) works in headless renders.
// In WS-proxy mode the browser's real history owns the stack instead.
let historyEntries: any[] = [initialHistoryLocation()];
let historyIndex = 0;

/** Reset headless history state (called from resetBridge). */
function resetHistoryState(): void {
  historyListeners.length = 0;
  historyEntries = [initialHistoryLocation()];
  historyIndex = 0;
  currentHistoryLocation = historyEntries[0];
  currentHistoryAction = 'POP';
}

/**
 * Called by the dev server when the browser sends a history navigation event
 * (popstate, or acknowledgement of push/replace with updated location).
 */
export function notifyHistoryListeners(action: string, location: any): void {
  currentHistoryAction = action;
  currentHistoryLocation = location;
  for (const fn of historyListeners) {
    try { fn(location, action); } catch (e) { console.error(e); }
  }
}

/**
 * Send a history command to the browser via the dev server WS.
 * Returns a promise that resolves when the browser acknowledges.
 */
let historyWsSender: ((cmd: string, data: any) => Promise<any>) | null = null;

export function setHistoryWsSender(sender: (cmd: string, data: any) => Promise<any>): void {
  historyWsSender = sender;
}

async function handleCreateHistory(): Promise<any> {
  const history = {
    get action() { return currentHistoryAction; },
    get location() { return currentHistoryLocation; },
    // No-op setter: @forge/bridge's createHistory wrapper assigns
    // `history.location = location` inside its own listen callback. The
    // getter above is already live, so the assignment is redundant — but
    // without a setter it would throw in strict-mode callers.
    set location(_loc: any) { /* getter is live */ },

    createHref(to: string | Record<string, any>): string {
      if (typeof to === 'string') return to;
      return (to.pathname || '') + (to.search || '') + (to.hash || '');
    },

    async push(to: string | Record<string, any>, state?: any): Promise<void> {
      if (historyWsSender) {
        await historyWsSender('history.push', { to, state });
      } else {
        // No WS connection (e.g., MCP/headless mode) — update in-memory.
        // Truncate the forward stack, then push (browser history semantics).
        const loc = parseTo(to, state);
        historyEntries.splice(historyIndex + 1);
        historyEntries.push(loc);
        historyIndex = historyEntries.length - 1;
        notifyHistoryListeners('PUSH', loc);
      }
    },

    async replace(to: string | Record<string, any>, state?: any): Promise<void> {
      if (historyWsSender) {
        await historyWsSender('history.replace', { to, state });
      } else {
        const loc = parseTo(to, state);
        historyEntries[historyIndex] = loc;
        notifyHistoryListeners('REPLACE', loc);
      }
    },

    async go(delta: number): Promise<void> {
      if (historyWsSender) {
        await historyWsSender('history.go', { delta });
      } else {
        const nextIndex = Math.max(0, Math.min(historyEntries.length - 1, historyIndex + delta));
        if (nextIndex === historyIndex) return;
        historyIndex = nextIndex;
        notifyHistoryListeners('POP', historyEntries[historyIndex]);
      }
    },

    // v4 names (the documented Forge contract)
    goBack(): void { history.go(-1); },
    goForward(): void { history.go(1); },
    // v5 names (what @forge/bridge's .d.ts promises)
    back(): void { history.go(-1); },
    forward(): void { history.go(1); },

    listen(fn: HistoryListener): () => void {
      historyListeners.push(fn);
      return () => {
        const idx = historyListeners.indexOf(fn);
        if (idx >= 0) historyListeners.splice(idx, 1);
      };
    },

    block(_fn: any): () => void {
      // Blocking requires intercepting browser navigation — not supported in WS proxy mode
      console.warn('[forge-sim] history.block() is not supported in UIKit mode');
      return () => {};
    },
  };

  return history;
}

function parseTo(to: string | Record<string, any>, state?: any): any {
  if (typeof to === 'string') {
    let pathname = to, search = '', hash = '';
    const hashIdx = to.indexOf('#');
    if (hashIdx >= 0) { hash = to.slice(hashIdx); to = to.slice(0, hashIdx); }
    const searchIdx = to.indexOf('?');
    if (searchIdx >= 0) { search = to.slice(searchIdx); pathname = to.slice(0, searchIdx); }
    return { pathname, search, hash, state: state ?? null, key: Math.random().toString(36).slice(2, 10) };
  }
  return { pathname: to.pathname || '/', search: to.search || '', hash: to.hash || '', state: state ?? null, key: Math.random().toString(36).slice(2, 10) };
}

// ── Bridge dispatch ─────────────────────────────────────────────────────

const HANDLERS: Record<string, (data: any) => Promise<any>> = {
  reconcile: handleReconcile,
  invoke: handleInvoke,
  fetchProduct: handleFetchProduct,
  fetchRemote: handleFetchRemote,
  getContext: handleGetContext,
  createHistory: handleCreateHistory,
  // Cross-module event subscriptions — no-op in headless mode.
  // @forge/bridge's events.on dispatches via callBridge('on', ...).
  on: handleEventSubscribe,
  onPublic: handleEventSubscribe,
  // Object Store analytics — real @forge/bridge fire-and-forgets this before
  // every objectStore.* call. No-op so it never rejects or warns.
  trackObjectStoreAction: async () => undefined,

  // ── Local commands with no host surface headless (phase 3) ──────────
  // There is no page, no tab and no flag container in a headless render.
  // Real Forge resolves all of these, so they must resolve here too —
  // returning a shaped value where there is one, rather than warning. Each
  // is recorded in bridgeCalls, so a test can still assert the app asked.
  emit: handleEventEmit,
  emitPublic: handleEventEmit,
  showFlag: async () => undefined,
  closeFlag: async () => undefined,
  navigate: async () => undefined,
  reload: async () => undefined,
  getUrl: async (data: any) => (typeof data === 'string' ? data : (data?.url ?? null)),
  refresh: async () => undefined,
  open: async () => undefined,
  enableTheming: async () => undefined,
  changeWindowTitle: async () => undefined,
  emitReadyEvent: async () => undefined,
  onClose: async () => undefined,
  onError: async (data: any) => {
    console.error('[forge-sim bridge] App error:', data?.error ?? data);
    return undefined;
  },
  getFrameId: async () => 'forge-sim-frame-headless',
  initFeatureFlags: async () => undefined,
  isRovoEnabled: async () => false,
  emitFrontendCustomMetric: async () => undefined,
  openModal: async () => {
    throw new Error(
      '[forge-sim] Modal.open() needs a host to draw the modal — there is no ' +
        'window in a headless render. Use forge-sim dev to exercise modals, or ' +
        'render the modal module directly by its own module key.',
    );
  },
  subscribeRealtimeChannel: handleRealtimeSubscribe,
};

function callBridge(cmd: string, data?: any): any {
  bridgeCalls.push({ cmd, data, timestamp: Date.now() });

  const handler = HANDLERS[cmd];
  if (handler) {
    return handler(data);
  }

  // Headless shares the command REGISTRY with the two browser hosts
  // (canonical: src/bridge-commands.ts) but not their translation — they
  // speak WebSocket RPC to the dev server, this one calls sim.* in process.
  // The registry is still what decides whether an unhandled command is a
  // deliberate gap, a host gap, or a stale table.
  const spec = BRIDGE_COMMANDS[cmd];
  if (spec?.disposition === 'unsupported') throw bridgeNotImplementedError(cmd);
  console.warn(
    spec
      ? `[forge-sim bridge] Bridge command "${cmd}" is declared '${spec.disposition}' but the headless host has no handler for it.`
      : `[forge-sim bridge] Unknown bridge command: "${cmd}". If @forge/bridge added it, update src/bridge-commands.ts.`,
  );
  return Promise.resolve(undefined);
}

// ── Setup ───────────────────────────────────────────────────────────────

/**
 * Minimal document stub for headless imports of PREBUILT (manual-packaged)
 * bundles. Only installed when no real `document` exists (never in browsers
 * or jsdom test environments).
 *
 * Why: Vite injects its modulepreload polyfill into every default build, and
 * its first statement is `document.createElement("link").relList` — followed
 * by an early return when `relList.supports("modulepreload")` is true. In
 * plain Node that's an immediate `ReferenceError: document is not defined`
 * from inside the minified chunk, hit by anyone who runs a standard
 * `vite build` and calls sim.ui.render(). Answering `supports → true` makes
 * the polyfill exit on its own fast path — the browser-parity answer, since
 * every browser Forge supports has native modulepreload. The stub is
 * deliberately inert-but-permissive so load-time CSS/style injection
 * preambles (document.head.appendChild(style)) are absorbed too.
 */
function installDocumentStub(): void {
  if (typeof (globalThis as any).document !== 'undefined') return;

  const inertElement = (): any => ({
    relList: { supports: () => true },
    style: {},
    setAttribute: () => {},
    appendChild: (child: unknown) => child,
    removeChild: (child: unknown) => child,
    addEventListener: () => {},
    removeEventListener: () => {},
  });

  (globalThis as any).document = {
    __forgeSimStub: true,
    // null (not undefined) outside script evaluation — browser parity.
    // simulator-ui points this at the bundle being imported via
    // setStubCurrentScript(): webpack/Rspack's `publicPath: 'auto'` runtime
    // reads document.currentScript.src at module eval and throws an opaque
    // "Automatic publicPath is not supported in this browser" when it's
    // missing — and every Forge webpack frontend has chunk runtime, because
    // @forge/bridge itself dynamically imports iframe-resizer (adversarial A).
    currentScript: null as null | { src: string },
    createElement: inertElement,
    createTextNode: () => ({}),
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementsByTagName: () => [],
    head: inertElement(),
    body: inertElement(),
    documentElement: inertElement(),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

// ── Headless i18n: page-relative __LOCALES__ fetches ────────────────────
//
// Real @forge/bridge's i18n module has NO bridge seam. It loads translations
// with a page-relative `fetch('./__LOCALES__/i18n-info.json')` and
// `fetch('./__LOCALES__/<locale>.json')` (node_modules/@forge/bridge/out/
// i18n/index.js) — static files Forge's build places next to the entry HTML.
// In a browser that resolves against the document URL; in Node there is no
// document URL and undici throws `TypeError: Failed to parse URL`. The
// I18nProvider effect rejects (unhandled) and `t()` silently falls back to
// returning keys — a headless-only failure that passes untranslated.
//
// Our forge-bridge shim never hits this (it reads sim.i18n directly), so this
// is only reached by PREBUILT bundles with the real package inlined. We are
// the page here, so answer the two relative shapes from sim.i18n — the same
// store the shim path uses — and leave every other URL to the real fetch.
// Absolute URLs never match: the page-relative form is the only one the real
// package emits and the only one a browser would resolve against the resource.

const I18N_BUNDLE_FOLDER_NAME = '__LOCALES__';
const I18N_INFO_FILE_NAME = 'i18n-info.json';
const RELATIVE_LOCALES_RE = new RegExp(`^(?:\\./)?${I18N_BUNDLE_FOLDER_NAME}/([^/?#]+)$`);
const FETCH_PATCH_MARK = Symbol.for('forge-sim.relative-i18n-fetch');

function requestUrl(input: unknown): string | null {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (input && typeof (input as { url?: unknown }).url === 'string') return (input as { url: string }).url;
  return null;
}

async function serveLocalesFile(file: string): Promise<Response> {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      statusText: status === 200 ? 'OK' : 'Not Found',
      headers: { 'content-type': 'application/json' },
    });
  if (!simulator) return json({ error: 'forge-sim bridge: No simulator connected' }, 404);
  try {
    if (file === I18N_INFO_FILE_NAME) {
      // Real file shape is `{ config: {...} }` — the package reads `.config`.
      return json({ config: await simulator.i18n.getI18nInfoConfig() });
    }
    if (file.endsWith('.json')) {
      return json(await simulator.i18n.getTranslationResource(file.slice(0, -'.json'.length)));
    }
  } catch (err) {
    // Missing locale → the same 404 a missing static file would produce, so
    // the real package raises ITS error ("Failed to get translation resource
    // for locale: xx"), exactly as in a browser.
    return json({ error: (err as Error).message }, 404);
  }
  return json({ error: `Not found: ${I18N_BUNDLE_FOLDER_NAME}/${file}` }, 404);
}

// ── Headless page base for `new Request('')` ────────────────────────────
//
// Real @forge/bridge normalizes every requestJira/requestConfluence/
// requestBitbucket/requestRemote init through `new Request('', init)` to
// derive headers and body text (node_modules/@forge/bridge/out/fetch/
// fetch.js, parseRequest). A browser resolves '' against the document base;
// undici has no base and throws `TypeError: Invalid URL`, so a prebuilt
// bundle's first product or remote request dies inside the package before
// it ever reaches the bridge — and with it every hook built on requestJira
// (useIssueProperty, useContentProperty, useSpaceProperty). Give relative
// and empty request URLs the base a browser would: the real document's if
// one exists, otherwise a synthetic headless origin. Absolute URLs pass
// through untouched; nothing about the Request is read back as a URL by the
// package, so the synthetic origin never leaks into app-visible data.

const HEADLESS_PAGE_BASE = 'http://forge-sim.headless/';
const REQUEST_PATCH_MARK = Symbol.for('forge-sim.relative-request-base');
const ABSOLUTE_URL_RE = /^[a-z][a-z0-9+.-]*:/i;

function installRelativeRequestBase(): void {
  const g = globalThis as any;
  const RealRequest = g.Request;
  if (typeof RealRequest !== 'function' || RealRequest[REQUEST_PATCH_MARK]) return;
  const base = () => {
    const doc = g.document;
    const docBase = doc && !doc.__forgeSimStub ? doc.baseURI : undefined;
    return typeof docBase === 'string' && docBase ? docBase : HEADLESS_PAGE_BASE;
  };
  class ForgeSimRequest extends RealRequest {
    constructor(input: unknown, init?: unknown) {
      if (typeof input === 'string' && !ABSOLUTE_URL_RE.test(input)) {
        input = new URL(input, base()).href;
      }
      super(input as any, init as any);
    }
  }
  (ForgeSimRequest as any)[REQUEST_PATCH_MARK] = true;
  Object.defineProperty(ForgeSimRequest, 'name', { value: 'Request' });
  g.Request = ForgeSimRequest;
}

function installRelativeI18nFetch(): void {
  const g = globalThis as any;
  const real = g.fetch;
  if (typeof real !== 'function' || real[FETCH_PATCH_MARK]) return;
  const patched = function forgeSimFetch(this: unknown, input: unknown, init?: unknown) {
    const url = requestUrl(input);
    const m = url ? RELATIVE_LOCALES_RE.exec(url) : null;
    if (m) return serveLocalesFile(decodeURIComponent(m[1]));
    return real.call(this ?? globalThis, input, init);
  } as any;
  patched[FETCH_PATCH_MARK] = true;
  g.fetch = patched;
}

/**
 * Point the document stub's `currentScript` at the script being evaluated
 * (pass null when evaluation ends — the browser-parity resting state).
 * Only touches OUR stub: real documents (browser, jsdom) manage their own.
 *
 * `src` carries the entry-script file URL so bundler runtimes that derive
 * their asset base from it (webpack/Rspack `publicPath: 'auto'`, bundles
 * reading `currentScript.src` directly) resolve it the same way a browser
 * would — relative to the bundle's own directory.
 */
export function setStubCurrentScript(src: string | null): void {
  const doc = (globalThis as any).document;
  if (!doc?.__forgeSimStub) return;
  // tagName matters: webpack 5's publicPath runtime gates on
  // `document.currentScript.tagName.toUpperCase() === "SCRIPT"` before
  // reading `.src`.
  doc.currentScript = src === null
    ? null
    : { src, tagName: 'SCRIPT', type: 'text/javascript', getAttribute: (n: string) => (n === 'src' ? src : null) };
}

/**
 * Install the bridge on globalThis so @forge/bridge and @forge/react find it.
 * Call this BEFORE importing any @forge/react or @forge/bridge modules.
 */
export function installBridge(): void {
  const bridge = { callBridge };
  (globalThis as any).__bridge = bridge;
  (globalThis as any).self = globalThis;

  if (typeof (globalThis as any).window === 'undefined') {
    (globalThis as any).window = globalThis;
  }
  (globalThis as any).window.__bridge = bridge;
  installDocumentStub();
  installRelativeI18nFetch();
  installRelativeRequestBase();
}

/**
 * Connect a ForgeSimulator instance to the bridge.
 * After this, invoke/fetchProduct calls from the UI go through the simulator.
 */
export function connectSimulator(sim: ForgeSimulator): void {
  simulator = sim;
  tornDown = false;
  // Expose simulator on globalThis so the bridge shim can access i18n store etc.
  (globalThis as any).__forgeSimulator = sim;
}

/**
 * Set the Forge context for the current render.
 * This is what view.getContext() / useProductContext() will return.
 */
export function setForgeContext(context: ForgeContext): void {
  currentForgeContext = context;
}

/**
 * Get the current Forge context (if set).
 */
export function getForgeContext(): ForgeContext | null {
  return currentForgeContext;
}

// ── ForgeDoc access ─────────────────────────────────────────────────────

/** Get the latest ForgeDoc produced by the reconciler. */
export function getLatestForgeDoc(): ForgeDoc | null {
  return latestForgeDoc;
}

/**
 * Get the latest MacroConfig ForgeDoc produced by ForgeReconciler.addConfig().
 * Returns null if the app didn't call addConfig (most apps don't).
 */
export function getLatestMacroConfigDoc(): ForgeDoc | null {
  return latestMacroConfigDoc;
}

/**
 * Wait for the next render (reconcile bridge call).
 *
 * Rejects with {@link UIKitRawHtmlError} if the render contains raw HTML
 * host elements (UIK-003) — hard fail, matching real Forge.
 */
export function waitForRender(): Promise<ForgeDoc> {
  return new Promise((resolve, reject) => {
    renderResolvers.push({ resolve, reject });
  });
}

/**
 * Wait for the next MacroConfig render (from ForgeReconciler.addConfig).
 * Rejects with {@link UIKitRawHtmlError} on raw HTML (UIK-003).
 */
export function waitForMacroConfigRender(): Promise<ForgeDoc> {
  return new Promise((resolve, reject) => {
    macroConfigRenderResolvers.push({ resolve, reject });
  });
}

/**
 * Consume the most recent render error (UIK-003 hard fail), if any.
 * Returns the error once and clears it. Used by simulator-ui.render() to
 * throw even when its waitForRender promise wasn't the awaited path.
 */
export function consumeRenderError(): Error | null {
  const err = latestRenderError;
  latestRenderError = null;
  return err;
}

/** Get all bridge calls made so far. */
export function getBridgeCalls(): BridgeCall[] {
  return [...bridgeCalls];
}

/**
 * Register a persistent listener that fires on every render (reconcile).
 * Used by the dev server to auto-broadcast ForgeDoc updates.
 * Returns an unbind function.
 */
export function onRender(listener: (doc: ForgeDoc) => void): () => void {
  renderListeners.push(listener);
  return () => {
    renderListeners = renderListeners.filter((l) => l !== listener);
  };
}

/**
 * Register a persistent listener for MacroConfig ForgeDoc updates
 * (ForgeReconciler.addConfig). Only fires when the app uses inline config.
 */
export function onMacroConfigRender(listener: (doc: ForgeDoc) => void): () => void {
  macroConfigRenderListeners.push(listener);
  return () => {
    macroConfigRenderListeners = macroConfigRenderListeners.filter((l) => l !== listener);
  };
}

/** Reset all UI state — marks bridge as torn down to swallow stale React effects. */
export function resetBridge(): void {
  tornDown = true;
  latestForgeDoc = null;
  latestMacroConfigDoc = null;
  latestRenderError = null;
  latestMissingResolverError = null;
  renderResolvers = [];
  macroConfigRenderResolvers = [];
  bridgeCalls.length = 0;
  headlessEventListeners.clear();
  currentForgeContext = null;
  resetHistoryState();
}

// ── Captured render element API (N9 workaround) ─────────────────────────

/**
 * Set the module key under which the next ForgeReconciler.render() /
 * .addConfig() call should be captured. simulator-ui.render() sets this
 * before the cache-busted dynamic import.
 */
export function setActiveCaptureModule(moduleKey: string | null): void {
  activeCaptureModuleKey = moduleKey;
}

/** Called by the @forge/react shim wrapper on every ForgeReconciler.render(). */
export function captureRenderElement(element: unknown): void {
  if (activeCaptureModuleKey !== null) {
    capturedRenderElements.set(activeCaptureModuleKey, element);
  }
}

/** Called by the @forge/react shim wrapper on every ForgeReconciler.addConfig(). */
export function captureAddConfigElement(element: unknown): void {
  if (activeCaptureModuleKey !== null) {
    capturedAddConfigElements.set(activeCaptureModuleKey, element);
  }
}

/** Whether we have a captured render element for the given module. */
export function hasCapturedRenderElement(moduleKey: string): boolean {
  return capturedRenderElements.has(moduleKey);
}

/**
 * Replay the captured render() and addConfig() elements for a module against
 * a fresh ForgeReconciler container. Used when the bundle was cached by the
 * test runner's module loader and the cache-busted re-import was a no-op.
 *
 * Returns true if a replay fired, false if nothing was captured for this key.
 *
 * The replay uses the SAME @forge/react instance the original bundle did
 * (resolved via createRequire from this file's location), so the singleton
 * react-reconciler inside is shared — exactly what the bundle would have
 * triggered on a fresh evaluation.
 */
export async function replayCapturedRender(moduleKey: string): Promise<boolean> {
  const renderElement = capturedRenderElements.get(moduleKey);
  if (renderElement === undefined) return false;

  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const realModule: any = require('@forge/react');
  const ForgeReconciler = realModule.default ?? realModule;

  ForgeReconciler.render(renderElement);
  const configElement = capturedAddConfigElements.get(moduleKey);
  if (configElement !== undefined) {
    ForgeReconciler.addConfig(configElement);
  }
  return true;
}

/** Test/debug only — wipe captured elements. */
export function clearCapturedElements(): void {
  capturedRenderElements.clear();
  capturedAddConfigElements.clear();
  activeCaptureModuleKey = null;
  modulesThatUseConfig.clear();
}

// ── useConfig tracking (N10) ────────────────────────────────────────────

/** Called by the @forge/react shim's useConfig wrapper. */
export function markUseConfigUsed(): void {
  if (activeCaptureModuleKey !== null) {
    modulesThatUseConfig.add(activeCaptureModuleKey);
  }
}

/** Has this module's bundle ever called useConfig() during a render? */
export function moduleUsesConfig(moduleKey: string): boolean {
  return modulesThatUseConfig.has(moduleKey);
}

/** Full reset — disconnects simulator too. */
export function resetAll(): void {
  resetBridge();
  renderListeners = [];
  macroConfigRenderListeners = [];
  simulator = null;
}
