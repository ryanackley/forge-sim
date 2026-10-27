/**
 * Loopback-origin policy (src/local-origin.ts).
 *
 * Every forge-sim listener binds 127.0.0.1, which keeps other machines out
 * but not a page open in the developer's browser: its requests arrive from
 * loopback too. The tools API, the daemon API and the bridge WebSocket run
 * app code and SQL/KVS writes with no auth, so they accept a browser request
 * only when its Origin is a loopback host (any port) and refuse every other
 * Origin before a handler runs. Non-browser clients send no Origin and pass.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WebSocket } from 'ws';
import { isLocalOrigin, applyLocalOriginPolicy, FOREIGN_ORIGIN_MESSAGE } from '../local-origin.js';
import { createApiHandler } from '../tools/api.js';
import { createSimulator, type ForgeSimulator } from '../simulator.js';
import { createDevServer, type DevServer } from '../dev-server.js';

const SRC = (file: string) => readFileSync(resolve(import.meta.dirname, '..', file), 'utf8');

describe('isLocalOrigin', () => {
  it.each([
    [undefined, true],
    ['', true],
    ['http://localhost:5173', true],
    ['http://127.0.0.1:5173', true],
    ['https://localhost', true],
    ['http://[::1]:5173', true],
    ['http://evil-origin.invalid', false],
    ['http://rebind.invalid:5173', false],
    ['http://localhost.evil.invalid:5173', false],
    ['http://127.0.0.1.nip.io', false],
    ['null', false],
    ['not a url', false],
  ])('%s → %s', (origin, expected) => {
    expect(isLocalOrigin(origin)).toBe(expected);
  });
});

describe('HTTP surfaces (daemon-shaped server over createApiHandler)', () => {
  let sim: ForgeSimulator;
  let server: Server;
  let base: string;

  beforeAll(async () => {
    sim = createSimulator();
    const handler = createApiHandler(sim);
    server = createServer((req, res) => {
      if (!applyLocalOriginPolicy(req, res)) return;
      void handler(req, res, new URL(req.url ?? '/', 'http://localhost'));
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('bind failed');
    base = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
  });

  it('a foreign Origin gets 403 before the handler runs (preflight and request alike)', async () => {
    const preflight = await fetch(`${base}/api/deploy`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://evil-origin.invalid', 'Access-Control-Request-Method': 'POST' },
    });
    expect(preflight.status).toBe(403);
    expect(preflight.headers.get('access-control-allow-origin')).toBeNull();

    const post = await fetch(`${base}/api/deploy`, {
      method: 'POST',
      headers: { Origin: 'http://evil-origin.invalid', 'content-type': 'application/json' },
      body: JSON.stringify({ appDir: '/nowhere' }),
    });
    expect(post.status).toBe(403);
    const body = await post.json();
    expect(body.error).toBe(FOREIGN_ORIGIN_MESSAGE);
    expect(body.origin).toBe('http://evil-origin.invalid');
    expect(sim.getManifest()).toBeNull(); // the deploy handler never ran
  });

  it('a loopback Origin on another port is answered, with that origin reflected (never *)', async () => {
    const preflight = await fetch(`${base}/api/health`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'GET' },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(preflight.headers.get('vary')).toBe('Origin');

    const res = await fetch(`${base}/api/health`, { headers: { Origin: 'http://127.0.0.1:5173' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:5173');
    expect((await res.json()).status).toBe('ok');
  });

  it('no Origin (curl, the CLI, MCP clients) passes with no CORS headers at all', async () => {
    const res = await fetch(`${base}/api/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('bridge WebSocket (createDevServer)', () => {
  let sim: ForgeSimulator;
  let server: DevServer;

  beforeAll(async () => {
    sim = createSimulator();
    // A fixed port, like the sibling dev-server tests: the server reports the
    // port it was asked for, so an OS-assigned 0 would be unreachable.
    server = await createDevServer({ port: 15188, simulator: sim });
  });

  afterAll(() => {
    server.close();
  });

  function connect(origin?: string): Promise<'open' | { status: number }> {
    return new Promise((res) => {
      const ws = new WebSocket(`ws://127.0.0.1:${server.port}`, origin ? { origin } : {});
      ws.on('open', () => { ws.close(); res('open'); });
      ws.on('unexpected-response', (_req, r) => { res({ status: r.statusCode ?? 0 }); ws.terminate(); });
      ws.on('error', () => { /* reported through unexpected-response */ });
    });
  }

  it('refuses the handshake from a foreign Origin', async () => {
    const r = await connect('http://evil-origin.invalid');
    expect(r).not.toBe('open');
    expect((r as { status: number }).status).toBe(401);
  });

  it('accepts the dev page on localhost and 127.0.0.1 (another port) and clients with no Origin', async () => {
    expect(await connect('http://localhost:5173')).toBe('open');
    expect(await connect('http://127.0.0.1:5173')).toBe('open');
    expect(await connect()).toBe('open');
  });
});

describe('every browser-reachable surface applies the policy (source pins)', () => {
  it('the daemon, the tools middleware and proxy-mode dev all go through applyLocalOriginPolicy', () => {
    expect(SRC('daemon.ts')).toContain('applyLocalOriginPolicy(req, res)');
    expect(SRC('tools/server.ts')).toContain('applyLocalOriginPolicy(req, res)');
    expect(SRC('dev-command.ts')).toContain('applyLocalOriginPolicy(req, res)');
  });

  it('both tools WebSocket attach points and the bridge WebSocket check the Origin', () => {
    expect(SRC('tools/server.ts')).toContain('allowLocalUpgrade(request, socket)');
    expect(SRC('dev-command.ts')).toContain('allowLocalUpgrade(req, socket)');
    expect(SRC('dev-server.ts')).toMatch(/verifyClient: .*isLocalOrigin\(origin\)/);
  });

  it('no API surface answers Access-Control-Allow-Origin: * (the JWKS document is the one public exception)', () => {
    for (const file of ['daemon.ts', 'tools/server.ts', 'tools/api.ts', 'dev-server.ts', 'proxy-server.ts']) {
      expect(SRC(file)).not.toContain("'Access-Control-Allow-Origin', '*'");
    }
    const devCommand = SRC('dev-command.ts');
    const wildcardLines = devCommand.split('\n').filter((l) => l.includes("'Access-Control-Allow-Origin', '*'"));
    expect(wildcardLines).toHaveLength(2); // the two /__forge/jwks.json routes
    for (const line of wildcardLines) {
      const idx = devCommand.indexOf(line);
      expect(devCommand.slice(idx - 200, idx)).toContain('/__forge/jwks.json');
    }
  });
});
