import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { tmpdir } from 'os';
import { realpathSync, readFileSync } from 'fs';
import { shimFileBase, shimNamesBySpecificity } from './src/shims/shim-registry.js';

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
  plugins: [forgeSimWasmPlugin()],
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
    alias: {
      // Generated from the SAME registry the Node loader hooks use, so the two
      // resolution mechanisms cannot drift. This list used to be maintained by
      // hand and fell five entries behind: `@forge/realtime` and `@forge/llm`
      // (no real package installed) failed to import at all, while the three
      // product bridges silently resolved to the real Atlassian package
      // instead of the shim. See src/shims/shim-registry.ts.
      //
      // `shimNamesBySpecificity()` orders subpaths before their parent package,
      // which is load-bearing: rollup matches alias keys as PREFIXES, so a
      // bare '@forge/react' listed first would mangle '@forge/react/router'
      // into '.../forge-react.ts/router'.
      ...Object.fromEntries(
        shimNamesBySpecificity().map((pkg) => [
          pkg,
          resolve(__dirname, 'src/shims', `${shimFileBase(pkg)}.ts`),
        ]),
      ),
      // Self-alias so doc-example tests can use the user-facing import
      // (`from 'forge-sim'`) while running against live source — the bare
      // self-reference would resolve to a possibly-stale dist/ build.
      'forge-sim': resolve(__dirname, 'src/index.ts'),
    },
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
});
