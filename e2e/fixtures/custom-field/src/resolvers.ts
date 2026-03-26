import Resolver from '@forge/resolver';

const resolver = new Resolver();

resolver.define('getValue', () => {
  return 42;
});

export const handler = resolver.getDefinitions();
