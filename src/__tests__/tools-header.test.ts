/**
 * Tests for the Tools UI header data (eval 3.7).
 *
 * The /__tools/ header used to show "Unknown • N functions • 0 registered"
 * in dev mode:
 * - "Unknown" because `app.name` is optional in real Forge manifests and the
 *   fallback was a literal 'Unknown' instead of something useful.
 * - "0 registered" because dev mode registers handlers through `sim.resolver`
 *   (only the daemon's full deployer populates `sim.functions`), so counting
 *   `sim.functions` was always zero.
 *
 * Covers:
 * - appDisplayName(): manifest app.name wins; falls back to appDir basename;
 *   falls back to 'Forge App' with neither
 * - attachToolsToVite WS init: appName uses the display-name helper and
 *   functionCount comes from the injected getRegisteredFunctionCount getter
 */

import { afterAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { WebSocket } from 'ws';
import { createSimulator } from '../simulator.js';
import { parseManifestContent } from '../manifest.js';
import { appDisplayName, attachToolsToVite, type ToolsServer } from '../tools/server.js';

const NAMED_MANIFEST = `
app:
  id: ari:cloud:ecosystem::app/test
  name: sprint-pulse-named
modules:
  function:
    - key: handler
      handler: index.handler
`.trim();

// Realistic case: most manifests have no app.name — the display name lives
// in the developer console, not the manifest.
const NAMELESS_MANIFEST = `
app:
  id: ari:cloud:ecosystem::app/test
modules:
  function:
    - key: handler
      handler: index.handler
    - key: other
      handler: index.other
`.trim();

describe('appDisplayName', () => {
  it('prefers manifest app.name when present', () => {
    const manifest = parseManifestContent(NAMED_MANIFEST);
    expect(appDisplayName(manifest, '/tmp/some-dir')).toBe('sprint-pulse-named');
  });

  it('falls back to the app directory basename when app.name is missing', () => {
    const manifest = parseManifestContent(NAMELESS_MANIFEST);
    expect(appDisplayName(manifest, '/tmp/foo/sprint-pulse')).toBe('sprint-pulse');
    // Trailing slash still resolves to the directory name
    expect(appDisplayName(manifest, '/tmp/foo/sprint-pulse/')).toBe('sprint-pulse');
  });

  it("falls back to 'Forge App' with neither name nor appDir", () => {
    const manifest = parseManifestContent(NAMELESS_MANIFEST);
    expect(appDisplayName(manifest)).toBe('Forge App');
  });
});

describe('tools WS init header data', () => {
  const servers: Server[] = [];
  const toolsServers: ToolsServer[] = [];

  afterAll(async () => {
    for (const t of toolsServers) t.close();
    await Promise.all(
      servers.map((s) => new Promise<void>((resolve) => s.close(() => resolve())))
    );
  });

  async function startTools(opts: { getCount?: () => number; appDir?: string }) {
    const sim = createSimulator();
    const manifest = parseManifestContent(NAMELESS_MANIFEST);
    const httpServer = createServer();
    servers.push(httpServer);

    // Minimal stand-in for a ViteDevServer: attachToolsToVite only touches
    // `middlewares.stack` and `httpServer` upgrade events.
    const fakeVite = {
      middlewares: Object.assign((_req: any, _res: any, next: any) => next(), {
        stack: [] as any[],
        use: () => {},
      }),
      httpServer,
    } as any;

    const tools = attachToolsToVite({
      sim,
      manifest,
      viteServer: fakeVite,
      appDir: opts.appDir,
      getRegisteredFunctionCount: opts.getCount,
    });
    toolsServers.push(tools);

    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', () => resolve()));
    const address = httpServer.address();
    if (!address || typeof address === 'string') throw new Error('bind failed');
    return { port: address.port };
  }

  async function readInit(port: number): Promise<any> {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/__tools/ws`);
    try {
      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('no init message within 3s')), 3000);
        ws.on('message', (raw) => {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'init') {
            clearTimeout(timer);
            resolve(msg.data);
          }
        });
        ws.on('error', (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });
    } finally {
      ws.close();
    }
  }

  it('reports the live registered-function count from the getter, not sim.functions', async () => {
    // Simulates dev mode: sim.functions is empty (handlers registered via
    // sim.resolver), but the dev command tracks the loaded-function count.
    let count = 2;
    const { port } = await startTools({
      getCount: () => count,
      appDir: '/tmp/apps/sprint-pulse',
    });

    const init = await readInit(port);
    expect(init.manifest.appName).toBe('sprint-pulse');
    expect(init.manifest.functions).toBe(2);
    expect(init.functionCount).toBe(2);

    // Hot-redeploy shrinks the app — a fresh connection sees the new count.
    count = 1;
    const init2 = await readInit(port);
    expect(init2.functionCount).toBe(1);
  });

  it('falls back to sim.functions count when no getter is provided (daemon path)', async () => {
    const { port } = await startTools({ appDir: '/tmp/apps/sprint-pulse' });
    const init = await readInit(port);
    expect(init.functionCount).toBe(0);
  });
});
