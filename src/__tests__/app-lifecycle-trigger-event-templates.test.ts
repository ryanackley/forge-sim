import { describe, expect, it } from 'vitest';
import { getTriggerEventTemplate, getTriggerEventTemplates } from '../trigger-event-templates.js';

describe('App Lifecycle trigger event templates', () => {
  // ── Installed ─────────────────────────────────────────────────────────────

  it('returns the installed:app template', () => {
    const template = getTriggerEventTemplate('avi:forge:installed:app');
    expect(template).toBeDefined();
    expect(template?.product).toBe('app-lifecycle');
    expect(template?.family).toBe('lifecycle');
  });

  it('installed:app payload has id, installerAccountId, app, and environment', () => {
    const template = getTriggerEventTemplate('avi:forge:installed:app');
    const p = template?.samplePayload as Record<string, unknown>;
    expect(typeof p.id).toBe('string');
    expect(typeof p.installerAccountId).toBe('string');
    const app = p.app as Record<string, unknown>;
    expect(typeof app.id).toBe('string');
    expect(typeof app.version).toBe('string');
    const env = p.environment as Record<string, unknown>;
    expect(typeof env.id).toBe('string');
  });

  it('installed:app payload does NOT have eventType (lifecycle events omit it)', () => {
    const template = getTriggerEventTemplate('avi:forge:installed:app');
    expect(template?.samplePayload.eventType).toBeUndefined();
  });

  it('installed:app notes warn about missing eventType', () => {
    const template = getTriggerEventTemplate('avi:forge:installed:app');
    expect(template?.notes?.some((n) => n.includes('eventType'))).toBe(true);
  });

  // ── Upgraded ──────────────────────────────────────────────────────────────

  it('returns the upgraded:app template', () => {
    const template = getTriggerEventTemplate('avi:forge:upgraded:app');
    expect(template).toBeDefined();
    expect(template?.product).toBe('app-lifecycle');
    expect(template?.family).toBe('lifecycle');
  });

  it('upgraded:app payload has upgraderAccountId and permissions', () => {
    const template = getTriggerEventTemplate('avi:forge:upgraded:app');
    const p = template?.samplePayload as Record<string, unknown>;
    expect(typeof p.upgraderAccountId).toBe('string');
    const permissions = p.permissions as Record<string, unknown>;
    expect(Array.isArray(permissions.scopes)).toBe(true);
    expect(permissions.external).toBeDefined();
  });

  it('upgraded:app payload does NOT have eventType', () => {
    const template = getTriggerEventTemplate('avi:forge:upgraded:app');
    expect(template?.samplePayload.eventType).toBeUndefined();
  });

  it('upgraded:app notes mention major-version-only behaviour', () => {
    const template = getTriggerEventTemplate('avi:forge:upgraded:app');
    expect(template?.notes?.some((n) => n.toLowerCase().includes('major'))).toBe(true);
  });

  it('upgraded:app app object has same shape as installed:app', () => {
    const installed = getTriggerEventTemplate('avi:forge:installed:app');
    const upgraded = getTriggerEventTemplate('avi:forge:upgraded:app');
    const installedApp = installed?.samplePayload.app as Record<string, unknown>;
    const upgradedApp = upgraded?.samplePayload.app as Record<string, unknown>;
    expect(Object.keys(installedApp).sort()).toEqual(Object.keys(upgradedApp).sort());
  });

  // ── Aggregate coverage ────────────────────────────────────────────────────

  it('returns exactly 2 app-lifecycle templates', () => {
    const all = getTriggerEventTemplates();
    const appLifecycle = all.filter((t) => t.product === 'app-lifecycle');
    expect(appLifecycle).toHaveLength(2);
  });

  it('every app-lifecycle template has required fields', () => {
    const all = getTriggerEventTemplates();
    for (const template of all.filter((t) => t.product === 'app-lifecycle')) {
      expect(template.product).toBe('app-lifecycle');
      expect(template.event).toMatch(/^avi:forge:/);
      expect(template.family).toBeTruthy();
      // Intentionally NO check for samplePayload.eventType (lifecycle events omit it)
    }
  });

  it('getTriggerEventTemplate returns undefined for unknown lifecycle events', () => {
    expect(getTriggerEventTemplate('avi:forge:nonexistent:app')).toBeUndefined();
  });

  it('getTriggerEventTemplate returns deep clones (mutations do not affect future calls)', () => {
    const first = getTriggerEventTemplate('avi:forge:installed:app');
    (first!.samplePayload as Record<string, unknown>).__mutated = true;
    const second = getTriggerEventTemplate('avi:forge:installed:app');
    expect((second!.samplePayload as Record<string, unknown>).__mutated).toBeUndefined();
  });
});
