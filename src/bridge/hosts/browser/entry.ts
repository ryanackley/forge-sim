/**
 * Browser bridge bundle entry — built to `dist/bridge.js` and served at
 * `/__forge/bridge.js`.
 *
 * Installs `window.__bridge` BEFORE any app code runs. It is injected as a
 * classic `<script src>` with no `async`/`defer`, which the HTML spec
 * requires the parser to fetch and execute synchronously at that point — the
 * same ordering guarantee the old inline string had, which real
 * `@forge/bridge`'s `getCallBridge()` depends on.
 *
 * Also exposes `window.__forgeSimBridge` for forge-sim's OWN chrome (the
 * renderer shell, gear popover, acting-user switcher): a reconcile listener
 * and the raw RPC function. App code never touches it.
 */

import { createBridgeDispatcher } from '../../protocol/index.js';
import { createTransport } from './transport.js';
import { createBrowserHost } from './host.js';
import { isInModalFrame } from './modal.js';
import { readContextOptionsFromUrl } from './context.js';

declare global {
  interface Window {
    __bridge?: { callBridge: (cmd: string, data?: unknown) => Promise<unknown> };
    __forgeSimBridge?: ForgeSimBridgeHooks;
    __FORGE_SIM_BRIDGE_CONFIG__?: { wsPort: number; defaultModuleKey: string | null; history?: 'browser' | 'memory' };
  }
}

type ReconcileListener = (doc: unknown) => void;

/** What forge-sim's own UI consumes. Not part of the Forge app surface. */
export interface ForgeSimBridgeHooks {
  onReconcile(fn: ReconcileListener): () => void;
  onMacroConfigReconcile(fn: ReconcileListener): () => void;
  /** Latest doc for a listener that attached after the first render. */
  getLatestForgeDoc(): unknown;
  getLatestMacroConfigDoc(): unknown;
  /** Raw dev-server RPC, for chrome that is not a Forge bridge command. */
  rpc(method: string, params?: Record<string, unknown>): Promise<any>;
  /** Tag which reconcile tree a subsequent view.submit() belongs to. */
  setActiveSubmitTree(tree: 'view' | 'macroConfig'): void;
}

function moduleKey(): string | undefined {
  const fromUrl = /^\/module\/([^/]+)/.exec(window.location.pathname)?.[1];
  // Proxied pages (forge-sim dev --proxy) are served from the app's own dev
  // server, so the path carries no module key; the injector supplies one.
  return fromUrl ?? window.__FORGE_SIM_BRIDGE_CONFIG__?.defaultModuleKey ?? undefined;
}


function install(): void {
  const config = window.__FORGE_SIM_BRIDGE_CONFIG__;
  if (!config) {
    console.error('[forge-sim] bridge config missing — window.__FORGE_SIM_BRIDGE_CONFIG__ must be set before this script.');
    return;
  }
  const transport = createTransport(`ws://${window.location.hostname}:${config.wsPort}`);

  const viewListeners = new Set<ReconcileListener>();
  const configListeners = new Set<ReconcileListener>();
  let latestDoc: unknown = null;
  let latestConfigDoc: unknown = null;
  let activeSubmitTree: 'view' | 'macroConfig' = 'view';

  const host = createBrowserHost({
    transport,
    getModuleKey: moduleKey,
    getContextOptions: readContextOptionsFromUrl,
    getSubmitTree: () => activeSubmitTree,
    isInModal: isInModalFrame,
    historyMode: config.history ?? 'browser',
    onReconcile(doc, kind) {
      const [store, listeners] = kind === 'macroConfig'
        ? ['config', configListeners] as const
        : ['view', viewListeners] as const;
      if (store === 'config') latestConfigDoc = doc; else latestDoc = doc;
      for (const fn of listeners) {
        try { fn(doc); } catch (err) { console.error('[forge-sim] reconcile listener error:', err); }
      }
    },
  });

  window.__bridge = createBridgeDispatcher(host);

  const hooks: ForgeSimBridgeHooks = {
    onReconcile(fn) {
      viewListeners.add(fn);
      if (latestDoc) { try { fn(latestDoc); } catch {} }
      return () => viewListeners.delete(fn);
    },
    onMacroConfigReconcile(fn) {
      configListeners.add(fn);
      if (latestConfigDoc) { try { fn(latestConfigDoc); } catch {} }
      return () => configListeners.delete(fn);
    },
    getLatestForgeDoc: () => latestDoc,
    getLatestMacroConfigDoc: () => latestConfigDoc,
    rpc: (method, params) => transport.rpc(method, params),
    setActiveSubmitTree: (tree) => { activeSubmitTree = tree; },
  };
  window.__forgeSimBridge = hooks;
}

install();
