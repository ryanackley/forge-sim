import Resolver from '@forge/resolver';

const resolver = new Resolver();

resolver.define('chatty', async (req) => {
  console.log('[chatty] hello from console.log');
  console.warn('[chatty] heads up: warning fired');
  console.error('[chatty] uh oh: error fired');
  console.info('[chatty] info-level note');
  return { ok: true };
});

resolver.define('thrower', async () => {
  console.log('[thrower] about to fail');
  throw new Error('intentional boom');
});

export const handler = resolver.getDefinitions();
