/**
 * Which real `@forge/*` version each shim was verified against (#10, step 4).
 *
 * Steps 1-3 of #10 compare our shims to the real packages installed in THIS
 * repo's node_modules (export surface + type shapes). That catches drift when
 * we bump our own devDependencies, but says nothing about the app under test:
 * a user's Forge app pins its own `@forge/*` versions, and if they pin a major
 * we never verified, our shim is impersonating a contract that app doesn't
 * have. Works-in-Forge/fails-in-sim (or the reverse) — the parity principle.
 *
 * So at deploy time we read the app's own `@forge/*` versions and warn on a
 * MAJOR mismatch against the table below.
 *
 * Why major-only: a patch or minor bump inside a major is exactly what the
 * contract suite already guards — it runs against whatever we have installed,
 * so added exports and changed type shapes fail CI there, where they're
 * actionable by us. Warning on every patch drift would print noise on deploys
 * the user can do nothing about, and a warning everyone learns to ignore is
 * worse than no warning. A major bump is the one signal that reliably means
 * "the contract may have genuinely changed and nobody has checked."
 *
 * Keeping this current: when you bump a real `@forge/*` devDependency and the
 * contract suite still passes, update the version here in the same commit.
 * `forge-package-versions.test.ts` asserts this table matches the versions
 * actually installed in node_modules, so it can't silently rot.
 */

import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { ManifestWarning } from './manifest.js';

/**
 * specifier → the real package version the shims are verified against.
 *
 * Mirrors the installed devDependency set, which is also what the #10 contract
 * suite introspects. Keys intentionally match REAL_ENTRY in
 * `src/__tests__/helpers/real-forge-packages.ts`.
 */
export const VERIFIED_FORGE_VERSIONS: Record<string, string> = {
  '@forge/api': '8.2.0',
  '@forge/kvs': '1.6.5',
  '@forge/events': '3.0.7',
  '@forge/resolver': '2.0.0',
  '@forge/react': '12.0.1',
  '@forge/bridge': '7.1.0',
  '@forge/jira-bridge': '0.40.1',
  '@forge/confluence-bridge': '3.1.1',
  '@forge/dashboards-bridge': '0.1.20',
  '@forge/llm': '1.0.7',
  '@forge/realtime': '1.0.1',
  '@forge/object-store': '2.0.1',
  // Not shimmed — apps use the real CJS package, which we service through the
  // `global.__forge_fetch__` bridge. Still worth pinning: the bridge protocol
  // (and the migrationRunner singleton quirk in deployer.ts) is version-coupled.
  '@forge/sql': '3.0.26',
};

/**
 * Parse the major from a package.json dependency range or exact version.
 *
 * Handles the shapes that actually appear in a Forge app's package.json:
 * `8.2.0`, `^8.2.0`, `~8.2.0`, `>=8.2.0`, `8.x`, `8`, ` 8.2.0 `. Returns null
 * for anything where a major genuinely can't be determined — `*`, `latest`,
 * git/file/npm-alias specifiers, or a multi-part range like `>=7 <9`. Null
 * means "say nothing": a false warning about the user's own manifest is worse
 * than a missed one.
 */
export function majorFromRange(range: string): number | null {
  const trimmed = range.trim();
  // Ranges with two comparators, unions, or non-registry sources: ambiguous.
  if (/\s/.test(trimmed) || trimmed.includes('||') || /^[a-z]+:/i.test(trimmed)) return null;
  const match = /^[\^~>=<]*v?(\d+)/.exec(trimmed);
  if (!match) return null;
  const major = Number(match[1]);
  return Number.isInteger(major) ? major : null;
}

/**
 * What the app actually resolves for a specifier, if it's installed.
 *
 * Preferred over the package.json range when available: the range is what the
 * app ASKED for, the installed version is what its code will actually run
 * against, and `^8.0.0` can resolve to anything up to 9.0.0. Resolved from the
 * APP's directory, not ours — same `createRequire(appDir)` trick
 * `clearMigrationRegistry()` uses in deployer.ts, so a user app with its own
 * node_modules reports its own copy rather than forge-sim's.
 */
function installedVersion(appRequire: NodeRequire, specifier: string): string | null {
  // Can't just require(`${specifier}/package.json`): several @forge packages
  // (e.g. @forge/resolver) declare an `exports` map that doesn't expose the
  // './package.json' subpath, so Node refuses it. Resolve the package's real
  // directory and read the file off disk instead, which `exports` can't block.
  for (const dir of candidateDirs(appRequire, specifier)) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
        name?: string;
        version?: string;
      };
      if (pkg.name === specifier && typeof pkg.version === 'string') return pkg.version;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Directories that might hold `specifier`'s package.json, best guess first.
 *
 * Starts from whatever Node resolves (honoring hoisting, workspaces and
 * pnpm's content-addressed layout) and walks up from the resolved entry file,
 * since that entry can sit any number of levels deep (`out/index.js`,
 * `dist/cjs/index.js`). Falls back to the naive `node_modules/<specifier>`
 * path for packages with no resolvable entry at all — the `*-bridge` packages
 * ship no `main`, so require.resolve() throws on them.
 */
function candidateDirs(appRequire: NodeRequire, specifier: string): string[] {
  const dirs: string[] = [];
  try {
    let dir = dirname(appRequire.resolve(specifier));
    // Bounded walk: deep-enough to clear dist/cjs/esm nesting, shallow enough
    // that we can't wander out of the package into a parent's package.json
    // (the name check in installedVersion() is the real guard).
    for (let i = 0; i < 6; i++) {
      dirs.push(dir);
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    // No resolvable entry point — fall through to the literal path below.
  }
  for (const base of appRequire.resolve.paths(specifier) ?? []) {
    dirs.push(join(base, ...specifier.split('/')));
  }
  return dirs;
}

/**
 * The `@forge/*` version installed as seen from `dir`, or null if it can't be
 * determined. Exported so the staleness test checks the table through the same
 * resolution path production uses, rather than a parallel implementation that
 * could disagree.
 */
export function installedForgeVersion(dir: string, specifier: string): string | null {
  try {
    return installedVersion(createRequire(join(dir, '<forge-sim>')), specifier);
  } catch {
    return null;
  }
}

/**
 * Compare an app's `@forge/*` versions against the versions our shims were
 * verified against, and return a warning per MAJOR mismatch.
 *
 * Reads the app's own `package.json` (dependencies + devDependencies, and
 * peerDependencies for apps published as libraries), then prefers the actually
 * installed version where it can resolve one.
 *
 * Deliberately total: a missing, unreadable, or malformed package.json, or an
 * app with no `@forge/*` dependencies at all, returns `[]`. A version advisory
 * must never be the reason a deploy fails or throws.
 */
export function checkAppForgeVersions(appDir: string, deps: Record<string, string>): ManifestWarning[] {
  let appRequire: NodeRequire | null = null;
  try {
    appRequire = createRequire(join(appDir, '<forge-sim>'));
  } catch {
    appRequire = null; // fall back to declared ranges only
  }

  const warnings: ManifestWarning[] = [];
  for (const [specifier, verified] of Object.entries(VERIFIED_FORGE_VERSIONS)) {
    const declared = deps[specifier];
    if (!declared) continue; // app doesn't use this package

    const resolved = appRequire ? installedVersion(appRequire, specifier) : null;
    const appMajor = majorFromRange(resolved ?? declared);
    const verifiedMajor = majorFromRange(verified);
    if (appMajor === null || verifiedMajor === null || appMajor === verifiedMajor) continue;

    const actual = resolved ? `${resolved} installed` : `${declared} declared`;
    const direction = appMajor > verifiedMajor ? 'A newer' : 'An older';
    warnings.push({
      level: 'warning',
      message:
        `${specifier}: your app uses v${appMajor} (${actual}), but forge-sim's shim is verified ` +
        `against ${verified}. ${direction} major may have a different API surface, so forge-sim's ` +
        `behavior here may not match real Forge — in either direction. If you hit a difference, ` +
        `it's a forge-sim bug worth reporting; pinning ${specifier}@${verifiedMajor}.x is the workaround.`,
    });
  }
  return warnings;
}

/**
 * Read the merged `@forge/*` dependency map from an app's package.json.
 * Returns `{}` when there's no readable package.json — see the totality note
 * on checkAppForgeVersions().
 */
export async function readAppForgeDeps(appDir: string): Promise<Record<string, string>> {
  let raw: string;
  try {
    raw = await readFile(join(appDir, 'package.json'), 'utf8');
  } catch {
    return {}; // no package.json (common for our test fixtures) — nothing to check
  }

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {}; // malformed package.json is the app's problem, not a deploy blocker
  }

  const merged: Record<string, string> = {};
  // Order matters least-to-most authoritative: a real dependency wins over a
  // peer/dev declaration of the same package.
  for (const field of ['peerDependencies', 'devDependencies', 'dependencies']) {
    const section = pkg[field];
    if (!section || typeof section !== 'object') continue;
    for (const [name, range] of Object.entries(section as Record<string, unknown>)) {
      if (name.startsWith('@forge/') && typeof range === 'string') merged[name] = range;
    }
  }
  return merged;
}
