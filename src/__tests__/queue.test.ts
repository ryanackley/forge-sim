import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SimulatedQueue } from '../queue.js';

describe('SimulatedQueue', () => {
  let queue: SimulatedQueue;

  beforeEach(() => {
    queue = new SimulatedQueue();
  });

  it('pushes and processes events through consumer', async () => {
    const processed: any[] = [];
    queue.registerConsumer('my-queue', async (event) => {
      processed.push(event.body);
    });

    const { jobId } = await queue.push('my-queue', { body: { msg: 'hello' } });

    expect(jobId).toBeDefined();
    expect(processed).toEqual([{ msg: 'hello' }]);
  });

  it('processes multiple events in a single push', async () => {
    const processed: any[] = [];
    queue.registerConsumer('bulk-queue', async (event) => {
      processed.push(event.body);
    });

    await queue.push('bulk-queue', [
      { body: { n: 1 } },
      { body: { n: 2 } },
      { body: { n: 3 } },
    ]);

    expect(processed).toHaveLength(3);
  });

  it('tracks job stats', async () => {
    queue.registerConsumer('stats-queue', async (event) => {
      if (event.body.fail) throw new Error('boom');
    });

    const { jobId } = await queue.push('stats-queue', [
      { body: { fail: false } },
      { body: { fail: true } },
      { body: { fail: false } },
    ]);

    const job = queue.getJob(jobId);
    expect(job).toBeDefined();
    expect(job!.stats.success).toBe(2);
    expect(job!.stats.failed).toBe(1);
  });

  it('rejects more than 50 events', async () => {
    const events = Array.from({ length: 51 }, (_, i) => ({ body: { i } }));
    await expect(queue.push('q', events)).rejects.toThrow('TooManyEventsError');
  });

  it('events queue without consumer (no processing)', async () => {
    const { jobId } = await queue.push('no-consumer', { body: { msg: 'waiting' } });
    expect(jobId).toBeDefined();
    // No error, just queued
  });

  // ── Eval-9 E9-5: clear() preserves consumer wiring ──────────────────
  // Consumers are module wiring (deploy-registered), not runtime state.
  // clear() as beforeEach hygiene must NOT turn later pushes into silent
  // no-ops. Full teardown is clearAll(), reserved for reset/deploy infra.

  it('clear() wipes jobs/events but preserves registered consumers (E9-5)', async () => {
    const processed: any[] = [];
    queue.registerConsumer('wired-queue', async (event) => {
      processed.push(event.body);
    });
    await queue.push('wired-queue', { body: { n: 1 } });
    expect(processed).toHaveLength(1);

    queue.clear();

    // Runtime data gone…
    expect(queue.getEventLog()).toHaveLength(0);
    // …but the consumer still runs on the next push.
    await queue.push('wired-queue', { body: { n: 2 } });
    expect(processed).toHaveLength(2);
    expect(queue.getStats()['wired-queue'].consumers).toBe(1);
  });

  it('clearAll() tears down consumers too', async () => {
    const processed: any[] = [];
    queue.registerConsumer('doomed-queue', async (event) => {
      processed.push(event.body);
    });

    queue.clearAll();

    await queue.push('doomed-queue', { body: { n: 1 } });
    expect(processed).toHaveLength(0);
    expect(queue.getStats()['doomed-queue']?.consumers ?? 0).toBe(0);
  });
});
