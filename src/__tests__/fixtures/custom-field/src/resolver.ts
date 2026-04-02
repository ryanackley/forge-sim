import Resolver from '@forge/resolver';

const resolver = new Resolver();
resolver.define('getValue', () => ({ value: 42 }));
export const handler = resolver.getDefinitions();
