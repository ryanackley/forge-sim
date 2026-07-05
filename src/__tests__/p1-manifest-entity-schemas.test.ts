/**
 * P1 — Auto-register `app.storage.entities` schemas from the manifest at deploy time.
 *
 * Bug surfaced in the skill-chain bug hunt run after run-4. Real Forge enforces
 * entity schemas — type-checks attributes, uses indexes for partition + range
 * queries. forge-sim parses the manifest but never calls registerEntitySchema()
 * for declared entities at deploy time, so:
 *
 *   1. entity.set() silently accepts wrongly-typed values that real Forge rejects
 *   2. entity.query().index('foo').partition([...]) silently drops the partition
 *      filter when indexDef is undefined → returns the WHOLE table
 *   3. range filtering on the indexed sort key is also silently dropped
 *
 * This is exactly the parity-violation class forge-sim exists to prevent.
 *
 * These tests pin the fix down via the public API: a fixture app manifest
 * declares two entities with indexes; we deploy it, then expect that:
 *
 *   - Type validation fires on bad attribute types (string in an integer field)
 *   - Type validation fires on unknown attributes
 *   - Partition-keyed queries actually filter
 *   - The schemas are listed in the deploy result so tooling can see them
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { createSimulator, type ForgeSimulator } from '../simulator.js';

const FIXTURE = join(import.meta.dirname, 'fixtures/manifest-entities');

describe('P1 — manifest.app.storage.entities auto-registration', () => {
  let sim: ForgeSimulator;

  beforeAll(async () => {
    sim = createSimulator();
    await sim.deploy(FIXTURE);
  });

  afterAll(async () => {
    await sim.stop();
  });

  describe('schema registration', () => {
    it('registers every entity declared in app.storage.entities', () => {
      const schemas = sim.kvs.getEntitySchemas();
      expect([...schemas.keys()].sort()).toEqual(['Comment', 'Task']);
    });

    it('captures attribute definitions verbatim', () => {
      const schema = sim.kvs.getEntitySchemas().get('Task');
      expect(schema).toBeDefined();
      expect(schema!.attributes).toEqual({
        title: { type: 'string' },
        status: { type: 'string' },
        priority: { type: 'integer' },
        projectId: { type: 'string' },
        createdAt: { type: 'string' },
      });
    });

    it('captures index definitions verbatim', () => {
      const schema = sim.kvs.getEntitySchemas().get('Task');
      expect(schema!.indexes).toEqual([
        { name: 'by-project', partition: ['projectId'], range: 'priority' },
        { name: 'by-status', partition: ['status'], range: 'createdAt' },
      ]);
    });

    it('handles an index with no range key', () => {
      const schema = sim.kvs.getEntitySchemas().get('Comment');
      expect(schema!.indexes).toEqual([
        { name: 'by-task', partition: ['taskKey'], range: undefined },
      ]);
    });
  });

  describe('type enforcement (parity with real Forge)', () => {
    it('rejects storing a string in an integer-typed attribute', async () => {
      // Real Forge: 400 with "Type mismatch ..." message.
      // Without P1 fix, this silently succeeds.
      await expect(
        sim.kvs.entity('Task').set('t1', {
          title: 'Wire up auth',
          status: 'todo',
          priority: 'high', // ← string, not integer
          projectId: 'P1',
          createdAt: '2026-05-13T10:00:00Z',
        }),
      ).rejects.toThrow(/Type mismatch.*priority.*integer/);
    });

    it('rejects unknown attributes', async () => {
      await expect(
        sim.kvs.entity('Task').set('t2', {
          title: 'Bad attribute',
          mysteryField: 42, // ← not in the schema
        }),
      ).rejects.toThrow(/Unknown attribute "mysteryField"/);
    });

    it('accepts a well-typed entity', async () => {
      await sim.kvs.entity('Task').set('t-ok', {
        title: 'Valid one',
        status: 'todo',
        priority: 3,
        projectId: 'P1',
        createdAt: '2026-05-13T10:00:00Z',
      });
      const got = await sim.kvs.entity('Task').get('t-ok');
      expect(got?.title).toBe('Valid one');
    });
  });

  describe('indexed queries (parity with real Forge)', () => {
    beforeAll(async () => {
      // Seed three tasks across two projects.
      await sim.kvs.entity('Task').set('seed-a1', {
        title: 'A1', status: 'todo', priority: 1, projectId: 'PROJ-A', createdAt: '2026-05-10',
      });
      await sim.kvs.entity('Task').set('seed-a2', {
        title: 'A2', status: 'todo', priority: 5, projectId: 'PROJ-A', createdAt: '2026-05-11',
      });
      await sim.kvs.entity('Task').set('seed-b1', {
        title: 'B1', status: 'done', priority: 3, projectId: 'PROJ-B', createdAt: '2026-05-12',
      });
    });

    it('partition filter actually filters (was a silent full-table scan before fix)', async () => {
      const res = await sim.kvs.entity('Task')
        .query()
        .index('by-project', { partition: ['PROJ-A'] })
        .getMany();
      const titles = res.results.map(r => r.value.title).sort();
      // Without P1: would return ['A1', 'A2', 'B1'] (the whole table).
      expect(titles).toEqual(['A1', 'A2']);
    });

    it('partition filter on a different partition value returns only that partition', async () => {
      const res = await sim.kvs.entity('Task')
        .query()
        .index('by-project', { partition: ['PROJ-B'] })
        .getMany();
      const titles = res.results.map(r => r.value.title);
      expect(titles).toEqual(['B1']);
    });
  });

  describe('manifest validation', () => {
    it('does not emit warnings for a well-formed entity declaration', async () => {
      // Re-parse the same fixture, check no entity-related warnings appeared.
      const { parseManifest } = await import('../manifest.js');
      const parsed = await parseManifest(join(FIXTURE, 'manifest.yml'));
      const entityWarnings = parsed.warnings.filter(w =>
        /entity|entities|app\.storage/i.test(w.message)
      );
      expect(entityWarnings).toEqual([]);
    });
  });
});

describe('P1 — manifests with no storage section work unchanged', () => {
  it('apps with no app.storage.entities deploy fine with zero entity schemas', async () => {
    const sim = createSimulator();
    try {
      // Reuse an existing fixture that doesn't declare entities
      await sim.deploy(join(import.meta.dirname, 'fixtures/macro-no-config'));
      const schemas = sim.kvs.getEntitySchemas();
      expect(schemas.size).toBe(0);
    } finally {
      await sim.stop();
    }
  });
});
