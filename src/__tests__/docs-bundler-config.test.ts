/**
 * Regression guard for the bundler-config snippet in docs/testing/README.md
 * and the forge-local-dev skill.
 *
 * Background: the original snippet used `require.resolve('forge-sim')` to
 * compute the SHIMS dir. forge-sim is ESM-only with no "require" condition
 * in its exports map, so this throws `ERR_PACKAGE_PATH_NOT_EXPORTED` on every
 * modern Node setup, breaking the vitest config at load time. Two separate
 * skill audits caught this — once is unlucky, twice is a process gap.
 *
 * This test pins down three things:
 *
 *   1. The `./shims/*` subpath exports actually resolve via the exports map.
 *      (Underlying mechanism the recommended snippet relies on.)
 *
 *   2. The original broken pattern `require.resolve('forge-sim')` still fails.
 *      (Confirms our fix isn't papering over something that started working
 *      again — and documents WHY the old pattern was wrong.)
 *
 *   3. docs/testing/README.md + the forge-local-dev skill contain the recommended
 *      pattern (`'forge-sim/shims/...'`) and do NOT contain the broken one.
 *      (Drift detection — if someone re-introduces `require.resolve`, this
 *      screams immediately.)
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SHIM_NAMES, shimFileBase } from '../shims/shim-registry.js';

// Derived, never hand-listed: a shim removed by the bare-seam migration must
// drop out of here automatically. The hardcoded version silently kept passing
// against ORPHANED dist/ files after its shims were deleted (tsc leaves stale
// output behind), which is exactly the zombie `forge-sim/shims/forge-kvs` an
// upgrading user would have resolved instead of getting a clean error. The
// build now cleans dist first, and this list follows the registry.
const SHIMS = SHIM_NAMES.map(shimFileBase);

const REPO_ROOT = join(import.meta.dirname, '..', '..');
const TESTING_DOC = join(REPO_ROOT, 'docs', 'testing', 'README.md');
const SKILL_DOC = join(REPO_ROOT, 'skills', 'forge-local-dev', 'SKILL.md');
const PACKAGE_JSON = JSON.parse(
  readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'),
);

describe('package.json exports map — shim contract', () => {
  it('declares the "./shims/*" subpath export', () => {
    // This is the entry the docs snippet relies on. If it disappears, the
    // alias `'@forge/api': 'forge-sim/shims/forge-api'` stops resolving.
    expect(PACKAGE_JSON.exports['./shims/*']).toBeDefined();
    expect(PACKAGE_JSON.exports['./shims/*'].import).toMatch(/\.js$/);
  });

  it.each(SHIMS)(
    "the compiled file for forge-sim/shims/%s exists on disk",
    (shim) => {
      // Resolve the exports map glob ourselves rather than going through
      // Node's resolver (which has self-reference quirks when the test is
      // running inside the same package). If the file exists, vitest can
      // alias to it.
      const template = PACKAGE_JSON.exports['./shims/*'].import as string;
      const filePath = join(REPO_ROOT, template.replace('*', shim));
      expect(existsSync(filePath), `Expected shim file at ${filePath}`).toBe(true);
    },
  );

  it('root entry has no "require" condition (this is what breaks require.resolve("forge-sim"))', () => {
    // Documents the root cause of the original bug. forge-sim is ESM-only;
    // the "." entry exposes only "types" + "import". When a user runs
    // `require.resolve('forge-sim')` from a CJS vitest.config, Node has no
    // "require" condition to satisfy → ERR_PACKAGE_PATH_NOT_EXPORTED.
    //
    // If someone later adds a "require" condition (e.g. to ship CJS too),
    // this test will fail loudly — at which point AUDIT the docs snippet
    // before relaxing this assertion. The recommended pattern using subpath
    // exports works either way, so adding CJS shouldn't change the docs.
    expect(PACKAGE_JSON.exports['.']).toBeDefined();
    expect(PACKAGE_JSON.exports['.'].require).toBeUndefined();
  });
});

describe('docs/testing/README.md — bundler snippet drift', () => {
  const content = readFileSync(TESTING_DOC, 'utf8');

  it('does NOT reintroduce the broken require.resolve("forge-sim") pattern', () => {
    // Quoted exactly because we want to allow `require.resolve('forge-sim/...')`
    // (the subpath form, which IS valid) but reject the bare root form.
    expect(content).not.toMatch(/require\.resolve\(\s*['"`]forge-sim['"`]\s*\)/);
  });

  it('does not alias the packages that now run for real', () => {
    // Every backend package moved to PASSTHROUGH_OK by the bare-seam
    // migration: aliasing one would break module resolution, so the docs
    // must not show it. (`@forge/bridge/realtime` is the FRONTEND surface
    // and keeps its alias, hence the word-boundary-ish patterns below.)
    for (const gone of ['forge-api', 'forge-kvs', 'forge-llm', 'forge-object-store', 'forge-events']) {
      // Scoped to alias-map syntax (`': 'forge-sim/shims/x'`) so prose that
      // MENTIONS the old path — the upgrade note telling readers to delete
      // exactly that line — doesn't trip it.
      expect(content, `docs still alias ${gone}`).not.toMatch(
        new RegExp(`:\\s*'forge-sim/shims/${gone}'`),
      );
    }
  });

  it('aliases @forge/resolver via the recommended subpath export', () => {
    expect(content).toMatch(/['"]forge-sim\/shims\/forge-resolver['"]/);
  });

  it('does not compute a SHIMS dir variable with path math anymore', () => {
    // Catches both `const SHIMS = resolve(...)` and `const SHIMS = path.resolve(...)`
    expect(content).not.toMatch(/const\s+SHIMS\s*=\s*(?:path\.)?resolve\(/);
  });

  /**
   * Completeness guard.
   *
   * This doc presents its alias table as "the full list ... for reference", so
   * every shimmed package must appear in it. Nothing enforced that before, and
   * it drifted: `@forge/react/router` was missing, which is the worst entry to
   * omit because Vite and Webpack match alias keys as PREFIXES, so a bare
   * `@forge/react` silently rewrites the subpath into
   * `forge-sim/shims/forge-react/router`. Under Jest the anchored
   * `^@forge/react$` simply fails to match and the subpath falls through to the
   * real package instead. Two different wrong answers from one missing line.
   *
   * Deliberately NOT applied to SKILL.md: that snippet is an abbreviated
   * example, labelled "add any other @forge/* the app actually imports" and
   * linking here for the full table. Do not pad it to satisfy a test.
   */
  it.each([...SHIM_NAMES])('documents an alias for %s', (pkg) => {
    expect(
      content.includes(`forge-sim/shims/${shimFileBase(pkg)}`),
      `docs/testing/README.md has no alias for ${pkg}. ` +
        `Add it to BOTH the Vitest and Jest snippets ` +
        `(subpaths must precede their parent package in the Vitest one).`,
    ).toBe(true);
  });
});

describe('skills/forge-local-dev/SKILL.md — bundler snippet drift', () => {
  const content = readFileSync(SKILL_DOC, 'utf8');

  it('does NOT reintroduce the broken require.resolve("forge-sim") pattern', () => {
    expect(content).not.toMatch(/require\.resolve\(\s*['"`]forge-sim['"`]\s*\)/);
  });

  it('does not alias the packages that now run for real', () => {
    for (const gone of ['forge-api', 'forge-kvs', 'forge-llm', 'forge-object-store', 'forge-events']) {
      expect(content, `skill doc still aliases ${gone}`).not.toMatch(
        new RegExp(`:\\s*'forge-sim/shims/${gone}'`),
      );
    }
  });

  it('does not compute a SHIMS dir variable with path math anymore', () => {
    expect(content).not.toMatch(/const\s+SHIMS\s*=\s*(?:path\.)?resolve\(/);
  });
});
