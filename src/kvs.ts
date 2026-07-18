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

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Detach a stored value before handing it to a caller.
 *
 * Parity (KVS reads): real Forge KVS JSON-serializes on write AND read —
 * a value returned from get()/query()/batchGet() is always a fresh copy.
 * Mutating it never mutates storage; persisting a change requires an
 * explicit set(). Returning our internal reference instead would let apps
 * "persist" mutations in the sim that silently vanish in production
 * (inverted parity violation), and would let two get() calls observe each
 * other's mutations.
 */
function detach<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

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
    return detach(this.store.get(key)?.value ?? undefined);
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
    return detach(this.secrets.get(key)?.value ?? undefined);
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
        result.set(key, detach(entry.value));
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

  // ── Direct API: Real @forge/kvs Batch Surface ───────────────────────
  //
  // Shapes match node_modules/@forge/kvs/out/interfaces/kvs-api.d.ts:
  //   batchSet(BatchSetItem[])       → { successfulKeys, failedKeys }
  //   batchDelete(BatchDeleteItem[]) → { successfulKeys, failedKeys }
  //   batchGet(BatchGetItem[])       → { successfulKeys: [{key, entityName?,
  //                                      value, createdAt?, updatedAt?,
  //                                      expireTime?}], failedKeys }
  //
  // Whole-batch validation (KVS-038/039/040/043): >25 items, empty batch,
  // duplicate key(+entityName), or >4MB batchSet payload reject the entire
  // batch. Per-item failures (KVS-041) land in failedKeys with spec error
  // codes (INVALID_KEY, KEY_TOO_SHORT, KEY_TOO_LONG, MAX_SIZE, MAX_DEPTH).
  //
  // Missing keys in batchGet are silently OMITTED from successfulKeys
  // (not failedKeys) — Forge docs don't document this case (spec §8.7);
  // omission matches "missing keys do not produce values" most literally.

  async batchGet(
    items: Array<{ key: string; entityName?: string; options?: { metadataFields?: string[] } }>,
  ): Promise<{ successfulKeys: Array<Record<string, any>>; failedKeys: Array<{ key: string; entityName?: string; error: { code: string; message: string } }> }> {
    await this.simulateDelay();
    this.validateBatchRequest(items, 'batchGet');

    const successfulKeys: Array<Record<string, any>> = [];
    const failedKeys: Array<{ key: string; entityName?: string; error: { code: string; message: string } }> = [];

    for (const item of items) {
      const keyError = validateKvsKey(item.key);
      if (keyError) {
        failedKeys.push({ key: item.key, ...(item.entityName ? { entityName: item.entityName } : {}), error: keyError });
        continue;
      }
      const entry = item.entityName
        ? this.entities.get(this.entityKey(item.entityName, item.key))
        : this.store.get(item.key);
      if (!entry) continue; // Missing key → omitted (see note above)

      const result: Record<string, any> = {
        key: item.key,
        ...(item.entityName ? { entityName: item.entityName } : {}),
        value: detach(entry.value),
      };
      const meta = item.options?.metadataFields;
      if (Array.isArray(meta)) {
        if (meta.includes('CREATED_AT')) result.createdAt = entry.createdAt;
        if (meta.includes('UPDATED_AT')) result.updatedAt = entry.updatedAt;
        if (meta.includes('EXPIRE_TIME') && entry.expireTime !== undefined) result.expireTime = entry.expireTime;
      }
      successfulKeys.push(result);
    }

    return { successfulKeys, failedKeys };
  }

  async batchSet(
    items: Array<{ key: string; value: any; entityName?: string; options?: { ttl?: { value: number; unit: string } } }>,
  ): Promise<{ successfulKeys: Array<{ key: string; entityName?: string }>; failedKeys: Array<{ key: string; entityName?: string; error: { code: string; message: string } }> }> {
    await this.simulateDelay();
    this.validateBatchRequest(items, 'batchSet');

    // KVS-043: whole-payload cap of 4 MB
    const payloadBytes = Buffer.byteLength(JSON.stringify(items), 'utf-8');
    if (payloadBytes > 4 * 1024 * 1024) {
      throw new KVSQueryError('MAX_SIZE', `batchSet payload exceeds 4 MB (got ${payloadBytes} bytes)`);
    }

    const successfulKeys: Array<{ key: string; entityName?: string }> = [];
    const failedKeys: Array<{ key: string; entityName?: string; error: { code: string; message: string } }> = [];

    for (const item of items) {
      const failure = (error: { code: string; message: string }) =>
        failedKeys.push({ key: item.key, ...(item.entityName ? { entityName: item.entityName } : {}), error });

      const keyError = validateKvsKey(item.key);
      if (keyError) { failure(keyError); continue; }

      if (item.value === null || item.value === undefined) {
        failure({ code: 'INVALID_VALUE', message: 'Cannot store null or undefined values' });
        continue;
      }

      const valueError = validateKvsValue(item.value);
      if (valueError) { failure(valueError); continue; }

      // Entity items: schema validation when a schema is registered
      if (item.entityName) {
        const schema = this.entitySchemas.get(item.entityName);
        if (schema && item.value && typeof item.value === 'object') {
          const validationError = validateEntityValue(item.value, schema, item.entityName);
          if (validationError) {
            failure({ code: 'VALIDATION_ERROR', message: validationError });
            continue;
          }
        }
      }

      const now = Date.now();
      const serialized = JSON.parse(JSON.stringify(item.value));
      if (item.entityName) {
        const ek = this.entityKey(item.entityName, item.key);
        const existing = this.entities.get(ek);
        this.entities.set(ek, {
          key: item.key,
          value: serialized,
          entityName: item.entityName,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          expireTime: item.options?.ttl ? computeExpireTime(now, item.options.ttl as any) : existing?.expireTime,
        });
      } else {
        const existing = this.store.get(item.key);
        this.store.set(item.key, {
          key: item.key,
          value: serialized,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          expireTime: item.options?.ttl ? computeExpireTime(now, item.options.ttl as any) : existing?.expireTime,
        });
      }
      successfulKeys.push({ key: item.key, ...(item.entityName ? { entityName: item.entityName } : {}) });
    }

    return { successfulKeys, failedKeys };
  }

  async batchDelete(
    items: Array<{ key: string; entityName?: string }>,
  ): Promise<{ successfulKeys: Array<{ key: string; entityName?: string }>; failedKeys: Array<{ key: string; entityName?: string; error: { code: string; message: string } }> }> {
    await this.simulateDelay();
    this.validateBatchRequest(items, 'batchDelete');

    const successfulKeys: Array<{ key: string; entityName?: string }> = [];
    const failedKeys: Array<{ key: string; entityName?: string; error: { code: string; message: string } }> = [];

    for (const item of items) {
      const keyError = validateKvsKey(item.key);
      if (keyError) {
        failedKeys.push({ key: item.key, ...(item.entityName ? { entityName: item.entityName } : {}), error: keyError });
        continue;
      }
      // Deleting an absent key succeeds (matches single delete semantics)
      if (item.entityName) {
        this.entities.delete(this.entityKey(item.entityName, item.key));
      } else {
        this.store.delete(item.key);
      }
      successfulKeys.push({ key: item.key, ...(item.entityName ? { entityName: item.entityName } : {}) });
    }

    return { successfulKeys, failedKeys };
  }

  /**
   * Whole-batch validation shared by batchGet/batchSet/batchDelete.
   * KVS-038 (≤25 items), KVS-039 (non-empty), KVS-040 (no duplicate
   * key/key+entityName). Throws — the entire batch is rejected, nothing
   * is read or written.
   *
   * NOTE: Forge docs don't publish the exact error codes for whole-batch
   * validation failures (only per-item codes are documented), so the codes
   * here are best-effort descriptive.
   */
  private validateBatchRequest(items: Array<{ key: string; entityName?: string }>, op: string): void {
    if (!Array.isArray(items) || items.length === 0) {
      throw new KVSQueryError('INVALID_BATCH', `${op} requires a non-empty array of items`);
    }
    if (items.length > 25) {
      throw new KVSQueryError('BATCH_SIZE_EXCEEDED', `${op} accepts at most 25 items (got ${items.length})`);
    }
    const seen = new Set<string>();
    for (const item of items) {
      const id = `${item?.entityName ?? ''}\u0000${item?.key}`;
      if (seen.has(id)) {
        throw new KVSQueryError(
          'DUPLICATE_KEY',
          `${op} contains multiple requests for the same key${item.entityName ? ' + entity' : ''}: "${item.key}"${item.entityName ? ` (entity "${item.entityName}")` : ''}`,
        );
      }
      seen.add(id);
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
   * Start a transaction builder (ENT-030/031). Mirrors real @forge/kvs:
   *   kvs.transact()
   *     .set(k, v, { entityName, conditions? }?, { ttl }?)
   *     .delete(k, { entityName, conditions? }?)
   *     .check(k, { entityName, conditions })
   *     .execute()
   * All-or-nothing: any failed condition (including check) rejects the
   * whole transaction with nothing applied.
   */
  transact(): TransactionBuilder {
    return new TransactionBuilder(this);
  }

  // ── Internal Entity Operations (used by EntityAPI + handleRequest) ──

  /** @internal */ async entityGet(entityName: string, key: string): Promise<any> {
    const entry = this.entities.get(this.entityKey(entityName, key));
    return detach(entry?.value ?? undefined);
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

  /**
   * @internal Execute a transaction request (wire shape produced by
   * TransactionBuilder.execute() or POSTed to /api/v1/transaction).
   *
   * ENT-030: all-or-nothing. ALL conditions (set/delete/check) are
   * evaluated against current state BEFORE any write is applied. Any
   * failed condition rejects the whole transaction with nothing applied.
   *
   * ENT-031: limits — max 25 operations, each key used at most once
   * across all operations, payload ≤ 4 MB. (Rate limits are out of sim
   * scope.) These are server-side checks in real Forge; the shipped
   * client's only validation is the empty-Filter throw in
   * buildConditionsRequest.
   *
   * Throws KVSQueryError with a stable `.code` on any rejection.
   */
  async executeTransaction(request: TransactionRequest): Promise<void> {
    await this.simulateDelay();
    const sets = request.set ?? [];
    const deletes = request.delete ?? [];
    const checks = request.check ?? [];
    const allOps: Array<{ key: string; entityName?: string; conditions?: TransactionConditionsWire }> =
      [...sets, ...deletes, ...checks];

    // ── ENT-031: limits ──────────────────────────────────────────────
    // Codes TRANSACTION_OPERATION_LIMIT_EXCEEDED / TRANSACTION_DUPLICATE_KEY
    // are sim-chosen (Forge docs state the limits but document no code).
    if (allOps.length > TRANSACTION_MAX_OPERATIONS) {
      throw new KVSQueryError(
        'TRANSACTION_OPERATION_LIMIT_EXCEEDED',
        `Transaction contains ${allOps.length} operations; maximum is ${TRANSACTION_MAX_OPERATIONS}`,
      );
    }
    const seenKeys = new Set<string>();
    for (const op of allOps) {
      if (seenKeys.has(op.key)) {
        throw new KVSQueryError(
          'TRANSACTION_DUPLICATE_KEY',
          `Transaction uses key "${op.key}" more than once; each key may be used in at most one operation`,
        );
      }
      seenKeys.add(op.key);
    }
    const payloadBytes = Buffer.byteLength(JSON.stringify(request), 'utf-8');
    if (payloadBytes > TRANSACTION_MAX_PAYLOAD_BYTES) {
      throw new KVSQueryError(
        'MAX_SIZE',
        `Transaction payload is ${payloadBytes} bytes; maximum is ${TRANSACTION_MAX_PAYLOAD_BYTES} (4 MB)`,
      );
    }

    // ── Upfront validation (atomicity: reject before applying anything) ──
    for (const item of sets) {
      if (item.value === null || item.value === undefined) {
        throw new KVSQueryError('INVALID_VALUE', `Cannot store null or undefined values (key "${item.key}")`);
      }
      if (item.entityName) {
        const schema = this.entitySchemas.get(item.entityName);
        if (schema && item.value && typeof item.value === 'object') {
          const error = validateEntityValue(item.value, schema, item.entityName);
          if (error) throw new KVSQueryError('INVALID_ENTITY_VALUE', error);
        }
      }
    }

    // ── ENT-030: evaluate ALL conditions before applying ANY write ──
    for (const op of allOps) {
      if (!this.transactionConditionsMet(op)) {
        throw new KVSQueryError(
          'CONDITION_FAILED', // sim-chosen code (Forge docs document the behavior but no code)
          `Transaction condition failed for key "${op.key}"${op.entityName ? ` (entity "${op.entityName}")` : ''}; no operations were applied`,
        );
      }
    }

    // ── Apply — all conditions passed, commit everything ────────────
    const now = Date.now();
    for (const item of sets) {
      const value = JSON.parse(JSON.stringify(item.value));
      if (item.entityName) {
        const ek = this.entityKey(item.entityName, item.key);
        const existing = this.entities.get(ek);
        this.entities.set(ek, {
          key: item.key,
          value,
          entityName: item.entityName,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          expireTime: item.options?.ttl ? computeExpireTime(now, item.options.ttl) : existing?.expireTime,
        });
      } else {
        const existing = this.store.get(item.key);
        this.store.set(item.key, {
          key: item.key,
          value,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          expireTime: item.options?.ttl ? computeExpireTime(now, item.options.ttl) : existing?.expireTime,
        });
      }
    }
    for (const item of deletes) {
      // Forge docs: "delete succeeds whether the key exists or not"
      if (item.entityName) {
        this.entities.delete(this.entityKey(item.entityName, item.key));
      } else {
        this.store.delete(item.key);
      }
    }
  }

  /**
   * Evaluate one operation's conditions against current state.
   * No conditions (or an op the shipped client sent with
   * `conditions: undefined`) → vacuous pass.
   */
  private transactionConditionsMet(op: {
    key: string;
    entityName?: string;
    conditions?: TransactionConditionsWire;
  }): boolean {
    const conditions = op.conditions;
    if (!conditions) return true;
    const items = conditions.and ?? conditions.or ?? [];
    if (items.length === 0) return true;
    const isOr = !!conditions.or;
    const entry = op.entityName
      ? this.entities.get(this.entityKey(op.entityName, op.key))
      : this.store.get(op.key);
    const results = items.map((f) => matchCondition(entry?.value?.[f.property], f));
    return isOr ? results.some(Boolean) : results.every(Boolean);
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
          return await this.handleBatch('batchSet', body);
        case '/api/v1/batch/get':
          return await this.handleBatch('batchGet', body);
        case '/api/v1/batch/delete':
          return await this.handleBatch('batchDelete', body);

        // Transaction
        case '/api/v1/transaction':
          return await this.handleTransaction(body);

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
        // Simple KVS query supports BEGINS_WITH only — real @forge/kvs
        // declares `where(property: 'key', condition: WhereClause)` where
        // `WhereClause = BeginsWithClause`. Any other condition is a
        // parity violation, so reject it instead of silently behaving
        // differently from the cloud runtime.
        if (cond.condition && cond.condition !== 'BEGINS_WITH') {
          throw new Error(
            `KVS query .where('key', ...) only supports WhereConditions.beginsWith. ` +
            `Got: ${cond.condition}. For other comparisons use kvs.entity('Name').query() ` +
            `against an index instead.`
          );
        }
        if (cond.condition === 'BEGINS_WITH') {
          entries = entries.filter(e => matchCondition(e.key, cond));
        }
      }
    }

    entries.sort((a, b) => a.key.localeCompare(b.key));

    if (body.after) {
      let token: CursorToken;
      try {
        token = decodeCursor(body.after, 'the KVS query wire API');
      } catch (err) {
        if (err instanceof KVSQueryError) {
          return jsonResponse(400, { code: err.code, message: err.message });
        }
        throw err;
      }
      // Positional resume (eval-8 E8-1): first key strictly after the
      // cursor position — survives deletion of the cursor row. Uses the
      // same localeCompare collation as the sort above.
      entries = entries.filter(e => e.key.localeCompare(token.k) > 0);
    }

    const limit = body.limit ?? 20;
    const page = entries.slice(0, limit);
    const hasMore = entries.length > limit;

    return jsonResponse(200, {
      data: page.map(e => ({ key: e.key, value: e.value })),
      cursor: hasMore ? encodeCursor({ k: page[page.length - 1].key }) : undefined,
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

    // Validate the index exactly like the builder path does (eval-7 F2: the
    // wire path silently no-op'd a typo'd index name, returning ALL entities
    // unscoped — worse than the builder's pre-fix empty result).
    let indexDef: IndexDefinition | undefined;
    try {
      indexDef = resolveIndexDefOrThrow(this.entitySchemas, body.entityName, body.indexName);
    } catch (err) {
      if (err instanceof KVSQueryError) {
        return jsonResponse(400, { code: err.code, message: err.message });
      }
      throw err;
    }

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

    // Sort — deterministic: range attribute first (when the index declares
    // one), then key as tiebreak so cursor positions are total-ordered.
    const sortAttr = indexDef?.range;
    const sortDir = body.sort ?? 'ASC';
    entries.sort((a, b) => {
      const va = sortAttr ? getAttributeValue(a, sortAttr) : a.key;
      const vb = sortAttr ? getAttributeValue(b, sortAttr) : b.key;
      let cmp = compareValues(va, vb);
      if (cmp === 0) cmp = compareValues(a.key, b.key);
      return sortDir === 'DESC' ? -cmp : cmp;
    });

    // Cursor-based pagination — positional resume (eval-8 E8-1): the next
    // page starts strictly after the cursor's (sortValue, key) position,
    // so deleting the cursor row between pages cannot restart pagination.
    if (body.cursor) {
      let token: CursorToken;
      try {
        token = decodeCursor(body.cursor, 'the entity query wire API');
      } catch (err) {
        if (err instanceof KVSQueryError) {
          return jsonResponse(400, { code: err.code, message: err.message });
        }
        throw err;
      }
      entries = entries.filter(e => {
        const ev = sortAttr ? getAttributeValue(e, sortAttr) : e.key;
        const cv = sortAttr ? token.s : token.k;
        let cmp = compareValues(ev, cv);
        if (cmp === 0) cmp = compareValues(e.key, token.k);
        return (sortDir === 'DESC' ? -cmp : cmp) > 0;
      });
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
      cursor: hasMore
        ? encodeCursor({
            k: page[page.length - 1].key,
            ...(sortAttr ? { s: getAttributeValue(page[page.length - 1], sortAttr) } : {}),
          })
        : undefined,
    });
  }

  // ── HTTP Handlers: Batch & Transaction ──────────────────────────────

  /**
   * HTTP handler for /api/v1/batch/{set,get,delete}. Delegates to the
   * direct batch methods so validation (KVS-038..043) is identical on
   * both surfaces. Whole-batch validation failures → 400 with the
   * KVSQueryError code; per-item failures land in failedKeys with 200.
   */
  private async handleBatch(
    op: 'batchSet' | 'batchGet' | 'batchDelete',
    body: any[] | { items?: any[] } | any,
  ): Promise<FetchLikeResponse> {
    const items: any[] = Array.isArray(body) ? body : (body.items ?? body);
    try {
      const result = await this[op](items);
      return jsonResponse(200, result);
    } catch (err: any) {
      if (err instanceof KVSQueryError) {
        return jsonResponse(400, { code: err.code, message: err.message });
      }
      throw err;
    }
  }

  private async handleTransaction(body: any): Promise<FetchLikeResponse> {
    // Legacy dev-tools format: { actions: [{ type, key, value, entityName? }] }
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
      return emptyResponse(200);
    }

    // New-style transaction format — the wire shape real @forge/kvs
    // TransactionBuilder POSTs to /api/v1/transaction: { set?, delete?, check? }.
    // Routed through executeTransaction so HTTP callers get the same
    // ENT-030 atomicity + ENT-031 limits as the direct API.
    try {
      await this.executeTransaction(body as TransactionRequest);
      return emptyResponse(200);
    } catch (err: any) {
      if (err instanceof KVSQueryError) {
        return jsonResponse(400, { code: err.code, message: err.message });
      }
      throw err;
    }
  }

  // ── Schema Management ───────────────────────────────────────────────

  registerEntitySchema(entityName: string, schema: EntitySchema): void {
    this.entitySchemas.set(entityName, schema);
  }

  getEntitySchemas(): Map<string, EntitySchema> {
    return new Map(this.entitySchemas);
  }

  // ── Introspection ───────────────────────────────────────────────────

  /** Dump plain KVS as raw values (backward compat with SimulatedKVS.dump()) */
  dump(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [k, v] of this.store) {
      result[k] = detach(v.value);
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
    for (const [k, v] of this.store) result[k] = detach(v.value);
    return result;
  }

  /** Get all entity entries grouped by entity name */
  dumpEntities(): Record<string, { entityName: string; key: string; value: any }[]> {
    const result: Record<string, { entityName: string; key: string; value: any }[]> = {};
    for (const entry of this.entities.values()) {
      const name = entry.entityName!;
      if (!result[name]) result[name] = [];
      result[name].push({ entityName: name, key: entry.key, value: detach(entry.value) });
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

/**
 * Error shape for KVS query validation failures. Real @forge/kvs surfaces
 * these as rejected promises whose message carries a stable error code
 * (e.g. QUERY_WHERE_INVALID, LIST_QUERY_LIMIT_EXCEEDED). We expose the
 * code both as `.code` and in the message so either matching style works.
 */
export class KVSQueryError extends Error {
  constructor(public readonly code: string, detail: string) {
    super(`${code}: ${detail}`);
    this.name = 'KVSQueryError';
  }
}

// ── Cursor tokens (eval-8 E8-1) ───────────────────────────────────────
//
// Real Forge cursors are opaque tokens "derived from underlying storage
// identifiers" (Atlassian docs: not stable, must not be persisted). The sim
// used to hand back the raw last-row key and resume via findIndex — which
// silently RESTARTED pagination from page 1 whenever the cursor row was
// deleted between pages (or the cursor was garbage). A fetch→process→delete
// worker would re-receive already-processed rows forever.
//
// Fix: cursors are opaque base64url tokens encoding the last row's position
// ({k: key, s?: sortValue}); resume is POSITIONAL — the next page starts at
// the first row strictly after that position in the query's sort order,
// like a Dynamo exclusive-start-key. Deleted cursor rows resume correctly;
// undecodable cursors fail loudly instead of silently restarting.

interface CursorToken { k: string; s?: unknown }

function encodeCursor(token: CursorToken): string {
  return Buffer.from(JSON.stringify(token), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string, source: string): CursorToken {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (parsed && typeof parsed === 'object' && typeof parsed.k === 'string') {
      return parsed as CursorToken;
    }
  } catch {
    // fall through to the error below
  }
  throw new KVSQueryError(
    'CURSOR_INVALID',
    `Unrecognized cursor passed to ${source}. Cursors are opaque tokens — ` +
    `pass back the exact cursor/nextCursor value returned by the previous ` +
    `page; never construct or persist one yourself.`
  );
}

/** Comparison mirroring the query sort comparators (relational operators). */
function compareValues(a: unknown, b: unknown): number {
  return (a as any) < (b as any) ? -1 : (a as any) > (b as any) ? 1 : 0;
}

/**
 * Resolve an index definition, enforcing INDEX_NOT_FOUND parity (eval-4 F4,
 * eval-7 F2). Real Forge rejects queries against undeclared indexes — silently
 * returning empty/unscoped results makes a typo'd index name indistinguishable
 * from "no data" (or worse, returns ALL entities unscoped).
 *
 * Shared by BOTH query surfaces — the entity query builder (`getMany()`) and
 * the wire handler (`/api/v1/entity/query`) — so validation cannot drift
 * between them again. Only enforced when a schema is registered (manifest
 * `app.storage.entities` or `registerEntitySchema`); schema-less test setups
 * keep working.
 */
function resolveIndexDefOrThrow(
  schemas: Map<string, EntitySchema>,
  entityName: string,
  indexName: string | undefined,
): IndexDefinition | undefined {
  const schema = schemas.get(entityName);
  const indexDef = indexName !== undefined
    ? schema?.indexes.find(i => i.name === indexName)
    : undefined;
  if (indexName !== undefined && schema && !indexDef) {
    const known = schema.indexes.map(i => i.name);
    throw new KVSQueryError(
      'INDEX_NOT_FOUND',
      `Entity "${entityName}" has no index named "${indexName}". ` +
      (known.length
        ? `Declared indexes: ${known.join(', ')}.`
        : 'No indexes are declared for this entity.') +
      ' Real Forge rejects queries on undeclared indexes.'
    );
  }
  return indexDef;
}

/** Forge KVS query page-size defaults (spec KVS-025/KVS-026, ENT-025). */
const KVS_QUERY_DEFAULT_LIMIT = 10;
const KVS_QUERY_MAX_LIMIT = 100;

export class KVSQueryBuilder {
  private conditions: Array<{
    field: string;
    condition: string;
    value: string;
  }> = [];
  private _limit = KVS_QUERY_DEFAULT_LIMIT;
  private _cursor?: string;
  private _sortDirection: 'ASC' | 'DESC' = 'ASC';

  constructor(private store: Map<string, StoredEntry>) {}

  where(
    field: 'key',
    condition: { condition: string; values: any[] }
  ): this {
    // Real @forge/kvs declares `WhereClause = BeginsWithClause` for simple
    // KVS queries — runtime-validate to match. Other comparisons belong on
    // entity-store indexes (kvs.entity('Name').query()).
    if (!condition || typeof condition !== 'object' || !('condition' in condition)) {
      throw new Error(
        `kvs.query().where('key', clause) requires a clause from WhereConditions ` +
        `(e.g. WhereConditions.beginsWith('prefix')). Got: ${JSON.stringify(condition)}`
      );
    }
    if (condition.condition !== 'BEGINS_WITH') {
      throw new Error(
        `kvs.query().where('key', ...) only supports WhereConditions.beginsWith. ` +
        `Got: ${condition.condition}. For other comparisons use ` +
        `kvs.entity('Name').query() against an index instead.`
      );
    }
    this.conditions.push({ field, condition: 'BEGINS_WITH', value: condition.values[0] });
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
    // Parity: real KVS allows exactly one where clause (KVS-024) and caps
    // page size at 100 (KVS-026). Both reject at execution time.
    if (this.conditions.length > 1) {
      throw new KVSQueryError(
        'QUERY_WHERE_INVALID',
        `Only one where clause is supported per query; got ${this.conditions.length}.`
      );
    }
    if (this._limit > KVS_QUERY_MAX_LIMIT) {
      throw new KVSQueryError(
        'LIST_QUERY_LIMIT_EXCEEDED',
        `limit(${this._limit}) exceeds the maximum page size of ${KVS_QUERY_MAX_LIMIT}.`
      );
    }

    let keys = [...this.store.keys()];

    for (const cond of this.conditions) {
      if (cond.condition === 'BEGINS_WITH') {
        keys = keys.filter((k) => k.startsWith(cond.value));
      }
      // No other conditions are valid here — `where()` already rejected
      // them. Defensive default: drop unknown conditions silently rather
      // than throwing from getMany() (which would hide where the bad
      // input came from).
    }

    keys.sort();
    if (this._sortDirection === 'DESC') {
      keys.reverse();
    }

    if (this._cursor) {
      // Positional resume (eval-8 E8-1): first key strictly after the
      // cursor position in the current sort direction — survives deletion
      // of the cursor row. Same code-unit ordering as keys.sort() above.
      const token = decodeCursor(this._cursor, 'kvs.query()');
      keys = keys.filter((k) => {
        const cmp = compareValues(k, token.k);
        return (this._sortDirection === 'DESC' ? -cmp : cmp) > 0;
      });
    }

    const page = keys.slice(0, this._limit);
    const results: StorageEntry[] = page.map((key) => ({
      key,
      value: detach(this.store.get(key)!.value),
    }));

    return {
      results,
      nextCursor: keys.length > this._limit ? encodeCursor({ k: page[page.length - 1] }) : undefined,
    };
  }

  async getOne(): Promise<StorageEntry | undefined> {
    this._limit = 1;
    const { results } = await this.getMany();
    return results[0];
  }
}

// ── Condition helpers (re-exported for @forge/kvs API compat) ─────────
//
// Canonical clause shape, matching real @forge/kvs:
//   { condition: 'SCREAMING_SNAKE', values: [...] }
//
// Tests can also import these from 'forge-sim' directly; the shim at
// src/shims/forge-kvs.ts exposes the identical helpers as `@forge/kvs`
// for app code running through the loader.

export const WhereConditions = {
  beginsWith: (value: string | number) => ({ condition: 'BEGINS_WITH', values: [value] }),
  between: <T extends string | number>(first: T, second: T) => ({ condition: 'BETWEEN', values: [first, second] }),
  equalTo: (value: string | number | boolean) => ({ condition: 'EQUAL_TO', values: [value] }),
  greaterThan: (value: string | number) => ({ condition: 'GREATER_THAN', values: [value] }),
  greaterThanEqualTo: (value: string | number) => ({ condition: 'GREATER_THAN_EQUAL_TO', values: [value] }),
  lessThan: (value: string | number) => ({ condition: 'LESS_THAN', values: [value] }),
  lessThanEqualTo: (value: string | number) => ({ condition: 'LESS_THAN_EQUAL_TO', values: [value] }),
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
  private _limit = KVS_QUERY_DEFAULT_LIMIT;

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
    // Parity: entity query page limit must be 1–100 (ENT-025).
    if (this._limit < 1 || this._limit > KVS_QUERY_MAX_LIMIT) {
      throw new KVSQueryError(
        'COMPLEX_QUERY_PAGE_LIMIT_NOT_IN_RANGE',
        `limit(${this._limit}) is out of range; page limit must be between 1 and ${KVS_QUERY_MAX_LIMIT}.`
      );
    }

    // Get all entities for this entity name
    let entries = [...this.entities.values()].filter(e => e.entityName === this.entityName);

    // Look up index definition — throws INDEX_NOT_FOUND on undeclared indexes
    // when a schema is registered (shared with the wire path, eval-4 F4 / eval-7 F2).
    const indexDef = resolveIndexDefOrThrow(this.schemas, this.entityName, this._indexName);

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

    // Sort — deterministic: range attribute first (when the index declares
    // one), then key as tiebreak so cursor positions are total-ordered.
    const sortAttr = indexDef?.range;
    entries.sort((a, b) => {
      const va = sortAttr ? a.value?.[sortAttr] : a.key;
      const vb = sortAttr ? b.value?.[sortAttr] : b.key;
      let cmp = compareValues(va, vb);
      if (cmp === 0) cmp = compareValues(a.key, b.key);
      return this._sort === 'DESC' ? -cmp : cmp;
    });

    // Cursor — positional resume (eval-8 E8-1): the next page starts
    // strictly after the cursor's (sortValue, key) position, so deleting
    // the cursor row between pages cannot restart pagination from page 1.
    if (this._cursor) {
      const token = decodeCursor(this._cursor, "entity('...').query()");
      entries = entries.filter(e => {
        const ev = sortAttr ? e.value?.[sortAttr] : e.key;
        const cv = sortAttr ? token.s : token.k;
        let cmp = compareValues(ev, cv);
        if (cmp === 0) cmp = compareValues(e.key, token.k);
        return (this._sort === 'DESC' ? -cmp : cmp) > 0;
      });
    }

    // Limit
    const page = entries.slice(0, this._limit);
    const hasMore = entries.length > this._limit;

    return {
      results: page.map(e => ({ key: e.key, value: detach(e.value) })),
      nextCursor: hasMore
        ? encodeCursor({
            k: page[page.length - 1].key,
            ...(sortAttr ? { s: page[page.length - 1].value?.[sortAttr] } : {}),
          })
        : undefined,
    };
  }

  async getOne(): Promise<{ key: string; value: any } | undefined> {
    this._limit = 1;
    const { results } = await this.getMany();
    return results[0];
  }
}

// ── Error classes (parity with real @forge/kvs errors.js) ─────────────

/** Base error class matching real @forge/kvs `ForgeKvsError`. */
export class ForgeKvsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForgeKvsError';
  }
}

/**
 * API error matching real @forge/kvs `ForgeKvsAPIError` exactly:
 *   new ForgeKvsAPIError({ status, statusText, traceId }, { code, message, context?, ...bodyData })
 *
 * QUIRK mirrored from the shipped package: the constructor never sets
 * `this.name`, so the name stays 'ForgeKvsError' (inherited). Parity
 * over prettiness — apps matching on `err.name` see the same string
 * in the sim as in prod.
 */
export class ForgeKvsAPIError extends ForgeKvsError {
  responseDetails: { status: number; statusText: string; traceId?: string | null };
  code: string;
  context: Record<string, any>;

  constructor(
    responseDetails: { status: number; statusText: string; traceId?: string | null },
    forgeError: { code: string; message: string; context?: Record<string, any>; [key: string]: any },
  ) {
    super(forgeError.message);
    const { status, statusText, traceId } = responseDetails;
    this.responseDetails = { status, statusText, traceId };
    const { code, message, context, ...bodyData } = forgeError;
    this.code = code;
    this.message = message;
    this.context = { ...context, ...bodyData };
  }
}

// ── Transaction Builder ───────────────────────────────────────────────
//
// Mirrors real @forge/kvs TransactionBuilderImpl (out/transaction-api.js):
//   kvs.transact()
//     .set(key, value, entity?, options?)   // entity: { entityName, conditions? }
//     .delete(key, entity?)
//     .check(key, { entityName, conditions })
//     .execute()
// execute() builds the wire request { set?, delete?, check? } (the shape
// real Forge POSTs to /api/v1/transaction) and hands it to
// UnifiedKVS.executeTransaction.

/** ENT-031: transaction limits (enforced server-side in real Forge). */
const TRANSACTION_MAX_OPERATIONS = 25;
const TRANSACTION_MAX_PAYLOAD_BYTES = 4 * 1024 * 1024;

export interface TransactionConditionsWire {
  and?: FilterItem[];
  or?: FilterItem[];
}

/** Wire shape POSTed to /api/v1/transaction by the real client. */
export interface TransactionRequest {
  set?: Array<{
    key: string;
    value: any;
    entityName?: string;
    conditions?: TransactionConditionsWire;
    options?: { ttl?: { value: number; unit: string } };
  }>;
  delete?: Array<{ key: string; entityName?: string; conditions?: TransactionConditionsWire }>;
  check?: Array<{ key: string; entityName?: string; conditions?: TransactionConditionsWire }>;
}

/** A Filter builder as passed to entity refs (matches real FilterBuilder). */
interface ConditionsFilter {
  filters(): FilterItem[];
  operator(): string;
}

interface TransactionEntityRef {
  entityName?: string;
  conditions?: ConditionsFilter;
}

/**
 * Mirror of real buildConditionsRequest (out/utils/transaction-request-builder.js).
 * This empty-Filter throw is the ONLY client-side validation the shipped
 * package performs — everything else (op count, unique keys, payload size)
 * is server-side, i.e. executeTransaction here.
 */
export function buildConditionsRequest(filter?: ConditionsFilter): TransactionConditionsWire | undefined {
  if (!filter) return undefined;
  if (filter.filters().length === 0) {
    throw new ForgeKvsError('Builder must have at least one condition set');
  }
  return { [filter.operator()]: filter.filters() } as TransactionConditionsWire;
}

/** Real client emits `undefined` (not `[]`) for empty op groups. */
function undefineEmptyArray<T>(arr: T[]): T[] | undefined {
  return arr.length === 0 ? undefined : arr;
}

export class TransactionBuilder {
  private sets: Array<{ key: string; value: any; entity?: TransactionEntityRef; options?: { ttl?: any } }> = [];
  private deletes: Array<{ key: string; entity?: TransactionEntityRef }> = [];
  private checks: Array<{ key: string; entity: TransactionEntityRef }> = [];

  constructor(private kvs: UnifiedKVS) {}

  /**
   * NOTE (docs-vs-client quirk, mirrored deliberately): the KVS
   * transactions doc shows `set(key, value, options?)` with ttl as the
   * 3rd arg — but the SHIPPED client's 3rd param is `entity`. Passing
   * `{ ttl }` 3rd produces `entity: { entityName: undefined,
   * conditions: undefined }` and the ttl never reaches the wire. We
   * mirror the shipped client because that's what apps run in prod.
   */
  set(key: string, value: any, entity?: TransactionEntityRef, options?: { ttl?: any }): this {
    const op: { key: string; value: any; entity?: TransactionEntityRef; options?: { ttl?: any } } = { key, value };
    if (entity) op.entity = { entityName: entity.entityName, conditions: entity.conditions };
    if (options) op.options = options;
    this.sets.push(op);
    return this;
  }

  delete(key: string, entity?: TransactionEntityRef): this {
    const op: { key: string; entity?: TransactionEntityRef } = { key };
    if (entity) op.entity = { entityName: entity.entityName, conditions: entity.conditions };
    this.deletes.push(op);
    return this;
  }

  check(key: string, entity: TransactionEntityRef): this {
    this.checks.push({ key, entity: { entityName: entity.entityName, conditions: entity.conditions } });
    return this;
  }

  async execute(): Promise<void> {
    const request: TransactionRequest = {
      set: undefineEmptyArray(this.sets.map((op) => ({
        key: op.key,
        value: op.value,
        entityName: op.entity?.entityName,
        conditions: buildConditionsRequest(op.entity?.conditions),
        options: op.options,
      }))),
      delete: undefineEmptyArray(this.deletes.map((op) => ({
        key: op.key,
        entityName: op.entity?.entityName,
        conditions: buildConditionsRequest(op.entity?.conditions),
      }))),
      check: undefineEmptyArray(this.checks.map((op) => ({
        key: op.key,
        entityName: op.entity?.entityName,
        conditions: buildConditionsRequest(op.entity?.conditions),
      }))),
    };
    return this.kvs.executeTransaction(request);
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

// ── Key/Value Validation (batch ops) ──────────────────────────────────
//
// Spec KVS-016..021: key regex, key length, value size, value depth.
// Used by the batch ops for per-item failedKeys entries. (Single-op
// set/get deliberately don't enforce these yet — behavioral-gap bucket.)

/** Forge KVS key regex (spec KVS-016, storage-reference/handling-errors-kvs). */
const KVS_KEY_REGEX = /^(?!\s+$)[a-zA-Z0-9:._\s\-#]+$/;
const KVS_KEY_MAX_LENGTH = 500;
/** Max serialized value size: 240 KiB (current limits page). */
const KVS_VALUE_MAX_BYTES = 240 * 1024;
/** Max object nesting depth: 31 levels. */
const KVS_VALUE_MAX_DEPTH = 31;

function validateKvsKey(key: unknown): { code: string; message: string } | null {
  if (typeof key !== 'string' || key.length === 0) {
    return { code: 'KEY_TOO_SHORT', message: 'Key must be at least 1 character' };
  }
  if (key.length > KVS_KEY_MAX_LENGTH) {
    return { code: 'KEY_TOO_LONG', message: `Key exceeds ${KVS_KEY_MAX_LENGTH} characters` };
  }
  if (!KVS_KEY_REGEX.test(key)) {
    return { code: 'INVALID_KEY', message: `Key "${key}" does not match ${KVS_KEY_REGEX}` };
  }
  return null;
}

function objectDepth(value: any, depth = 1): number {
  if (value === null || typeof value !== 'object') return depth;
  let max = depth;
  for (const v of Object.values(value)) {
    if (v !== null && typeof v === 'object') {
      max = Math.max(max, objectDepth(v, depth + 1));
      if (max > KVS_VALUE_MAX_DEPTH) return max; // early exit
    }
  }
  return max;
}

function validateKvsValue(value: any): { code: string; message: string } | null {
  const bytes = Buffer.byteLength(JSON.stringify(value), 'utf-8');
  if (bytes > KVS_VALUE_MAX_BYTES) {
    return { code: 'MAX_SIZE', message: `Serialized value is ${bytes} bytes; maximum is ${KVS_VALUE_MAX_BYTES} (240 KiB)` };
  }
  if (objectDepth(value) > KVS_VALUE_MAX_DEPTH) {
    return { code: 'MAX_DEPTH', message: `Value exceeds maximum object depth of ${KVS_VALUE_MAX_DEPTH} levels` };
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
    // Fresh copy per call — never hand out a reference that aliases
    // internal storage (see detach() above). Matches real fetch semantics
    // where json() yields data decoded from the wire, not live objects.
    json: async () => JSON.parse(bodyStr),
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
