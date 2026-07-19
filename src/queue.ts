/**
 * In-memory simulation of @forge/events (Async Events / Queue).
 *
 * Simulates the Queue.push() → consumer handler flow with realistic concurrency:
 * - Events can run concurrently (like real Forge)
 * - Concurrency keys act as named semaphores across queues (per Forge spec)
 * - Without concurrency config, processing is unbounded
 * - KVS latency simulation exposes race conditions in consumer code
 */

import type { QueueEvent, QueuePushResult, QueueJobStats, FunctionHandler, QueueConcurrency } from './types.js';
import { randomUUID } from 'crypto';

export interface QueueJob {
  jobId: string;
  queueKey: string;
  events: QueueEventInternal[];
  stats: QueueJobStats;
  cancelled: boolean;
}

interface QueueEventInternal {
  body: Record<string, unknown>;
  delayInSeconds: number;
  concurrency?: QueueConcurrency;
  status: 'pending' | 'processing' | 'success' | 'failed';
  error?: string;
  /** Stable per-event id, delivered to consumers as `event.eventId` (AsyncEvent parity). */
  eventId: string;
  /** Number of retry deliveries performed for this event (via returned InvocationError). */
  retryCount: number;
}

/**
 * Retry cap for consumer-requested retries (returned `InvocationError`).
 *
 * Real Forge allows retries "for as long as the retention window is not
 * exceeded" for Async Events, and documents a hard cap of 4 retries for
 * product-event triggers. The sim compresses time, so a deterministic
 * count cap is the only sane simulation — we use 4, matching the
 * documented product-event cap.
 */
const MAX_RETRY_COUNT = 4;

/** Real platform clamps retryAfter to at most 900s (15 min). */
const MAX_RETRY_AFTER = 900;
const MIN_RETRY_AFTER = 1;

/**
 * Detect a consumer return value requesting a retry.
 *
 * Real `@forge/events` `InvocationError`'s constructor returns its own
 * `toJSON()` — so what the platform actually receives is a plain
 * `{ _retry: true, retryOptions }` object. Match on that shape (a
 * `QueueResponse` with `.retry()` called also satisfies `_retry: true`).
 */
function isRetryRequest(result: unknown): result is { _retry: true; retryOptions?: { retryAfter?: number; retryReason?: string; retryData?: unknown } } {
  return (
    typeof result === 'object' &&
    result !== null &&
    (result as { _retry?: unknown })._retry === true
  );
}

export interface QueueConfig {
  /**
   * Processing mode:
   * - 'sequential': process events one at a time (default, fast, no races)
   * - 'concurrent': process events concurrently, respecting concurrency keys
   */
  mode?: 'sequential' | 'concurrent';
}

/**
 * Named semaphore — tracks active permits per concurrency key.
 * Scoped to the installation (simulator instance), not to a specific queue.
 */
class ConcurrencySemaphore {
  private active = new Map<string, number>();
  private waiters = new Map<string, Array<() => void>>();

  async acquire(key: string, limit: number): Promise<void> {
    while ((this.active.get(key) ?? 0) >= limit) {
      await new Promise<void>((resolve) => {
        const queue = this.waiters.get(key) ?? [];
        queue.push(resolve);
        this.waiters.set(key, queue);
      });
    }
    this.active.set(key, (this.active.get(key) ?? 0) + 1);
  }

  release(key: string): void {
    const current = this.active.get(key) ?? 0;
    if (current > 0) {
      this.active.set(key, current - 1);
    }
    // Wake up next waiter
    const queue = this.waiters.get(key);
    if (queue && queue.length > 0) {
      const next = queue.shift()!;
      next();
    }
  }

  clear(): void {
    this.active.clear();
    this.waiters.clear();
  }
}

export class SimulatedQueue {
  private consumers = new Map<string, FunctionHandler>();
  private jobs = new Map<string, QueueJob>();
  private eventLog: Array<{ queueKey: string; event: QueueEventInternal; jobId: string }> = [];
  private semaphore = new ConcurrencySemaphore();
  private config: QueueConfig;

  constructor(config?: QueueConfig) {
    this.config = { mode: 'sequential', ...config };
  }

  /** Change queue processing mode at runtime. */
  setMode(mode: 'sequential' | 'concurrent'): void {
    this.config.mode = mode;
  }

  /**
   * Register a consumer function for a queue key.
   * In real Forge, this is defined via manifest consumer module.
   */
  registerConsumer(queueKey: string, handler: FunctionHandler): void {
    this.consumers.set(queueKey, handler);
  }

  /**
   * Create a Queue instance (mirrors @forge/events Queue constructor).
   */
  createQueue(options: { key: string }): SimulatedQueueInstance {
    return new SimulatedQueueInstance(options.key, this);
  }

  /**
   * Push events to a queue and process them.
   */
  async push(
    queueKey: string,
    events: QueueEvent | QueueEvent[]
  ): Promise<QueuePushResult> {
    const eventList = Array.isArray(events) ? events : [events];

    if (eventList.length > 50) {
      throw new Error('TooManyEventsError: Maximum 50 events per push request');
    }

    const totalSize = JSON.stringify(eventList).length;
    if (totalSize > 200 * 1024) {
      throw new Error('PayloadTooBigError: Combined payload exceeds 200KB');
    }

    // Eval-11 F5: real Forge queues are decoupled (push succeeds even with
    // no consumer), but silently recording events that will never be
    // processed is a debugging trap. Warn — don't error — so parity holds
    // while the diagnostic surfaces the likely typo / missing consumer.
    if (!this.consumers.has(queueKey)) {
      console.warn(
        `[forge-sim] ⚠️ queue.push("${queueKey}"): no consumer is registered for this queue — ` +
        `events will be recorded but never processed. Declare a consumer module for queue ` +
        `"${queueKey}" in your manifest (or check for a typo in the queue key).`
      );
    }

    const jobId = randomUUID();
    const internalEvents: QueueEventInternal[] = eventList.map((e) => ({
      body: e.body,
      delayInSeconds: e.delayInSeconds ?? 0,
      concurrency: e.concurrency,
      status: 'pending' as const,
      eventId: randomUUID(),
      retryCount: 0,
    }));

    const job: QueueJob = {
      jobId,
      queueKey,
      events: internalEvents,
      stats: { success: 0, inProgress: 0, failed: 0 },
      cancelled: false,
    };
    this.jobs.set(jobId, job);

    if (this.config.mode === 'concurrent') {
      await this.processJobConcurrent(job);
    } else {
      await this.processJobSequential(job);
    }

    return { jobId };
  }

  // ── Sequential processing (default, fast, deterministic) ─────────────

  private async processJobSequential(job: QueueJob): Promise<void> {
    const consumer = this.consumers.get(job.queueKey);
    if (!consumer) return;

    for (const event of job.events) {
      if (job.cancelled) break;
      await this.processEvent(job, event, consumer);
    }
  }

  // ── Concurrent processing (exposes race conditions) ──────────────────

  private async processJobConcurrent(job: QueueJob): Promise<void> {
    const consumer = this.consumers.get(job.queueKey);
    if (!consumer) return;

    // Launch all events concurrently, respecting concurrency semaphores
    const promises = job.events.map(async (event) => {
      if (job.cancelled) return;

      // If event has a concurrency key, acquire the semaphore
      if (event.concurrency) {
        await this.semaphore.acquire(event.concurrency.key, event.concurrency.limit);
      }

      try {
        await this.processEvent(job, event, consumer);
      } finally {
        if (event.concurrency) {
          this.semaphore.release(event.concurrency.key);
        }
      }
    });

    await Promise.allSettled(promises);
  }

  // ── Shared event processing logic ────────────────────────────────────

  private async processEvent(
    job: QueueJob,
    event: QueueEventInternal,
    consumer: FunctionHandler
  ): Promise<void> {
    if (job.cancelled) return;

    event.status = 'processing';
    job.stats.inProgress++;
    this.eventLog.push({ queueKey: job.queueKey, event, jobId: job.jobId });

    try {
      // Delivery loop: first delivery, then up to MAX_RETRY_COUNT retry
      // deliveries when the consumer RETURNS an InvocationError (eval-11
      // F4). Real Forge waits `retryAfter` seconds between deliveries;
      // the sim compresses time and re-delivers immediately, logging the
      // requested delay instead of sleeping through it.
      let retryContext:
        | { retryCount: number; retryReason: string; retryData: unknown }
        | undefined;

      for (;;) {
        if (job.cancelled) return;

        const consumerStartMs = Date.now();
        let result: unknown;
        try {
          result = await consumer(
            {
              // AsyncEvent shape parity: body + queueName + jobId + eventId,
              // with retryContext ONLY present on retry deliveries.
              body: event.body,
              queueName: job.queueKey,
              jobId: job.jobId,
              eventId: event.eventId,
              ...(retryContext !== undefined ? { retryContext } : {}),
            },
            { installContext: 'ari:cloud:jira::site/sim-site' }
          );
        } finally {
          // Check consumer invocation time (55s default, up to 900s)
          const elapsedSeconds = (Date.now() - consumerStartMs) / 1000;
          const limitSeconds = 55; // Could be extended via timeoutSeconds on the function
          if (elapsedSeconds > limitSeconds) {
            console.error(
              `[forge-sim] ⏱️ TIMEOUT: Consumer for queue "${job.queueKey}" took ${elapsedSeconds.toFixed(1)}s — ` +
              `exceeds Forge async event limit of ${limitSeconds}s. In production, this invocation would be killed.`
            );
          }
        }

        if (!isRetryRequest(result)) {
          event.status = 'success';
          job.stats.success++;
          return;
        }

        // Consumer requested a retry.
        if (event.retryCount >= MAX_RETRY_COUNT) {
          event.status = 'failed';
          event.error = `Retry limit reached (${MAX_RETRY_COUNT} retries)`;
          job.stats.failed++;
          console.error(
            `[forge-sim] ❌ Consumer for queue "${job.queueKey}" requested another retry for event ` +
            `${event.eventId}, but the retry limit (${MAX_RETRY_COUNT}) is reached — marking the event ` +
            `failed. In real Forge, retries stop when the retention window is exceeded ` +
            `(product-event triggers cap at 4 retries).`
          );
          return;
        }

        const options = result.retryOptions ?? {};
        // Platform-side clamping: retryAfter ∈ [1, 900] seconds.
        const rawRetryAfter = typeof options.retryAfter === 'number' ? options.retryAfter : MIN_RETRY_AFTER;
        const retryAfter = Math.min(Math.max(rawRetryAfter, MIN_RETRY_AFTER), MAX_RETRY_AFTER);
        const retryReason = typeof options.retryReason === 'string'
          ? options.retryReason
          : 'FUNCTION_RETRY_REQUEST';

        event.retryCount++;
        retryContext = {
          retryCount: event.retryCount,
          retryReason,
          retryData: options.retryData,
        };

        console.warn(
          `[forge-sim] ↻ Consumer for queue "${job.queueKey}" requested retry #${event.retryCount} ` +
          `for event ${event.eventId} (reason: ${retryReason}, retryAfter: ${retryAfter}s — ` +
          `re-delivering immediately; forge-sim does not wait out retry delays).`
        );
      }
    } catch (err) {
      event.status = 'failed';
      event.error = err instanceof Error ? err.message : String(err);
      job.stats.failed++;
      // Surface the failure loudly — real Forge records failed async events
      // in the developer console. Before this, a throwing consumer was
      // invisible outside getEventLog() (eval-4 F5).
      console.error(
        `[forge-sim] ❌ Consumer for queue "${job.queueKey}" failed (job ${job.jobId}): ${event.error}`
      );
    } finally {
      job.stats.inProgress--;
    }
  }

  getJob(jobId: string): QueueJob | undefined {
    return this.jobs.get(jobId);
  }

  cancelJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job) job.cancelled = true;
  }

  /** Get all events processed for inspection */
  getEventLog() {
    return [...this.eventLog];
  }

  /**
   * Get stats for all queues. Includes per-outcome counts (succeeded /
   * failed) so a throwing consumer is visible in the aggregate view, not
   * just buried in getEventLog()[n].event.status (eval-4 F5).
   *
   * `retried` is the total number of retry deliveries performed via
   * returned `InvocationError` (eval-11 F4). An event that requests a
   * retry is NOT counted as succeeded until a delivery completes without
   * a retry request; exhausting the retry cap counts as failed.
   */
  getStats(): Record<string, { consumers: number; jobs: number; events: number; succeeded: number; failed: number; retried: number }> {
    const queueKeys = new Set<string>();
    for (const key of this.consumers.keys()) queueKeys.add(key);
    for (const { queueKey } of this.eventLog) queueKeys.add(queueKey);

    const stats: Record<string, { consumers: number; jobs: number; events: number; succeeded: number; failed: number; retried: number }> = {};
    for (const key of queueKeys) {
      const keyEvents = this.eventLog.filter(e => e.queueKey === key);
      stats[key] = {
        consumers: this.consumers.has(key) ? 1 : 0,
        jobs: [...this.jobs.values()].filter(j => keyEvents.some(e => e.jobId === j.jobId)).length,
        events: keyEvents.length,
        succeeded: keyEvents.filter(e => e.event.status === 'success').length,
        failed: keyEvents.filter(e => e.event.status === 'failed').length,
        retried: keyEvents.reduce((sum, e) => sum + e.event.retryCount, 0),
      };
    }
    return stats;
  }

  /**
   * Clear runtime queue *data* — pending jobs, the event log, and in-flight
   * concurrency state. Registered consumers are PRESERVED.
   *
   * Consumers are module wiring (declared in the manifest, registered at
   * deploy), not runtime state. Module wiring is immutable outside
   * `sim.deploy()` and `sim.reset()` — eval-9 E9-5 found that wiping
   * consumers here turned a natural `beforeEach(() => sim.queue.clear())`
   * into a silent event sink: pushes resolved fine, handlers never ran,
   * no diagnostic. Use `sim.reset()` for a full teardown.
   */
  clear(): void {
    this.jobs.clear();
    this.eventLog.length = 0;
    this.semaphore.clear();
  }

  /**
   * Full teardown including consumer registrations. Reserved for
   * `sim.reset()` / deploy infrastructure — after this, pushed events have
   * no consumers until the next deploy re-wires them.
   */
  clearAll(): void {
    this.clear();
    this.consumers.clear();
  }
}

/**
 * Mirrors the @forge/events Queue class interface.
 */
export class SimulatedQueueInstance {
  constructor(
    private queueKey: string,
    private system: SimulatedQueue
  ) {}

  async push(events: QueueEvent | QueueEvent[]): Promise<QueuePushResult> {
    return this.system.push(this.queueKey, events);
  }

  getJob(jobId: string) {
    const job = this.system.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    return {
      getStats: async () => ({ ...job.stats }),
      cancel: async () => this.system.cancelJob(jobId),
    };
  }
}
