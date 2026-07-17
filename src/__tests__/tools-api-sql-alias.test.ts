// Eval paper cut: "SQL is `api/sql/query`, `api/sql` 404s" — the shorter
// path is the obvious guess, so POST /api/sql now aliases /api/sql/query.
// These tests assert *routing only* (the request reaches the SQL handler,
// not the 404 fallback) via the handler's body validation — actually running
// a query would auto-start embedded MySQL, which is out of scope here.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { createSimulator, type ForgeSimulator } from '../simulator.js';
import { createApiHandler } from '../tools/api.js';

describe('tools api POST /api/sql alias', () => {
  let sim: ForgeSimulator;
  let server: ReturnType<typeof createServer>;
  let url = '';

  beforeAll(async () => {
    sim = createSimulator();
    const handler = createApiHandler(sim);
    server = createServer((req, res) => {
      const reqUrl = new URL(req.url ?? '/', 'http://localhost');
      void handler(req, res, reqUrl);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('failed to bind');
    url = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await sim.stop();
  });

  function post(path: string, body: any): Promise<Response> {
    return fetch(`${url}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('routes POST /api/sql to the same handler as /api/sql/query', async () => {
    // Empty body trips the handler's own validation on both paths — proving
    // the alias reaches the SQL handler (a 404 would mean it fell through).
    const alias = await post('/api/sql', {});
    const canonical = await post('/api/sql/query', {});

    expect(alias.status).toBe(400);
    expect(canonical.status).toBe(400);
    const [aliasBody, canonicalBody] = await Promise.all([alias.json(), canonical.json()]) as any[];
    expect(aliasBody.error).toMatch(/no query/i);
    expect(aliasBody).toEqual(canonicalBody);
  });

  it('does not hijack GET /api/sql (POST-only alias)', async () => {
    const res = await fetch(`${url}/api/sql`);
    expect(res.status).toBe(404);
  });
});
