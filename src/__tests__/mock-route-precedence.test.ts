/**
 * Mock route precedence — longest prefix wins (adversarial 1019 F13).
 *
 * Route matching used to be first-registered-wins, which made ordering a
 * trap: a `GET /rest/api/3/issue/` catch-all loaded from .forge-sim/mocks.json
 * at boot shadowed every more specific route registered later through the
 * tools API or MCP — the tester mocked a specific issue and still got their
 * own catch-all's 404 body back. The most specific matching pattern now
 * answers regardless of registration order.
 *
 * No tie-break test: two DISTINCT patterns of equal length cannot both
 * prefix-match one path, and duplicates share a Map key, so ties between
 * different routes are unreachable.
 */
import { describe, it, expect } from 'vitest';
import { SimulatedProductApi, mockResponse } from '../product-api.js';

async function bodyOf(api: SimulatedProductApi, path: string) {
  const res = await api.request('jira', path);
  return { status: res.status, body: await res.json() };
}

describe('mock route precedence — longest prefix wins', () => {
  it('a specific route registered AFTER a catch-all still answers (the F13 repro)', async () => {
    const api = new SimulatedProductApi();
    // Boot-time mocks.json: a prefix catch-all to keep everything offline.
    api.mockRoutes('jira', {
      'GET /rest/api/3/issue/': mockResponse(404, { from: 'catch-all' }),
    });
    // Later, via tools API / MCP: a specific route.
    api.mockRoutes('jira', {
      'GET /rest/api/3/issue/PROJ-1': { key: 'PROJ-1', from: 'specific' },
    });

    const specific = await bodyOf(api, '/rest/api/3/issue/PROJ-1');
    expect(specific.status).toBe(200);
    expect(specific.body.from).toBe('specific');

    // The catch-all still owns everything else.
    const other = await bodyOf(api, '/rest/api/3/issue/OTHER-9');
    expect(other.status).toBe(404);
    expect(other.body.from).toBe('catch-all');
  });

  it('order is irrelevant: specific-then-catch-all behaves identically', async () => {
    const api = new SimulatedProductApi();
    api.mockRoutes('jira', {
      'GET /rest/api/3/issue/PROJ-1': { from: 'specific' },
      'GET /rest/api/3/issue/': mockResponse(404, { from: 'catch-all' }),
    });

    expect((await bodyOf(api, '/rest/api/3/issue/PROJ-1')).body.from).toBe('specific');
    expect((await bodyOf(api, '/rest/api/3/issue/OTHER-9')).body.from).toBe('catch-all');
  });

  it('three tiers nest: catch-all < issue prefix < exact path', async () => {
    const api = new SimulatedProductApi();
    api.mockRoutes('jira', {
      'GET /rest/': { tier: 'root' },
      'GET /rest/api/3/issue/PROJ-1/comment': { tier: 'exact' },
      'GET /rest/api/3/issue/PROJ-1': { tier: 'issue' },
    });

    expect((await bodyOf(api, '/rest/api/3/issue/PROJ-1/comment')).body.tier).toBe('exact');
    expect((await bodyOf(api, '/rest/api/3/issue/PROJ-1/transitions')).body.tier).toBe('issue');
    expect((await bodyOf(api, '/rest/api/3/project/X')).body.tier).toBe('root');
  });

  it('a function-form response wins by the same rule and sees the request', async () => {
    const api = new SimulatedProductApi();
    api.mockRoutes('jira', {
      'GET /rest/api/3/issue/': { from: 'catch-all' },
      'GET /rest/api/3/issue/DYN-1': (path: string) => ({ echoedPath: path }),
    });

    const res = await bodyOf(api, '/rest/api/3/issue/DYN-1');
    expect(res.body.echoedPath).toBe('/rest/api/3/issue/DYN-1');
  });

  it('methods stay independent: a long POST pattern never answers a GET', async () => {
    const api = new SimulatedProductApi();
    api.mockRoutes('jira', {
      'POST /rest/api/3/issue/PROJ-1/comment': { from: 'post' },
      'GET /rest/api/3/issue/': { from: 'get-catch-all' },
    });

    const res = await bodyOf(api, '/rest/api/3/issue/PROJ-1/comment');
    expect(res.body.from).toBe('get-catch-all');
  });
});
