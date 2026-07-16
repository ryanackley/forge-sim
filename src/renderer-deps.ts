/**
 * Materialization of the UI renderer for `forge-sim dev`.
 *
 * The published forge-sim package ships `renderer/src` (TSX source, compiled
 * by Vite at dev time), `renderer/package.json`, and
 * `renderer/package-lock.json` — but npm strips nested node_modules from
 * tarballs, so the ~51 Atlaskit packages the dev server needs are NOT
 * present after `npm install forge-sim`.
 *
 * Two problems rule out the obvious "npm install in place" fix:
 *
 * 1. **Peer-dep hell.** The Atlaskit tree contains transitive packages that
 *    pin react@^16 peers against our react@18 tree. A fresh `npm install`
 *    resolution fails with ERESOLVE. The shipped lockfile sidesteps this —
 *    `npm ci` replays the locked tree byte-for-byte and never runs the
 *    resolver.
 * 2. **Vite refuses node_modules sources.** When renderer sources live under
 *    `node_modules/forge-sim/renderer`, Vite's dep optimizer classifies every
 *    import as a non-source dependency and never pre-bundles / CJS-interops
 *    the ~1200-module Atlaskit graph — the browser dies on the first CJS
 *    default-export. The renderer must live OUTSIDE any node_modules path.
 *
 * So for installed packages we *materialize* the renderer into a user-level,
 * version-keyed directory (`~/.forge-sim/renderer/<version>/`): copy the
 * shipped sources + lockfile there, write `.npmrc` (legacy-peer-deps for any
 * manual npm invocations), and run `npm ci`. Installs happen in a temp dir
 * and are atomically renamed into place, so an interrupted install can never
 * present as complete. Upgrading forge-sim yields a new version dir; old ones
 * are pruned after a successful materialize.
 *
 * Git checkouts (renderer not under node_modules) keep the original in-place
 * behavior: install into `<root>/renderer/node_modules` on first use.
 *
 * Headless surfaces (MCP server, in-process test API, agent CLI) never call
 * this — server-side ForgeDoc rendering doesn't touch Atlaskit.
 */

import { existsSync, readFileSync, mkdirSync, rmSync, cpSync, writeFileSync, renameSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

export interface EnsureRendererDepsOptions {
  /** Replacement logger (default: console). */
  logger?: Pick<typeof console, 'log' | 'error'>;
  /**
   * Replacement installer (default: `npm install` in the renderer dir with
   * inherited stdio). Receives the renderer directory; returns the exit code.
   */
  install?: (rendererDir: string) => number;
}

export interface EnsureRendererDepsResult {
  /** True if an install was performed on this call. */
  installed: boolean;
  /** Dependencies that were missing before this call. */
  missing: string[];
}

/**
 * List runtime dependencies from <rendererDir>/package.json that are not
 * present in <rendererDir>/node_modules. Returns [] when package.json is
 * absent (nothing to install) or when everything resolves.
 */
export function missingDepsIn(rendererDir: string): string[] {
  const pkgPath = join(rendererDir, 'package.json');
  if (!existsSync(pkgPath)) return [];

  let pkg: any;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  } catch {
    return [];
  }

  const deps = Object.keys(pkg.dependencies ?? {});
  return deps.filter(
    (dep) => !existsSync(join(rendererDir, 'node_modules', dep, 'package.json'))
  );
}

/**
 * List runtime dependencies from renderer/package.json that are not present
 * in renderer/node_modules. Returns [] when renderer/package.json is absent
 * (nothing to install) or when everything resolves.
 */
export function missingRendererDeps(forgeSimRoot: string): string[] {
  return missingDepsIn(join(forgeSimRoot, 'renderer'));
}

function defaultInstall(rendererDir: string): number {
  const result = spawnSync('npm', ['install', '--no-fund', '--no-audit'], {
    cwd: rendererDir,
    stdio: 'inherit',
    // npm is npm.cmd on Windows — shell resolves it either way
    shell: process.platform === 'win32',
  });
  return result.status ?? 1;
}

/**
 * Ensure the renderer's dependencies are installed, installing them on
 * demand if any are missing. Throws with actionable guidance if the install
 * fails (offline, npm missing, etc.).
 */
export function ensureRendererDeps(
  forgeSimRoot: string,
  options: EnsureRendererDepsOptions = {}
): EnsureRendererDepsResult {
  const logger = options.logger ?? console;
  const rendererDir = join(forgeSimRoot, 'renderer');

  const missing = missingRendererDeps(forgeSimRoot);
  if (missing.length === 0) {
    return { installed: false, missing: [] };
  }

  logger.log(`  📦 First run: installing UI renderer dependencies (one time)...`);
  logger.log(`     ${missing.length} package(s) → ${join(rendererDir, 'node_modules')}`);
  logger.log('');

  const install = options.install ?? defaultInstall;
  const status = install(rendererDir);

  const stillMissing = missingRendererDeps(forgeSimRoot);
  if (status !== 0 || stillMissing.length > 0) {
    throw new Error(
      `Failed to install UI renderer dependencies` +
        (status !== 0 ? ` (npm exited with code ${status})` : '') +
        (stillMissing.length > 0
          ? `. Still missing: ${stillMissing.slice(0, 5).join(', ')}${stillMissing.length > 5 ? ', …' : ''}`
          : '') +
        `.\nTo install manually, run:\n  npm install --prefix "${rendererDir}"`
    );
  }

  logger.log(`  ✅ Renderer dependencies installed`);
  logger.log('');
  return { installed: true, missing };
}

// ── Materialization (installed-package mode) ────────────────────────────────

/**
 * True when forge-sim is running from an installed npm package (any path
 * segment is `node_modules`) rather than a git checkout. Installed packages
 * must materialize the renderer OUTSIDE node_modules — Vite's dep optimizer
 * won't pre-bundle/CJS-interop imports it classifies as dependency code.
 */
export function isInstalledPackage(forgeSimRoot: string): boolean {
  return resolve(forgeSimRoot).split(sep).includes('node_modules');
}

export interface MaterializeRendererOptions {
  /** Replacement logger (default: console). */
  logger?: Pick<typeof console, 'log' | 'error'>;
  /**
   * Replacement installer (default: `npm ci --omit=dev` in the target dir
   * with inherited stdio, so npm's own output — including network errors —
   * streams raw to the user). Receives the directory; returns the exit code.
   */
  install?: (dir: string) => number;
  /**
   * Base directory for materialized renderers (default:
   * $FORGE_SIM_RENDERER_DIR or ~/.forge-sim/renderer). Version dirs are
   * created beneath it.
   */
  baseDir?: string;
}

function defaultCiInstall(dir: string): number {
  const result = spawnSync('npm', ['ci', '--omit=dev', '--no-fund', '--no-audit'], {
    cwd: dir,
    // inherit — npm errors (ERESOLVE, network failures, registry 5xx) must
    // stream raw to the user, never be swallowed.
    stdio: 'inherit',
    // npm is npm.cmd on Windows — shell resolves it either way
    shell: process.platform === 'win32',
  });
  return result.status ?? 1;
}

/** Render a path with the home directory abbreviated to ~ for display. */
function tildify(p: string): string {
  const home = homedir();
  return p.startsWith(home + sep) || p === home ? '~' + p.slice(home.length) : p;
}

/**
 * Best-effort cleanup of the materialize base dir after a successful
 * install: removes renderer dirs for other forge-sim versions and stale
 * temp dirs from crashed installs (>24h old). Only entries that are clearly
 * ours are touched — semver-shaped dirs and `.tmp-*` dirs — so pointing
 * $FORGE_SIM_RENDERER_DIR at a directory containing other files is safe.
 * Never throws — pruning is housekeeping, not correctness.
 */
function pruneOldRenderers(baseDir: string, keepVersion: string, logger: Pick<typeof console, 'log' | 'error'>): void {
  const versionLike = /^\d+\.\d+\.\d+/;
  try {
    for (const entry of readdirSync(baseDir)) {
      if (entry === keepVersion) continue;
      const isTmp = entry.startsWith('.tmp-');
      if (!isTmp && !versionLike.test(entry)) continue;
      const full = join(baseDir, entry);
      try {
        const st = statSync(full);
        if (!st.isDirectory()) continue;
        if (isTmp) {
          // Stale temp dir from a crashed install — but a concurrent install
          // in another process also uses .tmp-*; only remove old ones.
          if (Date.now() - st.mtimeMs < 24 * 60 * 60 * 1000) continue;
        }
        rmSync(full, { recursive: true, force: true });
        logger.log(`     🧹 Removed old renderer: ${tildify(full)}`);
      } catch {
        // skip entries we can't stat/remove
      }
    }
  } catch {
    // baseDir unreadable — nothing to prune
  }
}

/**
 * Ensure a usable renderer directory exists and return its absolute path.
 *
 * - **Git checkout** (forgeSimRoot not under node_modules): the renderer is
 *   `<root>/renderer`; deps are installed in place on first use via
 *   {@link ensureRendererDeps}.
 * - **Installed package**: the renderer is materialized to
 *   `~/.forge-sim/renderer/<version>/` (override with $FORGE_SIM_RENDERER_DIR).
 *   Shipped sources + lockfile are copied to a temp dir, `npm ci` runs there
 *   (locked tree — the resolver never runs, so Atlaskit's react@16 peer pins
 *   can't ERESOLVE), and the temp dir is atomically renamed into place.
 *   Subsequent runs find the complete dir and return immediately.
 *
 * Throws with the npm exit code and a manual retry command on any install
 * failure. npm's own stderr (network errors, registry failures) streams
 * directly to the terminal via inherited stdio.
 */
export function materializeRenderer(
  forgeSimRoot: string,
  options: MaterializeRendererOptions = {}
): string {
  const logger = options.logger ?? console;
  const packagedRenderer = join(forgeSimRoot, 'renderer');

  // Git checkout / linked dev tree → original in-place behavior.
  if (!isInstalledPackage(forgeSimRoot)) {
    ensureRendererDeps(forgeSimRoot, { logger, install: options.install });
    return packagedRenderer;
  }

  // Installed package → materialize outside node_modules.
  let version = '0.0.0';
  try {
    version = JSON.parse(readFileSync(join(forgeSimRoot, 'package.json'), 'utf8')).version ?? version;
  } catch {
    // fall through with placeholder — still functional, just a generic dir name
  }

  const baseDir =
    options.baseDir ??
    process.env.FORGE_SIM_RENDERER_DIR ??
    join(homedir(), '.forge-sim', 'renderer');
  const target = join(baseDir, version);

  // Warm path: a completed materialization exists (atomic rename guarantees
  // a present dir is a complete one, but verify deps anyway — cheap, and
  // catches manual tampering).
  if (existsSync(target) && missingDepsIn(target).length === 0) {
    return target;
  }

  if (!existsSync(join(packagedRenderer, 'package.json'))) {
    throw new Error(
      `forge-sim package at ${forgeSimRoot} does not contain renderer sources ` +
        `(renderer/package.json missing). The package may be corrupted — try reinstalling forge-sim.`
    );
  }

  logger.log(`  📦 First run: installing the UI renderer to ${tildify(target)} (one time)...`);
  logger.log(`     Compiling in the browser requires the Atlaskit component tree (~250 MB).`);
  logger.log('');

  mkdirSync(baseDir, { recursive: true });
  const tmpDir = join(baseDir, `.tmp-${version}-${process.pid}`);
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });

  // Copy shipped renderer sources + manifest + lockfile.
  cpSync(join(packagedRenderer, 'src'), join(tmpDir, 'src'), { recursive: true });
  cpSync(join(packagedRenderer, 'package.json'), join(tmpDir, 'package.json'));
  const lockfile = join(packagedRenderer, 'package-lock.json');
  if (existsSync(lockfile)) {
    cpSync(lockfile, join(tmpDir, 'package-lock.json'));
  }
  // legacy-peer-deps: npm ci replays the lockfile and never hits the
  // resolver, but any MANUAL `npm install` a user runs in this dir (e.g.
  // retrying after a network failure with the wrong command) would
  // ERESOLVE on Atlaskit's react@16 peer pins without this.
  writeFileSync(join(tmpDir, '.npmrc'), 'legacy-peer-deps=true\n');

  const install = options.install ?? defaultCiInstall;
  const hasLockfile = existsSync(join(tmpDir, 'package-lock.json'));
  const status = install(tmpDir);

  const stillMissing = status === 0 ? missingDepsIn(tmpDir) : [];
  if (status !== 0 || stillMissing.length > 0) {
    // tmpDir is left in place deliberately — the retry instructions below
    // point the user at it.
    throw new Error(
      `Failed to install the UI renderer's dependencies` +
        (status !== 0 ? ` (npm exited with code ${status})` : '') +
        (stillMissing.length > 0
          ? ` (still missing after install: ${stillMissing.slice(0, 5).join(', ')}${stillMissing.length > 5 ? ', …' : ''})`
          : '') +
        `.\nSee npm's output above for the underlying cause — a network or registry error is the most common.` +
        `\nTo retry manually, run:\n  cd "${tmpDir}" && npm ci --omit=dev` +
        (hasLockfile ? '' : `\n(note: package-lock.json was not shipped — use \`npm install\` instead of \`npm ci\`)`) +
        `\nThen rename the directory:\n  mv "${tmpDir}" "${target}"`
    );
  }

  // Atomic promotion: present target dir == complete install.
  try {
    renameSync(tmpDir, target);
  } catch (err: any) {
    // A concurrent install won the race — if their result is complete,
    // use it and discard ours.
    if (existsSync(target) && missingDepsIn(target).length === 0) {
      rmSync(tmpDir, { recursive: true, force: true });
    } else {
      throw err;
    }
  }

  logger.log('');
  logger.log(`  ✅ UI renderer installed: ${tildify(target)}`);
  logger.log('');

  pruneOldRenderers(baseDir, version, logger);

  return target;
}
