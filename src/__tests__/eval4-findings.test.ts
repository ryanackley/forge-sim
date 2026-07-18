/**
 * Regression tests for the eval-4 findings cluster (adversarial cold-install
 * eval against the published 0.1.3 package, 2026-07-16).
 *
 * F2 — deploy-time validation of function references. A trigger/consumer/
 *      scheduled trigger/web trigger pointing at an undeclared function used
 *      to deploy with `errors: []`; firing the event was a silent no-op.
 *      Real Forge lint rejects that manifest — inverted parity violation.
 * F3 — v1 @forge/events consumer shape (`resolver: { function, method }`)
 *      used to parse to a consumer with no functionKey → silent event sink.
 *      The shape is deprecated-but-documented; we now support it (parity)
 *      with a deprecation warning.
 * F4 — entity query on an undeclared index silently returned { results: [] },
 *      making a typo'd index name indistinguishable from "no data". Real
 *      Forge rejects it. Also: docs-blessed string-shorthand indexes
 *      (`indexes: - surname`) must parse, or the new throw breaks valid apps.
 * F5 — a throwing consumer was invisible outside getEventLog(): no console
 *      output, and getStats() had no per-outcome counts.
 * F6 — the objectStore shim requires `modules.objectStore` in the manifest,
 *      but the parser warned "Unknown module type" for it — a catch-22.
 * F9 — the MCP llm_mock tool reported "queue depth" as total call history
 *      (+1), an ever-growing number unrelated to remaining mocks.
 * F10 — deploy summary omitted scheduledTrigger modules entirely.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSimulator, ForgeSimulator } from '../simulator.js';
import { deploy } from '../deployer.js';
import { parseManifestContent } from '../manifest.js';
import { UnifiedKVS } from '../kvs.js';

// ── Temp app helper ─────────────────────────────────────────────────────

const tempDirs: string[] = [];

function makeApp(files: Record<string, string>): string {
  const dir = join(tmpdir(), `forge-sim-eval4-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
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
  id: ari:cloud:ecosystem::app/eval4-test
  name: Eval4 Test
  runtime:
    name: nodejs22.x
`;

// ── F2: function reference validation ───────────────────────────────────

describe('F2: deploy-time function reference validation', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    vi.resetModules();
    sim = createSimulator();
  });

  it('reports errors for triggers/consumers/scheduled/web triggers referencing undeclared functions', async () => {
    // This is the exact eval probe: a trigger → missing function deployed
    // with errors: [] and the fired event vanished.
    const dir = makeApp({
      'src/index.js': `export const run = async () => ({ statusCode: 204 });\n`,
      'manifest.yml': `
modules:
  trigger:
    - key: on-issue
      function: missing-trigger-fn
      events:
        - avi:jira:created:issue
  consumer:
    - key: my-consumer
      queue: my-queue
      function: missing-consumer-fn
  scheduledTrigger:
    - key: daily
      function: missing-scheduled-fn
      interval: day
  webtrigger:
    - key: hook
      function: missing-web-fn
  function:
    - key: real-fn
      handler: index.run
${APP_FOOTER}`,
    });

    // Deliberately broken manifest — opt out of the throw-by-default
    // behavior (eval-6 F3) so we can inspect result.errors directly.
    const result = await deploy(sim, dir, { throwOnError: false });

    expect(result.errors.length).toBeGreaterThanOrEqual(4);
    const text = result.errors.map((e) => e.error).join('\n');
    expect(text).toContain('missing-trigger-fn');
    expect(text).toContain('missing-consumer-fn');
    expect(text).toContain('missing-scheduled-fn');
    expect(text).toContain('missing-web-fn');
    // Each error signposts what IS declared
    expect(text).toContain('Declared functions: real-fn');
    // And explains the parity stance
    expect(text).toContain('Real Forge lint rejects this manifest');
  });

  it('does not flag modules whose function references are valid', async () => {
    const dir = makeApp({
      'src/index.js': [
        `export const onIssue = async (event, context) => {};`,
        `export const consume = async (event, context) => {};`,
      ].join('\n'),
      'manifest.yml': `
modules:
  trigger:
    - key: on-issue
      function: trigger-fn
      events:
        - avi:jira:created:issue
  consumer:
    - key: my-consumer
      queue: my-queue
      function: consumer-fn
  function:
    - key: trigger-fn
      handler: index.onIssue
    - key: consumer-fn
      handler: index.consume
${APP_FOOTER}`,
    });

    const result = await deploy(sim, dir);
    expect(result.errors).toHaveLength(0);
  });
});

// ── F3: v1 consumer shape (resolver: { function, method }) ──────────────

describe('F3: @forge/events 1.x consumer shape', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    vi.resetModules();
    sim = createSimulator();
  });

  const V1_HANDLER = `
import Resolver from '@forge/resolver';
import { storage } from '@forge/api';

const resolver = new Resolver();

resolver.define('processEvent', async ({ payload, context }) => {
  await storage.set('v1-received', {
    payload,
    hasJobId: typeof context?.jobId === 'string',
  });
});

export const handler = resolver.getDefinitions();
`;

  const V1_MANIFEST = `
modules:
  consumer:
    - key: v1-consumer
      queue: v1-queue
      resolver:
        function: consumer-fn
        method: processEvent
  function:
    - key: consumer-fn
      handler: index.handler
${APP_FOOTER}`;

  it('parses the v1 shape with a deprecation warning', async () => {
    const manifest = parseManifestContent(V1_MANIFEST);

    expect(manifest.consumers).toEqual([
      { key: 'v1-consumer', queue: 'v1-queue', functionKey: 'consumer-fn', resolverMethod: 'processEvent' },
    ]);
    const warning = manifest.warnings.find((w) => /deprecated @forge\/events 1\.x shape/.test(w.message));
    expect(warning, 'expected a deprecation warning for the v1 consumer shape').toBeDefined();
    expect(warning!.level).toBe('warning');
  });

  it('delivers queue events to the named resolver method with the resolver convention', async () => {
    // The eval probe: pushed events to a v1 consumer, handler never ran,
    // no error anywhere — a silent event sink.
    const dir = makeApp({
      'src/index.js': V1_HANDLER,
      'manifest.yml': V1_MANIFEST,
    });

    const result = await deploy(sim, dir);
    expect(result.errors).toHaveLength(0);

    await sim.queue.push('v1-queue', { body: { hello: 'world', n: 42 } });

    const received = await sim.kvs.get('v1-received');
    expect(received, 'v1 consumer method should have run').toBeDefined();
    // payload IS the event body (resolver convention), jobId rides on context
    expect(received.payload).toEqual({ hello: 'world', n: 42 });
    expect(received.hasJobId).toBe(true);
  });

  it('reports a deploy error when the named method does not exist', async () => {
    const dir = makeApp({
      'src/index.js': V1_HANDLER,
      'manifest.yml': `
modules:
  consumer:
    - key: v1-consumer
      queue: v1-queue
      resolver:
        function: consumer-fn
        method: typoMethod
  function:
    - key: consumer-fn
      handler: index.handler
${APP_FOOTER}`,
    });

    // Broken on purpose — opt out of throw-by-default (eval-6 F3).
    const result = await deploy(sim, dir, { throwOnError: false });

    const err = result.errors.find((e) => /typoMethod/.test(e.error));
    expect(err, 'expected a deploy error for the missing resolver method').toBeDefined();
    // Signposts what IS available
    expect(err!.error).toContain('processEvent');
  });
});

// ── F4: entity query on undeclared index + string-shorthand indexes ─────

describe('F4: entity index parity', () => {
  let kvs: UnifiedKVS;

  beforeEach(() => {
    kvs = new UnifiedKVS();
  });

  it('throws INDEX_NOT_FOUND when querying an undeclared index', async () => {
    kvs.registerEntitySchema('Task', {
      attributes: { title: { type: 'string' }, priority: { type: 'integer' } },
      indexes: [{ name: 'by-priority', partition: [], range: 'priority' }],
    });
    await kvs.entity('Task').set('t1', { title: 'A', priority: 1 });

    // The eval probe: .index('by-priorty') (typo) returned { results: [] }
    // — indistinguishable from "no data".
    await expect(
      kvs.entity('Task').query().index('by-priorty').getMany()
    ).rejects.toThrow(/INDEX_NOT_FOUND/);
    await expect(
      kvs.entity('Task').query().index('by-priorty').getMany()
    ).rejects.toThrow(/Declared indexes: by-priority/);
  });

  it('does not throw for schema-less entities (back-compat test setups)', async () => {
    await kvs.entity('Loose').set('x', { a: 1 });
    const { results } = await kvs.entity('Loose').query().index('anything').getMany();
    expect(results).toEqual([{ key: 'x', value: { a: 1 } }]);
  });

  it('parses string-shorthand indexes from the manifest (docs: `indexes: - surname`)', () => {
    const manifest = parseManifestContent(`
modules:
  jira:issuePanel:
    - key: panel
      title: Panel
      resource: main
      render: native
resources:
  - key: main
    path: src/main.tsx
app:
  id: ari:cloud:ecosystem::app/eval4-test
  name: Eval4 Test
  runtime:
    name: nodejs22.x
  storage:
    entities:
      - name: employee
        attributes:
          surname:
            type: string
          age:
            type: integer
        indexes:
          - surname
          - name: by-age
            range:
              - age
`);

    const employee = manifest.entities.get('employee');
    expect(employee).toBeDefined();
    expect(employee!.indexes).toEqual([
      { name: 'surname', partition: [], range: 'surname' },
      { name: 'by-age', partition: [], range: 'age' },
    ]);
    // No error-level warnings for the shorthand shape
    const indexErrors = manifest.warnings.filter(
      (w) => w.level === 'error' && /indexes\[/.test(w.message)
    );
    expect(indexErrors).toEqual([]);
  });

  it('warns when a string-shorthand index names an undeclared attribute', () => {
    const manifest = parseManifestContent(`
app:
  id: ari:cloud:ecosystem::app/eval4-test
  name: Eval4 Test
  runtime:
    name: nodejs22.x
  storage:
    entities:
      - name: employee
        attributes:
          surname:
            type: string
        indexes:
          - nosuchattr
`);
    const warning = manifest.warnings.find(
      (w) => w.level === 'warning' && /nosuchattr/.test(w.message)
    );
    expect(warning).toBeDefined();
  });

  it('string-shorthand indexes are queryable end-to-end', async () => {
    kvs.registerEntitySchema('employee', {
      attributes: { surname: { type: 'string' } },
      indexes: [{ name: 'surname', partition: [], range: 'surname' }],
    });
    await kvs.entity('employee').set('e1', { surname: 'Zeta' });
    await kvs.entity('employee').set('e2', { surname: 'Alpha' });

    const { results } = await kvs.entity('employee').query().index('surname').getMany();
    expect(results.map((r) => r.value.surname)).toEqual(['Alpha', 'Zeta']);
  });
});

// ── F5: consumer failure visibility ─────────────────────────────────────

describe('F5: consumer failure visibility', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    sim = createSimulator();
  });

  it('logs a console.error when a consumer throws', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      sim.queue.registerConsumer('boom-queue', async () => {
        throw new Error('kaboom');
      });
      await sim.queue.push('boom-queue', { body: { x: 1 } });

      const line = spy.mock.calls.map((c) => c.join(' ')).find((l) => /boom-queue/.test(l));
      expect(line, 'expected a console.error naming the failing queue').toBeDefined();
      expect(line).toContain('kaboom');
    } finally {
      spy.mockRestore();
    }
  });

  it('getStats() exposes per-outcome succeeded/failed counts', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      let calls = 0;
      sim.queue.registerConsumer('mixed-queue', async () => {
        calls++;
        if (calls === 2) throw new Error('second one fails');
      });
      await sim.queue.push('mixed-queue', [{ body: { n: 1 } }, { body: { n: 2 } }, { body: { n: 3 } }]);

      const stats = sim.queue.getStats();
      expect(stats['mixed-queue']).toMatchObject({
        events: 3,
        succeeded: 2,
        failed: 1,
      });
    } finally {
      spy.mockRestore();
    }
  });
});

// ── F7: entity inspection in the dev tools ──────────────────────────────

describe('F7: /__tools/api/entities exposes entity data', () => {
  it('returns registered schemas and stored entities (not the old stub message)', async () => {
    const { createServer } = await import('node:http');
    const { createApiHandler } = await import('../tools/api.js');

    const sim = createSimulator();
    sim.kvs.registerEntitySchema('Task', {
      attributes: { title: { type: 'string' } },
      indexes: [{ name: 'title', partition: [], range: 'title' }],
    });
    await sim.kvs.entity('Task').set('t1', { title: 'Ship 0.1.4' });

    const handler = createApiHandler(sim, null);
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      void handler(req, res, url);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('bind failed');

    try {
      const res = await fetch(`http://127.0.0.1:${address.port}/api/entities`);
      const body = await res.json();

      // Real data, not the "Use KVS panel" stub
      expect(body.message).toBeUndefined();
      expect(body.schemas.Task).toMatchObject({
        attributes: { title: { type: 'string' } },
      });
      expect(body.entities.Task).toEqual([
        { key: 't1', value: { title: 'Ship 0.1.4' } },
      ]);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      );
    }
  });
});

// ── F6: objectStore module type ─────────────────────────────────────────

describe('F6: objectStore is a known module type', () => {
  it('does not warn "Unknown module type" for modules.objectStore', () => {
    // The catch-22: the @forge/object-store shim REQUIRES the module to be
    // declared, but the parser warned about it — following the runtime
    // error's advice produced a new warning.
    const manifest = parseManifestContent(`
modules:
  objectStore:
    - key: main-store
${APP_FOOTER}`);

    const unknownWarning = manifest.warnings.find((w) =>
      /Unknown module type 'objectStore'/.test(w.message)
    );
    expect(unknownWarning).toBeUndefined();
  });
});

// ── F10: scheduled triggers in the deploy summary ───────────────────────

describe('F10: deploy summary includes scheduledTriggers', () => {
  it('lists scheduled trigger modules with key/function/interval', async () => {
    // Deploy fires scheduled triggers, but the summary never mentioned
    // them — triggers/consumers/webTriggers were all listed, scheduled
    // triggers were invisible.
    const sim = createSimulator();
    const dir = makeApp({
      'src/index.js': `export const digest = async () => ({ statusCode: 204 });\n`,
      'manifest.yml': `
modules:
  scheduledTrigger:
    - key: daily-digest
      function: digest-fn
      interval: day
  function:
    - key: digest-fn
      handler: index.digest
${APP_FOOTER}`,
    });

    const result = await deploy(sim, dir);
    expect(result.errors).toEqual([]);
    expect(result.scheduledTriggers).toEqual([
      { key: 'daily-digest', function: 'digest-fn', interval: 'day' },
    ]);
  });
});

// ── F9: LLM mock queue depth ────────────────────────────────────────────

describe('F9: llm mock queue depth reports remaining mocks', () => {
  it('getPendingMockCount tracks unconsumed mocks, not call history', async () => {
    // The MCP llm_mock tool used to report getHistory().length + 1 as
    // "queue depth" — total calls ever made, an ever-growing number that
    // has nothing to do with how many mocks are left.
    const { SimulatedLLM } = await import('../llm.js');
    const llm = new SimulatedLLM();

    llm.mockResponse({ content: 'first' });
    llm.mockResponse({ content: 'second' });
    expect(llm.getPendingMockCount()).toBe(2);

    await llm.chat({ model: 'claude-3-5-sonnet', messages: [{ role: 'user', content: 'hi' }] });
    expect(llm.getPendingMockCount()).toBe(1);

    await llm.chat({ model: 'claude-3-5-sonnet', messages: [{ role: 'user', content: 'again' }] });
    expect(llm.getPendingMockCount()).toBe(0);

    // History keeps growing — the two numbers must diverge
    expect(llm.getHistory()).toHaveLength(2);
  });
});
