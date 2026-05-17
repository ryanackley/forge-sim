/**
 * WhereConditions / FilterConditions parity with real @forge/kvs.
 *
 * Skill run #11 caught the original shim shipping with two broken helper
 * objects: WhereConditions exported only `beginsWith` + a misnamed
 * `equalsTo`, and FilterConditions returned a non-canonical
 * `{ condition: 'camelCase', value: ... }` shape with `value` (singular)
 * instead of `values: [...]`. Real app code that worked under Forge cloud
 * blew up here with "WhereConditions.equalTo is not a function" or
 * silently returned wrong results.
 *
 * This file pins:
 *   1. Every helper returns the canonical clause shape that real Forge
 *      ships in `node_modules/@forge/kvs/out/interfaces/types.d.ts`:
 *        { condition: 'SCREAMING_SNAKE', values: [...] }
 *   2. The simple KVS query rejects non-BEGINS_WITH clauses at runtime —
 *      real Forge's type system blocks them at compile time, so we
 *      runtime-validate to match.
 *   3. Entity-store range and filter queries work end-to-end via the
 *      helpers (the agent's actual use case from skill run #11).
 *   4. MetadataField matches the real Forge enum values.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { UnifiedKVS, WhereConditions } from '../kvs.js';
import {
  WhereConditions as ShimWhereConditions,
  FilterConditions as ShimFilterConditions,
  MetadataField as ShimMetadataField,
} from '../shims/forge-kvs.js';

describe('WhereConditions — canonical clause shape', () => {
  it('beginsWith returns { condition: BEGINS_WITH, values: [value] }', () => {
    expect(ShimWhereConditions.beginsWith('foo')).toEqual({
      condition: 'BEGINS_WITH',
      values: ['foo'],
    });
  });

  it('between returns { condition: BETWEEN, values: [first, second] }', () => {
    expect(ShimWhereConditions.between(1, 10)).toEqual({
      condition: 'BETWEEN',
      values: [1, 10],
    });
  });

  it('equalTo returns { condition: EQUAL_TO, values: [value] }', () => {
    expect(ShimWhereConditions.equalTo('alice')).toEqual({
      condition: 'EQUAL_TO',
      values: ['alice'],
    });
  });

  it('greaterThan returns { condition: GREATER_THAN, values: [value] }', () => {
    expect(ShimWhereConditions.greaterThan(5)).toEqual({
      condition: 'GREATER_THAN',
      values: [5],
    });
  });

  it('greaterThanEqualTo returns { condition: GREATER_THAN_EQUAL_TO, values: [value] }', () => {
    expect(ShimWhereConditions.greaterThanEqualTo(5)).toEqual({
      condition: 'GREATER_THAN_EQUAL_TO',
      values: [5],
    });
  });

  it('lessThan returns { condition: LESS_THAN, values: [value] }', () => {
    expect(ShimWhereConditions.lessThan(100)).toEqual({
      condition: 'LESS_THAN',
      values: [100],
    });
  });

  it('lessThanEqualTo returns { condition: LESS_THAN_EQUAL_TO, values: [value] }', () => {
    expect(ShimWhereConditions.lessThanEqualTo(100)).toEqual({
      condition: 'LESS_THAN_EQUAL_TO',
      values: [100],
    });
  });

  it('exposes exactly 7 helpers — matches real @forge/kvs', () => {
    expect(Object.keys(ShimWhereConditions).sort()).toEqual([
      'beginsWith',
      'between',
      'equalTo',
      'greaterThan',
      'greaterThanEqualTo',
      'lessThan',
      'lessThanEqualTo',
    ]);
  });

  it('internal kvs.ts WhereConditions matches the shim export (single source of truth)', () => {
    // Internal callers (tests, dev tools) shouldn't get a different shape
    // than user code going through the shim.
    expect(WhereConditions.beginsWith('foo')).toEqual(ShimWhereConditions.beginsWith('foo'));
    expect(WhereConditions.equalTo(42)).toEqual(ShimWhereConditions.equalTo(42));
    expect(WhereConditions.between(1, 10)).toEqual(ShimWhereConditions.between(1, 10));
  });
});

describe('FilterConditions — canonical clause shape', () => {
  it('beginsWith returns canonical shape', () => {
    expect(ShimFilterConditions.beginsWith('foo')).toEqual({
      condition: 'BEGINS_WITH',
      values: ['foo'],
    });
  });

  it('equalTo returns canonical shape (was named "equal" pre-fix)', () => {
    expect(ShimFilterConditions.equalTo('open')).toEqual({
      condition: 'EQUAL_TO',
      values: ['open'],
    });
  });

  it('notEqualTo returns canonical shape', () => {
    expect(ShimFilterConditions.notEqualTo('closed')).toEqual({
      condition: 'NOT_EQUAL_TO',
      values: ['closed'],
    });
  });

  it('contains returns canonical shape', () => {
    expect(ShimFilterConditions.contains('urgent')).toEqual({
      condition: 'CONTAINS',
      values: ['urgent'],
    });
  });

  it('notContains returns canonical shape', () => {
    expect(ShimFilterConditions.notContains('archived')).toEqual({
      condition: 'NOT_CONTAINS',
      values: ['archived'],
    });
  });

  it('exists returns canonical shape with sentinel [true] payload', () => {
    expect(ShimFilterConditions.exists()).toEqual({
      condition: 'EXISTS',
      values: [true],
    });
  });

  it('notExists returns canonical shape with sentinel [true] payload', () => {
    expect(ShimFilterConditions.notExists()).toEqual({
      condition: 'NOT_EXISTS',
      values: [true],
    });
  });

  it('between returns canonical shape with [first, second]', () => {
    expect(ShimFilterConditions.between(1, 10)).toEqual({
      condition: 'BETWEEN',
      values: [1, 10],
    });
  });

  it('exposes exactly 12 helpers — matches real @forge/kvs', () => {
    expect(Object.keys(ShimFilterConditions).sort()).toEqual([
      'beginsWith',
      'between',
      'contains',
      'equalTo',
      'exists',
      'greaterThan',
      'greaterThanEqualTo',
      'lessThan',
      'lessThanEqualTo',
      'notContains',
      'notEqualTo',
      'notExists',
    ]);
  });
});

describe('MetadataField — matches real @forge/kvs enum', () => {
  it('has exactly the three real values (CREATED_AT / UPDATED_AT / EXPIRE_TIME)', () => {
    expect(Object.keys(ShimMetadataField).sort()).toEqual([
      'CREATED_AT',
      'EXPIRE_TIME',
      'UPDATED_AT',
    ]);
  });

  it('values are SCREAMING_SNAKE strings (not lowercase)', () => {
    expect(ShimMetadataField.CREATED_AT).toBe('CREATED_AT');
    expect(ShimMetadataField.UPDATED_AT).toBe('UPDATED_AT');
    expect(ShimMetadataField.EXPIRE_TIME).toBe('EXPIRE_TIME');
  });
});

describe('Simple KVS query — runtime contract matches @forge/kvs types', () => {
  let kvs: UnifiedKVS;

  beforeEach(async () => {
    kvs = new UnifiedKVS();
    await kvs.set('task:1', { title: 'A' });
    await kvs.set('task:2', { title: 'B' });
    await kvs.set('user:1', { name: 'Alice' });
  });

  it('beginsWith works via the WhereConditions helper', async () => {
    const { results } = await kvs.query()
      .where('key', ShimWhereConditions.beginsWith('task:'))
      .getMany();
    expect(results).toHaveLength(2);
    expect(results.every(r => r.key.startsWith('task:'))).toBe(true);
  });

  it('throws on equalTo (real Forge limits simple KVS to BEGINS_WITH only)', () => {
    expect(() =>
      kvs.query().where('key', ShimWhereConditions.equalTo('user:1') as any)
    ).toThrow(/only supports WhereConditions\.beginsWith/);
  });

  it('throws on between, greaterThan, lessThan, etc.', () => {
    const others = [
      ShimWhereConditions.between('a', 'z'),
      ShimWhereConditions.greaterThan('foo'),
      ShimWhereConditions.greaterThanEqualTo('foo'),
      ShimWhereConditions.lessThan('zzz'),
      ShimWhereConditions.lessThanEqualTo('zzz'),
    ];
    for (const clause of others) {
      expect(() =>
        kvs.query().where('key', clause as any)
      ).toThrow(/only supports WhereConditions\.beginsWith/);
    }
  });

  it('throws clear error when given a non-clause object', () => {
    expect(() =>
      kvs.query().where('key', { prefix: 'task:' } as any)
    ).toThrow(/requires a clause from WhereConditions/);
  });

  it('the error message points users at kvs.entity() for other comparisons', () => {
    expect(() =>
      kvs.query().where('key', ShimWhereConditions.equalTo('x') as any)
    ).toThrow(/kvs\.entity\(['"]Name['"]\)\.query\(\)/);
  });
});

describe('Entity-store query — all 7 WhereConditions work as range clauses', () => {
  let kvs: UnifiedKVS;

  beforeEach(async () => {
    kvs = new UnifiedKVS();
    kvs.registerEntitySchema('Task', {
      attributes: {
        status: { type: 'string' },
        priority: { type: 'integer' },
      },
      indexes: [
        { name: 'by-status', partition: ['status'], range: 'priority' },
      ],
    });
    // 5 open tasks with priorities 1..5
    for (let p = 1; p <= 5; p++) {
      await kvs.entity('Task').set(`task-${p}`, { status: 'open', priority: p });
    }
  });

  it('equalTo (the run-#11 demo case) finds exact priority', async () => {
    const { results } = await kvs.entity('Task').query()
      .index('by-status', { partition: ['open'] })
      .where(ShimWhereConditions.equalTo(3))
      .getMany();
    expect(results).toHaveLength(1);
    expect(results[0].value.priority).toBe(3);
  });

  it('greaterThan filters strictly above', async () => {
    const { results } = await kvs.entity('Task').query()
      .index('by-status', { partition: ['open'] })
      .where(ShimWhereConditions.greaterThan(3))
      .getMany();
    expect(results).toHaveLength(2);
    expect(results.every(r => r.value.priority > 3)).toBe(true);
  });

  it('greaterThanEqualTo includes the boundary', async () => {
    const { results } = await kvs.entity('Task').query()
      .index('by-status', { partition: ['open'] })
      .where(ShimWhereConditions.greaterThanEqualTo(3))
      .getMany();
    expect(results).toHaveLength(3);
    expect(results.every(r => r.value.priority >= 3)).toBe(true);
  });

  it('lessThan filters strictly below', async () => {
    const { results } = await kvs.entity('Task').query()
      .index('by-status', { partition: ['open'] })
      .where(ShimWhereConditions.lessThan(3))
      .getMany();
    expect(results).toHaveLength(2);
    expect(results.every(r => r.value.priority < 3)).toBe(true);
  });

  it('lessThanEqualTo includes the boundary', async () => {
    const { results } = await kvs.entity('Task').query()
      .index('by-status', { partition: ['open'] })
      .where(ShimWhereConditions.lessThanEqualTo(3))
      .getMany();
    expect(results).toHaveLength(3);
    expect(results.every(r => r.value.priority <= 3)).toBe(true);
  });

  it('between is inclusive on both ends', async () => {
    const { results } = await kvs.entity('Task').query()
      .index('by-status', { partition: ['open'] })
      .where(ShimWhereConditions.between(2, 4))
      .getMany();
    expect(results).toHaveLength(3);
    expect(results.every(r => r.value.priority >= 2 && r.value.priority <= 4)).toBe(true);
  });

  it('beginsWith works on string range keys', async () => {
    kvs.registerEntitySchema('Term', {
      attributes: {
        status: { type: 'string' },
        acronym: { type: 'string' },
      },
      indexes: [
        { name: 'by-status', partition: ['status'], range: 'acronym' },
      ],
    });
    await kvs.entity('Term').set('1', { status: 'published', acronym: 'API' });
    await kvs.entity('Term').set('2', { status: 'published', acronym: 'APM' });
    await kvs.entity('Term').set('3', { status: 'published', acronym: 'SLO' });

    const { results } = await kvs.entity('Term').query()
      .index('by-status', { partition: ['published'] })
      .where(ShimWhereConditions.beginsWith('AP'))
      .getMany();
    expect(results).toHaveLength(2);
    expect(results.every(r => r.value.acronym.startsWith('AP'))).toBe(true);
  });
});
