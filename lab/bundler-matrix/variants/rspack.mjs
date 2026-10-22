// Rspack with typical user defaults: production mode (so MINIFIED output,
// unlike the Forge config), builtin swc classic JSX (React.createElement per
// the packaging standard), HtmlRspackPlugin pages, splitChunks for multi.
import { rspack } from '@rspack/core';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const lab = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(lab, 'app', 'src');
const outDir = path.join(lab, 'build', 'rspack');

const swcJsxRule = {
  test: /\.jsx$/,
  use: {
    loader: 'builtin:swc-loader',
    options: {
      jsc: {
        parser: { syntax: 'ecmascript', jsx: true },
        transform: { react: { runtime: 'classic', pragma: 'React.createElement', pragmaFrag: 'React.Fragment' } },
      },
    },
  },
  type: 'javascript/auto',
};

function run(config) {
  return new Promise((res, rej) => {
    rspack(config, (err, stats) => {
      if (err) return rej(err);
      if (stats.hasErrors()) return rej(new Error(stats.toString({ errors: true, all: false })));
      res();
    });
  });
}

await run({
  mode: 'production',
  target: 'node',
  entry: { index: path.join(src, 'backend.js') },
  output: { path: path.join(outDir, 'out'), filename: '[name].js', library: { type: 'commonjs2' } },
  resolve: { extensions: ['.js', '.jsx', '.json'] },
});

const frontendBase = {
  mode: 'production',
  target: 'web',
  module: { rules: [swcJsxRule] },
  resolve: { extensions: ['.js', '.jsx', '.json'] },
};

await run({
  ...frontendBase,
  entry: { main: path.join(src, 'frontend.jsx') },
  output: { path: path.join(outDir, 'frontend'), filename: '[name].js', publicPath: 'auto' },
  plugins: [new rspack.HtmlRspackPlugin({ inject: 'body' })],
});

await run({
  ...frontendBase,
  optimization: { splitChunks: { chunks: 'all' } },
  entry: { home: path.join(src, 'home.jsx'), settings: path.join(src, 'settings.jsx') },
  output: { path: path.join(outDir, 'frontend-multi'), filename: '[name].js', publicPath: 'auto' },
  plugins: [
    new rspack.HtmlRspackPlugin({ filename: 'home.html', chunks: ['home'], inject: 'body' }),
    new rspack.HtmlRspackPlugin({ filename: 'settings.html', chunks: ['settings'], inject: 'body' }),
  ],
});

console.log('rspack: built');
