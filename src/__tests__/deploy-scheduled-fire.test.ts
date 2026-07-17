// Eval paper cut: ALL scheduled triggers fire at every deploy. That default
// is deliberate — real Forge starts every scheduled trigger ~5 minutes after
// deployment, so a deploy-time fire is the time-compressed equivalent (and
// it's what runs migration triggers before tests touch the database). But
// side-effectful jobs (daily digests, outbound webhooks) need an opt-out:
// deploy(dir, { fireScheduledTriggers: false }).
//
// Uses the dev-shared-entry fixture, whose scheduled handler counts firings
// in globalThis.__devSharedEntryTicks. Counters persist across deploys in a
// worker process (fresh bundle URL per deploy, same globalThis), so all
// assertions are deltas.
import { describe, it, expect, afterEach } from 'vitest';
import { join } from 'node:path';
import { createSimulator, type ForgeSimulator } from '../index.js';

const FIXTURE = join(__dirname, 'fixtures', 'dev-shared-entry');

const ticks = () => ((globalThis as any).__devSharedEntryTicks ?? 0) as number;

describe('deploy-time scheduled trigger firing', () => {
  let sim: ForgeSimulator | undefined;

  afterEach(async () => {
    await sim?.stop();
    sim = undefined;
  });

  it('fires each scheduled trigger once at deploy by default', async () => {
    const before = ticks();
    sim = createSimulator();
    const result = await sim.deploy(FIXTURE);
    expect(result.errors).toEqual([]);
    expect(ticks()).toBe(before + 1);
  });

  it('skips the deploy-time fire with { fireScheduledTriggers: false }', async () => {
    const before = ticks();
    sim = createSimulator();
    const result = await sim.deploy(FIXTURE, { fireScheduledTriggers: false });
    expect(result.errors).toEqual([]);
    expect(ticks()).toBe(before);

    // The trigger is still registered and manually fireable.
    const res = await sim.fireScheduledTrigger('tick');
    expect(res.statusCode).toBe(204);
    expect(ticks()).toBe(before + 1);
  });
});
