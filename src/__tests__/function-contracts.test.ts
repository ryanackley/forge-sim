/**
 * Tests for Forge function invocation contracts.
 *
 * Verifies that each function type gets called with the correct signature:
 * - Resolver: ({ payload, context }) — single wrapped object
 * - Trigger: (event, context) — two args
 * - Scheduled trigger: (request, context) — must return { statusCode }
 * - Consumer: (event, context) — two args (tested in queue.test.ts)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSimulator, ForgeSimulator } from '../simulator.js';

describe('Function Invocation Contracts', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    sim = createSimulator();
  });

  // ── Function Registry ──────────────────────────────────────────────

  describe('Function Registry', () => {
    it('registers and retrieves functions by type', () => {
      const handler = async () => {};
      sim.registerFunction('myTrigger', handler, 'trigger');
      sim.registerFunction('myScheduled', handler, 'scheduledTrigger');
      sim.registerFunction('myGeneric', handler, 'generic');

      expect(sim.functions.getType('myTrigger')).toBe('trigger');
      expect(sim.functions.getType('myScheduled')).toBe('scheduledTrigger');
      expect(sim.functions.getType('myGeneric')).toBe('generic');
    });

    it('lists function keys by type', () => {
      sim.registerFunction('t1', async () => {}, 'trigger');
      sim.registerFunction('t2', async () => {}, 'trigger');
      sim.registerFunction('s1', async () => {}, 'scheduledTrigger');

      expect(sim.functions.keysOfType('trigger')).toEqual(['t1', 't2']);
      expect(sim.functions.keysOfType('scheduledTrigger')).toEqual(['s1']);
      expect(sim.functions.keysOfType('consumer')).toEqual([]);
    });

    it('clears on reset', async () => {
      sim.registerFunction('fn1', async () => {}, 'trigger');
      expect(sim.functions.has('fn1')).toBe(true);

      await sim.reset();
      expect(sim.functions.has('fn1')).toBe(false);
    });
  });

  // ── Resolver Contract ──────────────────────────────────────────────

  describe('Resolver (UI bridge) contract', () => {
    it('handler receives ({ payload, context }) as single wrapped object', async () => {
      let received: any;
      sim.resolver.define('testResolver', async (req) => {
        received = req;
        return { ok: true };
      });

      await sim.invoke('testResolver', { foo: 'bar' });

      expect(received).toHaveProperty('payload');
      expect(received).toHaveProperty('context');
      expect(received.payload).toEqual({ foo: 'bar' });
      expect(received.context.accountId).toBeDefined();
      expect(received.context.installContext).toBeDefined();
    });
  });

  // ── Trigger Contract ───────────────────────────────────────────────

  describe('Trigger contract', () => {
    it('handler receives (event, context) as two separate arguments', async () => {
      let receivedArgs: any[];

      // Register trigger handler in function registry
      sim.registerFunction('onIssueCreated', async (...args: any[]) => {
        receivedArgs = args;
        return { processed: true };
      }, 'trigger');

      // Load manifest with trigger definition
      sim.loadManifest(`
modules:
  function:
    - key: onIssueCreated
      handler: index.onIssueCreated
  trigger:
    - key: issue-created
      function: onIssueCreated
      events:
        - avi:jira:created:issue
app:
  id: ari:cloud:ecosystem::app/test
  name: Test
`);

      const results = await sim.fireTrigger('avi:jira:created:issue', {
        issue: { id: '123', key: 'TEST-1' },
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ processed: true });

      // Verify two separate arguments
      expect(receivedArgs!).toHaveLength(2);

      // First arg: event payload
      expect(receivedArgs![0].event).toBe('avi:jira:created:issue');
      expect(receivedArgs![0].issue).toEqual({ id: '123', key: 'TEST-1' });

      // Second arg: context
      expect(receivedArgs![1].installContext).toBeDefined();
    });

    it('falls back to resolver-defined handlers for backward compat', async () => {
      let received: any;

      // Register via resolver (old pattern)
      sim.resolver.define('legacyTrigger', async (event: any, context?: any) => {
        received = { event, context };
        return { ok: true };
      });

      sim.loadManifest(`
modules:
  function:
    - key: legacyTrigger
      handler: index.handler
  trigger:
    - key: legacy
      function: legacyTrigger
      events:
        - avi:jira:updated:issue
app:
  id: ari:cloud:ecosystem::app/test
  name: Test
`);

      await sim.fireTrigger('avi:jira:updated:issue', { issue: { key: 'X-1' } });

      // Handler found via resolver fallback, called with (event, context)
      expect(received.event.issue.key).toBe('X-1');
    });
  });

  // ── Scheduled Trigger Contract ─────────────────────────────────────

  describe('Scheduled trigger contract', () => {
    beforeEach(() => {
      sim.loadManifest(`
modules:
  function:
    - key: migrationFn
      handler: index.runMigration
    - key: cleanupFn
      handler: index.runCleanup
    - key: badFn
      handler: index.badHandler
  scheduledTrigger:
    - key: run-migrations
      function: migrationFn
      schedule:
        interval: hour
    - key: run-cleanup
      function: cleanupFn
      schedule:
        interval: day
    - key: bad-trigger
      function: badFn
      schedule:
        interval: hour
app:
  id: ari:cloud:ecosystem::app/test
  name: Test
`);
    });

    it('handler receives (request, context) with correct request shape', async () => {
      let receivedArgs: any[];
      sim.registerFunction('migrationFn', async (...args: any[]) => {
        receivedArgs = args;
        return { statusCode: 204, body: 'OK' };
      }, 'scheduledTrigger');

      const result = await sim.fireScheduledTrigger('run-migrations');

      expect(result.statusCode).toBe(204);
      expect(receivedArgs!).toHaveLength(2);

      // First arg: request with context and contextToken
      const request = receivedArgs![0];
      expect(request.context.cloudId).toBe('sim-cloud-001');
      expect(request.context.moduleKey).toBe('run-migrations');
      expect(request.contextToken).toBeDefined();

      // Second arg: context
      const context = receivedArgs![1];
      expect(context.installContext).toBeDefined();
    });

    it('returns 424 when handler does not return { statusCode }', async () => {
      sim.registerFunction('badFn', async () => {
        return { success: true }; // Missing statusCode!
      }, 'scheduledTrigger');

      const result = await sim.fireScheduledTrigger('bad-trigger');

      expect(result.statusCode).toBe(424);
      expect(result.error).toContain('Invalid response');
      expect(result.error).toContain('statusCode');
    });

    it('returns 424 for undefined return value', async () => {
      sim.registerFunction('badFn', async () => {
        // void return — no statusCode
      }, 'scheduledTrigger');

      const result = await sim.fireScheduledTrigger('bad-trigger');
      expect(result.statusCode).toBe(424);
    });

    it('accepts valid success response (204)', async () => {
      sim.registerFunction('migrationFn', async () => {
        return { statusCode: 204, body: 'Migrations complete' };
      }, 'scheduledTrigger');

      const result = await sim.fireScheduledTrigger('run-migrations');
      expect(result.statusCode).toBe(204);
      expect(result.body).toBe('Migrations complete');
    });

    it('passes through error status codes (5xx)', async () => {
      sim.registerFunction('cleanupFn', async () => {
        return { statusCode: 500, statusText: 'Internal error' };
      }, 'scheduledTrigger');

      const result = await sim.fireScheduledTrigger('run-cleanup');
      expect(result.statusCode).toBe(500);
    });

    it('catches thrown errors and returns 500', async () => {
      sim.registerFunction('badFn', async () => {
        throw new Error('boom');
      }, 'scheduledTrigger');

      const result = await sim.fireScheduledTrigger('bad-trigger');
      expect(result.statusCode).toBe(500);
      expect(result.error).toContain('boom');
    });

    it('throws for unknown trigger key', async () => {
      await expect(sim.fireScheduledTrigger('nonexistent')).rejects.toThrow('No scheduled trigger');
    });
  });

  // ── Consumer Contract ──────────────────────────────────────────────

  describe('Consumer contract', () => {
    it('handler receives (event, context) as two separate arguments', async () => {
      let receivedArgs: any[];

      sim.registerConsumer('testQueue', async (...args: any[]) => {
        receivedArgs = args;
      });

      await sim.queue.push('testQueue', { body: { action: 'test' } });

      // Verify two separate arguments
      expect(receivedArgs!).toHaveLength(2);

      // First arg: event with body
      expect(receivedArgs![0].body).toEqual({ action: 'test' });
      expect(receivedArgs![0].jobId).toBeDefined();

      // Second arg: context
      expect(receivedArgs![1].installContext).toBeDefined();
    });
  });
});
