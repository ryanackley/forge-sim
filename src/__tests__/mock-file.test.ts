/**
 * Eval-6 F8 — `.forge-sim/mocks.json` file-based mocks for dev mode.
 *
 * Dev mode structurally had no pre-deploy mock window: deploy-time scheduled
 * triggers fired during boot before any `/__tools/` panel or CLI mock could
 * exist. `applyMockFile()` closes that gap — dev-command calls it before the
 * initial deploy, and `watchMockFile()` hot-reloads it on save.
 *
 * These tests pin the loader itself (parse → sim.mockProductRoutes /
 * sim.mockGraphQL) plus merge-on-reapply semantics (eval-6 F2: mock calls
 * always merge). The dev-command wiring is a thin call site; the watcher is
 * exercised for the create-after-boot path with a real fs.watch.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSimulator, type ForgeSimulator } from '../simulator.js';
import { applyMockFile, describeMockSummary, watchMockFile, MOCK_FILE_DIR, MOCK_FILE_NAME } from '../mock-file.js';

describe('applyMockFile', () => {
  let appDir: string;
  let sim: ForgeSimulator;

  beforeEach(() => {
    appDir = mkdtempSync(join(tmpdir(), 'forge-sim-mockfile-'));
    sim = createSimulator();
  });

  afterEach(() => {
    rmSync(appDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  function writeMockFile(content: any) {
    const dir = join(appDir, MOCK_FILE_DIR);
    mkdirSync(dir, { recursive: true });
    const raw = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    writeFileSync(join(dir, MOCK_FILE_NAME), raw);
  }

  it('returns null when the file does not exist (the common case)', () => {
    expect(applyMockFile(sim, appDir)).toBeNull();
  });

  it('applies product routes — bare bodies become 200 responses', async () => {
    writeMockFile({
      jira: { 'GET /rest/api/3/myself': { accountId: 'abc-123' } },
    });

    const summary = applyMockFile(sim, appDir);
    expect(summary).toEqual({ products: { jira: 1 }, graphqlOperations: 0 });

    const resp = await sim.productApi.request('jira', '/rest/api/3/myself');
    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual({ accountId: 'abc-123' });
  });

  it('honors the tagged __forgeSimMockResponse shape (status + body)', async () => {
    writeMockFile({
      jira: {
        'PUT /rest/api/3/issue/FAIL-1': {
          __forgeSimMockResponse: true,
          status: 500,
          body: { error: 'rate limited' },
        },
      },
    });

    applyMockFile(sim, appDir);

    const resp = await sim.productApi.request('jira', '/rest/api/3/issue/FAIL-1', { method: 'PUT' });
    expect(resp.status).toBe(500);
    expect(await resp.json()).toEqual({ error: 'rate limited' });
  });

  it('the reserved "graphql" key registers operation mocks', async () => {
    writeMockFile({
      graphql: { GetIssue: { data: { issue: { key: 'TEST-1' } } } },
    });

    const summary = applyMockFile(sim, appDir);
    expect(summary).toEqual({ products: {}, graphqlOperations: 1 });

    const resp = await sim.productApi.requestGraph('query GetIssue { issue { key } }');
    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual({ data: { issue: { key: 'TEST-1' } } });
  });

  it('counts multiple products and graphql together', () => {
    writeMockFile({
      jira: { 'GET /a': {}, 'GET /b': {} },
      confluence: { 'GET /c': {} },
      graphql: { Op1: { data: {} }, Op2: { data: {} } },
    });

    const summary = applyMockFile(sim, appDir);
    expect(summary).toEqual({
      products: { jira: 2, confluence: 1 },
      graphqlOperations: 2,
    });
  });

  it('re-apply MERGES into existing routes (eval-6 F2 semantics)', async () => {
    writeMockFile({ jira: { 'GET /rest/api/3/myself': { accountId: 'first' } } });
    applyMockFile(sim, appDir);

    // Second file version: edits the existing route AND adds a new one.
    writeMockFile({
      jira: {
        'GET /rest/api/3/myself': { accountId: 'second' },
        'GET /rest/api/3/serverInfo': { version: '9' },
      },
    });
    applyMockFile(sim, appDir);

    const myself = await sim.productApi.request('jira', '/rest/api/3/myself');
    expect(await myself.json()).toEqual({ accountId: 'second' });
    const info = await sim.productApi.request('jira', '/rest/api/3/serverInfo');
    expect(await info.json()).toEqual({ version: '9' });
  });

  it('file mocks apply before deploy do not clobber later programmatic mocks (merge both ways)', async () => {
    writeMockFile({ jira: { 'GET /rest/api/3/myself': { accountId: 'from-file' } } });
    applyMockFile(sim, appDir);

    sim.mockProductRoutes('jira', { 'GET /rest/api/3/serverInfo': { version: '10' } });

    const myself = await sim.productApi.request('jira', '/rest/api/3/myself');
    expect(await myself.json()).toEqual({ accountId: 'from-file' });
    const info = await sim.productApi.request('jira', '/rest/api/3/serverInfo');
    expect(await info.json()).toEqual({ version: '10' });
  });

  it('throws a friendly error on malformed JSON', () => {
    writeMockFile('{ "jira": { oops');
    expect(() => applyMockFile(sim, appDir)).toThrowError(/mocks\.json is not valid JSON/);
  });

  it('throws on a non-object top level (array)', () => {
    writeMockFile([{ jira: {} }]);
    expect(() => applyMockFile(sim, appDir)).toThrowError(/must be an object mapping product names/);
  });

  it('throws on a non-object product value, naming the key', () => {
    writeMockFile({ jira: 'not-a-route-map' });
    expect(() => applyMockFile(sim, appDir)).toThrowError(/value for "jira" must be an object/);
  });
});

describe('describeMockSummary', () => {
  it('formats products and graphql', () => {
    expect(describeMockSummary({ products: { jira: 3, confluence: 1 }, graphqlOperations: 2 }))
      .toBe('3 jira + 1 confluence routes, 2 GraphQL ops');
  });

  it('singularizes', () => {
    expect(describeMockSummary({ products: { jira: 1 }, graphqlOperations: 1 }))
      .toBe('1 jira route, 1 GraphQL op');
  });

  it('handles empty', () => {
    expect(describeMockSummary({ products: {}, graphqlOperations: 0 })).toBe('no routes');
  });
});

describe('watchMockFile', () => {
  let appDir: string;
  let sim: ForgeSimulator;
  let stop: (() => void) | null = null;

  beforeEach(() => {
    appDir = mkdtempSync(join(tmpdir(), 'forge-sim-mockwatch-'));
    sim = createSimulator();
  });

  afterEach(() => {
    stop?.();
    stop = null;
    rmSync(appDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it('creates .forge-sim so the watch can attach, and picks up a file created AFTER boot', async () => {
    const logs: string[] = [];
    stop = watchMockFile(sim, appDir, (m) => logs.push(m));

    // No file yet — write one after the watcher is armed (debounce is 300ms).
    const dir = join(appDir, MOCK_FILE_DIR);
    writeFileSync(join(dir, MOCK_FILE_NAME), JSON.stringify({
      jira: { 'GET /rest/api/3/myself': { accountId: 'late' } },
    }));

    await expect.poll(async () => {
      const resp = await sim.productApi.request('jira', '/rest/api/3/myself');
      return resp.status;
    }, { timeout: 5000, interval: 100 }).toBe(200);

    expect(logs.some((l) => l.includes('Reloaded'))).toBe(true);
  });

  it('keeps previous mocks and warns when the file goes malformed mid-edit', async () => {
    const dir = join(appDir, MOCK_FILE_DIR);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, MOCK_FILE_NAME), JSON.stringify({
      jira: { 'GET /rest/api/3/myself': { accountId: 'good' } },
    }));
    applyMockFile(sim, appDir);

    const logs: string[] = [];
    stop = watchMockFile(sim, appDir, (m) => logs.push(m));

    writeFileSync(join(dir, MOCK_FILE_NAME), '{ "jira": { half-saved');

    await expect.poll(() => logs.some((l) => l.includes('not valid JSON')), {
      timeout: 5000, interval: 100,
    }).toBe(true);

    // Previous mocks survive.
    const resp = await sim.productApi.request('jira', '/rest/api/3/myself');
    expect(await resp.json()).toEqual({ accountId: 'good' });
  });
});
