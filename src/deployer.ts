/**
 * Deployer — loads a Forge app directory into the simulator.
 *
 * Reads the manifest, resolves handler strings (e.g. "index.handler") to actual
 * module files in src/, dynamically imports them, and wires everything up:
 * resolvers, consumers, triggers, scheduled triggers.
 *
 * This is the "deploy to sim" equivalent — one call, zero app modifications.
 */

import { resolve, join, dirname } from 'node:path';
import { access, mkdir, writeFile, readdir, unlink } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseManifest, type ParsedManifest, type ManifestFunction } from './manifest.js';
import type { ForgeSimulator } from './simulator.js';

/** Per-app cache dir for esbuild deploy bundles. Convention follows fit-keys/
 *  and other forge-sim sidecar state. Bundles live here briefly between
 *  deploys; we sweep stale ones at the start of every redeploy. */
export function deployBundleDir(appDir: string): string {
  return join(appDir, '.forge-sim', 'bundles');
}

/**
 * Module-scoped dedupe set for manifest-warning stderr prints.
 *
 * Skill run #14 surfaced that the original per-simulator-instance dedupe was
 * too narrow: vitest test files commonly call `createSimulator()` in a fresh
 * `beforeEach`, so the per-instance Set reset every test → the same Node
 * runtime-mismatch warning printed once per `it()`, multiplying noise by the
 * test count.
 *
 * Module scope is the right granularity. Each worker process gets its own
 * Set; within a worker, every sim instance shares the dedupe, so a unique
 * warning message prints exactly once for the lifetime of the process — both
 * in vitest workers AND in long-running dev servers. The `result.warnings`
 * array still carries every warning on every deploy for programmatic callers
 * (MCP responses, in-process inspection), which is the real contract.
 */
const printedManifestWarnings = new Set<string>();

/**
 * Test-only escape hatch for resetting the module-scope dedupe Set.
 * Used by `warning-noise.test.ts` so each F7 case starts from a clean slate
 * and can assert the dedupe behavior independently of test execution order.
 * Underscore prefix signals "do not call from production code."
 */
export function _resetPrintedManifestWarnings(): void {
  printedManifestWarnings.clear();
}

/** Best-effort sweep of older deploy bundles so the dir doesn't grow without
 *  bound across many redeploys. Failures are swallowed (e.g. dir doesn't
 *  exist yet, or files are still in-use somewhere on Windows). */
export async function sweepStaleBundles(dir: string): Promise<void> {
  try {
    const names = await readdir(dir);
    await Promise.all(
      names
        .filter((n) => n.startsWith('deploy-') && n.endsWith('.mjs'))
        .map((n) => unlink(join(dir, n)).catch(() => {}))
    );
  } catch {
    // Dir doesn't exist yet — nothing to sweep.
  }
}

/**
 * Bundle a handler entry-point and all its relative-import dependencies into
 * a single ESM source file, returning a `file://` URL ready for `import()`.
 *
 * Why: Node's ESM dynamic-import cache is keyed on the full specifier URL.
 * Appending `?t=Date.now()` to the entry-point busts the entry's cache, but
 * NOT its transitive imports — those resolve to plain URLs with no query and
 * stay cached forever across redeploys. The agent's iterate loop sees old
 * code after editing any transitive handler file (F3 from skill run #6).
 *
 * The fix: esbuild bundles the entry plus every relative-import descendant
 * into one source. The bundle is written to `<appDir>/.forge-sim/bundles/`
 * with a per-deploy random filename, so the resulting URL is a brand-new
 * module specifier on every deploy. Bare-specifier imports (`@forge/*`,
 * react, axios, …) stay external — they're resolved by Node's loader
 * (which our hooks intercept for @forge/*) walking up from the bundle file
 * to the app's `node_modules`. The @forge/* shim interception still fires.
 *
 * Works in both regular Node (MCP mode) and vitest (vite-node) because each
 * deploy writes a new file with a new URL — neither cache has seen it before.
 *
 * Why not `data:` URLs (the initial attempt): Node can't resolve bare
 * specifiers from a data: URL — no parent path means no node_modules walk.
 * A file URL inside the app dir gives bare imports a natural resolution root.
 *
 * Sourcemap is inline so stack traces still point back at user source.
 */
export async function bundleHandlerToFileUrl(entryPath: string, appDir: string): Promise<string> {
  const esbuild = await import('esbuild');
  const result = await esbuild.build({
    entryPoints: [entryPath],
    bundle: true,
    format: 'esm',
    target: 'node22',
    platform: 'node',
    write: false,
    sourcemap: 'inline',
    absWorkingDir: dirname(entryPath),
    plugins: [
      {
        name: 'forge-sim-bare-externals',
        setup(build) {
          // Mark every non-relative, non-absolute specifier as external — they
          // get resolved by Node's loader (which our hooks intercept for @forge/*).
          // Keeps node_modules out of the bundle (faster + avoids bundling native
          // addons) and preserves the @forge/* shim interception path.
          build.onResolve({ filter: /^[^./]/ }, () => ({ external: true }));
        },
      },
    ],
  });
  const code = result.outputFiles[0].text;

  const cacheDir = deployBundleDir(appDir);
  await mkdir(cacheDir, { recursive: true });
  // Per-deploy random filename — what makes the resulting URL unique and
  // therefore bypasses both Node's ESM cache and vite-node's path-based cache.
  const fileName = `deploy-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`;
  const outPath = join(cacheDir, fileName);
  await writeFile(outPath, code, 'utf-8');
  return pathToFileURL(outPath).href;
}
// Bridge is now managed by sim.ui — no direct bridge imports needed here

/** Summary entry for a trigger, matching the MCP `forge.deploy` response shape. */
export interface DeployTriggerSummary {
  key: string;
  events: string[];
  function: string;
}

/** Summary entry for a queue consumer, matching the MCP `forge.deploy` response shape. */
export interface DeployConsumerSummary {
  key: string;
  queue: string;
  function: string;
}

/** Summary entry for a UI module, matching the MCP `forge.deploy` response shape. */
export interface DeployUIModuleSummary {
  key: string;
  type: string;
  resource?: string;
  resolver?: string;
}

/** Summary entry for a web trigger, matching the MCP `forge.deploy` response shape. */
export interface DeployWebTriggerSummary {
  key: string;
  function: string;
}

export interface DeployOptions {
  /**
   * Fire each scheduled trigger once at deploy time (default: true).
   *
   * Parity note: real Forge starts every scheduled trigger "shortly after it
   * is created, about 5 minutes after app deployment" and re-creates/resets
   * them on every redeploy that touches the module — so a deploy-time fire is
   * the time-compressed equivalent, and it's what makes migration triggers
   * (okr-tracker pattern) run before tests touch the database. Set to false
   * when a side-effectful job (daily digest, outbound webhook) shouldn't run
   * as part of deploy; fire it explicitly with sim.fireScheduledTrigger(key).
   */
  fireScheduledTriggers?: boolean;
}

export interface DeployResult {
  manifest: ParsedManifest;
  loadedFunctions: string[];
  loadedResources: string[];
  /**
   * Convenience summaries mirroring the MCP `forge.deploy` response.
   *
   * Publish-gate F3: the MCP tool returned `{resolvers, triggers, uiModules}`
   * while the in-process `sim.deploy()` only exposed the raw manifest —
   * assertions written against one surface failed on the other. Both
   * surfaces now share these fields (the MCP handler consumes them
   * directly), so the shapes cannot drift.
   */
  /** Registered resolver function keys after this deploy. */
  resolvers: string[];
  triggers: DeployTriggerSummary[];
  consumers: DeployConsumerSummary[];
  uiModules: DeployUIModuleSummary[];
  /**
   * Web trigger modules (eval B4: these used to be silently folded into
   * `resolvers`, misrepresenting their (request, context) calling
   * convention). Fire them with `sim.fireWebTrigger(key)` or the MCP
   * `forge.fire_web_trigger` tool — NOT `sim.invoke()`.
   */
  webTriggers: DeployWebTriggerSummary[];
  errors: Array<{ functionKey: string; error: string }>;
  /**
   * Manifest validation warnings (and info-level notes). Mirrored from
   * `manifest.warnings` so both the in-process API and the MCP path can
   * surface them in the same place — previously they only reached
   * in-process callers via `console.warn`, leaving MCP responses silent
   * about the same issues.
   */
  warnings: ParsedManifest['warnings'];
}

/**
 * Resolve a Forge handler string like "index.handler" to a file path and export name.
 * 
 * Convention: "file.exportName" → src/file.{js,ts,mjs} → import { exportName }
 * Supports nested: "resolvers/issue.handler" → src/resolvers/issue.{js,ts,mjs}
 */
function parseHandlerString(handler: string): { fileStem: string; exportName: string } {
  const lastDot = handler.lastIndexOf('.');
  if (lastDot === -1) {
    return { fileStem: handler, exportName: 'default' };
  }
  return {
    fileStem: handler.substring(0, lastDot),
    exportName: handler.substring(lastDot + 1),
  };
}

const FILE_EXTENSIONS = ['.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs'];

/**
 * Find the actual file for a handler stem, checking src/ with various extensions.
 */
async function resolveHandlerFile(appDir: string, fileStem: string): Promise<string | null> {
  // Try appDir-relative first (handles "src/resolver" → appDir/src/resolver.ts)
  for (const ext of FILE_EXTENSIONS) {
    const candidate = resolve(appDir, fileStem + ext);
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }

  // Fallback: try under src/ (handles "resolver" → appDir/src/resolver.ts)
  for (const ext of FILE_EXTENSIONS) {
    const candidate = resolve(appDir, 'src', fileStem + ext);
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }

  return null;
}

/**
 * Find the actual file for a resource path, trying exact match first then extensions.
 */
export async function resolveResourceFile(appDir: string, resourcePath: string): Promise<string | null> {
  const exact = resolve(appDir, resourcePath);

  // If the path ends in .tsx/.ts/.jsx, try .js first (Node can't import tsx natively)
  if (/\.tsx?$|\.jsx$/.test(resourcePath)) {
    const jsPath = exact.replace(/\.tsx?$|\.jsx$/, '.js');
    try {
      await access(jsPath);
      return jsPath;
    } catch {}
  }

  // Try exact path
  try {
    await access(exact);
    return exact;
  } catch {}

  // Try without extension + each extension
  const withoutExt = exact.replace(/\.[^.]+$/, '');
  for (const ext of FILE_EXTENSIONS) {
    const candidate = withoutExt + ext;
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }

  return null;
}

/**
 * Deploy a Forge app directory into a simulator instance.
 * 
 * 1. Reads manifest.yml from appDir
 * 2. For each function in the manifest, resolves the handler file and imports it
 * 3. Wires up resolvers, consumers, and triggers on the simulator
 */
export async function deploy(sim: ForgeSimulator, appDir: string, options: DeployOptions = {}): Promise<DeployResult> {
  const absDir = resolve(appDir);
  const manifestPath = join(absDir, 'manifest.yml');

  // 1. Parse manifest
  const manifest = await parseManifest(manifestPath);

  // Surface manifest validation warnings.
  // Module-scope dedupe: vitest test files commonly create a fresh sim in
  // `beforeEach`, so dedupe must span the worker process to be useful — the
  // alternative is the runtime-mismatch warning printing N times in an N-test
  // file (skill run #14). The result.warnings array still carries every
  // warning on every deploy for programmatic callers (MCP responses,
  // in-process inspection). See `printedManifestWarnings` above. (F7)
  for (const w of manifest.warnings) {
    if (printedManifestWarnings.has(w.message)) continue;
    printedManifestWarnings.add(w.message);
    const prefix = w.level === 'error' ? '❌' : '⚠️';
    console.warn(`[forge-sim] ${prefix} ${w.message}`);
  }

  // 1b. If there are UI resources, install the bridge and connect to sim
  if (manifest.resources.size > 0) {
    sim.ui.ensureBridge();
  }

  // 1c. Register Custom Entity Store schemas from app.storage.entities.
  // Without this, entity.set() silently accepts wrongly-typed values and
  // entity.query().index() drops partition/range filters → apps that work
  // in forge-sim fail in real Forge. This was P1 in the post-run-4 bug haul.
  // Tests that manually call sim.kvs.registerEntitySchema() still work —
  // they just no-op-overwrite with the same schema if the manifest also
  // declared it, or register fresh if they're using a fixture without
  // app.storage.entities.
  for (const [entityName, entityDef] of manifest.entities) {
    sim.kvs.registerEntitySchema(entityName, {
      attributes: entityDef.attributes,
      indexes: entityDef.indexes ?? [],
    });
  }

  // 1d. Inject environment variables into process.env BEFORE loading any
  // handler modules — top-level handler code reads process.env at module
  // evaluation time. Re-reads .forge-sim/variables.json on every deploy,
  // so (like real Forge) variable changes take effect at redeploy.
  await sim.variables.inject(absDir);

  const loadedFunctions: string[] = [];
  const loadedResources: string[] = [];
  const errors: Array<{ functionKey: string; error: string }> = [];

  // Start a deploy epoch: existing resolver keys become "stale", so the
  // re-evaluated app code silently REPLACES them instead of tripping the
  // "overwriting an existing definition" warning. Redeploying without
  // reset() is normal (real Forge redeploys replace the app wholesale);
  // the warning is reserved for the same key defined twice WITHIN one
  // deploy — the actual duplicate-key footgun. Publish-gate F6.
  sim.resolver.beginDeployEpoch();

  // Sweep old deploy bundles so this dir doesn't grow without bound. Bundles
  // from previous deploys are no longer needed once their modules are cached
  // by Node — we generate a fresh one per deploy anyway.
  await sweepStaleBundles(deployBundleDir(absDir));

  // 2. Register @forge/* loader hooks (redirects @forge/api etc. to our shims).
  //    Called lazily so users don't need --import. Hooks apply to all subsequent
  //    dynamic imports, which is exactly how we load app handler modules below.
  //    Safe to call multiple times — Node deduplicates registered hooks.
  //    Always target dist/loader/hooks.js because hooks run in a Node worker
  //    thread where tsx/TypeScript isn't available.
  try {
    const { register } = await import('node:module');
    const { fileURLToPath: toPath } = await import('node:url');
    const { resolve: pathResolve, dirname: pathDirname } = await import('node:path');
    const thisFile = toPath(import.meta.url);
    // From src/deployer.ts → ../../dist/loader/, from dist/deployer.js → ../dist/loader/
    const pkgRoot = pathResolve(pathDirname(thisFile), thisFile.endsWith('.ts') ? '..' : '..');
    const hooksDir = pathToFileURL(pathResolve(pkgRoot, 'dist', 'loader') + '/').href;
    register('./hooks.js', hooksDir);
  } catch {
    // Fallback: loader hooks already registered via --import, or Node version doesn't support register()
  }

  // 3. Load each function module
  const handlerExports = new Map<string, any>();
  // Per-deploy bundle/import cache keyed by absolute source path. Many manifests
  // route multiple function entries through the same source file (e.g. OKR's
  // `index.handler`, `index.runMigration`, `index.recalcKeyResult` all live in
  // `src/index.ts`). Without this cache, each function re-bundled and re-imported
  // the same file under a unique URL, re-evaluating its top-level code N times
  // and tripping the "resolver.define overwriting" warning on every redundant
  // pass. We still want fresh evaluation across distinct `deploy()` calls
  // (that's what cache-busts edits between iterations), so the cache lives in
  // function scope and dies when this call returns. (F8 root cause)
  const moduleCache = new Map<string, any>();

  for (const [fnKey, fnDef] of manifest.functions) {
    try {
      const { fileStem, exportName } = parseHandlerString(fnDef.handler);
      const filePath = await resolveHandlerFile(absDir, fileStem);

      if (!filePath) {
        errors.push({
          functionKey: fnKey,
          error: `Could not find handler file for "${fnDef.handler}" (tried src/${fileStem}.{js,ts,mjs,cjs} and ${fileStem}.{js,ts,mjs,cjs})`,
        });
        continue;
      }

      // Bundle+import the source file exactly once per deploy, reusing the
      // same module for every manifest function that points at it. See the
      // `moduleCache` comment above for the F8 backstory.
      let mod = moduleCache.get(filePath);
      if (!mod) {
        const fileUrl = await bundleHandlerToFileUrl(filePath, absDir);
        mod = await import(fileUrl);
        moduleCache.set(filePath, mod);
      }

      const handler = mod[exportName] ?? mod.default?.[exportName];
      if (!handler) {
        errors.push({
          functionKey: fnKey,
          error: `Module "${filePath}" has no export "${exportName}". Available: ${Object.keys(mod).join(', ')}`,
        });
        continue;
      }

      handlerExports.set(fnKey, handler);
      loadedFunctions.push(fnKey);
    } catch (err) {
      errors.push({
        functionKey: fnKey,
        error: `Failed to load "${fnDef.handler}": ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // ── Determine function types from manifest context ──────────────────────
  // Build sets of function keys by how they're used in the manifest
  const triggerFnKeys = new Set(manifest.triggers.map(t => t.functionKey));
  const consumerFnKeys = new Set(manifest.consumers.map(c => c.functionKey));
  const scheduledFnKeys = new Set(manifest.scheduledTriggers.map(s => s.functionKey));
  const resolverFnKeys = new Set<string>();
  for (const uiModule of manifest.uiModules) {
    if (uiModule.resolverFunctionKey) resolverFnKeys.add(uiModule.resolverFunctionKey);
  }

  // 3. Wire up resolvers (UI bridge pattern) and register module routing
  // UI modules reference functions via resolver.function — those functions
  // export a Resolver's getDefinitions() result (a map of handler functions).
  // Resolver-defined functions get { payload, context } as a single wrapped object.
  for (const uiModule of manifest.uiModules) {
    // Register module routing (resolver function key and/or endpoint key)
    sim.registerModuleRoute(uiModule.key, {
      resolverFunctionKey: uiModule.resolverFunctionKey,
      endpointKey: uiModule.endpointKey,
      moduleType: uiModule.type,
    });

    if (!uiModule.resolverFunctionKey) continue;

    const exported = handlerExports.get(uiModule.resolverFunctionKey);
    if (!exported) continue;

    if (typeof exported === 'object') {
      // It's a definitions map from Resolver.getDefinitions(). The @forge/resolver
      // shim already registered these with sim.resolver during bundle evaluation
      // (each `resolver.define()` call inside user code routes through it). So
      // this loop is a no-op for keys already present — registering them again
      // would just trigger the "overwriting" footgun-warning meant for users
      // who define the same key in two different files. (F8)
      const already = new Set(sim.resolver.getDefinitions());
      for (const [defKey, defHandler] of Object.entries(exported)) {
        if (typeof defHandler !== 'function') continue;
        if (!already.has(defKey)) {
          // User exported a plain `{ foo: fn }` map without using the Resolver
          // shim — register the function ourselves so invoke() can reach it.
          sim.resolver.define(defKey, defHandler as any);
        }
        sim.registerResolverOwnership(defKey, uiModule.resolverFunctionKey);
      }
    } else if (typeof exported === 'function') {
      if (!sim.resolver.getDefinitions().includes(uiModule.resolverFunctionKey)) {
        sim.resolver.define(uiModule.resolverFunctionKey, exported);
      }
      sim.registerResolverOwnership(uiModule.resolverFunctionKey, uiModule.resolverFunctionKey);
    }
  }

  // Also register non-resolver functions that export definitions maps
  // (e.g., functions used by invoke() but not referenced by UI modules)
  for (const [fnKey, handler] of handlerExports) {
    if (typeof handler === 'object') {
      // Definitions map — register each sub-handler as resolver type
      for (const [defKey, defHandler] of Object.entries(handler)) {
        if (typeof defHandler === 'function' && !sim.resolver.getDefinitions().includes(defKey)) {
          sim.resolver.define(defKey, defHandler as any);
        }
      }
    }
  }

  // 4. Register trigger functions in the function registry
  // Triggers receive (event, context) as two separate arguments.
  for (const trigger of manifest.triggers) {
    const handler = handlerExports.get(trigger.functionKey);
    if (handler && typeof handler === 'function') {
      sim.registerFunction(trigger.functionKey, handler, 'trigger');
    }
  }

  // 5. Wire up consumers
  // Consumers receive (event, context) as two separate arguments.
  for (const consumer of manifest.consumers) {
    const handler = handlerExports.get(consumer.functionKey);
    if (handler && typeof handler === 'function') {
      sim.registerFunction(consumer.functionKey, handler, 'consumer');
      sim.registerConsumer(consumer.queue, handler);
    }
  }

  // 6. Register scheduled trigger functions
  // Scheduled triggers receive ({ context: { cloudId, moduleKey }, contextToken }, context)
  // and must return { statusCode, body?, headers?, statusText? }.
  for (const st of manifest.scheduledTriggers) {
    const handler = handlerExports.get(st.functionKey);
    if (handler && typeof handler === 'function') {
      sim.registerFunction(st.functionKey, handler, 'scheduledTrigger');
    }
  }

  // 7. Register web trigger functions
  // Web triggers receive (request, context) — request is { method, path,
  // headers, queryParameters, body }. Registering them with their real type
  // (instead of letting them fall through to the generic/resolver bucket
  // below) keeps them OUT of the resolvers list and lets sim.invoke() catch
  // the wrong-convention call with a pointer to fireWebTrigger (eval B4).
  for (const wt of manifest.webTriggers) {
    const handler = handlerExports.get(wt.functionKey);
    if (handler && typeof handler === 'function' && !sim.functions.has(wt.functionKey)) {
      sim.registerFunction(wt.functionKey, handler, 'webTrigger');
    }
  }

  // 8. Register remaining functions as generic (if not already registered)
  for (const [fnKey, handler] of handlerExports) {
    if (typeof handler === 'function' && !sim.functions.has(fnKey)) {
      // Not a trigger, consumer, scheduled trigger, or web trigger —
      // register as generic
      sim.registerFunction(fnKey, handler, 'generic');
      // Also make it available via resolver.define() for backward compat
      if (!sim.resolver.getDefinitions().includes(fnKey)) {
        sim.resolver.define(fnKey, handler);
      }
    }
  }

  // Store manifest + app dir on simulator BEFORE firing scheduled triggers —
  // fireScheduledTrigger looks the trigger up in sim.manifest and throws
  // "No manifest loaded" otherwise. loadManifestData only sets state
  // (manifest ref, module routing, webTrigger URLs, remotes), so hoisting it
  // above the firing step is side-effect-free.
  sim.loadManifestData(manifest);
  sim.setAppDir(absDir);

  // 9. Fire scheduled triggers once on deploy (unless opted out)
  // In real Forge, every scheduled trigger "starts shortly after it is
  // created, about 5 minutes after app deployment", then repeats on its
  // interval — so firing each one once at deploy time is the time-compressed
  // equivalent, and it's what runs migration triggers before tests touch the
  // database. Opt out with { fireScheduledTriggers: false } for apps whose
  // scheduled jobs have side effects you don't want on every deploy.
  //
  // Delegates to sim.fireScheduledTrigger — the single source of truth for
  // the request shape ({ context: { cloudId, moduleKey }, contextToken }),
  // full context (installContext, connected-account identity), and strict
  // response validation. This used to be a lenient inline copy that swallowed
  // missing-statusCode responses; real Forge records a 424 Failed Dependency
  // for those, so hiding them was an inverted parity violation (the
  // okr-tracker silent-424, 2026-07-14). Requires loadManifestData to have
  // run first — see the hoisted call above.
  const fireScheduled = options.fireScheduledTriggers !== false;
  for (const st of fireScheduled ? manifest.scheduledTriggers : []) {
    const handler = handlerExports.get(st.functionKey);
    if (handler && typeof handler === 'function') {
      console.log(` ⏰ Firing scheduled trigger: ${st.key} (${st.functionKey})`);
      try {
        const result = await sim.fireScheduledTrigger(st.key);
        if (result.statusCode >= 400) {
          const detail = result.error ?? `status ${result.statusCode}`;
          console.error(` ⚠️ Scheduled trigger "${st.key}" failed: ${detail}`);
          errors.push({ functionKey: st.functionKey, error: `Scheduled trigger error: ${detail}` });
        }
      } catch (err: any) {
        console.error(` ⚠️ Scheduled trigger "${st.key}" failed:`, err.message);
        errors.push({ functionKey: st.functionKey, error: `Scheduled trigger error: ${err.message}` });
      }
    }
  }

  // 10. UI resources are NOT loaded during deploy — they're lazy-loaded by
  //    sim.ui.render(moduleKey) for per-module ForgeDoc isolation and proper
  //    context scoping. We DO record the resource keys at deploy time so the
  //    deploy response accurately reflects what the simulator knows about,
  //    and surface a clear error for any resource whose `path` doesn't resolve
  //    to a real file on disk — that's a typo waiting to explode at render.
  for (const resource of manifest.resources.values()) {
    const resolved = await resolveResourceFile(absDir, resource.path);
    if (resolved === null) {
      errors.push({
        functionKey: resource.key,
        error: `Resource "${resource.key}" path "${resource.path}" does not resolve to a file (tried exact + ${FILE_EXTENSIONS.join('/')} extensions).`,
      });
      continue;
    }
    loadedResources.push(resource.key);
  }

  // Initialize FIT provider if the manifest has remotes
  if (manifest.remotes.size > 0) {
    await sim.fit.init(absDir);
  }

  return {
    manifest,
    loadedFunctions,
    loadedResources,
    resolvers: sim.resolver.getDefinitions(),
    triggers: manifest.triggers.map((t) => ({
      key: t.key,
      events: t.events,
      function: t.functionKey,
    })),
    consumers: manifest.consumers.map((c) => ({
      key: c.key,
      queue: c.queue,
      function: c.functionKey,
    })),
    uiModules: manifest.uiModules.map((u) => ({
      key: u.key,
      type: u.type,
      resource: u.resourceKey,
      resolver: u.resolverFunctionKey,
    })),
    webTriggers: manifest.webTriggers.map((wt) => ({
      key: wt.key,
      function: wt.functionKey,
    })),
    errors,
    warnings: manifest.warnings,
  };
}
