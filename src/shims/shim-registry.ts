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
 * Packages intercepted and replaced by a forge-sim shim. Empty: every
 * `@forge/*` package runs as Atlassian ships it (PASSTHROUGH_OK below).
 * `@forge/resolver` was the last to leave; the bundler now observes the real
 * class instead of replacing it (src/bundler.ts).
 *
 * The mechanism stays wired (loader hooks, vitest alias, the contract
 * tests) so a shim that ever has to come back is registered in one place.
 * Subpaths are listed explicitly (e.g. `@forge/react/router`) because each
 * maps to its own shim file. Adding an entry here requires a matching
 * `src/shims/<base>.ts` — `shim-registry.test.ts` enforces that.
 */
export const SHIM_NAMES: readonly string[] = [];

export type ShimName = string;

/**
 * @forge/* packages that deliberately pass through to the REAL Atlassian
 * package, with no shim and no warning.
 *
 * These ship CJS and route all their I/O through `global.__forge_fetch__`,
 * which the simulator installs (`src/runtime/seam-fetch.ts`) — so the real
 * package runs unmodified against the sim's backends. Do NOT add an alias for
 * these; resolving to the real package IS the intended behavior. This is the
 * end state the bare-seam migration is moving every backend package toward:
 * running the real thing beats impersonating it, because the contract can't
 * drift from itself.
 *
 *   `@forge/sql`  → sim MySQL      (`type: 'sql'`)
 *   `@forge/kvs`  → sim KVS/entity store (`type: 'kvs'`; all 15 of the
 *                   package's `/api/v1/*` paths are served, transactions and
 *                   batch ops included)
 *   `@forge/llm`  → sim LLM mocks/history (`type: 'llm'`; chat, list and
 *                   newline-delimited streaming)
 *   `@forge/object-store` → sim Object Store (`type: 'os'`; the seven JSON
 *                   endpoints — content bytes travel over plain fetch to the
 *                   minted URLs, which the sim serves over real HTTP)
 *   `@forge/realtime` → sim realtime (`type: 'realtime'`; publish /
 *                   publishGlobal / signRealtimeToken GraphQL, with the
 *                   scoped-publish invocation gate riding the same
 *                   AsyncLocalStorage the shim path used.)
 *   `@forge/events` → sim queue + triggers (`type: 'fpp'` on the
 *                   `/webhook/queue/*` and `/forge/events/v1/app-events`
 *                   paths; it reaches the seam through @forge/api's
 *                   `__requestAtlassianAsApp`, not a seam call of its own)
 *   `@forge/api`  → sim product APIs, remotes, web triggers, third-party
 *                   OAuth and authorize() (`fpp` / `tpp` / `frc`). The last
 *                   backend package to flip.
 *   `@forge/bridge` (and its `/realtime` subpath) → the FRONTEND seam,
 *                   `globalThis.__bridge`, installed by the ForgeSimulator
 *                   constructor and answered by the headless BridgeHost
 *                   (`src/bridge/hosts/headless.ts`). Not a `__forge_fetch__`
 *                   package: this is the one seam real Forge gives an iframe,
 *                   and every surface — source-mode, prebuilt, Custom UI, dev
 *                   page, headless — runs the real package against it.
 *   `@forge/react` (and `/router`) → the real reconciler; its `reconcile`
 *                   frames ride the same `__bridge` seam. Pinned into every
 *                   frontend bundle behind the bundler's interop facade
 *                   (`exports.default` = ForgeReconciler).
 *   `@forge/jira-bridge`, `@forge/confluence-bridge`, `@forge/dashboards-bridge`
 *                   → real product bridges against `__bridge`; the headless
 *                   and browser hosts answer their commands inertly
 *                   (`src/bridge/hosts/product-surfaces.ts`). They ship NO
 *                   `main` and NO `exports` — only a `browser` field — so bare
 *                   resolution needs the `browser`-field fallback —
 *                   `browserOnlyEntry` below, used by the vitest plugin for
 *                   TEST files that import them; app bundles never resolve
 *                   a bare specifier at runtime.
 *   `@forge/resolver` → the real class, which needs no seam: it holds its
 *                   handler map in a closure and performs no I/O, and the
 *                   platform only ever calls the closure `getDefinitions()`
 *                   returns, which the sim does too. The bundler appends a
 *                   few lines to the package so the sim can also LIST the
 *                   keys of a closure it built (src/bundler.ts).
 *
 * CommonJS default-import interop (`import kvs from '@forge/kvs'` giving the
 * instance, not the namespace) is the BUNDLER's job: src/bundler.ts inlines
 * these packages into every deploy and forces the bundler convention, and
 * pins the frontend ones behind a generated facade. No loader-side list.
 */
export const PASSTHROUGH_OK: readonly string[] = [
  '@forge/sql',
  '@forge/kvs',
  '@forge/llm',
  '@forge/object-store',
  '@forge/realtime',
  '@forge/events',
  '@forge/api',
  '@forge/bridge',
  '@forge/react',
  '@forge/jira-bridge',
  '@forge/confluence-bridge',
  '@forge/dashboards-bridge',
  '@forge/resolver',
];

/**
 * Entry file for a package whose `package.json` has no `main` and no
 * `exports` — Node's resolver has nothing to go on and fails with
 * MODULE_NOT_FOUND even though the files are right there. The three product
 * bridges ship only a `browser` field (they are bundler-only in real Forge),
 * so a bare import must be mapped to it by hand. Used by the vitest resolve
 * plugin (test files importing them directly); app bundles resolve them
 * through esbuild, which honours the `browser` field itself.
 *
 * Returns a path relative to the package root, or null when the package
 * resolves normally.
 */
export function browserOnlyEntry(pkgJson: { main?: unknown; exports?: unknown; browser?: unknown }): string | null {
  if (pkgJson.main || pkgJson.exports) return null;
  return typeof pkgJson.browser === 'string' ? pkgJson.browser : null;
}

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
