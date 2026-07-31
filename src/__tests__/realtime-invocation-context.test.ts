/**
 * Integration tests for realtime invocation-context enforcement.
 *
 * Forge parity rule under test: scoped realtime.publish() is ONLY available
 * from frontend invocation context (a resolver invoked from the frontend).
 * Triggers, scheduled triggers, web triggers, and queue consumers must use
 * publishGlobal() — a scoped publish from those contexts returns
 * { errors: [{ message: 'Unauthorized request' }] } without throwing,
 * without delivering, and without falling back to the global plane.
 *
 * The simulator wires this via AsyncLocalStorage around every handler entry
 * path (invoke / fireTrigger / fireScheduledTrigger / fireWebTrigger /
 * registerConsumer), so these tests exercise the real end-to-end plumbing,
 * not the SimulatedRealtime unit surface.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSimulator, ForgeSimulator } from '../simulator.js';
import type { PublishResult } from '../realtime.js';

const MANIFEST = `
modules:
  function:
    - key: publishFn
    - key: onIssueCreated
    - key: nightlyJob
    - key: hookFn
  jira:issuePanel:
    - key: my-panel
      resource: main
      render: native
      resolver:
        function: main-resolver
  trigger:
    - key: issue-created
      function: onIssueCreated
      events:
        - avi:jira:created:issue
  scheduledTrigger:
    - key: nightly
      function: nightlyJob
      interval: day
  webtrigger:
    - key: incoming-hook
      function: hookFn
  consumer:
    - key: work-consumer
      queue: work-queue
      resolver:
        function: consumerFn
        method: handle
resources:
  - key: main
    path: src/frontend/index.tsx
app:
  id: ari:cloud:ecosystem::app/test
  name: Realtime Context Test
`;

describe('Realtime invocation context (end-to-end)', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    sim = createSimulator();
    sim.loadManifest(MANIFEST);
    // Wire up what the deployer would: module routing + resolver ownership.
    sim.registerModuleRoute('my-panel', {
      resolverFunctionKey: 'main-resolver',
      moduleType: 'jira:issuePanel',
    });
    sim.registerResolverOwnership('publishUpdate', 'main-resolver');
  });

  // ── Resolver path (frontend invocation context) ─────────────────────

  describe('resolver invocations', () => {
    it('scoped publish from a resolver reaches subscribers on the module channel', async () => {
      const received: any[] = [];
      sim.realtime.subscribe('progress', (p) => received.push(p), 'my-panel');

      sim.resolver.define('publishUpdate', async () => {
        return sim.realtime.publish('progress', { percent: 50 });
      });

      const result: PublishResult = await sim.invoke('publishUpdate', {}, { moduleKey: 'my-panel' });

      expect(result.errors).toEqual([]);
      expect(result.eventId).toMatch(/^rt-evt-/);
      expect(received).toEqual([{ percent: 50 }]);
    });

    it('derives the module key when the resolver is owned by exactly one module', async () => {
      const received: any[] = [];
      sim.realtime.subscribe('progress', (p) => received.push(p), 'my-panel');

      sim.resolver.define('publishUpdate', async () => {
        return sim.realtime.publish('progress', 'derived');
      });

      // No explicit moduleKey — derivation via resolverOwnership + moduleRouting.
      const result: PublishResult = await sim.invoke('publishUpdate', {});

      expect(result.errors).toEqual([]);
      expect(received).toEqual(['derived']);
    });

    it('scoped publish does NOT leak to the global plane', async () => {
      const globalReceived: any[] = [];
      sim.realtime.subscribeGlobal('progress', (p) => globalReceived.push(p));

      sim.resolver.define('publishUpdate', async () => {
        return sim.realtime.publish('progress', 'scoped-only');
      });

      await sim.invoke('publishUpdate', {}, { moduleKey: 'my-panel' });

      expect(globalReceived).toHaveLength(0);
    });

    it('invocation context survives async continuations inside the handler', async () => {
      const received: any[] = [];
      sim.realtime.subscribe('late', (p) => received.push(p), 'my-panel');

      sim.resolver.define('publishUpdate', async () => {
        // Publish after awaiting unrelated async work — AsyncLocalStorage
        // must carry the context across the continuation.
        await new Promise((r) => setTimeout(r, 5));
        await sim.kvs.set('some-key', 'some-value');
        return sim.realtime.publish('late', 'still-scoped');
      });

      const result: PublishResult = await sim.invoke('publishUpdate', {}, { moduleKey: 'my-panel' });

      expect(result.errors).toEqual([]);
      expect(received).toEqual(['still-scoped']);
    });
  });

  // ── Trigger path ────────────────────────────────────────────────────

  describe('trigger invocations', () => {
    it('scoped publish from a trigger returns Unauthorized request', async () => {
      let publishResult: PublishResult | undefined;
      sim.registerFunction('onIssueCreated', async () => {
        publishResult = await sim.realtime.publish('progress', 'from-trigger');
        return { ok: true };
      }, 'trigger');

      const results = await sim.fireTrigger('avi:jira:created:issue', { issue: { id: '1' } });

      expect(results[0]).toEqual({ ok: true });  // handler did not throw
      expect(publishResult!.eventId).toBeNull();
      expect(publishResult!.errors).toEqual([{ message: 'Unauthorized request' }]);
    });

    it('scoped publish from a trigger delivers to NO subscribers (no fallback)', async () => {
      const scoped: any[] = [];
      const global: any[] = [];
      sim.realtime.subscribe('progress', (p) => scoped.push(p), 'my-panel');
      sim.realtime.subscribeGlobal('progress', (p) => global.push(p));

      sim.registerFunction('onIssueCreated', async () => {
        await sim.realtime.publish('progress', 'denied');
      }, 'trigger');

      await sim.fireTrigger('avi:jira:created:issue', { issue: { id: '1' } });

      expect(scoped).toHaveLength(0);
      expect(global).toHaveLength(0);
    });

    it('publishGlobal from a trigger delivers to subscribeGlobal', async () => {
      const received: any[] = [];
      sim.realtime.subscribeGlobal('broadcast', (p) => received.push(p));

      sim.registerFunction('onIssueCreated', async () => {
        return sim.realtime.publishGlobal('broadcast', { issue: 'created' });
      }, 'trigger');

      const results = await sim.fireTrigger('avi:jira:created:issue', { issue: { id: '1' } });

      expect((results[0] as PublishResult).errors).toEqual([]);
      expect(received).toEqual([{ issue: 'created' }]);
    });
  });

  // ── Scheduled trigger path ──────────────────────────────────────────

  describe('scheduled trigger invocations', () => {
    it('scoped publish returns Unauthorized; publishGlobal works', async () => {
      const received: any[] = [];
      sim.realtime.subscribeGlobal('nightly-status', (p) => received.push(p));

      let scopedResult: PublishResult | undefined;
      sim.registerFunction('nightlyJob', async () => {
        scopedResult = await sim.realtime.publish('nightly-status', 'scoped-denied');
        await sim.realtime.publishGlobal('nightly-status', 'global-ok');
        return { statusCode: 204 };
      }, 'scheduledTrigger');

      const result = await sim.fireScheduledTrigger('nightly');

      expect(result.statusCode).toBe(204);
      expect(scopedResult!.errors).toEqual([{ message: 'Unauthorized request' }]);
      expect(received).toEqual(['global-ok']);
    });
  });

  // ── Web trigger path ────────────────────────────────────────────────

  describe('web trigger invocations', () => {
    it('scoped publish returns Unauthorized; publishGlobal works', async () => {
      const received: any[] = [];
      sim.realtime.subscribeGlobal('hook-events', (p) => received.push(p));

      let scopedResult: PublishResult | undefined;
      sim.registerFunction('hookFn', async () => {
        scopedResult = await sim.realtime.publish('hook-events', 'scoped-denied');
        await sim.realtime.publishGlobal('hook-events', 'global-ok');
        return { statusCode: 200, body: 'ok' };
      }, 'webTrigger');

      const response = await sim.fireWebTrigger('incoming-hook', { method: 'POST' });

      expect(response.statusCode).toBe(200);
      expect(scopedResult!.errors).toEqual([{ message: 'Unauthorized request' }]);
      expect(received).toEqual(['global-ok']);
    });
  });

  // ── Consumer path ───────────────────────────────────────────────────

  describe('queue consumer invocations', () => {
    it('scoped publish returns Unauthorized; publishGlobal works', async () => {
      const received: any[] = [];
      sim.realtime.subscribeGlobal('work-status', (p) => received.push(p));

      let scopedResult: PublishResult | undefined;
      sim.registerConsumer('work-queue', async (event) => {
        scopedResult = await sim.realtime.publish('work-status', 'scoped-denied');
        await sim.realtime.publishGlobal('work-status', { done: event.body.n });
      });

      await sim.queue.push('work-queue', { body: { n: 1 } });

      expect(scopedResult!.errors).toEqual([{ message: 'Unauthorized request' }]);
      expect(received).toEqual([{ done: 1 }]);
    });
  });
});
