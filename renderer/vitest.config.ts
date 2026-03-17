import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
  define: {
    // Atlaskit deep deps reference process.env (Node global)
    'process.env.NODE_ENV': JSON.stringify('test'),
    'process.env': JSON.stringify({}),
  },
});
