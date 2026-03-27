import { describe, expect, it } from 'vitest';
import {
  getTriggerEventTemplate,
  getTriggerEventTemplates,
  getConfluenceLabelVariantSamples,
} from '../trigger-event-templates.js';

describe('trigger event templates', () => {
  it('returns a representative Confluence page template', () => {
    const template = getTriggerEventTemplate('avi:confluence:created:page');

    expect(template).toBeDefined();
    expect(template?.product).toBe('confluence');
    expect(template?.family).toBe('content');
    expect(template?.samplePayload.eventType).toBe('avi:confluence:created:page');
    expect((template?.samplePayload.content as any).type).toBe('page');
    expect(template?.notes?.[0]).toContain('pages and live docs');
  });

  it('includes event-specific fields for special content events', () => {
    const movedPage = getTriggerEventTemplate('avi:confluence:moved:page');
    const reorderedChildren = getTriggerEventTemplate('avi:confluence:children_reordered:page');
    const updatedTask = getTriggerEventTemplate('avi:confluence:updated:task');

    expect(movedPage?.samplePayload.prevContent).toBeDefined();
    expect(reorderedChildren?.samplePayload.oldSortedChildPageIds).toBeDefined();
    expect(reorderedChildren?.samplePayload.newSortedChildPageIds).toBeDefined();
    expect(updatedTask?.samplePayload.oldTask).toBeDefined();
  });

  it('covers non-page Confluence families too', () => {
    expect((getTriggerEventTemplate('avi:confluence:created:whiteboard')?.samplePayload.content as any).type).toBe('whiteboard');
    expect(getTriggerEventTemplate('avi:confluence:created:user')?.samplePayload.atlassianId).toBeUndefined();
    expect(getTriggerEventTemplate('avi:confluence:created:group')?.samplePayload.atlassianId).toBeUndefined();
    expect(getTriggerEventTemplate('avi:confluence:performed:search')?.samplePayload.query).toBe('test search');
  });

  it('provides label variant samples for downstream UI or API consumers', () => {
    const variants = getConfluenceLabelVariantSamples();

    expect(variants.content).toHaveProperty('labels');
    expect(variants.space).toHaveProperty('homepage');
    expect(variants.template).toHaveProperty('templateId');
  });

  it('filters templates to the requested event list', () => {
    const templates = getTriggerEventTemplates([
      'avi:confluence:created:page',
      'avi:confluence:performed:search',
      'avi:jira:created:issue',
      'avi:confluence:created:page',
    ]);

    expect(templates.map((template) => template.event)).toEqual([
      'avi:confluence:created:page',
      'avi:confluence:performed:search',
      'avi:jira:created:issue',
    ]);
  });
});
