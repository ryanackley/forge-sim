/**
 * End-to-end tests for my-issues — exercises real requestJira() calls
 * through the product API (mock mode).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ForgeSimulator } from '../simulator.js';
import { setSimulator } from '../shims/globals.js';

const FIXTURE_DIR = new URL('./fixtures/my-issues', import.meta.url).pathname;

describe('my-issues e2e', () => {
  let sim: ForgeSimulator;

  beforeAll(async () => {
    sim = new ForgeSimulator();
    setSimulator(sim);

    // Mock Jira API responses
    sim.mockProductRoutes('jira', {
      'GET /rest/api/3/myself': {
        accountId: '557058:test-user',
        displayName: 'Test User',
        emailAddress: 'test@example.com',
        avatarUrls: { '48x48': 'https://avatar.example.com/48.png' },
        active: true,
      },
      'GET /rest/api/3/search': (path: string) => {
        // Return different results based on JQL
        if (path.includes('assignee')) {
          return {
            total: 2,
            issues: [
              {
                key: 'PROJ-1',
                fields: {
                  summary: 'Fix login bug',
                  status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } },
                  priority: { name: 'High' },
                  issuetype: { name: 'Bug' },
                  project: { name: 'My Project', key: 'PROJ' },
                  updated: '2026-03-07T12:00:00.000Z',
                },
              },
              {
                key: 'PROJ-2',
                fields: {
                  summary: 'Add dark mode',
                  status: { name: 'To Do', statusCategory: { key: 'new' } },
                  priority: { name: 'Medium' },
                  issuetype: { name: 'Story' },
                  project: { name: 'My Project', key: 'PROJ' },
                  updated: '2026-03-06T08:00:00.000Z',
                },
              },
            ],
          };
        }
        // text search
        return {
          total: 1,
          issues: [
            {
              key: 'PROJ-1',
              fields: {
                summary: 'Fix login bug',
                status: { name: 'In Progress' },
                issuetype: { name: 'Bug' },
                project: { key: 'PROJ' },
              },
            },
          ],
        };
      },
      'GET /rest/api/3/issue/PROJ-1': {
        key: 'PROJ-1',
        fields: {
          summary: 'Fix login bug',
          description: { content: [{ content: [{ text: 'Users cannot log in with SSO' }] }] },
          status: { name: 'In Progress' },
          priority: { name: 'High' },
          assignee: { displayName: 'Test User' },
          reporter: { displayName: 'QA Bot' },
          created: '2026-03-01T10:00:00.000Z',
          updated: '2026-03-07T12:00:00.000Z',
          labels: ['sso', 'critical'],
          components: [{ name: 'Auth' }],
          fixVersions: [],
        },
      },
    });

    await sim.deploy(FIXTURE_DIR);
  }, 30_000);

  afterAll(() => {
    sim.reset();
  });

  it('getMyself returns user info', async () => {
    const result = await sim.invoke('getMyself', {});
    expect(result.displayName).toBe('Test User');
    expect(result.accountId).toBe('557058:test-user');
    expect(result.emailAddress).toBe('test@example.com');
    expect(result.avatarUrl).toContain('avatar.example.com');
  });

  it('getMyIssues returns assigned issues', async () => {
    const result = await sim.invoke('getMyIssues', {});
    expect(result.issues).toHaveLength(2);
    expect(result.total).toBe(2);

    const first = result.issues[0];
    expect(first.key).toBe('PROJ-1');
    expect(first.summary).toBe('Fix login bug');
    expect(first.status).toBe('In Progress');
    expect(first.priority).toBe('High');
    expect(first.type).toBe('Bug');
    expect(first.projectKey).toBe('PROJ');

    const second = result.issues[1];
    expect(second.key).toBe('PROJ-2');
    expect(second.summary).toBe('Add dark mode');
    expect(second.type).toBe('Story');
  });

  it('getIssueDetail returns full issue data', async () => {
    const result = await sim.invoke('getIssueDetail', { issueKey: 'PROJ-1' });
    expect(result.key).toBe('PROJ-1');
    expect(result.summary).toBe('Fix login bug');
    expect(result.description).toBe('Users cannot log in with SSO');
    expect(result.assignee).toBe('Test User');
    expect(result.reporter).toBe('QA Bot');
    expect(result.labels).toEqual(['sso', 'critical']);
    expect(result.components).toEqual(['Auth']);
  });

  it('searchIssues finds matching issues', async () => {
    const result = await sim.invoke('searchIssues', { query: 'login' });
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].key).toBe('PROJ-1');
    expect(result.total).toBe(1);
  });

  it('getIssueDetail returns error for non-existent issue', async () => {
    const result = await sim.invoke('getIssueDetail', { issueKey: 'NOPE-999' });
    expect(result.error).toBeDefined();
  });
});
