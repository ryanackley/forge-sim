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
 *
 * Containment: "Manual packaging for the Forge functions requires the
 * dependencies of the application, typically in node_modules, to be
 * available in the directory to be uploaded as well"
 * (https://developer.atlassian.com/platform/forge/manifest-reference/packaging/#functions).
 * Node's resolver walks up from the package directory and would find a
 * `node_modules` at the app root or above it, which Forge never uploads. So
 * a require made from inside `app.package.path` must resolve inside it (its
 * own node_modules, linked or real, included); one that resolves outside
 * fails with the same "Cannot find module" the Forge runtime would give.
 * The @forge/resolver shim takes the package's place only when the package
 * ships it. (ESM manual handlers are imported by Node directly and are not
 * contained; the packaging standard requires CommonJS anyway.)
 */

import Module from 'node:module';
import { realpathSync } from 'node:fs';
import { dirname, isAbsolute, resolve as pathResolve, sep } from 'node:path';
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

interface InterceptedApp {
  /** App root (trailing separator), the given path and its realpath. */
  appDirs: string[];
  /** `app.package.path` (trailing separator): the given path, its realpath, and the realpath of its node_modules (a link counts as inside). */
  packageDirs: string[];
  /** The package directory as given, for messages. */
  packageDir: string;
}

/** App roots whose CJS requires of @forge/* should hit the shims. */
const interceptedApps: InterceptedApp[] = [];

let patched = false;

const withSep = (p: string) => (p.endsWith(sep) ? p : p + sep);
const forms = (p: string): string[] => {
  const out = new Set([withSep(p)]);
  try {
    out.add(withSep(realpathSync(p)));
  } catch {
    // not there (yet)
  }
  return [...out];
};

/**
 * Route CJS `require('@forge/…')` calls made from code under `appDir` to the
 * forge-sim shims, and contain requires made from inside `packageDir`
 * (`app.package.path`) to that directory. Idempotent per app; the
 * Module._resolveFilename patch is installed once and consults the registry
 * on every call.
 */
export function interceptCjsForgeRequires(appDir: string, packageDir: string = appDir): void {
  const existing = interceptedApps.find((a) => a.appDirs[0] === withSep(appDir) && a.packageDir === packageDir);
  if (!existing) {
    interceptedApps.push({
      appDirs: forms(appDir),
      packageDirs: [...forms(packageDir), ...forms(pathResolve(packageDir, 'node_modules'))],
      packageDir,
    });
  }
  if (patched) return;
  patched = true;

  const M = Module as unknown as {
    _resolveFilename: (request: string, parent: { filename?: string } | undefined, ...rest: unknown[]) => string;
  };
  const original = M._resolveFilename;
  M._resolveFilename = function (request, parent, ...rest) {
    const parentFile = parent?.filename;
    const app = parentFile ? appOf(parentFile) : undefined;
    if (!app || Module.isBuiltin(request)) {
      return original.call(this, request, parent, ...rest);
    }
    const contained = app.packageDirs.some((d) => parentFile!.startsWith(d));
    const shimPath = FORGE_SHIMS_CJS[request];
    const crossRequire = parentFile!.includes(`${sep}node_modules${sep}@forge${sep}`);

    // The shim stands in for a package the app ships. A package it does not
    // ship is a missing dependency, reported as Node reports one.
    const resolved = original.call(this, request, parent, ...rest);
    if (contained && !insidePackage(app, resolved)) {
      const err = new Error(
        `Cannot find module '${request}' from ${parentFile}: manual packaging uploads only ` +
          `app.package.path (${app.packageDir}), so its dependencies must be inside it ` +
          `(${pathResolve(app.packageDir, 'node_modules')}). ${resolved} is outside the package: Forge ` +
          `would not have it, and forge-sim does not use it.`,
      ) as NodeJS.ErrnoException;
      err.code = 'MODULE_NOT_FOUND';
      throw err;
    }
    if (shimPath && !crossRequire) return shimPath;
    return resolved;
  };
}

function appOf(parentFilename: string): InterceptedApp | undefined {
  return interceptedApps.find((a) => a.appDirs.some((d) => parentFilename.startsWith(d)));
}

function insidePackage(app: InterceptedApp, resolved: string): boolean {
  if (!isAbsolute(resolved)) return true; // a builtin spelled without `node:`
  if (app.packageDirs.some((d) => resolved.startsWith(d))) return true;
  // The package's node_modules may have appeared (or been re-linked) since
  // registration: a link's realpath is where Node reports the resolution.
  for (const d of forms(pathResolve(app.packageDir, 'node_modules'))) {
    if (!app.packageDirs.includes(d)) app.packageDirs.push(d);
    if (resolved.startsWith(d)) return true;
  }
  return false;
}

/** Test-only: inspect the registered app roots. */
export function _interceptedAppDirs(): ReadonlySet<string> {
  return new Set(interceptedApps.map((a) => a.appDirs[0]));
}
