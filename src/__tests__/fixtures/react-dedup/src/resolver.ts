// @ts-nocheck — fixture file, runs through forge-sim's loader
import Resolver from '@forge/resolver';

const resolver = new Resolver();

resolver.define('getMessage', async () => ({ message: 'hello from resolver' }));

export const handler = resolver.getDefinitions();
