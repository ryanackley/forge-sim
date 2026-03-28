/**
 * Shim for @forge/events
 * 
 * Provides the Queue class and error types:
 *   import { Queue } from '@forge/events';
 *   const queue = new Queue({ key: 'my-queue' });
 *   await queue.push([{ body: { data: 'hello' } }]);
 */

import { getSimulator } from './globals.js';

// ── Error classes matching @forge/events ────────────────────────────────

class InvalidQueueNameError extends Error {
  constructor(message = 'Invalid queue name') {
    super(message);
    this.name = 'InvalidQueueNameError';
  }
}

class TooManyEventsError extends Error {
  constructor(message = 'Maximum 50 events per push request') {
    super(message);
    this.name = 'TooManyEventsError';
  }
}

class PayloadTooBigError extends Error {
  constructor(message = 'Combined payload exceeds 200KB') {
    super(message);
    this.name = 'PayloadTooBigError';
  }
}

class NoEventsToPushError extends Error {
  constructor(message = 'No events to push') {
    super(message);
    this.name = 'NoEventsToPushError';
  }
}

class RateLimitError extends Error {
  constructor(message = 'Rate limit exceeded') {
    super(message);
    this.name = 'RateLimitError';
  }
}

class PartialSuccessError extends Error {
  constructor(message = 'Some events failed to push') {
    super(message);
    this.name = 'PartialSuccessError';
  }
}

class InternalServerError extends Error {
  constructor(message = 'Internal server error') {
    super(message);
    this.name = 'InternalServerError';
  }
}

class JobDoesNotExistError extends Error {
  constructor(message = 'Job does not exist') {
    super(message);
    this.name = 'JobDoesNotExistError';
  }
}

class InvalidPushSettingsError extends Error {
  constructor(message = 'Invalid push settings') {
    super(message);
    this.name = 'InvalidPushSettingsError';
  }
}

class InvocationLimitReachedError extends Error {
  constructor(message = 'Invocation limit reached') {
    super(message);
    this.name = 'InvocationLimitReachedError';
  }
}

class InvocationError extends Error {
  code: string;
  constructor(message = 'Invocation error', code = 'UNKNOWN') {
    super(message);
    this.name = 'InvocationError';
    this.code = code;
  }
}

const InvocationErrorCode = {
  UNKNOWN: 'UNKNOWN',
  TIMEOUT: 'TIMEOUT',
  OUT_OF_MEMORY: 'OUT_OF_MEMORY',
  RUNTIME_ERROR: 'RUNTIME_ERROR',
} as const;

const JobProgress = {
  SUCCESS: 'SUCCESS',
  IN_PROGRESS: 'IN_PROGRESS',
  FAILED: 'FAILED',
} as const;

// ── Queue class ─────────────────────────────────────────────────────────

class Queue {
  private key: string;

  constructor(options: { key: string }) {
    if (!options.key || typeof options.key !== 'string') {
      throw new InvalidQueueNameError();
    }
    this.key = options.key;
  }

  async push(events: any | any[]) {
    // Pass events through as-is — concurrency config is on the events themselves
    const sim = getSimulator();
    return sim.queue.push(this.key, events);
  }

  getJob(jobId: string) {
    const sim = getSimulator();
    const job = sim.queue.getJob(jobId);
    if (!job) throw new JobDoesNotExistError();
    return {
      getStats: async () => ({ ...job.stats }),
      cancel: async () => sim.queue.cancelJob(jobId),
    };
  }
}

class QueueResponse {
  constructor(public requestId: string, public statusCode: number) {}
}

// ── App Events (custom app event pub/sub) ──────────────────────────────

interface AppEvent {
  key: string;
}

interface AppEventPublishFailure {
  event: AppEvent;
  errorMessage: string;
}

type AppEventPublishResult =
  | { type: 'success'; failedEvents: AppEventPublishFailure[] }
  | { type: 'error'; errorType: string; errorMessage: string };

const appEvents = {
  /**
   * Publish custom app events. In forge-sim, this fires matching triggers
   * in the same app by expanding the key to `avi:forge:<appId>:<key>`.
   *
   * If no appId is set in the manifest, falls back to `avi:forge:unknown:<key>`.
   */
  async publish(events: AppEvent | AppEvent[]): Promise<AppEventPublishResult> {
    const sim = getSimulator();
    const manifest = sim.getManifest();
    const appId = manifest?.raw.app?.id ?? 'unknown';
    const cloudId = 'sim-cloud-001';

    const eventsArray = Array.isArray(events) ? events : [events];
    const failedEvents: AppEventPublishFailure[] = [];

    for (const evt of eventsArray) {
      if (!evt.key || typeof evt.key !== 'string') {
        failedEvents.push({ event: evt, errorMessage: 'Missing or invalid event key' });
        continue;
      }

      const fullEventName = `avi:forge:${appId}:${evt.key}`;

      // Build the platform-generated event payload that the trigger handler receives.
      // Per Forge docs, the handler gets this shape — publishing apps can't add custom payload.
      const eventPayload: Record<string, unknown> = {
        workspaceId: `ari:cloud:jira::site/${cloudId}`,
        eventType: fullEventName,
        name: evt.key,
        environmentId: 'sim-environment-001',
        environmentType: 'DEVELOPMENT',
        environmentKey: 'default',
      };

      try {
        await sim.fireTrigger(fullEventName, eventPayload);
      } catch (err) {
        failedEvents.push({
          event: evt,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { type: 'success', failedEvents };
  },
};

export {
  Queue,
  InvalidQueueNameError,
  TooManyEventsError,
  PayloadTooBigError,
  NoEventsToPushError,
  RateLimitError,
  PartialSuccessError,
  InternalServerError,
  JobDoesNotExistError,
  InvalidPushSettingsError,
  InvocationLimitReachedError,
  InvocationError,
  InvocationErrorCode,
  JobProgress,
  QueueResponse,
  appEvents,
};

export type {
  AppEvent,
  AppEventPublishResult,
  AppEventPublishFailure,
};
