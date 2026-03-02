/**
 * Dev Server — WebSocket bridge between forge-sim and the UIKit renderer.
 *
 * Watches for ForgeDoc updates (from the reconciler bridge) and pushes
 * them to connected renderer clients in real-time.
 *
 * Also watches the app source directory for changes and triggers
 * re-deploy + re-render automatically.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { watch } from 'node:fs';
import { resolve, relative } from 'node:path';
import type { ForgeDoc } from './ui/bridge.js';

export interface DevServerOptions {
  /** WebSocket port (default: 5174) */
  port?: number;
  /** App source directory to watch for changes */
  watchDir?: string;
  /** Debounce interval for file changes in ms (default: 300) */
  debounceMs?: number;
  /** Called when a file change is detected — should re-deploy and return new ForgeDoc */
  onFileChange?: (changedFile: string) => Promise<ForgeDoc | null>;
}

export interface DevServer {
  /** Broadcast a ForgeDoc update to all connected renderers */
  broadcast(doc: ForgeDoc): void;
  /** Send an event to all connected renderers */
  sendEvent(event: DevEvent): void;
  /** Number of connected renderer clients */
  get clientCount(): number;
  /** Shut down the server */
  close(): void;
}

export type DevEvent =
  | { type: 'forgeDoc'; doc: ForgeDoc; timestamp: number }
  | { type: 'reloading'; file: string; timestamp: number }
  | { type: 'error'; message: string; timestamp: number }
  | { type: 'ready'; timestamp: number };

export function createDevServer(options: DevServerOptions = {}): DevServer {
  const {
    port = 5174,
    watchDir,
    debounceMs = 300,
    onFileChange,
  } = options;

  const wss = new WebSocketServer({ port });
  const clients = new Set<WebSocket>();
  let lastDoc: ForgeDoc | null = null;
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
      } satisfies DevEvent));
    }

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

  // ── Broadcast ───────────────────────────────────────────────────────

  function sendEvent(event: DevEvent) {
    const msg = JSON.stringify(event);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  function broadcast(doc: ForgeDoc) {
    // Strip function props — they can't be serialized to JSON
    lastDoc = stripFunctions(doc);
    sendEvent({
      type: 'forgeDoc',
      doc: lastDoc,
      timestamp: Date.now(),
    });
  }

  // ── File watcher ────────────────────────────────────────────────────

  if (watchDir) {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    watcher = watch(watchDir, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      // Skip node_modules, dist, dotfiles
      if (filename.includes('node_modules') || filename.includes('dist') || filename.startsWith('.')) return;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const fullPath = resolve(watchDir, filename);
        const relPath = relative(watchDir, fullPath);
        console.log(`[dev-server] File changed: ${relPath}`);

        sendEvent({ type: 'reloading', file: relPath, timestamp: Date.now() });

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
