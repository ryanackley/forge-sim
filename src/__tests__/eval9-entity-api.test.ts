/**
 * Eval-9 E9-6: per-row Custom Entity endpoints backing `forge-sim entity`.
 *
 * Custom Entities live in their own store — `forge-sim kvs list` can never
 * show them, and until this the daemon exposed only a read-all
 * `/api/entities`. The CLI needs get/set/delete per row, and writes must go
 * through the schema-validated entity path so a typo'd entity name or a
 * schema-violating value surfaces as an error instead of silent
 * local-only data.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { createSimulator, type ForgeSimulator } from '../simulator.js';
import { createApiHandler } from '../tools/api.js';

async function startApiServer(): Promise<{
  sim: ForgeSimulator;
  server: ReturnType<typeof createServer>;
  url: string;
}> {
  const sim = createSimulator();
  const handler = createApiHandler(sim, null);

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    void handler(req, res, url);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Failed to bind test server');

  return { sim, server, url: `http://127.0.0.1:${address.port}` };
}

const TASK_SCHEMA = {
  attributes: {
    title: { type: 'string' },
    status: { type: 'string' },
    priority: { type: 'integer' },
  },
  indexes: [{ name: 'by-status', partition: ['status'], range: ['priority'] }],
} as any;

describe('per-row entity endpoints (E9-6)', () => {
  const servers: Array<ReturnType<typeof createServer>> = [];

  afterAll(async () => {
    await Promise.all(
      servers.map(
        (server) =>
          new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
      ),
    );
  });

  it('PUT / GET / DELETE round-trip a row through the schema-validated path', async () => {
    const { sim, server, url } = await startApiServer();
    servers.push(server);
    sim.kvs.registerEntitySchema('Task', TASK_SCHEMA);

    const put = await fetch(`${url}/api/entities/Task/t1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: { title: 'Ship 0.1.9', status: 'open', priority: 1 } }),
    });
    expect(put.status).toBe(200);
    expect(await put.json()).toMatchObject({ success: true, entityName: 'Task', key: 't1' });

    const get = await fetch(`${url}/api/entities/Task/t1`);
    expect(get.status).toBe(200);
    expect((await get.json()).value).toEqual({ title: 'Ship 0.1.9', status: 'open', priority: 1 });

    // The row is visible to the list endpoint the CLI's `entity list` uses.
    const list = await (await fetch(`${url}/api/entities`)).json();
    expect(list.entities.Task).toEqual([
      { key: 't1', value: { title: 'Ship 0.1.9', status: 'open', priority: 1 } },
    ]);

    const del = await fetch(`${url}/api/entities/Task/t1`, { method: 'DELETE' });
    expect(del.status).toBe(200);
    const gone = await fetch(`${url}/api/entities/Task/t1`);
    expect(gone.status).toBe(404);
  });

  it('rejects writes to undeclared entities with ENTITY_NOT_FOUND', async () => {
    const { sim, server, url } = await startApiServer();
    servers.push(server);
    sim.kvs.registerEntitySchema('Task', TASK_SCHEMA);

    const res = await fetch(`${url}/api/entities/Tsak/t1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: { title: 'typo', status: 'open', priority: 1 } }),
    });
    expect(res.ok).toBe(false);
    expect((await res.json()).error).toMatch(/ENTITY_NOT_FOUND/);
  });

  it('rejects schema-violating values instead of storing them', async () => {
    const { sim, server, url } = await startApiServer();
    servers.push(server);
    sim.kvs.registerEntitySchema('Task', TASK_SCHEMA);

    const res = await fetch(`${url}/api/entities/Task/t1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: { title: 'bad', status: 'open', priority: 'not-a-number' } }),
    });
    expect(res.ok).toBe(false);

    const get = await fetch(`${url}/api/entities/Task/t1`);
    expect(get.status).toBe(404);
  });

  it('rejects malformed paths with a usage hint', async () => {
    const { server, url } = await startApiServer();
    servers.push(server);

    const res = await fetch(`${url}/api/entities/OnlyName`, { method: 'PUT' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/<entityName>\/<key>/);
  });
});
