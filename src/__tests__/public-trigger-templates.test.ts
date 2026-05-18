/**
 * Public re-export surface for the trigger-template registry.
 *
 * The registry has existed in src/trigger-event-templates.ts since 2026-03-27
 * (141 templates: Confluence + Jira + Jira Software + App Lifecycle) but the
 * helpers were NOT re-exported from src/index.ts. Skill run #14 caught this
 * the hard way: the agent didn't know they existed, hand-rolled a fake
 * `updated:issue` payload, and shipped tests against a shape that doesn't
 * match what real Forge would deliver.
 *
 * These assertions test the *public package surface* — the same import path
 * an external user (or skill agent) would write: `from 'forge-sim'`.
 * Internal-only tests already cover the registry contents; this file's job
 * is to make sure they stay reachable through the front door.
 */
import { describe, it, expect } from 'vitest';
import {
  getTriggerEventTemplate,
  getTriggerEventTemplates,
  getTriggerEventTemplateMap,
  getConfluenceLabelVariantSamples,
  type TriggerEventTemplate,
} from '../index.js';

describe('public re-export — trigger event templates', () => {
  it('getTriggerEventTemplate() resolves a known Jira event from the package root', () => {
    const template = getTriggerEventTemplate('avi:jira:updated:issue');
    expect(template).toBeDefined();
    expect(template?.event).toBe('avi:jira:updated:issue');
    expect(template?.product).toBe('jira');
    expect(template?.samplePayload).toBeTypeOf('object');
    // The sample must look like a real Forge trigger payload, not the
    // hand-rolled shape skill run #14's agent invented.
    expect(template?.samplePayload).toHaveProperty('issue');
  });

  it('getTriggerEventTemplate() returns undefined for unknown events', () => {
    expect(getTriggerEventTemplate('avi:made-up:event:nope')).toBeUndefined();
  });

  it('getTriggerEventTemplates() returns the full registry by default', () => {
    const all = getTriggerEventTemplates();
    // 141 templates committed 2026-03-27 — exact count is a snapshot, but
    // anything less than 100 means the registry got accidentally trimmed.
    expect(all.length).toBeGreaterThanOrEqual(100);
    expect(all.every((t) => typeof t.event === 'string')).toBe(true);
    expect(all.every((t) => typeof t.samplePayload === 'object')).toBe(true);
  });

  it('getTriggerEventTemplates(iter) filters by event names without dupes', () => {
    const events = [
      'avi:jira:created:issue',
      'avi:jira:updated:issue',
      'avi:jira:created:issue', // dup — should collapse
      'avi:not-a-real-event',   // unknown — should drop
    ];
    const filtered = getTriggerEventTemplates(events);
    expect(filtered.map((t) => t.event)).toEqual([
      'avi:jira:created:issue',
      'avi:jira:updated:issue',
    ]);
  });

  it('getTriggerEventTemplateMap() returns a keyed object', () => {
    const map = getTriggerEventTemplateMap([
      'avi:jira:created:issue',
      'avi:confluence:updated:page',
    ]);
    expect(map['avi:jira:created:issue']).toBeDefined();
    expect(map['avi:confluence:updated:page']).toBeDefined();
    expect(map['avi:jira:created:issue']?.product).toBe('jira');
    expect(map['avi:confluence:updated:page']?.product).toBe('confluence');
  });

  it('getConfluenceLabelVariantSamples() exposes the three label variants', () => {
    const variants = getConfluenceLabelVariantSamples();
    expect(variants).toHaveProperty('content');
    expect(variants).toHaveProperty('space');
    expect(variants).toHaveProperty('template');
    expect(variants.content).toBeTypeOf('object');
    expect(variants.space).toBeTypeOf('object');
    expect(variants.template).toBeTypeOf('object');
  });

  it('TriggerEventTemplate type is exported as a type (compile-time)', () => {
    // This is a compile-time check disguised as a runtime expect. If the
    // `type { TriggerEventTemplate }` re-export gets dropped, this file
    // fails to typecheck before vitest ever runs.
    const t: TriggerEventTemplate | undefined = getTriggerEventTemplate('avi:jira:created:issue');
    expect(t?.event).toBe('avi:jira:created:issue');
  });

  it('returned templates are clones — mutation does not corrupt the registry', () => {
    // The registry helpers clone before returning so a careless `sample` edit
    // by user code doesn't poison the next caller. Verify that contract holds
    // through the public surface, not just internal.
    const first = getTriggerEventTemplate('avi:jira:created:issue');
    expect(first).toBeDefined();
    if (first) {
      (first.samplePayload as Record<string, unknown>).__poison__ = 'do not leak';
    }
    const second = getTriggerEventTemplate('avi:jira:created:issue');
    expect((second?.samplePayload as Record<string, unknown>)?.__poison__).toBeUndefined();
  });
});
