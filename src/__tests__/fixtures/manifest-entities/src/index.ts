// No-op resolver so the deploy succeeds — this fixture's value is the
// manifest, not the handler.
import Resolver from '@forge/resolver';

const resolver = new Resolver();
resolver.define('ping', () => 'pong');

export const handler = resolver.getDefinitions();
