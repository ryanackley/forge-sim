// Vite, two ways.
//  frontend/        — bare `vite build` defaults (the common shape): absolute
//                     src (base '/'), automatic JSX, modulepreload polyfill.
//  frontend-multi/  — the CANONICAL multi-entry example from the Forge
//                     packaging docs: @vitejs/plugin-react, base './',
//                     rollupOptions.input { home, settings }; classic JSX per
//                     the packaging standard; React.StrictMode in home.
//  out/             — SSR build. Vite 5+ SSR output is ESM-only, so this is
//                     the deliberate OFF-STANDARD probe: an ESM .js backend
//                     with "type": "module" (the standard says CommonJS).
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const lab = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(lab, 'app', 'src');
const outDir = path.join(lab, 'build', 'vite');

await build({
  configFile: false,
  root: src,
  logLevel: 'warn',
  build: { outDir: path.join(outDir, 'frontend'), emptyOutDir: true },
});

await build({
  configFile: false,
  root: src,
  logLevel: 'warn',
  base: './',
  plugins: [react({ jsxRuntime: 'classic' })],
  build: {
    outDir: path.join(outDir, 'frontend-multi'),
    emptyOutDir: true,
    rollupOptions: {
      input: { home: path.join(src, 'home.html'), settings: path.join(src, 'settings.html') },
    },
  },
});

await build({
  configFile: false,
  logLevel: 'warn',
  build: {
    ssr: path.join(src, 'backend.js'),
    outDir: path.join(outDir, 'out'),
    emptyOutDir: true,
    rollupOptions: { output: { format: 'es', entryFileNames: 'index.js' } },
  },
  ssr: { noExternal: true, target: 'node' },
});

console.log('vite: built');
