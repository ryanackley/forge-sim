/**
 * Regression tests for the eval-8 findings cluster (adversarial cold-install
 * eval against the published 0.1.7 package, 2026-07-18 — "Evidence Locker").
 *
 * E8-1 (HIGH) — cursor pagination used to resume via findIndex on the raw
 *        last-row key. If the cursor row was deleted between pages (or the
 *        cursor was garbage), the lookup missed and pagination silently
 *        RESTARTED from page 1 — a fetch→process→delete worker re-receives
 *        already-processed rows forever (infinite-loop hazard). Real Forge
 *        cursors are opaque positional tokens (Dynamo exclusive-start-key
 *        semantics). Now: opaque base64url {k, s?} tokens, positional
 *        resume with deterministic key tiebreak, loud CURSOR_INVALID on
 *        undecodable cursors. All four paths: entity builder, entity wire,
 *        plain-KVS builder, plain-KVS wire.
 *
 * E8-3 (MEDIUM) — partition keys were prefix-matched, not exact-matched.
 *        A 1-of-2 partition value on a 2-attribute partition index matched
 *        BOTH categories; excess values were silently ignored; an empty or
 *        omitted partition returned every row in the entity. Real Forge
 *        requires the full partition key. Now: exact arity enforced via
 *        QUERY_PARTITION_INVALID whenever the index definition is known
 *        (schema registered); schema-less setups stay permissive.
 *
 * E8-2 (MEDIUM) — `.where()` without `.index()` was silently ignored and
 *        index-less entity queries returned the full table. The real
 *        @forge/kvs client is two-stage: `entity('X').query()` returns a
 *        builder whose ONLY operation is `.index(name, opts)` — where/
 *        filters/sort/cursor/limit/getOne/getMany exist only on the
 *        builder `.index()` returns, so an index-less entity query is
 *        structurally unrepresentable in real Forge. Now: stage-1 builder
 *        stubs throw QUERY_INDEX_REQUIRED (synchronously — that's what
 *        the real client's missing methods would do, minus the useful
 *        message), and the wire path 400s without an indexName.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { UnifiedKVS, WhereConditions } from '../kvs.js';

describe('eval-8 findings', () => {
  let kvs: UnifiedKVS;

  beforeEach(() => {
    kvs = new UnifiedKVS();
  });

  // ── E8-1: positional cursor resume ─────────────────────────────────

  describe('E8-1: cursor survives deletion of the cursor row', () => {
    describe('entity query builder', () => {
      beforeEach(async () => {
        kvs.registerEntitySchema('Evidence', {
          attributes: {
            projectKey: { type: 'string' },
            seq: { type: 'integer' },
          },
          indexes: [
            { name: 'by-project', partition: ['projectKey'] },
            { name: 'by-project-seq', partition: ['projectKey'], range: 'seq' },
          ],
        });
        // The eval's exact seed: P:0..P:2
        await kvs.entity('Evidence').set('P:0', { projectKey: 'P', seq: 0 });
        await kvs.entity('Evidence').set('P:1', { projectKey: 'P', seq: 1 });
        await kvs.entity('Evidence').set('P:2', { projectKey: 'P', seq: 2 });
      });

      it('resumes positionally after the deleted cursor row (the eval repro)', async () => {
        const page1 = await kvs.entity('Evidence').query()
          .index('by-project', { partition: ['P'] })
          .limit(2)
          .getMany();
        expect(page1.results.map(r => r.key)).toEqual(['P:0', 'P:1']);
        expect(page1.nextCursor).toBeDefined();

        // Delete-as-you-go worker pattern: cursor row goes away
        await kvs.entity('Evidence').delete('P:1');

        const page2 = await kvs.entity('Evidence').query()
          .index('by-project', { partition: ['P'] })
          .limit(2)
          .cursor(page1.nextCursor!)
          .getMany();

        // Pre-fix: returned ['P:0', 'P:2'] — P:0 re-delivered (restart from
        // page 1). Positional resume must return ONLY what comes after P:1.
        expect(page2.results.map(r => r.key)).toEqual(['P:2']);
        expect(page2.nextCursor).toBeUndefined();
      });

      it('delete-as-you-go terminates instead of looping', async () => {
        // Drain the table page by page, deleting each processed row.
        const seen: string[] = [];
        let cursor: string | undefined;
        for (let guard = 0; guard < 10; guard++) {
          const q = kvs.entity('Evidence').query()
            .index('by-project', { partition: ['P'] })
            .limit(1);
          if (cursor) q.cursor(cursor);
          const page = await q.getMany();
          for (const r of page.results) {
            seen.push(r.key);
            await kvs.entity('Evidence').delete(r.key);
          }
          cursor = page.nextCursor;
          if (!cursor && page.results.length === 0) break;
          if (!cursor) {
            // last page consumed — one more query confirms empty
            continue;
          }
        }
        expect(seen.sort()).toEqual(['P:0', 'P:1', 'P:2']);
      });

      it('garbage cursor fails loudly instead of silently restarting', async () => {
        await expect(
          kvs.entity('Evidence').query()
            .index('by-project', { partition: ['P'] })
            .cursor('P:1') // raw key — the old format, now garbage
            .getMany()
        ).rejects.toThrow(/CURSOR_INVALID/);

        await expect(
          kvs.entity('Evidence').query()
            .index('by-project', { partition: ['P'] })
            .cursor('total nonsense !!!')
            .getMany()
        ).rejects.toThrow(/CURSOR_INVALID/);
      });

      it('resumes by sort position on a range index after cursor-row deletion', async () => {
        const page1 = await kvs.entity('Evidence').query()
          .index('by-project-seq', { partition: ['P'] })
          .sort('ASC')
          .limit(2)
          .getMany();
        expect(page1.results.map(r => r.value.seq)).toEqual([0, 1]);

        await kvs.entity('Evidence').delete('P:1');

        const page2 = await kvs.entity('Evidence').query()
          .index('by-project-seq', { partition: ['P'] })
          .sort('ASC')
          .limit(2)
          .cursor(page1.nextCursor!)
          .getMany();
        expect(page2.results.map(r => r.value.seq)).toEqual([2]);
      });

      it('resumes correctly under DESC sort after cursor-row deletion', async () => {
        const page1 = await kvs.entity('Evidence').query()
          .index('by-project-seq', { partition: ['P'] })
          .sort('DESC')
          .limit(2)
          .getMany();
        expect(page1.results.map(r => r.value.seq)).toEqual([2, 1]);

        await kvs.entity('Evidence').delete('P:1');

        const page2 = await kvs.entity('Evidence').query()
          .index('by-project-seq', { partition: ['P'] })
          .sort('DESC')
          .limit(2)
          .cursor(page1.nextCursor!)
          .getMany();
        expect(page2.results.map(r => r.value.seq)).toEqual([0]);
      });

      it('breaks sort-value ties deterministically by key (no dup/skip across pages)', async () => {
        // Everything shares seq=7 — pre-fix sort was non-deterministic on ties.
        for (const k of ['t:a', 't:b', 't:c', 't:d', 't:e']) {
          await kvs.entity('Evidence').set(k, { projectKey: 'T', seq: 7 });
        }
        const seen: string[] = [];
        let cursor: string | undefined;
        do {
          const q = kvs.entity('Evidence').query()
            .index('by-project-seq', { partition: ['T'] })
            .limit(2);
          if (cursor) q.cursor(cursor);
          const page = await q.getMany();
          seen.push(...page.results.map(r => r.key));
          cursor = page.nextCursor;
        } while (cursor);
        expect(seen).toEqual(['t:a', 't:b', 't:c', 't:d', 't:e']);
      });
    });

    describe('entity query wire path (/api/v1/entity/query)', () => {
      async function wireQuery(body: Record<string, unknown>) {
        const res = await kvs.handleRequest('/api/v1/entity/query', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        return { status: res.status, data: await res.json() };
      }

      beforeEach(async () => {
        kvs.registerEntitySchema('Evidence', {
          attributes: { projectKey: { type: 'string' }, seq: { type: 'integer' } },
          indexes: [{ name: 'by-project', partition: ['projectKey'] }],
        });
        await kvs.entity('Evidence').set('P:0', { projectKey: 'P', seq: 0 });
        await kvs.entity('Evidence').set('P:1', { projectKey: 'P', seq: 1 });
        await kvs.entity('Evidence').set('P:2', { projectKey: 'P', seq: 2 });
      });

      it('resumes positionally after the deleted cursor row', async () => {
        const p1 = await wireQuery({
          entityName: 'Evidence', indexName: 'by-project', partition: ['P'], limit: 2,
        });
        expect(p1.data.data.map((e: any) => e.key)).toEqual(['P:0', 'P:1']);
        expect(p1.data.cursor).toBeDefined();

        await kvs.entity('Evidence').delete('P:1');

        const p2 = await wireQuery({
          entityName: 'Evidence', indexName: 'by-project', partition: ['P'],
          limit: 2, cursor: p1.data.cursor,
        });
        expect(p2.data.data.map((e: any) => e.key)).toEqual(['P:2']);
      });

      it('garbage cursor returns 400 CURSOR_INVALID', async () => {
        const res = await wireQuery({
          entityName: 'Evidence', indexName: 'by-project', partition: ['P'],
          cursor: 'P:1',
        });
        expect(res.status).toBe(400);
        expect(res.data.code).toBe('CURSOR_INVALID');
      });
    });

    describe('plain KVS query builder (kvs.query())', () => {
      beforeEach(async () => {
        await kvs.set('item:a', 1);
        await kvs.set('item:b', 2);
        await kvs.set('item:c', 3);
      });

      it('resumes positionally after the deleted cursor row', async () => {
        const page1 = await kvs.query().limit(2).getMany();
        expect(page1.results.map(r => r.key)).toEqual(['item:a', 'item:b']);

        await kvs.delete('item:b');

        const page2 = await kvs.query().limit(2).cursor(page1.nextCursor!).getMany();
        // Pre-fix: restarted → ['item:a', 'item:c'] with item:a duplicated.
        expect(page2.results.map(r => r.key)).toEqual(['item:c']);
      });

      it('garbage cursor fails loudly', async () => {
        await expect(
          kvs.query().cursor('item:b').getMany()
        ).rejects.toThrow(/CURSOR_INVALID/);
      });

      it('DESC pagination resumes positionally', async () => {
        const page1 = await kvs.query().sort('DESC').limit(2).getMany();
        expect(page1.results.map(r => r.key)).toEqual(['item:c', 'item:b']);

        await kvs.delete('item:b');

        const page2 = await kvs.query().sort('DESC').limit(2).cursor(page1.nextCursor!).getMany();
        expect(page2.results.map(r => r.key)).toEqual(['item:a']);
      });
    });

    describe('plain KVS wire path (/api/v1/query)', () => {
      async function wireQuery(body: Record<string, unknown>) {
        const res = await kvs.handleRequest('/api/v1/query', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        return { status: res.status, data: await res.json() };
      }

      beforeEach(async () => {
        await kvs.set('item:a', 1);
        await kvs.set('item:b', 2);
        await kvs.set('item:c', 3);
      });

      it('resumes positionally after the deleted cursor row', async () => {
        const p1 = await wireQuery({ limit: 2 });
        expect(p1.data.data.map((e: any) => e.key)).toEqual(['item:a', 'item:b']);
        expect(p1.data.cursor).toBeDefined();

        await kvs.delete('item:b');

        const p2 = await wireQuery({ limit: 2, after: p1.data.cursor });
        expect(p2.data.data.map((e: any) => e.key)).toEqual(['item:c']);
      });

      it('garbage cursor returns 400 CURSOR_INVALID', async () => {
        const res = await wireQuery({ limit: 2, after: 'item:b' });
        expect(res.status).toBe(400);
        expect(res.data.code).toBe('CURSOR_INVALID');
      });
    });
  });

  // ── E8-3: exact partition-key arity ────────────────────────────────

  describe('E8-3: exact partition-key enforcement', () => {
    beforeEach(async () => {
      // The eval's exact schema: 2-attribute partition (projectKey, category)
      kvs.registerEntitySchema('Evidence', {
        attributes: {
          projectKey: { type: 'string' },
          category: { type: 'string' },
          seq: { type: 'integer' },
        },
        indexes: [
          { name: 'by-project-category', partition: ['projectKey', 'category'] },
          { name: 'all-by-seq', partition: [], range: 'seq' },
        ],
      });
      await kvs.entity('Evidence').set('P:doc:1', { projectKey: 'P', category: 'doc', seq: 1 });
      await kvs.entity('Evidence').set('P:img:2', { projectKey: 'P', category: 'img', seq: 2 });
      await kvs.entity('Evidence').set('Q:doc:3', { projectKey: 'Q', category: 'doc', seq: 3 });
    });

    describe('entity query builder', () => {
      it('rejects a partial partition key (the eval repro)', async () => {
        // Pre-fix: partition ['P'] prefix-matched BOTH P categories.
        await expect(
          kvs.entity('Evidence').query()
            .index('by-project-category', { partition: ['P'] })
            .getMany()
        ).rejects.toThrow(/QUERY_PARTITION_INVALID/);
      });

      it('rejects an empty partition array', async () => {
        // Pre-fix: returned every row in the entity.
        await expect(
          kvs.entity('Evidence').query()
            .index('by-project-category', { partition: [] })
            .getMany()
        ).rejects.toThrow(/QUERY_PARTITION_INVALID/);
      });

      it('rejects an omitted partition on a partitioned index', async () => {
        await expect(
          kvs.entity('Evidence').query()
            .index('by-project-category')
            .getMany()
        ).rejects.toThrow(/QUERY_PARTITION_INVALID/);
      });

      it('rejects excess partition values', async () => {
        // Pre-fix: extras were silently ignored.
        await expect(
          kvs.entity('Evidence').query()
            .index('by-project-category', { partition: ['P', 'doc', 'extra'] })
            .getMany()
        ).rejects.toThrow(/QUERY_PARTITION_INVALID/);
      });

      it('names the required partition attributes in the error', async () => {
        await expect(
          kvs.entity('Evidence').query()
            .index('by-project-category', { partition: ['P'] })
            .getMany()
        ).rejects.toThrow(/projectKey, category/);
      });

      it('exact arity works and matches exactly (no prefix scan)', async () => {
        const { results } = await kvs.entity('Evidence').query()
          .index('by-project-category', { partition: ['P', 'doc'] })
          .getMany();
        expect(results.map(r => r.key)).toEqual(['P:doc:1']);
      });

      it('rejects partition values on a partition-less index', async () => {
        await expect(
          kvs.entity('Evidence').query()
            .index('all-by-seq', { partition: ['P'] })
            .getMany()
        ).rejects.toThrow(/QUERY_PARTITION_INVALID/);
      });

      it('partition-less index still works with no partition', async () => {
        const { results } = await kvs.entity('Evidence').query()
          .index('all-by-seq')
          .getMany();
        expect(results.map(r => r.value.seq)).toEqual([1, 2, 3]);
      });

      it('stays permissive for schema-less entities', async () => {
        await kvs.entity('Loose').set('x', { a: 1 });
        const { results } = await kvs.entity('Loose').query()
          .index('anything', { partition: ['whatever'] })
          .getMany();
        expect(results).toHaveLength(1);
      });
    });

    describe('entity query wire path (/api/v1/entity/query)', () => {
      async function wireQuery(body: Record<string, unknown>) {
        const res = await kvs.handleRequest('/api/v1/entity/query', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        return { status: res.status, data: await res.json() };
      }

      it('partial partition returns 400 QUERY_PARTITION_INVALID', async () => {
        const res = await wireQuery({
          entityName: 'Evidence', indexName: 'by-project-category', partition: ['P'],
        });
        expect(res.status).toBe(400);
        expect(res.data.code).toBe('QUERY_PARTITION_INVALID');
      });

      it('empty partition returns 400', async () => {
        const res = await wireQuery({
          entityName: 'Evidence', indexName: 'by-project-category', partition: [],
        });
        expect(res.status).toBe(400);
        expect(res.data.code).toBe('QUERY_PARTITION_INVALID');
      });

      it('exact arity works over the wire', async () => {
        const res = await wireQuery({
          entityName: 'Evidence', indexName: 'by-project-category', partition: ['P', 'img'],
        });
        expect(res.status).toBe(200);
        expect(res.data.data.map((e: any) => e.key)).toEqual(['P:img:2']);
      });
    });
  });

  // ── E8-2: entity queries require an index ──────────────────────────

  describe('E8-2: index required for entity queries', () => {
    beforeEach(async () => {
      kvs.registerEntitySchema('Evidence', {
        attributes: {
          projectKey: { type: 'string' },
          ts: { type: 'integer' },
        },
        indexes: [
          { name: 'by-project', partition: ['projectKey'], range: 'ts' },
          { name: 'all-by-ts', partition: [], range: 'ts' },
        ],
      });
      // The eval's shape: 7 rows, one with ts=100
      for (let i = 1; i <= 6; i++) {
        await kvs.entity('Evidence').set(`e${i}`, { projectKey: 'P', ts: i });
      }
      await kvs.entity('Evidence').set('e100', { projectKey: 'P', ts: 100 });
    });

    describe('entity query builder', () => {
      it('.where() without .index() throws instead of silently ignoring (the eval repro)', () => {
        // Pre-fix: the between(1,3) condition was dropped and all 7 rows
        // came back. Real @forge/kvs has no .where on the stage-1 builder.
        expect(() =>
          (kvs.entity('Evidence').query() as any)
            .where(WhereConditions.between(1, 3))
        ).toThrow(/QUERY_INDEX_REQUIRED/);
      });

      it('.getMany() without .index() throws', () => {
        expect(() => (kvs.entity('Evidence').query() as any).getMany())
          .toThrow(/QUERY_INDEX_REQUIRED/);
      });

      it('all stage-2 methods throw on the stage-1 builder', () => {
        for (const method of ['where', 'filters', 'sort', 'cursor', 'limit', 'getOne', 'getMany']) {
          expect(() => (kvs.entity('Evidence').query() as any)[method]())
            .toThrow(/QUERY_INDEX_REQUIRED/);
        }
      });

      it('names the declared indexes in the error', () => {
        expect(() => (kvs.entity('Evidence').query() as any).getMany())
          .toThrow(/by-project, all-by-ts/);
      });

      it('the indexed path applies the condition correctly', async () => {
        const { results } = await kvs.entity('Evidence').query()
          .index('all-by-ts')
          .where(WhereConditions.between(1, 3))
          .getMany();
        expect(results.map(r => r.value.ts)).toEqual([1, 2, 3]);
      });

      it('schema-less entities still work through .index()', async () => {
        const loose = new UnifiedKVS();
        await loose.entity('Loose').set('x', { a: 1 });
        const { results } = await loose.entity('Loose').query()
          .index('anything')
          .getMany();
        expect(results).toHaveLength(1);
      });
    });

    describe('entity query wire path (/api/v1/entity/query)', () => {
      async function wireQuery(body: Record<string, unknown>) {
        const res = await kvs.handleRequest('/api/v1/entity/query', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        return { status: res.status, data: await res.json() };
      }

      it('missing indexName returns 400 QUERY_INDEX_REQUIRED', async () => {
        const res = await wireQuery({ entityName: 'Evidence' });
        expect(res.status).toBe(400);
        expect(res.data.code).toBe('QUERY_INDEX_REQUIRED');
      });

      it('empty indexName returns 400', async () => {
        const res = await wireQuery({ entityName: 'Evidence', indexName: '' });
        expect(res.status).toBe(400);
        expect(res.data.code).toBe('QUERY_INDEX_REQUIRED');
      });

      it('indexName present works as before', async () => {
        const res = await wireQuery({
          entityName: 'Evidence', indexName: 'by-project', partition: ['P'], limit: 100,
        });
        expect(res.status).toBe(200);
        expect(res.data.data).toHaveLength(7);
      });
    });
  });
});
