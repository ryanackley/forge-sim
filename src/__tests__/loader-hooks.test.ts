/**
 * Tests for the module loader hooks (src/loader/hooks.ts).
 *
 * Validates that @forge/* imports resolve to compiled dist/shims/*.js files,
 * both when running from source (tsx) and from compiled dist.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { resolve, load } from '../loader/hooks.js';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve as pathResolve, join, sep } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

// A no-op nextResolve that should never be called for @forge/* specifiers
const nextResolve = vi.fn(async (specifier: string) => ({
  url: `passthrough://${specifier}`,
  shortCircuit: false,
}));

const EXPECTED_SHIMS = [
  '@forge/api',
  '@forge/kvs',
  '@forge/events',
  '@forge/resolver',
  '@forge/react',
  '@forge/bridge',
  '@forge/jira-bridge',
  '@forge/confluence-bridge',
  '@forge/dashboards-bridge',
];

describe('Loader Hooks — resolve()', () => {
  describe('@forge/* shims', () => {
    for (const pkg of EXPECTED_SHIMS) {
      it(`resolves ${pkg} to a .js file in dist/shims/`, async () => {
        nextResolve.mockClear();

        const result = await resolve(pkg, {}, nextResolve);

        expect(result.shortCircuit).toBe(true);
        expect(nextResolve).not.toHaveBeenCalled();

        // Should be a file:// URL pointing to a .js file
        expect(result.url).toMatch(/^file:\/\//);
        expect(result.url).toMatch(/\.js$/);

        // Should be in a shims/ directory
        const filePath = fileURLToPath(result.url);
        expect(filePath).toContain(`${sep}shims${sep}`);

        // Should NOT point to a .ts file (the bug we fixed)
        expect(result.url).not.toMatch(/\.ts$/);
        expect(filePath).not.toMatch(/\.ts$/);
      });

      it(`resolves ${pkg} to a file that actually exists`, async () => {
        const result = await resolve(pkg, {}, nextResolve);
        const filePath = fileURLToPath(result.url);

        // The compiled shim must exist (requires `npm run build` first)
        const { access } = await import('node:fs/promises');
        await expect(access(filePath)).resolves.toBeUndefined();
      });
    }
  });

  describe('non-@forge specifiers', () => {
    it('delegates unknown specifiers to nextResolve', async () => {
      nextResolve.mockClear();

      const result = await resolve('lodash', {}, nextResolve);

      expect(nextResolve).toHaveBeenCalledWith('lodash', {});
      expect(result.url).toBe('passthrough://lodash');
    });

    it('delegates @forge/unknown to nextResolve', async () => {
      nextResolve.mockClear();

      const result = await resolve('@forge/unknown-package', {}, nextResolve);

      expect(nextResolve).toHaveBeenCalledWith('@forge/unknown-package', {});
    });
  });

  describe('unshimmed @forge/* warning', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('warns when an unshimmed @forge package resolves natively', async () => {
      await resolve('@forge/feature-flags', {}, nextResolve);

      const warning = warnSpy.mock.calls.map(c => String(c[0])).find(m =>
        m.includes('@forge/feature-flags')
      );
      expect(warning).toBeDefined();
      expect(warning).toContain('not simulated by forge-sim');
      expect(warning).toContain('real');
    });

    it('still resolves the unshimmed package via nextResolve (warn, not throw)', async () => {
      nextResolve.mockClear();

      const result = await resolve('@forge/cache', {}, nextResolve);

      expect(nextResolve).toHaveBeenCalledWith('@forge/cache', {});
      expect(result.url).toBe('passthrough://@forge/cache');
    });

    it('warns only once per specifier', async () => {
      await resolve('@forge/warn-once-test', {}, nextResolve);
      await resolve('@forge/warn-once-test', {}, nextResolve);
      await resolve('@forge/warn-once-test', {}, nextResolve);

      const warnings = warnSpy.mock.calls.filter(c =>
        String(c[0]).includes('@forge/warn-once-test')
      );
      expect(warnings).toHaveLength(1);
    });

    it('does NOT warn for @forge/sql (deliberate passthrough via __forge_fetch__)', async () => {
      await resolve('@forge/sql', {}, nextResolve);

      const warnings = warnSpy.mock.calls.filter(c =>
        String(c[0]).includes('@forge/sql')
      );
      expect(warnings).toHaveLength(0);
    });

    it('does NOT warn for @forge/sql subpaths', async () => {
      await resolve('@forge/sql/out/migration', {}, nextResolve);

      const warnings = warnSpy.mock.calls.filter(c =>
        String(c[0]).includes('@forge/sql')
      );
      expect(warnings).toHaveLength(0);
    });

    it('does NOT warn for shimmed packages', async () => {
      await resolve('@forge/api', {}, nextResolve);
      await resolve('@forge/react', {}, nextResolve);
      await resolve('@forge/react/router', {}, nextResolve);

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('warns with a subpath-specific message for unshimmed subpaths of shimmed packages', async () => {
      await resolve('@forge/react/some-internal-util', {}, nextResolve);

      const warning = warnSpy.mock.calls.map(c => String(c[0])).find(m =>
        m.includes('@forge/react/some-internal-util')
      );
      expect(warning).toBeDefined();
      expect(warning).toContain('not this subpath');
    });

    it('does not warn for non-@forge packages', async () => {
      await resolve('lodash', {}, nextResolve);

      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('@forge/sql CJS default-export facade (eval-5 F1 parity fix)', () => {
    // Real Forge bundles apps with __esModule-honoring interop, so
    // `import sql from '@forge/sql'` (Atlassian's documented style) yields
    // the sql instance. Node's native interop yields module.exports instead.
    // The facade papers over the difference.

    it('wraps @forge/sql in a facade URL with format module', async () => {
      const cjsNext = vi.fn(async () => ({
        url: 'file:///app/node_modules/@forge/sql/out/index.js',
        format: 'commonjs',
      }));

      const result = await resolve('@forge/sql', {}, cjsNext);

      expect(result.shortCircuit).toBe(true);
      expect(result.format).toBe('module');
      expect(result.url).toBe(
        'file:///app/node_modules/@forge/sql/out/index.js?forge-sim-cjs-facade'
      );
    });

    it('does NOT wrap if the package resolves as native ESM', async () => {
      const esmNext = vi.fn(async () => ({
        url: 'file:///app/node_modules/@forge/sql/out/index.js',
        format: 'module',
      }));

      const result = await resolve('@forge/sql', {}, esmNext);
      expect(result.url).not.toContain('forge-sim-cjs-facade');
    });

    it('wraps @forge/sql subpaths in the facade too (eval-6 F1)', async () => {
      // The 0.1.5 fix was consciously scoped to the root specifier while its
      // own motivating repro was the deep import. Never again: subpaths of a
      // facade package get the same bundler-interop wrapper.
      const cjsNext = vi.fn(async () => ({
        url: 'file:///app/node_modules/@forge/sql/out/migration.js',
        format: 'commonjs',
      }));

      const result = await resolve('@forge/sql/out/migration', {}, cjsNext);

      expect(result.shortCircuit).toBe(true);
      expect(result.format).toBe('module');
      expect(result.url).toBe(
        'file:///app/node_modules/@forge/sql/out/migration.js?forge-sim-cjs-facade'
      );
    });

    it('resolves extensionless subpaths via CommonJS inference when ESM resolution fails (eval-6 F1)', async () => {
      // @forge/sql has no exports map, so Node's ESM resolver rejects the
      // extensionless `@forge/sql/out/migration` (ERR_MODULE_NOT_FOUND) while
      // real Forge's bundler infers the `.js`. The hook falls back to
      // require.resolve(), which shares the bundler's inference rules.
      const strictEsmNext = vi.fn(async () => {
        const err = new Error(
          "Cannot find module '/x/node_modules/@forge/sql/out/migration'"
        ) as Error & { code: string };
        err.code = 'ERR_MODULE_NOT_FOUND';
        throw err;
      });

      // No file:// parentURL → resolution falls back to forge-sim's own
      // node_modules, which has @forge/sql installed.
      const result = await resolve('@forge/sql/out/migration', {}, strictEsmNext);

      expect(result.shortCircuit).toBe(true);
      expect(result.format).toBe('module');
      expect(result.url).toMatch(/\/out\/migration\.js\?forge-sim-cjs-facade$/);
    });

    it('re-throws the original ESM error when CJS inference also fails', async () => {
      const strictEsmNext = vi.fn(async () => {
        const err = new Error('Cannot find module ghost') as Error & { code: string };
        err.code = 'ERR_MODULE_NOT_FOUND';
        throw err;
      });

      await expect(
        resolve('@forge/sql/out/does-not-exist', {}, strictEsmNext)
      ).rejects.toThrow('Cannot find module ghost');
    });

    it('load() synthesizes an ESM facade with bundler default semantics', async () => {
      const realUrl = 'file:///app/node_modules/@forge/sql/out/index.js';
      const facadeUrl = realUrl + '?forge-sim-cjs-facade';
      const next = vi.fn(async () => { throw new Error('nextLoad must not be called'); });

      const result = await load(facadeUrl, {}, next);

      expect(result.shortCircuit).toBe(true);
      expect(result.format).toBe('module');
      const source = String(result.source);
      // Imports the REAL entry (query stripped), not the facade URL
      expect(source).toContain(`import cjs from ${JSON.stringify(realUrl)}`);
      expect(source).toContain(`export * from ${JSON.stringify(realUrl)}`);
      // Bundler interop: honor __esModule
      expect(source).toContain('__esModule');
      expect(source).toContain('export default');
    });

    it('E2E: default import of @forge/sql yields the sql instance under the loader', () => {
      // Reproduces the eval-5 F1 repro exactly: run real Node with the
      // registered loader and import @forge/sql the way Atlassian's docs do.
      const repoRoot = pathResolve(fileURLToPath(import.meta.url), '..', '..', '..');
      const scriptPath = join(repoRoot, `.tmp-sql-facade-test-${process.pid}.mjs`);
      writeFileSync(scriptPath, [
        `import sqlDefault from '@forge/sql';`,
        `import { sql, migrationRunner } from '@forge/sql';`,
        `import * as ns from '@forge/sql';`,
        `console.log(JSON.stringify({`,
        `  defaultPrepare: typeof sqlDefault.prepare,`,
        `  defaultIsNamedSql: sqlDefault === sql,`,
        `  migrationRunner: typeof migrationRunner,`,
        `  nsDefaultPrepare: typeof ns.default.prepare,`,
        `}));`,
      ].join('\n'));

      try {
        const out = execSync(
          `node --import ./dist/loader/register.js ${JSON.stringify(scriptPath)}`,
          { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
        );
        const parsed = JSON.parse(out.trim().split('\n').pop()!);
        expect(parsed).toEqual({
          defaultPrepare: 'function',      // was 'undefined' before the facade
          defaultIsNamedSql: true,         // exports.default === exports.sql
          migrationRunner: 'object',       // named exports untouched (it's an instance)
          nsDefaultPrepare: 'function',    // namespace default matches too
        });
      } finally {
        rmSync(scriptPath, { force: true });
      }
    });

    it('E2E: extensionless deep import of @forge/sql/out/migration works under the loader (eval-6 F1)', () => {
      // The exact eval-6 F1 repro: Atlassian's own migration docs use
      //   import { migrationRunner } from '@forge/sql/out/migration';
      // Works under real Forge's bundler, threw ERR_MODULE_NOT_FOUND under
      // the sim (no exports map + no extension = strict ESM rejection).
      const repoRoot = pathResolve(fileURLToPath(import.meta.url), '..', '..', '..');
      const scriptPath = join(repoRoot, `.tmp-sql-migration-test-${process.pid}.mjs`);
      writeFileSync(scriptPath, [
        `import { migrationRunner, MigrationRunner } from '@forge/sql/out/migration';`,
        `console.log(JSON.stringify({`,
        `  migrationRunner: typeof migrationRunner,`,
        `  hasEnqueue: typeof migrationRunner.enqueue,`,
        `  isInstance: migrationRunner instanceof MigrationRunner,`,
        `}));`,
      ].join('\n'));

      try {
        const out = execSync(
          `node --import ./dist/loader/register.js ${JSON.stringify(scriptPath)}`,
          { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
        );
        const parsed = JSON.parse(out.trim().split('\n').pop()!);
        expect(parsed).toEqual({
          migrationRunner: 'object',
          hasEnqueue: 'function',
          isInstance: true,
        });
      } finally {
        rmSync(scriptPath, { force: true });
      }
    });
  });

  describe('path correctness', () => {
    it('all shim paths point to dist/ not src/', async () => {
      for (const pkg of EXPECTED_SHIMS) {
        const result = await resolve(pkg, {}, nextResolve);
        const filePath = fileURLToPath(result.url);

        // When running in vitest (from source), the hooks detect .ts and
        // navigate to dist/shims/. Either way, result must be in dist/.
        expect(filePath).toContain(`${sep}dist${sep}shims${sep}`);
      }
    });

    it('shim filenames match the @forge/X → forge-X.js pattern', async () => {
      for (const pkg of EXPECTED_SHIMS) {
        const result = await resolve(pkg, {}, nextResolve);
        const filePath = fileURLToPath(result.url);
        const expectedFilename = pkg.replace('@forge/', 'forge-') + '.js';

        expect(filePath).toMatch(new RegExp(`${expectedFilename}$`));
      }
    });
  });

  describe('extensionless and directory import resolution', () => {
    // Create a temp directory with test files to resolve against
    let tempDir: string;
    let parentURL: string;

    // A nextResolve that always fails (simulates Node ESM strict mode)
    const failingNextResolve = vi.fn(async () => {
      const err = new Error('Module not found') as Error & { code: string };
      err.code = 'ERR_MODULE_NOT_FOUND';
      throw err;
    });

    beforeAll(() => {
      tempDir = join(tmpdir(), `loader-hooks-test-${Date.now()}`);
      mkdirSync(join(tempDir, 'resolvers'), { recursive: true });

      // Create test files
      writeFileSync(join(tempDir, 'backend.js'), 'export default {};\n');
      writeFileSync(join(tempDir, 'handler.ts'), 'export default {};\n');
      writeFileSync(join(tempDir, 'component.tsx'), 'export default {};\n');
      writeFileSync(join(tempDir, 'resolvers', 'index.js'), 'export default {};\n');

      // parentURL simulates an import from a file in tempDir
      parentURL = pathToFileURL(join(tempDir, 'main.js')).href;
    });

    afterAll(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it('resolves extensionless .js imports', async () => {
      const result = await resolve('./backend', { parentURL }, failingNextResolve);
      expect(result.shortCircuit).toBe(true);
      expect(fileURLToPath(result.url)).toBe(join(tempDir, 'backend.js'));
    });

    it('resolves extensionless .ts imports', async () => {
      const result = await resolve('./handler', { parentURL }, failingNextResolve);
      expect(result.shortCircuit).toBe(true);
      expect(fileURLToPath(result.url)).toBe(join(tempDir, 'handler.ts'));
    });

    it('resolves extensionless .tsx imports', async () => {
      const result = await resolve('./component', { parentURL }, failingNextResolve);
      expect(result.shortCircuit).toBe(true);
      expect(fileURLToPath(result.url)).toBe(join(tempDir, 'component.tsx'));
    });

    it('resolves directory imports to index.js', async () => {
      const result = await resolve('./resolvers', { parentURL }, failingNextResolve);
      expect(result.shortCircuit).toBe(true);
      expect(fileURLToPath(result.url)).toBe(join(tempDir, 'resolvers', 'index.js'));
    });

    it('re-throws for truly missing modules', async () => {
      await expect(
        resolve('./does-not-exist', { parentURL }, failingNextResolve)
      ).rejects.toThrow('Module not found');
    });

    it('only attempts fallback for relative imports', async () => {
      // Non-relative specifiers should just re-throw
      await expect(
        resolve('some-package', { parentURL }, failingNextResolve)
      ).rejects.toThrow('Module not found');
    });

    it('prefers native resolution over fallback', async () => {
      // If nextResolve succeeds, the fallback is never tried
      const succeedingNext = vi.fn(async () => ({
        url: 'passthrough://success',
        shortCircuit: false,
      }));

      const result = await resolve('./backend', { parentURL }, succeedingNext);
      expect(result.url).toBe('passthrough://success');
      expect(succeedingNext).toHaveBeenCalled();
    });
  });
});

describe('Loader Hooks — load()', () => {
  let tempDir: string;

  // A nextLoad that should not be called for .tsx / .jsx — if it is, we'd know
  // the load hook bailed out and Node would try to parse JSX raw (which fails).
  const failingNextLoad = vi.fn(async () => {
    throw new Error('nextLoad was called for a file the load hook should have handled');
  });

  const passthroughNextLoad = vi.fn(async () => ({
    source: '',
    format: 'module' as const,
    shortCircuit: false,
  }));

  beforeAll(() => {
    tempDir = join(tmpdir(), `loader-hooks-load-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    // .jsx — plain JSX, no TypeScript types
    writeFileSync(
      join(tempDir, 'component.jsx'),
      `import React from 'react';\nexport default function Hello({ name }) {\n  return <div>Hello, {name}</div>;\n}\n`,
    );

    // .tsx — JSX + TS types
    writeFileSync(
      join(tempDir, 'component.tsx'),
      `import React from 'react';\nexport default function Hello({ name }: { name: string }) {\n  return <div>Hello, {name}</div>;\n}\n`,
    );

    // .jsx with hooks (verifies React patterns actually compile)
    writeFileSync(
      join(tempDir, 'with-hooks.jsx'),
      `import React, { useState } from 'react';\nexport default function Counter() {\n  const [n, setN] = useState(0);\n  return <button onClick={() => setN(n + 1)}>{n}</button>;\n}\n`,
    );

    // Plain .ts — should pass through to nextLoad (Node handles natively)
    writeFileSync(
      join(tempDir, 'handler.ts'),
      `export const handler = (x: number): number => x + 1;\n`,
    );

    // Plain .js — should pass through to nextLoad
    writeFileSync(
      join(tempDir, 'utils.js'),
      `export const add = (a, b) => a + b;\n`,
    );
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('.jsx files (N2 parity fix)', () => {
    it('transpiles plain JSX so Node can execute it', async () => {
      const url = pathToFileURL(join(tempDir, 'component.jsx')).href;
      const result = await load(url, {}, failingNextLoad);

      expect(result.shortCircuit).toBe(true);
      expect(result.format).toBe('module');
      // The transpiled output should no longer contain raw JSX angle brackets
      // around a component name — it should be a React.createElement / jsx() call.
      const source = String(result.source);
      expect(source).not.toMatch(/return\s+<div>/);
      // esbuild's default JSX transform produces React.createElement(...) calls
      expect(source).toMatch(/React\.createElement|jsx|_jsx/);
      // The original identifier should survive
      expect(source).toContain('Hello');
    });

    it('transpiles .jsx files containing React hooks', async () => {
      const url = pathToFileURL(join(tempDir, 'with-hooks.jsx')).href;
      const result = await load(url, {}, failingNextLoad);

      expect(result.shortCircuit).toBe(true);
      const source = String(result.source);
      expect(source).toContain('useState');
      expect(source).not.toMatch(/<button/);
    });

    it('handles cache-busting query strings on .jsx URLs', async () => {
      // Hot-reload paths append ?t=<timestamp> — the load hook must strip it
      // before passing to fileURLToPath, otherwise the read fails.
      const url = pathToFileURL(join(tempDir, 'component.jsx')).href + '?t=' + Date.now();
      const result = await load(url, {}, failingNextLoad);

      expect(result.shortCircuit).toBe(true);
      expect(String(result.source)).toContain('Hello');
    });
  });

  describe('.tsx files (regression — already worked, must keep working)', () => {
    it('transpiles JSX + TS types together', async () => {
      const url = pathToFileURL(join(tempDir, 'component.tsx')).href;
      const result = await load(url, {}, failingNextLoad);

      expect(result.shortCircuit).toBe(true);
      const source = String(result.source);
      // TS type annotation should be stripped
      expect(source).not.toContain(': { name: string }');
      // JSX should be transformed
      expect(source).not.toMatch(/return\s+<div>/);
      expect(source).toContain('Hello');
    });
  });

  describe('passthrough cases', () => {
    it('passes plain .ts files through to nextLoad (Node handles natively)', async () => {
      const url = pathToFileURL(join(tempDir, 'handler.ts')).href;
      const next = vi.fn(async () => ({ source: 'STUB', format: 'module' as const }));
      const result = await load(url, {}, next);

      expect(next).toHaveBeenCalledOnce();
      expect(result.source).toBe('STUB');
    });

    it('passes plain .js files through to nextLoad', async () => {
      const url = pathToFileURL(join(tempDir, 'utils.js')).href;
      const next = vi.fn(async () => ({ source: 'STUB', format: 'module' as const }));
      const result = await load(url, {}, next);

      expect(next).toHaveBeenCalledOnce();
      expect(result.source).toBe('STUB');
    });

    it('passes non-file:// URLs through to nextLoad', async () => {
      const next = vi.fn(async () => ({ source: 'STUB', format: 'module' as const }));
      const result = await load('node:fs', {}, next);

      expect(next).toHaveBeenCalledOnce();
      expect(result.source).toBe('STUB');
    });
  });
});
