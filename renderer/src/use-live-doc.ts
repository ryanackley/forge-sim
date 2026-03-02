/**
 * useLiveDoc — React hook that connects to forge-sim's dev server
 * via WebSocket and receives live ForgeDoc updates.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ForgeDoc } from './types';

export interface DevEvent {
  type: 'forgeDoc' | 'reloading' | 'error' | 'ready';
  doc?: ForgeDoc;
  file?: string;
  message?: string;
  timestamp: number;
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
  events: DevEvent[];
}

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
  const [events, setEvents] = useState<DevEvent[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addEvent = useCallback((event: DevEvent) => {
    setEvents((prev) => [event, ...prev].slice(0, 100));
  }, []);

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
          const data: DevEvent = JSON.parse(event.data);
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
    };
  }, [url, autoReconnect, reconnectMs, addEvent]);

  return { doc, status, isReloading, lastError, lastChangedFile, events };
}
