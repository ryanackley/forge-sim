import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    exclude: ['**/node_modules/**', '**/renderer/**', '**/e2e/**'],
  },
  resolve: {
    alias: {
      '@forge/api': resolve(__dirname, 'src/shims/forge-api.ts'),
      '@forge/kvs': resolve(__dirname, 'src/shims/forge-kvs.ts'),
      '@forge/events': resolve(__dirname, 'src/shims/forge-events.ts'),
      '@forge/resolver': resolve(__dirname, 'src/shims/forge-resolver.ts'),
      '@forge/object-store': resolve(__dirname, 'src/shims/forge-object-store.ts'),
      '@forge/bridge': resolve(__dirname, 'src/shims/forge-bridge.ts'),
      // Subpath alias must come before the bare package — rollup alias
      // matches string keys as prefixes, so '@forge/react' would otherwise
      // mangle '@forge/react/router' into 'forge-react.ts/router'.
      '@forge/react/router': resolve(__dirname, 'src/shims/forge-react-router.ts'),
      '@forge/react': resolve(__dirname, 'src/shims/forge-react.ts'),
      // Self-alias so doc-example tests can use the user-facing import
      // (`from 'forge-sim'`) while running against live source — the bare
      // self-reference would resolve to a possibly-stale dist/ build.
      'forge-sim': resolve(__dirname, 'src/simulator.ts'),
    },
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
});
