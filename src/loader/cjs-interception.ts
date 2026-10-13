/**
 * CJS require() interception for @forge/* — the manual-packaging counterpart
 * to the ESM resolve hook in hooks.ts.
 *
 * The ESM loader hooks never see CJS `require()` calls (the long-standing
 * blind spot noted in hooks.ts). That was harmless while every handler went
 * through esbuild: bundles are ESM, and any `require` in app source became
 * esbuild's `__require` shim that throws. Manual packaging (#40) changes the
 * game — packaged output is typically TypeScript-compiled CommonJS, so
 * `require('@forge/api')` from app code would load the REAL Atlassian package
 * out of the app's own packaged node_modules and hit the network instead of
 * the simulator.
 *
 * Fix: patch Module._resolveFilename (the same seam tsx/ts-node use) to remap
 * SHIM_NAMES requests to the compiled shims — but ONLY for requests whose
 * requiring module lives inside a registered app directory. Scoping matters
 * for correctness, not just hygiene:
 *
 *   - forge-sim's own shims reach the real packages via
 *     `createRequire(...)('@forge/react')` — the fallthrough convention
 *     DEPENDS on CJS requires bypassing interception. Shims live in
 *     forge-sim's src/dist, never inside an app dir, so they're exempt.
 *   - Real @forge/* packages inside the app's node_modules may require each
 *     other internally; remapping those cross-requires would hand a real
 *     package half a shim. Requests from `node_modules/@forge/` are exempt.
 *   - `@forge/sql` is not in SHIM_NAMES (deliberate passthrough via
 *     global.__forge_fetch__), so it stays native everywhere — same as ESM.
 *
 * require() of the ESM shims works via Node's require(esm) (Node >= 22.12,
 * which forge-sim already requires; the shims have no top-level await).
 */

import Module from 'node:module';
import { dirname, resolve as pathResolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHIM_NAMES, shimFileBase } from '../shims/shim-registry.js';

// Same dist-shims resolution as hooks.ts: compiled shims regardless of
// whether this file runs as .ts (vitest) or .js (dist).
const thisFile = fileURLToPath(import.meta.url);
const thisDir = dirname(thisFile);
const SHIM_DIR = thisFile.endsWith('.ts')
  ? pathResolve(thisDir, '..', '..', 'dist', 'shims')
  : pathResolve(thisDir, '..', 'shims');

const FORGE_SHIMS_CJS: Record<string, string> = Object.fromEntries(
  SHIM_NAMES.map((pkg) => [pkg, pathResolve(SHIM_DIR, shimFileBase(pkg) + '.js')])
);

/** App roots whose CJS requires of @forge/* should hit the shims. */
const interceptedAppDirs = new Set<string>();

let patched = false;

/**
 * Route CJS `require('@forge/…')` calls made from code under `appDir` to the
 * forge-sim shims. Idempotent; the Module._resolveFilename patch is installed
 * once and consults the registered-dirs set on every call.
 */
export function interceptCjsForgeRequires(appDir: string): void {
  interceptedAppDirs.add(appDir.endsWith(sep) ? appDir : appDir + sep);
  if (patched) return;
  patched = true;

  const M = Module as unknown as {
    _resolveFilename: (request: string, parent: { filename?: string } | undefined, ...rest: unknown[]) => string;
  };
  const original = M._resolveFilename;
  M._resolveFilename = function (request, parent, ...rest) {
    const shimPath = FORGE_SHIMS_CJS[request];
    if (shimPath && parent?.filename && isInterceptedParent(parent.filename)) {
      return shimPath;
    }
    return original.call(this, request, parent, ...rest);
  };
}

function isInterceptedParent(parentFilename: string): boolean {
  for (const dir of interceptedAppDirs) {
    if (parentFilename.startsWith(dir)) {
      // Real @forge/* packages inside the app's node_modules keep their
      // native cross-requires (see header).
      return !parentFilename.includes(`${sep}node_modules${sep}@forge${sep}`);
    }
  }
  return false;
}

/** Test-only: inspect the registered app roots. */
export function _interceptedAppDirs(): ReadonlySet<string> {
  return interceptedAppDirs;
}
