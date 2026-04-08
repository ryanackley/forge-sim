/**
 * Tests for SimulatedRealtime — the @forge/realtime + bridge realtime backend.
 *
 * Covers:
 *   - Scoped publish/subscribe (module-keyed channels)
 *   - Global publish/subscribe
 *   - Subscriber isolation (scoped vs global, different modules)
 *   - Event replay (replaySeconds)
 *   - Unsubscribe
 *   - signRealtimeToken
 *   - Event log inspection
 *   - Bridge-side publish
 *   - Reset clears all state
 *   - Error handling in subscriber callbacks
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SimulatedRealtime } from '../realtime.js';

describe('SimulatedRealtime', () => {
  let rt: SimulatedRealtime;

  beforeEach(() => {
    rt = new SimulatedRealtime();
  });

  // ── Scoped publish/subscribe ─────────────────────────────────────────

  describe('scoped channels', () => {
    it('delivers events to subscribers on the same scoped channel', async () => {
      const received: any[] = [];
      rt.setModuleContext('jira:issuePanel:panel1');
      rt.subscribe('updates', (p) => received.push(p), 'jira:issuePanel:panel1');

      await rt.publish('updates', { status: 'done' });

      expect(received).toEqual([{ status: 'done' }]);
    });

    it('does NOT deliver scoped events to a different module', async () => {
      const received: any[] = [];
      // Subscribe from module A
      rt.subscribe('updates', (p) => received.push(p), 'moduleA');

      // Publish from module B
      rt.setModuleContext('moduleB');
      await rt.publish('updates', 'hello');

      expect(received).toHaveLength(0);
    });

    it('does NOT deliver scoped events to global subscribers', async () => {
      const received: any[] = [];
      rt.subscribeGlobal('updates', (p) => received.push(p));

      rt.setModuleContext('myModule');
      await rt.publish('updates', 'scoped event');

      expect(received).toHaveLength(0);
    });
  });

  // ── Global publish/subscribe ──────────────────────────────────────────

  describe('global channels', () => {
    it('delivers global events to subscribeGlobal subscribers', async () => {
      const received: any[] = [];
      rt.subscribeGlobal('broadcast', (p) => received.push(p));

      await rt.publishGlobal('broadcast', 'hello everyone');

      expect(received).toEqual(['hello everyone']);
    });

    it('does NOT deliver global events to scoped subscribers', async () => {
      const received: any[] = [];
      rt.subscribe('broadcast', (p) => received.push(p), 'myModule');

      await rt.publishGlobal('broadcast', 'global event');

      expect(received).toHaveLength(0);
    });

    it('delivers to multiple global subscribers', async () => {
      const received1: any[] = [];
      const received2: any[] = [];
      rt.subscribeGlobal('multi', (p) => received1.push(p));
      rt.subscribeGlobal('multi', (p) => received2.push(p));

      await rt.publishGlobal('multi', { n: 42 });

      expect(received1).toEqual([{ n: 42 }]);
      expect(received2).toEqual([{ n: 42 }]);
    });
  });

  // ── Unsubscribe ───────────────────────────────────────────────────────

  describe('unsubscribe', () => {
    it('stops receiving events after unsubscribe', async () => {
      const received: any[] = [];
      const sub = rt.subscribeGlobal('ch', (p) => received.push(p));

      await rt.publishGlobal('ch', 'before');
      sub.unsubscribe();
      await rt.publishGlobal('ch', 'after');

      expect(received).toEqual(['before']);
    });

    it('only removes the specific subscription, not all on the channel', async () => {
      const r1: any[] = [];
      const r2: any[] = [];
      const sub1 = rt.subscribeGlobal('ch', (p) => r1.push(p));
      rt.subscribeGlobal('ch', (p) => r2.push(p));

      sub1.unsubscribe();
      await rt.publishGlobal('ch', 'test');

      expect(r1).toHaveLength(0);
      expect(r2).toEqual(['test']);
    });
  });

  // ── PublishResult ─────────────────────────────────────────────────────

  describe('publish result', () => {
    it('returns eventId and timestamp when subscribers exist', async () => {
      rt.subscribeGlobal('ch', () => {});
      const result = await rt.publishGlobal('ch', 'test');

      expect(result.eventId).toMatch(/^rt-evt-\d+$/);
      expect(result.eventTimestamp).toBeTruthy();
      expect(result.errors).toEqual([]);
    });

    it('returns null eventId when no subscribers', async () => {
      const result = await rt.publishGlobal('empty', 'test');

      expect(result.eventId).toBeNull();
      expect(result.eventTimestamp).toBeNull();
    });
  });

  // ── Event replay ──────────────────────────────────────────────────────

  describe('replay', () => {
    it('replays recent events on subscribe with replaySeconds', async () => {
      // Publish first, then subscribe with replay
      await rt.publishGlobal('live', 'event1');
      await rt.publishGlobal('live', 'event2');

      const received: any[] = [];
      rt.subscribeGlobal('live', (p) => received.push(p), { replaySeconds: 60 });

      expect(received).toEqual(['event1', 'event2']);
    });

    it('does not replay events from other channels', async () => {
      await rt.publishGlobal('channelA', 'a-event');
      await rt.publishGlobal('channelB', 'b-event');

      const received: any[] = [];
      rt.subscribeGlobal('channelA', (p) => received.push(p), { replaySeconds: 60 });

      expect(received).toEqual(['a-event']);
    });

    it('does not replay without replaySeconds option', async () => {
      await rt.publishGlobal('ch', 'old');

      const received: any[] = [];
      rt.subscribeGlobal('ch', (p) => received.push(p));

      expect(received).toHaveLength(0);
    });
  });

  // ── signRealtimeToken ─────────────────────────────────────────────────

  describe('signRealtimeToken', () => {
    it('returns a token and expiry', async () => {
      const result = await rt.signRealtimeToken('ch', { userId: 'abc' });

      expect(result.token).toContain('sim-rt-token:ch:');
      expect(result.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(result.errors).toBeUndefined();
    });
  });

  // ── Bridge-side publish ───────────────────────────────────────────────

  describe('bridge publish', () => {
    it('publishFromBridge delivers to scoped subscribers', async () => {
      const received: any[] = [];
      rt.subscribe('updates', (p) => received.push(p), 'mod1');

      await rt.publishFromBridge('updates', 'from-frontend', 'mod1');

      expect(received).toEqual(['from-frontend']);
    });

    it('publishGlobalFromBridge delivers to global subscribers', async () => {
      const received: any[] = [];
      rt.subscribeGlobal('broadcast', (p) => received.push(p));

      await rt.publishGlobalFromBridge('broadcast', { from: 'bridge' });

      expect(received).toEqual([{ from: 'bridge' }]);
    });
  });

  // ── Event log ─────────────────────────────────────────────────────────

  describe('event log', () => {
    it('records all published events', async () => {
      await rt.publishGlobal('ch1', 'a');
      rt.setModuleContext('mod');
      await rt.publish('ch2', 'b');

      const log = rt.getEventLog();
      expect(log).toHaveLength(2);
      expect(log[0].channel).toBe('ch1');
      expect(log[0].global).toBe(true);
      expect(log[1].channel).toBe('ch2');
      expect(log[1].global).toBe(false);
    });

    it('returns a copy of the log', () => {
      const l1 = rt.getEventLog();
      const l2 = rt.getEventLog();
      expect(l1).not.toBe(l2);
    });
  });

  // ── Subscription inspection ───────────────────────────────────────────

  describe('getSubscriptions', () => {
    it('lists active subscriptions with counts', () => {
      rt.subscribeGlobal('ch1', () => {});
      rt.subscribeGlobal('ch1', () => {});
      rt.subscribeGlobal('ch2', () => {});

      const subs = rt.getSubscriptions();
      expect(subs).toHaveLength(2);

      const ch1 = subs.find(s => s.channelKey === 'global:ch1');
      expect(ch1?.subscriberCount).toBe(2);

      const ch2 = subs.find(s => s.channelKey === 'global:ch2');
      expect(ch2?.subscriberCount).toBe(1);
    });

    it('does not list channels after all subscribers unsubscribe', () => {
      const sub = rt.subscribeGlobal('ch', () => {});
      sub.unsubscribe();

      const subs = rt.getSubscriptions();
      expect(subs).toHaveLength(0);
    });
  });

  // ── Reset ─────────────────────────────────────────────────────────────

  describe('reset', () => {
    it('clears subscribers, event log, and module context', async () => {
      rt.subscribeGlobal('ch', () => {});
      await rt.publishGlobal('ch', 'test');
      rt.setModuleContext('mod');

      rt.reset();

      expect(rt.getSubscriptions()).toHaveLength(0);
      expect(rt.getEventLog()).toHaveLength(0);
      expect(rt.getModuleContext()).toBeNull();
    });
  });

  // ── Error handling ────────────────────────────────────────────────────

  describe('error handling', () => {
    it('does not stop delivery to other subscribers if one throws', async () => {
      const received: any[] = [];
      rt.subscribeGlobal('ch', () => { throw new Error('boom'); });
      rt.subscribeGlobal('ch', (p) => received.push(p));

      await rt.publishGlobal('ch', 'test');

      expect(received).toEqual(['test']);
    });
  });

  // ── onPublish listener (dev server WS push) ────────────────────────────

  describe('onPublish', () => {
    it('fires external listener on every publish', async () => {
      const events: any[] = [];
      rt.onPublish((e) => events.push(e));

      await rt.publishGlobal('ch', 'hello');

      expect(events).toHaveLength(1);
      expect(events[0].channel).toBe('ch');
      expect(events[0].payload).toBe('hello');
      expect(events[0].global).toBe(true);
      expect(events[0].eventId).toMatch(/^rt-evt-/);
    });

    it('fires on scoped publish too', async () => {
      const events: any[] = [];
      rt.onPublish((e) => events.push(e));

      rt.setModuleContext('mod');
      await rt.publish('progress', { percent: 50 });

      expect(events).toHaveLength(1);
      expect(events[0].global).toBe(false);
      expect(events[0].channelKey).toBe('scoped:mod:progress');
    });

    it('returns unbind function', async () => {
      const events: any[] = [];
      const unbind = rt.onPublish((e) => events.push(e));

      await rt.publishGlobal('ch', 'before');
      unbind();
      await rt.publishGlobal('ch', 'after');

      expect(events).toHaveLength(1);
      expect(events[0].payload).toBe('before');
    });

    it('survives reset (publish listeners are external, not cleared)', async () => {
      const events: any[] = [];
      rt.onPublish((e) => events.push(e));

      rt.reset();
      await rt.publishGlobal('ch', 'after-reset');

      expect(events).toHaveLength(1);
    });

    it('does not crash if listener throws', async () => {
      rt.onPublish(() => { throw new Error('boom'); });
      const events: any[] = [];
      rt.onPublish((e) => events.push(e));

      await rt.publishGlobal('ch', 'test');
      expect(events).toHaveLength(1);
    });
  });

  // ── Logging ──────────────────────────────────────────────────────────

  describe('logging', () => {
    it('calls logFn on publish and subscribe', async () => {
      const logFn = vi.fn();
      const logged = new SimulatedRealtime(logFn);

      logged.subscribeGlobal('ch', () => {});
      await logged.publishGlobal('ch', 'hello');

      expect(logFn).toHaveBeenCalledWith('info', expect.stringContaining('subscribe'), expect.anything());
      expect(logFn).toHaveBeenCalledWith('info', expect.stringContaining('publishGlobal'), expect.anything());
    });
  });
});
