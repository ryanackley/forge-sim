/**
 * Behaviors of the REAL `@forge/events` that apps depend on.
 *
 * Apps run the real package now — its queue and app-event traffic reaches
 * forge-sim at the `__forge_fetch__` seam, via @forge/api's
 * `__requestAtlassianAsApp` rather than a seam call of its own (bare-seam
 * migration, phase 3e). `seam-fetch.test.ts` covers the wire side (push /
 * stats / cancel with the client-minted jobId, app events firing triggers);
 * this file covers the client-side validation that never reaches the seam.
 *
 * That validation is the parity win. The shim checked only that a queue key
 * was a non-empty string, and left the 50-event / 200KB limits to
 * SimulatedQueue, which threw PLAIN Errors with a class name stuffed into the
 * message. So an app pushing an invalid queue key, an empty array, or an
 * out-of-range delay succeeded in the sim and threw in Forge — and an app
 * catching `TooManyEventsError` by class never matched. Both are fixed by
 * construction now.
 *
 * Version pinned by VERIFIED_FORGE_VERSIONS (`@forge/events`).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import { createSimulator, type ForgeSimulator } from '../simulator.js';

// CJS require bypasses any vitest alias — this is the real published package.
const require = createRequire(import.meta.url);

describe('real @forge/events — client-side validation', () => {
  let sim: ForgeSimulator;
  let events: any;

  beforeAll(() => {
    sim = createSimulator();
    events = require('@forge/events');
  });

  afterAll(async () => {
    await sim.stop();
  });

  it('rejects a queue key with characters outside [a-zA-Z0-9-_]', () => {
    // The shim only checked for a missing/non-string key, so `my queue` and
    // `queue!` were accepted locally and rejected by the platform.
    expect(() => new events.Queue({ key: 'my queue' })).toThrow(
      /Queue names can only contain alphanumeric characters/,
    );
    expect(() => new events.Queue({ key: 'queue!' })).toThrow(/Queue names can only contain/);
    expect(() => new events.Queue({ key: '' })).toThrow(/Queue names can only contain/);
    // Valid shapes still construct.
    expect(() => new events.Queue({ key: 'analytics-queue_2' })).not.toThrow();
  });

  it('throws InvalidQueueNameError, catchable by class', () => {
    const err = (() => {
      try {
        new events.Queue({ key: 'bad key' });
        return null;
      } catch (e) {
        return e as Error;
      }
    })();
    expect(err).toBeInstanceOf(events.InvalidQueueNameError);
  });

  it('rejects an empty push with NoEventsToPushError', async () => {
    const queue = new events.Queue({ key: 'validation-queue' });
    const err = await queue.push([]).then(
      () => null,
      (e: Error) => e,
    );
    expect(err).toBeInstanceOf(events.NoEventsToPushError);
    expect(err?.message).toMatch(/No events pushed/);
  });

  it('rejects more than 50 events with TooManyEventsError', async () => {
    const queue = new events.Queue({ key: 'validation-queue' });
    const tooMany = Array.from({ length: 51 }, (_, i) => ({ body: { i } }));
    const err = await queue.push(tooMany).then(
      () => null,
      (e: Error) => e,
    );
    expect(err).toBeInstanceOf(events.TooManyEventsError);
    expect(err?.message).toMatch(/more than the 50 events allowed/);
  });

  it('rejects a delayInSeconds outside 0..900 with InvalidPushSettingsError', async () => {
    const queue = new events.Queue({ key: 'validation-queue' });
    for (const delayInSeconds of [901, -1]) {
      const err = await queue.push([{ body: { x: 1 }, delayInSeconds }]).then(
        () => null,
        (e: Error) => e,
      );
      expect(err, `delayInSeconds ${delayInSeconds}`).toBeInstanceOf(
        events.InvalidPushSettingsError,
      );
      expect(err?.message).toMatch(/must be between 0 and 900/);
    }
  });

  it('rejects a non-object event body with InvalidPayloadError semantics', async () => {
    const queue = new events.Queue({ key: 'validation-queue' });
    const err = await queue.push([{ body: 'not-an-object' } as any]).then(
      () => null,
      (e: Error) => e,
    );
    expect(err?.message).toMatch(/Event body must be an object/);
  });

  it('validation precedes I/O — an invalid push never reaches the consumer', async () => {
    const seen: unknown[] = [];
    sim.registerConsumer('validation-queue', async (event: any) => {
      seen.push(event.body);
    });
    const queue = new events.Queue({ key: 'validation-queue' });

    await expect(queue.push([])).rejects.toThrow();
    expect(seen).toEqual([]);

    // A valid push on the same queue still lands, so the rejection above was
    // the validator and not a broken seam.
    await queue.push([{ body: { ok: true } }]);
    expect(seen).toEqual([{ ok: true }]);
  });
});
