// Replica of @forge/bundler 7.3.0's webpack config, read off the installed
// Forge CLI (bundled-reliability.md, "Forge's real bundler, measured").
// Backend: getCommonWebpackConfig + NodeBundler — target node18, [name].cjs,
// commonjs library, globalObject 'this', no externals, minimize false,
// IgnorePlugin for the optional natives. Frontend: getNativeUiBuildConfig —
// target web, HtmlWebpackPlugin inject:'body' (CLASSIC script tag),
// publicPath 'auto', source maps, Babel classic JSX (React.createElement);
// multi-entry adds optimization.splitChunks { chunks: 'all' }.
import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const lab = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(lab, 'app', 'src');
const outDir = path.join(lab, 'build', 'forge-webpack');

const ignorePlugins = ['^encoding$', '^bufferutil$', '^utf-8-validate$', '^dtrace-provider$']
  .map((re) => new webpack.IgnorePlugin({ resourceRegExp: new RegExp(re) }));

const classicJsxRule = {
  test: /\.jsx$/,
  use: {
    loader: 'babel-loader',
    options: {
      plugins: [['@babel/plugin-transform-react-jsx', { pragma: 'React.createElement' }]],
    },
  },
};
const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.cjs'];

function run(config) {
  return new Promise((res, rej) => {
    webpack(config, (err, stats) => {
      if (err) return rej(err);
      if (stats.hasErrors()) return rej(new Error(stats.toString({ errors: true, all: false })));
      res();
    });
  });
}

await run({
  mode: 'production',
  optimization: { minimize: false },
  target: 'node18',
  entry: { index: path.join(src, 'backend.js') },
  output: {
    path: path.join(outDir, 'out'),
    filename: '[name].cjs',
    libraryTarget: 'commonjs',
    globalObject: 'this',
  },
  node: { __dirname: true },
  resolve: { extensions },
  plugins: ignorePlugins,
});

const frontendBase = {
  mode: 'production',
  optimization: { minimize: false },
  target: 'web',
  devtool: 'source-map',
  module: { rules: [classicJsxRule] },
  resolve: { extensions },
};

await run({
  ...frontendBase,
  entry: { main: path.join(src, 'frontend.jsx') },
  output: { path: path.join(outDir, 'frontend'), filename: '[name].js', publicPath: 'auto' },
  plugins: [new HtmlWebpackPlugin({ inject: 'body' })],
});

await run({
  ...frontendBase,
  optimization: { minimize: false, splitChunks: { chunks: 'all' } },
  entry: { home: path.join(src, 'home.jsx'), settings: path.join(src, 'settings.jsx') },
  output: { path: path.join(outDir, 'frontend-multi'), filename: '[name].js', publicPath: 'auto' },
  plugins: [
    new HtmlWebpackPlugin({ filename: 'home.html', chunks: ['home'], inject: 'body' }),
    new HtmlWebpackPlugin({ filename: 'settings.html', chunks: ['settings'], inject: 'body' }),
  ],
});

console.log('forge-webpack: built');
