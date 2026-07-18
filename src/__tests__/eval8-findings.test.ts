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
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { UnifiedKVS } from '../kvs.js';

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
});
