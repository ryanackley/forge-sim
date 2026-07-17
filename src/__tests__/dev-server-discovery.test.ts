// Eval paper cut: `forge-sim trigger …` targeted the background daemon even
// while `forge-sim dev` was running with the app deployed → "No manifest
// loaded". Fix: the dev server advertises itself via <stateDir>/dev.json and
// session CLI commands (simRequest) prefer a live dev server, hitting the
// same createApiHandler routes under the /__tools prefix.
//
// FORGE_SIM_STATE_DIR redirects the discovery files to a temp dir so these
// tests never touch a real ~/.forge-sim.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type Server } from 'node:http';
import { spawnSync } from 'node:child_process';

let stateDir: string;
let dc: typeof import('../daemon-client.js');
const servers: Server[] = [];

async function startFakeDevServer(): Promise<{ port: number; requests: string[] }> {
  const requests: string[] = [];
  const server = createServer((req, res) => {
    requests.push(`${req.method} ${req.url}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('failed to bind');
  return { port: address.port, requests };
}

/** A pid that is guaranteed dead: spawn a no-op process and wait for exit. */
function deadPid(): number {
  const child = spawnSync(process.execPath, ['-e', '']);
  if (typeof child.pid !== 'number') throw new Error('failed to spawn');
  return child.pid;
}

beforeAll(async () => {
  stateDir = mkdtempSync(join(tmpdir(), 'forge-sim-devdisc-'));
  process.env.FORGE_SIM_STATE_DIR = stateDir;
  delete process.env.FORGE_SIM_TARGET;
  vi.resetModules();
  dc = await import('../daemon-client.js');
});

afterAll(async () => {
  delete process.env.FORGE_SIM_STATE_DIR;
  rmSync(stateDir, { recursive: true, force: true });
  await Promise.all(servers.map((s) => new Promise<void>((resolve) => s.close(() => resolve()))));
});

describe('dev-server discovery (dev.json)', () => {
  it('writeDevServerFile + getDevServerStatus round-trips for a live server', async () => {
    const { port } = await startFakeDevServer();
    dc.writeDevServerFile({ port, pid: process.pid, appDir: '/tmp/my-app' });

    const status = await dc.getDevServerStatus();
    expect(status).not.toBeNull();
    expect(status!.running).toBe(true);
    expect(status!.port).toBe(port);
    expect(status!.pid).toBe(process.pid);
    expect(status!.appDir).toBe('/tmp/my-app');
  });

  it('removeDevServerFile only deletes the file when the pid matches', () => {
    const devFile = join(stateDir, 'dev.json');
    dc.writeDevServerFile({ port: 1234, pid: 424242, appDir: '/tmp/other-app' });

    // Our pid doesn't match — a newer dev server owns the file; leave it.
    dc.removeDevServerFile(process.pid);
    expect(existsSync(devFile)).toBe(true);
    expect(JSON.parse(readFileSync(devFile, 'utf-8')).pid).toBe(424242);

    // Matching pid — remove.
    dc.removeDevServerFile(424242);
    expect(existsSync(devFile)).toBe(false);
  });

  it('cleans up a stale dev.json left by a dead process', async () => {
    const devFile = join(stateDir, 'dev.json');
    dc.writeDevServerFile({ port: 65530, pid: deadPid(), appDir: '/tmp/dead-app' });

    const status = await dc.getDevServerStatus();
    expect(status).not.toBeNull();
    expect(status!.running).toBe(false);
    // Stale file removed so nothing keeps probing a ghost (B5 treatment).
    expect(existsSync(devFile)).toBe(false);
  });

  it('returns null for a corrupt dev.json', async () => {
    writeFileSync(join(stateDir, 'dev.json'), 'not json {');
    expect(await dc.getDevServerStatus()).toBeNull();
    rmSync(join(stateDir, 'dev.json'), { force: true });
  });

  it('simRequest prefers a live dev server via the /__tools prefix', async () => {
    const { port, requests } = await startFakeDevServer();
    dc.writeDevServerFile({ port, pid: process.pid, appDir: '/tmp/my-app' });

    const result = await dc.simRequest('/api/kvs', { method: 'GET' });
    expect(result).toEqual({ ok: true });
    // Health check + actual request, both under /__tools
    expect(requests).toContain('GET /__tools/api/health');
    expect(requests).toContain('GET /__tools/api/kvs');
    // Nothing hit a bare /api/* path (that's the daemon's shape)
    expect(requests.every((r) => r.includes('/__tools/'))).toBe(true);

    dc.removeDevServerFile(process.pid);
  });
});
