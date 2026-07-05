/**
 * Forge Bridge — connects @forge/react's reconciler to the ForgeSimulator.
 *
 * @forge/react and @forge/bridge communicate via globalThis.__bridge.callBridge().
 * This module sets up that bridge so that:
 *   - "reconcile" → captures the ForgeDoc tree
 *   - "invoke" → routes to sim.invoke() (the real simulated resolvers)
 *   - "fetchProduct" → routes to sim.productApi.request()
 *   - "getContext" → returns simulated context
 * 
 * Must be set up BEFORE any @forge/react or @forge/bridge imports.
 */

import type { ForgeSimulator } from '../simulator.js';
import { isRawHtmlType } from './html-elements.js';

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
  const { functionKey, payload } = data;
  return simulator.invoke(functionKey, payload);
}

async function handleFetchProduct(data: any): Promise<any> {
  if (!simulator) {
    throw new Error('forge-sim bridge: No simulator connected. Call connectSimulator() first.');
  }
  const { product, restPath, fetchRequestInit } = data;
  const response = await simulator.productApi.request(product, restPath, {
    method: fetchRequestInit?.method,
    headers: fetchRequestInit?.headers,
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
async function handleEventSubscribe(): Promise<{ unsubscribe: () => void }> {
  return { unsubscribe: () => {} };
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
  getContext: handleGetContext,
  createHistory: handleCreateHistory,
  // Cross-module event subscriptions — no-op in headless mode.
  // @forge/bridge's events.on dispatches via callBridge('on', ...).
  on: handleEventSubscribe,
  onPublic: handleEventSubscribe,
  // Object Store analytics — real @forge/bridge fire-and-forgets this before
  // every objectStore.* call. No-op so it never rejects or warns.
  trackObjectStoreAction: async () => undefined,
};

function callBridge(cmd: string, data?: any): any {
  bridgeCalls.push({ cmd, data, timestamp: Date.now() });

  const handler = HANDLERS[cmd];
  if (handler) {
    return handler(data);
  }

  // Unknown commands get a warning but don't crash
  console.warn(`[forge-sim bridge] Unhandled bridge command: "${cmd}"`);
  return Promise.resolve(undefined);
}

// ── Setup ───────────────────────────────────────────────────────────────

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
  renderResolvers = [];
  macroConfigRenderResolvers = [];
  bridgeCalls.length = 0;
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
