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

export interface PublishResult {
  eventId: string | null;
  eventTimestamp: string | null;
  errors: string[];
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
  errors?: string[];
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
  /** Current module key for scoped channels (set by simulator before resolver invocation) */
  private currentModuleKey: string | null = null;
  private logFn: (level: string, message: string, detail?: unknown) => void;
  /** External listeners notified on every publish (used by dev server for WS push) */
  private publishListeners: PublishListener[] = [];

  constructor(logFn?: (level: string, message: string, detail?: unknown) => void) {
    this.logFn = logFn ?? (() => {});
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

  // ── Module context ──────────────────────────────────────────────────

  /** Set the current module key (called by simulator before invoking resolvers) */
  setModuleContext(moduleKey: string | null): void {
    this.currentModuleKey = moduleKey;
  }

  getModuleContext(): string | null {
    return this.currentModuleKey;
  }

  // ── Backend API (@forge/realtime) ─────────────────────────────────

  /**
   * Publish to a scoped channel (requires module context).
   * Events only reach subscribers on the same module+context channel.
   */
  async publish(
    channel: string,
    payload: RealtimePayload,
    options?: PublishOptions,
  ): Promise<PublishResult> {
    const moduleKey = this.currentModuleKey;
    if (!moduleKey) {
      this.logFn('warn', 'realtime.publish() called without module context — treating as global');
    }
    const channelKey = moduleKey ? `scoped:${moduleKey}:${channel}` : `global:${channel}`;
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
    this.currentModuleKey = null;
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
