import { describe, expect, it } from 'vitest';
import { getTriggerEventTemplate, getTriggerEventTemplates } from '../trigger-event-templates.js';

describe('Jira trigger event templates', () => {
  // ── Basic coverage ────────────────────────────────────────────────────────

  it('returns a Jira issue created template', () => {
    const template = getTriggerEventTemplate('avi:jira:created:issue');
    expect(template).toBeDefined();
    expect(template?.product).toBe('jira');
    expect(template?.family).toBe('issue');
    expect(template?.samplePayload.eventType).toBe('avi:jira:created:issue');
    expect(template?.samplePayload.timestamp).toBeDefined();
    const issue = template?.samplePayload.issue as Record<string, unknown>;
    expect(issue.key).toMatch(/^DEMO-/);
    expect((issue.fields as Record<string, unknown>).summary).toBeDefined();
  });

  it('issue updated template includes changelog and jiraEventTypeName', () => {
    const template = getTriggerEventTemplate('avi:jira:updated:issue');
    expect(template?.samplePayload.changelog).toBeDefined();
    const changelog = template?.samplePayload.changelog as Record<string, unknown>;
    expect(Array.isArray(changelog.items)).toBe(true);
    expect(template?.samplePayload.jiraEventTypeName).toBe('issue_generic');
    expect(template?.samplePayload.associatedStatuses).toBeDefined();
  });

  it('issue deleted template has cascading note', () => {
    const template = getTriggerEventTemplate('avi:jira:deleted:issue');
    expect(template?.notes?.some((n) => n.includes('Cascading'))).toBe(true);
  });

  it('issue assigned template has changelog with assignee change', () => {
    const template = getTriggerEventTemplate('avi:jira:assigned:issue');
    const changelog = template?.samplePayload.changelog as Record<string, unknown>;
    const items = changelog.items as Array<Record<string, unknown>>;
    expect(items[0].field).toBe('assignee');
  });

  it('issue viewed template has required atlassianId and user', () => {
    const template = getTriggerEventTemplate('avi:jira:viewed:issue');
    expect(template?.samplePayload.atlassianId).toBeDefined();
    expect(template?.samplePayload.user).toBeDefined();
  });

  it('issue mentioned template has mentionedAccountIds', () => {
    const template = getTriggerEventTemplate('avi:jira:mentioned:issue');
    expect(Array.isArray(template?.samplePayload.mentionedAccountIds)).toBe(true);
    expect((template?.samplePayload.mentionedAccountIds as string[]).length).toBeGreaterThan(0);
  });

  // ── Issue link ────────────────────────────────────────────────────────────

  it('returns issue link created and deleted templates', () => {
    for (const event of ['avi:jira:created:issuelink', 'avi:jira:deleted:issuelink']) {
      const template = getTriggerEventTemplate(event);
      expect(template?.product).toBe('jira');
      expect(template?.family).toBe('issueLink');
      expect(template?.samplePayload.sourceIssueId).toBeDefined();
      expect(template?.samplePayload.destinationIssueId).toBeDefined();
      const linkType = template?.samplePayload.issueLinkType as Record<string, unknown>;
      expect(linkType.name).toBeDefined();
    }
  });

  // ── Worklog ───────────────────────────────────────────────────────────────

  it('returns worklog templates for created, updated, deleted', () => {
    for (const event of ['avi:jira:created:worklog', 'avi:jira:updated:worklog', 'avi:jira:deleted:worklog']) {
      const template = getTriggerEventTemplate(event);
      expect(template?.product).toBe('jira');
      const worklog = template?.samplePayload.worklog as Record<string, unknown>;
      expect(worklog.timeSpentSeconds).toBeDefined();
    }
  });

  // ── Issue type ────────────────────────────────────────────────────────────

  it('returns issue type templates for created, updated, deleted', () => {
    for (const event of ['avi:jira:created:issuetype', 'avi:jira:updated:issuetype', 'avi:jira:deleted:issuetype']) {
      const template = getTriggerEventTemplate(event);
      expect(template?.family).toBe('issueType');
      const issueType = template?.samplePayload.issueType as Record<string, unknown>;
      expect(issueType.name).toBeDefined();
      expect(typeof issueType.subtask).toBe('boolean');
    }
  });

  // ── Comments ──────────────────────────────────────────────────────────────

  it('comment on issue template has issue and comment', () => {
    const template = getTriggerEventTemplate('avi:jira:commented:issue');
    expect(template?.samplePayload.issue).toBeDefined();
    const comment = template?.samplePayload.comment as Record<string, unknown>;
    expect(comment.id).toBeDefined();
    expect(comment.body).toBeDefined();
  });

  it('mentioned in comment template has mentionedAccountIds and comment', () => {
    const template = getTriggerEventTemplate('avi:jira:mentioned:comment');
    expect(template?.samplePayload.comment).toBeDefined();
    expect(Array.isArray(template?.samplePayload.mentionedAccountIds)).toBe(true);
  });

  it('deleted comment template has issue and comment', () => {
    const template = getTriggerEventTemplate('avi:jira:deleted:comment');
    expect(template?.samplePayload.issue).toBeDefined();
    expect(template?.samplePayload.comment).toBeDefined();
  });

  // ── Custom fields ─────────────────────────────────────────────────────────

  it('returns custom field templates with all five lifecycle events', () => {
    for (const event of [
      'avi:jira:created:field',
      'avi:jira:updated:field',
      'avi:jira:trashed:field',
      'avi:jira:restored:field',
      'avi:jira:deleted:field',
    ]) {
      const template = getTriggerEventTemplate(event);
      expect(template?.family).toBe('customField');
      expect(template?.samplePayload.id).toBeDefined();
      expect(template?.samplePayload.key).toBeDefined();
      expect(template?.samplePayload.name).toBeDefined();
    }
  });

  it('returns custom field context templates', () => {
    for (const event of [
      'avi:jira:created:field:context',
      'avi:jira:updated:field:context',
      'avi:jira:deleted:field:context',
    ]) {
      const template = getTriggerEventTemplate(event);
      expect(template?.family).toBe('customFieldContext');
      expect(Array.isArray(template?.samplePayload.projectIds)).toBe(true);
      expect(Array.isArray(template?.samplePayload.issueTypeIds)).toBe(true);
    }
  });

  it('returns custom field context configuration update template', () => {
    const template = getTriggerEventTemplate('avi:jira:updated:field:context:configuration');
    expect(template?.family).toBe('customFieldContext');
    expect(typeof template?.samplePayload.configuration).toBe('string');
    // configuration is stringified JSON
    expect(() => JSON.parse(template?.samplePayload.configuration as string)).not.toThrow();
  });

  // ── Workflow ──────────────────────────────────────────────────────────────

  it('expression failed template has errorMessages and context', () => {
    const template = getTriggerEventTemplate('avi:jira:failed:expression');
    expect(template?.family).toBe('workflow');
    expect(Array.isArray(template?.samplePayload.errorMessages)).toBe(true);
    expect(template?.samplePayload.expression).toBeDefined();
    expect(template?.samplePayload.context).toBeDefined();
  });

  // ── Project versions ──────────────────────────────────────────────────────

  it('returns all version lifecycle event templates', () => {
    const versionEvents = [
      'avi:jira:created:version',
      'avi:jira:updated:version',
      'avi:jira:released:version',
      'avi:jira:unreleased:version',
      'avi:jira:archived:version',
      'avi:jira:unarchived:version',
      'avi:jira:moved:version',
      'avi:jira:merged:version',
      'avi:jira:deleted:version',
    ];
    for (const event of versionEvents) {
      const template = getTriggerEventTemplate(event);
      expect(template?.family).toBe('version');
      const version = template?.samplePayload.version as Record<string, unknown>;
      expect(version.id).toBeDefined();
      expect(typeof version.projectId).toBe('number');
    }
  });

  it('merged version template includes mergedVersion', () => {
    const template = getTriggerEventTemplate('avi:jira:merged:version');
    expect(template?.samplePayload.mergedVersion).toBeDefined();
  });

  it('deleted version template includes replacement version fields', () => {
    const template = getTriggerEventTemplate('avi:jira:deleted:version');
    expect(template?.samplePayload.newAffectsVersion).toBeDefined();
    expect(template?.samplePayload.newFixVersion).toBeDefined();
    expect(Array.isArray(template?.samplePayload.customFieldReplacements)).toBe(true);
  });

  // ── Projects ──────────────────────────────────────────────────────────────

  it('returns all project event templates', () => {
    for (const event of [
      'avi:jira:created:project',
      'avi:jira:updated:project',
      'avi:jira:softdeleted:project',
      'avi:jira:deleted:project',
      'avi:jira:archived:project',
      'avi:jira:unarchived:project',
      'avi:jira:restored:project',
    ]) {
      const template = getTriggerEventTemplate(event);
      expect(template?.family).toBe('project');
      const project = template?.samplePayload.project as Record<string, unknown>;
      expect(project.key).toBeDefined();
    }
  });

  // ── Attachments ───────────────────────────────────────────────────────────

  it('returns attachment created and deleted templates', () => {
    for (const event of ['avi:jira:created:attachment', 'avi:jira:deleted:attachment']) {
      const template = getTriggerEventTemplate(event);
      expect(template?.family).toBe('attachment');
      const attachment = template?.samplePayload.attachment as Record<string, unknown>;
      expect(attachment.filename).toBeDefined();
      expect(attachment.mimeType).toBeDefined();
    }
  });

  // ── Components ────────────────────────────────────────────────────────────

  it('returns component event templates', () => {
    for (const event of [
      'avi:jira:created:component',
      'avi:jira:updated:component',
      'avi:jira:deleted:component',
    ]) {
      const template = getTriggerEventTemplate(event);
      expect(template?.family).toBe('component');
      const component = template?.samplePayload.component as Record<string, unknown>;
      expect(component.name).toBeDefined();
    }
  });

  // ── Users ─────────────────────────────────────────────────────────────────

  it('user created/updated templates have groups and applicationRoles', () => {
    for (const event of ['avi:jira:created:user', 'avi:jira:updated:user']) {
      const template = getTriggerEventTemplate(event);
      expect(template?.family).toBe('user');
      const user = template?.samplePayload.user as Record<string, unknown>;
      expect(user.groups).toBeDefined();
      expect(user.applicationRoles).toBeDefined();
    }
  });

  it('user deleted template has simpler user object (no groups)', () => {
    const template = getTriggerEventTemplate('avi:jira:deleted:user');
    const user = template?.samplePayload.user as Record<string, unknown>;
    expect(user.accountId).toBeDefined();
    expect(user.groups).toBeUndefined();
  });

  // ── Filters ───────────────────────────────────────────────────────────────

  it('returns filter event templates with JQL', () => {
    for (const event of ['avi:jira:created:filter', 'avi:jira:updated:filter', 'avi:jira:deleted:filter']) {
      const template = getTriggerEventTemplate(event);
      expect(template?.family).toBe('filter');
      const filter = template?.samplePayload.filter as Record<string, unknown>;
      expect(filter.jql).toBeDefined();
    }
  });

  // ── Configuration ─────────────────────────────────────────────────────────

  it('time tracking provider changed template has property with jira.timetracking.selected key', () => {
    const template = getTriggerEventTemplate('avi:jira:timetracking:provider:changed');
    expect(template?.family).toBe('configuration');
    const property = template?.samplePayload.property as Record<string, unknown>;
    expect(property.key).toBe('jira.timetracking.selected');
  });

  it('configuration changed template has property with a jira.option.* key', () => {
    const template = getTriggerEventTemplate('avi:jira:changed:configuration');
    expect(template?.family).toBe('configuration');
    const property = template?.samplePayload.property as Record<string, unknown>;
    expect((property.key as string).startsWith('jira.option.')).toBe(true);
    expect(['true', 'false']).toContain(property.value as string);
  });

  // ── Aggregate coverage ────────────────────────────────────────────────────

  it('returns all Jira templates when queried with no filter', () => {
    const allTemplates = getTriggerEventTemplates();
    const jiraTemplates = allTemplates.filter((t) => t.product === 'jira');
    // Must cover at least the documented event count (we have 50+)
    expect(jiraTemplates.length).toBeGreaterThanOrEqual(50);
  });

  it('every Jira template has required fields', () => {
    const allTemplates = getTriggerEventTemplates();
    for (const template of allTemplates.filter((t) => t.product === 'jira')) {
      expect(template.product).toBe('jira');
      expect(template.event).toMatch(/^avi:jira:/);
      expect(template.family).toBeTruthy();
      expect(template.samplePayload.eventType).toBe(template.event);
      expect(template.samplePayload.timestamp).toBeDefined();
    }
  });

  it('getTriggerEventTemplate returns undefined for unknown events', () => {
    expect(getTriggerEventTemplate('avi:jira:nonexistent:thing')).toBeUndefined();
  });

  it('getTriggerEventTemplate returns deep clones (mutations do not affect future calls)', () => {
    const first = getTriggerEventTemplate('avi:jira:created:issue');
    (first!.samplePayload as Record<string, unknown>).__mutated = true;
    const second = getTriggerEventTemplate('avi:jira:created:issue');
    expect((second!.samplePayload as Record<string, unknown>).__mutated).toBeUndefined();
  });
});
