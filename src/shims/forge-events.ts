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

/**
 * Extract the UUID portion from a full app ARI.
 *
 * Real Forge `app.id` in the manifest is the full ARI string:
 *   ari:cloud:ecosystem::app/d9022ad7-c220-4836-b1d1-7f9f2c633d3a
 *
 * Custom app event AVIs require just the UUID portion. Returns the substring
 * after the last `/`. If the input has no `/`, returns the whole string —
 * tolerant of legacy/test fixtures that use a short id.
 *
 * @internal Exported for tests. Do not use from app code.
 */
export function extractAppIdUuid(appAri: string | undefined): string {
  if (!appAri) return 'unknown';
  const slash = appAri.lastIndexOf('/');
  return slash >= 0 ? appAri.slice(slash + 1) : appAri;
}

const appEvents = {
  /**
   * Publish custom app events. In forge-sim, this fires matching triggers
   * in the same app by expanding the key to the canonical AVI format:
   *
   *   avi:cloud:ecosystem::event/<app-uuid>/<key>
   *
   * The `<app-uuid>` is extracted from `manifest.app.id` (which is the full
   * ARI: `ari:cloud:ecosystem::app/<uuid>`).
   *
   * If `app.id` is missing, falls back to `avi:cloud:ecosystem::event/unknown/<key>`.
   *
   * Per Forge docs, publishing apps can't add custom payload — the trigger
   * handler receives only the platform-generated event metadata.
   *
   * @see https://developer.atlassian.com/platform/forge/events-reference/app-events/
   */
  async publish(events: AppEvent | AppEvent[]): Promise<AppEventPublishResult> {
    const sim = getSimulator();
    const manifest = sim.getManifest();
    const appUuid = extractAppIdUuid(manifest?.raw.app?.id);
    const cloudId = 'sim-cloud-001';

    const eventsArray = Array.isArray(events) ? events : [events];
    const failedEvents: AppEventPublishFailure[] = [];

    for (const evt of eventsArray) {
      if (!evt.key || typeof evt.key !== 'string') {
        failedEvents.push({ event: evt, errorMessage: 'Missing or invalid event key' });
        continue;
      }

      // Canonical Forge AVI format for custom app events.
      // NOTE: NOT `avi:forge:<...>` — that prefix is reserved for app lifecycle
      // events (avi:forge:installed:app, avi:forge:upgraded:app, etc).
      const fullEventName = `avi:cloud:ecosystem::event/${appUuid}/${evt.key}`;

      // Platform-generated payload shape that the trigger handler receives.
      // Per Forge docs, publishing apps can't add custom payload.
      //
      // Eval-10 F10: `name` is the event module's human-readable `name` from
      // `modules.event` in the manifest — not the raw key. Fall back to the
      // key when the module (or its name) is undeclared. The per-subscriber
      // `context`/`contextToken` fields are injected by sim.fireTrigger,
      // which knows each receiving trigger's module key.
      const eventModules = (manifest?.raw.modules as Record<string, unknown> | undefined)?.event;
      const eventModule = Array.isArray(eventModules)
        ? (eventModules as Array<Record<string, unknown>>).find((m) => m?.key === evt.key)
        : undefined;
      const eventName = typeof eventModule?.name === 'string' && eventModule.name
        ? eventModule.name
        : evt.key;

      const eventPayload: Record<string, unknown> = {
        workspaceId: `ari:cloud:jira::site/${cloudId}`,
        eventType: fullEventName,
        name: eventName,
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
