/**
 * Guards the @forge/* shim registry against the drift that caused the
 * loader-vs-vitest mismatch.
 *
 * Background: `src/loader/hooks.ts` (Node resolution hooks) and
 * `vitest.config.ts` (Vite `resolve.alias`) are two independent resolution
 * mechanisms that must agree on which packages are shimmed. They each kept a
 * hand-written list, and they drifted — the loader registered 13 shims while
 * vitest aliased 7. The five missing entries failed in two different ways:
 *
 *   - `@forge/realtime` and `@forge/llm` have no real Atlassian package
 *     installed, so an app importing them failed to deploy under vitest with
 *     "Cannot find package '@forge/realtime'".
 *   - `@forge/jira-bridge`, `@forge/confluence-bridge` and
 *     `@forge/dashboards-bridge` DO have real packages, so they silently
 *     resolved to the real Atlassian package instead of the shim — no error,
 *     simulator simply bypassed.
 *
 * Both lists are now generated from `src/shims/shim-registry.ts`. These tests
 * pin the invariants that make that safe, so adding a shim without wiring it
 * up fails CI instead of surfacing as a confusing deploy error later.
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  SHIM_NAMES,
  PASSTHROUGH_OK,
  shimFileBase,
  shimNamesBySpecificity,
} from '../shims/shim-registry.js';

const SHIM_SRC_DIR = resolve(__dirname, '..', 'shims');

describe('@forge/* shim registry', () => {
  it('declares at least the shims we know exist', () => {
    // Guards against the list being accidentally emptied/truncated, which
    // would make every other assertion here vacuously true.
    expect(SHIM_NAMES.length).toBeGreaterThanOrEqual(13);
    expect(SHIM_NAMES).toContain('@forge/realtime');
    expect(SHIM_NAMES).toContain('@forge/llm');
  });

  it.each([...SHIM_NAMES])('%s has a shim source file', (pkg) => {
    const file = resolve(SHIM_SRC_DIR, `${shimFileBase(pkg)}.ts`);
    expect(existsSync(file), `missing shim source for ${pkg}: ${file}`).toBe(true);
  });

  /**
   * THE regression test for the original bug. A shim listed in the registry but
   * absent from vitest's alias map resolves to the real package (if installed)
   * or throws MODULE_NOT_FOUND (if not). Importing by the BARE SPECIFIER is the
   * only way to exercise the alias map itself — importing the shim by relative
   * path would pass even with the alias missing.
   *
   * Runtime errors are tolerated: several shims throw or warn without a live
   * simulator, which is fine. Only *resolution* failures are the bug.
   */
  it.each([...SHIM_NAMES])('%s resolves through the vitest alias map', async (pkg) => {
    try {
      await import(/* @vite-ignore */ pkg);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isResolutionFailure =
        /cannot find (package|module)|failed to resolve|ERR_MODULE_NOT_FOUND|ERR_PACKAGE_PATH_NOT_EXPORTED/i.test(
          msg,
        );
      expect(
        isResolutionFailure,
        `${pkg} failed to RESOLVE (not merely to run): ${msg}\n` +
          `Is it missing from vitest.config.ts's generated alias map?`,
      ).toBe(false);
    }
  });

  it('does not shim the deliberate real-package passthroughs', () => {
    // @forge/sql intentionally runs the REAL package against the sim's MySQL
    // backend via global.__forge_fetch__. Aliasing it would break that, so it
    // must stay out of SHIM_NAMES and have no shim file.
    for (const pkg of PASSTHROUGH_OK) {
      expect(SHIM_NAMES as readonly string[]).not.toContain(pkg);
      expect(existsSync(resolve(SHIM_SRC_DIR, `${shimFileBase(pkg)}.ts`))).toBe(false);
    }
  });

  it('orders subpaths before their parent package', () => {
    // Load-bearing for rollup/Vite, which matches alias keys as PREFIXES:
    // a bare '@forge/react' ahead of '@forge/react/router' would mangle the
    // subpath into '.../forge-react.ts/router'.
    const order = shimNamesBySpecificity();
    for (const pkg of SHIM_NAMES) {
      for (const other of SHIM_NAMES) {
        if (other !== pkg && other.startsWith(`${pkg}/`)) {
          expect(
            order.indexOf(other),
            `${other} must be ordered before its parent ${pkg}`,
          ).toBeLessThan(order.indexOf(pkg));
        }
      }
    }
  });
});
