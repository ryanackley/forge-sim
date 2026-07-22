/**
 * Macro config round-trip through the browser dev server (viewSubmit → stored
 * config → resolveModuleContext read-back).
 *
 * Regression (confluence-survey, 2026-07-21): a custom-config sub-module macro
 * calls `view.submit({ config: {...} })` — the top-level `config` KEY is the
 * documented Forge wrapper, and the macro's config VALUE is the inner object
 * (that's what useConfig() / context.extension.config returns). The dev server
 * used to store the whole payload, so the app read back `{ config: {...} }`
 * instead of the fields, i.e. `config.question` / `config.options` were
 * undefined and the macro rendered "not configured".
 *
 * The in-process API (simulator-ui.ts setMacroConfig) stores the config FLAT,
 * so this is a parity fix: the dev server must land on the same stored shape.
 *
 * Two submit shapes, one stored shape:
 *   1. Custom-config sub-module ("<base>--config") → app sends the `config`
 *      wrapper → dev server unwraps payload.config.
 *   2. Inline config (flat key, platform Save button) → the shell harvests flat
 *      named fields and submits them directly → no wrapper, stored as-is.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createSimulator, ForgeSimulator } from '../simulator.js';
import { createDevServer } from '../dev-server.js';
import type { DevServer } from '../dev-server.js';
import { buildDefaultContext } from '../context.js';
import { WebSocket } from 'ws';

const CTX_ECHO_DIR = new URL('./fixtures/ctx-echo', import.meta.url).pathname;
const INLINE_DIR = new URL('./fixtures/macro-inline-config', import.meta.url).pathname;

function makeRpc(getWs: () => WebSocket) {
  return function rpc(method: string, params: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const ws = getWs();
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
  };
}

// ── Custom-config sub-module: the `config` wrapper must be unwrapped ─────

describe('Dev-server macro config round-trip — custom-config sub-module', () => {
  const TEST_PORT = 15188;
  let sim: ForgeSimulator;
  let server: DevServer;
  let ws: WebSocket;
  const rpc = makeRpc(() => ws);

  beforeAll(async () => {
    sim = createSimulator();
    await sim.deploy(CTX_ECHO_DIR);
    // Production always seeds a startup context (dev-command.ts builds
    // moduleContext via buildDefaultContext and passes it). The macro-config
    // read-back injection lives on that context branch, so mirror it here.
    server = await createDevServer({
      port: TEST_PORT,
      simulator: sim,
      context: buildDefaultContext('survey', 'macro', undefined),
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

  it('unwraps view.submit({ config }) so context.extension.config holds the fields', async () => {
    const submitted = { question: 'Which feature next?', options: ['A', 'B', 'C'] };
    await rpc('viewSubmit', {
      moduleKey: 'survey--config',
      submitTree: 'macroConfig',
      payload: { config: submitted },
    });

    // The app reads context.extension.config from the VIEW sub-module.
    const ctx = await rpc('getContext', { moduleKey: 'survey--view' });
    // The stored value is the inner object — NOT the { config: {...} } wrapper.
    expect(ctx.extension.config).toEqual(submitted);
    expect(ctx.extension.config.question).toBe('Which feature next?');
    expect(ctx.extension.config.options).toEqual(['A', 'B', 'C']);
    // And it is not double-nested.
    expect(ctx.extension.config.config).toBeUndefined();
  });

  it('a payload with no config key stores an empty object (defensive)', async () => {
    await rpc('viewSubmit', {
      moduleKey: 'blank--config',
      submitTree: 'macroConfig',
      payload: {},
    });
    const ctx = await rpc('getContext', { moduleKey: 'blank--view' });
    expect(ctx.extension.config).toEqual({});
  });
});

// ── Inline config: flat payload must be stored as-is (no unwrap) ─────────

describe('Dev-server macro config round-trip — inline config', () => {
  const TEST_PORT = 15189;
  let sim: ForgeSimulator;
  let server: DevServer;
  let ws: WebSocket;
  const rpc = makeRpc(() => ws);

  beforeAll(async () => {
    sim = createSimulator();
    await sim.deploy(INLINE_DIR);
    server = await createDevServer({
      port: TEST_PORT,
      simulator: sim,
      context: buildDefaultContext('pet-card', 'macro', undefined),
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

  it('stores the harvested flat field map directly (no config wrapper to unwrap)', async () => {
    // The platform Save button submits the flat named-field values (see
    // ForgeSimShell.handleConfigSave). pet-card is an inline-config macro
    // (config: true) so the flat key + macroConfig tree route here.
    const flat = { petName: 'Rex', species: 'dog' };
    await rpc('viewSubmit', {
      moduleKey: 'pet-card',
      submitTree: 'macroConfig',
      payload: flat,
    });

    const ctx = await rpc('getContext', { moduleKey: 'pet-card' });
    expect(ctx.extension.config).toEqual(flat);
    // Crucially, a stray top-level "config" field would be wrong here — inline
    // payloads are already the config, not a wrapper.
    expect(ctx.extension.config.config).toBeUndefined();
  });
});
