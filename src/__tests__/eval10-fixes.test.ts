/**
 * Eval-10 regression pins.
 *
 * F6: `forge-sim kvs list --prefix` sent ?prefix= but the shared API handler
 *     never read it — the flag was documented and silently ignored.
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

describe('eval-10 F6: /api/kvs honors ?prefix=', () => {
  const servers: Array<ReturnType<typeof createServer>> = [];

  afterAll(async () => {
    await Promise.all(
      servers.map(
        (server) =>
          new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
      ),
    );
  });

  it('filters keys by prefix', async () => {
    const { sim, server, url } = await startApiServer();
    servers.push(server);

    await sim.kvs.set('processed:1', { done: true });
    await sim.kvs.set('processed:2', { done: false });
    await sim.kvs.set('settings:theme', 'dark');

    const filtered = await (await fetch(`${url}/api/kvs?prefix=${encodeURIComponent('processed:')}`)).json();
    expect(filtered.map((e: any) => e.key).sort()).toEqual(['processed:1', 'processed:2']);

    // No prefix → everything.
    const all = await (await fetch(`${url}/api/kvs`)).json();
    expect(all).toHaveLength(3);

    // Prefix with no matches → empty list, not an error.
    const none = await (await fetch(`${url}/api/kvs?prefix=nope:`)).json();
    expect(none).toEqual([]);
  });
});
