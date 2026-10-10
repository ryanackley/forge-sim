/**
 * Shim for @forge/resolver
 * 
 * Provides the default Resolver class that Forge apps use:
 *   import Resolver from '@forge/resolver';
 *   const resolver = new Resolver();
 *   resolver.define('handler', (req) => { ... });
 *   export const handler = resolver.getDefinitions();
 */

import { getSimulator } from './globals.js';

class Resolver {
  private _definitions = new Map<string, Function>();

  define(functionKey: string, handler: (req: any) => any): void {
    this._definitions.set(functionKey, handler);
    // Also register on the simulator so invoke() works
    try {
      const sim = getSimulator();
      sim.resolver.define(functionKey, handler);
    } catch {
      // Simulator not set yet — will be wired up later
    }
  }

  getDefinitions(): Record<string, Function> {
    return Object.fromEntries(this._definitions);
  }
}

/** Shape of real @forge/resolver's getDefinitions() return — a dispatch function. */
type DefinitionsHandler = (
  payload: { call: { functionKey: string; payload?: unknown; jobId?: string }; context: Record<string, any> },
  backendRuntimePayload?: Record<string, any>,
) => Promise<unknown>;

/**
 * Matches real makeResolver(handlers): defines every handler and returns the
 * definitions dispatch function (the thing apps export as their handler). The
 * define() calls also register each function on the simulator, so invoke()
 * routing works the same as the Resolver-class style.
 */
export function makeResolver(handlers: Record<string, (request: any) => any>): DefinitionsHandler {
  const resolver = new Resolver();
  for (const [key, fn] of Object.entries(handlers)) {
    resolver.define(key, fn);
  }
  return async ({ call, context }) => {
    const fn = handlers[call.functionKey];
    if (!fn) {
      throw new Error(`Resolver function not found: ${call.functionKey}`);
    }
    return fn({ payload: call.payload, context });
  };
}

export default Resolver;
