/**
 * Fake Forge app — uses real @forge/* imports.
 * If the shims work, this runs against our sim without modification.
 */
import Resolver from '@forge/resolver';
import { route, asUser } from '@forge/api';
import { kvs } from '@forge/kvs';
import { Queue } from '@forge/events';

const resolver = new Resolver();

// A resolver that fetches a Jira issue and stores view count
resolver.define('getIssue', async (req) => {
  const { issueKey } = req.payload;
  
  // Call Jira API
  const response = await asUser().requestJira(route`/rest/api/3/issue/${issueKey}`);
  const issue = await response.json();
  
  // Track view count in KVS
  const viewKey = `views:${issueKey}`;
  const currentViews = (await kvs.get(viewKey)) || 0;
  await kvs.set(viewKey, currentViews + 1);
  
  // Push analytics event to queue
  const queue = new Queue({ key: 'work-queue' });
  await queue.push([{ body: { issueKey, viewedAt: Date.now() } }]);
  
  return {
    issue,
    views: currentViews + 1,
  };
});

export const handler = resolver.getDefinitions();
