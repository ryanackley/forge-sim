/**
 * Node module resolution hooks — what is left of them.
 *
 * Apps the simulator runs are BUNDLED first (src/bundler.ts): sim.deploy()
 * inlines every dependency of the backend and headless sim.ui.render() bundles
 * the UI Kit entry with its runtime pinned to absolute paths, so neither path
 * performs any bare-specifier resolution at runtime and neither needs a hook.
 * The CJS default-import facade, the extension inference for deep `@forge/*`
 * imports, the `browser`-field mapping and the React dedup that used to live
 * here all moved into the bundler, where Forge's own build step does them.
 *
 * These hooks apply to what is NOT bundled by forge-sim:
 *  - manual-packaged (prebuilt) handlers and UI resources, imported as-is;
 *  - a test script run under plain `node --import ./dist/loader/register.js`.
 *
 * For those they still: route `@forge/resolver` to the shim (the one package
 * with no seam), warn once about an `@forge/*` import the sim does not
 * simulate, force ESM for marked prebuilt UI bundles and their chunks,
 * transpile stray .tsx/.jsx, and infer extensions on relative imports.
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import {
  SHIM_NAMES,
  PASSTHROUGH_OK as REGISTRY_PASSTHROUGH_OK,
  shimFileBase,
} from '../shims/shim-registry.js';

// Always resolve shims to compiled dist/*.js — the loader hooks run in a
// separate Node worker thread where tsx's TypeScript support isn't available,
// so we must point to JavaScript regardless of whether *this* file is .ts or .js.
const thisFile = fileURLToPath(import.meta.url);
const thisDir = dirname(thisFile);

// From src/loader/ → ../../dist/shims, from dist/loader/ → ../shims
const SHIM_DIR = thisFile.endsWith('.ts')
  ? pathResolve(thisDir, '..', '..', 'dist', 'shims')
  : pathResolve(thisDir, '..', 'shims');

// '@forge/react' → 'forge-react.js'; subpaths flatten slashes:
// '@forge/react/router' → 'forge-react-router.js'
const FORGE_SHIMS: Record<string, string> = Object.fromEntries(
  SHIM_NAMES.map(pkg => [pkg, pathResolve(SHIM_DIR, shimFileBase(pkg) + '.js')])
);

// Deliberate real-package passthroughs (see shim-registry for the why).
const PASSTHROUGH_OK = new Set(REGISTRY_PASSTHROUGH_OK);

// Warn (once per specifier) when app code imports a @forge/* package that
// forge-sim doesn't simulate. Without this, the REAL Atlassian package loads
// silently and fails — or worse, silently misbehaves — at call time, deep in
// the app, with an error that says nothing about forge-sim. This is the #1
// "works in Forge, breaks mysteriously in the sim" footgun.
//
// Warn, don't throw: some real packages partially work outside Forge (e.g.
// @forge/feature-flags catches transport errors and serves defaults), and
// throwing here would break apps that only import — but never call — the
// package from a code path the test exercises.
//
// Known blind spot: CJS `require()` bypasses ESM loader hooks entirely, so
// requires of unshimmed packages load the real package with no warning.
const warnedUnshimmed = new Set<string>();

function warnUnshimmedForgeImport(specifier: string): void {
  if (warnedUnshimmed.has(specifier)) return;
  warnedUnshimmed.add(specifier);

  // '@forge/feature-flags/out/client' → '@forge/feature-flags'
  const rootPkg = specifier.split('/').slice(0, 2).join('/');
  const rootIsShimmed = rootPkg in FORGE_SHIMS;

  const message = rootIsShimmed
    ? `[forge-sim] "${specifier}" resolves to the REAL Atlassian package — ` +
      `forge-sim shims "${rootPkg}" but not this subpath. ` +
      `Behavior may not match the simulated "${rootPkg}".`
    : `[forge-sim] "${specifier}" is not simulated by forge-sim — the real ` +
      `Atlassian package will be loaded instead. Outside the real Forge ` +
      `runtime it may throw or silently misbehave when called. If calls ` +
      `into "${rootPkg}" fail or return unexpected results, this is why.`;

  console.warn(message);
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

  // Plain .ts — let Node handle it natively (built-in, unflagged type stripping since v22.18)
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

  // 1b. Unshimmed @forge/* — warn once (unless it is a package the sim
  // answers through a seam), then fall through to native resolution so the
  // real package loads. Nothing is rewritten: forge-sim-built bundles never
  // reach this hook, and a manual-packaged app ships the dependencies it
  // imports, exactly as Forge requires of it.
  if (specifier.startsWith('@forge/')) {
    const rootPkg = specifier.split('/').slice(0, 2).join('/');
    if (!PASSTHROUGH_OK.has(rootPkg)) warnUnshimmedForgeImport(specifier);
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
