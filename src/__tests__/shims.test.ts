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

    it('kvs.transact() builder should batch set and delete', async () => {
      await forgeKvs.kvs.set('a', 1);
      await forgeKvs.kvs.set('b', 2);

      await forgeKvs.kvs.transact()
        .set('a', 10)
        .set('c', 3)
        .delete('b')
        .execute();

      expect(await forgeKvs.kvs.get('a')).toBe(10);
      expect(await forgeKvs.kvs.get('b')).toBeUndefined();
      expect(await forgeKvs.kvs.get('c')).toBe(3);
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

  // ── @forge/api i18n ─────────────────────────────────────────────────

  describe('@forge/api i18n', () => {
    it('getTranslations returns translations from I18nStore', async () => {
      sim.i18n.setTranslations('en-US', { greeting: 'Hello', farewell: 'Goodbye' });
      sim.i18n.setTranslations('fr-FR', { greeting: 'Bonjour', farewell: 'Au revoir' });

      const result = await forgeApi.i18n.getTranslations('fr-FR');
      expect(result.locale).toBe('fr-FR');
      expect(result.translations?.greeting).toBe('Bonjour');
    });

    it('getTranslations returns null when no translations loaded', async () => {
      // Fresh simulator — no translations set
      const result = await forgeApi.i18n.getTranslations('en-US');
      expect(result.locale).toBe('en-US');
      expect(result.translations).toBeNull();
    });

    it('createTranslationFunction translates keys', async () => {
      sim.i18n.setTranslations('en-US', {
        greeting: 'Hello',
        nav: { home: 'Home', settings: 'Settings' },
      });

      const t = await forgeApi.i18n.createTranslationFunction('en-US');
      expect(t('greeting')).toBe('Hello');
      expect(t('nav.home')).toBe('Home');
    });

    it('createTranslationFunction returns key/defaultValue when no translations', async () => {
      const t = await forgeApi.i18n.createTranslationFunction('en-US');
      expect(t('missing.key')).toBe('missing.key');
      expect(t('missing.key', 'Fallback')).toBe('Fallback');
    });

    it('resetTranslationsCache clears cache and store', async () => {
      sim.i18n.setTranslations('en-US', { greeting: 'Hello' });

      // Warm the cache
      const t1 = await forgeApi.i18n.createTranslationFunction('en-US');
      expect(t1('greeting')).toBe('Hello');

      // Reset and verify store is cleared
      forgeApi.i18n.resetTranslationsCache();
      expect(sim.i18n.hasTranslations).toBe(false);
    });

    it('named exports match i18n object methods', () => {
      expect(forgeApi.resetTranslationsCache).toBe(forgeApi.i18n.resetTranslationsCache);
      expect(forgeApi.getTranslations).toBe(forgeApi.i18n.getTranslations);
      expect(forgeApi.createTranslationFunction).toBe(forgeApi.i18n.createTranslationFunction);
    });
  });

  // ── privacy.reportPersonalData ──────────────────────────────────────

  describe('privacy.reportPersonalData', () => {
    it('posts accounts to /app/report-accounts and returns updates', async () => {
      sim.productApi.mockRoutes('jira', {
        'POST /app/report-accounts': (path: string, options: any) => {
          const body = JSON.parse(options.body);
          return {
            accounts: body.accounts.map((a: any) => ({
              accountId: a.accountId,
              status: 'CLOSED',
            })),
          };
        },
      });

      const result = await forgeApi.privacy.reportPersonalData([
        { accountId: 'user-1' },
        { accountId: 'user-2' },
      ]);

      expect(result).toEqual([
        { accountId: 'user-1', status: 'CLOSED' },
        { accountId: 'user-2', status: 'CLOSED' },
      ]);
    });

    it('returns empty array for empty input', async () => {
      const result = await forgeApi.privacy.reportPersonalData([]);
      expect(result).toEqual([]);
    });

    it('batches in groups of 90', async () => {
      const batches: number[] = [];

      sim.productApi.mockRoutes('jira', {
        'POST /app/report-accounts': (path: string, options: any) => {
          const body = JSON.parse(options.body);
          batches.push(body.accounts.length);
          return {
            accounts: body.accounts.map((a: any) => ({
              accountId: a.accountId,
              status: 'CLOSED',
            })),
          };
        },
      });

      // Create 95 accounts — should split into 90 + 5
      const accounts = Array.from({ length: 95 }, (_, i) => ({ accountId: `user-${i}` }));
      const result = await forgeApi.privacy.reportPersonalData(accounts);

      expect(batches).toEqual([90, 5]);
      expect(result).toHaveLength(95);
    });
  });

  // ── permissions ─────────────────────────────────────────────────────

  describe('permissions', () => {
    it('hasPermission returns granted: true', () => {
      expect(forgeApi.permissions.hasPermission({ scopes: ['read:jira-work'] }))
        .toEqual({ granted: true });
    });

    it('hasScope returns true', () => {
      expect(forgeApi.permissions.hasScope('read:jira-work')).toBe(true);
    });

    it('canFetchFrom returns true', () => {
      expect(forgeApi.permissions.canFetchFrom('backend', 'https://api.example.com')).toBe(true);
    });

    it('canLoadResource returns true', () => {
      expect(forgeApi.permissions.canLoadResource('scripts', 'https://cdn.example.com/app.js')).toBe(true);
    });
  });
});
