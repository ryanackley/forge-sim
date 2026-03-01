/**
 * In-memory simulation of @forge/events (Async Events / Queue).
 *
 * Simulates the Queue.push() → consumer handler flow.
 * Events are processed immediately (synchronously in the sim) unless delayed.
 */

import type { QueueEvent, QueuePushResult, QueueJobStats, FunctionHandler } from './types.js';
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
  status: 'pending' | 'processing' | 'success' | 'failed';
  error?: string;
}

export class SimulatedQueue {
  private consumers = new Map<string, FunctionHandler>();
  private jobs = new Map<string, QueueJob>();
  private eventLog: Array<{ queueKey: string; event: QueueEventInternal; jobId: string }> = [];

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

    // Process events (in simulation, we process immediately regardless of delay)
    await this.processJob(job);

    return { jobId };
  }

  private async processJob(job: QueueJob): Promise<void> {
    const consumer = this.consumers.get(job.queueKey);
    if (!consumer) {
      // No consumer registered — events just sit in the queue
      // This mirrors Forge behavior: events queue up but aren't processed
      return;
    }

    for (const event of job.events) {
      if (job.cancelled) break;

      event.status = 'processing';
      job.stats.inProgress++;

      this.eventLog.push({ queueKey: job.queueKey, event, jobId: job.jobId });

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
      } finally {
        job.stats.inProgress--;
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

  clear(): void {
    this.consumers.clear();
    this.jobs.clear();
    this.eventLog.length = 0;
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
