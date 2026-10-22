// Rollup: CJS backend; single-file ESM frontend (dynamic imports inlined);
// multi-entry code-split build (shared chunk + lazy iframe-resizer chunk
// under chunks/, exercising relative chunk imports). Classic JSX via
// @rollup/plugin-babel, as the packaging standard names it.
import { rollup } from 'rollup';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import json from '@rollup/plugin-json';
import { babel } from '@rollup/plugin-babel';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const lab = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(lab, 'app', 'src');
const outDir = path.join(lab, 'build', 'rollup');

const quiet = (warning, warn) => {
  if (['CIRCULAR_DEPENDENCY', 'THIS_IS_UNDEFINED', 'EVAL'].includes(warning.code)) return;
  warn(warning);
};
const html = (js) =>
  `<!doctype html><html><head></head><body><script type="module" src="./${js}"></script></body></html>\n`;

const backend = await rollup({
  input: path.join(src, 'backend.js'),
  onwarn: quiet,
  plugins: [nodeResolve({ exportConditions: ['node'], preferBuiltins: true }), commonjs(), json()],
});
await backend.write({ file: path.join(outDir, 'out', 'index.js'), format: 'cjs', inlineDynamicImports: true });
await backend.close();

const frontendPlugins = () => [
  replace({ preventAssignment: true, 'process.env.NODE_ENV': '"production"' }),
  babel({
    babelHelpers: 'bundled',
    extensions: ['.jsx'],
    exclude: 'node_modules/**',
    plugins: [['@babel/plugin-transform-react-jsx', { pragma: 'React.createElement' }]],
  }),
  nodeResolve({ browser: true, extensions: ['.js', '.jsx'] }),
  commonjs(),
  json(),
];

const single = await rollup({ input: path.join(src, 'frontend.jsx'), onwarn: quiet, plugins: frontendPlugins() });
await single.write({ file: path.join(outDir, 'frontend', 'index.js'), format: 'es', inlineDynamicImports: true });
await single.close();
await writeFile(path.join(outDir, 'frontend', 'index.html'), html('index.js'));

const multi = await rollup({
  input: { home: path.join(src, 'home.jsx'), settings: path.join(src, 'settings.jsx') },
  onwarn: quiet,
  plugins: frontendPlugins(),
});
await multi.write({
  dir: path.join(outDir, 'frontend-multi'),
  format: 'es',
  entryFileNames: '[name].js',
  chunkFileNames: 'chunks/[name]-[hash].js',
});
await multi.close();
await mkdir(path.join(outDir, 'frontend-multi'), { recursive: true });
await writeFile(path.join(outDir, 'frontend-multi', 'home.html'), html('home.js'));
await writeFile(path.join(outDir, 'frontend-multi', 'settings.html'), html('settings.js'));

console.log('rollup: built');
