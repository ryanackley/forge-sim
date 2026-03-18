import Resolver from '@forge/resolver';

const resolver = new Resolver();

resolver.define('echo', ({ payload }: any) => {
  return { echoed: true, ...payload };
});

export const handler = resolver.getDefinitions();
