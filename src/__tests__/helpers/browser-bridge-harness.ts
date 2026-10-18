/**
 * Install the REAL browser bridge host in jsdom.
 *
 * These tests used to eval a generated inline script and assert on its
 * source text. The browser host is now ordinary TypeScript
 * (src/bridge/hosts/browser), so they drive the shipped code instead:
 * the protocol dispatcher over the real host, with the WebSocket transport
 * replaced by a stub that records RPCs and can push server events back.
 */

import { createBridgeDispatcher } from '../../bridge/protocol/index.js';
import { createBrowserHost } from '../../bridge/hosts/browser/host.js';
import type { Transport } from '../../bridge/hosts/browser/transport.js';

export interface BrowserBridgeHarness {
  callBridge: (cmd: string, data?: any) => Promise<any>;
  /** Every RPC the host sent, in order. */
  rpcs: Array<{ method: string; params: any }>;
  /** Queue a reply for the next RPC with this method. */
  replyTo(method: string, result: unknown): void;
  /** Push a server event (e.g. a realtime broadcast) to the host. */
  push(msg: Record<string, unknown>): void;
  /** ForgeDocs the host handed to the shell, by tree. */
  reconciled: Array<{ doc: any; kind: 'view' | 'macroConfig' }>;
}

export interface HarnessOptions {
  moduleKey?: string;
  contextOptions?: unknown;
  isInModal?: boolean;
  /** Supply a real reader so a test can exercise URL-derived placement. */
  getContextOptions?: () => unknown;
}

export function installBrowserBridge(options: HarnessOptions = {}): BrowserBridgeHarness {
  delete (window as any).__bridge;
  delete (globalThis as any).__bridge;
  document.body.innerHTML = '';

  const rpcs: Array<{ method: string; params: any }> = [];
  const replies = new Map<string, unknown[]>();
  const pushListeners = new Set<(msg: Record<string, any>) => void>();
  const reconciled: Array<{ doc: any; kind: 'view' | 'macroConfig' }> = [];

  const transport: Transport = {
    async rpc(method, params) {
      rpcs.push({ method, params });
      const queued = replies.get(method);
      return queued && queued.length ? queued.shift() : undefined;
    },
    onPush(fn) {
      pushListeners.add(fn);
      return () => pushListeners.delete(fn);
    },
  };

  const host = createBrowserHost({
    transport,
    getModuleKey: () => options.moduleKey ?? 'test-module',
    getContextOptions: options.getContextOptions ?? (() => options.contextOptions),
    isInModal: () => !!options.isInModal,
    onReconcile: (doc, kind) => { reconciled.push({ doc, kind }); },
  });

  const { callBridge } = createBridgeDispatcher(host);
  // Both: jsdom's `window` and `globalThis` are distinct objects, and the
  // renderer shim reads globalThis.__bridge.
  (window as any).__bridge = { callBridge };
  (globalThis as any).__bridge = (window as any).__bridge;

  return {
    callBridge,
    rpcs,
    reconciled,
    replyTo(method, result) {
      if (!replies.has(method)) replies.set(method, []);
      replies.get(method)!.push(result);
    },
    push(msg) {
      for (const fn of pushListeners) fn(msg);
    },
  };
}
