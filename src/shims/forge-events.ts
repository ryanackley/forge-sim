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
    const instance = sim.createQueue({ key: this.key });
    return instance.push(events);
  }

  getJob(jobId: string) {
    const sim = getSimulator();
    const instance = sim.createQueue({ key: this.key });
    return instance.getJob(jobId);
  }
}

class QueueResponse {
  constructor(public requestId: string, public statusCode: number) {}
}

// App events (lifecycle hooks)
const appEvents = {
  onInstalled: (_handler: Function) => {},
  onUninstalled: (_handler: Function) => {},
  onEnabled: (_handler: Function) => {},
  onDisabled: (_handler: Function) => {},
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
