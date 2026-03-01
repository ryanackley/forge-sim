/**
 * Node module resolution hooks.
 * 
 * Intercepts imports of @forge/* packages and redirects them to our shims.
 * Used via: node --import ./dist/loader/register.js app.js
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

// Map @forge packages to our shim files (compiled .js in dist/)
const SHIM_DIR = pathResolve(dirname(fileURLToPath(import.meta.url)), '..', 'shims');

const FORGE_SHIMS: Record<string, string> = {
  '@forge/api': pathResolve(SHIM_DIR, 'forge-api.js'),
  '@forge/kvs': pathResolve(SHIM_DIR, 'forge-kvs.js'),
  '@forge/events': pathResolve(SHIM_DIR, 'forge-events.js'),
  '@forge/resolver': pathResolve(SHIM_DIR, 'forge-resolver.js'),
  '@forge/react': pathResolve(SHIM_DIR, 'forge-react.js'),
  '@forge/bridge': pathResolve(SHIM_DIR, 'forge-bridge.js'),
};

export async function resolve(
  specifier: string,
  context: { parentURL?: string; conditions?: string[] },
  nextResolve: Function
): Promise<{ url: string; shortCircuit?: boolean; format?: string }> {
  const shimPath = FORGE_SHIMS[specifier];
  if (shimPath) {
    return {
      url: pathToFileURL(shimPath).href,
      shortCircuit: true,
    };
  }

  return nextResolve(specifier, context);
}
