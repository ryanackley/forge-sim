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
  getMany(keys: string[]) {
    return getSimulator().kvs.getMany(keys);
  },
  setMany(entries: Array<{ key: string; value: any }>) {
    return getSimulator().kvs.setMany(entries);
  },
  deleteMany(keys: string[]) {
    return getSimulator().kvs.deleteMany(keys);
  },
  transact(key: string, updater: (current: any) => any) {
    return getSimulator().kvs.transact(key, updater);
  },
};

// ── Condition helpers matching @forge/kvs exports ──────────────────────

const WhereConditions = {
  beginsWith: (prefix: string) => ({ beginsWith: prefix }),
  equalsTo: (value: string) => ({ equalsTo: value }),
};

const FilterConditions = {
  // Forge KVS FilterConditions for entity properties — stub for now
  equal: (value: any) => ({ condition: 'equal', value }),
  greaterThan: (value: any) => ({ condition: 'greaterThan', value }),
  greaterThanEqualTo: (value: any) => ({ condition: 'greaterThanEqualTo', value }),
  lessThan: (value: any) => ({ condition: 'lessThan', value }),
  lessThanEqualTo: (value: any) => ({ condition: 'lessThanEqualTo', value }),
  beginsWith: (value: string) => ({ condition: 'beginsWith', value }),
  exists: () => ({ condition: 'exists' }),
};

const Filter = FilterConditions;

// Metadata fields for entity storage
const MetadataField = {
  KEY: 'key' as const,
  CREATED_AT: 'createdAt' as const,
  UPDATED_AT: 'updatedAt' as const,
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
