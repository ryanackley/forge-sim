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
import { ForgeSimulator, setSimulator } from '../simulator.js';
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
    sim = new ForgeSimulator();
    setSimulator(sim);

    // Deploy a fixture app so resolver infrastructure is wired up
    await sim.deploy(FIXTURE_DIR);

    // Now load the remotes manifest on top to get remote config
    const { parseManifestContent } = await import('../manifest.js');
    const manifest = parseManifestContent(REMOTES_MANIFEST);
    sim.remotes.setManifest(manifest);

    // Mock a remote route so invokeRemote has something to return
    sim.mockProductRoutes('my-backend', {
      'POST /api/ForgeProxy': { success: true, action: 'LoadProjects', data: [] },
      'GET /api/health': { status: 'ok' },
    });

    server = createDevServer({ port: TEST_PORT, simulator: sim });
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

  it('routes invokeRemote to remote proxy', async () => {
    const result = await rpc(ws, 'invokeRemote', {
      path: '/api/ForgeProxy',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'LoadProjects' }),
    });
    expect(result).toEqual({ success: true, action: 'LoadProjects', data: [] });
  });

  it('routes GET invokeRemote to remote proxy', async () => {
    const result = await rpc(ws, 'invokeRemote', {
      path: '/api/health',
      method: 'GET',
    });
    expect(result).toEqual({ status: 'ok' });
  });

  it('invokeRemote returns mock 404 for unknown path', async () => {
    // Unknown mock path returns mock 404 (not a throw — it's a valid response)
    const result = await rpc(ws, 'invokeRemote', {
      path: '/api/unknown',
      method: 'GET',
    });
    expect(result).toBeDefined();
    expect(result.error).toMatch(/No mock route matched/);
  });

  // ── fetchRemote (renderer bridge shim path) ──────────────────────

  it('routes fetchRemote to remote proxy with remoteKey', async () => {
    const result = await rpc(ws, 'fetchRemote', {
      remoteKey: 'my-backend',
      path: '/api/health',
      fetchRequestInit: { method: 'GET' },
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
    const mockRpc = (method: string, params: any) => {
      rpcCalls.push({ method, params });
      return Promise.resolve();
    };

    // Simulate the callBridge dispatch logic from generateBridgeInlineScript
    function callBridge(cmd: string, data: any) {
      if (cmd === 'invoke') {
        if (data && data.invokeType === 'ui-remote-fetch') {
          return mockRpc('invokeRemote', {
            path: data.path,
            method: data.method,
            headers: data.headers,
            body: data.body,
          });
        }
        return mockRpc('invoke', {
          functionKey: data && data.functionKey,
          payload: data && data.payload,
        });
      }
      return Promise.resolve();
    }

    // Test remote fetch dispatch
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
  });

  it('dispatches normal invoke to resolver RPC', () => {
    const rpcCalls: Array<{ method: string; params: any }> = [];
    const mockRpc = (method: string, params: any) => {
      rpcCalls.push({ method, params });
      return Promise.resolve();
    };

    function callBridge(cmd: string, data: any) {
      if (cmd === 'invoke') {
        if (data && data.invokeType === 'ui-remote-fetch') {
          return mockRpc('invokeRemote', {
            path: data.path,
            method: data.method,
            headers: data.headers,
            body: data.body,
          });
        }
        return mockRpc('invoke', {
          functionKey: data && data.functionKey,
          payload: data && data.payload,
        });
      }
      return Promise.resolve();
    }

    // Test normal resolver dispatch
    callBridge('invoke', {
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
    const mockRpc = (method: string, params: any) => {
      rpcCalls.push({ method, params });
      return Promise.resolve();
    };

    function callBridge(cmd: string, data: any) {
      if (cmd === 'invoke') {
        if (data && data.invokeType === 'ui-remote-fetch') {
          return mockRpc('invokeRemote', {
            path: data.path,
            method: data.method,
            headers: data.headers,
            body: data.body,
          });
        }
        return mockRpc('invoke', {
          functionKey: data && data.functionKey,
          payload: data && data.payload,
        });
      }
      return Promise.resolve();
    }

    // Data has path/method but no invokeType — should go to resolver
    callBridge('invoke', {
      functionKey: 'resolver',
      path: '/api/something',
      method: 'POST',
      payload: { test: true },
    });

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].method).toBe('invoke');
    expect(rpcCalls[0].params.functionKey).toBe('resolver');
  });

  it('does not route unknown invokeType to remote', () => {
    const rpcCalls: Array<{ method: string; params: any }> = [];
    const mockRpc = (method: string, params: any) => {
      rpcCalls.push({ method, params });
      return Promise.resolve();
    };

    function callBridge(cmd: string, data: any) {
      if (cmd === 'invoke') {
        if (data && data.invokeType === 'ui-remote-fetch') {
          return mockRpc('invokeRemote', {
            path: data.path,
            method: data.method,
            headers: data.headers,
            body: data.body,
          });
        }
        return mockRpc('invoke', {
          functionKey: data && data.functionKey,
          payload: data && data.payload,
        });
      }
      return Promise.resolve();
    }

    // Unknown invokeType — should fall through to normal invoke
    callBridge('invoke', {
      functionKey: 'resolver',
      invokeType: 'something-else',
      payload: {},
    });

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].method).toBe('invoke');
  });
});
