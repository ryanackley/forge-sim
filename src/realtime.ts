/**
 * SimulatedRealtime — backend for the @forge/realtime shim.
 *
 * In-memory pub/sub hub. Backend resolvers call publish/publishGlobal,
 * frontend subscribers (via bridge) get notified immediately.
 *
 * No actual WebSocket transport — everything is in-process.
 *
 * Two channel namespaces:
 *   - Scoped (publish/subscribe): keyed by `${moduleKey}:${channel}`
 *   - Global (publishGlobal/subscribeGlobal): keyed by `global:${channel}`
 *
 * Token-based channel authorization is accepted but not enforced
 * (simulation simplification — scoping works, but we don't validate JWT claims).
 */

// ── Public types ────────────────────────────────────────────────────────

export type RealtimePayload = string | Record<string, unknown>;

export interface PublishOptions {
  token?: string;
  contextOverrides?: string[];  // ProductContext enum values
}

/** Error object in PublishResult.errors — matches Forge docs shape. */
export interface RealtimeError {
  message: string;
}

export interface PublishResult {
  eventId: string | null;
  eventTimestamp: string | null;
  errors: RealtimeError[];
}

/**
 * What kind of invocation is currently executing.
 * Only 'resolver' invocations (frontend-originated) may use scoped publish() —
 * matching real Forge, where publish is only available from frontend
 * invocation context. Everything else must use publishGlobal().
 */
export type InvocationKind =
  | 'resolver'
  | 'action'
  | 'workflow'
  | 'trigger'
  | 'scheduledTrigger'
  | 'webTrigger'
  | 'consumer';

/** Ambient invocation context, provided by the simulator via AsyncLocalStorage. */
export interface RealtimeInvocationContext {
  kind: InvocationKind;
  /** Module key of the frontend module that originated the invocation (resolver only). */
  moduleKey: string | null;
}

export interface SubscriptionOptions {
  replaySeconds?: number;
  token?: string;
  contextOverrides?: string[];
}

export interface Subscription {
  unsubscribe: () => void;
}

export type RealtimeCallback = (payload: RealtimePayload) => void;

export interface TokenResult {
  token: string | null;
  expiresAt: number | null;
  errors?: RealtimeError[];
}

// ── Internal event record ───────────────────────────────────────────────

interface RealtimeEvent {
  eventId: string;
  channel: string;
  channelKey: string;  // fully qualified key (scoped or global)
  payload: RealtimePayload;
  timestamp: number;
  global: boolean;
}

// ── SimulatedRealtime ───────────────────────────────────────────────────

export type PublishListener = (event: {
  channel: string;
  channelKey: string;
  payload: RealtimePayload;
  global: boolean;
  eventId: string;
}) => void;

export class SimulatedRealtime {
  /** channel key → set of callbacks */
  private subscribers = new Map<string, Set<RealtimeCallback>>();
  /** All published events (for replay and inspection) */
  private eventLog: RealtimeEvent[] = [];
  /** Counter for event IDs */
  private eventCounter = 0;
  private logFn: (level: string, message: string, detail?: unknown) => void;
  /** Provider for the ambient invocation context (wired by the simulator via AsyncLocalStorage). */
  private getInvocationContext: () => RealtimeInvocationContext | null;
  /** External listeners notified on every publish (used by dev server for WS push) */
  private publishListeners: PublishListener[] = [];

  constructor(
    logFn?: (level: string, message: string, detail?: unknown) => void,
    getInvocationContext?: () => RealtimeInvocationContext | null,
  ) {
    this.logFn = logFn ?? (() => {});
    this.getInvocationContext = getInvocationContext ?? (() => null);
  }

  /**
   * Register a listener that fires on every publish/publishGlobal.
   * Used by the dev server to push realtime events to browser clients over WS.
   * Returns an unbind function.
   */
  onPublish(listener: PublishListener): () => void {
    this.publishListeners.push(listener);
    return () => {
      this.publishListeners = this.publishListeners.filter(l => l !== listener);
    };
  }

  // ── Backend API (@forge/realtime) ─────────────────────────────────

  /**
   * Publish to a scoped channel.
   *
   * Forge parity: scoped publish is ONLY available from frontend invocation
   * context (a resolver invoked from the frontend). Triggers, scheduled jobs,
   * web triggers, and queue consumers must use publishGlobal(). Outside a
   * frontend invocation context this returns an "Unauthorized request" error
   * result — it never throws, never delivers, and never falls back to global.
   */
  async publish(
    channel: string,
    payload: RealtimePayload,
    options?: PublishOptions,
  ): Promise<PublishResult> {
    const ctx = this.getInvocationContext();
    if (!ctx || ctx.kind !== 'resolver' || !ctx.moduleKey) {
      const from = ctx ? `a ${ctx.kind} invocation` : 'outside any invocation context';
      this.logFn(
        'warn',
        `realtime.publish("${channel}") called from ${from} — Forge only allows scoped publish from frontend invocation context. ` +
        `Use publishGlobal() (with subscribeGlobal() on the frontend) from async contexts. Returning Unauthorized request.`,
      );
      return {
        eventId: null,
        eventTimestamp: null,
        errors: [{ message: 'Unauthorized request' }],
      };
    }
    const channelKey = `scoped:${ctx.moduleKey}:${channel}`;
    return this.publishToChannel(channel, channelKey, payload, false);
  }

  /**
   * Publish to a global channel (no module scoping).
   * Events reach all subscribeGlobal() subscribers on this channel.
   */
  async publishGlobal(
    channel: string,
    payload: RealtimePayload,
    options?: PublishOptions,
  ): Promise<PublishResult> {
    const channelKey = `global:${channel}`;
    return this.publishToChannel(channel, channelKey, payload, true);
  }

  /**
   * Sign a realtime token (simulated — returns a fake JWT).
   */
  async signRealtimeToken(
    channel: string,
    claims: Record<string, unknown>,
  ): Promise<TokenResult> {
    // In simulation, we generate a fake token. Real Forge creates a JWT
    // with channel+claims baked in. We just return a predictable string
    // so app code that passes tokens around still works.
    const token = `sim-rt-token:${channel}:${JSON.stringify(claims)}`;
    const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour
    this.logFn('info', `realtime.signRealtimeToken("${channel}")`, { claims });
    return { token, expiresAt };
  }

  // ── Frontend/bridge API (subscribe) ───────────────────────────────

  /**
   * Subscribe to a scoped channel.
   * Called from the bridge side (@forge/bridge → realtime.subscribe).
   */
  subscribe(
    channel: string,
    callback: RealtimeCallback,
    moduleKey: string | null,
    options?: SubscriptionOptions,
  ): Subscription {
    const key = moduleKey ? `scoped:${moduleKey}:${channel}` : `global:${channel}`;
    return this.addSubscriber(channel, key, callback, options);
  }

  /**
   * Subscribe to a global channel.
   * Called from the bridge side (@forge/bridge → realtime.subscribeGlobal).
   */
  subscribeGlobal(
    channel: string,
    callback: RealtimeCallback,
    options?: SubscriptionOptions,
  ): Subscription {
    const key = `global:${channel}`;
    return this.addSubscriber(channel, key, callback, options);
  }

  /**
   * Publish from the frontend (bridge side).
   * Scoped publish — requires module key context.
   */
  async publishFromBridge(
    channel: string,
    payload: RealtimePayload,
    moduleKey: string | null,
    options?: PublishOptions,
  ): Promise<PublishResult> {
    const channelKey = moduleKey ? `scoped:${moduleKey}:${channel}` : `global:${channel}`;
    return this.publishToChannel(channel, channelKey, payload, false);
  }

  /**
   * PublishGlobal from the frontend (bridge side).
   */
  async publishGlobalFromBridge(
    channel: string,
    payload: RealtimePayload,
    options?: PublishOptions,
  ): Promise<PublishResult> {
    const channelKey = `global:${channel}`;
    return this.publishToChannel(channel, channelKey, payload, true);
  }

  // ── Inspection / testing ──────────────────────────────────────────

  /** Get all published events (for test assertions and MCP tools). */
  getEventLog(): RealtimeEvent[] {
    return [...this.eventLog];
  }

  /** Get all active subscription channel keys. */
  getSubscriptions(): Array<{ channelKey: string; subscriberCount: number }> {
    const result: Array<{ channelKey: string; subscriberCount: number }> = [];
    for (const [key, subs] of this.subscribers) {
      if (subs.size > 0) {
        result.push({ channelKey: key, subscriberCount: subs.size });
      }
    }
    return result;
  }

  /** Clear all state. */
  reset(): void {
    this.subscribers.clear();
    this.eventLog = [];
    this.eventCounter = 0;
  }

  // ── Internal ──────────────────────────────────────────────────────

  private publishToChannel(
    channel: string,
    channelKey: string,
    payload: RealtimePayload,
    global: boolean,
  ): PublishResult {
    const subs = this.subscribers.get(channelKey);
    const hasSubscribers = subs && subs.size > 0;

    const eventId = hasSubscribers ? `rt-evt-${++this.eventCounter}` : null;
    const timestamp = Date.now();
    const eventTimestamp = hasSubscribers ? String(timestamp) : null;

    const event: RealtimeEvent = {
      eventId: eventId ?? `rt-evt-${++this.eventCounter}`,
      channel,
      channelKey,
      payload,
      timestamp,
      global,
    };
    this.eventLog.push(event);

    this.logFn(
      'info',
      `realtime.${global ? 'publishGlobal' : 'publish'}("${channel}") → ${subs?.size ?? 0} subscriber(s)`,
      { channelKey, payloadPreview: typeof payload === 'string' ? payload.slice(0, 100) : '(object)' },
    );

    // Deliver to in-process subscribers
    if (subs) {
      for (const cb of subs) {
        try {
          cb(payload);
        } catch (err) {
          this.logFn('error', `realtime subscriber error on "${channel}"`, err);
        }
      }
    }

    // Notify external listeners (dev server WS push, etc.)
    for (const listener of this.publishListeners) {
      try {
        listener({ channel, channelKey, payload, global, eventId: event.eventId });
      } catch (err) {
        this.logFn('error', 'realtime publish listener error', err);
      }
    }

    return {
      eventId,
      eventTimestamp,
      errors: [],
    };
  }

  private addSubscriber(
    channel: string,
    channelKey: string,
    callback: RealtimeCallback,
    options?: SubscriptionOptions,
  ): Subscription {
    if (!this.subscribers.has(channelKey)) {
      this.subscribers.set(channelKey, new Set());
    }
    const subs = this.subscribers.get(channelKey)!;
    subs.add(callback);

    this.logFn('info', `realtime.subscribe("${channel}")`, {
      channelKey,
      subscriberCount: subs.size,
      replaySeconds: options?.replaySeconds,
    });

    // Replay recent events if requested
    if (options?.replaySeconds && options.replaySeconds > 0) {
      const cutoff = Date.now() - (options.replaySeconds * 1000);
      const replayEvents = this.eventLog.filter(
        e => e.channelKey === channelKey && e.timestamp >= cutoff,
      );
      for (const evt of replayEvents) {
        try {
          callback(evt.payload);
        } catch (err) {
          this.logFn('error', `realtime replay error on "${channel}"`, err);
        }
      }
    }

    return {
      unsubscribe: () => {
        subs.delete(callback);
        this.logFn('info', `realtime.unsubscribe("${channel}")`, {
          channelKey,
          remainingSubscribers: subs.size,
        });
      },
    };
  }
}
