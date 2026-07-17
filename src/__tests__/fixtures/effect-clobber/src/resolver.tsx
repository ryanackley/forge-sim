import Resolver from '@forge/resolver';
import { kvs } from '@forge/kvs';

const resolver = new Resolver();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Returns the saved settings, or the server-side default. The small sleep
 * forces the frontend's useEffect → invoke chain to land asynchronously —
 * the whole point of this fixture is exercising the window between "text
 * appeared in a render commit" and "that commit's effects flushed".
 */
resolver.define('getSettings', async () => {
  // Longer than settle()'s default 50ms quiet window on purpose: a settle
  // that only watches render commits (ignoring pending invokes) would report
  // quiescence while this is still in flight — and the regression tests
  // below would catch it.
  await sleep(120);
  const stored = (await kvs.get('settings')) as { threshold: number } | undefined;
  return stored ?? { threshold: 30 };
});

resolver.define('saveSettings', async ({ payload }) => {
  await kvs.set('settings', { threshold: (payload as any).threshold });
  return { ok: true };
});

export const handler = resolver.getDefinitions();
export default resolver;
