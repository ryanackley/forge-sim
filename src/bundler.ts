/**
 * App bundler — esbuild over an app's entry points, the way `forge deploy`
 * builds a function before the Forge runtime ever loads it. Backend bundles
 * inline EVERY dependency; frontend bundles inline everything except the
 * shared runtime packages, which are pinned to absolute paths (see
 * PINNED_FRONTEND for why).
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
import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
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
 * Fingerprint of THIS module's compiled source, mixed into every cache key so
 * a change to how bundles are produced (plugins, banner, interop rewrite,
 * output shape) invalidates every cache entry on disk. Without it a cache
 * under a fixture kept serving bundles from a previous bundler version —
 * found when a cache hit imported 20x slower than a fresh build of the same
 * app, because the hit was an older output shape vite-node had to transform.
 */
const BUNDLER_FINGERPRINT = createHash('sha1').update(readFileSync(HERE)).digest('hex').slice(0, 12);

/**
 * Extension resolution order, mirrored from @forge/bundler's webpack
 * `resolve.extensions` — backend from config/common.js, frontend from
 * config/nativeui.js minus the image types (esbuild would need loaders for
 * those; Forge serves them as asset/resource URLs). Order only matters when
 * siblings differ by extension, but `.ts` before `.tsx` and `.js` before
 * `.jsx` is Forge's order, not esbuild's default (`.tsx` first). Asserted
 * against the installed package by bundler-spec-contract.test.ts.
 */
export const RESOLVE_EXTENSIONS: Record<BundlePlatform, string[]> = {
  node: ['.ts', '.tsx', '.js', '.jsx', '.json', '.cjs'],
  browser: ['.ts', '.tsx', '.js', '.jsx'],
};

/**
 * Where the sim's esbuild output KNOWINGLY differs from Forge's webpack
 * output. The contract test asserts each entry in both directions — if
 * Atlassian changes their side or we change ours, it fails and the record
 * must be revisited rather than quietly drift. Keep the reasons honest.
 */
export const KNOWN_SPEC_DEVIATIONS = {
  backendTarget: {
    forge: 'node18',
    ours: 'node22',
    reason:
      'esbuild `target` only lowers syntax. Forge lowers to node18 and runs the result on the nodejs22.x ' +
      'runtime the manifest names; node22 syntax is a superset the same runtime executes identically.',
  },
} as const;

/**
 * The static esbuild options every build shares — one object so the contract
 * test can compare them with @forge/bundler's config instead of reading the
 * build call.
 *
 * JSX is deliberately NOT set. Forge's bundler (config/nativeui.js) has two
 * rules: .jsx goes through Babel with `pragma: 'React.createElement'`
 * (classic, always), and .tsx goes through ts-loader with no override, so
 * the app's own tsconfig.json decides. esbuild unset does exactly that
 * pair: tsconfig `jsx` for .tsx, `React.createElement` otherwise. Forcing
 * 'automatic' (the old setting) let a .tsx app with no React import and no
 * tsconfig render here and fail `forge deploy` — the inverse parity
 * violation. No `minify` either: Forge builds `mode: production` with
 * `optimization.minimize: false`.
 *
 * Format: CJS for the backend — what Forge ships (`libraryTarget:
 * 'commonjs'`) and what its runtime loader require()s. Native `require`/
 * `__dirname` in scope (the old ESM output needed a banner to fake them),
 * bundles evict from `require.cache` on redeploy instead of pinning their
 * module graph in Node's ESM registry forever, and importing them bypasses
 * vite-node. `import.meta` in app code becomes undefined with a build
 * warning — measured against the real pipeline: webpack freezes
 * `import.meta.url` into a compile-time string of the build machine's
 * source path, so it is already meaningless on Forge, and nothing in any
 * fixture, docs example or real app reads it. ESM for the frontend —
 * browsers load `<script type="module">` as ESM by definition, and the
 * pinned-runtime facade is `file://` imports.
 */
export function esbuildBaseOptions(platform: BundlePlatform) {
  const isNode = platform === 'node';
  return {
    bundle: true as const,
    format: isNode ? ('cjs' as const) : ('esm' as const),
    platform,
    target: isNode ? KNOWN_SPEC_DEVIATIONS.backendTarget.ours : 'es2022',
    resolveExtensions: RESOLVE_EXTENSIONS[platform],
    // Backend maps are EXTERNAL (bundle.cjs.map): Node caches every loaded
    // module's inline source map in memory and keeps it after the module is
    // evicted from require.cache — measured at ~950 KB/deploy on a fat app
    // (heap snapshot: 41 sourceMappingURL strings after 40 deploys, 1 module
    // source). A linked map keeps stack traces readable at zero heap cost.
    // Frontend bundles keep inline maps: their file is deleted right after
    // import, so a linked map would 404.
    sourcemap: isNode ? ('linked' as const) : ('inline' as const),
    metafile: true as const,
    write: false as const,
    logLevel: 'silent' as const,
  };
}

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

/**
 * Frontend bundles PIN the shared runtime packages instead of inlining them.
 *
 * A fully self-contained browser bundle re-evaluates React, the reconciler
 * and @forge/bridge (~1 MB) on EVERY headless render, where Node used to
 * cache them once per process — measured at ~750 ms a render and a 4x slower
 * suite. So react*, @forge/react*, @forge/bridge* and the product bridges are
 * resolved at BUILD time to absolute paths (importer-first, forge-sim's copy
 * as the fallback, React always from wherever @forge/react resolves so there
 * is exactly one React) and left external as `file://` imports. Nothing is
 * resolved at runtime, the per-render bundle is the app's own code, and the
 * cache check stats only app files. Everything else is inlined.
 *
 * Each pinned import goes through a generated interop facade (namespace
 * `forge-sim-pinned`): esbuild cannot apply CommonJS interop to a module it
 * does not bundle, and Node's own default import of a CJS file is
 * `module.exports`, so `import ForgeReconciler from '@forge/react'` would
 * hand back the namespace and `.render` would be undefined. The facade
 * applies the bundler convention — this is the loader hook's old
 * CJS_DEFAULT_FACADE, now emitted by the bundler where it belongs.
 */
const PINNED_FRONTEND = /^(react|react-dom)(\/.*)?$|^@forge\/(react|bridge|jira-bridge|confluence-bridge|dashboards-bridge)(\/.*)?$/;
const REACT_SPECIFIER = /^(react|react-dom)(\/.*)?$/;
const PINNED_NS = 'forge-sim-pinned';

async function reactResolveDir(appDir: string): Promise<string> {
  const { createRequire } = await import('node:module');
  try {
    createRequire(join(appDir, 'package.json')).resolve('@forge/react/package.json');
    return appDir;
  } catch {
    return PKG_ROOT;
  }
}

function pinnedFacade(absPath: string): string {
  // An absolute PATH, not a file:// URL. Node accepts both; vite-node
  // externalizes `/…/node_modules/…` by path pattern and would otherwise
  // transform the whole @forge/react graph on every render (measured:
  // ~700 ms a render under vitest vs ~35 ms under plain Node).
  const spec = JSON.stringify(absPath);
  return [
    `import cjs from ${spec};`,
    `export * from ${spec};`,
    `export default (cjs && cjs.__esModule && 'default' in cjs) ? cjs.default : cjs;`,
    '',
  ].join('\n');
}

function forgeSimPlugins(platform: BundlePlatform, reactDir: string): Plugin[] {
  return [
    {
      name: 'forge-sim-pinned-externals',
      setup(build) {
        if (platform !== 'browser') return;
        // The facade's own imports are absolute paths: leave them external as-is.
        build.onResolve({ filter: /^\// }, (args) =>
          args.namespace === PINNED_NS ? { path: args.path, external: true } : undefined);
        build.onResolve({ filter: PINNED_FRONTEND }, async (args) => {
          if (args.pluginData?.forgeSimInternal) return undefined;
          const r = await build.resolve(args.path, {
            kind: args.kind,
            resolveDir: REACT_SPECIFIER.test(args.path) ? reactDir : args.resolveDir,
            importer: args.importer,
            pluginData: { forgeSimInternal: true },
          });
          if (r.errors.length > 0) return undefined; // let the normal error surface
          return { path: r.path, namespace: PINNED_NS };
        });
        build.onLoad({ filter: /.*/, namespace: PINNED_NS }, (args) => ({
          contents: pinnedFacade(args.path),
          loader: 'js',
        }));
      },
    },
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
          if (args.pluginData?.forgeSimInternal || args.kind === 'entry-point') return undefined;
          const probe = await build.resolve(args.path, {
            kind: args.kind,
            resolveDir: args.resolveDir,
            importer: args.importer,
            pluginData: { forgeSimInternal: true },
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
  h.update('\0' + BUNDLER_FINGERPRINT);
  return h.digest('hex').slice(0, 16);
}

async function readCache(dir: string, fileName: string): Promise<CacheMeta | null> {
  try {
    const meta = JSON.parse(await readFile(join(dir, 'meta.json'), 'utf8')) as CacheMeta;
    if (meta.version !== 2) return null;
    for (const input of meta.inputs) {
      const s = await stat(input.path);
      if (s.mtimeMs !== input.mtimeMs || s.size !== input.size) return null;
    }
    await stat(join(dir, 'files', fileName));
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

// .cjs/.mjs by platform so Node picks the loader from the extension alone,
// independent of the app's package.json `type`.
const bundleFileName = (platform: BundlePlatform) => (platform === 'node' ? 'bundle.cjs' : 'bundle.mjs');

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
  const fileName = bundleFileName(opts.platform);
  const outFile = join(opts.outDir, fileName);

  if (!opts.noCache) {
    const hit = await readCache(cacheDir, fileName);
    if (hit) {
      await mkdir(opts.outDir, { recursive: true });
      // read + write, NOT fs.cp: under vite-node a bundle produced by cp()
      // took ~1.1 s to import where an identical freshly written file took
      // ~30 ms (measured; cp's APFS clone / dir-event timing interacts badly
      // with Vite's cached fs checks). A plain write behaves like the build.
      // Every cached file comes along — node bundles ship a linked .map.
      for (const f of await readdir(join(cacheDir, 'files'))) {
        await writeFile(join(opts.outDir, f), await readFile(join(cacheDir, 'files', f)));
      }
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
  const reactDir = isNode ? appDir : await reactResolveDir(appDir);
  const result = await esbuild.build({
    ...esbuildBaseOptions(opts.platform),
    stdin: { contents: entry.contents, resolveDir: appDir, sourcefile: 'forge-sim-entry.js', loader: 'js' },
    outfile: outFile,
    absWorkingDir: appDir,
    nodePaths: [FORGE_SIM_NODE_MODULES],
    plugins: forgeSimPlugins(opts.platform, reactDir),
  });

  await mkdir(opts.outDir, { recursive: true });
  for (const file of result.outputFiles) {
    const text = file.path.endsWith('.map') ? file.text : forceBundlerInterop(file.text);
    await writeFile(file.path, text, 'utf8');
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

/**
 * Import the bundle and return the module namespace of one of its entry
 * files. Backend bundles are CJS and go through `require()` — Node's own CJS
 * loader (vite-node never sees them), and the entry lands in `require.cache`
 * where the next deploy's clearAppRequireCache() can EVICT it. The old ESM
 * output was pinned in Node's module registry for the life of the process
 * (deferred-issues.md, ~4 MB/deploy). Frontend bundles stay ESM module
 * scripts and keep dynamic import().
 */
export async function importEntry(bundle: BundleResult, entryPath: string): Promise<any> {
  const name = bundle.entryExports.get(resolve(entryPath));
  if (!name) throw new Error(`forge-sim: bundle has no entry for ${entryPath}`);
  if (bundle.url.endsWith('.cjs')) {
    const require = createRequire(import.meta.url);
    return require(fileURLToPath(bundle.url))[name];
  }
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
