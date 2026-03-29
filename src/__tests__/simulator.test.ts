import { describe, it, expect, beforeEach } from 'vitest';
import { createSimulator, ForgeSimulator } from '../simulator.js';

describe('ForgeSimulator', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    sim = createSimulator();
  });

  describe('resolver integration', () => {
    it('define and invoke resolvers', async () => {
      sim.resolver.define('getItems', async (req) => {
        return { items: ['a', 'b', 'c'] };
      });

      const result = await sim.invoke('getItems');
      expect(result.items).toEqual(['a', 'b', 'c']);
    });

    it('resolver can use storage', async () => {
      sim.resolver.define('saveItem', async (req) => {
        await sim.kvs.set(`item:${req.payload.id}`, req.payload);
        return { success: true };
      });

      sim.resolver.define('getItem', async (req) => {
        return await sim.kvs.get(`item:${req.payload.id}`);
      });

      await sim.invoke('saveItem', { id: '1', name: 'Widget' });
      const item = await sim.invoke('getItem', { id: '1' });
      expect(item).toEqual({ id: '1', name: 'Widget' });
    });

    it('resolver can use product APIs', async () => {
      sim.mockProductRoutes('jira', {
        '/rest/api/3/issue/PROJ-1': { key: 'PROJ-1', fields: { summary: 'Test Issue' } },
      });

      sim.resolver.define('getIssue', async (req) => {
        const api = sim.createApiClient('asUser');
        const response = await api.requestJira(`/rest/api/3/issue/${req.payload.issueKey}`);
        return response.json();
      });

      const result = await sim.invoke('getIssue', { issueKey: 'PROJ-1' });
      expect(result.key).toBe('PROJ-1');
    });
  });

  describe('queue integration', () => {
    it('resolver pushes to queue, consumer processes', async () => {
      const processed: any[] = [];

      sim.registerConsumer('work-queue', async (event) => {
        processed.push(event.body);
        await sim.kvs.set(`result:${event.body.id}`, { done: true });
      });

      sim.resolver.define('submitWork', async (req) => {
        await sim.queue.push('work-queue', { body: { id: req.payload.id, task: 'process' } });
        return { queued: true };
      });

      await sim.invoke('submitWork', { id: '42' });
      expect(processed).toHaveLength(1);
      expect(await sim.kvs.get('result:42')).toEqual({ done: true });
    });
  });

  describe('manifest loading', () => {
    it('parses manifest content', async () => {
      const manifest = await sim.loadManifest(`
app:
  id: ari:cloud:ecosystem::app/test-app
  name: Test App
modules:
  jira:issuePanel:
    - key: my-panel
      title: My Panel
      resolver:
        function: resolver
      resource: main
  function:
    - key: resolver
      handler: index.handler
    - key: consumer-fn
      handler: consumer.handler
  consumer:
    - key: my-consumer
      queue: my-queue
      function: consumer-fn
  trigger:
    - key: issue-trigger
      function: resolver
      events:
        - avi:jira:created:issue
permissions:
  scopes:
    - storage:app
    - read:jira-work
`);

      expect(manifest.functions.size).toBe(2);
      expect(manifest.consumers).toHaveLength(1);
      expect(manifest.uiModules).toHaveLength(1);
      expect(manifest.uiModules[0].type).toBe('jira:issuePanel');
      expect(manifest.triggers).toHaveLength(1);
      expect(manifest.permissions).toContain('storage:app');
    });
  });

  describe('initial config', () => {
    it('seeds storage from config', async () => {
      const sim2 = createSimulator({
        initialStorage: {
          'config:theme': 'dark',
          'user:1': { name: 'Ryan' },
        },
      });

      expect(await sim2.kvs.get('config:theme')).toBe('dark');
      expect(await sim2.kvs.get('user:1')).toEqual({ name: 'Ryan' });
    });
  });

  describe('logging', () => {
    it('captures invocation logs', async () => {
      sim.resolver.define('test', async () => 'ok');
      await sim.invoke('test');

      const logs = sim.getLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some((l) => l.message.includes('Invoking resolver: test'))).toBe(true);
    });
  });

  describe('reset', () => {
    it('clears all state', async () => {
      sim.resolver.define('test', async () => 'ok');
      await sim.kvs.set('key', 'value');
      sim.reset();

      expect(sim.kvs.size).toBe(0);
      expect(sim.resolver.getDefinitions()).toHaveLength(0);
      expect(sim.getLogs()).toHaveLength(0);
    });
  });
});
