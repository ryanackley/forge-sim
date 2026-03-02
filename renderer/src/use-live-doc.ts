/**
 * useLiveDoc — React hook that connects to forge-sim's dev server
 * via WebSocket for bidirectional communication:
 *   - Receives live ForgeDoc updates
 *   - Sends UI events (clicks, changes) back to forge-sim
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ForgeDoc } from './types';

// ── Types ───────────────────────────────────────────────────────────────

export interface ServerEvent {
  type: 'forgeDoc' | 'reloading' | 'error' | 'ready' | 'eventResult';
  doc?: ForgeDoc;
  file?: string;
  message?: string;
  requestId?: string;
  success?: boolean;
  error?: string;
  timestamp: number;
}

export interface ClientEvent {
  type: 'uiEvent' | 'ping';
  requestId?: string;
  handlerId?: string;
  eventName?: string;
  args?: any[];
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseLiveDocOptions {
  /** WebSocket URL (default: ws://localhost:5174) */
  url?: string;
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Reconnect interval in ms (default: 2000) */
  reconnectMs?: number;
}

interface UseLiveDocResult {
  /** The latest ForgeDoc from the dev server, or null if not connected */
  doc: ForgeDoc | null;
  /** Connection status */
  status: ConnectionStatus;
  /** Whether the app is currently reloading after a file change */
  isReloading: boolean;
  /** Last error message, if any */
  lastError: string | null;
  /** Last changed file that triggered a reload */
  lastChangedFile: string | null;
  /** Event log */
  events: ServerEvent[];
  /** Send a UI event back to forge-sim (for interactive components) */
  sendEvent: (handlerId: string, eventName: string, ...args: any[]) => Promise<EventResult>;
  /** Number of pending event round-trips */
  pendingEvents: number;
}

interface EventResult {
  success: boolean;
  error?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────

let eventCounter = 0;
function nextRequestId(): string {
  return `evt-${++eventCounter}-${Date.now()}`;
}

/**
 * Serialize event arguments for sending over WebSocket.
 * Handles React synthetic events, DOM elements, and other non-serializable values.
 */
function serializeArgs(args: any[]): any[] {
  return args.map((arg) => {
    if (arg === null || arg === undefined) return arg;

    // React SyntheticEvent or native Event
    if (arg?.nativeEvent || arg instanceof Event) {
      const target = arg.target ?? arg.currentTarget;
      return {
        __syntheticEvent: true,
        eventType: arg.type,
        target: target ? {
          value: target.value,
          checked: target.checked,
          name: target.name,
          id: target.id,
          type: target.type,
        } : {},
        currentTarget: arg.currentTarget ? {
          value: arg.currentTarget.value,
          checked: arg.currentTarget.checked,
          name: arg.currentTarget.name,
        } : {},
      };
    }

    // Plain object / primitive — pass through
    try {
      JSON.stringify(arg);
      return arg;
    } catch {
      // Non-serializable — return a marker
      return { __nonSerializable: true, type: typeof arg };
    }
  });
}

// ── Hook ────────────────────────────────────────────────────────────────

export function useLiveDoc(options: UseLiveDocOptions = {}): UseLiveDocResult {
  const {
    url = 'ws://localhost:5174',
    autoReconnect = true,
    reconnectMs = 2000,
  } = options;

  const [doc, setDoc] = useState<ForgeDoc | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [isReloading, setIsReloading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastChangedFile, setLastChangedFile] = useState<string | null>(null);
  const [events, setEvents] = useState<ServerEvent[]>([]);
  const [pendingEvents, setPendingEvents] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCallbacks = useRef<Map<string, (result: EventResult) => void>>(new Map());

  const addEvent = useCallback((event: ServerEvent) => {
    setEvents((prev) => [event, ...prev].slice(0, 100));
  }, []);

  // ── Send UI event to forge-sim ──────────────────────────────────────

  const sendEvent = useCallback(
    (handlerId: string, eventName: string, ...args: any[]): Promise<EventResult> => {
      return new Promise((resolve) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          resolve({ success: false, error: 'Not connected to dev server' });
          return;
        }

        const requestId = nextRequestId();
        const timeout = setTimeout(() => {
          pendingCallbacks.current.delete(requestId);
          setPendingEvents((n) => Math.max(0, n - 1));
          resolve({ success: false, error: 'Event timed out (10s)' });
        }, 10000);

        pendingCallbacks.current.set(requestId, (result) => {
          clearTimeout(timeout);
          setPendingEvents((n) => Math.max(0, n - 1));
          resolve(result);
        });

        setPendingEvents((n) => n + 1);

        const msg: ClientEvent = {
          type: 'uiEvent',
          requestId,
          handlerId,
          eventName,
          args: serializeArgs(args),
        };

        ws.send(JSON.stringify(msg));
      });
    },
    []
  );

  // ── WebSocket connection ────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;

    function connect() {
      if (!mounted) return;
      setStatus('connecting');

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mounted) return;
        setStatus('connected');
        setLastError(null);
        console.log('[live-doc] Connected to dev server');
      };

      ws.onmessage = (event) => {
        if (!mounted) return;
        try {
          const data: ServerEvent = JSON.parse(event.data);
          addEvent(data);

          switch (data.type) {
            case 'forgeDoc':
              if (data.doc) {
                setDoc(data.doc);
                setIsReloading(false);
              }
              break;
            case 'reloading':
              setIsReloading(true);
              setLastChangedFile(data.file ?? null);
              break;
            case 'error':
              setLastError(data.message ?? 'Unknown error');
              setIsReloading(false);
              break;
            case 'ready':
              setIsReloading(false);
              break;
            case 'eventResult':
              // Resolve the pending event callback
              if (data.requestId) {
                const cb = pendingCallbacks.current.get(data.requestId);
                if (cb) {
                  pendingCallbacks.current.delete(data.requestId);
                  cb({
                    success: data.success ?? false,
                    error: data.error,
                  });
                }
              }
              break;
          }
        } catch (err) {
          console.error('[live-doc] Failed to parse message:', err);
        }
      };

      ws.onclose = () => {
        if (!mounted) return;
        setStatus('disconnected');
        console.log('[live-doc] Disconnected from dev server');

        if (autoReconnect && mounted) {
          reconnectTimer.current = setTimeout(connect, reconnectMs);
        }
      };

      ws.onerror = () => {
        if (!mounted) return;
        setStatus('error');
      };
    }

    connect();

    return () => {
      mounted = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
      // Reject all pending callbacks
      for (const cb of pendingCallbacks.current.values()) {
        cb({ success: false, error: 'Connection closed' });
      }
      pendingCallbacks.current.clear();
    };
  }, [url, autoReconnect, reconnectMs, addEvent]);

  return { doc, status, isReloading, lastError, lastChangedFile, events, sendEvent, pendingEvents };
}
