// Entry point that re-exports the handler from a transitive file.
// F3 reproduction: forge_deploy() cache-busts the entry import with ?t=N,
// but the entry's own `import` of './handlers/greet.js' is NOT busted —
// so when the user edits greet.js, the redeploy sees the OLD code.
import Resolver from '@forge/resolver';
import { greet } from './handlers/greet.js';

const resolver = new Resolver();
resolver.define('greet', greet);

export const handler = resolver.getDefinitions();
