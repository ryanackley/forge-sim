/**
 * Mocks ALWAYS take precedence over the real backend — on every mock target,
 * whether or not a site is connected, and whether the mock was registered
 * before or after the connect.
 *
 * Only jira/confluence/bitbucket get a real handler (which consults the mock
 * table first). Every other key — a remote, provider remote or `stargate` —
 * keeps its route table as its handler even when it is registered AFTER a
 * connect; without one, request() would answer 501, which remote-proxy.ts and
 * seam-fetch.ts read as "unmocked" and send to the real backend — with the
 * developer's stored provider token for providers.
 *
 * Whether a mock answered is decided by the mock layer's own stamp, never by
 * the STATUS: a mock that deliberately answers `mockResponse(404)` (issue not
 * found) or `mockResponse(501)` is the answer on the jira/confluence/bitbucket
 * real handler, remote-proxy and seam-fetch alike, never a cue to call the
 * real site / remote / provider. And a full mock() stays in place when
 * mockRoutes() is called on the same product afterwards, answering what the
 * routes don't match instead of sending it to the site. The "Deliberate
 * non-2xx" and "full mock" blocks below pin both.
 *
 * No network: globalThis.fetch is stubbed to THROW for the whole file, so any
 * real HTTP fails the call it was made from, and every mocked call asserts
 * the stub was never touched.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SimulatedProductApi, mockResponse, noMockAnswer } from '../product-api.js';
import type { ProductApiResponse } from '../types.js';
import { createSimulator, type ForgeSimulator } from '../simulator.js';
import type { AtlassianAccount } from '../auth/credentials.js';

const realHttp = vi.fn(async (input: unknown) => {
  throw new Error(`real HTTP attempted in a hermetic test: ${String(input)}`);
});

beforeAll(() => {
  vi.stubGlobal('fetch', realHttp);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  realHttp.mockClear();
});

function fakeAccount(overrides: Partial<AtlassianAccount> = {}): AtlassianAccount {
  return {
    id: 'fake-1',
    name: 'Fake Dev',
    email: 'dev@example.com',
    site: 'forge-sim-test.invalid',
    cloudId: 'fake-cloud',
    accountId: 'fake-account',
    authType: 'pat',
    accessToken: 'fake-pat',
    refreshToken: '',
    expiresAt: 0,
    scopes: [],
    ...overrides,
  };
}

// ── Unit: SimulatedProductApi ───────────────────────────────────────────

describe('SimulatedProductApi — mocks win over a connected site, in any order', () => {
  const NON_PRODUCT_KEYS = ['my-remote', 'google-apis', 'stargate'];

  it.each(NON_PRODUCT_KEYS)('connect FIRST, then mockRoutes(%s) → the mock answers (not 501)', async (key) => {
    const api = new SimulatedProductApi();
    api.connectRealApis(fakeAccount());
    api.mockRoutes(key, { 'GET /ping': { mocked: key } });

    const res = await api.request(key, '/ping');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ mocked: key });
    expect(realHttp).not.toHaveBeenCalled();
  });

  it.each(NON_PRODUCT_KEYS)('mockRoutes(%s) FIRST, then connect → the mock still answers', async (key) => {
    const api = new SimulatedProductApi();
    api.mockRoutes(key, { 'GET /ping': { mocked: key } });
    api.connectRealApis(fakeAccount());

    const res = await api.request(key, '/ping');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ mocked: key });
  });

  it('an UNMOCKED non-product key still answers 501 while connected (the "unmocked" signal)', async () => {
    const api = new SimulatedProductApi();
    api.connectRealApis(fakeAccount());
    expect((await api.request('my-remote', '/ping')).status).toBe(501);
  });

  it.each(['jira', 'confluence', 'bitbucket'])('%s: mock registered before or after connect answers; the rest reaches the site', async (product) => {
    const api = new SimulatedProductApi();
    api.mockRoutes(product, { 'GET /before': { when: 'before' } });
    api.connectRealApis(fakeAccount());
    api.mockRoutes(product, { 'GET /after': { when: 'after' } });

    expect(await (await api.request(product, '/before')).json()).toEqual({ when: 'before' });
    expect(await (await api.request(product, '/after')).json()).toEqual({ when: 'after' });
    expect(realHttp).not.toHaveBeenCalled();

    // Sanity that the stub is wired and the fallback is real: an unmatched
    // route goes to the connected site (the stub throws → 502).
    const unmatched = await api.request(product, '/rest/unmocked');
    expect(unmatched.status).toBe(502);
    expect(realHttp).toHaveBeenCalledTimes(1);
    expect(String(realHttp.mock.calls[0][0])).toBe('https://forge-sim-test.invalid/rest/unmocked');
  });

  it('a full mock() handler registered BEFORE connect is not replaced by the real handler', async () => {
    const api = new SimulatedProductApi();
    api.mock('jira', async () => ({
      status: 200, statusText: 'OK', headers: {}, ok: true,
      json: async () => ({ full: true }), text: async () => '{"full":true}',
    }));
    api.connectRealApis(fakeAccount());

    expect(await (await api.request('jira', '/anything')).json()).toEqual({ full: true });
    expect(realHttp).not.toHaveBeenCalled();
  });

  it('disconnect and reconnect keep every mock', async () => {
    const api = new SimulatedProductApi();
    api.connectRealApis(fakeAccount());
    api.mockRoutes('jira', { 'GET /j': { j: 1 } });
    api.mockRoutes('my-remote', { 'GET /r': { r: 1 } });
    api.mockRoutes('stargate', { 'POST /graphql': { data: { ok: true } } });

    api.disconnectRealApis();
    expect(api.isRealMode).toBe(false);
    expect(await (await api.request('jira', '/j')).json()).toEqual({ j: 1 });
    expect(await (await api.request('my-remote', '/r')).json()).toEqual({ r: 1 });
    // Offline, an unmatched jira route is a mock miss, not a site call.
    expect((await api.request('jira', '/other')).status).toBe(404);

    api.connectRealApis(fakeAccount());
    expect(await (await api.request('jira', '/j')).json()).toEqual({ j: 1 });
    expect(await (await api.request('my-remote', '/r')).json()).toEqual({ r: 1 });
    expect(await (await api.request('stargate', '/graphql', { method: 'POST' })).json()).toEqual({ data: { ok: true } });
    expect(realHttp).not.toHaveBeenCalled();
  });
});

// ── Deliberate non-2xx mocks are answers, not "unmocked" ────────────────

function fullResponse(status: number, body: unknown): ProductApiResponse {
  return {
    status, statusText: status < 300 ? 'OK' : 'Error', headers: {}, ok: status < 300,
    json: async () => body, text: async () => JSON.stringify(body),
  };
}

describe('SimulatedProductApi — a mock that answers 404 or 501 is still the answer', () => {
  const PRODUCTS = ['jira', 'confluence', 'bitbucket'];
  const ORDERS = [['connect first', true], ['mock first', false]] as const;

  for (const product of PRODUCTS) {
    for (const [label, connectFirst] of ORDERS) {
      it(`${product}, ${label}: mockResponse(404) answers while connected — no site call`, async () => {
        const api = new SimulatedProductApi();
        if (connectFirst) api.connectRealApis(fakeAccount());
        api.mockRoutes(product, {
          'GET /rest/api/3/issue/GONE-1': mockResponse(404, { errorMessages: ['Issue does not exist'] }),
          // Lambda form returning the tagged shape, with a query string.
          'GET /rest/api/3/issue/GONE-2': () => mockResponse(404, { errorMessages: ['gone too'] }),
          // The MCP / mocks.json literal shape.
          'DELETE /rest/api/3/issue/GONE-3': { __forgeSimMockResponse: true, status: 404 },
        });
        if (!connectFirst) api.connectRealApis(fakeAccount());

        const a = await api.request(product, '/rest/api/3/issue/GONE-1');
        expect(a.status).toBe(404);
        expect(await a.json()).toEqual({ errorMessages: ['Issue does not exist'] });
        const b = await api.request(product, '/rest/api/3/issue/GONE-2?fields=summary');
        expect(b.status).toBe(404);
        expect(await b.json()).toEqual({ errorMessages: ['gone too'] });
        const c = await api.request(product, '/rest/api/3/issue/GONE-3', { method: 'DELETE' });
        expect(c.status).toBe(404);
        expect(realHttp).not.toHaveBeenCalled();

        // The connected fallback still works for a route nothing mocks.
        expect((await api.request(product, '/rest/api/3/issue/REAL-1')).status).toBe(502);
        expect(realHttp).toHaveBeenCalledTimes(1);
      });
    }
  }

  it('an async route lambda is awaited: its mockResponse(404) is a 404, offline and connected', async () => {
    for (const connected of [false, true]) {
      const api = new SimulatedProductApi();
      if (connected) api.connectRealApis(fakeAccount());
      api.mockRoutes('jira', {
        'GET /rest/api/3/issue/ASYNC-1': async () => mockResponse(404, { errorMessages: ['gone (async)'] }),
        'GET /rest/api/3/issue/ASYNC-2': () => Promise.resolve({ key: 'ASYNC-2' }),
      });
      const gone = await api.request('jira', '/rest/api/3/issue/ASYNC-1');
      // The Promise is awaited, not serialized into a 200 whose body is `{}`.
      expect(gone.status).toBe(404);
      expect(await gone.json()).toEqual({ errorMessages: ['gone (async)'] });
      const ok = await api.request('jira', '/rest/api/3/issue/ASYNC-2');
      expect(ok.status).toBe(200);
      expect(await ok.json()).toEqual({ key: 'ASYNC-2' });
    }
    expect(realHttp).not.toHaveBeenCalled();
  });

  it('a mocked 404 answers the same offline and connected (no channel skew)', async () => {
    const offline = new SimulatedProductApi();
    const connected = new SimulatedProductApi();
    connected.connectRealApis(fakeAccount());
    for (const api of [offline, connected]) {
      api.mockRoutes('jira', { 'GET /rest/api/3/issue/GONE-1': mockResponse(404, { gone: true }) });
      const res = await api.request('jira', '/rest/api/3/issue/GONE-1');
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ gone: true });
    }
    expect(realHttp).not.toHaveBeenCalled();
  });

  it('noMockAnswer stamps only the mock layer\'s own "nothing answered" responses', async () => {
    const api = new SimulatedProductApi();
    // Nothing registered for the key at all.
    expect(noMockAnswer(await api.request('my-remote', '/x'))).toBe('unmocked');
    expect(noMockAnswer(await api.request('jira', '/x'))).toBe('unmocked');

    api.mockRoutes('my-remote', {
      'GET /down': mockResponse(501, { upstream: 'down' }),
      'GET /gone': mockResponse(404),
    });
    api.mockRoutes('jira', { 'GET /rest/api/3/issue/GONE-1': mockResponse(404) });
    // A mock's own 501/404 is an answer…
    const down = await api.request('my-remote', '/down');
    expect(down.status).toBe(501);
    expect(noMockAnswer(down)).toBeUndefined();
    expect(noMockAnswer(await api.request('my-remote', '/gone'))).toBeUndefined();
    expect(noMockAnswer(await api.request('jira', '/rest/api/3/issue/GONE-1'))).toBeUndefined();
    // …an unmatched path on a mocked key is not.
    const miss = await api.request('my-remote', '/elsewhere');
    expect(miss.status).toBe(404);
    expect(noMockAnswer(miss)).toBe('no-route-matched');
    // The stamp is invisible to JSON (it never reaches app code).
    expect(JSON.stringify(Object.keys(miss))).not.toContain('noMockAnswer');
  });

  it('a full mock() that answers 404 for a permission check keeps its answer (no permissive override)', async () => {
    const api = new SimulatedProductApi();
    api.mock('jira', async () => fullResponse(404, { denied: true }));
    const res = await api.request('jira', '/rest/api/3/permissions/check', {
      method: 'POST',
      body: JSON.stringify({ projectPermissions: [{ permissions: ['BROWSE_PROJECTS'], projects: [10000] }] }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ denied: true });
  });

  it('an UNMOCKED permission check still gets the permissive default (offline)', async () => {
    const api = new SimulatedProductApi();
    const res = await api.request('confluence', '/rest/api/content/123/permission/check', { method: 'POST', body: '{}' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hasPermission: true });
  });
});

describe('SimulatedProductApi — a full mock() is never dropped for the real site', () => {
  for (const connectFirst of [true, false]) {
    it(`mock() then mockRoutes() (${connectFirst ? 'connect first' : 'connect last'}): routes answer, the full mock answers the rest`, async () => {
      const api = new SimulatedProductApi();
      if (connectFirst) api.connectRealApis(fakeAccount());
      api.mock('jira', async () => fullResponse(200, { full: true }));
      api.mockRoutes('jira', { 'GET /rest/api/3/myself': { route: true } });
      if (!connectFirst) api.connectRealApis(fakeAccount());

      expect(await (await api.request('jira', '/rest/api/3/myself')).json()).toEqual({ route: true });
      const rest = await api.request('jira', '/rest/api/3/project');
      expect(rest.status).toBe(200);
      expect(await rest.json()).toEqual({ full: true });
      expect(realHttp).not.toHaveBeenCalled();
    });
  }

  it('offline: mock() then mockRoutes() — the full mock answers unmatched routes too', async () => {
    const api = new SimulatedProductApi();
    api.mock('jira', async () => fullResponse(200, { full: true }));
    api.mockRoutes('jira', { 'GET /rest/api/3/myself': { route: true } });
    expect(await (await api.request('jira', '/rest/api/3/project')).json()).toEqual({ full: true });
  });

  it('mock() AFTER mockRoutes() is a full replacement (it answers the routed paths too)', async () => {
    const api = new SimulatedProductApi();
    api.connectRealApis(fakeAccount());
    api.mockRoutes('jira', { 'GET /rest/api/3/myself': { route: true } });
    api.mock('jira', async () => fullResponse(200, { full: true }));
    expect(await (await api.request('jira', '/rest/api/3/myself')).json()).toEqual({ full: true });
    expect(await (await api.request('jira', '/rest/api/3/project')).json()).toEqual({ full: true });
    expect(realHttp).not.toHaveBeenCalled();
  });

  it('a full mock() that answers 501 on a remote key is an answer, not "unmocked"', async () => {
    const api = new SimulatedProductApi();
    api.mock('my-remote', async () => fullResponse(501, { upstream: 'down' }));
    const res = await api.request('my-remote', '/ping');
    expect(res.status).toBe(501);
    expect(noMockAnswer(res)).toBeUndefined();
  });

  it('clear() drops full mocks with everything else', async () => {
    const api = new SimulatedProductApi();
    api.mock('jira', async () => fullResponse(200, { full: true }));
    api.clear();
    expect((await api.request('jira', '/x')).status).toBe(501);
  });
});

// ── End to end: the real @forge/api from inside a deployed resolver ─────

const MANIFEST = `
app:
  id: ari:cloud:ecosystem::app/mock-precedence-connected
  runtime:
    name: nodejs22.x
modules:
  jira:issuePanel:
    - key: panel
      title: Panel
      icon: https://example.com/icon.svg
      resource: fe
      render: native
      resolver:
        function: fn
  function:
    - key: fn
      handler: index.handler
resources:
  - key: fe
    path: src/fe.tsx
permissions:
  scopes: []
  external:
    fetch:
      backend:
        - remote: my-remote
        - remote: google-apis
        - remote: unmocked-remote
providers:
  auth:
    - key: google
      name: Google
      type: oauth2
      clientId: cid
      scopes:
        - openid
      remotes:
        - google-apis
      bearerMethod: authorization-header
      actions:
        authorization:
          remote: google-account
          path: /o/oauth2/v2/auth
        exchange:
          remote: google-oauth
          path: /token
        refreshToken:
          remote: google-oauth
          path: /token
        revokeToken:
          remote: google-oauth
          path: /revoke
        retrieveProfile:
          remote: google-apis
          path: /userinfo/v2/me
          resolvers:
            id: id
            displayName: email
            avatarUrl: picture
remotes:
  - key: my-remote
    baseUrl: https://backend.forge-sim-test.invalid
  - key: unmocked-remote
    baseUrl: https://unmocked.forge-sim-test.invalid
  - key: google-apis
    baseUrl: https://api.forge-sim-test.invalid
  - key: google-account
    baseUrl: https://accounts.forge-sim-test.invalid
  - key: google-oauth
    baseUrl: https://oauth.forge-sim-test.invalid
`;

const INDEX = `
import Resolver from '@forge/resolver';
import api, { invokeRemote, route } from '@forge/api';

const resolver = new Resolver();
const settle = async (call) => {
  try {
    const res = await call();
    return { status: res.status, body: await res.json() };
  } catch (err) {
    return { error: String(err && err.message ? err.message : err) };
  }
};
resolver.define('callRemote', ({ payload }) => settle(() =>
  invokeRemote(payload?.remote ?? 'my-remote', { path: payload?.path ?? '/ping' })));
resolver.define('callProvider', ({ payload }) => settle(() =>
  api.asUser().withProvider('google', 'google-apis').fetch(payload?.path ?? '/userinfo/v2/me')));
resolver.define('callGraph', () => settle(() => api.asApp().requestGraph('query Me { me { name } }')));
resolver.define('callJira', () => settle(() => api.asApp().requestJira(route\`/rest/api/3/myself\`)));
resolver.define('callJiraIssue', ({ payload }) => settle(() =>
  api.asApp().requestJira(route\`/rest/api/3/issue/\${payload.key}\`)));
export const handler = resolver.getDefinitions();
`;

const FE = `
import ForgeReconciler, { Text } from '@forge/react';
ForgeReconciler.render(<Text>hi</Text>);
`;

describe('connected simulator: the real @forge/api gets the mock body for remotes, providers and stargate', () => {
  let dir: string;
  let sim: ForgeSimulator;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'forge-sim-mock-precedence-'));
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(join(dir, 'manifest.yml'), MANIFEST);
    await writeFile(join(dir, 'src', 'index.js'), INDEX);
    await writeFile(join(dir, 'src', 'fe.tsx'), FE);

    sim = createSimulator();
    const result = await sim.deploy(dir, { throwOnError: false, fireScheduledTriggers: false });
    expect(result.errors).toEqual([]);

    // deploy() does not load manifest `providers` yet, so wire them the way
    // loadManifest() does.
    const manifest = sim.getManifest()!;
    sim.externalAuth.loadFromManifest(manifest.authProviders, manifest.remotes);
    // A stored provider token — what makes the real withProvider() send the
    // request at all, and what must never reach the real provider host.
    sim.externalAuth.setToken('google', {
      provider: 'google',
      accessToken: 'stored-google-token',
      account: { id: 'g-1', displayName: 'dev@example.com', scopes: ['openid'] },
    });

    // Connect BEFORE registering any mock: mocks registered after a connect
    // must still win.
    sim.productApi.connectRealApis(fakeAccount());
    sim.mockProductRoutes('my-remote', { 'GET /ping': { from: 'remote-mock' } });
    sim.productApi.mockRoutes('google-apis', { 'GET /userinfo/v2/me': { from: 'provider-mock' } });
    sim.mockProductRoutes('stargate', { 'POST /graphql': { data: { from: 'stargate-mock' } } });
    sim.mockProductRoutes('jira', { 'GET /rest/api/3/myself': { from: 'jira-mock' } });
    // Deliberate non-2xx answers — each is the answer, never read as "unmocked".
    sim.mockProductRoutes('my-remote', { 'GET /down': mockResponse(501, { upstream: 'down (mock)' }) });
    sim.productApi.mockRoutes('google-apis', { 'GET /down': mockResponse(501, { provider: 'down (mock)' }) });
    sim.mockProductRoutes('jira', {
      'GET /rest/api/3/issue/GONE-1': mockResponse(404, { errorMessages: ['Issue does not exist'] }),
    });
  });

  afterAll(async () => {
    await sim?.stop();
    await rm(dir, { recursive: true, force: true });
  });

  it('is connected (the precondition: every mock here is registered after the connect)', () => {
    expect(sim.productApi.isRealMode).toBe(true);
  });

  it('invokeRemote → the remote mock', async () => {
    expect(await sim.invoke('callRemote')).toEqual({ status: 200, body: { from: 'remote-mock' } });
    expect(realHttp).not.toHaveBeenCalled();
  });

  it('withProvider().fetch → the provider-remote mock, the stored token never leaves', async () => {
    expect(await sim.invoke('callProvider')).toEqual({ status: 200, body: { from: 'provider-mock' } });
    expect(realHttp).not.toHaveBeenCalled();
  });

  it('requestGraph → the stargate mock', async () => {
    expect(await sim.invoke('callGraph')).toEqual({ status: 200, body: { data: { from: 'stargate-mock' } } });
    expect(realHttp).not.toHaveBeenCalled();
  });

  it('requestJira → the jira mock', async () => {
    expect(await sim.invoke('callJira')).toEqual({ status: 200, body: { from: 'jira-mock' } });
    expect(realHttp).not.toHaveBeenCalled();
  });

  it('requestJira → a mocked 404 is the answer, never the connected site', async () => {
    expect(await sim.invoke('callJiraIssue', { key: 'GONE-1' })).toEqual({
      status: 404, body: { errorMessages: ['Issue does not exist'] },
    });
    expect(realHttp).not.toHaveBeenCalled();
  });

  it('invokeRemote → a mocked 501 is the answer, never the real remote', async () => {
    expect(await sim.invoke('callRemote', { path: '/down' })).toEqual({
      status: 501, body: { upstream: 'down (mock)' },
    });
    expect(realHttp).not.toHaveBeenCalled();
  });

  it('withProvider().fetch → a mocked 501 is the answer; the stored bearer token never leaves', async () => {
    expect(await sim.invoke('callProvider', { path: '/down' })).toEqual({
      status: 501, body: { provider: 'down (mock)' },
    });
    expect(realHttp).not.toHaveBeenCalled();
  });

  it('invokeRemote on a mocked remote, unmatched path → 404 "No mock route matched", not real HTTP', async () => {
    const out = await sim.invoke('callRemote', { path: '/not-mocked' });
    expect(out.status).toBe(404);
    expect(out.body.error).toMatch(/No mock route matched: GET \/not-mocked/);
    expect(realHttp).not.toHaveBeenCalled();
  });

  it('sanity: a remote with NO mocks at all still goes to its real baseUrl', async () => {
    const out = await sim.invoke('callRemote', { remote: 'unmocked-remote', path: '/ping' });
    expect(out.error ?? JSON.stringify(out)).toMatch(/real HTTP attempted/);
    expect(realHttp).toHaveBeenCalledTimes(1);
    expect(String(realHttp.mock.calls[0][0])).toBe('https://unmocked.forge-sim-test.invalid/ping');
  });
});
