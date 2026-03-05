/**
 * Node module resolution hooks.
 * 
 * Intercepts imports of @forge/* packages and redirects them to our shims.
 * Used via: node --import ./dist/loader/register.js app.js
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

// Always resolve shims to compiled dist/*.js — the loader hooks run in a
// separate Node worker thread where tsx's TypeScript support isn't available,
// so we must point to JavaScript regardless of whether *this* file is .ts or .js.
const thisFile = fileURLToPath(import.meta.url);
const thisDir = dirname(thisFile);

// From src/loader/ → ../../dist/shims, from dist/loader/ → ../shims
const SHIM_DIR = thisFile.endsWith('.ts')
  ? pathResolve(thisDir, '..', '..', 'dist', 'shims')
  : pathResolve(thisDir, '..', 'shims');

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
    pathResolve(SHIM_DIR, pkg.replace('@forge/', 'forge-') + '.js'),
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
