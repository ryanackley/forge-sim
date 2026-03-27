/**
 * Tests for Jira Software trigger event templates (avi:jira-software:*).
 *
 * Note: The task referenced a JSM (Jira Service Management) events page at
 * https://developer.atlassian.com/platform/forge/events-reference/jira-service-management/
 * which returns 404 as of March 2026. The Jira Software events page covers boards
 * and sprints — the documented product-specific events under the `avi:jira-software:`
 * namespace. These tests cover those events under the 'jira-software' product.
 */
import { describe, expect, it } from 'vitest';
import { getTriggerEventTemplate, getTriggerEventTemplates } from '../trigger-event-templates.js';

describe('Jira Software trigger event templates', () => {
  // ── Board created / updated / deleted ─────────────────────────────────────

  it('returns board created, updated, and deleted templates', () => {
    for (const event of [
      'avi:jira-software:created:board',
      'avi:jira-software:updated:board',
      'avi:jira-software:deleted:board',
    ]) {
      const template = getTriggerEventTemplate(event);
      expect(template).toBeDefined();
      expect(template?.product).toBe('jira-software');
      expect(template?.family).toBe('board');
      expect(template?.samplePayload.eventType).toBe(event);
    }
  });

  it('board event payload has board with id, name, and type', () => {
    const template = getTriggerEventTemplate('avi:jira-software:created:board');
    const board = template?.samplePayload.board as Record<string, unknown>;
    expect(board.id).toBeDefined();
    expect(typeof board.name).toBe('string');
    expect(['simple', 'scrum', 'kanban']).toContain(board.type);
  });

  it('board event payload has atlassianId', () => {
    const template = getTriggerEventTemplate('avi:jira-software:created:board');
    expect(template?.samplePayload.atlassianId).toBeDefined();
  });

  it('board deleted template notes mention cascading events NOT emitted', () => {
    const template = getTriggerEventTemplate('avi:jira-software:deleted:board');
    expect(template?.notes?.some((n) => n.toLowerCase().includes('cascading'))).toBe(true);
  });

  // ── Board configuration changed ───────────────────────────────────────────

  it('returns board configuration-changed template', () => {
    const template = getTriggerEventTemplate('avi:jira-software:configuration-changed:board');
    expect(template).toBeDefined();
    expect(template?.product).toBe('jira-software');
    expect(template?.family).toBe('board');
    expect(template?.samplePayload.eventType).toBe('avi:jira-software:configuration-changed:board');
  });

  it('board configuration payload has configuration with id, name, type, filter, columnConfig, ranking', () => {
    const template = getTriggerEventTemplate('avi:jira-software:configuration-changed:board');
    const config = template?.samplePayload.configuration as Record<string, unknown>;
    expect(typeof config.id).toBe('number');
    expect(typeof config.name).toBe('string');
    expect(['simple', 'scrum', 'kanban']).toContain(config.type);
    const filter = config.filter as Record<string, unknown>;
    expect(filter.id).toBeDefined();
    const columnConfig = config.columnConfig as Record<string, unknown>;
    expect(Array.isArray(columnConfig.columns)).toBe(true);
    expect(config.ranking).toBeDefined();
  });

  it('board configuration columns have name and statuses arrays', () => {
    const template = getTriggerEventTemplate('avi:jira-software:configuration-changed:board');
    const config = template?.samplePayload.configuration as Record<string, unknown>;
    const columnConfig = config.columnConfig as Record<string, unknown>;
    const columns = columnConfig.columns as Array<Record<string, unknown>>;
    expect(columns.length).toBeGreaterThan(0);
    for (const col of columns) {
      expect(typeof col.name).toBe('string');
      expect(Array.isArray(col.statuses)).toBe(true);
    }
  });

  // ── Sprint events ─────────────────────────────────────────────────────────

  it('returns templates for all five sprint events', () => {
    for (const event of [
      'avi:jira-software:created:sprint',
      'avi:jira-software:started:sprint',
      'avi:jira-software:updated:sprint',
      'avi:jira-software:closed:sprint',
      'avi:jira-software:deleted:sprint',
    ]) {
      const template = getTriggerEventTemplate(event);
      expect(template).toBeDefined();
      expect(template?.product).toBe('jira-software');
      expect(template?.family).toBe('sprint');
      expect(template?.samplePayload.eventType).toBe(event);
    }
  });

  it('sprint payload has sprint with id, name, state, and originBoardId', () => {
    const template = getTriggerEventTemplate('avi:jira-software:created:sprint');
    const sprint = template?.samplePayload.sprint as Record<string, unknown>;
    expect(typeof sprint.id).toBe('string');
    expect(typeof sprint.name).toBe('string');
    expect(typeof sprint.state).toBe('string');
    expect(sprint.originBoardId).toBeDefined();
  });

  it('sprint states are appropriate for each event', () => {
    const created = getTriggerEventTemplate('avi:jira-software:created:sprint');
    const started = getTriggerEventTemplate('avi:jira-software:started:sprint');
    const closed = getTriggerEventTemplate('avi:jira-software:closed:sprint');
    expect((created?.samplePayload.sprint as Record<string, unknown>).state).toBe('future');
    expect((started?.samplePayload.sprint as Record<string, unknown>).state).toBe('active');
    expect((closed?.samplePayload.sprint as Record<string, unknown>).state).toBe('closed');
  });

  it('sprint updated template includes oldValue with changed fields', () => {
    const template = getTriggerEventTemplate('avi:jira-software:updated:sprint');
    const oldValue = template?.samplePayload.oldValue as Record<string, unknown> | undefined;
    expect(oldValue).toBeDefined();
    expect(oldValue?.goal).toBeDefined();
  });

  it('non-updated sprint templates do not have oldValue', () => {
    for (const event of [
      'avi:jira-software:created:sprint',
      'avi:jira-software:started:sprint',
      'avi:jira-software:closed:sprint',
      'avi:jira-software:deleted:sprint',
    ]) {
      const template = getTriggerEventTemplate(event);
      expect(template?.samplePayload.oldValue).toBeUndefined();
    }
  });

  // ── Aggregate coverage ────────────────────────────────────────────────────

  it('returns exactly 9 jira-software templates', () => {
    const all = getTriggerEventTemplates();
    const jiraSw = all.filter((t) => t.product === 'jira-software');
    // 4 board events (created, updated, deleted, config-changed) + 5 sprint events
    expect(jiraSw).toHaveLength(9);
  });

  it('every jira-software template has required fields', () => {
    const all = getTriggerEventTemplates();
    for (const template of all.filter((t) => t.product === 'jira-software')) {
      expect(template.product).toBe('jira-software');
      expect(template.event).toMatch(/^avi:jira-software:/);
      expect(template.family).toBeTruthy();
      expect(template.samplePayload.eventType).toBe(template.event);
    }
  });

  it('getTriggerEventTemplate returns undefined for unknown jira-software events', () => {
    expect(getTriggerEventTemplate('avi:jira-software:nonexistent:thing')).toBeUndefined();
  });

  it('getTriggerEventTemplate returns deep clones (mutations do not affect future calls)', () => {
    const first = getTriggerEventTemplate('avi:jira-software:created:board');
    (first!.samplePayload as Record<string, unknown>).__mutated = true;
    const second = getTriggerEventTemplate('avi:jira-software:created:board');
    expect((second!.samplePayload as Record<string, unknown>).__mutated).toBeUndefined();
  });
});
