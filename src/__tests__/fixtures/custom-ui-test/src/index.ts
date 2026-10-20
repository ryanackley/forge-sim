import Resolver from '@forge/resolver';
import { kvs } from '@forge/kvs';

const resolver = new Resolver();

resolver.define('getData', async ({ payload, context }) => {
  const stored = await kvs.get(`data:${payload.key}`);
  return {
    value: stored ?? 'default-value',
    account: context.accountId,
    key: payload.key,
  };
});

resolver.define('setData', async ({ payload }) => {
  await kvs.set(`data:${payload.key}`, payload.value);
  return { success: true };
});

resolver.define('getJiraIssue', async ({ payload, context }) => {
  // Uses requestJira under the hood via @forge/api
  const { requestJira, route } = await import('@forge/api');
  const response = await requestJira(route`/rest/api/3/issue/${payload.issueKey}`);
  const data = await response.json();
  return { issue: data, requestedBy: context.accountId };
});

export const handler = resolver.getDefinitions();
