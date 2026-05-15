// TypeScript entry — exercises esbuild's .ts loader in the F3 fix.
import Resolver from '@forge/resolver';
import { ping } from './handlers/ping.js';

const resolver = new Resolver();
resolver.define('ping', ping);

export const handler = resolver.getDefinitions();
