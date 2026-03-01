import { describe, it, expect, beforeEach } from 'vitest';
import { SimulatedKVS, WhereConditions } from '../storage.js';

describe('SimulatedKVS', () => {
  let kvs: SimulatedKVS;

  beforeEach(() => {
    kvs = new SimulatedKVS();
  });

  describe('basic operations', () => {
    it('get/set/delete', async () => {
      await kvs.set('key1', 'value1');
      expect(await kvs.get('key1')).toBe('value1');

      await kvs.delete('key1');
      expect(await kvs.get('key1')).toBeUndefined();
    });

    it('stores objects via JSON serialization', async () => {
      const obj = { name: 'test', count: 42, nested: { a: 1 } };
      await kvs.set('obj', obj);
      expect(await kvs.get('obj')).toEqual(obj);
    });

    it('strips functions and undefined from objects', async () => {
      const obj = { name: 'test', fn: () => {}, undef: undefined };
      await kvs.set('obj', obj);
      expect(await kvs.get('obj')).toEqual({ name: 'test' });
    });

    it('rejects null values', async () => {
      await expect(kvs.set('key', null)).rejects.toThrow();
    });
  });

  describe('secrets', () => {
    it('get/set/delete secrets', async () => {
      await kvs.setSecret('token', 'secret123');
      expect(await kvs.getSecret('token')).toBe('secret123');

      await kvs.deleteSecret('token');
      expect(await kvs.getSecret('token')).toBeUndefined();
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      await kvs.set('user:1', { name: 'Alice' });
      await kvs.set('user:2', { name: 'Bob' });
      await kvs.set('user:3', { name: 'Charlie' });
      await kvs.set('config:theme', 'dark');
    });

    it('query with beginsWith', async () => {
      const result = await kvs
        .query()
        .where('key', WhereConditions.beginsWith('user:'))
        .getMany();

      expect(result.results).toHaveLength(3);
      expect(result.results.map((r) => r.key)).toEqual([
        'user:1',
        'user:2',
        'user:3',
      ]);
    });

    it('query with limit and pagination', async () => {
      const page1 = await kvs
        .query()
        .where('key', WhereConditions.beginsWith('user:'))
        .limit(2)
        .getMany();

      expect(page1.results).toHaveLength(2);
      expect(page1.nextCursor).toBeDefined();

      const page2 = await kvs
        .query()
        .where('key', WhereConditions.beginsWith('user:'))
        .limit(2)
        .cursor(page1.nextCursor!)
        .getMany();

      expect(page2.results).toHaveLength(1);
      expect(page2.nextCursor).toBeUndefined();
    });

    it('query with DESC sort', async () => {
      const result = await kvs
        .query()
        .where('key', WhereConditions.beginsWith('user:'))
        .sort('DESC')
        .getMany();

      expect(result.results.map((r) => r.key)).toEqual([
        'user:3',
        'user:2',
        'user:1',
      ]);
    });

    it('getOne returns first match', async () => {
      const result = await kvs
        .query()
        .where('key', WhereConditions.beginsWith('config:'))
        .getOne();

      expect(result?.key).toBe('config:theme');
      expect(result?.value).toBe('dark');
    });
  });

  describe('batch operations', () => {
    it('getMany/setMany/deleteMany', async () => {
      await kvs.setMany([
        { key: 'a', value: 1 },
        { key: 'b', value: 2 },
        { key: 'c', value: 3 },
      ]);

      const result = await kvs.getMany(['a', 'b', 'c', 'd']);
      expect(result.size).toBe(3);
      expect(result.get('a')).toBe(1);

      await kvs.deleteMany(['a', 'c']);
      expect(await kvs.get('a')).toBeUndefined();
      expect(await kvs.get('b')).toBe(2);
    });
  });

  describe('transactions', () => {
    it('transact updates atomically', async () => {
      await kvs.set('counter', 0);
      const result = await kvs.transact('counter', (current) => current + 1);
      expect(result).toBe(1);
      expect(await kvs.get('counter')).toBe(1);
    });
  });
});
