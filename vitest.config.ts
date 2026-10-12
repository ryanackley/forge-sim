import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { tmpdir } from 'os';
import { realpathSync } from 'fs';
import { shimFileBase, shimNamesBySpecificity } from './src/shims/shim-registry.js';

export default defineConfig({
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
