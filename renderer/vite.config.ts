import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  define: {
    // @atlaskit/editor-core deep deps reference process.env (Node global)
    // which doesn't exist in the browser — Vite doesn't polyfill it.
    'process.env.NODE_ENV': JSON.stringify('development'),
    'process.env': JSON.stringify({}),
  },
});
