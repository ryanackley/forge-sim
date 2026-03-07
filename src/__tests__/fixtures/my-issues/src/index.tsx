import Resolver from '@forge/resolver';
import { requestJira } from '@forge/api';

const resolver = new Resolver();

/**
 * Get issues assigned to the current user.
 */
resolver.define('getMyIssues', async ({ context }) => {
  const accountId = context.accountId;
  const jql = `assignee = "${accountId}" AND resolution = Unresolved ORDER BY updated DESC`;

  const response = await requestJira(
    `/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=20&fields=summary,status,priority,issuetype,updated,project`
  );

  if (!response.ok) {
    const text = await response.text();
    console.error(`[getMyIssues] Jira API error (${response.status}): ${text}`);
    return { issues: [], error: `Jira API returned ${response.status}` };
  }

  const data = await response.json();

  const issues = (data.issues || []).map((issue: any) => ({
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status?.name || 'Unknown',
    statusCategory: issue.fields.status?.statusCategory?.key || 'undefined',
    priority: issue.fields.priority?.name || 'None',
    type: issue.fields.issuetype?.name || 'Task',
    project: issue.fields.project?.name || '',
    projectKey: issue.fields.project?.key || '',
    updated: issue.fields.updated,
  }));

  return { issues, total: data.total || 0 };
});

/**
 * Get a single issue's details.
 */
resolver.define('getIssueDetail', async ({ payload }) => {
  const { issueKey } = payload;

  const response = await requestJira(
    `/rest/api/3/issue/${issueKey}?fields=summary,description,status,priority,assignee,reporter,created,updated,labels,components,fixVersions`
  );

  if (!response.ok) {
    return { error: `Failed to fetch ${issueKey}` };
  }

  const data = await response.json();
  const f = data.fields;

  return {
    key: data.key,
    summary: f.summary,
    description: f.description?.content?.[0]?.content?.[0]?.text || '(no description)',
    status: f.status?.name,
    priority: f.priority?.name,
    assignee: f.assignee?.displayName || 'Unassigned',
    reporter: f.reporter?.displayName || 'Unknown',
    created: f.created,
    updated: f.updated,
    labels: f.labels || [],
    components: (f.components || []).map((c: any) => c.name),
  };
});

/**
 * Quick search across all issues.
 */
resolver.define('searchIssues', async ({ payload }) => {
  const { query } = payload;
  const jql = `text ~ "${query}" ORDER BY updated DESC`;

  const response = await requestJira(
    `/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=10&fields=summary,status,issuetype,project`
  );

  if (!response.ok) {
    return { issues: [], error: 'Search failed' };
  }

  const data = await response.json();
  const issues = (data.issues || []).map((issue: any) => ({
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status?.name,
    type: issue.fields.issuetype?.name,
    project: issue.fields.project?.key,
  }));

  return { issues, total: data.total };
});

/**
 * Get current user info.
 */
resolver.define('getMyself', async () => {
  const response = await requestJira('/rest/api/3/myself');

  if (!response.ok) {
    return { error: 'Failed to fetch user info' };
  }

  const data = await response.json();
  return {
    accountId: data.accountId,
    displayName: data.displayName,
    emailAddress: data.emailAddress,
    avatarUrl: data.avatarUrls?.['48x48'],
    active: data.active,
  };
});

export const handler = resolver.getDefinitions();
