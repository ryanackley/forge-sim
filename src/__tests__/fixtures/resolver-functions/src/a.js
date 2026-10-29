import Resolver from '@forge/resolver';

// define() returns the Resolver, so definitions chain.
export const handler = new Resolver()
  .define('getText', async (req) => `a:${req.payload?.from ?? '?'}`)
  .define('onlyA', async () => ({
    when: new Date('2026-01-02T03:04:05.000Z'),
    nested: { n: 1 },
    skipped: undefined,
  }))
  .getDefinitions();
