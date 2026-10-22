// esbuild run by the USER (not forge-sim's own config): minified CJS
// backend; minified IIFE single frontend behind a hand-written CLASSIC
// script tag; multi-entry ESM with `splitting` (shared chunk under chunks/).
// JSX: esbuild's default transform is React.createElement — exactly the
// `--jsx-factory=React.createElement` the packaging standard names.
import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const lab = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(lab, 'app', 'src');
const outDir = path.join(lab, 'build', 'esbuild-user');
const define = { 'process.env.NODE_ENV': '"production"' };

await esbuild.build({
  entryPoints: [path.join(src, 'backend.js')],
  bundle: true, platform: 'node', format: 'cjs', minify: true,
  outfile: path.join(outDir, 'out', 'index.js'), logLevel: 'silent',
});

await esbuild.build({
  entryPoints: [path.join(src, 'frontend.jsx')],
  bundle: true, platform: 'browser', format: 'iife', minify: true, define,
  outfile: path.join(outDir, 'frontend', 'index.js'), logLevel: 'silent',
});
await mkdir(path.join(outDir, 'frontend'), { recursive: true });
await writeFile(
  path.join(outDir, 'frontend', 'index.html'),
  '<!doctype html><html><body><div id="root"></div><script defer src="./index.js"></script></body></html>\n',
);

await esbuild.build({
  entryPoints: { home: path.join(src, 'home.jsx'), settings: path.join(src, 'settings.jsx') },
  bundle: true, platform: 'browser', format: 'esm', splitting: true, minify: true, define,
  outdir: path.join(outDir, 'frontend-multi'), chunkNames: 'chunks/[name]-[hash]', logLevel: 'silent',
});
for (const e of ['home', 'settings']) {
  await writeFile(
    path.join(outDir, 'frontend-multi', `${e}.html`),
    `<!doctype html><html><head></head><body><script type="module" src="./${e}.js"></script></body></html>\n`,
  );
}

console.log('esbuild-user: built');
