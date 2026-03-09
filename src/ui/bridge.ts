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
const bridgeCalls: BridgeCall[] = [];
let tornDown = false;
let currentForgeContext: ForgeContext | null = null;

// ── Bridge command handlers ─────────────────────────────────────────────

async function handleReconcile(data: any): Promise<void> {
  if (data?.forgeDoc) {
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

// ── Bridge dispatch ─────────────────────────────────────────────────────

const HANDLERS: Record<string, (data: any) => Promise<any>> = {
  reconcile: handleReconcile,
  invoke: handleInvoke,
  fetchProduct: handleFetchProduct,
  getContext: handleGetContext,
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

/** Wait for the next render (reconcile bridge call). */
export function waitForRender(): Promise<ForgeDoc> {
  return new Promise((resolve) => {
    renderResolvers.push(resolve);
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

/** Reset all UI state — marks bridge as torn down to swallow stale React effects. */
export function resetBridge(): void {
  tornDown = true;
  latestForgeDoc = null;
  renderResolvers = [];
  bridgeCalls.length = 0;
  currentForgeContext = null;
}

/** Full reset — disconnects simulator too. */
export function resetAll(): void {
  resetBridge();
  renderListeners = [];
  simulator = null;
}
