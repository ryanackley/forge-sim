/**
 * The one list of @forge/* packages forge-sim shims.
 *
 * Two different resolution mechanisms need this list, and they MUST agree:
 *
 *   1. `src/loader/hooks.ts` — Node module-resolution hooks, used when an app
 *      runs under `node --import ./dist/loader/register.js`. Maps each name to
 *      `dist/shims/<base>.js`.
 *   2. `vitest.config.ts` — Vite/rollup `resolve.alias`, used when a deployed
 *      handler bundle is imported by vite-node inside a test run. Maps each
 *      name to `src/shims/<base>.ts`.
 *
 * They previously maintained separate hand-written lists, and they drifted:
 * the loader registered 13 shims while vitest aliased 7. The five missing
 * entries split into two failure modes, neither of them obvious:
 *
 *   - `@forge/realtime` and `@forge/llm` have NO real Atlassian package
 *     installed, so an app importing them failed to deploy under vitest with
 *     "Cannot find package '@forge/realtime'". `@forge/realtime` is the
 *     documented way to publish realtime events from a resolver, so this
 *     blocked the most realistic form of every realtime test.
 *   - `@forge/jira-bridge`, `@forge/confluence-bridge` and
 *     `@forge/dashboards-bridge` DO have real packages installed, so they
 *     silently resolved to the real Atlassian package instead of the shim —
 *     no error, no warning, and the simulator simply not involved.
 *
 * Both are parity bugs: works in Forge, fails (or silently misbehaves) in
 * forge-sim. Keep this module dependency-free — it is imported both by the
 * loader (which runs in a worker thread without tsx) and by the Vite config.
 */

/**
 * Packages intercepted and replaced by a forge-sim shim.
 *
 * Subpaths are listed explicitly (e.g. `@forge/react/router`) because each
 * maps to its own shim file. Adding an entry here requires a matching
 * `src/shims/<base>.ts` — `shim-registry.test.ts` enforces that.
 */
export const SHIM_NAMES = [
  '@forge/api',
  '@forge/kvs',
  '@forge/events',
  '@forge/resolver',
  '@forge/react',
  '@forge/react/router',
  '@forge/bridge/realtime',
  '@forge/bridge',
  '@forge/jira-bridge',
  '@forge/confluence-bridge',
  '@forge/dashboards-bridge',
  '@forge/llm',
  '@forge/realtime',
  '@forge/object-store',
] as const;

export type ShimName = (typeof SHIM_NAMES)[number];

/**
 * @forge/* packages that deliberately pass through to the REAL Atlassian
 * package, with no shim and no warning.
 *
 * `@forge/sql` ships CJS and routes all its I/O through
 * `global.__forge_fetch__`, which the simulator installs — so the real package
 * runs unmodified against the sim's MySQL backend. Do NOT add an alias for
 * these; resolving to the real package IS the intended behavior.
 */
export const PASSTHROUGH_OK: readonly string[] = ['@forge/sql'];

/**
 * Shim filename stem for a package name.
 *
 *   '@forge/react'        → 'forge-react'
 *   '@forge/react/router' → 'forge-react-router'   (subpaths flatten slashes)
 *
 * Callers append their own extension: `.js` for the compiled loader path,
 * `.ts` for the Vite source path.
 */
export function shimFileBase(pkg: string): string {
  return pkg.replace('@forge/', 'forge-').replaceAll('/', '-');
}

/**
 * Package names ordered so that subpaths precede their parent package.
 *
 * Load-bearing for rollup/Vite `resolve.alias`, which matches string keys as
 * PREFIXES: with `@forge/react` first, the specifier `@forge/react/router`
 * would be mangled into `.../forge-react.ts/router`. Sorting by descending
 * length puts the more specific key first, which is the general form of that
 * rule and keeps working as new subpaths are added.
 */
export function shimNamesBySpecificity(): string[] {
  return [...SHIM_NAMES].sort((a, b) => b.length - a.length);
}
