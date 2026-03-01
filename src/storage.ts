/**
 * In-memory simulation of @forge/kvs (Key-Value Store).
 *
 * Supports: get, set, delete, query (with beginsWith), getSecret, setSecret, deleteSecret.
 * Also supports batch operations and basic transactions.
 */

import type { StorageEntry, StorageQueryResult } from './types.js';

export class SimulatedKVS {
  private store = new Map<string, any>();
  private secrets = new Map<string, any>();

  // ── Basic Operations ────────────────────────────────────────────────────

  async get(key: string): Promise<any> {
    return this.store.get(key) ?? undefined;
  }

  async set(key: string, value: any): Promise<void> {
    if (value === null || value === undefined) {
      throw new Error('Cannot store null or undefined values');
    }
    // Simulate JSON serialization (strips functions, undefined)
    this.store.set(key, JSON.parse(JSON.stringify(value)));
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  // ── Secret Operations ─────────────────────────────────────────────────

  async getSecret(key: string): Promise<any> {
    return this.secrets.get(key) ?? undefined;
  }

  async setSecret(key: string, value: any): Promise<void> {
    this.secrets.set(key, JSON.parse(JSON.stringify(value)));
  }

  async deleteSecret(key: string): Promise<void> {
    this.secrets.delete(key);
  }

  // ── Query ─────────────────────────────────────────────────────────────

  query(): KVSQueryBuilder {
    return new KVSQueryBuilder(this.store);
  }

  // ── Batch Operations ──────────────────────────────────────────────────

  async getMany(keys: string[]): Promise<Map<string, any>> {
    const result = new Map<string, any>();
    for (const key of keys) {
      const value = this.store.get(key);
      if (value !== undefined) {
        result.set(key, value);
      }
    }
    return result;
  }

  async setMany(entries: Array<{ key: string; value: any }>): Promise<void> {
    for (const { key, value } of entries) {
      await this.set(key, value);
    }
  }

  async deleteMany(keys: string[]): Promise<void> {
    for (const key of keys) {
      this.store.delete(key);
    }
  }

  // ── Transaction ───────────────────────────────────────────────────────

  async transact(key: string, updater: (current: any) => any): Promise<any> {
    const current = this.store.get(key);
    const newValue = updater(current);
    if (newValue === undefined) {
      this.store.delete(key);
    } else {
      await this.set(key, newValue);
    }
    return newValue;
  }

  // ── Inspection (for testing / debugging) ──────────────────────────────

  dump(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [k, v] of this.store) {
      result[k] = v;
    }
    return result;
  }

  clear(): void {
    this.store.clear();
    this.secrets.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

// ── Query Builder ─────────────────────────────────────────────────────────

export class KVSQueryBuilder {
  private conditions: Array<{
    field: string;
    condition: string;
    value: string;
  }> = [];
  private _limit = 20;
  private _cursor?: string;
  private _sortDirection: 'ASC' | 'DESC' = 'ASC';

  constructor(private store: Map<string, any>) {}

  where(
    field: 'key',
    condition: { beginsWith: string } | { equalsTo: string }
  ): this {
    if ('beginsWith' in condition) {
      this.conditions.push({
        field,
        condition: 'beginsWith',
        value: condition.beginsWith,
      });
    } else {
      this.conditions.push({
        field,
        condition: 'equalsTo',
        value: condition.equalsTo,
      });
    }
    return this;
  }

  limit(n: number): this {
    this._limit = n;
    return this;
  }

  cursor(c: string): this {
    this._cursor = c;
    return this;
  }

  sort(direction: 'ASC' | 'DESC'): this {
    this._sortDirection = direction;
    return this;
  }

  async getMany(): Promise<StorageQueryResult> {
    let keys = [...this.store.keys()];

    // Apply conditions
    for (const cond of this.conditions) {
      if (cond.condition === 'beginsWith') {
        keys = keys.filter((k) => k.startsWith(cond.value));
      } else if (cond.condition === 'equalsTo') {
        keys = keys.filter((k) => k === cond.value);
      }
    }

    // Sort
    keys.sort();
    if (this._sortDirection === 'DESC') {
      keys.reverse();
    }

    // Cursor (simple: cursor is the last key from previous page)
    if (this._cursor) {
      const idx = keys.indexOf(this._cursor);
      if (idx >= 0) {
        keys = keys.slice(idx + 1);
      }
    }

    // Limit
    const page = keys.slice(0, this._limit);
    const results: StorageEntry[] = page.map((key) => ({
      key,
      value: this.store.get(key),
    }));

    return {
      results,
      nextCursor: keys.length > this._limit ? page[page.length - 1] : undefined,
    };
  }

  async getOne(): Promise<StorageEntry | undefined> {
    this._limit = 1;
    const { results } = await this.getMany();
    return results[0];
  }
}

// ── WhereConditions helper (matches @forge/kvs API) ─────────────────────

export const WhereConditions = {
  beginsWith: (prefix: string) => ({ beginsWith: prefix }),
  equalsTo: (value: string) => ({ equalsTo: value }),
};
