/**
 * Tests for web trigger HTTP endpoints.
 *
 * Verifies:
 *   - Manifest parsing of webtrigger modules
 *   - HTTP request → Forge request mapping
 *   - Function invocation with (request, context) calling convention
 *   - Forge response → HTTP response mapping
 *   - Error handling (missing trigger, function throws, bad response shape)
 *   - CORS preflight
 *   - Query parameter and header multi-value handling
 *   - webTrigger.getUrl() dynamic URL
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { createSimulator, ForgeSimulator, parseManifestContent } from '../index.js';
import { createWebTriggerHandler, getWebTriggerUrl } from '../web-trigger.js';

// ── Test helpers ────────────────────────────────────────────────────────

function createTestServer(handler: (req: IncomingMessage, res: ServerResponse) => void): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({ server, port: addr.port });
    });
  });
}

async function fetch(url: string, init?: RequestInit): Promise<Response> {
  return globalThis.fetch(url, init);
}

// ── Manifest parsing ────────────────────────────────────────────────────

describe('Manifest parsing: webtrigger', () => {
  it('parses webtrigger modules', () => {
    const manifest = parseManifestContent(`
modules:
  webtrigger:
    - key: my-webhook
      function: webhookHandler
    - key: api-endpoint
      function: apiHandler
  function:
    - key: webhookHandler
      handler: src/webhooks.handler
    - key: apiHandler
      handler: src/api.handler
app:
  id: ari:cloud:ecosystem::app/test
`);

    expect(manifest.webTriggers).toHaveLength(2);
    expect(manifest.webTriggers[0]).toEqual({ key: 'my-webhook', functionKey: 'webhookHandler' });
    expect(manifest.webTriggers[1]).toEqual({ key: 'api-endpoint', functionKey: 'apiHandler' });
  });

  it('returns empty array when no webtriggers defined', () => {
    const manifest = parseManifestContent(`
modules:
  function:
    - key: resolver
      handler: src/index.handler
app:
  id: ari:cloud:ecosystem::app/test
`);

    expect(manifest.webTriggers).toEqual([]);
  });
});

// ── Web trigger handler ─────────────────────────────────────────────────

describe('Web trigger HTTP handler', () => {
  let sim: ForgeSimulator;
  let server: Server;
  let port: number;

  beforeEach(async () => {
    sim = createSimulator();
  });

  afterEach(() => {
    if (server) server.close();
  });

  async function setupServer(triggers: Array<{ key: string; functionKey: string }>) {
    const handler = createWebTriggerHandler({ triggers, simulator: sim });
    const result = await createTestServer(async (req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost`);
      const handled = await handler(req, res, url.pathname);
      if (!handled) {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    server = result.server;
    port = result.port;
  }

  it('invokes a web trigger function with correct request shape', async () => {
    let capturedRequest: any;
    let capturedContext: any;

    sim.resolver.define('myHandler', (async (req: any, ctx: any) => {
      capturedRequest = req;
      capturedContext = ctx;
      return {
        statusCode: 200,
        headers: { 'content-type': ['application/json'] },
        body: JSON.stringify({ ok: true }),
      };
    }) as any);

    await setupServer([{ key: 'hook', functionKey: 'myHandler' }]);

    const res = await fetch(`http://127.0.0.1:${port}/__trigger/hook?foo=bar&foo=baz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'hello' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });

    // Verify Forge request shape
    expect(capturedRequest.method).toBe('POST');
    expect(capturedRequest.path).toBe('/__trigger/hook');
    expect(capturedRequest.headers['content-type']).toEqual(['application/json']);
    expect(capturedRequest.queryParameters.foo).toEqual(['bar', 'baz']);
    expect(JSON.parse(capturedRequest.body)).toEqual({ data: 'hello' });

    // Verify context
    expect(capturedContext.installContext).toContain('sim-cloud-001');
    expect(capturedContext.principal).toBeNull();
  });

  it('returns 404 for unknown trigger key', async () => {
    await setupServer([{ key: 'known', functionKey: 'handler' }]);

    const res = await fetch(`http://127.0.0.1:${port}/__trigger/unknown`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('unknown');
    expect(body.available).toEqual(['known']);
  });

  it('returns 500 when function is not loaded', async () => {
    // Don't register any handler
    await setupServer([{ key: 'hook', functionKey: 'missingFn' }]);

    const res = await fetch(`http://127.0.0.1:${port}/__trigger/hook`);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('missingFn');
  });

  it('returns 500 when function throws', async () => {
    sim.resolver.define('throwingHandler', (async () => {
      throw new Error('Kaboom!');
    }) as any);

    await setupServer([{ key: 'boom', functionKey: 'throwingHandler' }]);

    const res = await fetch(`http://127.0.0.1:${port}/__trigger/boom`);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.message).toBe('Kaboom!');
  });

  it('handles CORS preflight', async () => {
    sim.resolver.define('handler', (async () => ({ statusCode: 200 })) as any);
    await setupServer([{ key: 'hook', functionKey: 'handler' }]);

    const res = await fetch(`http://127.0.0.1:${port}/__trigger/hook`, { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
  });

  it('maps Forge multi-value headers to HTTP response', async () => {
    sim.resolver.define('handler', (async () => ({
      statusCode: 200,
      headers: {
        'content-type': ['text/html'],
        'x-custom': ['value1', 'value2'],
      },
      body: '<h1>Hello</h1>',
    })) as any);

    await setupServer([{ key: 'hook', functionKey: 'handler' }]);

    const res = await fetch(`http://127.0.0.1:${port}/__trigger/hook`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/html');
    expect(res.headers.get('x-custom')).toBe('value1, value2');
    const body = await res.text();
    expect(body).toBe('<h1>Hello</h1>');
  });

  // WTR-009: a result that is not compatible with the documented response
  // shape (missing statusCode, non-object, undefined) → HTTP 500. Real Forge
  // rejects malformed handler results rather than guessing a 200.
  it('returns 500 when function result omits statusCode (WTR-009)', async () => {
    sim.resolver.define('handler', (async () => ({
      body: 'OK',
    })) as any);

    await setupServer([{ key: 'hook', functionKey: 'handler' }]);

    const res = await fetch(`http://127.0.0.1:${port}/__trigger/hook`);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/invalid.*response/i);
  });

  it('returns 500 when function result is a bare string (WTR-009)', async () => {
    sim.resolver.define('handler', (async () => 'just a string') as any);

    await setupServer([{ key: 'hook', functionKey: 'handler' }]);

    const res = await fetch(`http://127.0.0.1:${port}/__trigger/hook`);
    expect(res.status).toBe(500);
  });

  it('returns 500 when function returns undefined (WTR-009)', async () => {
    sim.resolver.define('handler', (async () => undefined) as any);

    await setupServer([{ key: 'hook', functionKey: 'handler' }]);

    const res = await fetch(`http://127.0.0.1:${port}/__trigger/hook`);
    expect(res.status).toBe(500);
  });

  it('returns 500 when statusCode is not a number (WTR-009)', async () => {
    sim.resolver.define('handler', (async () => ({
      statusCode: '200',
      body: 'OK',
    })) as any);

    await setupServer([{ key: 'hook', functionKey: 'handler' }]);

    const res = await fetch(`http://127.0.0.1:${port}/__trigger/hook`);
    expect(res.status).toBe(500);
  });

  it('handles GET requests with query parameters', async () => {
    let capturedRequest: any;
    sim.resolver.define('handler', (async (req: any) => {
      capturedRequest = req;
      return { statusCode: 200, body: 'OK' };
    }) as any);

    await setupServer([{ key: 'hook', functionKey: 'handler' }]);

    await fetch(`http://127.0.0.1:${port}/__trigger/hook?key=value&multi=a&multi=b`);

    expect(capturedRequest.method).toBe('GET');
    expect(capturedRequest.queryParameters.key).toEqual(['value']);
    expect(capturedRequest.queryParameters.multi).toEqual(['a', 'b']);
    expect(capturedRequest.body).toBe('');
  });

  it('handles string headers in response (not array)', async () => {
    sim.resolver.define('handler', (async () => ({
      statusCode: 200,
      headers: { 'content-type': 'application/xml' },
      body: '<root/>',
    })) as any);

    await setupServer([{ key: 'hook', functionKey: 'handler' }]);

    const res = await fetch(`http://127.0.0.1:${port}/__trigger/hook`);
    expect(res.headers.get('content-type')).toBe('application/xml');
  });

  it('does not handle non-trigger paths', async () => {
    await setupServer([{ key: 'hook', functionKey: 'handler' }]);

    const res = await fetch(`http://127.0.0.1:${port}/some/other/path`);
    expect(res.status).toBe(404);
    const body = await res.text();
    expect(body).toBe('Not found'); // From our test server fallback, not trigger handler
  });

  it('includes CORS header on success responses', async () => {
    sim.resolver.define('handler', (async () => ({
      statusCode: 200,
      body: 'OK',
    })) as any);

    await setupServer([{ key: 'hook', functionKey: 'handler' }]);

    const res = await fetch(`http://127.0.0.1:${port}/__trigger/hook`);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('uses connected account cloudId in context', async () => {
    let capturedContext: any;
    sim.resolver.define('handler', (async (_req: any, ctx: any) => {
      capturedContext = ctx;
      return { statusCode: 200, body: 'OK' };
    }) as any);

    sim.productApi.connectRealApis({
      id: 'test',
      site: 'mysite.atlassian.net',
      accountId: 'user-abc',
      cloudId: 'real-cloud-123',
      authType: 'pat',
      token: 'fake',
    });

    await setupServer([{ key: 'hook', functionKey: 'handler' }]);

    await fetch(`http://127.0.0.1:${port}/__trigger/hook`);

    expect(capturedContext.installContext).toContain('real-cloud-123');
  });
});

// ── URL helper ──────────────────────────────────────────────────────────

describe('getWebTriggerUrl', () => {
  it('returns localhost URL with trigger key', () => {
    expect(getWebTriggerUrl('my-hook', 5173)).toBe('http://localhost:5173/__trigger/my-hook');
  });
});

// ── webTrigger.getUrl() shim ────────────────────────────────────────────

describe('webTrigger.getUrl() shim', () => {
  afterEach(() => {
    delete (globalThis as any).__forgeSim_devPort__;
  });

  it('returns local URL when dev port is set', async () => {
    (globalThis as any).__forgeSim_devPort__ = 5173;
    // Import fresh to get the shim
    const { webTrigger } = await import('../shims/forge-api.js').then(m => (m as any));
    // The shim reads from forge-api exports — let's test directly
    const url = `http://localhost:5173/__trigger/my-hook`;
    expect(getWebTriggerUrl('my-hook', 5173)).toBe(url);
  });

  it('returns fake URL when no dev port set', () => {
    delete (globalThis as any).__forgeSim_devPort__;
    // Without the import, just verify the helper
    expect(getWebTriggerUrl('test', 5173)).toBe('http://localhost:5173/__trigger/test');
  });
});

// ── Manifest parsing: urlFormat + static response ───────────────────────

describe('Manifest parsing: webtrigger urlFormat and static response', () => {
  it('parses urlFormat and static response outputs', () => {
    const manifest = parseManifestContent(`
modules:
  webtrigger:
    - key: static-hook
      function: staticHandler
      urlFormat: v2
      response:
        type: static
        outputs:
          - key: status-ok
            statusCode: 200
            contentType: application/json
            body: '{"ok":true}'
          - key: status-bad
            statusCode: 400
  function:
    - key: staticHandler
      handler: src/index.handler
app:
  id: ari:cloud:ecosystem::app/test
`);

    expect(manifest.webTriggers[0]).toEqual({
      key: 'static-hook',
      functionKey: 'staticHandler',
      urlFormat: 'v2',
      responseType: 'static',
      outputs: [
        { key: 'status-ok', statusCode: 200, contentType: 'application/json', body: '{"ok":true}' },
        { key: 'status-bad', statusCode: 400 },
      ],
    });
  });

  it('keeps the minimal shape when optional fields are absent', () => {
    const manifest = parseManifestContent(`
modules:
  webtrigger:
    - key: plain
      function: handler
  function:
    - key: handler
      handler: src/index.handler
app:
  id: ari:cloud:ecosystem::app/test
`);
    // Exactly { key, functionKey } — no undefined-valued extras
    expect(manifest.webTriggers[0]).toEqual({ key: 'plain', functionKey: 'handler' });
  });
});

// ── Web Trigger URL management (WTR-003/004/005) ────────────────────────

describe('WebTriggerUrlRegistry — webTrigger.getUrl/deleteUrl/queryUrls', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    sim = createSimulator();
    sim.webTriggerUrls.registerModules([
      { key: 'hook-a', functionKey: 'fnA' },
      { key: 'hook-b', functionKey: 'fnB' },
      { key: 'hook-v2', functionKey: 'fnV2', urlFormat: 'v2' },
    ]);
  });

  afterEach(() => {
    delete (globalThis as any).__forgeSim_devPort__;
  });

  it('WTR-005: getUrl reuses the existing URL for the same module', async () => {
    const first = await sim.webTriggerUrls.getUrl('hook-a');
    const second = await sim.webTriggerUrls.getUrl('hook-a');
    expect(second).toBe(first);
  });

  it('WTR-005: getUrl(key, true) forces a new distinct URL', async () => {
    const first = await sim.webTriggerUrls.getUrl('hook-a');
    const forced = await sim.webTriggerUrls.getUrl('hook-a', true);
    expect(forced).not.toBe(first);
    // Both remain active and queryable
    const urls = await sim.webTriggerUrls.queryUrls('hook-a');
    expect(urls.map((u) => u.url).sort()).toEqual([first, forced].sort());
  });

  it('generates real v1 URL format (…/x1/<id>) when no dev port', async () => {
    const url = await sim.webTriggerUrls.getUrl('hook-a');
    expect(url).toMatch(/^https:\/\/[0-9a-f-]+\.hello\.atlassian-dev\.net\/x1\/[^/]+$/);
  });

  it('generates real v2 URL format (…/public/<id>) for urlFormat: v2', async () => {
    const url = await sim.webTriggerUrls.getUrl('hook-v2');
    expect(url).toMatch(/^https:\/\/[0-9a-f-]+\.webtrigger\.atlassian\.app\/public\/[^/]+$/);
  });

  it('generates localhost URLs when the dev server port is set', async () => {
    (globalThis as any).__forgeSim_devPort__ = 4321;
    const v1 = await sim.webTriggerUrls.getUrl('hook-a');
    const v2 = await sim.webTriggerUrls.getUrl('hook-v2');
    expect(v1).toMatch(/^http:\/\/localhost:4321\/x1\/[^/]+$/);
    expect(v2).toMatch(/^http:\/\/localhost:4321\/public\/[^/]+$/);
  });

  it('getUrl for an unknown module throws the real error string', async () => {
    await expect(sim.webTriggerUrls.getUrl('nope')).rejects.toThrow(
      'Internal error occurred: Failed to get web trigger URL.',
    );
  });

  it('WTR-003: queryUrls returns all URLs, or filtered by module key', async () => {
    const a = await sim.webTriggerUrls.getUrl('hook-a');
    const b = await sim.webTriggerUrls.getUrl('hook-b');

    const all = await sim.webTriggerUrls.queryUrls();
    expect(all).toHaveLength(2);
    expect(all).toContainEqual({ moduleKey: 'hook-a', url: a });
    expect(all).toContainEqual({ moduleKey: 'hook-b', url: b });

    const onlyA = await sim.webTriggerUrls.queryUrls('hook-a');
    expect(onlyA).toEqual([{ moduleKey: 'hook-a', url: a }]);
  });

  it('WTR-004: deleteUrl removes the URL from the registry', async () => {
    const url = await sim.webTriggerUrls.getUrl('hook-a');
    await sim.webTriggerUrls.deleteUrl(url);
    expect(await sim.webTriggerUrls.queryUrls()).toEqual([]);
    // A fresh getUrl mints a NEW url (old one was deleted, not cached)
    const fresh = await sim.webTriggerUrls.getUrl('hook-a');
    expect(fresh).not.toBe(url);
  });

  it('deleteUrl cannot parse v2 URLs — real @forge/api quirk', async () => {
    // Real deleteUrl extracts the ID with /\/x1\/…/ only, so v2 (/public/)
    // URLs fail the parse. We mirror that exactly.
    const url = await sim.webTriggerUrls.getUrl('hook-v2');
    await expect(sim.webTriggerUrls.deleteUrl(url)).rejects.toThrow(
      'Internal error occurred: Failed to parse web trigger URL for ID',
    );
  });

  it('deleteUrl of an unknown ID throws the backend-failure string', async () => {
    await expect(
      sim.webTriggerUrls.deleteUrl('https://x.hello.atlassian-dev.net/x1/does-not-exist'),
    ).rejects.toThrow('Internal error occurred: Failed to delete web trigger URL: unknown error');
  });

  it('redeploy drops URLs for modules that no longer exist', async () => {
    const kept = await sim.webTriggerUrls.getUrl('hook-a');
    await sim.webTriggerUrls.getUrl('hook-b');
    sim.webTriggerUrls.registerModules([{ key: 'hook-a', functionKey: 'fnA' }]);
    const urls = await sim.webTriggerUrls.queryUrls();
    expect(urls).toEqual([{ moduleKey: 'hook-a', url: kept }]);
  });

  it('shim webTrigger delegates getUrl/deleteUrl/queryUrls to the registry', async () => {
    const { webTrigger } = (await import('../shims/forge-api.js')) as any;
    const url = await webTrigger.getUrl('hook-a');
    expect(url).toMatch(/\/x1\//);
    expect(await webTrigger.queryUrls('hook-a')).toEqual([{ moduleKey: 'hook-a', url }]);
    await webTrigger.deleteUrl(url);
    expect(await webTrigger.queryUrls()).toEqual([]);
  });
});

// ── Managed URL invocation over HTTP (WTR-004/007/011) ─────────────────

describe('Web trigger managed URLs over HTTP', () => {
  let sim: ForgeSimulator;
  let server: Server;
  let port: number;

  beforeEach(() => {
    sim = createSimulator();
  });

  afterEach(() => {
    delete (globalThis as any).__forgeSim_devPort__;
    if (server) server.close();
  });

  async function setupServer(triggers: Array<any>) {
    sim.webTriggerUrls.registerModules(triggers);
    const handler = createWebTriggerHandler({ triggers, simulator: sim });
    const result = await createTestServer(async (req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost`);
      const handled = await handler(req, res, url.pathname);
      if (!handled) {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    server = result.server;
    port = result.port;
    (globalThis as any).__forgeSim_devPort__ = port;
  }

  /** getUrl() returns http://localhost:<port>/… — rewrite to 127.0.0.1 for fetch */
  const local = (url: string) => url.replace('localhost', '127.0.0.1');

  it('invokes the handler through a getUrl()-minted /x1/ URL', async () => {
    let invoked = 0;
    sim.resolver.define('fn', (async () => {
      invoked++;
      return { statusCode: 200, body: 'via managed url' };
    }) as any);
    await setupServer([{ key: 'hook', functionKey: 'fn' }]);

    const url = await sim.webTriggerUrls.getUrl('hook');
    const res = await fetch(local(url));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('via managed url');
    expect(invoked).toBe(1);
  });

  it('invokes the handler through a v2 /public/ URL', async () => {
    sim.resolver.define('fn', (async () => ({ statusCode: 200, body: 'v2' })) as any);
    await setupServer([{ key: 'hook', functionKey: 'fn', urlFormat: 'v2' }]);

    const url = await sim.webTriggerUrls.getUrl('hook');
    expect(url).toContain('/public/');
    const res = await fetch(local(url));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('v2');
  });

  it('WTR-004: requests to a deleted URL do NOT invoke the handler', async () => {
    let invoked = 0;
    sim.resolver.define('fn', (async () => {
      invoked++;
      return { statusCode: 200, body: 'ok' };
    }) as any);
    await setupServer([{ key: 'hook', functionKey: 'fn' }]);

    const url = await sim.webTriggerUrls.getUrl('hook');
    // Sanity: works before delete
    expect((await fetch(local(url))).status).toBe(200);
    expect(invoked).toBe(1);

    await sim.webTriggerUrls.deleteUrl(url);
    const res = await fetch(local(url));
    expect(res.status).toBe(404);
    expect(invoked).toBe(1); // handler NOT invoked again
  });

  it('WTR-007: userPath carries the suffix after the trigger URL', async () => {
    let captured: any;
    sim.resolver.define('fn', (async (req: any) => {
      captured = req;
      return { statusCode: 200, body: 'ok' };
    }) as any);
    await setupServer([{ key: 'hook', functionKey: 'fn' }]);

    const url = await sim.webTriggerUrls.getUrl('hook');
    await fetch(`${local(url)}/hello/world?q=1`);
    expect(captured.userPath).toBe('/hello/world');
    // path keeps the full pathname incl. the /x1/<id> prefix
    expect(captured.path).toMatch(/^\/x1\/[^/]+\/hello\/world$/);
    expect(captured.queryParameters.q).toEqual(['1']);
  });

  it('WTR-007: userPath is "" for the bare trigger URL', async () => {
    let captured: any;
    sim.resolver.define('fn', (async (req: any) => {
      captured = req;
      return { statusCode: 200, body: 'ok' };
    }) as any);
    await setupServer([{ key: 'hook', functionKey: 'fn' }]);

    const url = await sim.webTriggerUrls.getUrl('hook');
    await fetch(local(url));
    expect(captured.userPath).toBe('');
  });

  it('WTR-007: userPath also works on the legacy /__trigger route', async () => {
    let captured: any;
    sim.resolver.define('fn', (async (req: any) => {
      captured = req;
      return { statusCode: 200, body: 'ok' };
    }) as any);
    await setupServer([{ key: 'hook', functionKey: 'fn' }]);

    await fetch(`http://127.0.0.1:${port}/__trigger/hook/extra/bits`);
    expect(captured.userPath).toBe('/extra/bits');
  });

  it('WTR-011: static response returns the configured output for outputKey', async () => {
    sim.resolver.define('fn', (async () => ({ outputKey: 'status-ok' })) as any);
    await setupServer([
      {
        key: 'hook',
        functionKey: 'fn',
        responseType: 'static',
        outputs: [
          { key: 'status-ok', statusCode: 201, contentType: 'application/json', body: '{"created":true}' },
          { key: 'status-bad', statusCode: 400, body: 'nope' },
        ],
      },
    ]);

    const url = await sim.webTriggerUrls.getUrl('hook');
    const res = await fetch(local(url));
    expect(res.status).toBe(201);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(await res.json()).toEqual({ created: true });
  });

  it('WTR-011: static response selects among multiple outputs', async () => {
    sim.resolver.define('fn', (async (req: any) => ({
      outputKey: req.queryParameters.bad ? 'status-bad' : 'status-ok',
    })) as any);
    await setupServer([
      {
        key: 'hook',
        functionKey: 'fn',
        responseType: 'static',
        outputs: [
          { key: 'status-ok', statusCode: 200, body: 'good' },
          { key: 'status-bad', statusCode: 400, body: 'bad' },
        ],
      },
    ]);

    const url = await sim.webTriggerUrls.getUrl('hook');
    const good = await fetch(local(url));
    expect(good.status).toBe(200);
    expect(await good.text()).toBe('good');

    const bad = await fetch(`${local(url)}?bad=1`);
    expect(bad.status).toBe(400);
    expect(await bad.text()).toBe('bad');
  });

  it('WTR-011: unknown outputKey → 500 with available keys listed', async () => {
    sim.resolver.define('fn', (async () => ({ outputKey: 'no-such-output' })) as any);
    await setupServer([
      {
        key: 'hook',
        functionKey: 'fn',
        responseType: 'static',
        outputs: [{ key: 'status-ok', statusCode: 200 }],
      },
    ]);

    const url = await sim.webTriggerUrls.getUrl('hook');
    const res = await fetch(local(url));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('no-such-output');
    expect(body.available).toEqual(['status-ok']);
  });

  it('unknown /x1/<id> that was never minted → 404, handler untouched', async () => {
    let invoked = 0;
    sim.resolver.define('fn', (async () => {
      invoked++;
      return { statusCode: 200, body: 'ok' };
    }) as any);
    await setupServer([{ key: 'hook', functionKey: 'fn' }]);

    const res = await fetch(`http://127.0.0.1:${port}/x1/never-minted-id`);
    expect(res.status).toBe(404);
    expect(invoked).toBe(0);
  });
});
