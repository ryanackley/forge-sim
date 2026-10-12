/**
 * Contract parity, layer 4: version manifest (#10, step 4).
 *
 * Two jobs:
 *   1. Keep VERIFIED_FORGE_VERSIONS honest — it must match the real packages
 *      actually installed here, since those are what layers 1-3 introspect.
 *      Without this, the table drifts and the deploy warning lies.
 *   2. Pin the deploy-time advisory's behavior: warn on major mismatch, stay
 *      quiet otherwise, and never throw on a weird/absent package.json.
 */
import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import {
  VERIFIED_FORGE_VERSIONS,
  majorFromRange,
  checkAppForgeVersions,
  readAppForgeDeps,
  installedForgeVersion,
} from '../forge-package-versions.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** An app dir with the given package.json contents (raw, so we can test junk). */
async function appDirWith(packageJson: string | null): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'forge-sim-versions-'));
  if (packageJson !== null) await writeFile(join(dir, 'package.json'), packageJson);
  return dir;
}

/** Plant a package inside the app's own node_modules at a given version. */
async function writeInstalled(appDir: string, specifier: string, version: string): Promise<void> {
  const pkgDir = join(appDir, 'node_modules', ...specifier.split('/'));
  await mkdir(pkgDir, { recursive: true });
  await writeFile(join(pkgDir, 'package.json'), JSON.stringify({ name: specifier, version }));
  // A resolvable entry point: candidateDirs() walks up from require.resolve(),
  // and the bare-path fallback should not be the only thing under test.
  await writeFile(join(pkgDir, 'index.js'), 'module.exports = {};');
}

describe('verified @forge/* version manifest (#10)', () => {
  it('records the version actually installed for every entry', () => {
    const drifted: string[] = [];
    for (const [specifier, verified] of Object.entries(VERIFIED_FORGE_VERSIONS)) {
      const installed = installedForgeVersion(REPO_ROOT, specifier);
      expect(
        installed,
        `could not resolve an installed version for ${specifier} — is it still a devDependency?`,
      ).not.toBeNull();
      if (installed !== verified) drifted.push(`${specifier}: table says ${verified}, installed ${installed}`);
    }
    expect(
      drifted,
      `VERIFIED_FORGE_VERSIONS is stale:\n  ${drifted.join('\n  ')}\n` +
        `The contract suite (#10 layers 1-3) runs against the INSTALLED versions, so the table must ` +
        `match them. If the suite passes at the new version, update the table in the same commit.`,
    ).toEqual([]);
  });
});

describe('majorFromRange', () => {
  it.each([
    ['8.2.0', 8],
    ['^8.2.0', 8],
    ['~8.2.0', 8],
    ['>=8.2.0', 8],
    ['8.x', 8],
    ['8', 8],
    ['  8.2.0  ', 8],
    ['v8.2.0', 8],
    ['0.40.1', 0],
  ])('reads %s as major %i', (range, expected) => {
    expect(majorFromRange(range)).toBe(expected);
  });

  it.each([['*'], ['latest'], ['>=7 <9'], ['7 || 8'], ['npm:@scope/pkg@8'], ['file:../local'], ['']])(
    'returns null for the unresolvable range %s',
    range => {
      // Null means "stay silent" — a bogus warning about the user's own
      // package.json is worse than no warning.
      expect(majorFromRange(range)).toBeNull();
    },
  );
});

describe('deploy-time version advisory', () => {
  const appDir = '/nonexistent-app'; // forces the declared-range path

  it('warns when the app is a major behind the verified version', () => {
    const warnings = checkAppForgeVersions(appDir, { '@forge/api': '^7.0.0' });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].level).toBe('warning');
    expect(warnings[0].message).toContain('@forge/api');
    expect(warnings[0].message).toContain('v7');
    expect(warnings[0].message).toContain(VERIFIED_FORGE_VERSIONS['@forge/api']);
    expect(warnings[0].message).toContain('check for a forge-sim release verified against v7');
  });

  it('warns when the app is a major ahead of the verified version', () => {
    const warnings = checkAppForgeVersions(appDir, { '@forge/api': '^9.0.0' });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('upgrade forge-sim');
  });

  it('stays quiet on patch and minor drift within the verified major', () => {
    // Deliberate: layers 1-3 already guard intra-major drift, where it's
    // actionable by us. Warning here would be unactionable deploy noise.
    expect(checkAppForgeVersions(appDir, { '@forge/api': '^8.0.0' })).toEqual([]);
    expect(checkAppForgeVersions(appDir, { '@forge/api': '8.99.99' })).toEqual([]);
  });

  it('stays quiet for packages the app does not depend on', () => {
    expect(checkAppForgeVersions(appDir, {})).toEqual([]);
  });

  it('stays quiet when the range has no determinable major', () => {
    expect(checkAppForgeVersions(appDir, { '@forge/api': '*' })).toEqual([]);
  });

  it('reports one warning per mismatched package', () => {
    const warnings = checkAppForgeVersions(appDir, {
      '@forge/api': '^7.0.0',
      '@forge/kvs': '^2.0.0',
      '@forge/events': '^3.0.0', // matches — must not warn
    });
    expect(warnings).toHaveLength(2);
    expect(warnings.map(w => w.message.split(':')[0]).sort()).toEqual(['@forge/api', '@forge/kvs']);
  });

  it('resolves a floating range like "latest" or "*" via the installed copy', async () => {
    // The payoff of reading node_modules: a range that carries no major at
    // all still gets checked, because the installed copy is concrete.
    const dir = await appDirWith('{}');
    await writeInstalled(dir, '@forge/api', '6.1.0');

    for (const floating of ['latest', '*']) {
      const warnings = checkAppForgeVersions(dir, { '@forge/api': floating });
      expect(warnings, `floating range ${floating} should still be checked`).toHaveLength(1);
      expect(warnings[0].message).toContain('6.1.0 installed');
    }
  });

  it('ignores a resolution that escapes the app directory', async () => {
    // Node resolution walks up, so an app with no node_modules of its own
    // resolves to whatever a parent has — inside this repo, that's forge-sim's
    // own @forge/api. Trusting it would compare our tree to our table and
    // always report "no drift". The declared range must win instead.
    const dir = await appDirWith('{}'); // tmpdir, no node_modules
    expect(installedForgeVersion(dir, '@forge/api')).toBeNull();

    const warnings = checkAppForgeVersions(dir, { '@forge/api': '^6.4.2' });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('^6.4.2 declared');
  });

  it('warns for an in-repo fixture that pins stale majors', async () => {
    // Regression guard for the bug above: this fixture declares @forge/api
    // ^6.4.2 and friends, and sits inside the repo, so the escaping
    // resolution used to mask every one of these.
    const fixture = join(REPO_ROOT, 'src/__tests__/fixtures/retro-board');
    const warnings = checkAppForgeVersions(fixture, await readAppForgeDeps(fixture));
    expect(warnings.map(w => w.message.split(':')[0]).sort()).toEqual([
      '@forge/api',
      '@forge/bridge',
      '@forge/events',
      '@forge/react',
      '@forge/resolver',
    ]);
  });

  it('tells the user how to resync instead of calling it a bug', () => {
    // The mismatch is expected — one forge-sim release can't cover every
    // Forge major — so the copy must be actionable, not alarming.
    const [behind] = checkAppForgeVersions(appDir, { '@forge/api': '^7.0.0' });
    expect(behind.message).not.toMatch(/bug/i);
    expect(behind.message).toContain('pin @forge/api to 8.x');
    const [ahead] = checkAppForgeVersions(appDir, { '@forge/api': '^9.0.0' });
    expect(ahead.message).toContain('upgrade forge-sim');
  });

  it('prefers the installed version over the declared range', async () => {
    // Range says v8 (matches the table), but what's installed is v6 — the
    // installed copy is what the app's code actually runs against.
    const dir = await appDirWith('{}');
    await writeInstalled(dir, '@forge/api', '6.1.0');

    const warnings = checkAppForgeVersions(dir, { '@forge/api': '^8.2.0' });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('6.1.0 installed');
  });
});

describe('readAppForgeDeps', () => {
  it('merges dependencies, devDependencies and peerDependencies', async () => {
    const dir = await appDirWith(
      JSON.stringify({
        dependencies: { '@forge/api': '^8.2.0', react: '^18.0.0' },
        devDependencies: { '@forge/events': '^3.0.0' },
        peerDependencies: { '@forge/kvs': '^1.0.0' },
      }),
    );
    expect(await readAppForgeDeps(dir)).toEqual({
      '@forge/api': '^8.2.0',
      '@forge/events': '^3.0.0',
      '@forge/kvs': '^1.0.0',
    });
  });

  it('lets a real dependency win over a dev/peer declaration', async () => {
    const dir = await appDirWith(
      JSON.stringify({
        dependencies: { '@forge/api': '^8.2.0' },
        devDependencies: { '@forge/api': '^7.0.0' },
      }),
    );
    expect(await readAppForgeDeps(dir)).toEqual({ '@forge/api': '^8.2.0' });
  });

  it('returns {} when there is no package.json', async () => {
    expect(await readAppForgeDeps(await appDirWith(null))).toEqual({});
  });

  it('returns {} for a malformed package.json instead of throwing', async () => {
    expect(await readAppForgeDeps(await appDirWith('{ not json'))).toEqual({});
  });

  it('ignores non-string and non-@forge entries', async () => {
    const dir = await appDirWith(JSON.stringify({ dependencies: { '@forge/api': 8, lodash: '^4.0.0' } }));
    expect(await readAppForgeDeps(dir)).toEqual({});
  });
});
