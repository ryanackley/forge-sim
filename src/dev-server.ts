/**
 * Dev Server — WebSocket bridge between forge-sim and the UIKit renderer.
 *
 * Handles bidirectional communication:
 *   Server → Client: ForgeDoc updates, reload notifications, errors
 *   Client → Server: UI events (clicks, changes, form submits)
 *
 * The event bridge enables the full interactive loop:
 *   1. User interacts with rendered Atlaskit component
 *   2. Renderer sends event (handler ID + event name + args) via WebSocket
 *   3. Dev server looks up the original function by ID on the live ForgeDoc
 *   4. Calls the handler → triggers React state change → re-render
 *   5. New ForgeDoc pushed back to renderer
 */

import { WebSocketServer, WebSocket } from 'ws';
import { watch } from 'node:fs';
import { resolve, relative } from 'node:path';
import type { ForgeDoc } from './ui/bridge.js';
import {
  getSeededUsers,
  getSeededUserByAccountId,
  getDefaultSeededUser,
} from './seeded-users.js';
import type { ActingUser } from './seeded-users.js';

// ── Types ───────────────────────────────────────────────────────────────

export interface DevServerOptions {
  /** WebSocket port (default: 5174) */
  port?: number;
  /**
   * If true, fail when the requested port is in use instead of falling through
   * to the next free port. Use when the user explicitly set --ws-port and we
   * shouldn't silently change what they asked for. Default: false.
   */
  strictPort?: boolean;
  /** App source directory to watch for changes */
  watchDir?: string;
  /** Debounce interval for file changes in ms (default: 300) */
  debounceMs?: number;
  /** Called when a file change is detected — should re-deploy and return new ForgeDoc */
  onFileChange?: (changedFile: string) => Promise<ForgeDoc | null>;
  /** ForgeSimulator instance — required for browser mode RPC (invoke, fetchProduct, etc.) */
  simulator?: import('./simulator.js').ForgeSimulator;
  /** Simulated Forge context returned by getContext */
  context?: Record<string, any>;
}

/**
 * Try to bind a WebSocketServer on the given port. Resolves with the live
 * wss on success, or null on EADDRINUSE so the caller can try the next port.
 *
 * We can't pre-probe with a separate `net.createServer` — a probe-then-bind
 * sequence is race-prone. Instead, bind ws directly and wait for either the
 * 'listening' or 'error' event.
 *
 * Bound to loopback only: the bridge WS carries resolver invocations and
 * must never accept remote connections.
 */
function tryBindWebSocketServer(port: number): Promise<WebSocketServer | null> {
  return new Promise((resolve, reject) => {
    const wss = new WebSocketServer({ port, host: '127.0.0.1' });
    let settled = false;
    wss.once('listening', () => {
      if (settled) return;
      settled = true;
      resolve(wss);
    });
    wss.once('error', (err: any) => {
      if (settled) return;
      settled = true;
      // Make sure we don't leave a half-bound server hanging
      try { wss.close(); } catch {}
      if (err?.code === 'EADDRINUSE') {
        resolve(null);
      } else {
        reject(err);
      }
    });
  });
}

/**
 * Bind a WebSocketServer with port-fallback. Tries the requested port first;
 * on EADDRINUSE, scans up to 10 subsequent ports unless strictPort is set.
 */
async function bindWebSocketServer(
  requestedPort: number,
  strictPort: boolean,
): Promise<{ wss: WebSocketServer; port: number }> {
  const maxAttempts = strictPort ? 1 : 10;

  for (let i = 0; i < maxAttempts; i++) {
    const port = requestedPort + i;
    const wss = await tryBindWebSocketServer(port);
    if (!wss) continue;

    if (i > 0) {
      console.warn(
        `[forge-sim] port ${requestedPort} in use, using ${port} instead.`,
      );
    }
    return { wss, port };
  }

  if (strictPort) {
    throw new Error(
      `[forge-sim] WebSocket bridge port ${requestedPort} is already in use. ` +
      `Another forge-sim instance (or the daemon) may be running. ` +
      `Pass --ws-port <N> to choose a different port, or omit --ws-port to ` +
      `let forge-sim auto-pick the next free one.`,
    );
  }
  throw new Error(
    `[forge-sim] Could not bind WebSocket bridge: ports ${requestedPort}–${requestedPort + 9} are all in use.`,
  );
}

export interface DevServer {
  /** Broadcast a ForgeDoc update to all connected renderers */
  broadcast(doc: ForgeDoc, moduleKey?: string): void;
  /** Send an event to all connected renderers */
  sendEvent(event: ServerEvent): void;
  /** Number of connected renderer clients */
  get clientCount(): number;
  /** Port the WebSocket bridge is actually listening on (may differ from
   *  the requested port if it was taken). */
  readonly port: number;
  /** Shut down the server */
  close(): void;
}

/** Events sent from server to renderer */
export type ServerEvent =
  | { type: 'forgeDoc'; doc: ForgeDoc; timestamp: number }
  | { type: 'reloading'; file: string; timestamp: number }
  | { type: 'error'; message: string; timestamp: number }
  | { type: 'ready'; timestamp: number }
  | { type: 'eventResult'; requestId: string; success: boolean; error?: string; timestamp: number }
  | { type: 'realtime'; channel: string; channelKey: string; payload: string | Record<string, unknown>; global: boolean; eventId: string; timestamp: number };

/** Events sent from renderer to server */
export type ClientEvent =
  | { type: 'uiEvent'; requestId: string; handlerId: string; eventName: string; args: any[] }
  | { type: 'rpc'; requestId: string; method: string; params: any }
  | { type: 'historyEvent'; action: string; location: any }
  | { type: 'ping' };

// Keep the old name as an alias for backwards compat
export type DevEvent = ServerEvent;

// ── Function Registry ───────────────────────────────────────────────────

/**
 * Tracks all function references from the live ForgeDoc tree.
 * When we strip functions for serialization, we store them here keyed by __id__.
 * When the renderer fires an event, we look up the real function and call it.
 */
class FunctionRegistry {
  private fns = new Map<string, Function>();

  /** Walk a ForgeDoc tree and register all function props */
  register(doc: ForgeDoc): void {
    for (const [_key, value] of Object.entries(doc.props)) {
      if (typeof value === 'function' && value.__id__) {
        this.fns.set(value.__id__, value);
      }
    }
    for (const child of doc.children ?? []) {
      this.register(child);
    }
  }

  /** Look up a function by its __id__ */
  get(id: string): Function | undefined {
    return this.fns.get(id);
  }

  /** Clear all registered functions (on re-deploy) */
  clear(): void {
    this.fns.clear();
  }

  get size(): number {
    return this.fns.size;
  }
}

// ── Dev Server ──────────────────────────────────────────────────────────

export async function createDevServer(options: DevServerOptions = {}): Promise<DevServer> {
  const {
    port: requestedPort = 5174,
    strictPort = false,
    watchDir,
    debounceMs = 300,
    onFileChange,
    simulator,
    context,
  } = options;

  const { wss, port: actualPort } = await bindWebSocketServer(requestedPort, strictPort);
  const clients = new Set<WebSocket>();
  /** Track which module key each client is viewing */
  const clientModuleKeys = new Map<WebSocket, string>();
  const fnRegistry = new FunctionRegistry();
  /** Last ForgeDoc per module key (so new clients get the right one) */
  const lastDocs = new Map<string, ForgeDoc>();
  const lastRawDocs = new Map<string, ForgeDoc>();
  // Legacy single-doc for backward compat (MCP, single-module)
  let lastDoc: ForgeDoc | null = null;
  let lastRawDoc: ForgeDoc | null = null;
  let watcher: ReturnType<typeof watch> | null = null;

  // ── Custom field value store (persists across view/edit tab switches) ──
  const fieldValues = new Map<string, any>();

  // ── Macro config store (persists across view/config tab switches) ─────
  // Keyed by macro base key; value is the saved config object.
  const macroConfigs = new Map<string, Record<string, any>>();

  // ── Realtime event push (backend → browser over WS) ────────────────
  if (simulator?.realtime) {
    simulator.realtime.onPublish((event) => {
      const msg = JSON.stringify({
        type: 'realtime',
        channel: event.channel,
        channelKey: event.channelKey,
        payload: event.payload,
        global: event.global,
        eventId: event.eventId,
        timestamp: Date.now(),
      } satisfies ServerEvent);

      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(msg);
        }
      }
    });
  }

  // ── "Acting as" default (mode-aware) ────────────────────────────────
  // OFFLINE ONLY: seed the acting user to the default lead so the resolver
  // context accountId and the current-user route fallback are consistent
  // before any switch (matching the default row in the gear menu).
  //
  // CONNECTED: do NOT seed a fake. The authenticated PAT owner is the real
  // default identity — the base context already carries their accountId
  // (buildDefaultContext uses connectedAccount.accountId) and their /myself
  // is the live real one. Seeding sim-user-001 here was the "schizo" bug: it
  // stamped a fake accountId into a live session. currentUser stays null until
  // the dev explicitly picks someone from the (real user-search) dropdown.
  if (
    simulator &&
    !simulator.productApi.isRealMode &&
    !simulator.productApi.getCurrentUser()
  ) {
    simulator.productApi.setCurrentUser(getDefaultSeededUser());
  }

  // ── WebSocket handling ──────────────────────────────────────────────

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`[dev-server] Renderer connected (${clients.size} client${clients.size > 1 ? 's' : ''})`);

    // Note: we DON'T send lastDoc on connect anymore.
    // The client will identify its module via getContext RPC,
    // and we send the module-specific ForgeDoc after that.
    // This prevents cross-tab interference when multiple modules are open.

    // Handle incoming messages from renderer
    ws.on('message', (raw) => {
      try {
        const event: ClientEvent = JSON.parse(raw.toString());
        handleClientEvent(event, ws);
      } catch (err: any) {
        console.error('[dev-server] Failed to parse client message:', err.message);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      clientModuleKeys.delete(ws);
      console.log(`[dev-server] Renderer disconnected (${clients.size} client${clients.size > 1 ? 's' : ''})`);
    });

    ws.on('error', (err) => {
      console.error('[dev-server] WebSocket error:', err.message);
      clients.delete(ws);
      clientModuleKeys.delete(ws);
    });
  });

  wss.on('listening', () => {
    console.log(`[dev-server] WebSocket server listening on ws://localhost:${actualPort}`);
  });

  // ── RPC handler (browser mode) ─────────────────────────────────────

  /**
   * Resolve the ForgeContext for a module — the SINGLE source of truth used
   * by both the `getContext` RPC (what useProductContext/view.getContext see)
   * and the `invoke` RPC (what the resolver's req.context is built from).
   *
   * Keeping these on one code path is a parity requirement: in real Forge the
   * frontend context and the resolver's context.extension describe the same
   * placement. (0.1.1 eval HIGH-1: invoke used to drop context entirely, so
   * `context.extension.project.key` — the canonical Forge pattern — was
   * silently null in every resolver called through the UI bridge.)
   */
  async function resolveModuleContext(
    reqModuleKey: string | undefined,
    contextOptions: Record<string, any> | undefined,
  ): Promise<any> {
    const ctx = await buildBaseModuleContext(reqModuleKey, contextOptions);
    // Acting-user override. `productApi.currentUser` is the single source of
    // truth for "who am I" (see seeded-users.ts). Its accountId drives the
    // resolver context unless the caller supplied an explicit accountId via
    // URL/CLI context options — precedence: explicit contextOptions.accountId
    // > currentUser.accountId > whatever the base builder produced. Only
    // `accountId` is overridden: the real-Forge resolver context carries
    // nothing else about the user (name/email come from /rest/api/3/myself).
    if (ctx && typeof ctx === 'object') {
      const explicitAccountId = contextOptions?.accountId;
      if (explicitAccountId) {
        // An explicit accountId (URL `?context`/per-invoke) is the top of the
        // precedence chain — stamp it. The browser sends this flat (see
        // getContextFromURL), so buildForgeContext (which only promotes a
        // *nested* context.accountId) never applies it; do it here.
        ctx.accountId = explicitAccountId;
      } else {
        const currentUserId = simulator?.productApi.getCurrentUser()?.accountId;
        if (currentUserId) ctx.accountId = currentUserId;
      }
    }
    return ctx;
  }

  async function buildBaseModuleContext(
    reqModuleKey: string | undefined,
    contextOptions: Record<string, any> | undefined,
  ): Promise<any> {
    // If the client sent context options (from URL query params),
    // build a rich context using buildForgeContext
    if (contextOptions && simulator) {
      const { buildForgeContext } = await import('./context.js');
      // Look up the module type from the manifest if available
      const manifest = simulator.getManifest?.();
      const mod = manifest?.uiModules.find((m: any) => m.key === reqModuleKey);
      const moduleType = mod?.type ?? 'jira:issuePanel';
      return buildForgeContext(simulator, reqModuleKey ?? 'sim-module', moduleType, contextOptions);
    }

    // If the client sent a moduleKey, rebuild context for that module
    if (reqModuleKey && context) {
      const ctx = { ...context, moduleKey: reqModuleKey, extension: { ...context.extension } };
      // Inject stored field value for custom field modules
      const cfBaseKey = reqModuleKey.replace(/--(?:view|edit)$/, '');
      if (cfBaseKey !== reqModuleKey && fieldValues.has(cfBaseKey)) {
        ctx.extension.fieldValue = fieldValues.get(cfBaseKey);
      }
      // Inject stored config for macro modules. Two key shapes:
      //   - Custom config sub-modules:  "<base>--view" / "<base>--config"
      //     → strip the suffix to find the base key
      //   - Inline config:              flat "<key>" with stored config
      const macroBaseKey = reqModuleKey.replace(/--(?:view|config)$/, '');
      if (macroConfigs.has(macroBaseKey)) {
        ctx.extension.config = macroConfigs.get(macroBaseKey);
      } else if (macroConfigs.has(reqModuleKey)) {
        ctx.extension.config = macroConfigs.get(reqModuleKey);
      }
      return ctx;
    }

    // Fall back to the default context passed at startup
    if (context) return context;
    const { buildDefaultContext } = await import('./context.js');
    const account = simulator?.productApi.connectedAccount;
    return buildDefaultContext(reqModuleKey ?? 'sim-module', undefined, account);
  }

  async function handleRpc(method: string, params: any): Promise<any> {
    if (!simulator) {
      throw new Error(`No simulator connected. Pass { simulator } to createDevServer() for browser mode.`);
    }

    switch (method) {
      case 'invoke': {
        const { functionKey, payload, moduleKey, contextOptions } = params;
        // Thread the module's context to the resolver — same context object
        // the frontend sees via getContext, so `context.extension.*` (and
        // accountId/cloudId/siteUrl) match real Forge's resolver req.context.
        const ctx = await resolveModuleContext(moduleKey, contextOptions);
        return simulator.invoke(functionKey, payload, {
          moduleKey,
          context: {
            accountId: ctx.accountId,
            cloudId: ctx.cloudId,
            siteUrl: ctx.siteUrl,
          },
          ...(ctx.extension ? { extension: ctx.extension } : {}),
        });
      }

      case 'invokeRemote': {
        const { path, method, headers, body, moduleKey } = params;
        // Resolve endpoint from module context
        const endpointKey = moduleKey ? simulator.resolveModuleEndpoint(moduleKey) : undefined;
        // Look up module type for FIT claims
        const moduleType = moduleKey ? simulator.getModuleType(moduleKey) : undefined;
        return simulator.remotes.invokeFromBridge({ path, method, headers, body, endpointKey, moduleKey, moduleType });
      }

      case 'fetchRemote': {
        const { remoteKey, fetchRequestInit } = params;
        // path can come as a top-level param (renderer shim) or inside fetchRequestInit (real @forge/bridge)
        const path = params.path ?? fetchRequestInit?.path ?? '/';
        const response = await simulator.remotes.request(remoteKey, {
          path,
          method: fetchRequestInit?.method,
          headers: fetchRequestInit?.headers,
          body: fetchRequestInit?.body,
        });
        return {
          status: response.status,
          statusText: response.statusText,
          body: await response.text(),
          headers: response.headers,
        };
      }

      case 'fetchProduct': {
        const { product, restPath, fetchRequestInit } = params;
        const response = await simulator.productApi.request(product, restPath, {
          method: fetchRequestInit?.method,
          headers: fetchRequestInit?.headers,
          body: fetchRequestInit?.body,
        });
        return {
          status: response.status,
          statusText: response.statusText,
          body: await response.text(),
          headers: response.headers,
        };
      }

      case 'getContext': {
        const { moduleKey: reqModuleKey, contextOptions } = params ?? {};
        return resolveModuleContext(reqModuleKey, contextOptions);
      }

      case 'viewSubmit': {
        console.log(`[dev-server] View action: ${method}`, params);
        const submitModuleKey: string | undefined = params?.moduleKey ?? context?.moduleKey;
        const submitTree: 'view' | 'macroConfig' = params?.submitTree === 'macroConfig'
          ? 'macroConfig'
          : 'view';

        // For custom field edit modules, store the submitted value
        if (submitModuleKey && submitModuleKey.endsWith('--edit')) {
          const baseKey = submitModuleKey.replace(/--edit$/, '');
          const submittedValue = params?.payload;
          fieldValues.set(baseKey, submittedValue);
          console.log(`[dev-server] Custom field "${baseKey}" updated:`, submittedValue);
          // Broadcast to clients viewing this custom field (view or edit sub-modules, or the parent page)
          for (const client of clients) {
            if (client.readyState !== WebSocket.OPEN) continue;
            const clientKey = clientModuleKeys.get(client);
            // Send to clients viewing this field's view/edit or unidentified clients (parent pages)
            if (!clientKey || clientKey.startsWith(baseKey)) {
              client.send(JSON.stringify({
                type: 'fieldValueUpdate',
                fieldKey: baseKey,
                value: submittedValue,
              }));
            }
          }
        }

        // Decide whether this is a macro config save:
        //   1. Custom-config sub-module → key ends in --config
        //   2. Inline config → flat key + bridge tagged it as 'macroConfig'
        let macroBaseKey: string | undefined;
        if (submitModuleKey && submitModuleKey.endsWith('--config')) {
          macroBaseKey = submitModuleKey.replace(/--config$/, '');
        } else if (submitModuleKey && submitTree === 'macroConfig' && simulator) {
          // Look up the manifest to confirm it's an inline-config macro
          const manifest = simulator.getManifest?.();
          const mod = manifest?.uiModules.find((m: any) => m.key === submitModuleKey);
          if (mod && mod.type === 'macro' && mod.inlineMacroConfig === true) {
            macroBaseKey = submitModuleKey;
          }
        }

        if (macroBaseKey) {
          const submittedConfig = (params?.payload && typeof params.payload === 'object')
            ? params.payload
            : {};
          macroConfigs.set(macroBaseKey, submittedConfig);
          console.log(`[dev-server] Macro "${macroBaseKey}" config updated:`, submittedConfig);
          // Broadcast to clients viewing this macro (view/config sub-modules,
          // the parent page, or the inline-config iframe itself)
          for (const client of clients) {
            if (client.readyState !== WebSocket.OPEN) continue;
            const clientKey = clientModuleKeys.get(client);
            if (!clientKey || clientKey.startsWith(macroBaseKey)) {
              client.send(JSON.stringify({
                type: 'macroConfigUpdate',
                macroKey: macroBaseKey,
                config: submittedConfig,
              }));
            }
          }
        }
        return;
      }
      case 'viewClose':
      case 'viewRefresh':
        console.log(`[dev-server] View action: ${method}`, params);
        return;

      case 'modalOpen':
      case 'modalClose':
        console.log(`[dev-server] Modal action: ${method}`, params);
        return;

      case 'flagShow':
        console.log(`[dev-server] Flag:`, params);
        return;

      case 'eventEmit':
        console.log(`[dev-server] Event: ${params?.event}`, params?.payload);
        return;

      case 'realtimePublish': {
        const { channel, payload, global: isGlobal, moduleKey, options } = params;
        if (isGlobal) {
          return simulator.realtime.publishGlobalFromBridge(channel, payload, options);
        } else {
          return simulator.realtime.publishFromBridge(channel, payload, moduleKey ?? null, options);
        }
      }

      // ── "Acting as" user switcher (gear menu) ─────────────────────────
      // Mode-aware. OFFLINE the dropdown works off the seeded roster
      // (forge-sim's no-cloud differentiator). CONNECTED it searches REAL
      // users off the site so a live session never carries a fake accountId.
      // Roster + search live server-side only; the renderer drives everything
      // through these RPCs (no cross-package coupling, no duplicated roster).
      case 'getActingUserState': {
        const isReal = simulator.productApi.isRealMode;
        const current = simulator.productApi.getCurrentUser();
        // "current" for the menu highlight. If nobody's been picked yet in
        // connected mode, that's the authenticated PAT owner, derived from
        // the account (no network call). Offline, startup seeding guarantees
        // a current, but fall back to the default lead defensively.
        let effectiveCurrent: ActingUser | null = current;
        if (!effectiveCurrent) {
          if (isReal) {
            const acct = simulator.productApi.connectedAccount;
            if (acct) {
              effectiveCurrent = {
                accountId: acct.accountId,
                displayName: acct.name,
                emailAddress: acct.email,
              };
            }
          } else {
            effectiveCurrent = getDefaultSeededUser();
          }
        }
        return {
          mode: isReal ? 'connected' : 'offline',
          current: effectiveCurrent,
          // Offline: seed the dropdown with the whole roster so it's useful
          // before the dev types. Connected: empty — you search live.
          users: isReal ? [] : getSeededUsers(),
          // The site backing the live search (connected only) — powers the
          // "Live users from <site>" hint in the gear menu.
          site: isReal ? (simulator.productApi.connectedAccount?.site ?? null) : null,
        };
      }

      case 'searchUsers': {
        const query: string = (params?.query ?? '').toString();
        if (simulator.productApi.isRealMode) {
          // Proxy the real Jira user picker. accountIds are site-wide (same
          // in Jira and Confluence), so this supplies valid ids for any app.
          const q = encodeURIComponent(query);
          const res = await simulator.productApi.request(
            'jira',
            `/rest/api/3/user/picker?query=${q}&maxResults=20`,
          );
          if (!res.ok) {
            return { mode: 'connected', users: [], error: `user picker failed (${res.status})` };
          }
          const body = await res.json().catch(() => null);
          const users: ActingUser[] = (body?.users ?? []).map((u: any) => ({
            accountId: u.accountId,
            displayName: u.displayName,
            ...(u.avatarUrl ? { avatarUrl: u.avatarUrl } : {}),
          }));
          return { mode: 'connected', users };
        }
        // Offline: filter the seeded roster on name / role / email.
        const needle = query.trim().toLowerCase();
        const roster = getSeededUsers();
        const users = needle
          ? roster.filter(
              (u) =>
                u.displayName.toLowerCase().includes(needle) ||
                u.role.toLowerCase().includes(needle) ||
                u.emailAddress.toLowerCase().includes(needle),
            )
          : roster;
        return { mode: 'offline', users };
      }

      case 'setActingUser': {
        // Accept a bare accountId (offline convenience) or a full picked user
        // object (connected — a real accountId can't reconstruct a person, so
        // the renderer sends the whole picked object it got from searchUsers).
        const isReal = simulator.productApi.isRealMode;
        const rawUser = params?.user;
        const accountId: string | undefined = params?.accountId ?? rawUser?.accountId;

        // Clearing the override → revert to the mode default: the real PAT
        // owner when connected (currentUser null), the seeded lead offline.
        if (!accountId) {
          simulator.productApi.setCurrentUser(isReal ? null : getDefaultSeededUser());
          return { ok: true };
        }

        if (isReal) {
          // The picked object came from our own searchUsers proxy of the real
          // picker, so trust it — just require an accountId + displayName.
          if (!rawUser?.displayName) {
            throw new Error(
              `setActingUser (connected mode) requires a full user object with a displayName`,
            );
          }
          const user: ActingUser = {
            accountId,
            displayName: rawUser.displayName,
            ...(rawUser.emailAddress ? { emailAddress: rawUser.emailAddress } : {}),
            ...(rawUser.avatarUrl ? { avatarUrl: rawUser.avatarUrl } : {}),
          };
          simulator.productApi.setCurrentUser(user);
          return { ok: true };
        }

        // Offline: validate against the seeded roster.
        const seeded = getSeededUserByAccountId(accountId);
        if (!seeded) {
          throw new Error(
            `Unknown seeded user accountId: ${JSON.stringify(accountId)}. ` +
              `Valid ids: ${getSeededUsers().map((u) => u.accountId).join(', ')}`,
          );
        }
        simulator.productApi.setCurrentUser(seeded);
        return { ok: true };
      }

      default:
        console.warn(`[dev-server] Unknown RPC method: ${method}`);
        throw new Error(`Unknown RPC method: ${method}`);
    }
  }

  // ── Client event handling ───────────────────────────────────────────

  // ── History WS proxy (headless/MCP mode only) ───────────────────
  // In the normal dev server flow, both UIKit and Custom UI app code runs
  // in the browser, so createHistory uses window.history directly (no WS needed).
  // This WS proxy is only used when the server-side bridge (ui/bridge.ts)
  // handles createHistory in headless/MCP mode without a browser.

  let historyRequestCounter = 0;
  const historyPendingRequests = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void }>();

  // Wire up the history WS sender (lazy — only loads bridge if history is used)
  let historyBridgeWired = false;
  function ensureHistoryBridge() {
    if (historyBridgeWired) return;
    historyBridgeWired = true;
    import('./ui/bridge.js').then(({ setHistoryWsSender }) => {
      setHistoryWsSender(async (cmd: string, data: any) => {
        const client = [...clients].find(c => c.readyState === WebSocket.OPEN);
        if (!client) {
          console.warn(`[dev-server] No browser connected for ${cmd}`);
          return;
        }
        const requestId = `hist-${++historyRequestCounter}`;
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            historyPendingRequests.delete(requestId);
            reject(new Error(`History command timeout: ${cmd}`));
          }, 5000);
          historyPendingRequests.set(requestId, {
            resolve: (v) => { clearTimeout(timeout); resolve(v); },
            reject: (e) => { clearTimeout(timeout); reject(e); },
          });
          client.send(JSON.stringify({ type: 'historyCommand', requestId, cmd, data }));
        });
      });
    });
  }

  // Eagerly wire it if a simulator is connected (UIKit mode)
  if (simulator) ensureHistoryBridge();

  async function notifyHistoryFromBrowser(action: string, location: any) {
    const { notifyHistoryListeners } = await import('./ui/bridge.js');
    notifyHistoryListeners(action, location);
  }

  async function handleClientEvent(event: ClientEvent, ws: WebSocket) {
    if (event.type === 'ping') return;

    // (forgeEvent relay removed — events now use postMessage between iframes)

    // ── History events from browser (popstate → server) ─────────────
    if (event.type === 'historyEvent') {
      notifyHistoryFromBrowser(event.action, event.location);
      return;
    }

    // ── History command acknowledgements (browser → server) ──────────
    if ((event as any).type === 'historyAck') {
      const { requestId, location, action } = event as any;
      const pending = historyPendingRequests.get(requestId);
      if (pending) {
        historyPendingRequests.delete(requestId);
        notifyHistoryFromBrowser(action, location);
        pending.resolve(undefined);
      }
      return;
    }

    // ── RPC from browser bridge shim ────────────────────────────────
    if (event.type === 'rpc') {
      const { requestId, method, params } = event;
      // Per-RPC logging is noisy (fires on every getContext/invoke/reconcile).
      // Silent by default; set FORGE_SIM_DEBUG=1 to trace. Errors still log below.
      if (process.env.FORGE_SIM_DEBUG) console.log(`[dev-server] RPC: ${method}`);

      // Track which module this client is viewing
      const isNewClient = !clientModuleKeys.has(ws);
      if (params?.moduleKey) {
        clientModuleKeys.set(ws, params.moduleKey);
      }

      try {
        const result = await handleRpc(method, params);
        ws.send(JSON.stringify({ requestId, result }));

        // After first RPC identifies the client's module, send its ForgeDoc
        if (isNewClient && params?.moduleKey) {
          const moduleDoc = lastDocs.get(params.moduleKey) ?? lastDoc;
          if (moduleDoc) {
            ws.send(JSON.stringify({
              type: 'forgeDoc',
              doc: moduleDoc,
              timestamp: Date.now(),
            }));
          }
        }
      } catch (err: any) {
        console.error(`[dev-server] RPC error (${method}):`, err.message);
        ws.send(JSON.stringify({ requestId, error: err.message }));
      }
      return;
    }

    if (event.type === 'uiEvent') {
      const { requestId, handlerId, eventName, args } = event;
      console.log(`[dev-server] UI event: ${eventName} → ${handlerId}`);

      const fn = fnRegistry.get(handlerId);
      if (!fn) {
        console.warn(`[dev-server] No handler found for ID: ${handlerId}`);
        ws.send(JSON.stringify({
          type: 'eventResult',
          requestId,
          success: false,
          error: `Handler not found: ${handlerId}`,
          timestamp: Date.now(),
        } satisfies ServerEvent));
        return;
      }

      try {
        // Call the actual handler function from the live ForgeDoc
        await fn(...deserializeArgs(args));

        ws.send(JSON.stringify({
          type: 'eventResult',
          requestId,
          success: true,
          timestamp: Date.now(),
        } satisfies ServerEvent));

        // The handler likely triggered a state change → React will re-render
        // → reconciler will call bridge.reconcile → we'll get a new ForgeDoc
        // That's handled by whoever calls broadcast() after the render
      } catch (err: any) {
        console.error(`[dev-server] Handler error (${handlerId}):`, err.message);
        ws.send(JSON.stringify({
          type: 'eventResult',
          requestId,
          success: false,
          error: err.message,
          timestamp: Date.now(),
        } satisfies ServerEvent));
      }
    }
  }

  // ── Broadcast ───────────────────────────────────────────────────────

  function sendEvent(event: ServerEvent) {
    const msg = JSON.stringify(event);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  /**
   * Broadcast a new ForgeDoc. If moduleKey is known, only send to clients
   * viewing that module. Otherwise broadcast to all (backward compat).
   */
  function broadcast(doc: ForgeDoc, moduleKey?: string) {
    // Register all function props from the live doc BEFORE stripping
    lastRawDoc = doc;
    fnRegistry.register(doc);

    // Strip function props for serialization
    lastDoc = stripFunctions(doc);
    if (moduleKey) {
      lastDocs.set(moduleKey, lastDoc);
      lastRawDocs.set(moduleKey, doc);
    }

    const msg = JSON.stringify({
      type: 'forgeDoc',
      doc: lastDoc,
      timestamp: Date.now(),
    });

    // Scoped send: only to clients viewing this module (or all if no key)
    for (const client of clients) {
      if (client.readyState !== WebSocket.OPEN) continue;
      if (moduleKey) {
        const clientKey = clientModuleKeys.get(client);
        if (clientKey && clientKey !== moduleKey) continue;
      }
      client.send(msg);
    }

    console.log(`[dev-server] Broadcast ForgeDoc${moduleKey ? ` [${moduleKey}]` : ''} (${fnRegistry.size} handlers registered)`);
  }

  // ── File watcher ────────────────────────────────────────────────────

  if (watchDir) {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    watcher = watch(watchDir, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      if (filename.includes('node_modules') || filename.includes('dist') || filename.startsWith('.')) return;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const fullPath = resolve(watchDir, filename);
        const relPath = relative(watchDir, fullPath);
        console.log(`[dev-server] File changed: ${relPath}`);

        sendEvent({ type: 'reloading', file: relPath, timestamp: Date.now() });

        // Clear function registry — old handlers are stale after re-deploy
        fnRegistry.clear();

        if (onFileChange) {
          try {
            const newDoc = await onFileChange(relPath);
            if (newDoc) broadcast(newDoc);
            // Always signal ready on success — backend hot-redeploy returns
            // null (no server-side ForgeDoc; the browser owns rendering),
            // but renderers still need the 'reloading' state cleared.
            sendEvent({ type: 'ready', timestamp: Date.now() });
          } catch (err: any) {
            console.error(`[dev-server] Re-deploy error:`, err.message);
            sendEvent({ type: 'error', message: err.message, timestamp: Date.now() });
          }
        }
      }, debounceMs);
    });

    console.log(`[dev-server] Watching ${watchDir} for changes`);
  }

  // ── Cleanup ─────────────────────────────────────────────────────────

  function close() {
    if (watcher) watcher.close();
    for (const client of clients) client.close();
    wss.close();
    fnRegistry.clear();
    console.log('[dev-server] Shut down');
  }

  return {
    broadcast,
    sendEvent,
    get clientCount() { return clients.size; },
    port: actualPort,
    close,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────

/** Deep-clone a ForgeDoc, replacing functions with serializable markers. */
function stripFunctions(doc: ForgeDoc): ForgeDoc {
  const props: Record<string, any> = {};
  for (const [key, value] of Object.entries(doc.props)) {
    if (typeof value === 'function') {
      props[key] = `__fn__:${value.__id__ ?? key}`;
    } else {
      props[key] = value;
    }
  }
  return {
    type: doc.type,
    props,
    children: doc.children.map(stripFunctions),
    key: doc.key,
    ...(doc.forgeReactMajorVersion != null ? { forgeReactMajorVersion: doc.forgeReactMajorVersion } : {}),
  };
}

/**
 * Deserialize event arguments from the renderer.
 * Most args are plain JSON. Special cases:
 * - Synthetic events → we pass a minimal event-like object
 * - undefined/null → passed through
 */
function deserializeArgs(args: any[]): any[] {
  return args.map((arg) => {
    if (arg === null || arg === undefined) return arg;
    // If the renderer sent a synthetic event marker, create a minimal event-like object
    if (arg?.__syntheticEvent) {
      return {
        target: arg.target ?? {},
        currentTarget: arg.currentTarget ?? {},
        preventDefault: () => {},
        stopPropagation: () => {},
        type: arg.eventType ?? 'unknown',
      };
    }
    return arg;
  });
}
