/**
 * Regression tests for the eval-6 findings cluster (adversarial cold-install
 * eval against the published 0.1.5 package, 2026-07-17).
 *
 * F3 — a deploy with errors resolved silently: `sim.deploy()` returned a
 *      result with `errors: [...]` and tests that forgot to assert on it
 *      passed against a half-wired app. Real `forge deploy` fails hard, so
 *      the in-process surface now THROWS `DeployError` by default
 *      (opt out with `{ throwOnError: false }`). MCP + daemon surfaces stay
 *      continue-and-inform.
 * F4 — type checking ran on some surfaces and not others ("4 surfaces,
 *      4 behaviors"). It is now part of the deploy pipeline: opt-in for the
 *      in-process API (`{ typeCheck: true }` — tsc costs seconds), always on
 *      for MCP/daemon. Type errors land on `result.typeErrors` and count
 *      toward `throwOnError`.
 * F5 — error-level manifest validation problems (real Forge lint rejections)
 *      were only *printed* as warnings, never returned. They now land in
 *      `result.errors` (functionKey 'manifest') and are excluded from
 *      `result.warnings`. (Pinned in deployer.test.ts N6.)
 * F2 — `mockRoutes()` REPLACED on every call: each call built a handler
 *      closed over only its own routes and swapped it in, silently wiping
 *      earlier mocks for the same product. It now MERGES — routes
 *      accumulate as if passed in one call; re-registering the same
 *      "METHOD /path" key updates that route in place.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { utimesSync } from 'node:fs';
import { createSimulator, ForgeSimulator } from '../simulator.js';
import { deploy, DeployError, sweepStaleBundles } from '../deployer.js';

// The public barrel must export the error class — consumers need
// `import { DeployError } from 'forge-sim'` for instanceof checks in tests.
import { DeployError as BarrelDeployError } from '../index.js';

// ── Temp app helper ─────────────────────────────────────────────────────

const tempDirs: string[] = [];

function makeApp(files: Record<string, string>): string {
  const dir = join(
    tmpdir(),
    `forge-sim-eval6-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

const APP_FOOTER = `
app:
  id: ari:cloud:ecosystem::app/eval6-test
  name: Eval6 Test
  runtime:
    name: nodejs22.x
`;

const HEALTHY_APP = {
  'src/index.js': `import Resolver from '@forge/resolver';
const resolver = new Resolver();
resolver.define('ping', () => 'pong');
export const handler = resolver.getDefinitions();
`,
  'manifest.yml': `
modules:
  function:
    - key: main
      handler: index.handler
${APP_FOOTER}`,
};

// A manifest real Forge lint rejects: web trigger → undeclared function.
const BROKEN_APP = {
  'src/index.js': `export const run = async () => ({ statusCode: 204 });\n`,
  'manifest.yml': `
modules:
  webtrigger:
    - key: hook
      function: no-such-fn
  function:
    - key: real-fn
      handler: index.run
${APP_FOOTER}`,
};

// ── F3: deploy honesty — throw by default ───────────────────────────────

describe('F3: sim.deploy() throws on deploy errors by default', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    vi.resetModules();
    sim = createSimulator();
  });

  it('throws DeployError carrying the full result', async () => {
    const dir = makeApp(BROKEN_APP);

    let caught: unknown;
    try {
      await deploy(sim, dir);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(DeployError);
    const de = caught as DeployError;
    expect(de.name).toBe('DeployError');
    // The complete result rides along for inspection.
    expect(de.result.errors.length).toBeGreaterThan(0);
    expect(de.result.errors.map((e) => e.error).join('\n')).toContain('no-such-fn');
    // The message tells you both escape hatches.
    expect(de.message).toContain('error.result');
    expect(de.message).toContain('throwOnError: false');
  });

  it('resolves with the result when { throwOnError: false }', async () => {
    const dir = makeApp(BROKEN_APP);

    const result = await deploy(sim, dir, { throwOnError: false });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.loadedFunctions).toContain('real-fn');
  });

  it('does not throw for a healthy app', async () => {
    const dir = makeApp(HEALTHY_APP);

    const result = await deploy(sim, dir);

    expect(result.errors).toEqual([]);
    expect(result.loadedFunctions).toContain('main');
  });

  it('exports DeployError through the public barrel', () => {
    expect(BarrelDeployError).toBe(DeployError);
  });
});

// ── F3 fallout: bundle sweep must not eat concurrent deploys ────────────

describe('F3 fallout: age-gated bundle sweep', () => {
  it('spares fresh bundles, removes old ones', async () => {
    // Two simulators can deploy the same app dir at once (vitest parallel
    // workers sharing a fixture). The sweep used to delete ALL deploy-*.mjs
    // unconditionally — including a sibling deploy's freshly written,
    // not-yet-imported bundle. Silently absorbed into errors[] before the
    // F3 throw-by-default change; a hard DeployError after it.
    const dir = makeApp({
      'bundles/deploy-fresh-abc123.mjs': 'export const x = 1;\n',
      'bundles/deploy-old-def456.mjs': 'export const x = 2;\n',
      'bundles/not-a-bundle.txt': 'keep me\n',
    });
    const bundleDir = join(dir, 'bundles');
    // Backdate the "old" bundle past the sweep threshold (5 min).
    const oldTime = (Date.now() - 10 * 60 * 1000) / 1000;
    utimesSync(join(bundleDir, 'deploy-old-def456.mjs'), oldTime, oldTime);

    await sweepStaleBundles(bundleDir);

    const { readdirSync } = await import('node:fs');
    const remaining = readdirSync(bundleDir).sort();
    expect(remaining).toEqual(['deploy-fresh-abc123.mjs', 'not-a-bundle.txt']);
  });
});

// ── F2: mock routes merge across calls ──────────────────────────────────

describe('F2: mockRoutes merges instead of replacing', () => {
  it('routes from sequential calls all answer', async () => {
    const { SimulatedProductApi } = await import('../product-api.js');
    const api = new SimulatedProductApi();

    api.mockRoutes('jira', {
      'GET /rest/api/3/issue/A-1': { key: 'A-1' },
    });
    // The eval-6 repro: this second call used to wipe the first.
    api.mockRoutes('jira', {
      'GET /rest/api/3/issue/B-2': { key: 'B-2' },
    });

    const a = await api.request('jira', '/rest/api/3/issue/A-1');
    const b = await api.request('jira', '/rest/api/3/issue/B-2');
    expect(a.status).toBe(200);
    expect((await a.json()).key).toBe('A-1');
    expect(b.status).toBe(200);
    expect((await b.json()).key).toBe('B-2');
  });

  it('re-registering the same METHOD+path updates the route in place', async () => {
    const { SimulatedProductApi } = await import('../product-api.js');
    const api = new SimulatedProductApi();

    // Specific route registered BEFORE a broader prefix route — the update
    // must keep its original position so first-match-wins still prefers it.
    api.mockRoutes('jira', {
      'GET /rest/api/3/issue/A-1': { key: 'A-1', rev: 1 },
      'GET /rest/api/3/issue': { key: 'FALLBACK' },
    });
    api.mockRoutes('jira', {
      'GET /rest/api/3/issue/A-1': { key: 'A-1', rev: 2 },
    });

    const res = await api.request('jira', '/rest/api/3/issue/A-1');
    const body = await res.json();
    expect(body.rev).toBe(2);
    expect(body.key).toBe('A-1'); // not the prefix fallback
  });

  it('merges per product independently and clear() wipes the table', async () => {
    const { SimulatedProductApi } = await import('../product-api.js');
    const api = new SimulatedProductApi();

    api.mockRoutes('jira', { 'GET /a': { from: 'jira' } });
    api.mockRoutes('confluence', { 'GET /a': { from: 'confluence' } });

    expect((await (await api.request('jira', '/a')).json()).from).toBe('jira');
    expect((await (await api.request('confluence', '/a')).json()).from).toBe('confluence');

    api.clear();
    // Post-clear the product is back to the unmocked 501 handler — the
    // route table must not survive and resurrect stale mocks.
    const after = await api.request('jira', '/a');
    expect(after.status).toBe(501);
    api.mockRoutes('jira', { 'GET /b': { fresh: true } });
    expect((await api.request('jira', '/a')).status).toBe(404);
    expect((await (await api.request('jira', '/b')).json()).fresh).toBe(true);
  });

  it('merge holds on the simulator surface (MCP forge_mock_routes path)', async () => {
    const sim = createSimulator();
    sim.mockProductRoutes('jira', { 'GET /rest/api/3/myself': { accountId: 'me' } });
    sim.mockProductRoutes('jira', { 'GET /rest/api/3/serverInfo': { version: '9' } });

    const r1 = await sim.productApi.request('jira', '/rest/api/3/myself');
    const r2 = await sim.productApi.request('jira', '/rest/api/3/serverInfo');
    expect((await r1.json()).accountId).toBe('me');
    expect((await r2.json()).version).toBe('9');
  });
});

// ── F4: type checking joins the deploy pipeline ─────────────────────────

describe('F4: typeCheck as a deploy option', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    vi.resetModules();
    sim = createSimulator();
  });

  afterEach(() => {
    vi.doUnmock('../type-checker.js');
  });

  it('typeErrors is undefined when typeCheck was not requested', async () => {
    const dir = makeApp(HEALTHY_APP);

    const result = await deploy(sim, dir);

    // undefined = "not run" — distinct from [] = "ran clean".
    expect(result.typeErrors).toBeUndefined();
  });

  it('typeCheck: true populates result.typeErrors and counts toward throwOnError', async () => {
    // Mock the checker — the tsc integration itself is covered by
    // type-checker.test.ts; this pins the deployer wiring (eval-6 F4:
    // "4 surfaces, 4 behaviors" — the CI surface never checked at all).
    const fakeError = {
      file: 'src/index.ts',
      line: 3,
      column: 7,
      code: 'TS2322',
      message: `Type 'string' is not assignable to type 'number'.`,
    };
    vi.doMock('../type-checker.js', () => ({
      typeCheck: vi.fn(() => [fakeError]),
    }));

    const dir = makeApp(HEALTHY_APP);

    // Default: a type error fails the deploy, same as real forge deploy's build.
    let caught: unknown;
    try {
      await deploy(sim, dir, { typeCheck: true });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(DeployError);
    expect((caught as DeployError).message).toContain('TS2322');
    expect((caught as DeployError).result.typeErrors).toEqual([fakeError]);

    // Opt-out returns the result with typeErrors attached.
    const result = await deploy(sim, dir, { typeCheck: true, throwOnError: false });
    expect(result.typeErrors).toEqual([fakeError]);
    // Deploy errors proper stay separate from type errors.
    expect(result.errors).toEqual([]);
  });

  it('typeCheck: true with a clean checker yields typeErrors: [] and no throw', async () => {
    vi.doMock('../type-checker.js', () => ({
      typeCheck: vi.fn(() => []),
    }));

    const dir = makeApp(HEALTHY_APP);

    const result = await deploy(sim, dir, { typeCheck: true });

    expect(result.typeErrors).toEqual([]);
    expect(result.errors).toEqual([]);
  });
});
