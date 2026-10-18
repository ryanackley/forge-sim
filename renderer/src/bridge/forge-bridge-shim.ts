/**
 * forge-sim chrome hooks — what forge-sim's OWN UI (ForgeSimShell,
 * ForgeSimModulePage, GearPopover, component-map) uses to talk to the dev
 * server and read the reconcile stream.
 *
 * This file is NOT `@forge/bridge`. App code — source-mode and prebuilt
 * alike — imports the real package, which talks to `window.__bridge`,
 * installed by the browser bridge host (`src/bridge/hosts/browser`, served
 * as /__forge/bridge.js) ahead of all app code. That host also exposes
 * `window.__forgeSimBridge` for the chrome; everything here reads it.
 *
 * Under jsdom (renderer unit tests) no bundle is loaded, so a minimal local
 * stand-in is installed that supports exactly what those tests drive —
 * reconcile capture with replay, the active submit tree, and an RPC that
 * rejects — with its state on `globalThis.__forgeSim` so the existing
 * tests can reset it between cases.
 *
 * The few Forge-shaped helpers at the bottom (`view`, `requestJira`) exist
 * because the shell and component-map call them; they send the real
 * package's frames through `window.__bridge` like any app would.
 */

type ReconcileListener = (forgeDoc: any) => void;

/** What the bundle exposes for forge-sim's own UI (see src/bridge/hosts/browser/entry.ts). */
interface ForgeSimBridgeHooks {
  onReconcile(fn: ReconcileListener): () => void;
  onMacroConfigReconcile(fn: ReconcileListener): () => void;
  getLatestForgeDoc(): unknown;
  getLatestMacroConfigDoc(): unknown;
  rpc(method: string, params?: Record<string, unknown>): Promise<any>;
  setActiveSubmitTree(tree: 'view' | 'macroConfig'): void;
}

const G = globalThis as any;

// ── Shared state (jsdom stand-in; also what tests reset) ────────────────

if (!G.__forgeSim) {
  G.__forgeSim = {
    reconcileListeners: [] as ReconcileListener[],
    lastForgeDoc: null as any,
    macroConfigReconcileListeners: [] as ReconcileListener[],
    lastMacroConfigDoc: null as any,
    /** Which reconcile tree the next view.submit() belongs to (macro inline config). */
    activeSubmitTree: 'view' as 'view' | 'macroConfig',
  };
}

/**
 * The hooks object: the bundle's when a dev page loaded it, otherwise a local
 * stand-in (jsdom). Resolved lazily on every call so a test that installs
 * its own `window.__bridge` before importing this module is honoured.
 */
function hooks(): ForgeSimBridgeHooks {
  if (G.__forgeSimBridge) return G.__forgeSimBridge as ForgeSimBridgeHooks;
  return localStandIn();
}

let standIn: ForgeSimBridgeHooks | null = null;
function localStandIn(): ForgeSimBridgeHooks {
  if (standIn) return standIn;
  const S = G.__forgeSim;
  const dispatch = (listeners: ReconcileListener[], doc: any) => {
    for (const fn of [...listeners]) { try { fn(doc); } catch {} }
  };
  standIn = {
    onReconcile(fn) {
      S.reconcileListeners.push(fn);
      if (S.lastForgeDoc) { try { fn(S.lastForgeDoc); } catch {} }
      return () => { const i = S.reconcileListeners.indexOf(fn); if (i >= 0) S.reconcileListeners.splice(i, 1); };
    },
    onMacroConfigReconcile(fn) {
      S.macroConfigReconcileListeners.push(fn);
      if (S.lastMacroConfigDoc) { try { fn(S.lastMacroConfigDoc); } catch {} }
      return () => { const i = S.macroConfigReconcileListeners.indexOf(fn); if (i >= 0) S.macroConfigReconcileListeners.splice(i, 1); };
    },
    getLatestForgeDoc: () => S.lastForgeDoc,
    getLatestMacroConfigDoc: () => S.lastMacroConfigDoc,
    rpc: (method) => Promise.reject(new Error(`[forge-sim] No dev server in this environment (rpc "${method}")`)),
    setActiveSubmitTree: (tree) => { S.activeSubmitTree = tree; },
  };
  // A minimal window.__bridge so @forge/react's reconcile has somewhere to go.
  if (!G.__bridge) {
    G.__bridge = {
      callBridge(cmd: string, data?: any): Promise<any> {
        switch (cmd) {
          case 'reconcile': {
            const doc = data?.forgeDoc;
            if (!doc) return Promise.resolve();
            if (doc.type === 'MacroConfig') { S.lastMacroConfigDoc = doc; dispatch(S.macroConfigReconcileListeners, doc); }
            else { S.lastForgeDoc = doc; dispatch(S.reconcileListeners, doc); }
            return Promise.resolve();
          }
          case 'getContext':
            return standIn!.rpc('getContext');
          case 'submit':
          case 'close':
          case 'onClose':
          case 'onError':
          case 'trackObjectStoreAction':
            return Promise.resolve();
          default:
            return Promise.reject(new Error(`[forge-sim] Bridge command "${cmd}" is not available without the dev server bundle.`));
        }
      },
    };
    if (typeof window !== 'undefined') (window as any).__bridge = G.__bridge;
  }
  return standIn;
}

/** The one seam: whatever installed window.__bridge (the bundle, or the stand-in). */
function callBridge(cmd: string, data?: any): Promise<any> {
  const bridge = G.__bridge ?? (localStandIn(), G.__bridge);
  return bridge.callBridge(cmd, data);
}

// ── Chrome hooks (ForgeSimShell, ForgeSimModulePage, GearPopover) ────────

export function onReconcile(listener: ReconcileListener): () => void {
  return hooks().onReconcile(listener);
}

export function onMacroConfigReconcile(listener: ReconcileListener): () => void {
  return hooks().onMacroConfigReconcile(listener);
}

/** Called by the shell whenever the user switches between View and Config tabs. */
export function setActiveSubmitTree(tree: 'view' | 'macroConfig') {
  G.__forgeSim.activeSubmitTree = tree;
  hooks().setActiveSubmitTree(tree);
}

/**
 * Raw dev-server RPC for forge-sim's own chrome (`getActingUserState`,
 * `searchUsers`, `setActingUser`, i18n). Not a Forge bridge command.
 */
export function rpc(method: string, params: any = {}): Promise<any> {
  return hooks().rpc(method, params);
}

// ── Forge-shaped helpers the chrome itself calls ─────────────────────────
// Same frames real @forge/bridge sends (out/view/*.js, out/fetch/fetch.js).

export const view = {
  getContext: () => callBridge('getContext'),
  /** Bare payload, as out/view/submit.js sends it. */
  submit: (payload?: any) => callBridge('submit', payload),
  close: (payload?: any) => callBridge('close', payload),
};

/** requestJira for the renderer's own user lookups (component-map User/UserPicker). */
export async function requestJira(restPath: string, fetchOptions?: RequestInit): Promise<Response> {
  const result = await callBridge('fetchProduct', {
    product: 'jira',
    restPath,
    fetchRequestInit: fetchOptions ? {
      method: fetchOptions.method,
      headers: fetchOptions.headers,
      body: fetchOptions.body,
    } : undefined,
  });
  return new Response(result.body, { status: result.status, statusText: result.statusText, headers: result.headers });
}
