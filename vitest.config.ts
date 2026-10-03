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
