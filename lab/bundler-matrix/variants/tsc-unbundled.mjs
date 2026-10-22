// The documented "Plain TypeScript on the backend" shape: COMPILER OUTPUT
// ONLY — nothing bundled — with the app's dependencies installed into
// <app.package.path>/node_modules (`yarn install --production
// --modules-folder ./dist/node_modules` in the docs). Bare `require('@forge/kvs')`
// survives to runtime and Node resolves it from the package dir. We emulate
// tsc with esbuild in transpile-only mode (bundle: false, CJS out) and link
// the lab's node_modules in. The handler keeps the source tree's nesting
// (`resolvers/main.handler`), the standard's `cucumber/two.handler` shape.
// Frontend: a plain single-entry module-script build (UI Kit can't ship
// unbundled).
import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile, symlink, lstat, unlink } from 'node:fs/promises';
import path from 'node:path';

const lab = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(lab, 'app', 'src');
const outDir = path.join(lab, 'build', 'tsc-unbundled');

await esbuild.build({
  entryPoints: [path.join(src, 'backend.js')],
  bundle: false, platform: 'node', format: 'cjs',
  outfile: path.join(outDir, 'out', 'resolvers', 'main.js'), logLevel: 'silent',
});
const link = path.join(outDir, 'out', 'node_modules');
try { await lstat(link); await unlink(link); } catch { /* absent */ }
await symlink(path.join(lab, 'node_modules'), link, 'dir');

await esbuild.build({
  entryPoints: [path.join(src, 'frontend.jsx')],
  bundle: true, platform: 'browser', format: 'esm',
  define: { 'process.env.NODE_ENV': '"production"' },
  outfile: path.join(outDir, 'frontend', 'index.js'), logLevel: 'silent',
});
await mkdir(path.join(outDir, 'frontend'), { recursive: true });
await writeFile(
  path.join(outDir, 'frontend', 'index.html'),
  '<!doctype html><html><head></head><body><script type="module" src="./index.js"></script></body></html>\n',
);

console.log('tsc-unbundled: built');
