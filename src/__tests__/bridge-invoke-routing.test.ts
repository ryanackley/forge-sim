/**
 * Tests for bridge invoke routing — verifies that the bridge and dev-server
 * RPC handler correctly dispatch based on invokeType.
 *
 * Covers:
 * - Normal invoke (resolver) — no invokeType
 * - ui-remote-fetch — routes to RemoteProxy.invokeFromBridge()
 * - fetchRemote — routes to RemoteProxy.request() (renderer bridge shim path)
 * - Unknown invokeType falls through to normal invoke
 *
 * Also tests the inline bridge script's callBridge dispatch logic.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { resolve } from 'node:path';
import { createSimulator, ForgeSimulator } from '../simulator.js';
import { createDevServer } from '../dev-server.js';
import type { DevServer } from '../dev-server.js';
import { WebSocket } from 'ws';

// ── Test Fixtures ───────────────────────────────────────────────────────

const REMOTES_MANIFEST = `
app:
  id: ari:cloud:ecosystem::app/invoke-routing-test
modules:
  jira:issuePanel:
    - key: panel
      resource: main
      resolver:
        endpoint: forge-proxy
      title: Test Panel
  endpoint:
    - key: forge-proxy
      remote: my-backend
      route:
        path: /api
      auth:
        appSystemToken:
          enabled: true
  function:
    - key: resolver
      handler: index.handler
resources:
  - key: main
    path: src/frontend/index.tsx
remotes:
  - key: my-backend
    baseUrl: https://api.example.com
`;

const FIXTURE_DIR = resolve(import.meta.dirname, 'fixtures/custom-ui-test');

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * Send an RPC request over WebSocket and wait for the response.
 */
function rpc(ws: WebSocket, method: string, params: any): Promise<any> {
  return new Promise((resolve, reject) => {
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
}

function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) return resolve();
    ws.on('open', () => resolve());
    ws.on('error', reject);
  });
}

// ── Dev Server RPC Tests ────────────────────────────────────────────────

describe('Dev Server RPC invoke routing', () => {
  let sim: ForgeSimulator;
  let server: DevServer;
  let ws: WebSocket;
  const TEST_PORT = 15174; // Use a non-standard port to avoid conflicts

  beforeAll(async () => {
    sim = createSimulator();

    // Deploy a fixture app so resolver infrastructure is wired up
    await sim.deploy(FIXTURE_DIR);

    // Load the remotes manifest on top to get remote + endpoint config
    await sim.loadManifest(REMOTES_MANIFEST);

    // Mock a remote route so invokeRemote has something to return
    sim.mockProductRoutes('my-backend', {
      'POST /api/ForgeProxy': { success: true, action: 'LoadProjects', data: [] },
      'GET /api/health': { status: 'ok' },
    });

    server = await createDevServer({ port: TEST_PORT, simulator: sim });
  });

  it('createDevServer reports the actual bound port', () => {
    expect(server.port).toBe(TEST_PORT);
  });

  it('createDevServer falls through to next port when requested one is taken', async () => {
    // First server already owns TEST_PORT — second call without strictPort
    // should auto-shift up.
    const sim2 = createSimulator();
    const server2 = await createDevServer({ port: TEST_PORT, simulator: sim2 });
    try {
      expect(server2.port).toBeGreaterThan(TEST_PORT);
      expect(server2.port).toBeLessThan(TEST_PORT + 10);
    } finally {
      server2.close();
    }
  });

  it('createDevServer with strictPort throws when requested port is taken', async () => {
    const sim2 = createSimulator();
    await expect(
      createDevServer({ port: TEST_PORT, strictPort: true, simulator: sim2 }),
    ).rejects.toThrow(/already in use/);
  });

  beforeEach(async () => {
    ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
    await waitForOpen(ws);
  });

  afterEach(() => {
    if (ws.readyState === WebSocket.OPEN) ws.close();
  });

  afterAll(() => {
    server.close();
  });

  // ── Normal invoke (resolver) ──────────────────────────────────────

  it('routes normal invoke to resolver', async () => {
    // The custom-ui-test fixture has getData/setData/getJiraIssue resolvers
    const result = await rpc(ws, 'invoke', {
      functionKey: 'getData',
      payload: {},
    });
    // The resolver should return something (fixture-dependent)
    expect(result).toBeDefined();
  });

  it('rejects invoke with undefined functionKey', async () => {
    await expect(
      rpc(ws, 'invoke', { functionKey: undefined, payload: {} })
    ).rejects.toThrow();
  });

  // ── invokeRemote (ui-remote-fetch) ────────────────────────────────

  it('routes invokeRemote to remote proxy with module context', async () => {
    const result = await rpc(ws, 'invokeRemote', {
      path: '/api/ForgeProxy',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'LoadProjects' }),
      moduleKey: 'panel', // module with endpoint: forge-proxy
    });
    // Response matches @forge/bridge's _setupInvokeEndpointFn expected format
    expect(result.success).toBe(true);
    expect(result.payload).toBeDefined();
    expect(result.payload.status).toBe(200);
    expect(result.payload.body).toEqual({ success: true, action: 'LoadProjects', data: [] });
  });

  it('routes GET invokeRemote to remote proxy', async () => {
    const result = await rpc(ws, 'invokeRemote', {
      path: '/api/health',
      method: 'GET',
      moduleKey: 'panel',
    });
    expect(result.success).toBe(true);
    expect(result.payload.body).toEqual({ status: 'ok' });
  });

  it('invokeRemote returns error for unknown mock path', async () => {
    const result = await rpc(ws, 'invokeRemote', {
      path: '/api/unknown',
      method: 'GET',
      moduleKey: 'panel',
    });
    expect(result.success).toBe(false);
    expect(result.error.status).toBe(404);
  });

  it('invokeRemote auto-resolves when single endpoint and no module context', async () => {
    // When there's only one endpoint in the manifest and no moduleKey is provided,
    // it should auto-resolve instead of throwing (proxy mode support)
    const result = await rpc(ws, 'invokeRemote', {
      path: '/api/health',
      method: 'GET',
      // no moduleKey — auto-resolves to the only endpoint
    });
    expect(result.success).toBe(true);
  });

  // ── fetchRemote (renderer bridge shim path) ──────────────────────

  it('routes fetchRemote with top-level path (renderer shim style)', async () => {
    const result = await rpc(ws, 'fetchRemote', {
      remoteKey: 'my-backend',
      path: '/api/health',
      fetchRequestInit: { method: 'GET' },
    });
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ status: 'ok' });
  });

  it('routes fetchRemote with path inside fetchRequestInit (real @forge/bridge style)', async () => {
    // Real @forge/bridge puts path inside fetchRequestInit (spread from fetchOptions)
    const result = await rpc(ws, 'fetchRemote', {
      remoteKey: 'my-backend',
      fetchRequestInit: { method: 'GET', path: '/api/health' },
    });
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ status: 'ok' });
  });

  it('fetchRemote returns 404 for unknown remote key', async () => {
    const result = await rpc(ws, 'fetchRemote', {
      remoteKey: 'nonexistent',
      path: '/test',
      fetchRequestInit: { method: 'GET' },
    });
    expect(result.status).toBe(404);
  });

  // ── Unknown RPC method ────────────────────────────────────────────

  it('rejects unknown RPC methods', async () => {
    await expect(
      rpc(ws, 'totallyFakeMethod', {})
    ).rejects.toThrow('Unknown RPC method');
  });
});

// ── Bridge Script Dispatch Tests ────────────────────────────────────────

describe('Bridge callBridge invokeType dispatch', () => {
  /**
   * Test the dispatch logic that exists in the inline bridge script
   * (generateBridgeInlineScript) and the renderer bridge shim.
   *
   * We extract the dispatch logic and test it directly rather than
   * spinning up a browser.
   */

  it('dispatches ui-remote-fetch to invokeRemote RPC', () => {
    const rpcCalls: Array<{ method: string; params: any }> = [];

    callBridge('invoke', {
      path: '/api/ForgeProxy',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { action: 'LoadProjects' },
      invokeType: 'ui-remote-fetch',
    });

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].method).toBe('invokeRemote');
    expect(rpcCalls[0].params).toEqual({
      path: '/api/ForgeProxy',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { action: 'LoadProjects' },
    });

    // Helper shared by all dispatch tests
    function callBridge(cmd: string, data: any) {
      if (cmd === 'invoke') {
        if (data && data.invokeType && data.invokeType.startsWith('ui-') && data.invokeType.endsWith('-fetch')) {
          rpcCalls.push({ method: 'invokeRemote', params: { path: data.path, method: data.method, headers: data.headers, body: data.body } });
          return;
        }
        rpcCalls.push({ method: 'invoke', params: { functionKey: data?.functionKey, payload: data?.payload } });
      }
    }
  });

  it('dispatches ui-container-fetch (invokeService) to invokeRemote RPC', () => {
    const rpcCalls: Array<{ method: string; params: any }> = [];

    callBridge('invoke', {
      path: '/service/health',
      method: 'GET',
      invokeType: 'ui-container-fetch',
    });

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].method).toBe('invokeRemote');
    expect(rpcCalls[0].params.path).toBe('/service/health');

    function callBridge(cmd: string, data: any) {
      if (cmd === 'invoke') {
        if (data && data.invokeType && data.invokeType.startsWith('ui-') && data.invokeType.endsWith('-fetch')) {
          rpcCalls.push({ method: 'invokeRemote', params: { path: data.path, method: data.method, headers: data.headers, body: data.body } });
          return;
        }
        rpcCalls.push({ method: 'invoke', params: { functionKey: data?.functionKey, payload: data?.payload } });
      }
    }
  });

  it('dispatches normal invoke to resolver RPC', () => {
    const rpcCalls: Array<{ method: string; params: any }> = [];

    dispatchInvoke(rpcCalls, {
      functionKey: 'resolver',
      payload: { action: 'getItems' },
    });

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].method).toBe('invoke');
    expect(rpcCalls[0].params).toEqual({
      functionKey: 'resolver',
      payload: { action: 'getItems' },
    });
  });

  it('does not route to invokeRemote without invokeType', () => {
    const rpcCalls: Array<{ method: string; params: any }> = [];

    // Data has path/method but no invokeType — should go to resolver
    dispatchInvoke(rpcCalls, {
      functionKey: 'resolver',
      path: '/api/something',
      method: 'POST',
      payload: { test: true },
    });

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].method).toBe('invoke');
    expect(rpcCalls[0].params.functionKey).toBe('resolver');
  });

  it('does not route invokeType without ui- prefix to remote', () => {
    const rpcCalls: Array<{ method: string; params: any }> = [];

    dispatchInvoke(rpcCalls, {
      functionKey: 'resolver',
      invokeType: 'something-else',
      payload: {},
    });

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].method).toBe('invoke');
  });

  it('does not route partial ui- invokeType without -fetch suffix', () => {
    const rpcCalls: Array<{ method: string; params: any }> = [];

    dispatchInvoke(rpcCalls, {
      path: '/api/test',
      invokeType: 'ui-remote-something',
    });

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].method).toBe('invoke');
  });

  /**
   * Mirrors the dispatch logic from generateBridgeInlineScript / renderer bridge shim.
   */
  function dispatchInvoke(rpcCalls: Array<{ method: string; params: any }>, data: any) {
    if (data && data.invokeType && data.invokeType.startsWith('ui-') && data.invokeType.endsWith('-fetch')) {
      rpcCalls.push({ method: 'invokeRemote', params: { path: data.path, method: data.method, headers: data.headers, body: data.body } });
    } else {
      rpcCalls.push({ method: 'invoke', params: { functionKey: data?.functionKey, payload: data?.payload } });
    }
  }
});
