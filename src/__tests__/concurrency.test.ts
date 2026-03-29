/**
 * Tests for concurrent queue processing and race condition detection.
 *
 * Validates that:
 * 1. Concurrent mode actually exposes races in naive get→set patterns
 * 2. Concurrency keys (semaphores) correctly limit parallel execution
 * 3. kvs.transact() is safe under concurrent access
 * 4. Sequential mode remains deterministic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSimulator } from '../simulator.js';

describe('Concurrent Queue Processing', () => {
  describe('sequential mode (default)', () => {
    it('should process events one at a time — no races possible', async () => {
      const sim = createSimulator();

      await sim.kvs.set('counter', 0);

      // Consumer does naive get→increment→set
      sim.registerConsumer('work', async () => {
        const val = await sim.kvs.get('counter');
        await sim.kvs.set('counter', val + 1);
      });

      // Push 10 events
      await sim.queue.push('work',
        Array.from({ length: 10 }, (_, i) => ({ body: { i } }))
      );

      // Sequential: all 10 increments land correctly
      expect(await sim.kvs.get('counter')).toBe(10);
    });
  });

  describe('concurrent mode', () => {
    it('should expose race conditions in naive get→set patterns', async () => {
      const sim = createSimulator({
        queueMode: 'concurrent',
        storageLatency: true, // yield to event loop between get/set
      });

      await sim.kvs.set('counter', 0);

      // Consumer does naive get→increment→set (the WRONG way)
      sim.registerConsumer('work', async () => {
        const val = await sim.kvs.get('counter');
        // The yield in get() allows other consumers to read the SAME value
        await sim.kvs.set('counter', val + 1);
      });

      // Push 10 events — they'll all run concurrently
      await sim.queue.push('work',
        Array.from({ length: 10 }, (_, i) => ({ body: { i } }))
      );

      const finalValue = await sim.kvs.get('counter');
      
      // With concurrent processing + latency, the naive pattern loses increments.
      // Multiple consumers read the same value before any set lands.
      // The final value should be LESS than 10 (race condition detected!)
      expect(finalValue).toBeLessThan(10);
      console.log(`Race condition detected: counter = ${finalValue} (expected 10 with correct code)`);
    });

    it('should safely batch writes with transact() builder', async () => {
      const sim = createSimulator({
        queueMode: 'concurrent',
        storageLatency: true,
      });

      // Each consumer writes a unique key via transaction — no conflicts
      sim.registerConsumer('work', async (event) => {
        await sim.kvs.transact()
          .set(`result-${event.body.i}`, event.body.i)
          .execute();
      });

      await sim.queue.push('work',
        Array.from({ length: 10 }, (_, i) => ({ body: { i } }))
      );

      // All 10 writes should land (no conflicts since unique keys)
      for (let i = 0; i < 10; i++) {
        expect(await sim.kvs.get(`result-${i}`)).toBe(i);
      }
    });

    it('should respect concurrency key limits', async () => {
      const sim = createSimulator({
        queueMode: 'concurrent',
        storageLatency: true,
      });

      let maxConcurrent = 0;
      let currentConcurrent = 0;

      sim.registerConsumer('work', async () => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        // Simulate some work
        await new Promise((r) => setTimeout(r, 10));
        currentConcurrent--;
      });

      // Push events with concurrency limit of 2
      await sim.queue.push('work',
        Array.from({ length: 6 }, (_, i) => ({
          body: { i },
          concurrency: { key: 'my-limiter', limit: 2 },
        }))
      );

      // Should never exceed the concurrency limit
      expect(maxConcurrent).toBeLessThanOrEqual(2);
      expect(maxConcurrent).toBeGreaterThan(0);
      console.log(`Max concurrent executions: ${maxConcurrent} (limit: 2)`);
    });

    it('concurrency keys should work across different queues', async () => {
      const sim = createSimulator({
        queueMode: 'concurrent',
        storageLatency: true,
      });

      let maxConcurrent = 0;
      let currentConcurrent = 0;

      const handler = async () => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await new Promise((r) => setTimeout(r, 10));
        currentConcurrent--;
      };

      sim.registerConsumer('queue-a', handler);
      sim.registerConsumer('queue-b', handler);

      // Push to two different queues but same concurrency key
      await Promise.all([
        sim.queue.push('queue-a',
          Array.from({ length: 3 }, (_, i) => ({
            body: { queue: 'a', i },
            concurrency: { key: 'shared-limiter', limit: 1 },
          }))
        ),
        sim.queue.push('queue-b',
          Array.from({ length: 3 }, (_, i) => ({
            body: { queue: 'b', i },
            concurrency: { key: 'shared-limiter', limit: 1 },
          }))
        ),
      ]);

      // Shared concurrency key with limit 1 means truly serial across both queues
      expect(maxConcurrent).toBe(1);
      console.log(`Cross-queue concurrency: max ${maxConcurrent} (limit: 1)`);
    });

    it('unbounded concurrency when no concurrency key set', async () => {
      const sim = createSimulator({
        queueMode: 'concurrent',
      });

      let maxConcurrent = 0;
      let currentConcurrent = 0;

      sim.registerConsumer('work', async () => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await new Promise((r) => setTimeout(r, 5));
        currentConcurrent--;
      });

      await sim.queue.push('work',
        Array.from({ length: 5 }, (_, i) => ({ body: { i } }))
      );

      // Without concurrency key, all 5 should run in parallel
      expect(maxConcurrent).toBe(5);
      console.log(`Unbounded concurrency: ${maxConcurrent} parallel`);
    });
  });
});
