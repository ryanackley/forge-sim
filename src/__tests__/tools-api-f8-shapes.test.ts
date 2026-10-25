/**
 * Tools HTTP API request shapes (adversarial 1019 F8).
 *
 * The HTTP API and the MCP tools grew different field names for the same
 * operations — `key` vs `triggerKey`, `{queue, body}` vs `{queueKey, events}` —
 * so anything scripted against one surface got a bare "Missing …" 400 from the
 * other. Unified on ONE vocabulary: the MCP tool names (`triggerKey`,
 * `queueKey`, `events`) are canonical on both surfaces — `events` also mirrors
 * the real @forge/events push(event | event[]) — and the Tools UI + CLI send
 * them. The pre-unification HTTP names stay accepted as legacy aliases so
 * older scripts and version-skewed daemon/CLI pairs keep working. Also pinned
 * here: `PUT /api/kvs/:key` without a `value` wrapper is a 400 naming the
 * expected shape, not a 500 from deep inside the store.
 *
 * (The webtrigger pair is pinned in eval6-cli-webtrigger.test.ts, which
 * already owns that endpoint.)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import { createSimulator, ForgeSimulator } from '../simulator.js';
import { createApiHandler } from '../tools/api.js';

const MANIFEST = `
modules:
  scheduledTrigger:
    - key: tick
      function: tick-fn
      interval: hour
  consumer:
    - key: worker
      queue: jobs
      function: job-fn
  function:
    - key: tick-fn
      handler: index.tick
    - key: job-fn
      handler: index.job
app:
  runtime:
    name: nodejs22.x
  id: ari:cloud:ecosystem::app/tools-api-f8
`;

describe('Tools HTTP API — F8 request shapes', () => {
  let sim: ForgeSimulator;
  let server: ReturnType<typeof createServer>;
  let url: string;
  let ticks = 0;
  const jobBodies: any[] = [];

  beforeAll(async () => {
    sim = createSimulator();
    await sim.loadManifest(MANIFEST);
    sim.registerFunction('tick-fn', async () => { ticks++; }, 'scheduledTrigger');
    sim.registerConsumer('jobs', async (event: any) => { jobBodies.push(event.body); });

    const handler = createApiHandler(sim);
    server = createServer((req, res) => {
      const u = new URL(req.url ?? '/', 'http://localhost');
      void handler(req, res, u);
    });
    await new Promise<void>((res) => server.listen(0, '127.0.0.1', () => res()));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('bind failed');
    url = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((res, rej) => server.close((e) => (e ? rej(e) : res())));
    await sim.stop();
  });

  async function post(path: string, body: any) {
    const res = await fetch(`${url}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  }

  // ── /api/scheduled-trigger ────────────────────────────────────────────

  it('scheduled-trigger accepts the canonical name (triggerKey, same as MCP)', async () => {
    const before = ticks;
    const { status, body } = await post('/api/scheduled-trigger', { triggerKey: 'tick' });
    expect(status).toBe(200);
    expect(body.statusCode).toBe(204);
    expect(ticks).toBe(before + 1);
  });

  it('scheduled-trigger accepts the legacy alias (key)', async () => {
    const before = ticks;
    const { status, body } = await post('/api/scheduled-trigger', { key: 'tick' });
    expect(status).toBe(200);
    expect(body.statusCode).toBe(204);
    expect(ticks).toBe(before + 1);
  });

  it('scheduled-trigger with neither name is a 400 naming both', async () => {
    const { status, body } = await post('/api/scheduled-trigger', { trigger: 'tick' });
    expect(status).toBe(400);
    expect(body.error).toContain('Missing triggerKey');
    expect(body.error).toContain('"key"');
  });

  // ── /api/queue/push ───────────────────────────────────────────────────

  it('queue/push accepts the canonical shape ({queueKey, events}, same as MCP and @forge/events)', async () => {
    const { status, body } = await post('/api/queue/push', {
      queueKey: 'jobs',
      events: [{ body: { n: 2 } }, { body: { n: 3 } }],
    });
    expect(status).toBe(200);
    expect(typeof body.jobId).toBe('string');
    expect(jobBodies).toContainEqual({ n: 2 });
    expect(jobBodies).toContainEqual({ n: 3 });
  });

  it('queue/push accepts the legacy single-event shape ({queue, body})', async () => {
    const { status, body } = await post('/api/queue/push', { queue: 'jobs', body: { n: 1 } });
    expect(status).toBe(200);
    expect(typeof body.jobId).toBe('string');
    expect(jobBodies).toContainEqual({ n: 1 });
  });

  it('queue/push with no queue key is a 400 naming both shapes', async () => {
    const { status, body } = await post('/api/queue/push', { body: { n: 4 } });
    expect(status).toBe(400);
    expect(body.error).toContain('Missing queueKey');
    expect(body.error).toContain('"queue"');
  });

  // ── PUT /api/kvs/:key ─────────────────────────────────────────────────

  it('kvs PUT stores body.value and round-trips', async () => {
    const put = await fetch(`${url}/api/kvs/greeting`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: { hello: 'world' } }),
    });
    expect(put.status).toBe(200);
    expect(await sim.kvs.get('greeting')).toEqual({ hello: 'world' });
  });

  it('kvs PUT without a value wrapper is a 400 with the expected shape, not a 500', async () => {
    const put = await fetch(`${url}/api/kvs/raw`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hello: 'world' }), // raw body, no {value: …}
    });
    expect(put.status).toBe(400);
    const body = await put.json();
    expect(body.error).toContain('"value"');
    expect(await sim.kvs.get('raw')).toBeUndefined();
  });

  it('kvs PUT of an unstorable value (null) is a 400, not a 500', async () => {
    const put = await fetch(`${url}/api/kvs/nullish`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: null }),
    });
    expect(put.status).toBe(400);
    expect((await put.json()).error).toContain('INVALID_VALUE');
  });
});
