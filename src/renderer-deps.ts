/**
 * Lazy installation of the UI renderer's dependencies.
 *
 * The published forge-sim package ships `renderer/src` (TSX source, compiled
 * by Vite at dev time) and `renderer/package.json`, but npm strips nested
 * node_modules from tarballs — so the ~51 Atlaskit packages the dev server
 * needs are NOT present after `npm install forge-sim`.
 *
 * Instead of hoisting them into forge-sim's own dependencies (which would tax
 * every headless MCP / test-API consumer with ~200 MB of UI packages), the
 * `forge-sim dev` command installs them on first use, directly into
 * `renderer/node_modules` — the standard place anyone would look when
 * debugging a resolution problem. Upgrading forge-sim gives a fresh package
 * directory, so stale deps after an upgrade solve themselves.
 *
 * Headless surfaces (MCP server, in-process test API, agent CLI) never call
 * this — server-side ForgeDoc rendering doesn't touch Atlaskit.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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
 * List runtime dependencies from renderer/package.json that are not present
 * in renderer/node_modules. Returns [] when renderer/package.json is absent
 * (nothing to install) or when everything resolves.
 */
export function missingRendererDeps(forgeSimRoot: string): string[] {
  const rendererDir = join(forgeSimRoot, 'renderer');
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
