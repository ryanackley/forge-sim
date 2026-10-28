/**
 * The gateway is one backend. The real `@forge/api` sends requestGraph,
 * requestTeamworkGraph, requestAtlassian, requestConnectedData and the
 * privacy API to the `stargate` remote (api/out/api/fetch.js:185-200), and
 * `sim.productApi.requestGraph()` now takes that same route, so every
 * registry answers both identically, in this order:
 *
 *   operation-name mock (sim.mockGraphQL / forge_mock_graphql / mocks.json)
 *   > stargate route mock (POST /graphql)
 *   > full stargate mock
 *   > the connected site's gateway (/gateway/api)
 *   > 501 naming the fix on every channel
 *
 * `withContext(ari)` carries no remote; it routes by the ARI's resource owner.
 * The removed `storage` export's endpoint is named, not 501'd.
 *
 * Driven through the real `@forge/api` in-process, against the sim's seams;
 * `globalThis.fetch` is stubbed so a "connected" case proves where a call
 * would go without any network.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { asApp, asUser, route } from '@forge/api';
import { createSimulator, ForgeSimulator } from '../simulator.js';
import { mockResponse } from '../product-api.js';
import type { AtlassianAccount } from '../auth/credentials.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const realHttp = vi.fn(async (input: unknown, init?: RequestInit) => {
  return new Response(JSON.stringify({ data: { fromGateway: String(input), method: init?.method } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
});

beforeAll(() => vi.stubGlobal('fetch', realHttp));
afterAll(() => vi.unstubAllGlobals());

function fakeAccount(): AtlassianAccount {
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
  };
}

const ME = 'query Me { me { user { name } } }';

describe('the gateway is one backend', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    sim = createSimulator();
    realHttp.mockClear();
  });

  afterEach(async () => {
    await sim.stop();
  });

  /** The app's call and the sim-side helper, side by side. */
  async function both(query = ME, variables?: Record<string, unknown>) {
    const app = await asApp().requestGraph(query, variables);
    const helper = await sim.productApi.requestGraph(query, variables);
    return {
      app: { status: app.status, body: await app.json() },
      helper: { status: helper.status, body: await helper.json() },
    };
  }

  it('an operation-name mock answers the app and the helper identically', async () => {
    sim.mockGraphQL({ Me: { data: { me: { user: { name: 'Ryan' } } } } });
    const r = await both();
    expect(r.app).toEqual({ status: 200, body: { data: { me: { user: { name: 'Ryan' } } } } });
    expect(r.helper).toEqual(r.app);
    expect(realHttp).not.toHaveBeenCalled();
  });

  it('asUser().requestGraph() in a resolver takes the same route', async () => {
    sim.mockGraphQL({ Me: (query: string, variables?: Record<string, unknown>) => ({ data: { q: query.slice(0, 8), variables } }) });
    sim.resolver.define('graph', async () => {
      const res = await asUser().requestGraph(ME, { id: 1 });
      return { status: res.status, body: await res.json() };
    });
    expect(await sim.invoke('graph', {})).toEqual({ status: 200, body: { data: { q: 'query Me', variables: { id: 1 } } } });
  });

  it('the operation mock wins over a stargate POST /graphql route mock; the route answers other operations', async () => {
    sim.mockProductRoutes('stargate', { 'POST /graphql': { data: { from: 'route' } } });
    sim.mockGraphQL({ Me: { data: { from: 'operation' } } });
    expect((await both()).app.body).toEqual({ data: { from: 'operation' } });
    expect((await both('query Other { x }')).app.body).toEqual({ data: { from: 'route' } });
    expect((await both('query Other { x }')).helper.body).toEqual({ data: { from: 'route' } });
  });

  it('the operation mock wins over a full stargate mock registered later', async () => {
    sim.mockGraphQL({ Me: { data: { from: 'operation' } } });
    sim.mockProductApi('stargate', async () => ({
      status: 200, statusText: 'OK', headers: {}, ok: true,
      json: async () => ({ data: { from: 'full' } }),
      text: async () => JSON.stringify({ data: { from: 'full' } }),
    }));
    expect((await both()).app.body).toEqual({ data: { from: 'operation' } });
    expect((await both('{ anonymous }')).app.body).toEqual({ data: { from: 'full' } });
  });

  it("'*' catches anonymous and unmatched operations; the exact name still wins", async () => {
    sim.mockGraphQL({ '*': { data: { from: 'star' } }, Me: { data: { from: 'me' } } });
    expect((await both('{ viewer { id } }')).app.body).toEqual({ data: { from: 'star' } });
    expect((await both('query Other { x }')).app.body).toEqual({ data: { from: 'star' } });
    expect((await both()).app.body).toEqual({ data: { from: 'me' } });
  });

  it('a tagged mockResponse() sets the status of an operation mock', async () => {
    sim.mockGraphQL({ Me: mockResponse(429, { errors: [{ message: 'slow down' }] }) });
    const r = await both();
    expect(r.app).toEqual({ status: 429, body: { errors: [{ message: 'slow down' }] } });
    expect(r.helper).toEqual(r.app);
  });

  it('requestTeamworkGraph() is matched on the body operationName', async () => {
    const seen: string[] = [];
    sim.mockGraphQL({
      Search: (query: string) => {
        seen.push(query);
        return { data: { search: ['a'] } };
      },
    });
    const res = await asUser().requestTeamworkGraph('query Anything { search }', { q: 'x' }, 'Search');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { search: ['a'] } });
    expect(seen).toEqual(['query Anything { search }']);
  });

  it('unmocked, both get the same 501 naming the operation mock on every channel', async () => {
    const r = await both();
    expect(r.app.status).toBe(501);
    expect(r.helper).toEqual(r.app);
    const error: string = r.app.body.error;
    expect(error).toContain('Unmocked stargate API call: POST /graphql');
    expect(error).toContain("sim.mockGraphQL({ 'Me': body })");
    expect(error).toContain('forge_mock_graphql');
    expect(error).toContain('"graphql" key in .forge-sim/mocks.json');
    expect(error).toContain("sim.mockProductRoutes('stargate', { 'POST /graphql': body })");
    expect(realHttp).not.toHaveBeenCalled();
  });

  it('an unmocked requestAtlassian() names the route fix per channel, and a route mock answers it', async () => {
    const miss = await asApp().requestAtlassian(route`/me`);
    expect(miss.status).toBe(501);
    const error: string = (await miss.json()).error;
    expect(error).toContain('Unmocked stargate API call: GET /me');
    expect(error).toContain("sim.mockProductRoutes('stargate', { 'GET /me': body })");
    expect(error).toContain('forge_mock_routes');
    expect(error).not.toContain('mockGraphQL');

    sim.mockProductRoutes('stargate', { 'GET /me': { account_id: 'me' } });
    const hit = await asApp().requestAtlassian(route`/me`);
    expect(await hit.json()).toEqual({ account_id: 'me' });
  });

  it('requestConnectedData() is a stargate route under /connected-data', async () => {
    sim.mockProductRoutes('stargate', { 'GET /connected-data/graph/x': { rows: [] } });
    const res = await asApp().requestConnectedData(route`/graph/x`);
    expect(await res.json()).toEqual({ rows: [] });
  });

  describe('connected', () => {
    beforeEach(() => {
      sim.productApi.connectRealApis(fakeAccount());
    });

    it('an unmocked operation goes to the site gateway, from the app and from the helper', async () => {
      const r = await both();
      expect(r.app.status).toBe(200);
      expect(r.app.body.data.fromGateway).toBe('https://forge-sim-test.invalid/gateway/api/graphql');
      expect(r.helper).toEqual(r.app);
      expect(realHttp).toHaveBeenCalledTimes(2);
      const [, init] = realHttp.mock.calls[0] as [unknown, RequestInit];
      expect(init.method).toBe('POST');
      expect(JSON.parse(String(init.body))).toEqual({ query: ME });
      expect((init.headers as Record<string, string>).Authorization).toMatch(/^Basic /);
    });

    it('an unmocked requestAtlassian() goes to the gateway too', async () => {
      const res = await asApp().requestAtlassian(route`/me`);
      expect((await res.json()).data.fromGateway).toBe('https://forge-sim-test.invalid/gateway/api/me');
    });

    it('operation and route mocks still win over the gateway, registered before or after the connect', async () => {
      sim.mockGraphQL({ Me: { data: { from: 'operation' } } });
      sim.mockProductRoutes('stargate', { 'POST /graphql': { data: { from: 'route' } } });
      expect((await both()).app.body).toEqual({ data: { from: 'operation' } });
      expect((await both('query Other { x }')).app.body).toEqual({ data: { from: 'route' } });
      expect(realHttp).not.toHaveBeenCalled();
    });
  });

  describe('withContext(ari)', () => {
    it('routes to the product the ARI names', async () => {
      sim.mockProductRoutes('jira', { 'GET /rest/api/3/myself': { product: 'jira' } });
      sim.mockProductRoutes('confluence', { 'GET /wiki/rest/api/user/current': { product: 'confluence' } });
      const jira = await asApp().withContext('ari:cloud:jira::site/abc').requestJira(route`/rest/api/3/myself`);
      expect(await jira.json()).toEqual({ product: 'jira' });
      const conf = await asApp().withContext('ari:cloud:confluence::site/abc').requestConfluence(route`/wiki/rest/api/user/current`);
      expect(await conf.json()).toEqual({ product: 'confluence' });
    });

    it('throws a named not-implemented error for any other context', async () => {
      await expect(
        asApp().withContext('ari:cloud:compass::site/abc').requestJira(route`/x`),
      ).rejects.toThrow(/withContext\("ari:cloud:compass::site\/abc"\) is not implemented/);
    });
  });

  it("names the removed @forge/api storage export instead of answering its endpoint", async () => {
    const fetchSeam = (globalThis as any).__forge_fetch__;
    await expect(
      fetchSeam({ type: 'fpp', provider: 'app', remote: 'stargate' }, '/forge/entities/graphql', {
        method: 'POST',
        body: JSON.stringify({ query: 'query appStoredEntity { appStoredEntity { value } }' }),
      }),
    ).rejects.toThrow(/legacy `storage` export was removed.*Migrate to @forge\/kvs/);
  });

  it('the MCP tool descriptions no longer say the operation mocks are not wired', () => {
    const src = readFileSync(path.join(__dirname, '..', 'mcp-server.ts'), 'utf8');
    expect(src).not.toContain('do not yet answer');
    expect(src).toContain('win over a\nforge_mock_routes mock of "stargate"');
  });
});
