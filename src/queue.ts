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

    const jobId = randomUUID();
    const internalEvents: QueueEventInternal[] = eventList.map((e) => ({
      body: e.body,
      delayInSeconds: e.delayInSeconds ?? 0,
      concurrency: e.concurrency,
      status: 'pending' as const,
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

    const consumerStartMs = Date.now();
    try {
      await consumer(
        { body: event.body, jobId: job.jobId },
        { installContext: 'ari:cloud:jira::site/sim-site' }
      );
      event.status = 'success';
      job.stats.success++;
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
      // Check consumer invocation time (55s default, up to 900s)
      const elapsedMs = Date.now() - consumerStartMs;
      const elapsedSeconds = elapsedMs / 1000;
      const limitSeconds = 55; // Could be extended via timeoutSeconds on the function
      if (elapsedSeconds > limitSeconds) {
        console.error(
          `[forge-sim] ⏱️ TIMEOUT: Consumer for queue "${job.queueKey}" took ${elapsedSeconds.toFixed(1)}s — ` +
          `exceeds Forge async event limit of ${limitSeconds}s. In production, this invocation would be killed.`
        );
      }
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
   */
  getStats(): Record<string, { consumers: number; jobs: number; events: number; succeeded: number; failed: number }> {
    const queueKeys = new Set<string>();
    for (const key of this.consumers.keys()) queueKeys.add(key);
    for (const { queueKey } of this.eventLog) queueKeys.add(queueKey);

    const stats: Record<string, { consumers: number; jobs: number; events: number; succeeded: number; failed: number }> = {};
    for (const key of queueKeys) {
      const keyEvents = this.eventLog.filter(e => e.queueKey === key);
      stats[key] = {
        consumers: this.consumers.has(key) ? 1 : 0,
        jobs: [...this.jobs.values()].filter(j => keyEvents.some(e => e.jobId === j.jobId)).length,
        events: keyEvents.length,
        succeeded: keyEvents.filter(e => e.event.status === 'success').length,
        failed: keyEvents.filter(e => e.event.status === 'failed').length,
      };
    }
    return stats;
  }

  clear(): void {
    this.consumers.clear();
    this.jobs.clear();
    this.eventLog.length = 0;
    this.semaphore.clear();
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
