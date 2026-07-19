/**
 * Pinning tests for adversarial evaluation #11 findings (v0.1.11).
 *
 * F4 (MEDIUM): async-event retry was unimplemented and the shim's
 *   InvocationError API had ZERO overlap with the real @forge/events
 *   package — `extends Error` with a `(message, code)` constructor and an
 *   invented InvocationErrorCode enum (UNKNOWN/TIMEOUT/OUT_OF_MEMORY/
 *   RUNTIME_ERROR vs the real FUNCTION_* values). A consumer returning a
 *   retry request was counted as `succeeded: 1` with no retry delivery.
 *
 *   All API shapes below are pinned against @forge/events@3.0.1 compiled
 *   output (verified in the eval-11 sandbox) and the Forge Async Events
 *   API docs.
 *
 * F5 (LOW): `queue.push()` to a queue with no registered consumer
 *   returned `{ jobId }` with zero trace. Real Forge queues are decoupled
 *   so push-without-consumer must NOT error (parity), but we now warn.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SimulatedQueue } from '../queue.js';
import {
  InvocationError,
  InvocationErrorCode,
  QueueResponse,
  Response,
} from '../shims/forge-events.js';

describe('F4: InvocationError shim parity with @forge/events v3', () => {
  it('InvocationErrorCode has exactly the real enum values', () => {
    expect(InvocationErrorCode).toEqual({
      FUNCTION_OUT_OF_MEMORY: 'FUNCTION_OUT_OF_MEMORY',
      FUNCTION_TIME_OUT: 'FUNCTION_TIME_OUT',
      FUNCTION_PLATFORM_UNKNOWN_ERROR: 'FUNCTION_PLATFORM_UNKNOWN_ERROR',
      FUNCTION_PLATFORM_RATE_LIMITED: 'FUNCTION_PLATFORM_RATE_LIMITED',
      FUNCTION_UPSTREAM_RATE_LIMITED: 'FUNCTION_UPSTREAM_RATE_LIMITED',
      FUNCTION_RETRY_REQUEST: 'FUNCTION_RETRY_REQUEST',
    });
    // The previously-invented values must be gone.
    expect((InvocationErrorCode as Record<string, string>).UNKNOWN).toBeUndefined();
    expect((InvocationErrorCode as Record<string, string>).TIMEOUT).toBeUndefined();
    expect((InvocationErrorCode as Record<string, string>).RUNTIME_ERROR).toBeUndefined();
  });

  it('new InvocationError() yields the serialized {_retry, retryOptions} form with defaults', () => {
    const result = new InvocationError() as unknown as Record<string, unknown>;
    // Real package quirk: the constructor returns this.toJSON(), so the
    // result is a PLAIN object, not an InvocationError instance.
    expect(result).toEqual({
      _retry: true,
      retryOptions: {
        retryAfter: 1,
        retryReason: InvocationErrorCode.FUNCTION_RETRY_REQUEST,
      },
    });
    expect(result instanceof InvocationError).toBe(false);
  });

  it('new InvocationError(options) carries the options through and clamps retryAfter <= 0 to 1', () => {
    const custom = new InvocationError({
      retryAfter: 30,
      retryReason: InvocationErrorCode.FUNCTION_UPSTREAM_RATE_LIMITED,
      retryData: { userName: 'john' },
    }) as unknown as Record<string, any>;
    expect(custom._retry).toBe(true);
    expect(custom.retryOptions).toEqual({
      retryAfter: 30,
      retryReason: 'FUNCTION_UPSTREAM_RATE_LIMITED',
      retryData: { userName: 'john' },
    });

    const clamped = new InvocationError({
      retryAfter: 0,
      retryReason: InvocationErrorCode.FUNCTION_RETRY_REQUEST,
    }) as unknown as Record<string, any>;
    expect(clamped.retryOptions.retryAfter).toBe(1);
  });

  it('QueueResponse extends Response and retry() flips the _retry flag', () => {
    const resp = new QueueResponse();
    expect(resp).toBeInstanceOf(Response);
    expect((resp as unknown as { _retry: boolean })._retry).toBe(false);
    resp.retry();
    expect((resp as unknown as { _retry: boolean })._retry).toBe(true);
  });
});

describe('F4: queue engine honors consumer-returned retry requests', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('re-delivers with retryContext when the consumer returns an InvocationError, then succeeds', async () => {
    const queue = new SimulatedQueue();
    const deliveries: any[] = [];

    queue.registerConsumer('retry-queue', async (event: any) => {
      deliveries.push(event);
      if (deliveries.length === 1) {
        return new InvocationError({
          retryAfter: 5,
          retryReason: InvocationErrorCode.FUNCTION_UPSTREAM_RATE_LIMITED,
          retryData: { attempt: 1 },
        });
      }
      return undefined; // success
    });

    await queue.push('retry-queue', { body: { id: 'evt-1' } });

    expect(deliveries).toHaveLength(2);
    // First delivery: no retryContext (real Forge only populates it on retries).
    expect(deliveries[0].retryContext).toBeUndefined();
    // Retry delivery: retryContext populated from the InvocationError.
    expect(deliveries[1].retryContext).toEqual({
      retryCount: 1,
      retryReason: 'FUNCTION_UPSTREAM_RATE_LIMITED',
      retryData: { attempt: 1 },
    });
    // Same event, same body, same eventId across deliveries.
    expect(deliveries[1].body).toEqual({ id: 'evt-1' });
    expect(deliveries[1].eventId).toBe(deliveries[0].eventId);

    const stats = queue.getStats()['retry-queue'];
    expect(stats.succeeded).toBe(1);
    expect(stats.failed).toBe(0);
    expect(stats.retried).toBe(1);
  });

  it('EVAL-11 repro: retry request is NOT counted as succeeded-with-no-retry', async () => {
    // The exact adversarial4.mjs scenario: consumer returns a real-shaped
    // InvocationError. Pre-fix: invoked once, no retry, succeeded: 1.
    const queue = new SimulatedQueue();
    let invocations = 0;

    queue.registerConsumer('vendor-sync', async () => {
      invocations++;
      return new InvocationError({
        retryAfter: 10,
        retryReason: InvocationErrorCode.FUNCTION_RETRY_REQUEST,
      });
    });

    await queue.push('vendor-sync', { body: { vendor: 'acme' } });

    // 1 initial delivery + 4 retries (the cap), then failed.
    expect(invocations).toBe(5);
    const stats = queue.getStats()['vendor-sync'];
    expect(stats.succeeded).toBe(0);
    expect(stats.failed).toBe(1);
    expect(stats.retried).toBe(4);
    // Cap exhaustion is loud.
    expect(errorSpy.mock.calls.some((c) => String(c[0]).includes('retry limit'))).toBe(true);
  });

  it('retryContext.retryCount increments across successive retries', async () => {
    const queue = new SimulatedQueue();
    const retryCounts: Array<number | undefined> = [];

    queue.registerConsumer('counting-queue', async (event: any) => {
      retryCounts.push(event.retryContext?.retryCount);
      if (retryCounts.length < 3) {
        return new InvocationError();
      }
      return undefined;
    });

    await queue.push('counting-queue', { body: {} });

    expect(retryCounts).toEqual([undefined, 1, 2]);
    const stats = queue.getStats()['counting-queue'];
    expect(stats.succeeded).toBe(1);
    expect(stats.retried).toBe(2);
  });

  it('a returned QueueResponse with retry() called also triggers a retry', async () => {
    const queue = new SimulatedQueue();
    let invocations = 0;

    queue.registerConsumer('qr-queue', async () => {
      invocations++;
      if (invocations === 1) {
        const resp = new QueueResponse();
        resp.retry();
        return resp;
      }
      return undefined;
    });

    await queue.push('qr-queue', { body: {} });
    expect(invocations).toBe(2);
    expect(queue.getStats()['qr-queue'].succeeded).toBe(1);
  });

  it('a plain QueueResponse (no retry) and ordinary return values do NOT trigger retries', async () => {
    const queue = new SimulatedQueue();
    let invocations = 0;

    queue.registerConsumer('plain-queue', async () => {
      invocations++;
      return new QueueResponse();
    });
    queue.registerConsumer('value-queue', async () => {
      invocations++;
      return { ok: true, _retry: false };
    });

    await queue.push('plain-queue', { body: {} });
    await queue.push('value-queue', { body: {} });
    expect(invocations).toBe(2);
    expect(queue.getStats()['plain-queue'].succeeded).toBe(1);
    expect(queue.getStats()['value-queue'].succeeded).toBe(1);
  });

  it('delivers AsyncEvent-shaped events: body, queueName, jobId, eventId', async () => {
    const queue = new SimulatedQueue();
    let received: any;
    queue.registerConsumer('shape-queue', async (event: any) => {
      received = event;
    });

    const { jobId } = await queue.push('shape-queue', { body: { hello: 'world' } });

    expect(received.body).toEqual({ hello: 'world' });
    expect(received.queueName).toBe('shape-queue');
    expect(received.jobId).toBe(jobId);
    expect(typeof received.eventId).toBe('string');
    expect(received.eventId.length).toBeGreaterThan(0);
    expect('retryContext' in received).toBe(false);
  });

  it('clamps retryAfter above 900s down to 900 in the retry log (platform parity)', async () => {
    const queue = new SimulatedQueue();
    let invocations = 0;
    queue.registerConsumer('clamp-queue', async () => {
      invocations++;
      if (invocations === 1) {
        return new InvocationError({
          retryAfter: 3600,
          retryReason: InvocationErrorCode.FUNCTION_RETRY_REQUEST,
        });
      }
      return undefined;
    });

    await queue.push('clamp-queue', { body: {} });
    expect(warnSpy.mock.calls.some((c) => String(c[0]).includes('retryAfter: 900s'))).toBe(true);
  });

  it('a throwing consumer still counts as failed (no implicit retry)', async () => {
    const queue = new SimulatedQueue();
    queue.registerConsumer('throwing-queue', async () => {
      throw new Error('boom');
    });

    await queue.push('throwing-queue', { body: {} });
    const stats = queue.getStats()['throwing-queue'];
    expect(stats.failed).toBe(1);
    expect(stats.succeeded).toBe(0);
    expect(stats.retried).toBe(0);
  });
});

describe('F5: push to a consumerless queue warns (but still succeeds — Forge parity)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('warns with the queue key when no consumer is registered', async () => {
    const queue = new SimulatedQueue();
    const result = await queue.push('noSuchQueue', { body: { orphan: true } });

    // Parity: push still succeeds — real Forge queues are decoupled.
    expect(result.jobId).toBeTruthy();
    const warning = warnSpy.mock.calls.map((c) => String(c[0])).find((m) => m.includes('noSuchQueue'));
    expect(warning).toBeDefined();
    expect(warning).toContain('no consumer is registered');
  });

  it('does not warn when a consumer is registered', async () => {
    const queue = new SimulatedQueue();
    queue.registerConsumer('wired', async () => {});
    await queue.push('wired', { body: {} });
    expect(warnSpy.mock.calls.some((c) => String(c[0]).includes('no consumer is registered'))).toBe(false);
  });
});
