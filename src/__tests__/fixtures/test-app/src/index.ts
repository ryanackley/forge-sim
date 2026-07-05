import Resolver from '@forge/resolver';
import { storage, requestJira } from '@forge/api';
import { Queue } from '@forge/events';

const resolver = new Resolver();

const analyticsQueue = new Queue({ key: 'analytics-queue' });

resolver.define('getIssue', async (req: any) => {
  const { issueKey } = req.payload;
  console.log('getIssue called with:', issueKey);

  // Fetch from Jira
  const res = await requestJira(`/rest/api/3/issue/${issueKey}`);
  const issue = await res.json();

  // Track views in KVS
  const currentViews = (await storage.get(`views:${issueKey}`)) || 0;
  const newViews = currentViews + 1;
  await storage.set(`views:${issueKey}`, newViews);

  // Push analytics event to queue
  await analyticsQueue.push({ body: { event: 'issue-viewed', issueKey, timestamp: Date.now() } });

  return { issue, views: newViews };
});

resolver.define('getText', (req: any) => {
  console.log('getText called with:', req.payload);
  return { text: 'Hello from the resolver! 🔥' };
});

resolver.define('getCount', (req: any) => {
  return { count: Math.floor(Math.random() * 100) };
});

export const handler = resolver.getDefinitions();
