/**
 * Non-200 mock responses via `mockResponse()` factory + `mockRoutes` integration.
 *
 * Run #13 surfaced that `sim.mockRoutes(...)` hardcoded every response to 200,
 * silently accepted `{ __status: 500 }` as a body (a "looks-right test that
 * doesn't actually fail" footgun), and had no way to override status, headers,
 * or both. This file pins the new contract:
 *
 *   1. Bare value → 200 OK with that value as body. Full back-compat.
 *   2. `mockResponse(status, body?, headers?)` factory → explicit control.
 *   3. Lambda routes can return either shape; same detection logic.
 *   4. `{ __status }` / `{ _status }` misuse throws with a clear pointer to (2).
 *
 * Plus the auxiliary contracts: `ok` flag derivation, `statusText` derivation,
 * headers passthrough, JSON serializability of the tagged shape (for the MCP
 * path, which can't import the factory).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SimulatedProductApi, mockResponse, MOCK_RESPONSE_MARKER, type MockResponseTag } from '../product-api.js';

describe('mockResponse factory', () => {
  it('returns a tagged plain object with status only', () => {
    const r = mockResponse(500);
    expect(r).toEqual({
      __forgeSimMockResponse: true,
      status: 500,
      body: undefined,
      headers: undefined,
    });
  });

  it('carries status + body', () => {
    const r = mockResponse(404, { error: 'not found' });
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ error: 'not found' });
  });

  it('carries status + body + headers', () => {
    const r = mockResponse(429, { msg: 'too many' }, { 'Retry-After': '60' });
    expect(r.status).toBe(429);
    expect(r.body).toEqual({ msg: 'too many' });
    expect(r.headers).toEqual({ 'Retry-After': '60' });
  });

  it('is JSON-round-trippable (so MCP agents can construct the literal directly)', () => {
    // The MCP `forge_mock_routes` tool can't transmit class instances or
    // symbols. Agents writing tests through MCP can either call mockResponse
    // (impossible across JSON-RPC) OR construct the equivalent literal:
    //   { __forgeSimMockResponse: true, status: 500, body: ..., headers: ... }
    // The factory output must be byte-equivalent to that literal.
    const r = mockResponse(500, { error: 'oops' }, { 'X-Custom': 'h' });
    const roundTripped = JSON.parse(JSON.stringify(r));
    expect(roundTripped).toEqual({
      __forgeSimMockResponse: true,
      status: 500,
      body: { error: 'oops' },
      headers: { 'X-Custom': 'h' },
    });
  });

  it('exports MOCK_RESPONSE_MARKER constant for callers that want to check the shape', () => {
    expect(MOCK_RESPONSE_MARKER).toBe('__forgeSimMockResponse');
    const r: MockResponseTag = mockResponse(200);
    expect(r[MOCK_RESPONSE_MARKER]).toBe(true);
  });
});

describe('mockRoutes — bare body backward compatibility', () => {
  let api: SimulatedProductApi;

  beforeEach(() => {
    api = new SimulatedProductApi();
  });

  it('static bare body returns 200 OK with that body', async () => {
    api.mockRoutes('jira', {
      'GET /rest/api/3/issue/PROJ-1': { key: 'PROJ-1', summary: 'Bug' },
    });

    const resp = await api.request('jira', '/rest/api/3/issue/PROJ-1');
    expect(resp.status).toBe(200);
    expect(resp.ok).toBe(true);
    expect(resp.statusText).toBe('OK');
    expect(await resp.json()).toEqual({ key: 'PROJ-1', summary: 'Bug' });
  });

  it('lambda returning bare body still returns 200', async () => {
    api.mockRoutes('jira', {
      'GET /rest/api/3/anything': (path) => ({ echoed: path }),
    });

    const resp = await api.request('jira', '/rest/api/3/anything');
    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual({ echoed: '/rest/api/3/anything' });
  });

  it('bare body with a `status` field is treated as data, not as a tagged response', async () => {
    // Jira issue payloads routinely include `status: { name: 'Done' }`. The
    // tagged-shape requirement is exactly to avoid this false positive.
    const issueBody = {
      key: 'PROJ-1',
      fields: { status: { name: 'Done', id: '10001' } },
    };
    api.mockRoutes('jira', { 'GET /rest/api/3/issue/PROJ-1': issueBody });
    const resp = await api.request('jira', '/rest/api/3/issue/PROJ-1');
    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual(issueBody);
  });
});

describe('mockRoutes — explicit non-200 responses', () => {
  let api: SimulatedProductApi;

  beforeEach(() => {
    api = new SimulatedProductApi();
  });

  it('mockResponse(500) returns 500 with no body', async () => {
    api.mockRoutes('jira', {
      'PUT /rest/api/3/issue/X': mockResponse(500),
    });

    const resp = await api.request('jira', '/rest/api/3/issue/X', { method: 'PUT' });
    expect(resp.status).toBe(500);
    expect(resp.ok).toBe(false);
    expect(resp.statusText).toBe('Error');
    // Body serializes to "undefined"; json() returns undefined
    expect(await resp.json()).toBeUndefined();
  });

  it('mockResponse(404, body) returns 404 with body', async () => {
    api.mockRoutes('jira', {
      'GET /rest/api/3/issue/MISSING': mockResponse(404, { error: 'not found' }),
    });

    const resp = await api.request('jira', '/rest/api/3/issue/MISSING');
    expect(resp.status).toBe(404);
    expect(resp.ok).toBe(false);
    expect(await resp.json()).toEqual({ error: 'not found' });
  });

  it('mockResponse(429, body, headers) propagates headers', async () => {
    api.mockRoutes('jira', {
      'POST /rest/api/3/bulk': mockResponse(
        429,
        { msg: 'rate limited' },
        { 'Retry-After': '60' },
      ),
    });

    const resp = await api.request('jira', '/rest/api/3/bulk', { method: 'POST' });
    expect(resp.status).toBe(429);
    expect(resp.headers['Retry-After']).toBe('60');
    expect(resp.headers['content-type']).toBe('application/json');
  });

  it('mockResponse(204) returns 204 No Content with ok=true (2xx)', async () => {
    api.mockRoutes('jira', {
      'DELETE /rest/api/3/issue/X': mockResponse(204),
    });

    const resp = await api.request('jira', '/rest/api/3/issue/X', { method: 'DELETE' });
    expect(resp.status).toBe(204);
    expect(resp.ok).toBe(true);
  });

  it('accepts the literal tagged shape (the MCP path)', async () => {
    // MCP agents can't import the factory — they construct the equivalent
    // plain-object literal. Round-trip parity must hold.
    api.mockRoutes('jira', {
      'PUT /rest/api/3/issue/X': {
        __forgeSimMockResponse: true,
        status: 500,
        body: { error: 'oops' },
      },
    });

    const resp = await api.request('jira', '/rest/api/3/issue/X', { method: 'PUT' });
    expect(resp.status).toBe(500);
    expect(await resp.json()).toEqual({ error: 'oops' });
  });
});

describe('mockRoutes — lambda routes returning mockResponse()', () => {
  let api: SimulatedProductApi;

  beforeEach(() => {
    api = new SimulatedProductApi();
  });

  it('lambda can return mockResponse() for per-request status control', async () => {
    api.mockRoutes('jira', {
      'PUT /rest/api/3/issue': (path) => {
        if (path.endsWith('/FAIL')) return mockResponse(500, { error: 'oops' });
        return { ok: true };
      },
    });

    const failResp = await api.request('jira', '/rest/api/3/issue/FAIL', { method: 'PUT' });
    expect(failResp.status).toBe(500);
    expect(await failResp.json()).toEqual({ error: 'oops' });

    const okResp = await api.request('jira', '/rest/api/3/issue/PASS', { method: 'PUT' });
    expect(okResp.status).toBe(200);
    expect(await okResp.json()).toEqual({ ok: true });
  });

  it('lambda receives both path and options', async () => {
    let capturedMethod: string | undefined;
    let capturedPath: string | undefined;
    api.mockRoutes('jira', {
      'PUT /rest/api/3/whatever': (path, opts) => {
        capturedPath = path;
        capturedMethod = opts?.method;
        return mockResponse(201, { id: 'x' });
      },
    });

    await api.request('jira', '/rest/api/3/whatever', { method: 'PUT' });
    expect(capturedPath).toBe('/rest/api/3/whatever');
    expect(capturedMethod).toBe('PUT');
  });

  it('lambda returning a body that has a `status` field is treated as bare body', async () => {
    // Same false-positive guard as the static case — must hold across the
    // lambda path too.
    api.mockRoutes('jira', {
      'GET /rest/api/3/issue/X': () => ({ status: { name: 'Done' } }),
    });

    const resp = await api.request('jira', '/rest/api/3/issue/X');
    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual({ status: { name: 'Done' } });
  });
});

describe('mockRoutes — misuse detection', () => {
  let api: SimulatedProductApi;

  beforeEach(() => {
    api = new SimulatedProductApi();
  });

  it('static `{ __status: <number> }` throws with a helpful pointer to mockResponse', async () => {
    api.mockRoutes('jira', {
      'PUT /rest/api/3/issue/X': { __status: 500, body: { error: 'oops' } },
    });

    await expect(api.request('jira', '/rest/api/3/issue/X', { method: 'PUT' }))
      .rejects.toThrow(/__status.*not recognized.*mockResponse/);
  });

  it('static `{ _status: <number> }` (single underscore) also throws', async () => {
    api.mockRoutes('jira', {
      'PUT /rest/api/3/issue/X': { _status: 500 },
    });
    await expect(api.request('jira', '/rest/api/3/issue/X', { method: 'PUT' }))
      .rejects.toThrow(/mockResponse/);
  });

  it('lambda returning `{ __status }` also throws — caught at request time', async () => {
    api.mockRoutes('jira', {
      'PUT /rest/api/3/issue/X': () => ({ __status: 500, error: 'oops' }),
    });
    await expect(api.request('jira', '/rest/api/3/issue/X', { method: 'PUT' }))
      .rejects.toThrow(/mockResponse/);
  });

  it('a body that has `__status` as a STRING (not a number) is NOT treated as misuse', async () => {
    // Tight check: only `__status: <number>` triggers the throw. A real API
    // payload that happens to use `__status` as a string label passes through.
    const body = { __status: 'this-is-just-a-label', other: 'data' };
    api.mockRoutes('jira', { 'GET /rest/api/3/anything': body });
    const resp = await api.request('jira', '/rest/api/3/anything');
    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual(body);
  });

  it('an array with status-shaped content is NOT mis-detected', async () => {
    // Defensive: arrays can have a `__status` index by coincidence — we
    // only check on plain objects.
    const body = [{ __status: 500 }];
    api.mockRoutes('jira', { 'GET /rest/api/3/list': body });
    const resp = await api.request('jira', '/rest/api/3/list');
    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual(body);
  });
});

describe('mockRoutes — fall-through 404', () => {
  it('unmocked routes still return the existing 404 with helpful error body', async () => {
    const api = new SimulatedProductApi();
    api.mockRoutes('jira', {
      'GET /rest/api/3/known': { ok: true },
    });

    const resp = await api.request('jira', '/rest/api/3/unknown');
    expect(resp.status).toBe(404);
    expect(resp.ok).toBe(false);
    const body = await resp.json();
    expect(body.error).toMatch(/No mock route matched/);
  });
});
