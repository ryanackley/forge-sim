import { makeResolver } from '@forge/resolver';

export const handler = makeResolver({
  getText: async (req) => `b:${req.payload?.from ?? '?'}`,
  onlyB: async (req) => req.context.accountId,
});
