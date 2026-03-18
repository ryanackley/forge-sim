import Resolver from '@forge/resolver';

const resolver = new Resolver();

resolver.define('echo', ({ payload }: any) => {
  return { echoed: payload };
});

export const handler = resolver.getDefinitions();
