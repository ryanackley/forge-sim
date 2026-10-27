/**
 * The real `@forge/kvs` and the direct `sim.kvs` API are two doors onto one
 * store, and the rules must be the same at both. The real package validates
 * nothing client-side (node_modules/@forge/kvs/out/storage-api.js) and passes
 * `limit` straight through (out/query.js), so whatever the wire handler
 * accepts, a deployed app can write. These tests drive the REAL package
 * through `global.__forge_fetch__` (installed by `createSimulator()`) and
 * assert it is refused — with the same Forge error code — exactly where the
 * direct API refuses.
 *
 * Codes: storage-reference/kvs-errorhandling, entities-errorhandling.
 * Limits: limits-kvs-ce (500-char keys, 240 KiB values, depth 31, pages 1-100).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kvs, WhereConditions, MetadataField } from '@forge/kvs';
import { createSimulator, type ForgeSimulator } from '../index.js';
import { buildEntityQueryWireBody } from '../mcp-entity-query.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

let sim: ForgeSimulator;

beforeEach(() => {
  sim = createSimulator();
  sim.kvs.registerEntitySchema('task', {
    attributes: { status: { type: 'string' }, n: { type: 'integer' } },
    indexes: [{ name: 'by-status', partition: ['status'], range: 'n' }],
  });
});

/** Code the real package surfaces (`ForgeKvsAPIError.code`) for a rejected call. */
async function realCode(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err: any) {
    return err.code;
  }
  throw new Error('expected the real package to reject');
}

/** Code the direct API throws (`KVSQueryError.code`). */
async function directCode(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err: any) {
    return err.code;
  }
  throw new Error('expected the direct API to reject');
}

function nested(depth: number): any {
  let v: any = { leaf: true };
  for (let i = 1; i < depth; i++) v = { v };
  return v;
}

const BAD_WRITES: Array<[string, string, any]> = [
  // [expected code, key, value]
  ['INVALID_KEY', 'bad/slash', 1],
  ['INVALID_KEY', 'bad key!', 1],
  ['KEY_TOO_LONG', 'k'.repeat(501), 1],
  ['KEY_TOO_SHORT', '', 1],
  ['INVALID_VALUE', 'nul', null],
  ['MAX_SIZE', 'big', 'x'.repeat(250 * 1024)],
  ['MAX_DEPTH', 'deep', nested(33)],
];

describe('single writes — the real package is refused where the direct API is', () => {
  it.each(BAD_WRITES)('%s: kvs.set(%j)', async (code, key, value) => {
    expect(await realCode(kvs.set(key, value))).toBe(code);
    expect(await directCode(sim.kvs.set(key, value))).toBe(code);
    expect(sim.kvs.size).toBe(0);
  });

  it.each(BAD_WRITES)('%s: kvs.setSecret(%j)', async (code, key, value) => {
    expect(await realCode(kvs.setSecret(key, value))).toBe(code);
    expect(await directCode(sim.kvs.setSecret(key, value))).toBe(code);
    expect(sim.kvs.secretSize).toBe(0);
  });

  it.each(BAD_WRITES.filter(([code]) => code !== 'INVALID_VALUE'))(
    '%s: kvs.entity().set(%j)',
    async (code, key, value) => {
      // Custom Entities name the empty-key case differently (entities-errorhandling).
      const expected = code === 'KEY_TOO_SHORT' ? 'EMPTY_KEY' : code;
      const v = typeof value === 'object' || typeof value === 'string' ? { status: value } : { status: 'x' };
      expect(await realCode(kvs.entity('task').set(key, v))).toBe(expected);
      expect(await directCode(sim.kvs.entity('task').set(key, v))).toBe(expected);
      expect(sim.kvs.entitySize).toBe(0);
    },
  );

  it('a good write still lands, and nothing invalid reaches the store', async () => {
    await kvs.set('good:1', { ok: true });
    await kvs.entity('task').set('t-1', { status: 'open', n: 1 });
    expect(await sim.kvs.get('good:1')).toEqual({ ok: true });
    expect(await sim.kvs.entity('task').get('t-1')).toEqual({ status: 'open', n: 1 });
  });
});

describe('write options — keyPolicy, returnValue and ttl behave the same at both doors', () => {
  it('FAIL_IF_EXISTS is KEY_ALREADY_EXISTS on both', async () => {
    await kvs.set('once', 1);
    expect(await realCode(kvs.set('once', 2, { keyPolicy: 'FAIL_IF_EXISTS' }))).toBe('KEY_ALREADY_EXISTS');
    expect(await directCode(sim.kvs.set('once', 2, { keyPolicy: 'FAIL_IF_EXISTS' }))).toBe('KEY_ALREADY_EXISTS');
    expect(await sim.kvs.get('once')).toBe(1);
  });

  it('returnValue PREVIOUS hands back the overwritten entry on both', async () => {
    await kvs.set('rv', 'old');
    const viaReal: any = await kvs.set('rv', 'new', { keyPolicy: 'OVERRIDE', returnValue: 'PREVIOUS' });
    expect(viaReal.value).toBe('old');
    const viaDirect: any = await sim.kvs.set('rv', 'newer', { keyPolicy: 'OVERRIDE', returnValue: 'PREVIOUS' });
    expect(viaDirect.value).toBe('new');
    expect(await sim.kvs.get('rv')).toBe('newer');
  });

  it('ttl sets expireTime through the direct entity API too', async () => {
    await sim.kvs.entity('task').set('ttl', { status: 'open', n: 1 }, { ttl: { value: 1, unit: 'HOURS' } });
    const got: any = await kvs.entity('task').get('ttl', { metadataFields: [MetadataField.EXPIRE_TIME] });
    expect(typeof got.expireTime).toBe('string');
    expect(Date.parse(got.expireTime)).toBeGreaterThan(Date.now() + 59 * 60 * 1000);
  });
});

describe('batch and transaction items use the same validators', () => {
  it('batchSet reports the per-item code, with EMPTY_KEY for an empty entity key', async () => {
    const res = await kvs.batchSet([
      { key: 'bad/slash', value: 1 },
      { key: '', value: { status: 'x' }, entityName: 'task' },
      { key: 'fine', value: 1 },
    ]);
    expect(res.failedKeys.map((f) => f.error.code)).toEqual(['INVALID_KEY', 'EMPTY_KEY']);
    expect(res.successfulKeys.map((s) => s.key)).toEqual(['fine']);
  });

  it('a transaction with one bad key or oversized value writes nothing', async () => {
    expect(await realCode(kvs.transact().set('ok:1', 1).set('bad/slash', 2).execute())).toBe('INVALID_KEY');
    expect(await realCode(kvs.transact().set('ok:1', 1).set('big', 'x'.repeat(250 * 1024)).execute())).toBe('MAX_SIZE');
    expect(sim.kvs.size).toBe(0);
  });

  it('the pre-@forge/kvs { actions } transaction body is refused', async () => {
    const res = await sim.kvs.handleRequest('/api/v1/transaction', {
      body: JSON.stringify({ actions: [{ type: 'set', key: 'legacy', value: 1 }] }),
    });
    expect(res.status).toBe(400);
    expect(sim.kvs.size).toBe(0);
  });
});

describe('queries — one page-size rule and one key order on every surface', () => {
  const KEYS = ['b:2', 'a:10', 'A:1', 'a:2', 'B:1', ...Array.from({ length: 25 }, (_, i) => `k:${String(i).padStart(2, '0')}`)];

  beforeEach(async () => {
    for (const k of KEYS) await sim.kvs.set(k, k);
  });

  it('kvs.query() defaults to 10 on both doors', async () => {
    const viaReal = await kvs.query().getMany();
    const viaDirect = await sim.kvs.query().getMany();
    expect(viaReal.results).toHaveLength(10);
    expect(viaReal.nextCursor).toBeDefined();
    expect(viaDirect.results).toHaveLength(10);
  });

  it('kvs.query() pages come back in the same key order from both doors', async () => {
    const viaReal = await kvs.query().limit(100).getMany();
    const viaDirect = await sim.kvs.query().limit(100).getMany();
    expect(viaReal.results.map((r) => r.key)).toEqual(viaDirect.results.map((r) => r.key));
    // Code-unit order: uppercase before lowercase, as kvs.query() always sorted.
    expect(viaReal.results.map((r) => r.key).slice(0, 3)).toEqual(['A:1', 'B:1', 'a:10']);
  });

  it('kvs.query() pages agree through a cursor', async () => {
    const r1 = await kvs.query().where('key', WhereConditions.beginsWith('k:')).limit(7).getMany();
    const d1 = await sim.kvs.query().where('key', WhereConditions.beginsWith('k:')).limit(7).getMany();
    const r2 = await kvs.query().where('key', WhereConditions.beginsWith('k:')).limit(7).cursor(r1.nextCursor!).getMany();
    const d2 = await sim.kvs.query().where('key', WhereConditions.beginsWith('k:')).limit(7).cursor(d1.nextCursor!).getMany();
    expect(r2.results.map((r) => r.key)).toEqual(d2.results.map((r) => r.key));
    expect(r2.results[0].key).toBe('k:07');
  });

  it.each([[500], [101], [0], [-1], [1.5]])('kvs.query().limit(%s) is LIST_QUERY_LIMIT_EXCEEDED on both', async (n) => {
    expect(await realCode(kvs.query().limit(n).getMany())).toBe('LIST_QUERY_LIMIT_EXCEEDED');
    expect(await directCode(sim.kvs.query().limit(n).getMany())).toBe('LIST_QUERY_LIMIT_EXCEEDED');
  });

  it('kvs.query().limit(100) is the ceiling, not an error', async () => {
    const page = await kvs.query().limit(100).getMany();
    expect(page.results).toHaveLength(KEYS.length);
    expect(page.nextCursor).toBeUndefined();
  });
});

describe('entity queries — page-size rule on both doors', () => {
  beforeEach(async () => {
    for (let i = 0; i < 15; i++) await sim.kvs.entity('task').set(`t-${i}`, { status: 'open', n: i });
  });

  it('defaults to 10', async () => {
    const viaReal = await kvs.entity('task').query().index('by-status', { partition: ['open'] }).getMany();
    expect(viaReal.results).toHaveLength(10);
    expect(viaReal.nextCursor).toBeDefined();
  });

  it.each([[0], [-1], [101], [2.5]])(
    'limit(%s) is COMPLEX_QUERY_PAGE_LIMIT_NOT_IN_RANGE, never a 500',
    async (n) => {
      const q = () => kvs.entity('task').query().index('by-status', { partition: ['open'] }).limit(n).getMany();
      expect(await realCode(q())).toBe('COMPLEX_QUERY_PAGE_LIMIT_NOT_IN_RANGE');
      const d = () => sim.kvs.entity('task').query().index('by-status', { partition: ['open'] }).limit(n).getMany();
      expect(await directCode(d())).toBe('COMPLEX_QUERY_PAGE_LIMIT_NOT_IN_RANGE');
    },
  );
});

describe('the MCP tools go through the validated surface', () => {
  const mcpSource = readFileSync(resolve(REPO, 'src/mcp-server.ts'), 'utf-8');

  it('forge_entity_set writes through sim.kvs.entity().set(), not a hand-built wire body', () => {
    const tool = mcpSource.slice(mcpSource.indexOf("'forge_entity_set'"), mcpSource.indexOf("'forge_entity_delete'"));
    expect(tool).toContain('sim.kvs.entity(entityName).set(key, value, {');
    expect(tool).not.toContain("handleRequest('/api/v1/entity/set'");
    // TTL is forwarded in the real package's shape, not dropped.
    expect(tool).toContain("ttl: { value: options.ttlSeconds, unit: 'SECONDS'");
  });

  it('forge_entity_query passes limit through untouched, including 0', () => {
    const body = buildEntityQueryWireBody({ entityName: 'task', indexName: 'by-status', partition: ['open'], limit: 0 });
    expect(body.limit).toBe(0);
    const tool = mcpSource.slice(mcpSource.indexOf("'forge_entity_query'"), mcpSource.indexOf("'forge_entity_list'"));
    expect(tool).toContain('default: 10');
    expect(tool).not.toContain('default: 20');
  });

  it('forge_kvs_list and the tools API list keys in the same order as kvs.query()', () => {
    const list = mcpSource.slice(mcpSource.indexOf("'forge_kvs_list'"), mcpSource.indexOf("'forge_kvs_set'"));
    expect(list).toContain('Object.keys(dump).sort()');
    const toolsApi = readFileSync(resolve(REPO, 'src/tools/api.ts'), 'utf-8');
    expect(toolsApi).toContain('Object.keys(dump)\n          .sort()');
  });

  it('the direct entity write the tools API uses accepts the real set options', async () => {
    await sim.kvs.entity('task').set('t-1', { status: 'open', n: 1 });
    expect(await directCode(sim.kvs.entity('task').set('t-1', { status: 'open', n: 2 }, { keyPolicy: 'FAIL_IF_EXISTS' })))
      .toBe('KEY_ALREADY_EXISTS');
  });
});

describe('the wire reports Forge-shaped errors', () => {
  it('400 with { code, message } and no code prefix in the message', async () => {
    const res = await sim.kvs.handleRequest('/api/v1/set', { body: JSON.stringify({ key: 'bad/slash', value: 1 }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('INVALID_KEY');
    expect(body.message).not.toMatch(/^INVALID_KEY:/);
  });

  it('409 for KEY_ALREADY_EXISTS on entities as on plain keys', async () => {
    await sim.kvs.entity('task').set('t-1', { status: 'open', n: 1 });
    const res = await sim.kvs.handleRequest('/api/v1/entity/set', {
      body: JSON.stringify({ entityName: 'task', key: 't-1', value: { status: 'x', n: 2 }, options: { keyPolicy: 'FAIL_IF_EXISTS' } }),
    });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('KEY_ALREADY_EXISTS');
  });
});
