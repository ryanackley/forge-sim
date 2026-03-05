/**
 * Node module resolution hooks.
 * 
 * Intercepts imports of @forge/* packages and redirects them to our shims.
 * Used via: node --import ./dist/loader/register.js app.js
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

// Detect whether we're running from source (.ts) or compiled dist (.js)
const thisFile = fileURLToPath(import.meta.url);
const shimExt = thisFile.endsWith('.ts') ? '.ts' : '.js';

const SHIM_DIR = pathResolve(dirname(thisFile), '..', 'shims');

const SHIM_NAMES = [
  '@forge/api',
  '@forge/kvs',
  '@forge/events',
  '@forge/resolver',
  '@forge/react',
  '@forge/bridge',
];

const FORGE_SHIMS: Record<string, string> = Object.fromEntries(
  SHIM_NAMES.map(pkg => [
    pkg,
    pathResolve(SHIM_DIR, pkg.replace('@forge/', 'forge-') + shimExt),
  ])
);

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
