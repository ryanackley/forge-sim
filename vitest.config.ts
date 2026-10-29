import { defineConfig } from 'vitest/config';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { realpathSync, readFileSync } from 'fs';
import { createRequire } from 'module';
import { PASSTHROUGH_OK, browserOnlyEntry } from './src/shims/shim-registry.js';

/**
 * Mirror Node's native wasm-ESM integration under vite-node.
 *
 * Plain-node runs (CLI, MCP daemon) import `.wasm` natively — current Node
 * ships the ESM integration unflagged (experimental warning only). vite-node
 * intercepts dynamic imports and rejects `.wasm` outright, so without this
 * plugin a manual-packaged app using wasm would pass in production AND in
 * `forge-sim dev`, but fail under vitest — an environment split inside the
 * sim itself. Named exports mirror the instance exports, same as Node.
 * Wasm modules with imports are rejected loudly (no silent stub).
 */
/**
 * Resolve PASSTHROUGH_OK `@forge/*` packages from forge-sim's own
 * node_modules ONLY when normal resolution fails.
 *
 * Those packages have no shim since the bare-seam migration, so they must
 * resolve to something real. An app deployed to a temp directory has no
 * node_modules of its own, and Vite resolves the bare id against the project
 * root — handing back a path that does not exist, so the package's own
 * relative requires fail with a baffling "Cannot find module './kvs'".
 *
 * This is deliberately a FALLBACK and not an alias: an alias would OVERRIDE
 * apps that ship their own copy, which is both wrong (a real Forge app runs
 * the version it shipped) and the exact scenario
 * migration-redeploy-parity.test.ts exists to guard. Node's loader hooks have
 * the same precedence (resolvePassthroughPackage in src/loader/hooks.ts):
 * importer first, forge-sim second.
 */
function forgeSimPassthroughFallback() {
  return {
    name: 'forge-sim-passthrough-fallback',
    // 'pre': Vite's own resolver THROWS on a package with no main/exports
    // (the product bridges), which aborts the chain before a later plugin
    // can answer. Running first — and still trying normal resolution via
    // this.resolve() before falling back — keeps importer-first precedence.
    enforce: 'pre' as const,
    async resolveId(source: string, importer: string | undefined, options: any) {
      // Root package, so `@forge/bridge/realtime` falls back like `@forge/bridge`.
      const rootPkg = source.startsWith('@forge/') ? source.split('/').slice(0, 2).join('/') : source;
      if (!(PASSTHROUGH_OK as readonly string[]).includes(rootPkg)) return null;
      // Vite throws ("Failed to resolve entry for package") rather than
      // returning null for a package with no main/exports — the product
      // bridges — so a throw here means "fall back", not "fail".
      let normal: unknown = null;
      try { normal = await (this as any).resolve(source, importer, { ...options, skipSelf: true }); } catch { /* fall back */ }
      if (normal) return normal;
      // Importer's copy first, forge-sim's second — same precedence as the
      // Node loader (resolvePassthroughPackage in src/loader/hooks.ts).
      const bases = [importer, fileURLToPath(import.meta.url)].filter((b): b is string => !!b);
      for (const base of bases) {
        const req = createRequire(base);
        try { return req.resolve(source); } catch { /* try the browser-only shape */ }
        if (source === rootPkg) {
          try {
            const pkgJsonPath = req.resolve(`${source}/package.json`);
            const entry = browserOnlyEntry(JSON.parse(readFileSync(pkgJsonPath, 'utf8')));
            if (entry) return resolve(dirname(pkgJsonPath), entry);
          } catch { /* next base */ }
        }
      }
      return null;
    },
  };
}

function forgeSimWasmPlugin() {
  return {
    name: 'forge-sim-wasm',
    enforce: 'pre' as const,
    load(id: string) {
      if (!id.split('?')[0].endsWith('.wasm')) return null;
      const bytes = readFileSync(id.split('?')[0]);
      const mod = new WebAssembly.Module(bytes);
      if (WebAssembly.Module.imports(mod).length > 0) {
        throw new Error(
          `forge-sim: wasm module ${id} declares imports — wasm-to-ESM import wiring ` +
          `is not simulated under vitest. Instantiate it manually with WebAssembly.instantiate().`
        );
      }
      const names = WebAssembly.Module.exports(mod)
        .filter((e) => e.kind === 'function' || e.kind === 'global')
        .map((e) => e.name);
      return [
        `const bytes = Buffer.from(${JSON.stringify(bytes.toString('base64'))}, 'base64');`,
        `const { instance } = await WebAssembly.instantiate(bytes, {});`,
        ...names.map(
          (n, i) =>
            `const __wasmExport${i} = instance.exports[${JSON.stringify(n)}]; ` +
            `export { __wasmExport${i} as ${JSON.stringify(n)} };`
        ),
      ].join('\n');
    },
  };
}

export default defineConfig({
  plugins: [forgeSimWasmPlugin(), forgeSimPassthroughFallback()],
  // vite >= 6.4.2 (security backport) gates vite-node's fs reads on
  // server.fs.allow — including the rewritten dynamic import() in our
  // deployer, which loads per-deploy handler bundles written into the app
  // dir. Several tests deploy apps from os.tmpdir(), so allow it (both the
  // symlink and its realpath; macOS tmpdirs live under /var -> /private/var).
  server: {
    fs: { allow: [__dirname, tmpdir(), realpathSync(tmpdir())] },
  },
  test: {
    globals: true,
    exclude: ['**/node_modules/**', '**/renderer/**', '**/e2e/**'],

    // Vitest's 5s default is wrong for this suite, and the mismatch showed up
    // as chronic flakiness: three consecutive full runs failed 2-3 tests each,
    // SEVEN distinct tests with ZERO overlap between runs, every one landing
    // in the 5.0-6.6s band. Nothing was broken — unrelated tests were taking
    // turns crossing the same cliff.
    //
    // The cliff is real work, not a hang. These are integration tests: each
    // deploy runs esbuild over a real app, and the SQL ones boot MySQL. Nine
    // tests legitimately exceed 3s and `persistence.test.ts` needs ~12.5s per
    // SQL test even running alone. With 10 CPUs' worth of forks competing,
    // an ordinary 1.8s deploy test stretches past 5s and dies — which test
    // loses the race is pure scheduling luck, hence the no-overlap pattern.
    //
    // 30s matches what the slowest suite already opted into by hand
    // (type-checker.test.ts passes 30000 per test) and leaves ~2x headroom
    // over the worst observed test. A genuine hang still fails the run, just
    // later; that is the trade, and it is the right one — a suite that cries
    // wolf on every change teaches people to re-run until green, which is how
    // a real regression slips through.
    //
    // hookTimeout matters as much as testTimeout here: beforeAll hooks are
    // where MySQL boots and apps deploy, and they inherit the same 5s default.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    // Array form (not the object map) so passthrough packages can use an
    // EXACT regex match — see below.
    alias: [
      // No `@forge/*` alias: every package runs for real (SHIM_NAMES in
      // src/shims/shim-registry.ts is empty), and a test file that imports
      // one gets the installed package against the seams forge-sim installs.
      // Self-alias so doc-example tests can use the user-facing import
      // (`from 'forge-sim'`) while running against live source — the bare
      // self-reference would resolve to a possibly-stale dist/ build.
      { find: /^forge-sim$/, replacement: resolve(__dirname, 'src/index.ts') },
    ],
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
});
