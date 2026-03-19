import Resolver from '@forge/resolver';

const resolver = new Resolver();

resolver.define('getText', () => {
  return 'Hello from the resolver!';
});

export const handler = resolver.getDefinitions();
