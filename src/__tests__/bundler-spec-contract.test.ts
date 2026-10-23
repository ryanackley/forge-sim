/**
 * @forge/bundler is the specification; this test pins our esbuild config to
 * it the way seam-registry.ts pins the backend seams and bridge-protocol
 * .test.ts pins the bridge commands: the facts are DERIVED from the installed
 * Atlassian package at test time, so a version bump that changes what
 * `forge deploy` does fails here instead of surfacing as an app that works in
 * the sim and not in Forge (or the reverse).
 *
 * Two config factories are read: `getCommonWebpackConfig` (backend;
 * out/config/common.js — it asserts `require.main`, a CLI precondition we
 * satisfy with a placeholder main module) and `getNativeUiBuildConfig`
 * (UI Kit frontends; out/config/nativeui.js). The backend `target` lives in
 * out/runtime.js and is read from source.
 *
 * Deliberate differences are not hidden: KNOWN_SPEC_DEVIATIONS in
 * src/bundler.ts is asserted in both directions, so neither side can move
 * without the record being revisited.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import Module from 'node:module';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import {
  esbuildBaseOptions,
  RESOLVE_EXTENSIONS,
  KNOWN_SPEC_DEVIATIONS,
  bundleEntries,
} from '../bundler.js';
import { VERIFIED_FORGE_VERSIONS } from '../forge-package-versions.js';

const require = createRequire(import.meta.url);

type Rule = { test: RegExp; loader?: string; use?: Array<{ loader: string; options?: any }> };
type Plugin = { constructor: { name: string }; options?: any; userOptions?: any };

let backend: any;
let uiSingle: any;
let uiMulti: any;
let runtimeSource: string;

beforeAll(() => {
  // getCommonWebpackConfig throws Text.noExecutableFile when `require.main`
  // is unset (true under vitest); it only checks for presence.
  if (!(process as any).mainModule) {
    (process as any).mainModule = new (Module as any)('forge-sim-bundler-spec-contract', null);
  }
  const common = require('@forge/bundler/out/config/common.js');
  const nativeui = require('@forge/bundler/out/config/nativeui.js');
  backend = common.getCommonWebpackConfig({
    entryPoints: [{ name: 'index', path: 'src/index.js' }],
    appDirectory: process.cwd(),
    watchMode: false,
  });
  uiSingle = nativeui.getNativeUiBuildConfig([{ name: 'main', path: 'src/index.jsx', isMultiEntry: false }], undefined, false);
  uiMulti = nativeui.getNativeUiBuildConfig(
    [{ name: 'home', path: 'home.jsx', isMultiEntry: true }, { name: 'settings', path: 'settings.jsx', isMultiEntry: true }],
    undefined,
    false,
  );
  runtimeSource = readFileSync(require.resolve('@forge/bundler/out/runtime.js'), 'utf8');
});

const ruleFor = (cfg: any, re: RegExp): Rule | undefined =>
  cfg.module.rules.find((r: Rule) => String(r.test) === String(re));
const babelPlugins = (rule: Rule) => (rule.use![0].options.plugins as any[]).map((p) =>
  Array.isArray(p) ? { name: p[0] as string, options: p[1] } : { name: p as string, options: undefined });

describe('@forge/bundler is the pinned specification', () => {
  it('the installed version is the one recorded in VERIFIED_FORGE_VERSIONS', () => {
    expect(require('@forge/bundler/package.json').version).toBe(VERIFIED_FORGE_VERSIONS['@forge/bundler']);
  });

  describe('JSX', () => {
    it('frontend .jsx is classic React.createElement via Babel — so we must not force the automatic runtime', () => {
      const jsx = babelPlugins(ruleFor(uiSingle, /\.jsx?$/)!).find((p) => p.name.includes('plugin-transform-react-jsx'));
      expect(jsx?.options).toEqual({ pragma: 'React.createElement' });
      for (const platform of ['node', 'browser'] as const) {
        const ours = esbuildBaseOptions(platform) as Record<string, unknown>;
        expect(ours.jsx, `${platform}: esbuild default is React.createElement — leave it`).toBeUndefined();
        expect(ours.jsxFactory).toBeUndefined();
        expect(ours.jsxImportSource).toBeUndefined();
      }
    });

    it('frontend .tsx is ts-loader with NO compilerOptions override — the app tsconfig decides, which esbuild honours by default', () => {
      const tsx = ruleFor(uiSingle, /\.tsx?$/)!;
      expect(tsx.loader).toBe('ts-loader');
      expect(tsx.use).toBeUndefined();
      expect((esbuildBaseOptions('browser') as Record<string, unknown>).tsconfigRaw).toBeUndefined();
    });

    it('backend .tsx uses the legacy ForgeUI.createElement factory (UI Kit 1) — recorded, not mirrored', () => {
      // UI Kit 1 (@forge/ui) is gone; a backend .tsx file is not a shape the
      // sim supports. If Atlassian drops or changes this rule, revisit.
      const tsx = ruleFor(backend, /\.tsx?$/)!;
      expect(tsx.use![0].options.compilerOptions).toMatchObject({ jsx: 'react', jsxFactory: 'ForgeUI.createElement' });
    });
  });

  describe('resolution', () => {
    it('backend resolve.extensions match, in order', () => {
      expect(RESOLVE_EXTENSIONS.node).toEqual(backend.resolve.extensions);
    });

    it('frontend resolve.extensions match for code; the image types are asset/resource in Forge', () => {
      const code = (uiSingle.resolve.extensions as string[]).filter((e) => !/\.(jpe?g|png|gif|svg)$/.test(e));
      expect(RESOLVE_EXTENSIONS.browser).toEqual(code);
      const assets = ruleFor(uiSingle, /\.(jpe?g|png|gif|svg)$/i) as any;
      expect(assets?.type).toBe('asset/resource');
    });

    it('every module Forge IgnorePlugins stays external under our unresolvable-stays-external rule', async () => {
      const ignored = (backend.plugins as Plugin[])
        .filter((p) => p.constructor.name === 'IgnorePlugin')
        .map((p) => String(p.options.resourceRegExp));
      expect(ignored).toEqual(['/^encoding$/', '/^(bufferutil|utf-8-validate)$/', '/^dtrace-provider$/']);
      // Behavioural: an app requiring each of them behind try/catch (the way
      // node-fetch, ws and bunyan do) must bundle without error.
      const appDir = mkdtempSync(join(tmpdir(), 'forge-sim-spec-ignore-'));
      try {
        writeFileSync(join(appDir, 'package.json'), '{ "name": "spec-ignore", "private": true }');
        writeFileSync(
          join(appDir, 'index.js'),
          ['encoding', 'bufferutil', 'utf-8-validate', 'dtrace-provider']
            .map((m) => `try { require('${m}'); } catch {}`)
            .join('\n') + '\nexport const handler = () => "ok";\n',
        );
        const out = await bundleEntries({ appDir, entryPoints: [join(appDir, 'index.js')], platform: 'node', outDir: join(appDir, '.out'), noCache: true });
        expect(out.url).toMatch(/bundle\.cjs$/);
      } finally {
        rmSync(appDir, { recursive: true, force: true });
      }
    });
  });

  describe('output', () => {
    it('Forge does not minify; neither do we', () => {
      expect(backend.mode).toBe('production');
      expect(backend.optimization.minimize).toBe(false);
      expect(uiSingle.mode).toBe('production');
      expect((esbuildBaseOptions('node') as Record<string, unknown>).minify).toBeFalsy();
      expect((esbuildBaseOptions('browser') as Record<string, unknown>).minify).toBeFalsy();
    });

    it('output format matches: Forge emits CommonJS and so do we (backend); frontends are ESM module scripts', () => {
      expect(backend.output.libraryTarget).toBe('commonjs');
      expect(esbuildBaseOptions('node').format).toBe('cjs');
      // Browsers load <script type="module"> as ESM by definition — the
      // frontend side mirrors the page contract, not the backend loader.
      expect(esbuildBaseOptions('browser').format).toBe('esm');
    });

    it('backend target: Forge lowers to node18, we lower to node22 — a recorded deviation, asserted both ways', () => {
      const m = /webpackConfig\.target\s*=\s*'([^']+)'/.exec(runtimeSource);
      expect(m?.[1]).toBe(KNOWN_SPEC_DEVIATIONS.backendTarget.forge);
      expect(esbuildBaseOptions('node').target).toBe(KNOWN_SPEC_DEVIATIONS.backendTarget.ours);
    });

    it('node.__dirname: Forge polyfills it (true); CJS output has it natively', () => {
      expect(backend.node).toEqual({ __dirname: true });
      // No banner to assert anymore: with format cjs, require/__filename/
      // __dirname are the real CJS module-scope bindings. The behavioural
      // check lives in the suite (every backend fixture evaluates).
      expect(esbuildBaseOptions('node').format).toBe('cjs');
    });

    it('globalObject is `this` for the backend (a CJS module scope, not window)', () => {
      expect(backend.output.globalObject).toBe('this');
    });
  });

  describe('UI Kit page shape — the premise behind extractEntryScripts', () => {
    it('HtmlWebpackPlugin injects a CLASSIC script into the body: index.html for single, <entry>.html per entry for multi', () => {
      const html = (cfg: any) => (cfg.plugins as Plugin[])
        .filter((p) => p.constructor.name === 'HtmlWebpackPlugin')
        .map((p) => p.userOptions ?? p.options);
      expect(html(uiSingle)).toEqual([{ filename: 'index.html', chunks: ['main'], inject: 'body' }]);
      expect(html(uiMulti)).toEqual([
        { filename: 'home.html', chunks: ['home'], inject: 'body' },
        { filename: 'settings.html', chunks: ['settings'], inject: 'body' },
      ]);
      // No scriptLoading: 'module' → html-webpack-plugin's default is a
      // deferred CLASSIC script. That is why the classic-script fallback in
      // extractEntryScripts must evaluate every script, not just module ones.
      for (const o of [...html(uiSingle), ...html(uiMulti)]) expect(o.scriptLoading).toBeUndefined();
    });

    it('multi-entry builds split chunks (shared chunk + entry per page); single-entry builds do not', () => {
      expect(uiMulti.optimization).toEqual({ splitChunks: { chunks: 'all' } });
      expect(uiSingle.optimization).toBeUndefined();
    });

    it('publicPath is auto — the runtime reads document.currentScript.src at evaluation', () => {
      expect(uiSingle.output.publicPath).toBe('auto');
      expect(uiSingle.target).toBe('web');
    });

    it('the web-worker UI Kit config exists (ESM output, eager dynamic imports, iframe-resizer aliased away) — watch item', () => {
      const nativeui = require('@forge/bundler/out/config/nativeui.js');
      const worker = nativeui.getNativeUiWorkerBuildConfig([{ name: 'main', path: 'x.jsx', isMultiEntry: false }], undefined, undefined, false);
      expect(worker.target).toBe('webworker');
      expect(worker.experiments).toEqual({ outputModule: true });
      expect(worker.resolve.alias).toEqual({ 'iframe-resizer': false });
    });
  });
});
