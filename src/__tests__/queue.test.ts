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

    const q = queue.createQueue({ key: 'my-queue' });
    const { jobId } = await q.push({ body: { msg: 'hello' } });

    expect(jobId).toBeDefined();
    expect(processed).toEqual([{ msg: 'hello' }]);
  });

  it('processes multiple events in a single push', async () => {
    const processed: any[] = [];
    queue.registerConsumer('bulk-queue', async (event) => {
      processed.push(event.body);
    });

    const q = queue.createQueue({ key: 'bulk-queue' });
    await q.push([
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

    const q = queue.createQueue({ key: 'stats-queue' });
    const { jobId } = await q.push([
      { body: { fail: false } },
      { body: { fail: true } },
      { body: { fail: false } },
    ]);

    const stats = await q.getJob(jobId).getStats();
    expect(stats.success).toBe(2);
    expect(stats.failed).toBe(1);
  });

  it('rejects more than 50 events', async () => {
    const events = Array.from({ length: 51 }, (_, i) => ({ body: { i } }));
    await expect(queue.push('q', events)).rejects.toThrow('TooManyEventsError');
  });

  it('events queue without consumer (no processing)', async () => {
    const q = queue.createQueue({ key: 'no-consumer' });
    const { jobId } = await q.push({ body: { msg: 'waiting' } });
    expect(jobId).toBeDefined();
    // No error, just queued
  });
});
