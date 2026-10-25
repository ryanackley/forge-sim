/**
 * Dev-server getContext — extension.type must describe the REQUESTED module.
 *
 * Regression (adversarial 1019 F6): the startup context is built once for the
 * PRIMARY (first detected) module, and the moduleKey branch of
 * buildBaseModuleContext reused its extension wholesale. In a multi-module
 * app every non-primary module then rendered with the primary module's
 * extension.type — a jira:globalPage showed `extension.type === 'macro'` in
 * the browser, and app code branching on module type took the wrong branch.
 * Headless render and MCP were unaffected (they build per-module contexts),
 * so the bug was a dev-mode-only parity split.
 *
 * The rest of the extension (hydrated issue/content, stored macro config) is
 * deliberately shared across modules in dev mode; only `type` is per-module.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createSimulator, ForgeSimulator } from '../simulator.js';
import { createDevServer } from '../dev-server.js';
import type { DevServer } from '../dev-server.js';
import { buildDefaultContext } from '../context.js';
import { WebSocket } from 'ws';

const MANIFEST = `
modules:
  macro:
    - key: standup-macro
      title: Standup Board
      resource: board
      render: native
      resolver:
        function: resolver
  jira:globalPage:
    - key: standup-page
      title: Standup Report
      resource: board
      render: native
      resolver:
        function: resolver
  function:
    - key: resolver
      handler: index.handler
resources:
  - key: board
    path: src/frontend.tsx
app:
  runtime:
    name: nodejs22.x
  id: ari:cloud:ecosystem::app/module-context-test
  name: Module Context Test
`;

describe('Dev-server getContext — per-module extension.type', () => {
  const TEST_PORT = 15191;
  let sim: ForgeSimulator;
  let server: DevServer;
  let ws: WebSocket;

  const rpc = (method: string, params: any = {}): Promise<any> =>
    new Promise((resolve, reject) => {
      const requestId = `test-${Date.now()}-${Math.random()}`;
      const timeout = setTimeout(() => reject(new Error(`RPC timeout: ${method}`)), 5000);
      const handler = (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.requestId === requestId) {
            ws.off('message', handler);
            clearTimeout(timeout);
            if (msg.error) reject(new Error(msg.error));
            else resolve(msg.result);
          }
        } catch {}
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({ type: 'rpc', requestId, method, params }));
    });

  beforeAll(async () => {
    sim = createSimulator();
    await sim.loadManifest(MANIFEST);
    // Mirror dev-command: the startup context is built for the PRIMARY
    // module — here the macro, like the adversarial App 2.
    server = await createDevServer({
      port: TEST_PORT,
      simulator: sim,
      context: buildDefaultContext('standup-macro', 'macro', undefined),
    });
  });

  beforeEach(async () => {
    ws = new WebSocket(`ws://localhost:${server.port}`);
    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', reject);
    });
  });

  afterEach(() => {
    if (ws.readyState === WebSocket.OPEN) ws.close();
  });

  afterAll(async () => {
    server.close();
    await sim.stop();
  });

  it('a non-primary module gets ITS type, not the primary module\'s', async () => {
    const ctx = await rpc('getContext', { moduleKey: 'standup-page' });
    expect(ctx.moduleKey).toBe('standup-page');
    expect(ctx.extension.type).toBe('jira:globalPage');
  });

  it('the primary module still gets its own type', async () => {
    const ctx = await rpc('getContext', { moduleKey: 'standup-macro' });
    expect(ctx.moduleKey).toBe('standup-macro');
    expect(ctx.extension.type).toBe('macro');
  });

  it('an unknown moduleKey keeps the startup extension untouched', async () => {
    const ctx = await rpc('getContext', { moduleKey: 'not-in-manifest' });
    expect(ctx.moduleKey).toBe('not-in-manifest');
    expect(ctx.extension.type).toBe('macro');
  });
});
