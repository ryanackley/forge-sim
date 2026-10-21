/**
 * App bundler — esbuild over an app's entry points with EVERY dependency
 * inlined, the way `forge deploy` builds a function before the Forge runtime
 * ever loads it.
 *
 * Why inline instead of leaving dependencies external: real Forge never
 * performs module resolution at runtime. The bundler has already resolved
 * every `@forge/*` import, applied CommonJS↔ESM interop (an `__esModule`
 * default is handed back as the default), inferred extensions on deep
 * imports, honoured `browser` fields and deduplicated React — and the
 * runtime loads one file and injects the globals. Doing the same here means
 * the sim needs none of the loader-side re-implementations of those bundler
 * behaviours (the CJS default facade, passthrough resolution, the
 * browser-field mapping, React dedup), and what remains is exactly what real
 * Forge has: the seams.
 *
 * Two sim-side touches on the real packages happen at bundle time, both tiny
 * and both named here so nobody discovers them by surprise:
 *  - `@forge/resolver` is routed to forge-sim's shim INSIDE the bundle. The
 *    real class keeps its definitions in a private map, so a bundled copy
 *    gives the sim one opaque dispatch function; the shim additionally
 *    registers each key with the simulator, which is what `forge_sim_info`'s
 *    resolver list, per-module ownership and the "No resolver defined for X"
 *    hint are built on. Correctness never needed this (see
 *    `detectResolverDispatch` in deployer.ts); the DX did.
 *  - `@forge/api/out/api/i18n.js` gets one appended line registering its
 *    module-level `resetTranslationsCache` in a global set, so the sim's
 *    i18n store can still invalidate the TranslationsGetter cache of a copy
 *    that lives inside an app bundle (src/i18n-store.ts). The package does
 *    not export that function anywhere public.
 *
 * Caching: a build is keyed by its entry set and platform, and considered
 * fresh while every input file esbuild recorded (the metafile) still has the
 * same mtime and size. A hit copies the cached output into the caller's
 * unique output dir — the unique dir is what defeats module caches (Node's
 * and vite-node's) on redeploy and re-render, so it is never skipped.
 */

import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Metafile, Plugin } from 'esbuild';
import { PASSTHROUGH_OK } from './shims/shim-registry.js';

export type BundlePlatform = 'node' | 'browser';

export interface BundleOptions {
  /** The app root. Entry paths are reported relative to it; its node_modules win. */
  appDir: string;
  /** Absolute paths of the files to bundle. One esbuild build, shared chunks. */
  entryPoints: string[];
  platform: BundlePlatform;
  /** Unique, not-yet-existing directory to write this build (or the cache hit) into. */
  outDir: string;
  /** Skip the cache entirely (always rebuild, never store). */
  noCache?: boolean;
}

export interface BundleResult {
  /** `file://` URL of THE bundle — one file per build, like Forge's one artifact per app. */
  url: string;
  /**
   * Absolute entry path → the export name under which that file's module
   * namespace is exposed on the bundle (`export * as e0 from '<file>'`).
   * `importEntry()` does the lookup.
   */
  entryExports: Map<string, string>;
  /** True when the output came from the cache rather than a fresh build. */
  cached: boolean;
  /** `@forge/<name>` packages whose code ended up inside the bundle (any depth). */
  inlinedForgePackages: string[];
  /** `@forge/<name>` packages imported DIRECTLY by app code (not transitively). */
  directForgeImports: string[];
}

// ── Locations ─────────────────────────────────────────────────────────────

const HERE = fileURLToPath(import.meta.url);
/** Package root: src/bundler.ts and dist/bundler.js are both one level down. */
const PKG_ROOT = resolve(dirname(HERE), '..');
/** The compiled resolver shim — the one app-facing shim left, inlined per bundle. */
const RESOLVER_SHIM = join(PKG_ROOT, 'dist', 'shims', 'forge-resolver.js');
/** Fallback resolution root for scratch apps that have no node_modules of their own. */
const FORGE_SIM_NODE_MODULES = join(PKG_ROOT, 'node_modules');

/**
 * `require`, `__filename` and `__dirname` for the ESM output. Inlined CommonJS
 * packages call `require('fs')` and the like; esbuild leaves those as a
 * `__require` helper that throws "Dynamic require is not supported" unless a
 * real `require` is in scope (esbuild's own documented fix is this banner).
 * esbuild renames an app's own top-level `require` to avoid the collision —
 * measured, not assumed. `__dirname` points at the bundle, as it does in
 * Forge's bundled output.
 */
const NODE_BANNER = [
  `import { createRequire as __forgeSimCreateRequire } from 'node:module';`,
  `import { fileURLToPath as __forgeSimFileURLToPath } from 'node:url';`,
  `import { dirname as __forgeSimDirname } from 'node:path';`,
  `const require = __forgeSimCreateRequire(import.meta.url);`,
  `const __filename = __forgeSimFileURLToPath(import.meta.url);`,
  `const __dirname = __forgeSimDirname(__filename);`,
].join('\n');

/**
 * Force bundler-style ("Babel") CommonJS interop for default imports.
 *
 * esbuild decides per importer: an ESM file inside a `"type": "module"`
 * package (or any .mjs/.mts) gets NODE semantics — `import kvs from
 * '@forge/kvs'` yields the whole `module.exports`, and `kvs.get` is undefined
 * — while every other importer gets the bundler convention where an
 * `__esModule` module's default is `exports.default`. There is no option to
 * override it. Forge's own bundler applies the bundler convention to every
 * app, which is why Atlassian's documented default-import style works in
 * production for `"type": "module"` apps too. forge-sim's package.json is
 * itself `"type": "module"`, so every in-repo fixture without a package.json
 * of its own would otherwise hit Node mode.
 *
 * The output is unminified, so the helper call is stable and greppable:
 * `__toESM(require_x(), 1)` — the `1` is `isNodeMode`. Dropping it is the
 * whole switch (esbuild's `__toESM` reads only that flag).
 */
function forceBundlerInterop(code: string): string {
  return code.replace(/__toESM\((require_[A-Za-z0-9_$]+\(\)), 1\)/g, '__toESM($1)');
}

/** Global registry of bundled `@forge/api` i18n cache resets; read by src/i18n-store.ts. */
export const I18N_RESET_REGISTRY_KEY = Symbol.for('forge-sim.i18n-cache-resets');

// ── Plugins ───────────────────────────────────────────────────────────────

function forgeSimPlugins(platform: BundlePlatform): Plugin[] {
  return [
    {
      name: 'forge-sim-resolver-shim',
      setup(build) {
        // A plugin rather than esbuild's `alias` option so it is applied
        // deterministically before any other resolution.
        build.onResolve({ filter: /^@forge\/resolver$/ }, () => ({ path: RESOLVER_SHIM }));
      },
    },
    {
      name: 'forge-sim-i18n-reset-registry',
      setup(build) {
        build.onLoad({ filter: /[\\/]node_modules[\\/]@forge[\\/]api[\\/]out[\\/]api[\\/]i18n\.js$/ }, async (args) => {
          const source = await readFile(args.path, 'utf8');
          // `exports` is the CommonJS module's own object inside esbuild's wrapper.
          const registration =
            `\n;(globalThis[Symbol.for('forge-sim.i18n-cache-resets')] ??= new Set())` +
            `.add(new WeakRef(exports.resetTranslationsCache));\n`;
          return { contents: source + registration, loader: 'js' };
        });
      },
    },
    {
      name: 'forge-sim-externals',
      setup(build) {
        // Native addons cannot be bundled (and do not run in Forge either).
        build.onResolve({ filter: /\.node$/ }, (args) => ({ path: args.path, external: true }));
        // A bare specifier esbuild cannot resolve — an optional dependency a
        // package `require`s behind a try/catch, say — stays external so the
        // failure happens at call time, exactly as it would under Node, and
        // not at build time where it would block an app that never calls it.
        build.onResolve({ filter: /^[^./]/ }, async (args) => {
          if (args.pluginData?.forgeSimProbe || args.kind === 'entry-point') return undefined;
          const probe = await build.resolve(args.path, {
            kind: args.kind,
            resolveDir: args.resolveDir,
            importer: args.importer,
            pluginData: { forgeSimProbe: true },
          });
          if (probe.errors.length > 0) return { path: args.path, external: true };
          return undefined;
        });
      },
    },
    ...(platform === 'browser' ? [] : []),
  ];
}

// ── Metafile analysis ─────────────────────────────────────────────────────

const FORGE_PKG_IN_PATH = /[\\/]node_modules[\\/](@forge[\\/][^\\/]+)[\\/]/;

function forgePackageOf(path: string): string | null {
  const m = FORGE_PKG_IN_PATH.exec(path);
  return m ? m[1].replace('\\', '/') : null;
}

function analyze(meta: Metafile): Pick<BundleResult, 'inlinedForgePackages' | 'directForgeImports'> {
  const inlined = new Set<string>();
  const direct = new Set<string>();
  for (const [input, info] of Object.entries(meta.inputs)) {
    const pkg = forgePackageOf(input);
    if (pkg) inlined.add(pkg);
    const fromApp = !/[\\/]node_modules[\\/]/.test(input);
    if (!fromApp) continue;
    for (const imp of info.imports) {
      const target = forgePackageOf(imp.path);
      if (target) direct.add(target);
    }
  }
  return { inlinedForgePackages: [...inlined].sort(), directForgeImports: [...direct].sort() };
}

/**
 * Direct `@forge/*` imports the sim does not answer. Transitive deps of the
 * real packages (`@forge/auth`, `@forge/egress`, `@forge/i18n`,
 * `@forge/manifest` under `@forge/api`) are not "unsimulated" in any sense an
 * app can act on, so only DIRECT imports are judged.
 */
export function unsimulatedForgeImports(result: Pick<BundleResult, 'directForgeImports'>): string[] {
  const simulated = new Set<string>([...PASSTHROUGH_OK, '@forge/resolver']);
  return result.directForgeImports.filter((p) => !simulated.has(p));
}

// ── Cache ─────────────────────────────────────────────────────────────────

interface CacheMeta {
  version: 2;
  inputs: Array<{ path: string; mtimeMs: number; size: number }>;
  /** Entry (absolute) → export name on the bundle. */
  entries: Array<[string, string]>;
  inlinedForgePackages: string[];
  directForgeImports: string[];
}

function cacheRoot(appDir: string): string {
  return join(appDir, '.forge-sim', 'bundles', 'cache');
}

function cacheKey(opts: BundleOptions): string {
  const h = createHash('sha1');
  h.update(opts.platform);
  for (const e of [...opts.entryPoints].sort()) h.update('\0' + relative(opts.appDir, e));
  h.update('\0' + PKG_ROOT);
  return h.digest('hex').slice(0, 16);
}

async function readCache(dir: string): Promise<CacheMeta | null> {
  try {
    const meta = JSON.parse(await readFile(join(dir, 'meta.json'), 'utf8')) as CacheMeta;
    if (meta.version !== 2) return null;
    for (const input of meta.inputs) {
      const s = await stat(input.path);
      if (s.mtimeMs !== input.mtimeMs || s.size !== input.size) return null;
    }
    await stat(join(dir, 'files', BUNDLE_FILE));
    return meta;
  } catch {
    return null; // missing, torn by a concurrent writer, or an input changed/vanished
  }
}

async function writeCache(dir: string, filesFrom: string, meta: CacheMeta): Promise<void> {
  // Build the entry under a temp name and rename into place, so a concurrent
  // reader never sees a half-written entry (vitest workers share fixture dirs).
  const tmp = `${dir}.tmp-${Math.random().toString(36).slice(2)}`;
  try {
    await mkdir(join(tmp, 'files'), { recursive: true });
    await cp(filesFrom, join(tmp, 'files'), { recursive: true });
    await writeFile(join(tmp, 'meta.json'), JSON.stringify(meta), 'utf8');
    await rm(dir, { recursive: true, force: true });
    await rename(tmp, dir);
  } catch {
    await rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

// ── Build ─────────────────────────────────────────────────────────────────

const BUNDLE_FILE = 'bundle.mjs';

/**
 * ONE bundle per build, from a synthetic entry that re-exports every handler
 * file as its own namespace — `forge deploy` builds one artifact per app, and
 * so does this. The alternative, esbuild's multi-entry code splitting, was
 * tried and rejected: a dynamically imported CommonJS module becomes a split
 * chunk that exposes only `default`, so an app's
 * `const { route } = await import('@forge/api')` lost its named exports.
 * Without splitting that form is `__toESM(require_api())` and keeps them.
 * A single file also makes every shared module a single instance per deploy
 * (@forge/sql's migrationRunner across handler files) with no chunk plumbing.
 */
function syntheticEntry(entries: string[]): { contents: string; exportsFor: Map<string, string> } {
  const exportsFor = new Map<string, string>();
  const lines: string[] = [];
  [...entries].sort().forEach((file, i) => {
    const name = `e${i}`;
    exportsFor.set(file, name);
    lines.push(`export * as ${name} from ${JSON.stringify(file)};`);
  });
  return { contents: lines.join('\n') + '\n', exportsFor };
}

export async function bundleEntries(opts: BundleOptions): Promise<BundleResult> {
  const appDir = resolve(opts.appDir);
  const entries = opts.entryPoints.map((e) => resolve(e));
  const key = cacheKey({ ...opts, appDir, entryPoints: entries });
  const cacheDir = join(cacheRoot(appDir), key);
  const outFile = join(opts.outDir, BUNDLE_FILE);

  if (!opts.noCache) {
    const hit = await readCache(cacheDir);
    if (hit) {
      await mkdir(opts.outDir, { recursive: true });
      await cp(join(cacheDir, 'files'), opts.outDir, { recursive: true });
      return {
        url: pathToFileURL(outFile).href,
        entryExports: new Map(hit.entries),
        cached: true,
        inlinedForgePackages: hit.inlinedForgePackages,
        directForgeImports: hit.directForgeImports,
      };
    }
  }

  const esbuild = await import('esbuild');
  const isNode = opts.platform === 'node';
  const entry = syntheticEntry(entries);
  const result = await esbuild.build({
    stdin: { contents: entry.contents, resolveDir: appDir, sourcefile: 'forge-sim-entry.js', loader: 'js' },
    bundle: true,
    format: 'esm',
    platform: opts.platform,
    target: isNode ? 'node22' : 'es2022',
    jsx: 'automatic',
    sourcemap: 'inline',
    metafile: true,
    write: false,
    outfile: outFile,
    absWorkingDir: appDir,
    nodePaths: [FORGE_SIM_NODE_MODULES],
    banner: isNode ? { js: NODE_BANNER } : undefined,
    plugins: forgeSimPlugins(opts.platform),
    logLevel: 'silent',
  });

  await mkdir(opts.outDir, { recursive: true });
  for (const file of result.outputFiles) {
    await writeFile(file.path, forceBundlerInterop(file.text), 'utf8');
  }

  const meta = result.metafile!;
  const entryOuts: Array<[string, string]> = [...entry.exportsFor];
  const analysis = analyze(meta);

  if (!opts.noCache) {
    const inputs: CacheMeta['inputs'] = [];
    for (const input of Object.keys(meta.inputs)) {
      const abs = isAbsolute(input) ? input : resolve(appDir, input);
      try {
        const s = await stat(abs);
        inputs.push({ path: abs, mtimeMs: s.mtimeMs, size: s.size });
      } catch {
        // virtual or namespaced input — not a file to watch
      }
    }
    await writeCache(cacheDir, opts.outDir, { version: 2, inputs, entries: entryOuts, ...analysis });
  }

  return { url: pathToFileURL(outFile).href, entryExports: entry.exportsFor, cached: false, ...analysis };
}

/** Import the bundle and return the module namespace of one of its entry files. */
export async function importEntry(bundle: BundleResult, entryPath: string): Promise<any> {
  const name = bundle.entryExports.get(resolve(entryPath));
  if (!name) throw new Error(`forge-sim: bundle has no entry for ${entryPath}`);
  const mod = await import(bundle.url);
  return mod[name];
}

/** Remove cache entries for an app (tests, `forge-sim reset`). Best-effort. */
export async function clearBundleCache(appDir: string): Promise<void> {
  await rm(cacheRoot(resolve(appDir)), { recursive: true, force: true }).catch(() => {});
}

/** Names of cache entries present for an app — for tests and diagnostics. */
export async function listBundleCache(appDir: string): Promise<string[]> {
  try {
    return (await readdir(cacheRoot(resolve(appDir)))).filter((n) => !n.includes('.tmp-')).sort();
  } catch {
    return [];
  }
}
