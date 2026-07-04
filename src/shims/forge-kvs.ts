/**
 * Shim for @forge/kvs
 * 
 * Provides the kvs singleton and query helpers that Forge apps use:
 *   import { kvs } from '@forge/kvs';
 *   await kvs.get('key');
 *   await kvs.set('key', value);
 *   const results = await kvs.query().where('key', WhereConditions.beginsWith('prefix')).getMany();
 */

import { getSimulator } from './globals.js';

/** Lazy proxy — delegates to simulator's KVS at call time */
const kvs = {
  get(key: string) {
    return getSimulator().kvs.get(key);
  },
  set(key: string, value: any) {
    return getSimulator().kvs.set(key, value);
  },
  delete(key: string) {
    return getSimulator().kvs.delete(key);
  },
  getSecret(key: string) {
    return getSimulator().kvs.getSecret(key);
  },
  setSecret(key: string, value: any) {
    return getSimulator().kvs.setSecret(key, value);
  },
  deleteSecret(key: string) {
    return getSimulator().kvs.deleteSecret(key);
  },
  query() {
    return getSimulator().kvs.query();
  },
  entity(entityName: string) {
    return getSimulator().kvs.entity(entityName);
  },
  transact() {
    return getSimulator().kvs.transact();
  },
  // ── Batch ops — real @forge/kvs shapes ──────────────────────────────
  // batchGet(BatchGetItem[]) / batchSet(BatchSetItem[]) /
  // batchDelete(BatchDeleteItem[]), each returning
  // { successfulKeys, failedKeys }. Matches @forge/kvs kvs-api.d.ts.
  //
  // NOTE: real @forge/kvs has NO getMany/setMany/deleteMany on `kvs` —
  // those were removed from this shim for parity (an app using them
  // would work in the sim but crash in Forge). They remain available on
  // the direct sim API (sim.kvs.getMany etc.) for test convenience.
  batchGet(items: Array<{ key: string; entityName?: string; options?: { metadataFields?: string[] } }>) {
    return getSimulator().kvs.batchGet(items);
  },
  batchSet(items: Array<{ key: string; value: any; entityName?: string; options?: any }>) {
    return getSimulator().kvs.batchSet(items);
  },
  batchDelete(items: Array<{ key: string; entityName?: string }>) {
    return getSimulator().kvs.batchDelete(items);
  },
};

// ── Condition helpers matching @forge/kvs exports ──────────────────────
//
// Every helper returns the canonical clause shape that real @forge/kvs ships:
//   { condition: 'SCREAMING_SNAKE_NAME', values: [...] }
//
// This shape matches `node_modules/@forge/kvs/out/interfaces/types.d.ts`
// (BetweenClause, BeginsWithClause, etc.) byte-for-byte, so app code that
// works under real Forge works under forge-sim.
//
// The two helpers objects are intentionally separate surfaces:
//
//   WhereConditions   — valid as the partition/range clause on simple KVS
//                       `.query().where('key', ...)` and on entity-store
//                       index range queries. Real Forge's type system limits
//                       simple KVS to BEGINS_WITH only; we runtime-validate
//                       to match.
//
//   FilterConditions  — valid as the post-query filter clause on entity-store
//                       `.filter(b => b.and(field, ...))` queries. Adds the
//                       five conditions only meaningful on attribute filters:
//                       contains, notContains, exists, notExists, notEqualTo.

const WhereConditions = {
  beginsWith: (value: string | number) => ({ condition: 'BEGINS_WITH', values: [value] }),
  between: <T extends string | number>(first: T, second: T) => ({ condition: 'BETWEEN', values: [first, second] }),
  equalTo: (value: string | number | boolean) => ({ condition: 'EQUAL_TO', values: [value] }),
  greaterThan: (value: string | number) => ({ condition: 'GREATER_THAN', values: [value] }),
  greaterThanEqualTo: (value: string | number) => ({ condition: 'GREATER_THAN_EQUAL_TO', values: [value] }),
  lessThan: (value: string | number) => ({ condition: 'LESS_THAN', values: [value] }),
  lessThanEqualTo: (value: string | number) => ({ condition: 'LESS_THAN_EQUAL_TO', values: [value] }),
};

const FilterConditions = {
  beginsWith: (value: string | number) => ({ condition: 'BEGINS_WITH', values: [value] }),
  between: <T extends string | number>(first: T, second: T) => ({ condition: 'BETWEEN', values: [first, second] }),
  contains: (value: string) => ({ condition: 'CONTAINS', values: [value] }),
  notContains: (value: string) => ({ condition: 'NOT_CONTAINS', values: [value] }),
  equalTo: (value: string | number | boolean) => ({ condition: 'EQUAL_TO', values: [value] }),
  notEqualTo: (value: string | number | boolean) => ({ condition: 'NOT_EQUAL_TO', values: [value] }),
  exists: () => ({ condition: 'EXISTS', values: [true] }),
  notExists: () => ({ condition: 'NOT_EXISTS', values: [true] }),
  greaterThan: (value: string | number) => ({ condition: 'GREATER_THAN', values: [value] }),
  greaterThanEqualTo: (value: string | number) => ({ condition: 'GREATER_THAN_EQUAL_TO', values: [value] }),
  lessThan: (value: string | number) => ({ condition: 'LESS_THAN', values: [value] }),
  lessThanEqualTo: (value: string | number) => ({ condition: 'LESS_THAN_EQUAL_TO', values: [value] }),
};

const Filter = FilterConditions;

// Metadata fields for entity storage — matches real @forge/kvs enum
// (no KEY field; values are the SCREAMING_SNAKE form).
const MetadataField = {
  CREATED_AT: 'CREATED_AT' as const,
  UPDATED_AT: 'UPDATED_AT' as const,
  EXPIRE_TIME: 'EXPIRE_TIME' as const,
};

const Sort = {
  ASC: 'ASC' as const,
  DESC: 'DESC' as const,
};

class ForgeKvsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForgeKvsError';
  }
}

class ForgeKvsAPIError extends ForgeKvsError {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'ForgeKvsAPIError';
  }
}

function isOverrideAndReturnOptions(options: any): boolean {
  return options && typeof options === 'object' && 'ifRevisionIs' in options;
}

export {
  kvs,
  WhereConditions,
  FilterConditions,
  Filter,
  MetadataField,
  Sort,
  ForgeKvsError,
  ForgeKvsAPIError,
  isOverrideAndReturnOptions,
};

export default kvs;
