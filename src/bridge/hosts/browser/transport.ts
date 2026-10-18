/**
 * WebSocket RPC transport for the browser host.
 *
 * One socket per frame, shared by every bridge command that needs the dev
 * server. Also carries two server-pushed streams the host subscribes to:
 * realtime events (filtered by channel key) and history commands.
 */

export type ServerPush = (msg: Record<string, any>) => void;

export interface Transport {
  rpc(method: string, params?: Record<string, unknown>): Promise<any>;
  /** Observe every server message that is not an RPC reply. */
  onPush(fn: ServerPush): () => void;
}

/** Matches the dev server's own RPC timeout (900s: scheduled fns can be slow). */
const RPC_TIMEOUT_MS = 900_000;
const RECONNECT_MS = 2_000;

export function createTransport(wsUrl: string): Transport {
  let ws: WebSocket | null = null;
  let ready = false;
  let counter = 0;
  const pending = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void }>();
  const pushListeners = new Set<ServerPush>();

  function connect(): Promise<void> {
    if (ws && ready) return Promise.resolve();
    return new Promise((resolve, reject) => {
      if (ws && ws.readyState === WebSocket.CONNECTING) {
        ws.addEventListener('open', () => resolve(), { once: true });
        return;
      }
      ws = new WebSocket(wsUrl);
      ws.onopen = () => { ready = true; resolve(); };
      ws.onmessage = (event: MessageEvent) => {
        let msg: any;
        try { msg = JSON.parse(event.data); } catch { return; }
        if (msg.requestId && pending.has(msg.requestId)) {
          const p = pending.get(msg.requestId)!;
          pending.delete(msg.requestId);
          if (msg.error) p.reject(new Error(msg.error));
          else p.resolve(msg.result);
          return;
        }
        for (const fn of pushListeners) {
          try { fn(msg); } catch (err) { console.error('[forge-sim bridge] push listener error:', err); }
        }
      };
      ws.onclose = () => {
        ready = false;
        for (const [id, p] of pending) {
          p.reject(new Error('WebSocket disconnected'));
          pending.delete(id);
        }
        setTimeout(() => { void connect().catch(() => {}); }, RECONNECT_MS);
      };
      ws.onerror = () => { ready = false; reject(new Error('WebSocket connection failed')); };
    });
  }

  return {
    async rpc(method, params = {}) {
      await connect();
      const requestId = `rpc-${++counter}-${Date.now()}`;
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(requestId);
          reject(new Error(`RPC timeout: ${method}`));
        }, RPC_TIMEOUT_MS);
        pending.set(requestId, {
          resolve: (v) => { clearTimeout(timeout); resolve(v); },
          reject: (e) => { clearTimeout(timeout); reject(e); },
        });
        ws!.send(JSON.stringify({ type: 'rpc', requestId, method, params }));
      });
    },
    onPush(fn) {
      pushListeners.add(fn);
      return () => pushListeners.delete(fn);
    },
  };
}
