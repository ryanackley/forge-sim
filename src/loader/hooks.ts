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
  '@forge/jira-bridge',
  '@forge/confluence-bridge',
  '@forge/dashboards-bridge',
  '@forge/llm',
  '@forge/realtime',
];

const FORGE_SHIMS: Record<string, string> = Object.fromEntries(
  SHIM_NAMES.map(pkg => [
    pkg,
    pathResolve(SHIM_DIR, pkg.replace('@forge/', 'forge-') + '.js'),
  ])
);

// Extensions to try when resolving extensionless/directory imports from app code.
// Forge apps are typically written for bundled environments (webpack) which handle
// these automatically, but Node's native ESM resolver is strict.
const TRY_EXTENSIONS = ['.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs'];

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const { access } = await import('node:fs/promises');
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Try to resolve a relative import to a real file.
 * Handles extensionless imports, directory imports, and .js → .ts remapping
 * (common in TypeScript ESM projects that use .js extensions in source).
 * Returns a file:// URL if found, or null.
 */
async function tryResolveFile(specifier: string, parentURL?: string): Promise<string | null> {
  // Only handle relative imports from file:// parents (app code)
  if (!specifier.startsWith('.') || !parentURL?.startsWith('file://')) return null;

  const parentDir = dirname(fileURLToPath(parentURL));
  const basePath = pathResolve(parentDir, specifier);

  // 0. .js → .ts/.tsx remapping (TypeScript ESM convention)
  if (specifier.endsWith('.js')) {
    const tsPath = basePath.replace(/\.js$/, '.ts');
    if (await fileExists(tsPath)) return pathToFileURL(tsPath).href;
    const tsxPath = basePath.replace(/\.js$/, '.tsx');
    if (await fileExists(tsxPath)) return pathToFileURL(tsxPath).href;
  }

  // 1. Try adding extensions: ./foo → ./foo.js, ./foo.ts, etc.
  for (const ext of TRY_EXTENSIONS) {
    if (await fileExists(basePath + ext)) {
      return pathToFileURL(basePath + ext).href;
    }
  }

  // 2. Try as directory: ./foo → ./foo/index.js, ./foo/index.ts, etc.
  for (const ext of TRY_EXTENSIONS) {
    const indexPath = pathResolve(basePath, 'index' + ext);
    if (await fileExists(indexPath)) {
      return pathToFileURL(indexPath).href;
    }
  }

  return null;
}

/**
 * Load hook — transpile .ts and .tsx files so Node can execute them.
 * Uses Node's built-in stripTypeScriptTypes for .ts (fast, no deps)
 * and esbuild for .tsx (handles JSX transform).
 */
export async function load(
  url: string,
  context: { format?: string; conditions?: string[] },
  nextLoad: Function
): Promise<{ source: string | ArrayBuffer; format: string; shortCircuit?: boolean }> {
  // Only handle file:// URLs with .ts or .tsx extension
  if (!url.startsWith('file://')) return nextLoad(url, context);

  // Strip cache-busting query string for extension check
  const cleanUrl = url.split('?')[0];

  if (cleanUrl.endsWith('.tsx')) {
    // TSX needs esbuild for JSX transform
    const filePath = fileURLToPath(cleanUrl);
    const { readFile } = await import('node:fs/promises');
    const source = await readFile(filePath, 'utf-8');

    try {
      const esbuild = await import('esbuild');
      const result = await esbuild.transform(source, {
        loader: 'tsx',
        format: 'esm',
        sourcefile: filePath,
        sourcemap: 'inline',
        target: 'node22',
      });
      return { source: result.code, format: 'module', shortCircuit: true };
    } catch {
      // esbuild not available — fall through to Node
      return nextLoad(url, context);
    }
  }

  // Plain .ts — let Node handle it natively (built-in type stripping since v22)
  // No load hook needed; Node strips types and preserves source positions.

  return nextLoad(url, context);
}

export async function resolve(
  specifier: string,
  context: { parentURL?: string; conditions?: string[] },
  nextResolve: Function
): Promise<{ url: string; shortCircuit?: boolean; format?: string }> {
  // 1. @forge/* shim interception
  const shimPath = FORGE_SHIMS[specifier];
  if (shimPath) {
    return {
      url: pathToFileURL(shimPath).href,
      shortCircuit: true,
    };
  }

  // 2. Try native resolution first
  try {
    return await nextResolve(specifier, context);
  } catch (err: any) {
    // Only handle resolution failures for relative imports
    if (err?.code !== 'ERR_MODULE_NOT_FOUND' && err?.code !== 'ERR_UNSUPPORTED_DIR_IMPORT') {
      throw err;
    }

    // 3. Fallback: extensionless / directory import resolution
    const resolved = await tryResolveFile(specifier, context.parentURL);
    if (resolved) {
      return { url: resolved, shortCircuit: true };
    }

    // Nothing worked — re-throw original error
    throw err;
  }
}
