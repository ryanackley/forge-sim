/**
 * Loads the REAL @forge/* packages (the ones Atlassian publishes to npm) for
 * contract-parity tests, bypassing the shim aliases in vitest.config.ts.
 *
 * Why this is fiddly:
 *
 *   - `import '@forge/api'` inside a test resolves to OUR shim (that's the
 *     point of the alias), so real packages must be loaded by explicit
 *     node_modules path via createRequire. They are all CJS, so require works.
 *   - `@forge/jira-bridge`, `@forge/confluence-bridge` and
 *     `@forge/dashboards-bridge` ship no `main` field and no root index.js —
 *     `require('@forge/jira-bridge')` fails even without aliasing. Real Forge
 *     apps load them through a bundler that reads `out/index.js`; we point at
 *     that file directly.
 *   - Several packages run environment checks at module load:
 *       * `@forge/bridge` / `@forge/react` call getCallBridge() → need a
 *         `__bridge.callBridge` stub on window/globalThis (5.x looked at
 *         window.__bridge, 6.x at globalThis.__bridge — stub both).
 *       * `@forge/llm` constructs its API client at load and reads
 *         `__getRuntime()?.tracing` from `global.__forge_runtime__` → an empty
 *         object stub suffices.
 *     We only introspect exports, never invoke, so inert stubs are safe.
 */
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(import.meta.url);

/** Install the globals real @forge packages probe at module-load time. */
export function stubForgeLoadEnvironment(): void {
  const g = globalThis as any;
  if (typeof g.window === 'undefined') g.window = {};
  if (!g.window.__bridge) g.window.__bridge = { callBridge: () => undefined };
  if (!g.__bridge) g.__bridge = { callBridge: () => undefined };
  if (!g.__forge_runtime__) g.__forge_runtime__ = {};
}

/**
 * Where each shimmed specifier's REAL implementation lives.
 *
 * Plain names resolve through the package's own `main`/`exports`. Explicit
 * `out/...` paths work around missing `main` fields (the *-bridge packages)
 * and subpath exports that createRequire can't reach through the alias
 * (`@forge/react/router`, `@forge/bridge/realtime`).
 */
const REAL_ENTRY: Record<string, string> = {
  '@forge/api': 'node_modules/@forge/api',
  '@forge/kvs': 'node_modules/@forge/kvs',
  '@forge/events': 'node_modules/@forge/events',
  '@forge/resolver': 'node_modules/@forge/resolver',
  '@forge/react': 'node_modules/@forge/react',
  '@forge/react/router': 'node_modules/@forge/react/out/router/index.js',
  '@forge/bridge': 'node_modules/@forge/bridge',
  '@forge/bridge/realtime': 'node_modules/@forge/bridge/out/realtime/index.js',
  '@forge/jira-bridge': 'node_modules/@forge/jira-bridge/out/index.js',
  '@forge/confluence-bridge': 'node_modules/@forge/confluence-bridge/out/index.js',
  '@forge/dashboards-bridge': 'node_modules/@forge/dashboards-bridge/out/index.js',
  '@forge/llm': 'node_modules/@forge/llm',
  '@forge/realtime': 'node_modules/@forge/realtime',
  '@forge/object-store': 'node_modules/@forge/object-store',
};

/**
 * Load the real package behind a shimmed specifier. Returns the CJS module
 * namespace. Throws if the specifier has no entry in REAL_ENTRY — adding a
 * shim requires deciding where its upstream reference lives.
 */
export function loadRealForgePackage(specifier: string): Record<string, unknown> {
  const entry = REAL_ENTRY[specifier];
  if (!entry) {
    throw new Error(
      `No real-package entry for '${specifier}'. Add it to REAL_ENTRY in ` +
        `real-forge-packages.ts (and npm install the package) so the contract ` +
        `suite covers the new shim.`,
    );
  }
  stubForgeLoadEnvironment();
  return require(resolve(REPO_ROOT, entry));
}

/** All shimmed specifiers that have a real upstream reference. */
export function realForgeSpecifiers(): string[] {
  return Object.keys(REAL_ENTRY);
}
