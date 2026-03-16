/**
 * Tests for Forge Remotes support.
 *
 * Covers:
 * - Manifest parsing: remotes with operations/auth, endpoints, resolver.endpoint on UI modules
 * - Mock remote routes: mock-first via mockProductRoutes (same API as product APIs)
 * - invokeRemote from @forge/api: mock response, unknown remote error
 * - invokeRemote from @forge/bridge: endpoint resolution
 * - requestRemote from @forge/bridge: direct fetch with FIT
 * - FIT generation: valid JWT, correct claims, correct signing
 * - FIT key persistence and reload
 * - RemoteProxy integration with simulator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ForgeSimulator } from '../simulator.js';
import { setSimulator } from '../shims/globals.js';
import { parseManifestContent } from '../manifest.js';
import * as forgeApi from '../shims/forge-api.js';
import * as forgeBridge from '../shims/forge-bridge.js';
import { FITProvider } from '../fit-provider.js';
import { RemoteProxy } from '../remote-proxy.js';
import { decodeJwt, decodeProtectedHeader } from 'jose';

// ── Test Fixtures ───────────────────────────────────────────────────────

const BASIC_MANIFEST = `
app:
  id: ari:cloud:ecosystem::app/test-remotes
modules:
  jira:issuePanel:
    - key: main
      resource: main
      resolver:
        function: resolver
      title: Test Panel
  function:
    - key: resolver
      handler: index.handler
resources:
  - key: main
    path: src/frontend/index.tsx
remotes:
  - key: my-backend
    baseUrl: https://api.example.com
  - key: analytics
    baseUrl: https://analytics.example.com
`;

const FULL_MANIFEST = `
app:
  id: ari:cloud:ecosystem::app/full-remotes-test
modules:
  jira:issuePanel:
    - key: panel
      resource: main
      resolver:
        endpoint: my-endpoint
      title: Remote Panel
  endpoint:
    - key: my-endpoint
      remote: my-backend
      route:
        path: /api/v1
      auth:
        appSystemToken:
          enabled: true
    - key: analytics-endpoint
      remote: analytics
  function:
    - key: resolver
      handler: index.handler
resources:
  - key: main
    path: src/frontend/index.tsx
remotes:
  - key: my-backend
    baseUrl: https://api.example.com
    operations:
      - storage
      - compute
    auth:
      appSystemToken:
        enabled: true
      appUserToken:
        enabled: false
  - key: analytics
    baseUrl: https://analytics.example.com
    operations:
      - fetch
`;

// ── Manifest Parsing ────────────────────────────────────────────────────

describe('manifest parsing — remotes', () => {
  it('parses basic remotes with key and baseUrl', () => {
    const manifest = parseManifestContent(BASIC_MANIFEST);
    expect(manifest.remotes.size).toBe(2);
    expect(manifest.remotes.get('my-backend')?.baseUrl).toBe('https://api.example.com');
    expect(manifest.remotes.get('analytics')?.baseUrl).toBe('https://analytics.example.com');
  });

  it('parses remotes with operations and auth', () => {
    const manifest = parseManifestContent(FULL_MANIFEST);
    const backend = manifest.remotes.get('my-backend')!;
    expect(backend.operations).toEqual(['storage', 'compute']);
    expect(backend.auth?.appSystemToken?.enabled).toBe(true);
    expect(backend.auth?.appUserToken?.enabled).toBe(false);

    const analytics = manifest.remotes.get('analytics')!;
    expect(analytics.operations).toEqual(['fetch']);
    expect(analytics.auth).toBeUndefined();
  });

  it('parses endpoints from manifest', () => {
    const manifest = parseManifestContent(FULL_MANIFEST);
    expect(manifest.endpoints.size).toBe(2);

    const ep = manifest.endpoints.get('my-endpoint')!;
    expect(ep.remote).toBe('my-backend');
    expect(ep.route?.path).toBe('/api/v1');
    expect(ep.auth?.appSystemToken?.enabled).toBe(true);

    const analyticsEp = manifest.endpoints.get('analytics-endpoint')!;
    expect(analyticsEp.remote).toBe('analytics');
    expect(analyticsEp.route).toBeUndefined();
  });

  it('parses resolver.endpoint on UI modules', () => {
    const manifest = parseManifestContent(FULL_MANIFEST);
    const panel = manifest.uiModules.find(m => m.key === 'panel')!;
    expect(panel.endpointKey).toBe('my-endpoint');
    expect(panel.resolverFunctionKey).toBeUndefined();
  });

  it('still parses resolver.function on UI modules', () => {
    const manifest = parseManifestContent(BASIC_MANIFEST);
    const main = manifest.uiModules.find(m => m.key === 'main')!;
    expect(main.resolverFunctionKey).toBe('resolver');
    expect(main.endpointKey).toBeUndefined();
  });

  it('returns empty endpoints map when no endpoints defined', () => {
    const manifest = parseManifestContent(BASIC_MANIFEST);
    expect(manifest.endpoints.size).toBe(0);
  });
});

// ── FITProvider ─────────────────────────────────────────────────────────

describe('FITProvider', () => {
  let fit: FITProvider;

  beforeEach(async () => {
    fit = new FITProvider();
    await fit.initInMemory();
  });

  it('generates a valid JWT', async () => {
    const token = await fit.sign({
      aud: 'ari:cloud:ecosystem::app/test',
      context: {
        cloudId: 'test-cloud',
        siteUrl: 'https://test.atlassian.net',
        moduleKey: 'test-module',
      },
    });

    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('JWT has correct claims', async () => {
    const token = await fit.sign({
      aud: 'ari:cloud:ecosystem::app/test',
      context: {
        cloudId: 'test-cloud',
        siteUrl: 'https://test.atlassian.net',
      },
    });

    const payload = decodeJwt(token);
    expect(payload.iss).toBe('forge-sim');
    expect(payload.aud).toBe('ari:cloud:ecosystem::app/test');
    expect(payload.context).toEqual({
      cloudId: 'test-cloud',
      siteUrl: 'https://test.atlassian.net',
    });
    expect(payload.iat).toBeDefined();
    expect(payload.exp).toBeDefined();
  });

  it('JWT has correct header', async () => {
    const token = await fit.sign({ aud: 'test' });
    const header = decodeProtectedHeader(token);
    expect(header.alg).toBe('RS256');
    expect(header.kid).toBe('forge-sim-1');
  });

  it('embeds appSystemToken when provided', async () => {
    const token = await fit.sign({
      aud: 'test',
      appSystemToken: 'system-token-123',
    });
    const payload = decodeJwt(token);
    expect(payload.appSystemToken).toBe('system-token-123');
  });

  it('embeds appUserToken when provided', async () => {
    const token = await fit.sign({
      aud: 'test',
      appUserToken: 'user-token-456',
    });
    const payload = decodeJwt(token);
    expect(payload.appUserToken).toBe('user-token-456');
  });

  it('omits token fields when not provided', async () => {
    const token = await fit.sign({ aud: 'test' });
    const payload = decodeJwt(token);
    expect(payload.appSystemToken).toBeUndefined();
    expect(payload.appUserToken).toBeUndefined();
  });

  it('returns JWKS with public key', () => {
    const jwks = fit.getJWKS();
    expect(jwks.keys).toHaveLength(1);
    expect(jwks.keys[0].kid).toBe('forge-sim-1');
    expect(jwks.keys[0].alg).toBe('RS256');
    expect(jwks.keys[0].use).toBe('sig');
    expect(jwks.keys[0].kty).toBe('RSA');
    expect(jwks.keys[0].n).toBeDefined(); // RSA modulus
    expect(jwks.keys[0].e).toBeDefined(); // RSA exponent
  });

  it('returns empty JWKS when not initialized', () => {
    const uninit = new FITProvider();
    expect(uninit.getJWKS()).toEqual({ keys: [] });
  });

  it('throws when signing without initialization', async () => {
    const uninit = new FITProvider();
    await expect(uninit.sign({ aud: 'test' })).rejects.toThrow('not initialized');
  });
});

// ── Mock Remote Routes ──────────────────────────────────────────────────

describe('mock remote routes', () => {
  let sim: ForgeSimulator;

  beforeEach(async () => {
    sim = new ForgeSimulator();
    setSimulator(sim);
    await sim.loadManifest(FULL_MANIFEST);
    await sim.fit.initInMemory();
  });

  it('uses mockProductRoutes for remote mocking', async () => {
    sim.mockProductRoutes('my-backend', {
      'GET /tasks': [{ id: 1, name: 'Write docs' }],
    });

    const response = await sim.remotes.invoke('my-backend', { path: '/tasks' });
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toEqual([{ id: 1, name: 'Write docs' }]);
  });

  it('supports POST routes with function handlers', async () => {
    sim.mockProductRoutes('my-backend', {
      'POST /tasks': (_path: string, options?: any) => ({
        id: 2,
        name: JSON.parse(options?.body ?? '{}').name,
      }),
    });

    const response = await sim.remotes.invoke('my-backend', {
      path: '/tasks',
      method: 'POST',
      body: JSON.stringify({ name: 'New task' }),
    });
    const data = await response.json();
    expect(data.name).toBe('New task');
  });

  it('returns error for unknown remote', async () => {
    const response = await sim.remotes.invoke('nonexistent', { path: '/test' });
    expect(response.ok).toBe(false);
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toContain('Unknown remote');
  });

  it('supports multiple remotes independently', async () => {
    sim.mockProductRoutes('my-backend', {
      'GET /status': { service: 'backend', healthy: true },
    });
    sim.mockProductRoutes('analytics', {
      'GET /status': { service: 'analytics', healthy: true },
    });

    const backendResp = await sim.remotes.invoke('my-backend', { path: '/status' });
    expect((await backendResp.json()).service).toBe('backend');

    const analyticsResp = await sim.remotes.invoke('analytics', { path: '/status' });
    expect((await analyticsResp.json()).service).toBe('analytics');
  });
});

// ── invokeRemote from @forge/api ────────────────────────────────────────

describe('invokeRemote from @forge/api', () => {
  let sim: ForgeSimulator;

  beforeEach(async () => {
    sim = new ForgeSimulator();
    setSimulator(sim);
    await sim.loadManifest(FULL_MANIFEST);
    await sim.fit.initInMemory();
  });

  it('proxies to mock routes via product API system', async () => {
    sim.mockProductRoutes('my-backend', {
      'GET /api/health': { status: 'ok' },
    });

    const response = await forgeApi.invokeRemote('my-backend', { path: '/api/health' });
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.status).toBe('ok');
  });

  it('passes method and body through', async () => {
    sim.mockProductRoutes('my-backend', {
      'PUT /api/config': (_path: string, opts?: any) => ({
        updated: true,
        body: JSON.parse(opts?.body ?? '{}'),
      }),
    });

    const response = await forgeApi.invokeRemote('my-backend', {
      path: '/api/config',
      method: 'PUT',
      body: JSON.stringify({ theme: 'dark' }),
    });
    const data = await response.json();
    expect(data.updated).toBe(true);
    expect(data.body.theme).toBe('dark');
  });
});

// ── invokeRemote from @forge/bridge ─────────────────────────────────────

describe('invokeRemote from @forge/bridge', () => {
  let sim: ForgeSimulator;

  beforeEach(async () => {
    sim = new ForgeSimulator();
    setSimulator(sim);
    await sim.loadManifest(FULL_MANIFEST);
    await sim.fit.initInMemory();
    // Set active module so bridge shim can resolve endpoint
    sim.currentModuleKey = 'panel';
  });

  it('resolves endpoint to remote and returns response envelope', async () => {
    sim.mockProductRoutes('my-backend', {
      'GET /api/v1/items': [{ id: 1 }, { id: 2 }],
    });

    // Bridge invokeRemote uses endpoint resolution from active module
    // Response is unwrapped: { status, statusText, headers, body }
    const response = await forgeBridge.invokeRemote({ path: '/items' });
    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('fails when active module has no endpoint', async () => {
    // Load basic manifest where the module has resolver.function, not endpoint
    await sim.loadManifest(BASIC_MANIFEST);
    sim.currentModuleKey = 'main';

    await expect(
      forgeBridge.invokeRemote({ path: '/test' })
    ).rejects.toThrow(/has no endpoint configured/);
  });

  it('fails when no active module is set and no endpoint key provided', async () => {
    sim.currentModuleKey = undefined;

    await expect(
      forgeBridge.invokeRemote({ path: '/test' })
    ).rejects.toThrow(/requires an endpoint key/);
  });
});

// ── requestRemote from @forge/bridge ────────────────────────────────────

describe('requestRemote from @forge/bridge', () => {
  let sim: ForgeSimulator;

  beforeEach(async () => {
    sim = new ForgeSimulator();
    setSimulator(sim);
    await sim.loadManifest(FULL_MANIFEST);
    await sim.fit.initInMemory();
  });

  it('returns Response-like object from mock', async () => {
    sim.mockProductRoutes('analytics', {
      'GET /events': [{ event: 'page_view' }],
    });

    const response = await forgeBridge.requestRemote('analytics', { path: '/events' });
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toEqual([{ event: 'page_view' }]);
  });

  it('returns error for unknown remote', async () => {
    const response = await forgeBridge.requestRemote('unknown', { path: '/test' });
    expect(response.ok).toBe(false);
    expect(response.status).toBe(404);
  });
});

// ── RemoteProxy Unit Tests ──────────────────────────────────────────────

describe('RemoteProxy', () => {
  let sim: ForgeSimulator;

  beforeEach(async () => {
    sim = new ForgeSimulator();
    setSimulator(sim);
    await sim.loadManifest(FULL_MANIFEST);
    await sim.fit.initInMemory();
  });

  it('returns 400 for requestRemote without options', async () => {
    const response = await sim.remotes.request('my-backend', undefined as any);
    expect(response.ok).toBe(false);
    expect(response.status).toBe(400);
  });

  it('logs remotes found in manifest', () => {
    const logs = sim.getLogs();
    const remoteLog = logs.find(l => l.message.includes('Found remote: "my-backend"'));
    expect(remoteLog).toBeDefined();
  });

  it('logs endpoints found in manifest', () => {
    const logs = sim.getLogs();
    const epLog = logs.find(l => l.message.includes('Found endpoint: "my-endpoint"'));
    expect(epLog).toBeDefined();
  });
});

// ── Simulator Integration ───────────────────────────────────────────────

describe('simulator remotes integration', () => {
  it('remotes and fit are available on simulator', () => {
    const sim = new ForgeSimulator();
    expect(sim.remotes).toBeDefined();
    expect(sim.fit).toBeDefined();
  });

  it('reset clears manifest from remotes', async () => {
    const sim = new ForgeSimulator();
    setSimulator(sim);
    await sim.loadManifest(FULL_MANIFEST);
    await sim.fit.initInMemory();

    sim.mockProductRoutes('my-backend', {
      'GET /test': { ok: true },
    });

    // Should work before reset
    const resp1 = await sim.remotes.invoke('my-backend', { path: '/test' });
    expect(resp1.ok).toBe(true);

    sim.reset();

    // After reset, manifest is cleared, so remote is unknown
    const resp2 = await sim.remotes.invoke('my-backend', { path: '/test' });
    expect(resp2.status).toBe(404);
  });
});
