import Resolver from '@forge/resolver';

const resolver = new Resolver();
resolver.define('loose', async () => 'loose');
export const handler = resolver.getDefinitions();
