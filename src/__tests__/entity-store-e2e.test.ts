/**
 * E2E: real @forge/kvs package → global.__forge_fetch__ → SimulatedEntityStore
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { ForgeSimulator } from '../simulator.js';

// Use createRequire to bypass vitest's alias for @forge/kvs
// so we get the REAL package (which uses global.__forge_fetch__)
const require = createRequire(import.meta.url);

let kvs: any;
let Filter: any;
let Sort: any;
let WhereConditions: any;

describe('Entity Store E2E (@forge/kvs → EntityStore)', () => {
  let sim: ForgeSimulator;

  beforeAll(async () => {
    sim = new ForgeSimulator();

    // Register schemas
    sim.entityStore.registerEntitySchema('Task', {
      attributes: {
        title: { type: 'string' },
        status: { type: 'string' },
        priority: { type: 'number' },
        projectId: { type: 'string' },
        createdAt: { type: 'string' },
      },
      indexes: [
        { name: 'by-project', partition: ['projectId'], range: 'priority' },
        { name: 'by-status', partition: ['status'], range: 'createdAt' },
        { name: 'all-by-priority', partition: [], range: 'priority' },
      ],
    });

    // Import real @forge/kvs (via require to bypass vitest alias)
    const forgeKvs = require('@forge/kvs');
    kvs = forgeKvs.kvs;
    Filter = forgeKvs.Filter;
    Sort = forgeKvs.Sort;
    WhereConditions = forgeKvs.WhereConditions;
  });

  beforeEach(() => {
    sim.entityStore.clear();
  });

  it('should set and get entities through kvs.entity()', async () => {
    const tasks = kvs.entity('Task');

    await tasks.set('task-1', {
      title: 'Build entity store',
      status: 'done',
      priority: 1,
      projectId: 'forge-sim',
      createdAt: '2026-03-01',
    });

    const result = await tasks.get('task-1');
    expect(result).toBeDefined();
    expect(result.title).toBe('Build entity store');
    expect(result.priority).toBe(1);
  });

  it('should return undefined for missing keys', async () => {
    const tasks = kvs.entity('Task');
    const result = await tasks.get('nonexistent');
    expect(result).toBeUndefined();
  });

  it('should delete entities', async () => {
    const tasks = kvs.entity('Task');
    await tasks.set('del-me', { title: 'Temporary', status: 'temp', priority: 99, projectId: 'x' });
    await tasks.delete('del-me');
    const result = await tasks.get('del-me');
    expect(result).toBeUndefined();
  });

  it('should query with index + partition', async () => {
    const tasks = kvs.entity('Task');

    await tasks.set('t1', { title: 'High pri', status: 'open', priority: 1, projectId: 'alpha', createdAt: '2026-01-01' });
    await tasks.set('t2', { title: 'Med pri', status: 'open', priority: 5, projectId: 'alpha', createdAt: '2026-02-01' });
    await tasks.set('t3', { title: 'Low pri', status: 'done', priority: 10, projectId: 'alpha', createdAt: '2026-03-01' });
    await tasks.set('t4', { title: 'Other project', status: 'open', priority: 1, projectId: 'beta', createdAt: '2026-01-15' });

    // Query alpha project, priority <= 5
    const result = await tasks.query()
      .index('by-project', { partition: ['alpha'] })
      .where({ condition: 'LESS_THAN_EQUAL_TO', values: [5] })
      .sort(Sort.ASC)
      .getMany();

    expect(result.results).toHaveLength(2);
    expect(result.results[0].value.title).toBe('High pri');
    expect(result.results[1].value.title).toBe('Med pri');
  });

  it('should query with getOne()', async () => {
    const tasks = kvs.entity('Task');

    await tasks.set('t1', { title: 'First', status: 'open', priority: 1, projectId: 'alpha' });
    await tasks.set('t2', { title: 'Second', status: 'open', priority: 2, projectId: 'alpha' });

    const result = await tasks.query()
      .index('by-project', { partition: ['alpha'] })
      .sort(Sort.ASC)
      .getOne();

    expect(result).toBeDefined();
    expect(result!.value.title).toBe('First');
  });

  it('should query with filters (AND)', async () => {
    const tasks = kvs.entity('Task');

    await tasks.set('t1', { title: 'Bug fix', status: 'open', priority: 1, projectId: 'alpha' });
    await tasks.set('t2', { title: 'Feature', status: 'done', priority: 2, projectId: 'alpha' });
    await tasks.set('t3', { title: 'Bug triage', status: 'open', priority: 3, projectId: 'alpha' });

    const result = await tasks.query()
      .index('by-project', { partition: ['alpha'] })
      .filters(
        new Filter()
          .and('status', { condition: 'EQUAL_TO', values: ['open'] })
          .and('title', { condition: 'BEGINS_WITH', values: ['Bug'] })
      )
      .getMany();

    expect(result.results).toHaveLength(2); // Bug fix and Bug triage
  });

  it('should query with filters (OR)', async () => {
    const tasks = kvs.entity('Task');

    await tasks.set('t1', { title: 'Task A', status: 'open', priority: 1, projectId: 'alpha' });
    await tasks.set('t2', { title: 'Task B', status: 'done', priority: 5, projectId: 'alpha' });
    await tasks.set('t3', { title: 'Task C', status: 'blocked', priority: 10, projectId: 'alpha' });

    const result = await tasks.query()
      .index('by-project', { partition: ['alpha'] })
      .filters(
        new Filter()
          .or('status', { condition: 'EQUAL_TO', values: ['open'] })
          .or('priority', { condition: 'GREATER_THAN', values: [8] })
      )
      .getMany();

    expect(result.results).toHaveLength(2); // Task A (open) and Task C (priority 10)
  });

  it('should support plain kvs.get/set through entity store backend', async () => {
    await kvs.set('plain-key', { simple: true });
    const result = await kvs.get('plain-key');
    expect(result).toEqual({ simple: true });
  });

  it('should support plain kvs.delete', async () => {
    await kvs.set('del-key', 'value');
    await kvs.delete('del-key');
    const result = await kvs.get('del-key');
    expect(result).toBeUndefined();
  });

  it('should support plain kvs.query() with where', async () => {
    await kvs.set('item:1', 'one');
    await kvs.set('item:2', 'two');
    await kvs.set('other:1', 'other');

    const result = await kvs.query()
      .where('key', WhereConditions.beginsWith('item:'))
      .getMany();

    expect(result.results).toHaveLength(2);
  });

  it('should support limit and pagination', async () => {
    const tasks = kvs.entity('Task');
    for (let i = 1; i <= 5; i++) {
      await tasks.set(`t${i}`, { title: `Task ${i}`, priority: i, projectId: 'alpha', status: 'open' });
    }

    const page1 = await tasks.query()
      .index('by-project', { partition: ['alpha'] })
      .sort(Sort.ASC)
      .limit(2)
      .getMany();

    expect(page1.results).toHaveLength(2);
    expect(page1.nextCursor).toBeDefined();

    const page2 = await tasks.query()
      .index('by-project', { partition: ['alpha'] })
      .sort(Sort.ASC)
      .limit(2)
      .cursor(page1.nextCursor!)
      .getMany();

    expect(page2.results).toHaveLength(2);
    // Pages shouldn't overlap
    expect(page2.results[0].key).not.toBe(page1.results[0].key);
  });
});
