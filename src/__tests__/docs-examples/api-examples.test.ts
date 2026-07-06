/**
 * Runnable doc examples — each #region here backs a `run=` fenced block in
 * the docs (see docs/testing/README.md § "Doc examples are tested").
 * docs-examples-sync.test.ts asserts the regions match the markdown
 * byte-for-byte (whitespace-normalized), and this file executes them in the
 * normal suite — so the examples are provably runnable, not just plausible.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createSimulator, type ForgeSimulator } from 'forge-sim';
import { resolve } from 'node:path';

let sim: ForgeSimulator;

beforeAll(async () => {
  sim = createSimulator();
  await sim.deploy(resolve(import.meta.dirname, '../fixtures/docs-sample-app'));
});

afterAll(async () => {
  await sim.stop();
});

// docs/testing/README.md § "Resolver Tests"
// #region resolver-create-retrieve
it('creates and retrieves an item', async () => {
  const created = await sim.invoke('createItem', {
    title: 'Test Item',
    priority: 'high',
  });
  expect(created.success).toBe(true);
  expect(created.id).toBeDefined();

  const fetched = await sim.invoke('getItem', { id: created.id });
  expect(fetched.title).toBe('Test Item');
});

it('returns error for missing item', async () => {
  const result = await sim.invoke('getItem', { id: 'nonexistent' });
  expect(result.error).toBe('Not found');
});
// #endregion

describe('KVS examples (docs/reference/api.md)', () => {
  it('transactions', async () => {
    await sim.kvs.set('key3', { count: 3 });

    // #region kvs-transactions
    await sim.kvs.transact()
      .set('key1', { count: 1 })
      .set('key2', { count: 2 })
      .delete('key3')
      .execute();
    // #endregion

    expect(await sim.kvs.get('key1')).toEqual({ count: 1 });
    expect(await sim.kvs.get('key2')).toEqual({ count: 2 });
    expect(await sim.kvs.get('key3')).toBeUndefined();
  });
});
