/**
 * Mock file — `.forge-sim/mocks.json` support for dev mode (eval-6 F8).
 *
 * In-process tests and MCP sessions can register mocks BEFORE deploy, but
 * dev mode structurally couldn't: deploy-time scheduled triggers fired
 * during boot, before any `/__tools/` panel or CLI mock could possibly
 * exist, so they hit unmocked routes (bare 501) — or, with credentials
 * connected, the real site. This file closes that gap: dev mode loads
 * `<appDir>/.forge-sim/mocks.json` and applies it before the initial
 * deploy, then hot-reloads it on change.
 *
 * ## File shape
 *
 * Top-level keys are product names ("jira", "confluence", "bitbucket", or a
 * remote key from the manifest); each value is a route map identical to the
 * MCP `forge_mock_routes` shape. The reserved key `graphql` maps operation
 * names to response bodies (the `forge_mock_graphql` shape).
 *
 * ```json
 * {
 *   "jira": {
 *     "GET /rest/api/3/myself": { "accountId": "abc" },
 *     "PUT /rest/api/3/issue/FAIL-1": {
 *       "__forgeSimMockResponse": true, "status": 500, "body": { "error": "..." }
 *     }
 *   },
 *   "graphql": { "GetIssue": { "data": { "issue": { "key": "TEST-1" } } } }
 * }
 * ```
 *
 * JSON can't express function-valued routes — static bodies and tagged
 * `__forgeSimMockResponse` shapes only. For per-request logic, use the
 * in-process API in tests.
 *
 * ## Hot-reload semantics
 *
 * Re-applying the file MERGES into the live route tables (same semantics as
 * every other mockRoutes call — eval-6 F2). Editing a route's value takes
 * effect on save; DELETING a route from the file does not un-mock it until
 * the dev server restarts.
 */

import { existsSync, mkdirSync, readFileSync, watch, type FSWatcher } from 'node:fs';
import { join } from 'node:path';
import type { ForgeSimulator } from './simulator.js';

export const MOCK_FILE_NAME = 'mocks.json';
export const MOCK_FILE_DIR = '.forge-sim';

export interface MockFileSummary {
  /** Product route counts, e.g. { jira: 3, confluence: 1 } */
  products: Record<string, number>;
  /** Number of GraphQL operation mocks */
  graphqlOperations: number;
}

/**
 * Read and apply `<appDir>/.forge-sim/mocks.json` to the simulator.
 *
 * Returns `null` when the file doesn't exist (the common case — not an
 * error). Throws with a friendly message on malformed JSON or a non-object
 * top level, so callers can decide how loud to be (dev boot warns and
 * continues; hot-reload warns and keeps the previous mocks).
 */
export function applyMockFile(sim: ForgeSimulator, appDir: string): MockFileSummary | null {
  const filePath = join(appDir, MOCK_FILE_DIR, MOCK_FILE_NAME);
  if (!existsSync(filePath)) return null;

  const raw = readFileSync(filePath, 'utf-8');
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (err: any) {
    throw new Error(`${MOCK_FILE_DIR}/${MOCK_FILE_NAME} is not valid JSON: ${err.message}`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      `${MOCK_FILE_DIR}/${MOCK_FILE_NAME} must be an object mapping product names to route maps ` +
      `(e.g. { "jira": { "GET /rest/api/3/myself": { ... } } })`
    );
  }

  const summary: MockFileSummary = { products: {}, graphqlOperations: 0 };
  for (const [key, value] of Object.entries(parsed)) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(
        `${MOCK_FILE_DIR}/${MOCK_FILE_NAME}: value for "${key}" must be an object ` +
        `(route map or GraphQL operation map), got ${Array.isArray(value) ? 'array' : typeof value}`
      );
    }
    if (key === 'graphql') {
      sim.mockGraphQL(value as Record<string, any>);
      summary.graphqlOperations = Object.keys(value).length;
    } else {
      sim.mockProductRoutes(key, value as Record<string, any>);
      summary.products[key] = Object.keys(value).length;
    }
  }
  return summary;
}

/** One-line human summary: "3 jira + 1 confluence routes, 2 GraphQL ops". */
export function describeMockSummary(summary: MockFileSummary): string {
  const parts = Object.entries(summary.products).map(([p, n]) => `${n} ${p}`);
  const routeCount = Object.values(summary.products).reduce((a, b) => a + b, 0);
  const pieces: string[] = [];
  if (routeCount > 0) pieces.push(`${parts.join(' + ')} route${routeCount === 1 ? '' : 's'}`);
  if (summary.graphqlOperations > 0) {
    pieces.push(`${summary.graphqlOperations} GraphQL op${summary.graphqlOperations === 1 ? '' : 's'}`);
  }
  return pieces.length > 0 ? pieces.join(', ') : 'no routes';
}

/**
 * Watch `.forge-sim/mocks.json` for changes and re-apply on save.
 *
 * The dev server's app watcher deliberately ignores dot-directories (so
 * bundle-cache writes can't trigger redeploy loops), which also makes it
 * blind to this file — hence a dedicated watcher. The `.forge-sim` dir is
 * created if missing so the watch can always attach (fs.watch on a
 * non-existent path throws), which also means the file can be CREATED
 * after boot and still get picked up.
 *
 * Returns a cleanup function.
 */
export function watchMockFile(
  sim: ForgeSimulator,
  appDir: string,
  log: (message: string) => void = console.log,
): () => void {
  const dir = join(appDir, MOCK_FILE_DIR);
  mkdirSync(dir, { recursive: true });

  let debounce: ReturnType<typeof setTimeout> | null = null;
  let watcher: FSWatcher | null = null;
  try {
    watcher = watch(dir, (_event, filename) => {
      if (filename !== MOCK_FILE_NAME) return;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        try {
          const summary = applyMockFile(sim, appDir);
          if (summary) {
            log(`  🎭 Reloaded ${MOCK_FILE_DIR}/${MOCK_FILE_NAME} (${describeMockSummary(summary)})`);
          }
        } catch (err: any) {
          // Keep the previously-applied mocks; a half-saved file mid-edit
          // is the normal case here, so warn without drama.
          log(`  ⚠️  ${err.message}`);
        }
      }, 300);
    });
  } catch {
    // Watching is best-effort (some filesystems/containers lack support);
    // the boot-time load already happened.
  }

  return () => {
    if (debounce) clearTimeout(debounce);
    watcher?.close();
  };
}
