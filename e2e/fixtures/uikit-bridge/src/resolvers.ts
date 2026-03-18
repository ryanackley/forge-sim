import Resolver from '@forge/resolver';
import { requestJira, requestConfluence } from '@forge/api';

const resolver = new Resolver();

resolver.define('echo', ({ payload }: any) => {
  return { echoed: true, ...payload };
});

resolver.define('getJiraData', async () => {
  try {
    const res = await requestJira('/rest/api/3/myself');
    const body = await res.text();
    return { success: true, status: res.status, body };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

resolver.define('getConfluenceData', async () => {
  try {
    const res = await requestConfluence('/wiki/api/v2/spaces');
    const body = await res.text();
    return { success: true, status: res.status, body };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

export const handler = resolver.getDefinitions();
