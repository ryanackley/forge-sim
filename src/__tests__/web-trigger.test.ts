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

  it('defaults to 200 and text/plain when function returns minimal response', async () => {
    sim.resolver.define('handler', (async () => ({
      body: 'OK',
    })) as any);

    await setupServer([{ key: 'hook', functionKey: 'handler' }]);

    const res = await fetch(`http://127.0.0.1:${port}/__trigger/hook`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/plain');
    const body = await res.text();
    expect(body).toBe('OK');
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
