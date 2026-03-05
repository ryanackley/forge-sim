/**
 * Tests for the module loader hooks (src/loader/hooks.ts).
 *
 * Validates that @forge/* imports resolve to compiled dist/shims/*.js files,
 * both when running from source (tsx) and from compiled dist.
 */

import { describe, it, expect, vi } from 'vitest';
import { resolve } from '../loader/hooks.js';
import { fileURLToPath } from 'node:url';
import { resolve as pathResolve, sep } from 'node:path';

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
});
