/**
 * Comprehensive unit tests for UnifiedKVS.
 *
 * Covers: direct API, entity API, schema validation, query builders,
 * transactions, handleRequest HTTP layer, batch operations, secrets,
 * persistence (dump/restore), and edge cases.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { UnifiedKVS, WhereConditions } from '../kvs.js';
import type { EntitySchema } from '../kvs.js';

describe('UnifiedKVS', () => {
  let kvs: UnifiedKVS;

  beforeEach(() => {
    kvs = new UnifiedKVS();
  });

  // ── Plain KVS: Direct API ──────────────────────────────────────────

  describe('Plain KVS', () => {
    it('get returns undefined for missing key', async () => {
      expect(await kvs.get('missing')).toBeUndefined();
    });

    it('set and get round-trip', async () => {
      await kvs.set('key', 'value');
      expect(await kvs.get('key')).toBe('value');
    });

    it('set stores objects by value (deep copy)', async () => {
      const obj = { a: 1, nested: { b: 2 } };
      await kvs.set('obj', obj);
      obj.a = 999;
      obj.nested.b = 999;
      const retrieved = await kvs.get('obj');
      expect(retrieved).toEqual({ a: 1, nested: { b: 2 } });
    });

    it('set rejects null', async () => {
      await expect(kvs.set('key', null)).rejects.toThrow('Cannot store null');
    });

    it('set rejects undefined', async () => {
      await expect(kvs.set('key', undefined)).rejects.toThrow('Cannot store null or undefined');
    });

    it('set overwrites existing value', async () => {
      await kvs.set('key', 'first');
      await kvs.set('key', 'second');
      expect(await kvs.get('key')).toBe('second');
    });

    it('delete removes key', async () => {
      await kvs.set('key', 'value');
      await kvs.delete('key');
      expect(await kvs.get('key')).toBeUndefined();
    });

    it('delete is idempotent for missing key', async () => {
      await kvs.delete('nonexistent'); // should not throw
    });

    it('stores various value types', async () => {
      await kvs.set('string', 'hello');
      await kvs.set('number', 42);
      await kvs.set('boolean', true);
      await kvs.set('array', [1, 2, 3]);
      await kvs.set('object', { x: 'y' });

      expect(await kvs.get('string')).toBe('hello');
      expect(await kvs.get('number')).toBe(42);
      expect(await kvs.get('boolean')).toBe(true);
      expect(await kvs.get('array')).toEqual([1, 2, 3]);
      expect(await kvs.get('object')).toEqual({ x: 'y' });
    });

    it('size reflects entry count', async () => {
      expect(kvs.size).toBe(0);
      await kvs.set('a', 1);
      await kvs.set('b', 2);
      expect(kvs.size).toBe(2);
      await kvs.delete('a');
      expect(kvs.size).toBe(1);
    });
  });

  // ── Secrets ─────────────────────────────────────────────────────────

  describe('Secrets', () => {
    it('set and get secret', async () => {
      await kvs.setSecret('api-key', 'sk-12345');
      expect(await kvs.getSecret('api-key')).toBe('sk-12345');
    });

    it('get missing secret returns undefined', async () => {
      expect(await kvs.getSecret('nope')).toBeUndefined();
    });

    it('delete secret', async () => {
      await kvs.setSecret('token', 'abc');
      await kvs.deleteSecret('token');
      expect(await kvs.getSecret('token')).toBeUndefined();
    });

    it('secrets are isolated from plain KVS', async () => {
      await kvs.set('key', 'plain');
      await kvs.setSecret('key', 'secret');
      expect(await kvs.get('key')).toBe('plain');
      expect(await kvs.getSecret('key')).toBe('secret');
    });
  });

  // ── Query Builder ───────────────────────────────────────────────────

  describe('Query Builder', () => {
    beforeEach(async () => {
      await kvs.set('task:1', { title: 'First' });
      await kvs.set('task:2', { title: 'Second' });
      await kvs.set('task:3', { title: 'Third' });
      await kvs.set('user:1', { name: 'Alice' });
      await kvs.set('user:2', { name: 'Bob' });
    });

    it('getMany returns all entries without where', async () => {
      const { results } = await kvs.query().getMany();
      expect(results).toHaveLength(5);
    });

    it('where beginsWith filters by prefix', async () => {
      const { results } = await kvs.query()
        .where('key', WhereConditions.beginsWith('task:'))
        .getMany();
      expect(results).toHaveLength(3);
      expect(results.every(r => r.key.startsWith('task:'))).toBe(true);
    });

    it('where rejects non-beginsWith conditions (parity with real @forge/kvs)', async () => {
      // Real @forge/kvs declares `WhereClause = BeginsWithClause` for
      // simple KVS queries — the type system blocks other conditions at
      // compile time. We runtime-enforce the same contract so silent
      // behavioral drift can't happen at the simulator boundary.
      expect(() => {
        kvs.query().where('key', WhereConditions.equalTo('user:1') as any);
      }).toThrow(/only supports WhereConditions\.beginsWith/);
    });

    it('limit restricts result count', async () => {
      const { results, nextCursor } = await kvs.query().limit(2).getMany();
      expect(results).toHaveLength(2);
      expect(nextCursor).toBeDefined();
    });

    it('cursor paginates through results', async () => {
      const page1 = await kvs.query().limit(2).getMany();
      expect(page1.results).toHaveLength(2);

      const page2 = await kvs.query().limit(2).cursor(page1.nextCursor!).getMany();
      expect(page2.results).toHaveLength(2);

      // No overlap
      const page1Keys = page1.results.map(r => r.key);
      const page2Keys = page2.results.map(r => r.key);
      expect(page1Keys.filter(k => page2Keys.includes(k))).toHaveLength(0);
    });

    it('sort DESC reverses order', async () => {
      const { results } = await kvs.query()
        .where('key', WhereConditions.beginsWith('task:'))
        .sort('DESC')
        .getMany();
      expect(results[0].key).toBe('task:3');
      expect(results[2].key).toBe('task:1');
    });

    it('getOne returns first match', async () => {
      const result = await kvs.query()
        .where('key', WhereConditions.beginsWith('user:'))
        .getOne();
      expect(result).toBeDefined();
      expect(result!.key).toBe('user:1');
    });

    it('getOne returns undefined when no match', async () => {
      const result = await kvs.query()
        .where('key', WhereConditions.beginsWith('zzz:'))
        .getOne();
      expect(result).toBeUndefined();
    });

    // ── Parity: spec KVS-024/025/026 ──────────────────────────────────

    it('default page size is 10 with nextCursor set (KVS-025)', async () => {
      // 5 from outer beforeEach + 10 more = 15 matching keys
      for (let i = 0; i < 10; i++) {
        await kvs.set(`extra:${String(i).padStart(2, '0')}`, { i });
      }
      const { results, nextCursor } = await kvs.query().getMany();
      expect(results).toHaveLength(10);
      expect(nextCursor).toBeDefined();
    });

    it('chaining two where clauses rejects with QUERY_WHERE_INVALID (KVS-024)', async () => {
      await expect(
        kvs.query()
          .where('key', WhereConditions.beginsWith('task:'))
          .where('key', WhereConditions.beginsWith('user:'))
          .getMany()
      ).rejects.toThrow(/QUERY_WHERE_INVALID/);
    });

    it('limit above 100 rejects with LIST_QUERY_LIMIT_EXCEEDED; limit(100) accepted (KVS-026)', async () => {
      await expect(kvs.query().limit(101).getMany()).rejects.toThrow(
        /LIST_QUERY_LIMIT_EXCEEDED/
      );
      const { results } = await kvs.query().limit(100).getMany();
      expect(results).toHaveLength(5);
    });
  });

  // ── Batch Operations ────────────────────────────────────────────────

  describe('Batch Operations', () => {
    it('getMany retrieves multiple keys', async () => {
      await kvs.set('a', 1);
      await kvs.set('b', 2);
      await kvs.set('c', 3);

      const result = await kvs.getMany(['a', 'c', 'missing']);
      expect(result.get('a')).toBe(1);
      expect(result.get('c')).toBe(3);
      expect(result.has('missing')).toBe(false);
    });

    it('setMany writes multiple entries', async () => {
      await kvs.setMany([
        { key: 'x', value: 10 },
        { key: 'y', value: 20 },
      ]);
      expect(await kvs.get('x')).toBe(10);
      expect(await kvs.get('y')).toBe(20);
    });

    it('deleteMany removes multiple keys', async () => {
      await kvs.set('a', 1);
      await kvs.set('b', 2);
      await kvs.set('c', 3);
      await kvs.deleteMany(['a', 'c']);
      expect(await kvs.get('a')).toBeUndefined();
      expect(await kvs.get('b')).toBe(2);
      expect(await kvs.get('c')).toBeUndefined();
    });
  });

  // ── Entity Direct API ──────────────────────────────────────────────

  describe('Entity Direct API', () => {
    const taskSchema: EntitySchema = {
      attributes: {
        title: { type: 'string' },
        priority: { type: 'integer' },
        score: { type: 'float' },
        done: { type: 'boolean' },
      },
      indexes: [
        { name: 'by-priority', partition: ['done'], range: 'priority' },
      ],
    };

    beforeEach(() => {
      kvs.registerEntitySchema('Task', taskSchema);
    });

    it('set and get entity', async () => {
      await kvs.entity('Task').set('t1', { title: 'Build tests', priority: 1, score: 9.5, done: false });
      const val = await kvs.entity('Task').get('t1');
      expect(val).toEqual({ title: 'Build tests', priority: 1, score: 9.5, done: false });
    });

    it('get missing entity returns undefined', async () => {
      expect(await kvs.entity('Task').get('missing')).toBeUndefined();
    });

    it('delete entity', async () => {
      await kvs.entity('Task').set('t1', { title: 'Delete me', priority: 1, score: 0, done: false });
      await kvs.entity('Task').delete('t1');
      expect(await kvs.entity('Task').get('t1')).toBeUndefined();
    });

    it('entities are isolated by name', async () => {
      kvs.registerEntitySchema('User', {
        attributes: { name: { type: 'string' } },
        indexes: [],
      });
      await kvs.entity('Task').set('id1', { title: 'Task', priority: 1, score: 0, done: false });
      await kvs.entity('User').set('id1', { name: 'Alice' });

      expect(await kvs.entity('Task').get('id1')).toEqual({ title: 'Task', priority: 1, score: 0, done: false });
      expect(await kvs.entity('User').get('id1')).toEqual({ name: 'Alice' });
    });

    it('entities are isolated from plain KVS', async () => {
      await kvs.set('t1', 'plain value');
      await kvs.entity('Task').set('t1', { title: 'Entity', priority: 1, score: 0, done: false });

      expect(await kvs.get('t1')).toBe('plain value');
      expect(await kvs.entity('Task').get('t1')).toEqual({ title: 'Entity', priority: 1, score: 0, done: false });
    });
  });

  // ── Schema Validation ──────────────────────────────────────────────

  describe('Schema Validation', () => {
    beforeEach(() => {
      kvs.registerEntitySchema('Item', {
        attributes: {
          name: { type: 'string' },
          count: { type: 'integer' },
          weight: { type: 'float' },
          active: { type: 'boolean' },
        },
        indexes: [],
      });
    });

    it('accepts valid entity value', async () => {
      await kvs.entity('Item').set('i1', { name: 'Widget', count: 5, weight: 2.5, active: true });
      expect(await kvs.entity('Item').get('i1')).toBeDefined();
    });

    it('rejects unknown attributes', async () => {
      await expect(
        kvs.entity('Item').set('i1', { name: 'Widget', unknownField: 'bad' })
      ).rejects.toThrow('Unknown attribute "unknownField"');
    });

    it('rejects wrong type: string expected, got number', async () => {
      await expect(
        kvs.entity('Item').set('i1', { name: 42 })
      ).rejects.toThrow('Type mismatch for attribute "name"');
    });

    it('rejects wrong type: integer expected, got string', async () => {
      await expect(
        kvs.entity('Item').set('i1', { count: 'five' })
      ).rejects.toThrow('Type mismatch for attribute "count"');
    });

    it('rejects wrong type: integer expected, got float', async () => {
      await expect(
        kvs.entity('Item').set('i1', { count: 3.14 })
      ).rejects.toThrow('Type mismatch for attribute "count"');
    });

    it('rejects wrong type: boolean expected, got string', async () => {
      await expect(
        kvs.entity('Item').set('i1', { active: 'yes' })
      ).rejects.toThrow('Type mismatch for attribute "active"');
    });

    it('accepts float for float attribute', async () => {
      await kvs.entity('Item').set('i1', { weight: 3.14 });
      expect((await kvs.entity('Item').get('i1')).weight).toBe(3.14);
    });

    it('accepts integer for float attribute (number is number)', async () => {
      await kvs.entity('Item').set('i1', { weight: 5 });
      expect((await kvs.entity('Item').get('i1')).weight).toBe(5);
    });

    it('allows null values for attributes', async () => {
      await kvs.entity('Item').set('i1', { name: null, count: null });
      const val = await kvs.entity('Item').get('i1');
      expect(val.name).toBeNull();
    });

    it('allows subset of attributes', async () => {
      await kvs.entity('Item').set('i1', { name: 'Partial' });
      expect(await kvs.entity('Item').get('i1')).toEqual({ name: 'Partial' });
    });

    it('skips validation for entities without registered schema', async () => {
      // No schema registered for 'Unregistered' — should allow anything
      await kvs.entity('Unregistered').set('u1', { anything: 'goes', nested: { deep: true } });
      expect(await kvs.entity('Unregistered').get('u1')).toEqual({ anything: 'goes', nested: { deep: true } });
    });
  });

  // ── Entity Query Builder ───────────────────────────────────────────

  describe('Entity Query', () => {
    beforeEach(async () => {
      kvs.registerEntitySchema('Task', {
        attributes: {
          title: { type: 'string' },
          priority: { type: 'integer' },
          status: { type: 'string' },
        },
        indexes: [
          { name: 'by-status', partition: ['status'], range: 'priority' },
        ],
      });

      await kvs.entity('Task').set('t1', { title: 'Low open', priority: 3, status: 'open' });
      await kvs.entity('Task').set('t2', { title: 'High open', priority: 1, status: 'open' });
      await kvs.entity('Task').set('t3', { title: 'Med closed', priority: 2, status: 'closed' });
      await kvs.entity('Task').set('t4', { title: 'High closed', priority: 1, status: 'closed' });
      await kvs.entity('Task').set('t5', { title: 'Med open', priority: 2, status: 'open' });
    });

    it('getMany returns all entities of this type', async () => {
      const { results } = await kvs.entity('Task').query().getMany();
      expect(results).toHaveLength(5);
    });

    it('index with partition filters by partition key', async () => {
      const { results } = await kvs.entity('Task').query()
        .index('by-status', { partition: ['open'] })
        .getMany();
      expect(results).toHaveLength(3);
      expect(results.every(r => r.value.status === 'open')).toBe(true);
    });

    it('index with range condition filters on range key', async () => {
      const { results } = await kvs.entity('Task').query()
        .index('by-status', { partition: ['open'] })
        .where({ condition: 'LESS_THAN', values: [3] })
        .getMany();
      expect(results).toHaveLength(2); // priority 1 and 2
      expect(results.every(r => r.value.priority < 3)).toBe(true);
    });

    it('sort ASC orders by range key ascending', async () => {
      const { results } = await kvs.entity('Task').query()
        .index('by-status', { partition: ['open'] })
        .sort('ASC')
        .getMany();
      const priorities = results.map(r => r.value.priority);
      expect(priorities).toEqual([1, 2, 3]);
    });

    it('sort DESC orders by range key descending', async () => {
      const { results } = await kvs.entity('Task').query()
        .index('by-status', { partition: ['open'] })
        .sort('DESC')
        .getMany();
      const priorities = results.map(r => r.value.priority);
      expect(priorities).toEqual([3, 2, 1]);
    });

    it('limit restricts results', async () => {
      const { results, nextCursor } = await kvs.entity('Task').query()
        .index('by-status', { partition: ['open'] })
        .sort('ASC')
        .limit(2)
        .getMany();
      expect(results).toHaveLength(2);
      expect(nextCursor).toBeDefined();
    });

    it('default page size is 10 with nextCursor set (ENT-025)', async () => {
      for (let i = 0; i < 10; i++) {
        await kvs.entity('Task').set(`extra-${i}`, { title: `Extra ${i}`, priority: 5, status: 'open' });
      }
      // 5 from beforeEach + 10 extras = 15 entities, no limit()
      const { results, nextCursor } = await kvs.entity('Task').query().getMany();
      expect(results).toHaveLength(10);
      expect(nextCursor).toBeDefined();
    });

    it('limit outside 1-100 rejects with COMPLEX_QUERY_PAGE_LIMIT_NOT_IN_RANGE (ENT-025)', async () => {
      await expect(
        kvs.entity('Task').query().index('by-status', { partition: ['open'] }).limit(0).getMany()
      ).rejects.toThrow(/COMPLEX_QUERY_PAGE_LIMIT_NOT_IN_RANGE/);
      await expect(
        kvs.entity('Task').query().index('by-status', { partition: ['open'] }).limit(101).getMany()
      ).rejects.toThrow(/COMPLEX_QUERY_PAGE_LIMIT_NOT_IN_RANGE/);
      // Boundary values accepted
      const ok = await kvs.entity('Task').query().index('by-status', { partition: ['open'] }).limit(100).getMany();
      expect(ok.results.length).toBeGreaterThan(0);
    });

    it('cursor paginates through results', async () => {
      const page1 = await kvs.entity('Task').query()
        .index('by-status', { partition: ['open'] })
        .sort('ASC')
        .limit(2)
        .getMany();

      const page2 = await kvs.entity('Task').query()
        .index('by-status', { partition: ['open'] })
        .sort('ASC')
        .limit(2)
        .cursor(page1.nextCursor!)
        .getMany();

      expect(page2.results).toHaveLength(1); // only 1 left
      expect(page2.nextCursor).toBeUndefined();
    });

    it('getOne returns first match', async () => {
      const result = await kvs.entity('Task').query()
        .index('by-status', { partition: ['closed'] })
        .sort('ASC')
        .getOne();
      expect(result).toBeDefined();
      expect(result!.value.status).toBe('closed');
      expect(result!.value.priority).toBe(1);
    });

    it('getOne returns undefined when no match', async () => {
      const result = await kvs.entity('Task').query()
        .index('by-status', { partition: ['archived'] })
        .getOne();
      expect(result).toBeUndefined();
    });

    it('filters with AND conditions', async () => {
      const { results } = await kvs.entity('Task').query()
        .filters({
          filters: () => [
            { property: 'status', condition: 'EQUAL_TO', values: ['open'] },
            { property: 'priority', condition: 'LESS_THAN_EQUAL_TO', values: [2] },
          ],
          operator: () => 'and',
        })
        .getMany();
      expect(results).toHaveLength(2);
      expect(results.every(r => r.value.status === 'open' && r.value.priority <= 2)).toBe(true);
    });

    it('filters with OR conditions', async () => {
      const { results } = await kvs.entity('Task').query()
        .filters({
          filters: () => [
            { property: 'priority', condition: 'EQUAL_TO', values: [1] },
            { property: 'status', condition: 'EQUAL_TO', values: ['closed'] },
          ],
          operator: () => 'or',
        })
        .getMany();
      // priority=1 (t2, t4) OR status=closed (t3, t4) → t2, t3, t4
      expect(results).toHaveLength(3);
    });
  });

  // ── Range Conditions ───────────────────────────────────────────────

  describe('Range/Filter Conditions', () => {
    beforeEach(async () => {
      kvs.registerEntitySchema('Score', {
        attributes: { name: { type: 'string' }, value: { type: 'integer' } },
        indexes: [{ name: 'by-value', partition: [], range: 'value' }],
      });
      for (let i = 1; i <= 10; i++) {
        await kvs.entity('Score').set(`s${i}`, { name: `Score ${i}`, value: i * 10 });
      }
    });

    it('BETWEEN filters inclusive range', async () => {
      const { results } = await kvs.entity('Score').query()
        .index('by-value')
        .where({ condition: 'BETWEEN', values: [30, 70] })
        .getMany();
      expect(results).toHaveLength(5); // 30,40,50,60,70
    });

    it('GREATER_THAN filters strictly', async () => {
      const { results } = await kvs.entity('Score').query()
        .index('by-value')
        .where({ condition: 'GREATER_THAN', values: [80] })
        .getMany();
      expect(results).toHaveLength(2); // 90, 100
    });

    it('LESS_THAN_EQUAL_TO includes boundary', async () => {
      const { results } = await kvs.entity('Score').query()
        .index('by-value')
        .where({ condition: 'LESS_THAN_EQUAL_TO', values: [20] })
        .getMany();
      expect(results).toHaveLength(2); // 10, 20
    });

    it('BEGINS_WITH on string attributes', async () => {
      const { results } = await kvs.entity('Score').query()
        .filters({
          filters: () => [{ property: 'name', condition: 'BEGINS_WITH', values: ['Score 1'] }],
          operator: () => 'and',
        })
        .getMany();
      // "Score 1", "Score 10"
      expect(results).toHaveLength(2);
    });

    it('CONTAINS on string attributes', async () => {
      const { results } = await kvs.entity('Score').query()
        .filters({
          filters: () => [{ property: 'name', condition: 'CONTAINS', values: ['5'] }],
          operator: () => 'and',
        })
        .getMany();
      expect(results).toHaveLength(1); // "Score 5"
    });

    it('EXISTS filters non-null values', async () => {
      await kvs.entity('Score').set('s-null', { name: 'Nullish' } as any);
      const { results } = await kvs.entity('Score').query()
        .filters({
          filters: () => [{ property: 'value', condition: 'EXISTS', values: [] }],
          operator: () => 'and',
        })
        .getMany();
      expect(results).toHaveLength(10); // the null one is excluded
    });

    it('NOT_EQUAL_TO excludes matches', async () => {
      const { results } = await kvs.entity('Score').query()
        .filters({
          filters: () => [{ property: 'value', condition: 'NOT_EQUAL_TO', values: [50] }],
          operator: () => 'and',
        })
        .getMany();
      expect(results).toHaveLength(9);
    });
  });

  // ── Transaction Builder ────────────────────────────────────────────

  describe('Transaction Builder', () => {
    it('batched set and delete', async () => {
      await kvs.set('a', 1);
      await kvs.set('b', 2);

      await kvs.transact()
        .set('a', 10)
        .set('c', 3)
        .delete('b')
        .execute();

      expect(await kvs.get('a')).toBe(10);
      expect(await kvs.get('b')).toBeUndefined();
      expect(await kvs.get('c')).toBe(3);
    });

    it('set entity within transaction', async () => {
      kvs.registerEntitySchema('Item', {
        attributes: { name: { type: 'string' } },
        indexes: [],
      });

      await kvs.transact()
        .set('i1', { name: 'Widget' }, { entityName: 'Item' })
        .set('i2', { name: 'Gadget' }, { entityName: 'Item' })
        .execute();

      expect(await kvs.entity('Item').get('i1')).toEqual({ name: 'Widget' });
      expect(await kvs.entity('Item').get('i2')).toEqual({ name: 'Gadget' });
    });

    it('delete entity within transaction', async () => {
      kvs.registerEntitySchema('Item', {
        attributes: { name: { type: 'string' } },
        indexes: [],
      });
      await kvs.entity('Item').set('i1', { name: 'Delete me' });

      await kvs.transact()
        .delete('i1', { entityName: 'Item' })
        .execute();

      expect(await kvs.entity('Item').get('i1')).toBeUndefined();
    });

    it('mixed KVS and entity operations', async () => {
      kvs.registerEntitySchema('Config', {
        attributes: { value: { type: 'string' } },
        indexes: [],
      });

      await kvs.set('plain-key', 'old');

      await kvs.transact()
        .set('plain-key', 'new')
        .set('cfg1', { value: 'dark-mode' }, { entityName: 'Config' })
        .execute();

      expect(await kvs.get('plain-key')).toBe('new');
      expect(await kvs.entity('Config').get('cfg1')).toEqual({ value: 'dark-mode' });
    });

    it('empty transaction executes without error', async () => {
      await kvs.transact().execute(); // should not throw
    });
  });

  // ── handleRequest: Plain KVS ───────────────────────────────────────

  describe('handleRequest: Plain KVS', () => {
    it('set and get via HTTP', async () => {
      await kvs.handleRequest('/api/v1/set', {
        body: JSON.stringify({ key: 'http-key', value: { data: 'hello' } }),
      });
      const resp = await kvs.handleRequest('/api/v1/get', {
        body: JSON.stringify({ key: 'http-key' }),
      });
      expect(resp.ok).toBe(true);
      const data = await resp.json();
      expect(data.value).toEqual({ data: 'hello' });
      expect(data.createdAt).toBeDefined();
      expect(data.updatedAt).toBeDefined();
    });

    it('get missing key returns 404', async () => {
      const resp = await kvs.handleRequest('/api/v1/get', {
        body: JSON.stringify({ key: 'nope' }),
      });
      expect(resp.status).toBe(404);
    });

    it('delete via HTTP', async () => {
      await kvs.handleRequest('/api/v1/set', {
        body: JSON.stringify({ key: 'del', value: 1 }),
      });
      const resp = await kvs.handleRequest('/api/v1/delete', {
        body: JSON.stringify({ key: 'del' }),
      });
      expect(resp.ok).toBe(true);

      const getResp = await kvs.handleRequest('/api/v1/get', {
        body: JSON.stringify({ key: 'del' }),
      });
      expect(getResp.status).toBe(404);
    });

    it('delete missing key returns 404', async () => {
      const resp = await kvs.handleRequest('/api/v1/delete', {
        body: JSON.stringify({ key: 'missing' }),
      });
      expect(resp.status).toBe(404);
    });

    it('keyPolicy FAIL_IF_EXISTS returns 409', async () => {
      await kvs.handleRequest('/api/v1/set', {
        body: JSON.stringify({ key: 'exists', value: 1 }),
      });
      const resp = await kvs.handleRequest('/api/v1/set', {
        body: JSON.stringify({ key: 'exists', value: 2, options: { keyPolicy: 'FAIL_IF_EXISTS' } }),
      });
      expect(resp.status).toBe(409);
    });

    it('returnValue PREVIOUS returns old value', async () => {
      await kvs.handleRequest('/api/v1/set', {
        body: JSON.stringify({ key: 'rv', value: 'old' }),
      });
      const resp = await kvs.handleRequest('/api/v1/set', {
        body: JSON.stringify({ key: 'rv', value: 'new', options: { returnValue: 'PREVIOUS' } }),
      });
      const data = await resp.json();
      expect(data.value).toBe('old');
    });

    it('returnValue LATEST returns new value', async () => {
      const resp = await kvs.handleRequest('/api/v1/set', {
        body: JSON.stringify({ key: 'rv', value: 'fresh', options: { returnValue: 'LATEST' } }),
      });
      const data = await resp.json();
      expect(data.value).toBe('fresh');
    });

    it('TTL sets expireTime', async () => {
      await kvs.handleRequest('/api/v1/set', {
        body: JSON.stringify({ key: 'ttl', value: 'temp', options: { ttl: { value: 1, unit: 'HOURS' } } }),
      });
      const resp = await kvs.handleRequest('/api/v1/get', {
        body: JSON.stringify({ key: 'ttl' }),
      });
      const data = await resp.json();
      expect(data.expireTime).toBeDefined();
      expect(new Date(data.expireTime).getTime()).toBeGreaterThan(Date.now());
    });

    it('query with beginsWith via HTTP', async () => {
      await kvs.set('prefix:a', 1);
      await kvs.set('prefix:b', 2);
      await kvs.set('other:c', 3);

      const resp = await kvs.handleRequest('/api/v1/query', {
        body: JSON.stringify({ where: [WhereConditions.beginsWith('prefix:')] }),
      });
      const data = await resp.json();
      expect(data.data).toHaveLength(2);
    });

    it('query pagination via HTTP', async () => {
      for (let i = 0; i < 5; i++) await kvs.set(`p:${i}`, i);

      const resp = await kvs.handleRequest('/api/v1/query', {
        body: JSON.stringify({ where: [WhereConditions.beginsWith('p:')], limit: 2 }),
      });
      const data = await resp.json();
      expect(data.data).toHaveLength(2);
      expect(data.cursor).toBeDefined();
    });

    it('missing body returns 400', async () => {
      const resp = await kvs.handleRequest('/api/v1/get', {});
      expect(resp.status).toBe(400);
    });

    it('invalid JSON returns 400', async () => {
      const resp = await kvs.handleRequest('/api/v1/get', { body: 'not json{' });
      expect(resp.status).toBe(400);
    });

    it('unknown endpoint returns 404', async () => {
      const resp = await kvs.handleRequest('/api/v1/unknown', {
        body: JSON.stringify({}),
      });
      expect(resp.status).toBe(404);
    });
  });

  // ── handleRequest: Secrets ─────────────────────────────────────────

  describe('handleRequest: Secrets', () => {
    it('set and get secret via HTTP', async () => {
      await kvs.handleRequest('/api/v1/secret/set', {
        body: JSON.stringify({ key: 'api-key', value: 'secret123' }),
      });
      const resp = await kvs.handleRequest('/api/v1/secret/get', {
        body: JSON.stringify({ key: 'api-key' }),
      });
      const data = await resp.json();
      expect(data.value).toBe('secret123');
    });

    it('delete secret via HTTP', async () => {
      await kvs.handleRequest('/api/v1/secret/set', {
        body: JSON.stringify({ key: 'token', value: 'abc' }),
      });
      await kvs.handleRequest('/api/v1/secret/delete', {
        body: JSON.stringify({ key: 'token' }),
      });
      const resp = await kvs.handleRequest('/api/v1/secret/get', {
        body: JSON.stringify({ key: 'token' }),
      });
      expect(resp.status).toBe(404);
    });
  });

  // ── handleRequest: Entities ────────────────────────────────────────

  describe('handleRequest: Entities', () => {
    beforeEach(() => {
      kvs.registerEntitySchema('Project', {
        attributes: {
          name: { type: 'string' },
          stars: { type: 'integer' },
        },
        indexes: [],
      });
    });

    it('entity set validates schema via HTTP', async () => {
      const resp = await kvs.handleRequest('/api/v1/entity/set', {
        body: JSON.stringify({ entityName: 'Project', key: 'p1', value: { name: 'Good', badField: true } }),
      });
      expect(resp.status).toBe(400);
      const data = await resp.json();
      expect(data.message).toContain('Unknown attribute');
    });

    it('entity CRUD via HTTP', async () => {
      // Set
      await kvs.handleRequest('/api/v1/entity/set', {
        body: JSON.stringify({ entityName: 'Project', key: 'p1', value: { name: 'forge-sim', stars: 42 } }),
      });

      // Get
      const getResp = await kvs.handleRequest('/api/v1/entity/get', {
        body: JSON.stringify({ entityName: 'Project', key: 'p1' }),
      });
      expect((await getResp.json()).value).toEqual({ name: 'forge-sim', stars: 42 });

      // Delete
      await kvs.handleRequest('/api/v1/entity/delete', {
        body: JSON.stringify({ entityName: 'Project', key: 'p1' }),
      });

      const getAfter = await kvs.handleRequest('/api/v1/entity/get', {
        body: JSON.stringify({ entityName: 'Project', key: 'p1' }),
      });
      expect(getAfter.status).toBe(404);
    });
  });

  // ── handleRequest: Batch ───────────────────────────────────────────

  describe('handleRequest: Batch', () => {
    it('batch set writes multiple entries', async () => {
      const resp = await kvs.handleRequest('/api/v1/batch/set', {
        body: JSON.stringify([
          { key: 'b1', value: 'one' },
          { key: 'b2', value: 'two' },
        ]),
      });
      expect(resp.ok).toBe(true);
      const data = await resp.json();
      expect(data.successfulKeys).toHaveLength(2);
      expect(await kvs.get('b1')).toBe('one');
      expect(await kvs.get('b2')).toBe('two');
    });

    it('batch set supports entities', async () => {
      const resp = await kvs.handleRequest('/api/v1/batch/set', {
        body: JSON.stringify([
          { key: 'e1', value: { data: 1 }, entityName: 'Thing' },
          { key: 'e2', value: { data: 2 }, entityName: 'Thing' },
        ]),
      });
      expect(resp.ok).toBe(true);
      expect(await kvs.entity('Thing').get('e1')).toEqual({ data: 1 });
    });
  });

  // ── handleRequest: Transaction ─────────────────────────────────────

  describe('handleRequest: Transaction', () => {
    it('new-style transaction (set/delete arrays)', async () => {
      await kvs.set('keep', 'yes');

      const resp = await kvs.handleRequest('/api/v1/transaction', {
        body: JSON.stringify({
          set: [
            { key: 'new-key', value: 'created' },
          ],
          delete: [
            { key: 'keep' },
          ],
        }),
      });
      expect(resp.ok).toBe(true);
      expect(await kvs.get('new-key')).toBe('created');
      expect(await kvs.get('keep')).toBeUndefined();
    });

    it('old-style transaction (actions array)', async () => {
      const resp = await kvs.handleRequest('/api/v1/transaction', {
        body: JSON.stringify({
          actions: [
            { type: 'set', key: 'legacy', value: 'works' },
          ],
        }),
      });
      expect(resp.ok).toBe(true);
      expect(await kvs.get('legacy')).toBe('works');
    });
  });

  // ── Cross-Store Visibility ─────────────────────────────────────────

  describe('Cross-Store Visibility', () => {
    it('data written via handleRequest is visible via direct API', async () => {
      await kvs.handleRequest('/api/v1/set', {
        body: JSON.stringify({ key: 'http-written', value: 'visible' }),
      });
      expect(await kvs.get('http-written')).toBe('visible');
    });

    it('data written via direct API is visible via handleRequest', async () => {
      await kvs.set('direct-written', 'also visible');
      const resp = await kvs.handleRequest('/api/v1/get', {
        body: JSON.stringify({ key: 'direct-written' }),
      });
      expect((await resp.json()).value).toBe('also visible');
    });

    it('entity data consistent across both paths', async () => {
      await kvs.handleRequest('/api/v1/entity/set', {
        body: JSON.stringify({ entityName: 'Foo', key: 'f1', value: { x: 1 } }),
      });
      expect(await kvs.entity('Foo').get('f1')).toEqual({ x: 1 });

      await kvs.entity('Foo').set('f2', { x: 2 });
      const resp = await kvs.handleRequest('/api/v1/entity/get', {
        body: JSON.stringify({ entityName: 'Foo', key: 'f2' }),
      });
      expect((await resp.json()).value).toEqual({ x: 2 });
    });
  });

  // ── Persistence ────────────────────────────────────────────────────

  describe('Persistence', () => {
    it('dump returns plain KVS values', async () => {
      await kvs.set('a', 1);
      await kvs.set('b', 'two');
      const d = kvs.dump();
      expect(d).toEqual({ a: 1, b: 'two' });
    });

    it('restore loads plain KVS values', async () => {
      kvs.restore({ x: 10, y: 20 });
      expect(await kvs.get('x')).toBe(10);
      expect(await kvs.get('y')).toBe(20);
    });

    it('dumpAll includes all three stores', async () => {
      await kvs.set('plain', 'val');
      await kvs.setSecret('sec', 'hidden');
      await kvs.entity('E').set('e1', { x: 1 });

      const dump = kvs.dumpAll();
      expect(dump.kvs).toHaveLength(1);
      expect(dump.secrets).toHaveLength(1);
      expect(dump.entities).toHaveLength(1);
    });

    it('restoreAll round-trips all data', async () => {
      await kvs.set('p', 'plain');
      await kvs.setSecret('s', 'secret');
      await kvs.entity('X').set('x1', { v: 1 });

      const dump = kvs.dumpAll();

      const kvs2 = new UnifiedKVS();
      kvs2.restoreAll(dump);

      expect(await kvs2.get('p')).toBe('plain');
      expect(await kvs2.getSecret('s')).toBe('secret');
      expect(await kvs2.entity('X').get('x1')).toEqual({ v: 1 });
    });

    it('dumpEntities groups by entity name', async () => {
      await kvs.entity('A').set('a1', { n: 1 });
      await kvs.entity('A').set('a2', { n: 2 });
      await kvs.entity('B').set('b1', { n: 3 });

      const d = kvs.dumpEntities();
      expect(d.A).toHaveLength(2);
      expect(d.B).toHaveLength(1);
    });

    it('clear removes runtime data but preserves schemas', async () => {
      kvs.registerEntitySchema('S', { attributes: { x: { type: 'string' } }, indexes: [] });
      await kvs.set('k', 1);
      await kvs.entity('S').set('s1', { x: 'hello' });
      await kvs.setSecret('sec', 'val');

      kvs.clear();

      expect(kvs.size).toBe(0);
      expect(kvs.entitySize).toBe(0);
      expect(kvs.secretSize).toBe(0);
      // Schema preserved — should still validate
      await expect(kvs.entity('S').set('s2', { bad: true } as any)).rejects.toThrow();
    });

    it('clearAll removes schemas too', async () => {
      kvs.registerEntitySchema('S', { attributes: { x: { type: 'string' } }, indexes: [] });
      kvs.clearAll();
      // Schema gone — anything goes
      await kvs.entity('S').set('s1', { anything: 'works' });
      expect(await kvs.entity('S').get('s1')).toEqual({ anything: 'works' });
    });
  });

  // ── Latency Simulation ────────────────────────────────────────────

  describe('Latency Simulation', () => {
    it('operations work with latency enabled', async () => {
      kvs.setLatency(true);
      await kvs.set('fast', 'enough');
      expect(await kvs.get('fast')).toBe('enough');
    });

    it('operations work with ms latency', async () => {
      kvs.setLatency(5);
      await kvs.set('slow', 'but sure');
      expect(await kvs.get('slow')).toBe('but sure');
    });
  });
});
