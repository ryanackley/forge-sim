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

let simulator: ForgeSimulator | null = null;
let latestForgeDoc: ForgeDoc | null = null;
let renderResolvers: Array<(doc: ForgeDoc) => void> = [];
let renderListeners: Array<(doc: ForgeDoc) => void> = [];
// Macro inline config — second tree emitted by ForgeReconciler.addConfig().
// Tracked separately from the main view tree so headless tests can render
// both without confusion.
let latestMacroConfigDoc: ForgeDoc | null = null;
let macroConfigRenderResolvers: Array<(doc: ForgeDoc) => void> = [];
let macroConfigRenderListeners: Array<(doc: ForgeDoc) => void> = [];
const bridgeCalls: BridgeCall[] = [];
let tornDown = false;
let currentForgeContext: ForgeContext | null = null;

// ── Bridge command handlers ─────────────────────────────────────────────

async function handleReconcile(data: any): Promise<void> {
  if (!data?.forgeDoc) return;

  // The reconciler emits two roots when a macro uses inline config:
  //   - { type: 'Root' }        from ForgeReconciler.render(<App />)
  //   - { type: 'MacroConfig' } from ForgeReconciler.addConfig(<Config />)
  // Route them to separate listener pools so headless tests can subscribe
  // to each tree independently — same shape as the browser bridge shim.
  if (data.forgeDoc.type === 'MacroConfig') {
    latestMacroConfigDoc = data.forgeDoc;
    const resolvers = macroConfigRenderResolvers;
    macroConfigRenderResolvers = [];
    for (const resolve of resolvers) {
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
  for (const resolve of resolvers) {
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
 */
type HistoryListener = (update: { action: string; location: any }) => void;
const historyListeners: HistoryListener[] = [];
let currentHistoryLocation: any = { pathname: '/', search: '', hash: '', state: null, key: 'default' };
let currentHistoryAction = 'POP';

/**
 * Called by the dev server when the browser sends a history navigation event
 * (popstate, or acknowledgement of push/replace with updated location).
 */
export function notifyHistoryListeners(action: string, location: any): void {
  currentHistoryAction = action;
  currentHistoryLocation = location;
  for (const fn of historyListeners) {
    try { fn({ action, location }); } catch (e) { console.error(e); }
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

    createHref(to: string | Record<string, any>): string {
      if (typeof to === 'string') return to;
      return (to.pathname || '') + (to.search || '') + (to.hash || '');
    },

    async push(to: string | Record<string, any>, state?: any): Promise<void> {
      if (historyWsSender) {
        await historyWsSender('history.push', { to, state });
      } else {
        // No WS connection (e.g., MCP/headless mode) — update in-memory
        currentHistoryLocation = parseTo(to, state);
        currentHistoryAction = 'PUSH';
        notifyHistoryListeners('PUSH', currentHistoryLocation);
      }
    },

    async replace(to: string | Record<string, any>, state?: any): Promise<void> {
      if (historyWsSender) {
        await historyWsSender('history.replace', { to, state });
      } else {
        currentHistoryLocation = parseTo(to, state);
        currentHistoryAction = 'REPLACE';
        notifyHistoryListeners('REPLACE', currentHistoryLocation);
      }
    },

    async go(delta: number): Promise<void> {
      if (historyWsSender) {
        await historyWsSender('history.go', { delta });
      }
    },

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

/** Wait for the next render (reconcile bridge call). */
export function waitForRender(): Promise<ForgeDoc> {
  return new Promise((resolve) => {
    renderResolvers.push(resolve);
  });
}

/** Wait for the next MacroConfig render (from ForgeReconciler.addConfig). */
export function waitForMacroConfigRender(): Promise<ForgeDoc> {
  return new Promise((resolve) => {
    macroConfigRenderResolvers.push(resolve);
  });
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
  renderResolvers = [];
  macroConfigRenderResolvers = [];
  bridgeCalls.length = 0;
  currentForgeContext = null;
}

/** Full reset — disconnects simulator too. */
export function resetAll(): void {
  resetBridge();
  renderListeners = [];
  macroConfigRenderListeners = [];
  simulator = null;
}
