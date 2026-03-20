/**
 * Tests for the module loader hooks (src/loader/hooks.ts).
 *
 * Validates that @forge/* imports resolve to compiled dist/shims/*.js files,
 * both when running from source (tsx) and from compiled dist.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { resolve } from '../loader/hooks.js';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve as pathResolve, join, sep } from 'node:path';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

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
