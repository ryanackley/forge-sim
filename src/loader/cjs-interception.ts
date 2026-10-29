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
 * That turned out to be the wrong worry: every `@forge/*` package now runs
 * for real against the seams the sim installs (`__forge_fetch__`,
 * `__forge_runtime__`), so there is nothing left to remap and SHIM_NAMES is
 * empty. What the Module._resolveFilename patch (the same seam tsx/ts-node
 * use) still does is containment, for requests whose requiring module lives
 * inside a registered app directory.
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
 * (ESM manual handlers are imported by Node directly and are not contained;
 * the packaging standard requires CommonJS anyway.)
 */

import Module from 'node:module';
import { realpathSync } from 'node:fs';
import { dirname, isAbsolute, resolve as pathResolve, sep } from 'node:path';

interface InterceptedApp {
  /** App root (trailing separator), the given path and its realpath. */
  appDirs: string[];
  /** `app.package.path` (trailing separator): the given path, its realpath, and the realpath of its node_modules (a link counts as inside). */
  packageDirs: string[];
  /** The package directory as given, for messages. */
  packageDir: string;
}

/** App roots whose CJS requires are contained to their package directory. */
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
 * Contain CJS `require()` calls made from inside `packageDir`
 * (`app.package.path`) under `appDir` to that directory. Idempotent per app;
 * the Module._resolveFilename patch is installed once and consults the
 * registry on every call.
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

    // A package the app does not ship is a missing dependency, reported as
    // Node reports one.
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
