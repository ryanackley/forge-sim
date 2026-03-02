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

// ── Types ───────────────────────────────────────────────────────────────

export interface DevServerOptions {
  /** WebSocket port (default: 5174) */
  port?: number;
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

export interface DevServer {
  /** Broadcast a ForgeDoc update to all connected renderers */
  broadcast(doc: ForgeDoc): void;
  /** Send an event to all connected renderers */
  sendEvent(event: ServerEvent): void;
  /** Number of connected renderer clients */
  get clientCount(): number;
  /** Shut down the server */
  close(): void;
}

/** Events sent from server to renderer */
export type ServerEvent =
  | { type: 'forgeDoc'; doc: ForgeDoc; timestamp: number }
  | { type: 'reloading'; file: string; timestamp: number }
  | { type: 'error'; message: string; timestamp: number }
  | { type: 'ready'; timestamp: number }
  | { type: 'eventResult'; requestId: string; success: boolean; error?: string; timestamp: number };

/** Events sent from renderer to server */
export type ClientEvent =
  | { type: 'uiEvent'; requestId: string; handlerId: string; eventName: string; args: any[] }
  | { type: 'rpc'; requestId: string; method: string; params: any }
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

export function createDevServer(options: DevServerOptions = {}): DevServer {
  const {
    port = 5174,
    watchDir,
    debounceMs = 300,
    onFileChange,
    simulator,
    context,
  } = options;

  const wss = new WebSocketServer({ port });
  const clients = new Set<WebSocket>();
  const fnRegistry = new FunctionRegistry();
  let lastDoc: ForgeDoc | null = null;
  let lastRawDoc: ForgeDoc | null = null;
  let watcher: ReturnType<typeof watch> | null = null;

  // ── WebSocket handling ──────────────────────────────────────────────

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`[dev-server] Renderer connected (${clients.size} client${clients.size > 1 ? 's' : ''})`);

    // Send the last known ForgeDoc immediately so the renderer catches up
    if (lastDoc) {
      ws.send(JSON.stringify({
        type: 'forgeDoc',
        doc: lastDoc,
        timestamp: Date.now(),
      } satisfies ServerEvent));
    }

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
      console.log(`[dev-server] Renderer disconnected (${clients.size} client${clients.size > 1 ? 's' : ''})`);
    });

    ws.on('error', (err) => {
      console.error('[dev-server] WebSocket error:', err.message);
      clients.delete(ws);
    });
  });

  wss.on('listening', () => {
    console.log(`[dev-server] WebSocket server listening on ws://localhost:${port}`);
  });

  // ── RPC handler (browser mode) ─────────────────────────────────────

  async function handleRpc(method: string, params: any): Promise<any> {
    if (!simulator) {
      throw new Error(`No simulator connected. Pass { simulator } to createDevServer() for browser mode.`);
    }

    switch (method) {
      case 'invoke': {
        const { functionKey, payload } = params;
        return simulator.invoke(functionKey, payload);
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
        return context ?? {
          accountId: 'sim-user-001',
          cloudId: 'sim-cloud-001',
          siteUrl: 'https://sim-site.atlassian.net',
          moduleKey: 'sim-module',
          environmentId: 'sim-env',
          environmentType: 'DEVELOPMENT',
          localId: 'sim-local',
          locale: 'en-US',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          extension: {},
        };
      }

      case 'viewSubmit':
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

      default:
        console.warn(`[dev-server] Unknown RPC method: ${method}`);
        throw new Error(`Unknown RPC method: ${method}`);
    }
  }

  // ── Client event handling ───────────────────────────────────────────

  async function handleClientEvent(event: ClientEvent, ws: WebSocket) {
    if (event.type === 'ping') return;

    // ── RPC from browser bridge shim ────────────────────────────────
    if (event.type === 'rpc') {
      const { requestId, method, params } = event;
      console.log(`[dev-server] RPC: ${method}`);

      try {
        const result = await handleRpc(method, params);
        ws.send(JSON.stringify({ requestId, result }));
      } catch (err: any) {
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

  function broadcast(doc: ForgeDoc) {
    // Register all function props from the live doc BEFORE stripping
    lastRawDoc = doc;
    fnRegistry.register(doc);

    // Strip function props for serialization
    lastDoc = stripFunctions(doc);
    sendEvent({
      type: 'forgeDoc',
      doc: lastDoc,
      timestamp: Date.now(),
    });

    console.log(`[dev-server] Broadcast ForgeDoc (${fnRegistry.size} handlers registered)`);
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
            if (newDoc) {
              broadcast(newDoc);
              sendEvent({ type: 'ready', timestamp: Date.now() });
            }
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
