/**
 * SimulatedEntityStore — In-memory backend for @forge/kvs entity API.
 *
 * Handles the REST endpoints that the real @forge/kvs package calls via
 * global.__forge_fetch__({ type: 'kvs' }):
 *
 *   /api/v1/get, /api/v1/set, /api/v1/delete, /api/v1/query
 *   /api/v1/secret/get, /api/v1/secret/set, /api/v1/secret/delete
 *   /api/v1/entity/get, /api/v1/entity/set, /api/v1/entity/delete, /api/v1/entity/query
 *   /api/v1/batch/set, /api/v1/transaction
 */

export interface StoredEntry {
  key: string;
  value: any;
  entityName?: string;
  createdAt: number;
  updatedAt: number;
  expireTime?: string;
}

export class SimulatedEntityStore {
  /** Plain KVS storage: key → entry */
  private store = new Map<string, StoredEntry>();
  /** Secret storage (separate namespace) */
  private secrets = new Map<string, StoredEntry>();
  /** Entity storage: "entityName:key" → entry */
  private entities = new Map<string, StoredEntry>();

  // ── Request Router ──────────────────────────────────────────────────

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
          return this.handleGet(this.store, body);
        case '/api/v1/set':
          return this.handleSet(this.store, body);
        case '/api/v1/delete':
          return this.handleDelete(this.store, body);
        case '/api/v1/query':
          return this.handleQuery(this.store, body);

        // Secrets
        case '/api/v1/secret/get':
          return this.handleGet(this.secrets, body);
        case '/api/v1/secret/set':
          return this.handleSet(this.secrets, body);
        case '/api/v1/secret/delete':
          return this.handleDelete(this.secrets, body);

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

  // ── Plain KVS Handlers ──────────────────────────────────────────────

  private handleGet(store: Map<string, StoredEntry>, body: { key: string; options?: any }): FetchLikeResponse {
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

  private handleSet(store: Map<string, StoredEntry>, body: { key: string; value: any; options?: any }): FetchLikeResponse {
    const now = Date.now();
    const existing = store.get(body.key);

    // Handle keyPolicy
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

    // Return previous/latest value if requested
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

    // Default: empty 200
    return emptyResponse(200);
  }

  private handleDelete(store: Map<string, StoredEntry>, body: { key: string }): FetchLikeResponse {
    if (!store.has(body.key)) {
      return jsonResponse(404, { code: 'KEY_NOT_FOUND', message: `Key not found: ${body.key}` });
    }
    store.delete(body.key);
    return emptyResponse(200);
  }

  private handleQuery(store: Map<string, StoredEntry>, body: {
    where?: Array<any>;
    limit?: number;
    after?: string;
  }): FetchLikeResponse {
    let entries = [...store.values()];

    // Apply where conditions — supports two formats:
    // 1. Old shim format: { property: 'key', beginsWith: 'prefix' }
    // 2. Real @forge/kvs format: { property: 'key', condition: 'BEGINS_WITH', values: ['prefix'] }
    if (body.where && body.where.length > 0) {
      for (const cond of body.where) {
        if (cond.condition) {
          // Real format: use matchCondition on key
          entries = entries.filter(e => matchCondition(e.key, cond));
        } else if (cond.beginsWith !== undefined) {
          entries = entries.filter(e => e.key.startsWith(cond.beginsWith));
        } else if (cond.equalsTo !== undefined) {
          entries = entries.filter(e => e.key === cond.equalsTo);
        }
      }
    }

    // Sort by key
    entries.sort((a, b) => a.key.localeCompare(b.key));

    // Cursor (after)
    if (body.after) {
      const idx = entries.findIndex(e => e.key === body.after);
      if (idx >= 0) {
        entries = entries.slice(idx + 1);
      }
    }

    // Limit
    const limit = body.limit ?? 20;
    const page = entries.slice(0, limit);
    const hasMore = entries.length > limit;

    return jsonResponse(200, {
      data: page.map(e => ({ key: e.key, value: e.value })),
      cursor: hasMore ? page[page.length - 1].key : undefined,
    });
  }

  // ── Entity Handlers ─────────────────────────────────────────────────

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

  /**
   * Entity query — supports indexes, partitions, range conditions, filters, sort, pagination.
   *
   * Request body shape (from entity-query.js getMany()):
   * {
   *   entityName: string,
   *   indexName: string,
   *   partition?: unknown[],      // partition key values
   *   range?: EntityWhereClauses, // { condition, values } on the range key
   *   filters?: { and: [...] } | { or: [...] },  // post-query filters
   *   sort?: 'ASC' | 'DESC',
   *   cursor?: string,
   *   limit?: number,
   *   options?: { metadataFields?: string[] }
   * }
   *
   * Index definitions come from the manifest:
   *   app.storage.entities[].indexes[]:
   *     { name, partition, range }
   *
   * Since we're in-memory, we don't pre-build index structures.
   * Instead we scan matching entities and apply conditions on their attribute values.
   * This is fine for simulation — real Forge has DynamoDB-backed indexes.
   */
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
    // Get all entities for this entity name
    let entries = [...this.entities.values()].filter(e => e.entityName === body.entityName);

    // Look up index definition from manifest (if loaded)
    const indexDef = this.getIndexDefinition(body.entityName, body.indexName);

    // Apply partition filter: each partition key attribute must match
    if (body.partition && body.partition.length > 0 && indexDef?.partition) {
      const partitionKeys = indexDef.partition;
      entries = entries.filter(entry => {
        for (let i = 0; i < partitionKeys.length && i < body.partition!.length; i++) {
          const attrName = partitionKeys[i];
          const attrVal = this.getAttributeValue(entry, attrName);
          if (attrVal !== body.partition![i]) return false;
        }
        return true;
      });
    }

    // Apply range condition on the range key attribute
    if (body.range && indexDef?.range) {
      const rangeAttr = indexDef.range;
      entries = entries.filter(entry => {
        const val = this.getAttributeValue(entry, rangeAttr);
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
            const val = this.getAttributeValue(entry, f.property as string);
            return matchCondition(val, f);
          });
          return isOr ? results.some(Boolean) : results.every(Boolean);
        });
      }
    }

    // Sort by range key (or key if no range)
    const sortAttr = indexDef?.range;
    const sortDir = body.sort ?? 'ASC';
    entries.sort((a, b) => {
      const va = sortAttr ? this.getAttributeValue(a, sortAttr) : a.key;
      const vb = sortAttr ? this.getAttributeValue(b, sortAttr) : b.key;
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

    // Limit
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

  // ── Batch & Transaction ─────────────────────────────────────────────

  private handleBatchSet(body: Array<{ key: string; value: any; entityName?: string; options?: any }> | { items?: any[] } | any): FetchLikeResponse {
    // body could be an array or { items: [...] } depending on version
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
    // Transactions in Forge KVS are atomic get-check-set operations.
    // For simulation, we just execute them sequentially (in-memory is already atomic per tick).
    // The body contains an array of actions: get, set, delete with conditions.
    // For now, basic support — execute all operations.
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
    return emptyResponse(200);
  }

  // ── Index Definition Lookup ─────────────────────────────────────────

  /**
   * Entity index definitions are loaded from the manifest.
   * Call registerEntitySchema() after parsing the manifest.
   */
  private entitySchemas = new Map<string, EntitySchema>();

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

  private getAttributeValue(entry: StoredEntry, attrName: string): any {
    if (!entry.value || typeof entry.value !== 'object') return undefined;
    return entry.value[attrName];
  }

  // ── Introspection ───────────────────────────────────────────────────

  /** Get all plain KVS entries */
  dumpKvs(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [k, v] of this.store) result[k] = v.value;
    return result;
  }

  /** Get all entity entries */
  dumpEntities(): Record<string, { entityName: string; key: string; value: any }[]> {
    const result: Record<string, { entityName: string; key: string; value: any }[]> = {};
    for (const entry of this.entities.values()) {
      const name = entry.entityName!;
      if (!result[name]) result[name] = [];
      result[name].push({ entityName: name, key: entry.key, value: entry.value });
    }
    return result;
  }

  get kvsSize(): number { return this.store.size; }
  get entitySize(): number { return this.entities.size; }

  /** Clear all storage */
  clear(): void {
    this.store.clear();
    this.secrets.clear();
    this.entities.clear();
    // Don't clear schemas — they come from the manifest, not runtime data
  }

  /** Full clear including schemas */
  clearAll(): void {
    this.clear();
    this.entitySchemas.clear();
  }
}

// ── Types ─────────────────────────────────────────────────────────────

export interface EntitySchema {
  attributes: Record<string, { type: string; default?: any }>;
  indexes: IndexDefinition[];
}

export interface IndexDefinition {
  name: string;
  partition: string[];  // attribute names for partition key
  range?: string;       // attribute name for range/sort key
}

interface FilterItem {
  property: string;
  condition: string;
  values: any[];
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
      return true; // Unknown condition — don't filter
  }
}

// ── Response Helpers ──────────────────────────────────────────────────

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
