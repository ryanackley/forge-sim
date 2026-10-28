/**
 * A scratch app written into a temp directory has no `node_modules`, and
 * forge-sim resolves an app's dependencies only from the app's own
 * `node_modules` chain, exactly as `forge deploy` does (no fallback to
 * forge-sim's copies). So a test that writes an app importing `@forge/*`
 * gives it an install the way `npm install` would: a `node_modules` link to
 * the repo's, at the app root (source mode) or inside `app.package.path`
 * (manual packaging, which uploads only that directory).
 */
import { existsSync, lstatSync, symlinkSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** The repo's own `node_modules`, the install every scratch app links to. */
export const REPO_NODE_MODULES = join(REPO_ROOT, 'node_modules');

/**
 * Link `<dir>/node_modules` to the repo's. Idempotent; a stale link from an
 * earlier run (or an earlier checkout path) is replaced.
 */
export function linkNodeModules(dir: string): void {
  const target = join(dir, 'node_modules');
  try {
    if (lstatSync(target)) unlinkSync(target);
  } catch {
    // absent
  }
  if (!existsSync(dir)) throw new Error(`linkNodeModules: ${dir} does not exist`);
  symlinkSync(REPO_NODE_MODULES, target, 'dir');
}
