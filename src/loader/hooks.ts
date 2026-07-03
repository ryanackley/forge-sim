/**
 * Node module resolution hooks.
 * 
 * Intercepts imports of @forge/* packages and redirects them to our shims.
 * Used via: node --import ./dist/loader/register.js app.js
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { createRequire } from 'node:module';

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
  '@forge/react/router',
  '@forge/bridge',
  '@forge/jira-bridge',
  '@forge/confluence-bridge',
  '@forge/dashboards-bridge',
  '@forge/llm',
  '@forge/realtime',
  '@forge/object-store',
];

// '@forge/react' → 'forge-react.js'; subpaths flatten slashes:
// '@forge/react/router' → 'forge-react-router.js'
const FORGE_SHIMS: Record<string, string> = Object.fromEntries(
  SHIM_NAMES.map(pkg => [
    pkg,
    pathResolve(SHIM_DIR, pkg.replace('@forge/', 'forge-').replaceAll('/', '-') + '.js'),
  ])
);

// React deduplication.
//
// `@forge/react` is a custom React renderer — it sets up the hooks dispatcher
// on whichever React instance it imported. If the user's app bundle resolves
// `react` to a *different* copy (any project with its own node_modules/react,
// which is most of them), the bundle's `useState` reads from a dispatcher
// that was never set, and dies with `Cannot read properties of null
// (reading 'useState')`.
//
// Real Forge dedupes via its build pipeline; we dedupe at module-resolution
// time. Every `react` / `react-dom` / `react/jsx-*-runtime` import — whether
// from forge-sim's own code, the shims, or the user's bundle — resolves to
// forge-sim's installed copy. Single React instance across the whole graph.
const require = createRequire(import.meta.url);

function safeResolve(specifier: string): string | null {
  try {
    return require.resolve(specifier);
  } catch {
    return null;
  }
}

const REACT_DEDUPE_NAMES = [
  'react',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'react-dom',
  'react-dom/client',
];

const REACT_DEDUPE: Record<string, string> = {};
for (const name of REACT_DEDUPE_NAMES) {
  const resolved = safeResolve(name);
  if (resolved) REACT_DEDUPE[name] = resolved;
}

// Forge-sim's own node_modules — paths inside this directory are already
// canonical. Anything outside that resolves to react/* should be redirected.
const FORGE_SIM_NODE_MODULES = (() => {
  const reactPath = REACT_DEDUPE['react'];
  if (!reactPath) return null;
  // .../forge-sim/node_modules/react/index.js → .../forge-sim/node_modules
  const idx = reactPath.lastIndexOf('/node_modules/');
  return idx >= 0 ? reactPath.slice(0, idx + '/node_modules'.length) : null;
})();

/**
 * If a specifier is a pre-resolved absolute path (file:// URL or fs path)
 * pointing at a `react`, `react-dom`, or `react/jsx-*-runtime` entry from a
 * node_modules dir OTHER than forge-sim's, return the matching path inside
 * forge-sim's node_modules. Returns null if the specifier doesn't look like
 * a pre-resolved react import or already points at forge-sim's copy.
 */
function matchPreResolvedReactPath(specifier: string): string | null {
  if (!FORGE_SIM_NODE_MODULES) return null;

  // Normalize: drop file:// prefix, drop query string
  let path = specifier;
  if (path.startsWith('file://')) {
    try { path = fileURLToPath(path); } catch { return null; }
  }
  path = path.split('?')[0];

  // Must be an absolute path inside *some* node_modules
  if (!path.startsWith('/')) return null;
  const nmIdx = path.lastIndexOf('/node_modules/');
  if (nmIdx < 0) return null;

  // Already forge-sim's copy — let it through unchanged
  const importerNodeModules = path.slice(0, nmIdx + '/node_modules'.length);
  if (importerNodeModules === FORGE_SIM_NODE_MODULES) return null;

  // Match against the relative-to-node_modules tail
  const subpath = path.slice(nmIdx + '/node_modules/'.length);

  // Pick the longest matching dedupe entry. Subpath examples:
  //   "react/index.js", "react/jsx-runtime.js", "react-dom/index.js",
  //   "react-dom/client.js", "react/cjs/react.production.min.js"
  // We only redirect the entry-point files; deep cjs/* paths are already
  // resolved relative to whichever React's index loaded them, so by
  // redirecting the entry we capture all transitive imports.
  for (const [name, target] of Object.entries(REACT_DEDUPE)) {
    // 'react' → matches 'react/index.js' (the package entry) AND 'react.js' edge
    // 'react/jsx-runtime' → matches 'react/jsx-runtime.js'
    // 'react-dom' → matches 'react-dom/index.js'
    const expectedFiles = [`${name}/index.js`, `${name}.js`];
    if (expectedFiles.includes(subpath)) return target;
  }
  return null;
}

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
 * Load hook — transpile .ts, .tsx, and .jsx files so Node can execute them.
 *
 *   .ts  → Node's built-in stripTypeScriptTypes (fast, no deps)
 *   .tsx → esbuild with loader: 'tsx' (strips types + JSX transform)
 *   .jsx → esbuild with loader: 'jsx' (JSX transform only)
 *
 * Parity note: real Forge handles .jsx because their build pipeline (webpack /
 * esbuild) does JSX transform natively. Listing .jsx in TRY_EXTENSIONS without
 * a transpilation branch here means imports resolve to a .jsx file that Node
 * then fails to parse.
 */
async function transpileWithEsbuild(
  url: string,
  loader: 'tsx' | 'jsx',
  context: { format?: string; conditions?: string[] },
  nextLoad: Function
): Promise<{ source: string | ArrayBuffer; format: string; shortCircuit?: boolean }> {
  // Strip cache-busting query string before converting to filesystem path
  const cleanUrl = url.split('?')[0];
  const filePath = fileURLToPath(cleanUrl);
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(filePath, 'utf-8');

  try {
    const esbuild = await import('esbuild');
    const result = await esbuild.transform(source, {
      loader,
      format: 'esm',
      sourcefile: filePath,
      sourcemap: 'inline',
      target: 'node22',
    });
    return { source: result.code, format: 'module', shortCircuit: true };
  } catch {
    // esbuild not available — fall through to Node (which will likely fail
    // for .tsx/.jsx, but that's the same failure mode as before this hook).
    return nextLoad(url, context);
  }
}

export async function load(
  url: string,
  context: { format?: string; conditions?: string[] },
  nextLoad: Function
): Promise<{ source: string | ArrayBuffer; format: string; shortCircuit?: boolean }> {
  // Only handle file:// URLs
  if (!url.startsWith('file://')) return nextLoad(url, context);

  // Strip cache-busting query string for extension check
  const cleanUrl = url.split('?')[0];

  if (cleanUrl.endsWith('.tsx')) {
    return transpileWithEsbuild(url, 'tsx', context, nextLoad);
  }

  if (cleanUrl.endsWith('.jsx')) {
    return transpileWithEsbuild(url, 'jsx', context, nextLoad);
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

  // 2. React deduplication — every `react`/`react-dom`/`react/jsx-*-runtime`
  // import resolves to forge-sim's copy regardless of where the importer
  // lives. Without this, a project with its own node_modules/react gets a
  // separate React instance from @forge/react's, and hooks crash with
  // `Cannot read properties of null (reading 'useState')`.
  //
  // Match in two places:
  //   (a) bare specifier ('react', 'react/jsx-runtime', etc.) — this is the
  //       common case in production (Node's native dynamic import).
  //   (b) absolute path ending in node_modules/react/<file> — this catches
  //       the vitest/vite-node case, where the test runner pre-resolves
  //       bare specifiers to absolute paths before invoking the loader.
  //       Also catches any pre-resolved path coming from a different node_modules.
  const reactDedupePath = REACT_DEDUPE[specifier] ?? matchPreResolvedReactPath(specifier);
  if (reactDedupePath) {
    return {
      url: pathToFileURL(reactDedupePath).href,
      shortCircuit: true,
    };
  }

  // 3. Try native resolution first
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
