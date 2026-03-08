import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    exclude: ['**/node_modules/**', '**/renderer/e2e/**'],
  },
  resolve: {
    alias: {
      '@forge/api': resolve(__dirname, 'src/shims/forge-api.ts'),
      '@forge/kvs': resolve(__dirname, 'src/shims/forge-kvs.ts'),
      '@forge/events': resolve(__dirname, 'src/shims/forge-events.ts'),
      '@forge/resolver': resolve(__dirname, 'src/shims/forge-resolver.ts'),
      '@forge/bridge': resolve(__dirname, 'src/shims/forge-bridge.ts'),
      '@forge/react': resolve(__dirname, 'src/shims/forge-react.ts'),
    },
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
});
