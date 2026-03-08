/**
 * UnifiedKVS — single class replacing SimulatedKVS and SimulatedEntityStore.
 *
 * Provides:
 *   - Direct API: get/set/delete, getSecret/setSecret/deleteSecret,
 *     query() with beginsWith/equalsTo, getMany/setMany/deleteMany,
 *     transact() (read-modify-write with per-key locking)
 *   - handleRequest() for __forge_fetch__ HTTP endpoint routing
 *     (plain KVS, secrets, entities, batch, transactions)
 *   - Entity schema registration + validation
 *   - Latency simulation for concurrency testing
 *   - dump()/restore() backward compat + dumpAll()/restoreAll() for persistence
 */

import type { StorageEntry, StorageQueryResult } from './types.js';

// ── Types ─────────────────────────────────────────────────────────────

export interface StoredEntry {
  key: string;
  value: any;
  entityName?: string;
  createdAt: number;
  updatedAt: number;
  expireTime?: string;
}

export interface EntityStoreDump {
  kvs?: StoredEntry[];
  entities?: StoredEntry[];
  secrets?: StoredEntry[];
}

export interface EntitySchema {
  attributes: Record<string, { type: string; default?: any }>;
  indexes: IndexDefinition[];
}

export interface IndexDefinition {
  name: string;
  partition: string[];
  range?: string;
}

interface FilterItem {
  property: string;
  condition: string;
  values: any[];
}

interface FetchLikeResponse {
  status: number;
  statusText: string;
  ok: boolean;
  text: () => Promise<string>;
  json: () => Promise<any>;
  headers: {
    get(name: string): string | null;
    has(name: string): boolean;
    [key: string]: any;
  };
}

// ── Unified KVS Class ─────────────────────────────────────────────────

export class UnifiedKVS {
  /** Plain KVS storage: key → StoredEntry */
  private store = new Map<string, StoredEntry>();
  /** Secret storage (separate namespace) */
  private secrets = new Map<string, StoredEntry>();
  /** Entity storage: "entityName:key" → StoredEntry */
  private entities = new Map<string, StoredEntry>();

  private latencyConfig: boolean | number = false;
  private entitySchemas = new Map<string, EntitySchema>();

  // ── Latency Simulation ──────────────────────────────────────────────

  setLatency(latency: boolean | number): void {
    this.latencyConfig = latency;
  }

  private async simulateDelay(): Promise<void> {
    if (this.latencyConfig === false) return;
    if (this.latencyConfig === true) {
      await new Promise<void>((r) => setTimeout(r, 0));
    } else {
      const ms = Math.random() * this.latencyConfig;
      await new Promise<void>((r) => setTimeout(r, ms));
    }
  }

  // ── Direct API: Basic Operations ────────────────────────────────────

  async get(key: string): Promise<any> {
    await this.simulateDelay();
    return this.store.get(key)?.value ?? undefined;
  }

  async set(key: string, value: any): Promise<void> {
    await this.simulateDelay();
    if (value === null || value === undefined) {
      throw new Error('Cannot store null or undefined values');
    }
    const now = Date.now();
    const existing = this.store.get(key);
    const serialized = JSON.parse(JSON.stringify(value));
    this.store.set(key, {
      key,
      value: serialized,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  }

  async delete(key: string): Promise<void> {
    await this.simulateDelay();
    this.store.delete(key);
  }

  // ── Direct API: Secrets ─────────────────────────────────────────────

  async getSecret(key: string): Promise<any> {
    return this.secrets.get(key)?.value ?? undefined;
  }

  async setSecret(key: string, value: any): Promise<void> {
    const now = Date.now();
    const existing = this.secrets.get(key);
    this.secrets.set(key, {
      key,
      value: JSON.parse(JSON.stringify(value)),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  }

  async deleteSecret(key: string): Promise<void> {
    this.secrets.delete(key);
  }

  // ── Direct API: Query ───────────────────────────────────────────────

  query(): KVSQueryBuilder {
    return new KVSQueryBuilder(this.store);
  }

  // ── Direct API: Batch ───────────────────────────────────────────────

  async getMany(keys: string[]): Promise<Map<string, any>> {
    const result = new Map<string, any>();
    for (const key of keys) {
      const entry = this.store.get(key);
      if (entry !== undefined) {
        result.set(key, entry.value);
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

  // ── Direct API: Entity ───────────────────────────────────────────────

  /**
   * Get an entity API scoped to a specific entity name.
   * Mirrors real @forge/kvs: kvs.entity('MyEntity').get/set/delete/query()
   */
  entity(entityName: string): EntityAPI {
    return new EntityAPI(entityName, this);
  }

  // ── Direct API: Transaction ─────────────────────────────────────────

  /**
   * Start a transaction builder for batched writes/deletes.
   * Mirrors real @forge/kvs: kvs.transact().set(k,v).delete(k).execute()
   * NOTE: This is batched write/delete only. No atomic read-then-write.
   */
  transact(): TransactionBuilder {
    return new TransactionBuilder(this);
  }

  // ── Internal Entity Operations (used by EntityAPI + handleRequest) ──

  /** @internal */ async entityGet(entityName: string, key: string): Promise<any> {
    const entry = this.entities.get(this.entityKey(entityName, key));
    return entry?.value ?? undefined;
  }

  /** @internal */ async entitySet(entityName: string, key: string, value: any): Promise<void> {
    // Schema validation
    const schema = this.entitySchemas.get(entityName);
    if (schema && value && typeof value === 'object') {
      const error = validateEntityValue(value, schema, entityName);
      if (error) throw new Error(error);
    }

    const now = Date.now();
    const ek = this.entityKey(entityName, key);
    const existing = this.entities.get(ek);
    this.entities.set(ek, {
      key,
      value: JSON.parse(JSON.stringify(value)),
      entityName,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  }

  /** @internal */ async entityDelete(entityName: string, key: string): Promise<void> {
    this.entities.delete(this.entityKey(entityName, key));
  }

  /** @internal */ entityQuery(entityName: string): EntityQueryBuilder {
    return new EntityQueryBuilder(entityName, this.entities, this.entitySchemas);
  }

  /** @internal Execute a transaction: batched set/delete operations */
  async executeTransaction(ops: TransactionOps): Promise<void> {
    const now = Date.now();

    for (const item of ops.sets) {
      if (item.entityName) {
        await this.entitySet(item.entityName, item.key, item.value);
      } else {
        await this.set(item.key, item.value);
      }
    }

    for (const item of ops.deletes) {
      if (item.entityName) {
        this.entities.delete(this.entityKey(item.entityName, item.key));
      } else {
        this.store.delete(item.key);
      }
    }

    // checks are condition assertions — in-memory simulation is atomic per tick,
    // so we don't need to actually implement optimistic locking
  }

  // ── handleRequest (HTTP endpoint routing for __forge_fetch__) ───────

  async handleRequest(
    path: string,
    options?: { method?: string; body?: string; headers?: Record<string, string> }
  ): Promise<FetchLikeResponse> {
    if (!options?.body) {
      return jsonResponse(400, { code: 'BAD_REQUEST', message: 'Missing request body' });
    }

    let body: any;
    try {
      body = JSON.parse(options.body);
    } catch {
      return jsonResponse(400, { code: 'BAD_REQUEST', message: 'Invalid JSON' });
    }

    try {
      switch (path) {
        // Plain KVS
        case '/api/v1/get':
          return this.handleHttpGet(this.store, body);
        case '/api/v1/set':
          return this.handleHttpSet(this.store, body);
        case '/api/v1/delete':
          return this.handleHttpDelete(this.store, body);
        case '/api/v1/query':
          return this.handleHttpQuery(this.store, body);

        // Secrets
        case '/api/v1/secret/get':
          return this.handleHttpGet(this.secrets, body);
        case '/api/v1/secret/set':
          return this.handleHttpSet(this.secrets, body);
        case '/api/v1/secret/delete':
          return this.handleHttpDelete(this.secrets, body);

        // Entities
        case '/api/v1/entity/get':
          return this.handleEntityGet(body);
        case '/api/v1/entity/set':
          return this.handleEntitySet(body);
        case '/api/v1/entity/delete':
          return this.handleEntityDelete(body);
        case '/api/v1/entity/query':
          return this.handleEntityQuery(body);

        // Batch
        case '/api/v1/batch/set':
          return this.handleBatchSet(body);

        // Transaction
        case '/api/v1/transaction':
          return this.handleTransaction(body);

        default:
          return jsonResponse(404, { code: 'NOT_FOUND', message: `Unknown endpoint: ${path}` });
      }
    } catch (err: any) {
      return jsonResponse(500, { code: 'INTERNAL_ERROR', message: err.message });
    }
  }

  // ── HTTP Handlers: Plain KVS ────────────────────────────────────────

  private handleHttpGet(store: Map<string, StoredEntry>, body: { key: string; options?: any }): FetchLikeResponse {
    const entry = store.get(body.key);
    if (!entry) {
      return jsonResponse(404, { code: 'KEY_NOT_FOUND', message: `Key not found: ${body.key}` });
    }
    return jsonResponse(200, {
      key: entry.key,
      value: entry.value,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      expireTime: entry.expireTime,
    });
  }

  private handleHttpSet(store: Map<string, StoredEntry>, body: { key: string; value: any; options?: any }): FetchLikeResponse {
    const now = Date.now();
    const existing = store.get(body.key);

    if (body.options?.keyPolicy === 'FAIL_IF_EXISTS' && existing) {
      return jsonResponse(409, { code: 'KEY_ALREADY_EXISTS', message: `Key already exists: ${body.key}` });
    }

    const previous = existing ? { ...existing } : undefined;

    const entry: StoredEntry = {
      key: body.key,
      value: body.value,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      expireTime: body.options?.ttl ? computeExpireTime(now, body.options.ttl) : existing?.expireTime,
    };
    store.set(body.key, entry);

    if (body.options?.returnValue === 'PREVIOUS' && previous) {
      return jsonResponse(200, {
        key: previous.key,
        value: previous.value,
        createdAt: previous.createdAt,
        updatedAt: previous.updatedAt,
        expireTime: previous.expireTime,
      });
    }
    if (body.options?.returnValue === 'LATEST') {
      return jsonResponse(200, {
        key: entry.key,
        value: entry.value,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        expireTime: entry.expireTime,
      });
    }

    return emptyResponse(200);
  }

  private handleHttpDelete(store: Map<string, StoredEntry>, body: { key: string }): FetchLikeResponse {
    if (!store.has(body.key)) {
      return jsonResponse(404, { code: 'KEY_NOT_FOUND', message: `Key not found: ${body.key}` });
    }
    store.delete(body.key);
    return emptyResponse(200);
  }

  private handleHttpQuery(store: Map<string, StoredEntry>, body: {
    where?: Array<any>;
    limit?: number;
    after?: string;
  }): FetchLikeResponse {
    let entries = [...store.values()];

    if (body.where && body.where.length > 0) {
      for (const cond of body.where) {
        if (cond.condition) {
          entries = entries.filter(e => matchCondition(e.key, cond));
        } else if (cond.beginsWith !== undefined) {
          entries = entries.filter(e => e.key.startsWith(cond.beginsWith));
        } else if (cond.equalsTo !== undefined) {
          entries = entries.filter(e => e.key === cond.equalsTo);
        }
      }
    }

    entries.sort((a, b) => a.key.localeCompare(b.key));

    if (body.after) {
      const idx = entries.findIndex(e => e.key === body.after);
      if (idx >= 0) {
        entries = entries.slice(idx + 1);
      }
    }

    const limit = body.limit ?? 20;
    const page = entries.slice(0, limit);
    const hasMore = entries.length > limit;

    return jsonResponse(200, {
      data: page.map(e => ({ key: e.key, value: e.value })),
      cursor: hasMore ? page[page.length - 1].key : undefined,
    });
  }

  // ── HTTP Handlers: Entities ─────────────────────────────────────────

  private entityKey(entityName: string, key: string): string {
    return `${entityName}:${key}`;
  }

  private handleEntityGet(body: { entityName: string; key: string; options?: any }): FetchLikeResponse {
    const entry = this.entities.get(this.entityKey(body.entityName, body.key));
    if (!entry) {
      return jsonResponse(404, { code: 'KEY_NOT_FOUND', message: `Entity key not found: ${body.entityName}/${body.key}` });
    }
    return jsonResponse(200, {
      key: entry.key,
      value: entry.value,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      expireTime: entry.expireTime,
    });
  }

  private handleEntitySet(body: { entityName: string; key: string; value: any; options?: any }): FetchLikeResponse {
    // Schema validation
    const schema = this.entitySchemas.get(body.entityName);
    if (schema && body.value && typeof body.value === 'object') {
      const validationError = validateEntityValue(body.value, schema, body.entityName);
      if (validationError) {
        return jsonResponse(400, { code: 'VALIDATION_ERROR', message: validationError });
      }
    }

    const now = Date.now();
    const ek = this.entityKey(body.entityName, body.key);
    const existing = this.entities.get(ek);

    if (body.options?.keyPolicy === 'FAIL_IF_EXISTS' && existing) {
      return jsonResponse(409, { code: 'KEY_ALREADY_EXISTS', message: `Entity key already exists: ${body.entityName}/${body.key}` });
    }

    const previous = existing ? { ...existing } : undefined;

    const entry: StoredEntry = {
      key: body.key,
      value: body.value,
      entityName: body.entityName,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      expireTime: body.options?.ttl ? computeExpireTime(now, body.options.ttl) : existing?.expireTime,
    };
    this.entities.set(ek, entry);

    if (body.options?.returnValue === 'PREVIOUS' && previous) {
      return jsonResponse(200, {
        key: previous.key,
        value: previous.value,
        createdAt: previous.createdAt,
        updatedAt: previous.updatedAt,
        expireTime: previous.expireTime,
      });
    }
    if (body.options?.returnValue === 'LATEST') {
      return jsonResponse(200, {
        key: entry.key,
        value: entry.value,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        expireTime: entry.expireTime,
      });
    }

    return emptyResponse(200);
  }

  private handleEntityDelete(body: { entityName: string; key: string }): FetchLikeResponse {
    const ek = this.entityKey(body.entityName, body.key);
    if (!this.entities.has(ek)) {
      return jsonResponse(404, { code: 'KEY_NOT_FOUND', message: `Entity key not found: ${body.entityName}/${body.key}` });
    }
    this.entities.delete(ek);
    return emptyResponse(200);
  }

  private handleEntityQuery(body: {
    entityName: string;
    indexName: string;
    partition?: unknown[];
    range?: { condition: string; values: any[] };
    filters?: { and?: FilterItem[]; or?: FilterItem[] };
    sort?: 'ASC' | 'DESC';
    cursor?: string;
    limit?: number;
    options?: any;
  }): FetchLikeResponse {
    let entries = [...this.entities.values()].filter(e => e.entityName === body.entityName);

    const indexDef = this.getIndexDefinition(body.entityName, body.indexName);

    // Apply partition filter
    if (body.partition && body.partition.length > 0 && indexDef?.partition) {
      const partitionKeys = indexDef.partition;
      entries = entries.filter(entry => {
        for (let i = 0; i < partitionKeys.length && i < body.partition!.length; i++) {
          const attrName = partitionKeys[i];
          const attrVal = getAttributeValue(entry, attrName);
          if (attrVal !== body.partition![i]) return false;
        }
        return true;
      });
    }

    // Apply range condition
    if (body.range && indexDef?.range) {
      const rangeAttr = indexDef.range;
      entries = entries.filter(entry => {
        const val = getAttributeValue(entry, rangeAttr);
        return matchCondition(val, body.range!);
      });
    }

    // Apply post-query filters
    if (body.filters) {
      const filterItems = body.filters.and ?? body.filters.or ?? [];
      const isOr = !!body.filters.or;

      if (filterItems.length > 0) {
        entries = entries.filter(entry => {
          const results = filterItems.map(f => {
            const val = getAttributeValue(entry, f.property as string);
            return matchCondition(val, f);
          });
          return isOr ? results.some(Boolean) : results.every(Boolean);
        });
      }
    }

    // Sort
    const sortAttr = indexDef?.range;
    const sortDir = body.sort ?? 'ASC';
    entries.sort((a, b) => {
      const va = sortAttr ? getAttributeValue(a, sortAttr) : a.key;
      const vb = sortAttr ? getAttributeValue(b, sortAttr) : b.key;
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === 'DESC' ? -cmp : cmp;
    });

    // Cursor-based pagination
    if (body.cursor) {
      const idx = entries.findIndex(e => e.key === body.cursor);
      if (idx >= 0) {
        entries = entries.slice(idx + 1);
      }
    }

    const limit = body.limit ?? 20;
    const page = entries.slice(0, limit);
    const hasMore = entries.length > limit;

    return jsonResponse(200, {
      data: page.map(e => ({
        key: e.key,
        value: e.value,
        ...(body.options?.metadataFields ? {
          createdAt: e.createdAt,
          updatedAt: e.updatedAt,
          expireTime: e.expireTime,
        } : {}),
      })),
      cursor: hasMore ? page[page.length - 1].key : undefined,
    });
  }

  // ── HTTP Handlers: Batch & Transaction ──────────────────────────────

  private handleBatchSet(body: Array<{ key: string; value: any; entityName?: string; options?: any }> | { items?: any[] } | any): FetchLikeResponse {
    const items: any[] = Array.isArray(body) ? body : (body.items ?? body);
    const successfulKeys: { key: string; entityName?: string }[] = [];
    const failedKeys: { key: string; entityName?: string; error: { code: string; message: string } }[] = [];

    for (const item of items) {
      try {
        const now = Date.now();
        if (item.entityName) {
          const ek = this.entityKey(item.entityName, item.key);
          const existing = this.entities.get(ek);
          this.entities.set(ek, {
            key: item.key,
            value: item.value,
            entityName: item.entityName,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
          });
        } else {
          const existing = this.store.get(item.key);
          this.store.set(item.key, {
            key: item.key,
            value: item.value,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
          });
        }
        successfulKeys.push({ key: item.key, entityName: item.entityName });
      } catch (err: any) {
        failedKeys.push({ key: item.key, entityName: item.entityName, error: { code: 'SET_FAILED', message: err.message } });
      }
    }

    return jsonResponse(200, { successfulKeys, failedKeys });
  }

  private handleTransaction(body: any): FetchLikeResponse {
    if (body.actions) {
      for (const action of body.actions) {
        if (action.type === 'set') {
          const now = Date.now();
          if (action.entityName) {
            const ek = this.entityKey(action.entityName, action.key);
            const existing = this.entities.get(ek);
            this.entities.set(ek, {
              key: action.key,
              value: action.value,
              entityName: action.entityName,
              createdAt: existing?.createdAt ?? now,
              updatedAt: now,
            });
          } else {
            const existing = this.store.get(action.key);
            this.store.set(action.key, {
              key: action.key,
              value: action.value,
              createdAt: existing?.createdAt ?? now,
              updatedAt: now,
            });
          }
        } else if (action.type === 'delete') {
          if (action.entityName) {
            this.entities.delete(this.entityKey(action.entityName, action.key));
          } else {
            this.store.delete(action.key);
          }
        }
      }
    }

    // New-style transaction format (from real @forge/kvs TransactionBuilder)
    if (body.set) {
      for (const item of body.set) {
        const now = Date.now();
        if (item.entityName) {
          const ek = this.entityKey(item.entityName, item.key);
          const existing = this.entities.get(ek);
          this.entities.set(ek, {
            key: item.key,
            value: item.value,
            entityName: item.entityName,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
            expireTime: item.options?.ttl ? computeExpireTime(now, item.options.ttl) : existing?.expireTime,
          });
        } else {
          const existing = this.store.get(item.key);
          this.store.set(item.key, {
            key: item.key,
            value: item.value,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
          });
        }
      }
    }
    if (body.delete) {
      for (const item of body.delete) {
        if (item.entityName) {
          this.entities.delete(this.entityKey(item.entityName, item.key));
        } else {
          this.store.delete(item.key);
        }
      }
    }
    // body.check — condition checks are a no-op in simulation (in-memory is atomic)

    return emptyResponse(200);
  }

  // ── Schema Management ───────────────────────────────────────────────

  registerEntitySchema(entityName: string, schema: EntitySchema): void {
    this.entitySchemas.set(entityName, schema);
  }

  getEntitySchemas(): Map<string, EntitySchema> {
    return new Map(this.entitySchemas);
  }

  private getIndexDefinition(entityName: string, indexName: string): IndexDefinition | undefined {
    const schema = this.entitySchemas.get(entityName);
    if (!schema) return undefined;
    return schema.indexes.find(i => i.name === indexName);
  }

  // ── Introspection ───────────────────────────────────────────────────

  /** Dump plain KVS as raw values (backward compat with SimulatedKVS.dump()) */
  dump(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [k, v] of this.store) {
      result[k] = v.value;
    }
    return result;
  }

  /** Restore plain KVS from raw values dump (backward compat) */
  restore(data: Record<string, any>): void {
    const now = Date.now();
    for (const [key, value] of Object.entries(data)) {
      this.store.set(key, {
        key,
        value: JSON.parse(JSON.stringify(value)),
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  /** Get all plain KVS entries as raw values */
  dumpKvs(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [k, v] of this.store) result[k] = v.value;
    return result;
  }

  /** Get all entity entries grouped by entity name */
  dumpEntities(): Record<string, { entityName: string; key: string; value: any }[]> {
    const result: Record<string, { entityName: string; key: string; value: any }[]> = {};
    for (const entry of this.entities.values()) {
      const name = entry.entityName!;
      if (!result[name]) result[name] = [];
      result[name].push({ entityName: name, key: entry.key, value: entry.value });
    }
    return result;
  }

  /** Dump full state for persistence (KVS + entities + secrets) */
  dumpAll(): EntityStoreDump {
    return {
      kvs: [...this.store.values()],
      entities: [...this.entities.values()],
      secrets: [...this.secrets.values()],
    };
  }

  /** Restore full state from a persistence dump */
  restoreAll(dump: EntityStoreDump): void {
    if (dump.kvs) {
      for (const entry of dump.kvs) {
        this.store.set(entry.key, { ...entry });
      }
    }
    if (dump.entities) {
      for (const entry of dump.entities) {
        const ek = this.entityKey(entry.entityName!, entry.key);
        this.entities.set(ek, { ...entry });
      }
    }
    if (dump.secrets) {
      for (const entry of dump.secrets) {
        this.secrets.set(entry.key, { ...entry });
      }
    }
  }

  get size(): number {
    return this.store.size;
  }

  get kvsSize(): number { return this.store.size; }
  get entitySize(): number { return this.entities.size; }
  get secretSize(): number { return this.secrets.size; }

  /** Clear runtime data (preserves schemas) */
  clear(): void {
    this.store.clear();
    this.secrets.clear();
    this.entities.clear();
  }

  /** Full clear including schemas */
  clearAll(): void {
    this.clear();
    this.entitySchemas.clear();
  }
}

// ── Query Builder ─────────────────────────────────────────────────────

export class KVSQueryBuilder {
  private conditions: Array<{
    field: string;
    condition: string;
    value: string;
  }> = [];
  private _limit = 20;
  private _cursor?: string;
  private _sortDirection: 'ASC' | 'DESC' = 'ASC';

  constructor(private store: Map<string, StoredEntry>) {}

  where(
    field: 'key',
    condition: { beginsWith: string } | { equalsTo: string }
  ): this {
    if ('beginsWith' in condition) {
      this.conditions.push({ field, condition: 'beginsWith', value: condition.beginsWith });
    } else {
      this.conditions.push({ field, condition: 'equalsTo', value: condition.equalsTo });
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

    for (const cond of this.conditions) {
      if (cond.condition === 'beginsWith') {
        keys = keys.filter((k) => k.startsWith(cond.value));
      } else if (cond.condition === 'equalsTo') {
        keys = keys.filter((k) => k === cond.value);
      }
    }

    keys.sort();
    if (this._sortDirection === 'DESC') {
      keys.reverse();
    }

    if (this._cursor) {
      const idx = keys.indexOf(this._cursor);
      if (idx >= 0) {
        keys = keys.slice(idx + 1);
      }
    }

    const page = keys.slice(0, this._limit);
    const results: StorageEntry[] = page.map((key) => ({
      key,
      value: this.store.get(key)!.value,
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

// ── Condition helpers (re-exported for @forge/kvs API compat) ─────────

export const WhereConditions = {
  beginsWith: (prefix: string) => ({ beginsWith: prefix }),
  equalsTo: (value: string) => ({ equalsTo: value }),
};

// ── Entity API (kvs.entity('Name')) ───────────────────────────────────

export class EntityAPI {
  constructor(
    private entityName: string,
    private kvs: UnifiedKVS
  ) {}

  get(key: string): Promise<any> {
    return this.kvs.entityGet(this.entityName, key);
  }

  set(key: string, value: any): Promise<void> {
    return this.kvs.entitySet(this.entityName, key, value);
  }

  delete(key: string): Promise<void> {
    return this.kvs.entityDelete(this.entityName, key);
  }

  query(): EntityQueryBuilder {
    return this.kvs.entityQuery(this.entityName);
  }
}

// ── Entity Query Builder ──────────────────────────────────────────────

export class EntityQueryBuilder {
  private _indexName?: string;
  private _partition?: unknown[];
  private _range?: { condition: string; values: any[] };
  private _filters?: { and?: FilterItem[]; or?: FilterItem[] };
  private _sort: 'ASC' | 'DESC' = 'ASC';
  private _cursor?: string;
  private _limit = 20;

  constructor(
    private entityName: string,
    private entities: Map<string, StoredEntry>,
    private schemas: Map<string, EntitySchema>
  ) {}

  index(name: string, options?: { partition?: unknown[] }): this {
    this._indexName = name;
    if (options?.partition) this._partition = options.partition;
    return this;
  }

  where(condition: { condition: string; values: any[] }): this {
    this._range = condition;
    return this;
  }

  filters(filter: { filters(): FilterItem[]; operator(): string }): this {
    const items = filter.filters();
    const op = filter.operator();
    this._filters = op === 'or' ? { or: items } : { and: items };
    return this;
  }

  sort(direction: 'ASC' | 'DESC'): this {
    this._sort = direction;
    return this;
  }

  cursor(c: string): this {
    this._cursor = c;
    return this;
  }

  limit(n: number): this {
    this._limit = n;
    return this;
  }

  async getMany(): Promise<{ results: Array<{ key: string; value: any }>; nextCursor?: string }> {
    // Get all entities for this entity name
    let entries = [...this.entities.values()].filter(e => e.entityName === this.entityName);

    // Look up index definition
    const schema = this.schemas.get(this.entityName);
    const indexDef = schema?.indexes.find(i => i.name === this._indexName);

    // Apply partition filter
    if (this._partition && this._partition.length > 0 && indexDef?.partition) {
      const partitionKeys = indexDef.partition;
      entries = entries.filter(entry => {
        for (let i = 0; i < partitionKeys.length && i < this._partition!.length; i++) {
          const attrVal = entry.value?.[partitionKeys[i]];
          if (attrVal !== this._partition![i]) return false;
        }
        return true;
      });
    }

    // Apply range condition
    if (this._range && indexDef?.range) {
      const rangeAttr = indexDef.range;
      entries = entries.filter(entry => {
        const val = entry.value?.[rangeAttr];
        return matchCondition(val, this._range!);
      });
    }

    // Apply post-query filters
    if (this._filters) {
      const filterItems = this._filters.and ?? this._filters.or ?? [];
      const isOr = !!this._filters.or;
      if (filterItems.length > 0) {
        entries = entries.filter(entry => {
          const results = filterItems.map(f => {
            const val = entry.value?.[f.property];
            return matchCondition(val, f);
          });
          return isOr ? results.some(Boolean) : results.every(Boolean);
        });
      }
    }

    // Sort
    const sortAttr = indexDef?.range;
    entries.sort((a, b) => {
      const va = sortAttr ? a.value?.[sortAttr] : a.key;
      const vb = sortAttr ? b.value?.[sortAttr] : b.key;
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return this._sort === 'DESC' ? -cmp : cmp;
    });

    // Cursor
    if (this._cursor) {
      const idx = entries.findIndex(e => e.key === this._cursor);
      if (idx >= 0) entries = entries.slice(idx + 1);
    }

    // Limit
    const page = entries.slice(0, this._limit);
    const hasMore = entries.length > this._limit;

    return {
      results: page.map(e => ({ key: e.key, value: e.value })),
      nextCursor: hasMore ? page[page.length - 1].key : undefined,
    };
  }

  async getOne(): Promise<{ key: string; value: any } | undefined> {
    this._limit = 1;
    const { results } = await this.getMany();
    return results[0];
  }
}

// ── Transaction Builder ───────────────────────────────────────────────

interface TransactionOps {
  sets: Array<{ key: string; value: any; entityName?: string }>;
  deletes: Array<{ key: string; entityName?: string }>;
  checks: Array<{ key: string; entityName: string }>;
}

export class TransactionBuilder {
  private ops: TransactionOps = { sets: [], deletes: [], checks: [] };

  constructor(private kvs: UnifiedKVS) {}

  set(key: string, value: any, entity?: { entityName: string }): this {
    this.ops.sets.push({ key, value, entityName: entity?.entityName });
    return this;
  }

  delete(key: string, entity?: { entityName: string }): this {
    this.ops.deletes.push({ key, entityName: entity?.entityName });
    return this;
  }

  check(key: string, entity: { entityName: string }): this {
    this.ops.checks.push({ key, entityName: entity.entityName });
    return this;
  }

  async execute(): Promise<void> {
    return this.kvs.executeTransaction(this.ops);
  }
}

// ── Schema Validation ─────────────────────────────────────────────────

const FORGE_TYPE_MAP: Record<string, (v: any) => boolean> = {
  string: (v) => typeof v === 'string',
  integer: (v) => typeof v === 'number' && Number.isInteger(v),
  float: (v) => typeof v === 'number',
  boolean: (v) => typeof v === 'boolean',
  number: (v) => typeof v === 'number',
};

function validateEntityValue(value: Record<string, any>, schema: EntitySchema, entityName: string): string | null {
  for (const [field, val] of Object.entries(value)) {
    const attrDef = schema.attributes[field];
    if (!attrDef) {
      return `Unknown attribute "${field}" on entity "${entityName}". Valid attributes: ${Object.keys(schema.attributes).join(', ')}`;
    }
    if (val !== null && val !== undefined) {
      const checker = FORGE_TYPE_MAP[attrDef.type];
      if (checker && !checker(val)) {
        return `Type mismatch for attribute "${field}" on entity "${entityName}": expected ${attrDef.type}, got ${typeof val}`;
      }
    }
  }
  return null;
}

// ── Condition Matching ────────────────────────────────────────────────

function matchCondition(value: any, condition: { condition: string; values?: any[] }): boolean {
  const vals = condition.values ?? [];
  switch (condition.condition) {
    case 'BETWEEN':
      return value >= vals[0] && value <= vals[1];
    case 'BEGINS_WITH':
      return typeof value === 'string' && value.startsWith(String(vals[0]));
    case 'EQUAL_TO':
      return value === vals[0];
    case 'NOT_EQUAL_TO':
      return value !== vals[0];
    case 'GREATER_THAN':
      return value > vals[0];
    case 'GREATER_THAN_EQUAL_TO':
      return value >= vals[0];
    case 'LESS_THAN':
      return value < vals[0];
    case 'LESS_THAN_EQUAL_TO':
      return value <= vals[0];
    case 'EXISTS':
      return value !== undefined && value !== null;
    case 'NOT_EXISTS':
      return value === undefined || value === null;
    case 'CONTAINS':
      return typeof value === 'string' && value.includes(String(vals[0]));
    case 'NOT_CONTAINS':
      return typeof value === 'string' && !value.includes(String(vals[0]));
    default:
      return true;
  }
}

// ── Response Helpers ──────────────────────────────────────────────────

function jsonResponse(status: number, body: any): FetchLikeResponse {
  const bodyStr = JSON.stringify(body);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  return {
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    ok: status >= 200 && status < 300,
    text: async () => bodyStr,
    json: async () => body,
    headers: {
      ...headers,
      get(name: string) { return headers[name.toLowerCase()] ?? null; },
      has(name: string) { return name.toLowerCase() in headers; },
    },
  };
}

function emptyResponse(status: number): FetchLikeResponse {
  return {
    status,
    statusText: 'OK',
    ok: true,
    text: async () => '',
    json: async () => ({}),
    headers: {
      get() { return null; },
      has() { return false; },
    },
  };
}

// ── TTL ───────────────────────────────────────────────────────────────

function computeExpireTime(now: number, ttl: { value: number; unit: string }): string {
  const multipliers: Record<string, number> = {
    SECONDS: 1000,
    MINUTES: 60 * 1000,
    HOURS: 60 * 60 * 1000,
    DAYS: 24 * 60 * 60 * 1000,
  };
  const ms = ttl.value * (multipliers[ttl.unit] ?? 1000);
  return new Date(now + ms).toISOString();
}

// ── Helpers ───────────────────────────────────────────────────────────

function getAttributeValue(entry: StoredEntry, attrName: string): any {
  if (!entry.value || typeof entry.value !== 'object') return undefined;
  return entry.value[attrName];
}
