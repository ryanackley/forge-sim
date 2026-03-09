import Resolver from '@forge/resolver';
import { kvs } from '@forge/kvs';

const resolver = new Resolver();

resolver.define('getIssueSummary', async (req: any) => {
  const issueKey = req.context?.issueKey ?? 'UNKNOWN';
  
  // Track view count
  const views = ((await kvs.get(`views:${issueKey}`)) as number) ?? 0;
  await kvs.set(`views:${issueKey}`, views + 1);
  
  return {
    issueKey,
    viewCount: views + 1,
    summary: `Summary for ${issueKey}`,
  };
});

resolver.define('getIssueComments', async (req: any) => {
  const issueKey = req.context?.issueKey ?? 'UNKNOWN';
  return {
    comments: [
      { author: 'alice', text: `First comment on ${issueKey}` },
      { author: 'bob', text: 'Looks good to me' },
    ],
  };
});

export const handler = resolver.getDefinitions();
