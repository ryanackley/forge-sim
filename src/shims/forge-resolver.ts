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

export function makeResolver() {
  return new Resolver();
}

export default Resolver;
