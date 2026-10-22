import Resolver from '@forge/resolver';
import { kvs } from '@forge/kvs';
import { requestJira, route } from '@forge/api';

const resolver = new Resolver();

resolver.define('save', async ({ payload }) => {
  await kvs.set('saved:' + payload.id, { id: payload.id, by: 'matrix-backend' });
  return 'saved ' + payload.id;
});

resolver.define('summary', async () => {
  const saved = await kvs.get('saved:ui');
  return saved ? 'ui saved by ' + saved.by : 'nothing saved';
});

resolver.define('issue', async ({ payload }) => {
  const res = await requestJira(route`/rest/api/3/issue/${payload.key}`);
  const data = await res.json();
  return data.fields.summary;
});

export const handler = resolver.getDefinitions();
