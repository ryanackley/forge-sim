/**
 * End-to-end test: load a Forge app through shims and invoke it against the simulator.
 * 
 * This test doesn't use the Node loader hooks (vitest has its own module system).
 * Instead it validates the shim wiring by importing shims directly and
 * testing the full flow: resolver define → mock APIs → invoke → verify side effects.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ForgeSimulator } from '../simulator.js';
import { setSimulator, getSimulator } from '../shims/globals.js';

// Import the shims directly (in real usage, the loader hook does this mapping)
import Resolver from '../shims/forge-resolver.js';
import * as forgeApi from '../shims/forge-api.js';
import * as forgeKvs from '../shims/forge-kvs.js';
import { Queue } from '../shims/forge-events.js';

describe('Forge Shims', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    sim = new ForgeSimulator();
    setSimulator(sim);
  });

  it('should make getSimulator() return the set instance', () => {
    expect(getSimulator()).toBe(sim);
  });

  describe('@forge/resolver shim', () => {
    it('should define handlers that register on the simulator', () => {
      const resolver = new Resolver();
      resolver.define('hello', async (req) => {
        return { message: `Hello ${req.payload.name}` };
      });

      // Should be invocable through the simulator
      return expect(sim.invoke('hello', { name: 'Ryan' }))
        .resolves.toEqual({ message: 'Hello Ryan' });
    });

    it('should return definitions map', () => {
      const resolver = new Resolver();
      resolver.define('fn1', async () => 'a');
      resolver.define('fn2', async () => 'b');
      
      const defs = resolver.getDefinitions();
      expect(Object.keys(defs)).toEqual(['fn1', 'fn2']);
    });
  });

  describe('@forge/api shim', () => {
    it('route() should build paths with encoded values', () => {
      const issueKey = 'TEST-1';
      const path = forgeApi.route`/rest/api/3/issue/${issueKey}`;
      expect(path).toBe('/rest/api/3/issue/TEST-1');
    });

    it('route() should encode special characters', () => {
      const name = 'hello world/test';
      const path = forgeApi.route`/search?name=${name}`;
      expect(path).toBe('/search?name=hello%20world%2Ftest');
    });

    it('asUser().requestJira() should hit simulator product API', async () => {
      sim.mockProductRoutes('jira', {
        '/rest/api/3/issue/TEST-1': { key: 'TEST-1', summary: 'Bug fix' },
      });

      const response = await forgeApi.asUser().requestJira('/rest/api/3/issue/TEST-1');
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toEqual({ key: 'TEST-1', summary: 'Bug fix' });
    });

    it('asApp().requestConfluence() should hit simulator product API', async () => {
      sim.mockProductRoutes('confluence', {
        '/wiki/rest/api/content/123': { id: '123', title: 'My Page' },
      });

      const response = await forgeApi.asApp().requestConfluence('/wiki/rest/api/content/123');
      const data = await response.json();
      expect(data).toEqual({ id: '123', title: 'My Page' });
    });

    it('storage (legacy) should use simulator KVS', async () => {
      await forgeApi.storage.set('foo', 'bar');
      expect(await forgeApi.storage.get('foo')).toBe('bar');
      await forgeApi.storage.delete('foo');
      expect(await forgeApi.storage.get('foo')).toBeUndefined();
    });
  });

  describe('@forge/kvs shim', () => {
    it('kvs.get/set/delete should use simulator KVS', async () => {
      await forgeKvs.kvs.set('key1', { count: 42 });
      expect(await forgeKvs.kvs.get('key1')).toEqual({ count: 42 });
      await forgeKvs.kvs.delete('key1');
      expect(await forgeKvs.kvs.get('key1')).toBeUndefined();
    });

    it('kvs.query() should support where/getMany', async () => {
      await forgeKvs.kvs.set('item:1', 'a');
      await forgeKvs.kvs.set('item:2', 'b');
      await forgeKvs.kvs.set('other:1', 'c');

      const result = await forgeKvs.kvs.query()
        .where('key', forgeKvs.WhereConditions.beginsWith('item:'))
        .getMany();

      expect(result.results).toHaveLength(2);
      expect(result.results.map((r: any) => r.key)).toEqual(['item:1', 'item:2']);
    });

    it('kvs.transact() should atomically update', async () => {
      await forgeKvs.kvs.set('counter', 0);
      await forgeKvs.kvs.transact('counter', (val: number) => val + 1);
      await forgeKvs.kvs.transact('counter', (val: number) => val + 1);
      expect(await forgeKvs.kvs.get('counter')).toBe(2);
    });

    it('secrets should use simulator secrets store', async () => {
      await forgeKvs.kvs.setSecret('api-key', 'secret123');
      expect(await forgeKvs.kvs.getSecret('api-key')).toBe('secret123');
      await forgeKvs.kvs.deleteSecret('api-key');
      expect(await forgeKvs.kvs.getSecret('api-key')).toBeUndefined();
    });
  });

  describe('@forge/events shim', () => {
    it('Queue.push() should push events through simulator', async () => {
      let processed: any = null;
      sim.registerConsumer('test-queue', async (event) => {
        processed = event.body;
      });

      const queue = new Queue({ key: 'test-queue' });
      const result = await queue.push([{ body: { action: 'test' } }]);
      
      expect(result.jobId).toBeDefined();
      expect(processed).toEqual({ action: 'test' });
    });

    it('should throw on invalid queue name', () => {
      expect(() => new Queue({ key: '' })).toThrow();
    });
  });

  describe('Full integration: simulated Forge app flow', () => {
    it('should run a complete resolver → API → KVS → Queue flow', async () => {
      // 1. Mock Jira API
      sim.mockProductRoutes('jira', {
        '/rest/api/3/issue/PROJ-42': {
          key: 'PROJ-42',
          fields: { summary: 'Fix login bug', status: { name: 'In Progress' } },
        },
      });

      // 2. Register queue consumer
      const queueEvents: any[] = [];
      sim.registerConsumer('analytics', async (event) => {
        queueEvents.push(event.body);
      });

      // 3. Define resolver (simulating what the Forge app does)
      const resolver = new Resolver();
      resolver.define('getIssueDetails', async (req) => {
        const { issueKey } = req.payload;

        // Call Jira
        const resp = await forgeApi.asUser().requestJira(
          forgeApi.route`/rest/api/3/issue/${issueKey}`
        );
        const issue = await resp.json();

        // Track in KVS
        const views = ((await forgeKvs.kvs.get(`views:${issueKey}`)) || 0) + 1;
        await forgeKvs.kvs.set(`views:${issueKey}`, views);

        // Push to queue
        const queue = new Queue({ key: 'analytics' });
        await queue.push([{ body: { issueKey, views } }]);

        return { issue, views };
      });

      // 4. Invoke through simulator
      const result = await sim.invoke('getIssueDetails', { issueKey: 'PROJ-42' });

      // 5. Verify everything worked
      expect(result.issue.key).toBe('PROJ-42');
      expect(result.issue.fields.summary).toBe('Fix login bug');
      expect(result.views).toBe(1);

      // KVS was updated
      expect(await sim.kvs.get('views:PROJ-42')).toBe(1);

      // Queue event was processed
      expect(queueEvents).toEqual([{ issueKey: 'PROJ-42', views: 1 }]);

      // Invoke again — views should increment
      const result2 = await sim.invoke('getIssueDetails', { issueKey: 'PROJ-42' });
      expect(result2.views).toBe(2);
      expect(queueEvents).toHaveLength(2);
    });
  });
});
