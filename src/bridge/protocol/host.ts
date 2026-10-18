/**
 * BridgeHost — what an environment must provide to answer `window.__bridge`.
 *
 * The dispatcher (dispatcher.ts) owns the PROTOCOL: it knows the frame shape
 * of every command real `@forge/bridge` sends, normalizes it, and calls one
 * typed method here. A host owns the TRANSPORT and the ENVIRONMENT: the
 * headless host calls `sim.*` in process, the browser host speaks WebSocket
 * RPC to the dev server and has a DOM. Neither ever sees a raw frame.
 *
 * Two kinds of method live here and they vary along different axes:
 *
 * - Backend calls (invoke, fetch, context, realtime publish) vary by
 *   transport. Every host can answer them.
 * - Surface calls (flags, modal, history, navigation, events) vary by
 *   environment. A host with no window answers them inertly or throws a
 *   clear error — never silently `undefined`, which is how an app ends up
 *   failing somewhere unrelated.
 *
 * Callbacks (`onEvent`, `subscribeRealtime`, `onClose`) take the function
 * directly. A callback can't cross a wire, so each host keeps it frame-local
 * and wires its own event channel back to it.
 *
 * This file is part of the protocol subtree: compiled with no DOM and no
 * Node types (tsconfig.bridge-protocol.json), so nothing here may name
 * `window`, `document`, `process` or import outside `src/bridge/protocol/`.
 */

/** Request init after frame normalization — headers are always a record. */
export interface BridgeRequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

/**
 * What a host returns for fetchProduct / fetchRemote. This is the exact shape
 * real `@forge/bridge`'s fetch module destructures (out/fetch/fetch.js):
 * `body` is text, and `isAttachment` tells it whether to base64-decode.
 */
export interface BridgeFetchResponse {
  status: number;
  statusText: string;
  body: string;
  headers: Record<string, string>;
  isAttachment: boolean;
}

/** A `router.navigate` / `router.open` / `router.getUrl` target. */
export type BridgeNavigationLocation = string | { target: string; [key: string]: unknown };

export interface BridgeSubscription {
  unsubscribe: () => void;
}

export interface BridgeHost {
  // ── Reconciler ───────────────────────────────────────────────────────
  /** A ForgeDoc tree from @forge/react. `kind` is 'macroConfig' for addConfig(). */
  reconcile(forgeDoc: unknown, kind: 'view' | 'macroConfig'): Promise<void>;
  /** @forge/react reported an app-level error. */
  onError(error: unknown): Promise<void>;

  // ── Resolver + HTTP ──────────────────────────────────────────────────
  invoke(functionKey: string, payload: unknown): Promise<unknown>;
  /** invokeRemote() — the module's manifest endpoint; host resolves which. */
  invokeRemote(path: string | undefined, init: BridgeRequestInit): Promise<unknown>;
  fetchProduct(product: string, restPath: string, init: BridgeRequestInit): Promise<BridgeFetchResponse>;
  fetchRemote(remoteKey: string, path: string | undefined, init: BridgeRequestInit): Promise<BridgeFetchResponse>;

  // ── View ─────────────────────────────────────────────────────────────
  getContext(): Promise<unknown>;
  submit(payload: unknown): Promise<unknown>;
  close(payload: unknown): Promise<unknown>;
  refresh(payload: unknown): Promise<unknown>;
  open(): Promise<unknown>;
  onClose(callback: unknown): Promise<void>;
  createHistory(): Promise<unknown>;
  enableTheming(): Promise<void>;
  changeWindowTitle(title: string | undefined): Promise<void>;
  emitReadyEvent(): Promise<void>;

  // ── Router ───────────────────────────────────────────────────────────
  navigate(location: BridgeNavigationLocation, tab: 'same-tab' | 'new-tab'): Promise<void>;
  /** Must resolve to an ABSOLUTE url string: the real package runs `new URL()` on it. */
  getUrl(location: BridgeNavigationLocation): Promise<string | null>;
  reload(): Promise<void>;

  // ── Flags / modal ────────────────────────────────────────────────────
  showFlag(options: Record<string, unknown>): Promise<void>;
  /** Resolves true when a flag with that id was open and is now dismissed. */
  closeFlag(id: unknown): Promise<boolean>;
  openModal(options: unknown): Promise<unknown>;

  // ── Cross-module events ──────────────────────────────────────────────
  emitEvent(event: string, payload: unknown, isPublic: boolean): Promise<void>;
  onEvent(event: string, callback: (payload?: unknown) => unknown, isPublic: boolean): Promise<BridgeSubscription>;

  // ── Realtime ─────────────────────────────────────────────────────────
  publishRealtime(channel: string, payload: unknown, options: unknown, global: boolean): Promise<unknown>;
  subscribeRealtime(
    channel: string,
    onEvent: (payload?: unknown) => unknown,
    options: unknown,
    global: boolean,
  ): Promise<BridgeSubscription>;

  // ── Telemetry / platform ─────────────────────────────────────────────
  trackObjectStoreAction(data: unknown): Promise<void>;
  getFrameId(): Promise<string>;
  initFeatureFlags(user: unknown, config: unknown): Promise<void>;
  isRovoEnabled(): Promise<boolean>;
  emitFrontendCustomMetric(name: string, value: unknown): Promise<void>;
}
