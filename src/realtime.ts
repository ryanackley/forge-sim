/**
 * SimulatedRealtime — backend for the @forge/realtime shim.
 *
 * In-memory pub/sub hub. Backend resolvers call publish/publishGlobal,
 * frontend subscribers (via bridge) get notified immediately.
 *
 * No actual WebSocket transport — everything is in-process.
 *
 * Channel identity (plane, module or context overrides, token claims, channel
 * name) is defined in ONE place, `realtime-channel-key.ts`; this file only
 * decides which identity a call gets and validates inputs first.
 *
 * Realtime tokens are enforced per the docs: pre-validation (INVALID_TOKEN,
 * TOKEN_EXPIRED, CHANNEL_NAME_MISMATCH, MISSING_PERMISSION) happens before
 * the operation, and a token's claims become part of channel identity so a
 * token-less subscriber never hears a token-secured publish.
 */

import {
  scopedChannelKey,
  globalChannelKey,
  channelKeyFor,
  isGlobalByEmptyOverrides,
  invalidContextOverrides,
  validateRealtimeToken,
  parseRealtimeToken,
  encodeRealtimeToken,
  REALTIME_TOKEN_PERMISSIONS,
  type ProductContextName,
  type RealtimeTokenPermission,
} from './realtime-channel-key.js';
import type { ProductContext } from './shims/product-context.js';

export type { ProductContextName, RealtimeTokenPermission };

/**
 * A `contextOverrides` entry: the enum form apps use (`Jira.Project`) or its
 * string value (`'project'`). String enum members and string literals are
 * not mutually assignable in TypeScript, so the option type accepts both.
 */
export type ContextOverride = ProductContext | ProductContextName;

// ── Public types ────────────────────────────────────────────────────────

export type RealtimePayload = string | Record<string, unknown>;

export interface PublishOptions {
  token?: string;
  contextOverrides?: ContextOverride[];
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
  contextOverrides?: ContextOverride[];
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
    const invalid = this.prevalidate(channel, options, 'publish');
    if (invalid) return this.errorResult(channel, invalid);
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
    // `contextOverrides` participates in channel identity (see
    // realtime-channel-key.ts): a publisher whose overrides differ from a
    // subscriber's produces a different key and therefore never reaches it,
    // which is the matching rule Forge documents. An explicitly empty array
    // means "equivalent to a global channel", so it crosses to the global
    // plane and is flagged as such.
    const asGlobal = isGlobalByEmptyOverrides(options?.contextOverrides);
    const claims = this.claimsOf(options);
    const channelKey = asGlobal
      ? globalChannelKey(channel, claims)
      : scopedChannelKey(ctx.moduleKey, channel, options?.contextOverrides, claims);
    return this.publishToChannel(channel, channelKey, payload, asGlobal);
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
    const invalid = this.prevalidate(channel, options, 'publish');
    if (invalid) return this.errorResult(channel, invalid);
    const channelKey = globalChannelKey(channel, this.claimsOf(options));
    return this.publishToChannel(channel, channelKey, payload, true);
  }

  /**
   * Sign a realtime token (simulated).
   *
   * Real Forge returns a JWT; we return a self-describing fake token (see
   * realtime-channel-key.ts) that both the backend and the browser bridge
   * can validate. `permissions` follows the docs: omitted means both
   * subscribe and publish; `['subscribe']` is read-only, `['publish']` is
   * write-only. `expiresAt` is epoch SECONDS, per the JWT `exp` convention
   * the docs call out.
   */
  async signRealtimeToken(
    channel: string,
    claims: Record<string, unknown>,
    permissions?: RealtimeTokenPermission[],
  ): Promise<TokenResult> {
    const badPermissions =
      permissions !== undefined &&
      (!Array.isArray(permissions) || permissions.length === 0 ||
        !permissions.every((p) => REALTIME_TOKEN_PERMISSIONS.includes(p)));
    if (typeof channel !== 'string' || channel.length === 0 ||
        !claims || typeof claims !== 'object' || Array.isArray(claims) || badPermissions) {
      this.logFn('warn', `realtime.signRealtimeToken("${channel}") rejected`, { claims, permissions });
      return { token: null, expiresAt: null, errors: [{ message: 'Error signing realtime token' }] };
    }
    const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour
    const token = encodeRealtimeToken({
      channel,
      claims,
      permissions: permissions ?? [...REALTIME_TOKEN_PERMISSIONS],
      exp: expiresAt,
    });
    this.logFn('info', `realtime.signRealtimeToken("${channel}")`, { claims, permissions });
    return { token, expiresAt };
  }

  // ── Input validation shared by every entry point ──────────────────

  /**
   * Documented pre-validation, in order: contextOverrides must be real
   * ProductContext values, then the token (if any) must parse, be unexpired,
   * match the channel, and carry the permission for this operation. Returns
   * the error message or null.
   */
  private prevalidate(
    channel: string,
    options: { token?: string; contextOverrides?: readonly unknown[] } | undefined,
    operation: RealtimeTokenPermission,
  ): string | null {
    const badOverrides = invalidContextOverrides(options?.contextOverrides);
    if (badOverrides) return badOverrides;
    if (options?.token !== undefined) {
      return validateRealtimeToken(options.token, channel, operation);
    }
    return null;
  }

  /** Claims from a (pre-validated) token, or null when no token was given. */
  private claimsOf(options?: { token?: string }): Record<string, unknown> | null {
    if (options?.token === undefined) return null;
    return parseRealtimeToken(options.token)?.claims ?? null;
  }

  private errorResult(channel: string, message: string): PublishResult {
    this.logFn('warn', `realtime.publish("${channel}") rejected: ${message}`);
    return { eventId: null, eventTimestamp: null, errors: [{ message }] };
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
    // Docs: subscribe "returns a rejected Promise on error". The bridge
    // shim's subscribe() is async, so a throw here surfaces as that rejection.
    const invalid = this.prevalidate(channel, options, 'subscribe');
    if (invalid) {
      this.logFn('warn', `realtime.subscribe("${channel}") rejected: ${invalid}`);
      throw new Error(invalid);
    }
    const key = channelKeyFor(moduleKey, channel, options?.contextOverrides, this.claimsOf(options));
    if (key === null) {
      // No module context and no overrides: a scoped subscribe cannot be
      // keyed. Never widen it onto the global plane (that would let it hear
      // publishGlobal events, which the docs rule out); fail like Forge does
      // for an operation outside a valid app context.
      this.logFn(
        'warn',
        `realtime.subscribe("${channel}") called with no module context — scoped subscriptions need a rendered module. ` +
        `Render the module first (sim.ui.render) or use subscribeGlobal(). Returning Unauthorized request.`,
      );
      throw new Error('Unauthorized request');
    }
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
    const invalid = this.prevalidate(channel, options, 'subscribe');
    if (invalid) {
      this.logFn('warn', `realtime.subscribeGlobal("${channel}") rejected: ${invalid}`);
      throw new Error(invalid);
    }
    const key = globalChannelKey(channel, this.claimsOf(options));
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
    const invalid = this.prevalidate(channel, options, 'publish');
    if (invalid) return this.errorResult(channel, invalid);
    const asGlobal = isGlobalByEmptyOverrides(options?.contextOverrides);
    const channelKey = channelKeyFor(moduleKey, channel, options?.contextOverrides, this.claimsOf(options));
    if (channelKey === null) {
      return this.errorResult(channel, 'Unauthorized request');
    }
    return this.publishToChannel(channel, channelKey, payload, asGlobal);
  }

  /**
   * PublishGlobal from the frontend (bridge side).
   */
  async publishGlobalFromBridge(
    channel: string,
    payload: RealtimePayload,
    options?: PublishOptions,
  ): Promise<PublishResult> {
    const invalid = this.prevalidate(channel, options, 'publish');
    if (invalid) return this.errorResult(channel, invalid);
    const channelKey = globalChannelKey(channel, this.claimsOf(options));
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
