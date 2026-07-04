/**
 * Entity transactions (ENT-030/031) — kvs.transact() with conditions.
 *
 * ENT-030: all-or-nothing. `kvs.transact().set(...).delete(...).check(...)
 * .execute()` commits everything or nothing — any failed condition
 * (including a check) rolls back the whole transaction.
 *
 * ENT-031: limits — max 25 operations per transaction, each key used at
 * most once across all operations, payload ≤ 4 MB.
 *
 * Builder signatures mirror the SHIPPED @forge/kvs client
 * (out/transaction-api.js), not the docs:
 *   set(key, value, entity?, options?)  — entity: { entityName, conditions? }
 *   delete(key, entity?)
 *   check(key, { entityName, conditions })
 * Conditions are Filter builders (same surface as entity query filters).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { UnifiedKVS, ForgeKvsError } from '../kvs.js';
import { Filter, FilterConditions } from '../shims/forge-kvs.js';

describe('KVS transactions (ENT-030/031)', () => {
  let kvs: UnifiedKVS;

  beforeEach(() => {
    kvs = new UnifiedKVS();
    kvs.registerEntitySchema('Order', {
      attributes: {
        status: { type: 'string' },
        total: { type: 'integer' },
      },
      indexes: [],
    });
  });

  // ── ENT-030: atomicity + conditions ─────────────────────────────────

  describe('conditions and atomicity (ENT-030)', () => {
    it('set with passing condition commits', async () => {
      await kvs.entity('Order').set('o1', { status: 'open', total: 10 });

      await kvs.transact()
        .set('o1', { status: 'paid', total: 10 }, {
          entityName: 'Order',
          conditions: new Filter().and('status', FilterConditions.equalTo('open')),
        })
        .execute();

      expect(await kvs.entity('Order').get('o1')).toEqual({ status: 'paid', total: 10 });
    });

    it('set with failing condition rejects and applies NOTHING (rollback)', async () => {
      await kvs.entity('Order').set('o1', { status: 'closed', total: 10 });
      await kvs.set('audit-count', 1);

      const tx = kvs.transact()
        .set('audit-count', 2)
        .set('o1', { status: 'paid', total: 10 }, {
          entityName: 'Order',
          conditions: new Filter().and('status', FilterConditions.equalTo('open')),
        })
        .execute();

      await expect(tx).rejects.toThrow(/CONDITION_FAILED/);
      // Nothing was applied — including the unconditional set listed FIRST
      expect(await kvs.get('audit-count')).toBe(1);
      expect(await kvs.entity('Order').get('o1')).toEqual({ status: 'closed', total: 10 });
    });

    it('failing check() rolls back sets and deletes', async () => {
      await kvs.entity('Order').set('o1', { status: 'open', total: 10 });
      await kvs.set('to-delete', 'still here');

      const tx = kvs.transact()
        .set('new-key', 'value')
        .delete('to-delete')
        .check('o1', {
          entityName: 'Order',
          conditions: new Filter().and('status', FilterConditions.equalTo('paid')),
        })
        .execute();

      await expect(tx).rejects.toThrow(/CONDITION_FAILED/);
      expect(await kvs.get('new-key')).toBeUndefined();
      expect(await kvs.get('to-delete')).toBe('still here');
    });

    it('passing check() lets the transaction commit', async () => {
      await kvs.entity('Order').set('o1', { status: 'open', total: 10 });
      await kvs.set('to-delete', 'bye');

      await kvs.transact()
        .set('new-key', 'value')
        .delete('to-delete')
        .check('o1', {
          entityName: 'Order',
          conditions: new Filter().and('status', FilterConditions.equalTo('open')),
        })
        .execute();

      expect(await kvs.get('new-key')).toBe('value');
      expect(await kvs.get('to-delete')).toBeUndefined();
    });

    it('delete with failing condition rolls back the whole transaction', async () => {
      await kvs.entity('Order').set('o1', { status: 'open', total: 10 });

      const tx = kvs.transact()
        .set('side-effect', 'x')
        .delete('o1', {
          entityName: 'Order',
          conditions: new Filter().and('status', FilterConditions.equalTo('cancelled')),
        })
        .execute();

      await expect(tx).rejects.toThrow(/CONDITION_FAILED/);
      expect(await kvs.entity('Order').get('o1')).toEqual({ status: 'open', total: 10 });
      expect(await kvs.get('side-effect')).toBeUndefined();
    });

    it('and-chained conditions require ALL to pass', async () => {
      await kvs.entity('Order').set('o1', { status: 'open', total: 10 });

      const tx = kvs.transact()
        .check('o1', {
          entityName: 'Order',
          conditions: new Filter()
            .and('status', FilterConditions.equalTo('open'))
            .and('total', FilterConditions.greaterThan(100)), // fails
        })
        .execute();

      await expect(tx).rejects.toThrow(/CONDITION_FAILED/);
    });

    it('or-chained conditions pass when ANY matches', async () => {
      await kvs.entity('Order').set('o1', { status: 'open', total: 10 });

      await kvs.transact()
        .set('touched', true)
        .check('o1', {
          entityName: 'Order',
          conditions: new Filter()
            .or('status', FilterConditions.equalTo('cancelled')) // fails
            .or('total', FilterConditions.lessThan(100)),        // passes
        })
        .execute();

      expect(await kvs.get('touched')).toBe(true);
    });

    it('conditions against a missing key: NOT_EXISTS passes, EXISTS fails', async () => {
      // NOT_EXISTS on absent entity → vacuous truth → commit
      await kvs.transact()
        .set('ghost', { status: 'open', total: 1 }, {
          entityName: 'Order',
          conditions: new Filter().and('status', FilterConditions.notExists()),
        })
        .execute();
      expect(await kvs.entity('Order').get('ghost')).toEqual({ status: 'open', total: 1 });

      // EXISTS on absent entity → fails
      const tx = kvs.transact()
        .check('nope', {
          entityName: 'Order',
          conditions: new Filter().and('status', FilterConditions.exists()),
        })
        .execute();
      await expect(tx).rejects.toThrow(/CONDITION_FAILED/);
    });

    it('delete succeeds whether the key exists or not (docs semantics)', async () => {
      await kvs.transact().delete('never-existed').execute(); // no throw
    });

    it('entity schema violation rejects the whole transaction (nothing applied)', async () => {
      await kvs.set('counter', 1);

      const tx = kvs.transact()
        .set('counter', 2)
        .set('bad', { status: 'open', bogusField: true }, { entityName: 'Order' })
        .execute();

      await expect(tx).rejects.toThrow(/INVALID_ENTITY_VALUE/);
      expect(await kvs.get('counter')).toBe(1);
      expect(await kvs.entity('Order').get('bad')).toBeUndefined();
    });
  });

  // ── Client-side validation (mirrors shipped buildConditionsRequest) ──

  describe('empty Filter (client-side ForgeKvsError)', () => {
    it('execute() with an empty Filter throws ForgeKvsError before any I/O', async () => {
      await kvs.set('untouched', 1);

      const tx = kvs.transact()
        .set('untouched', 2)
        .check('anything', { entityName: 'Order', conditions: new Filter() as any })
        .execute();

      await expect(tx).rejects.toThrow('Builder must have at least one condition set');
      await expect(tx).rejects.toBeInstanceOf(ForgeKvsError);
      expect(await kvs.get('untouched')).toBe(1);
    });
  });

  // ── ENT-031: limits ──────────────────────────────────────────────────

  describe('limits (ENT-031)', () => {
    it('25 operations is accepted', async () => {
      const tx = kvs.transact();
      for (let i = 0; i < 25; i++) tx.set(`key-${i}`, i);
      await tx.execute();
      expect(await kvs.get('key-24')).toBe(24);
    });

    it('26 operations rejects with nothing applied', async () => {
      const tx = kvs.transact();
      for (let i = 0; i < 26; i++) tx.set(`key-${i}`, i);
      await expect(tx.execute()).rejects.toThrow(/TRANSACTION_OPERATION_LIMIT_EXCEEDED/);
      expect(await kvs.get('key-0')).toBeUndefined();
    });

    it('operation count spans sets + deletes + checks', async () => {
      await kvs.entity('Order').set('o1', { status: 'open', total: 1 });
      const tx = kvs.transact();
      for (let i = 0; i < 24; i++) tx.set(`key-${i}`, i);
      tx.delete('some-key');
      tx.check('o1', {
        entityName: 'Order',
        conditions: new Filter().and('status', FilterConditions.exists()),
      });
      await expect(tx.execute()).rejects.toThrow(/TRANSACTION_OPERATION_LIMIT_EXCEEDED/);
    });

    it('same key in two operations rejects (unique-key rule)', async () => {
      const tx = kvs.transact()
        .set('dup', 1)
        .delete('dup')
        .execute();
      await expect(tx).rejects.toThrow(/TRANSACTION_DUPLICATE_KEY/);
      expect(await kvs.get('dup')).toBeUndefined();
    });

    it('payload over 4 MB rejects with MAX_SIZE', async () => {
      const big = 'x'.repeat(4 * 1024 * 1024 + 1024);
      const tx = kvs.transact().set('big', big).execute();
      await expect(tx).rejects.toThrow(/MAX_SIZE/);
      expect(await kvs.get('big')).toBeUndefined();
    });
  });

  // ── TTL handling (shipped-client parity, incl. docs quirk) ──────────

  describe('ttl handling', () => {
    it('ttl as 4th arg (shipped-client shape) sets expireTime', async () => {
      await kvs.transact()
        .set('ttl-key', 'v', undefined, { ttl: { value: 1, unit: 'HOURS' } })
        .execute();

      const res = await kvs.handleRequest('/api/v1/get', {
        body: JSON.stringify({ key: 'ttl-key' }),
      });
      const body = await res.json();
      expect(body.expireTime).toBeDefined();
      const delta = new Date(body.expireTime).getTime() - Date.now();
      expect(delta).toBeGreaterThan(59 * 60 * 1000);
      expect(delta).toBeLessThanOrEqual(60 * 60 * 1000);
    });

    it('ttl as 3rd arg (docs shape) is silently dropped — mirrors the shipped client', async () => {
      // The KVS transactions DOC shows set(key, value, { ttl }) — but the
      // shipped client's 3rd param is `entity`, so the ttl never reaches
      // the wire. We mirror the shipped client because that's what apps
      // actually run in prod.
      await kvs.transact()
        .set('quirk-key', 'v', { ttl: { value: 1, unit: 'HOURS' } } as any)
        .execute();

      const res = await kvs.handleRequest('/api/v1/get', {
        body: JSON.stringify({ key: 'quirk-key' }),
      });
      const body = await res.json();
      expect(body.value).toBe('v');
      expect(body.expireTime).toBeUndefined();
    });
  });

  // ── HTTP surface: POST /api/v1/transaction ──────────────────────────

  describe('HTTP /api/v1/transaction (wire shape)', () => {
    it('successful transaction returns 200 and applies all ops', async () => {
      await kvs.set('rm-me', 1);
      const res = await kvs.handleRequest('/api/v1/transaction', {
        body: JSON.stringify({
          set: [{ key: 'a', value: 1 }, { key: 'b', value: 2 }],
          delete: [{ key: 'rm-me' }],
        }),
      });
      expect(res.status).toBe(200);
      expect(await kvs.get('a')).toBe(1);
      expect(await kvs.get('b')).toBe(2);
      expect(await kvs.get('rm-me')).toBeUndefined();
    });

    it('condition failure returns 400 { code: CONDITION_FAILED } with nothing applied', async () => {
      await kvs.entity('Order').set('o1', { status: 'closed', total: 5 });

      const res = await kvs.handleRequest('/api/v1/transaction', {
        body: JSON.stringify({
          set: [{ key: 'side', value: 1 }],
          check: [{
            key: 'o1',
            entityName: 'Order',
            conditions: { and: [{ property: 'status', condition: 'EQUAL_TO', values: ['open'] }] },
          }],
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('CONDITION_FAILED');
      expect(await kvs.get('side')).toBeUndefined();
    });

    it('limit violation returns 400 with the stable code', async () => {
      const res = await kvs.handleRequest('/api/v1/transaction', {
        body: JSON.stringify({
          set: Array.from({ length: 26 }, (_, i) => ({ key: `k${i}`, value: i })),
        }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('TRANSACTION_OPERATION_LIMIT_EXCEEDED');
    });

    it('legacy { actions } format still works', async () => {
      const res = await kvs.handleRequest('/api/v1/transaction', {
        body: JSON.stringify({
          actions: [
            { type: 'set', key: 'legacy', value: 'ok' },
          ],
        }),
      });
      expect(res.status).toBe(200);
      expect(await kvs.get('legacy')).toBe('ok');
    });
  });
});
