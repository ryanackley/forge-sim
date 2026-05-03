/**
 * Tests for the proxy server — forge-sim dev --proxy mode.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { createProxyServer, type ProxyServer } from '../proxy-server.js';

// ── Helpers ──────────────────────────────────────────────────────────────

/** Start a simple HTTP server on a random port, returns server + port. */
function startUpstream(handler: (req: IncomingMessage, res: ServerResponse) => void): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, () => {
      const addr = server.address() as { port: number };
      resolve({ server, port: addr.port });
    });
  });
}

/** Fetch helper that returns { status, headers, body }. */
async function fetchText(url: string): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  const res = await fetch(url);
  return {
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    body: await res.text(),
  };
}

/** Wait for proxy server to be listening. */
function waitForListen(proxy: ProxyServer, port: number): Promise<void> {
  return new Promise((resolve) => {
    proxy.server.on('listening', () => resolve());
    // If already listening, resolve immediately
    const addr = proxy.server.address();
    if (addr) resolve();
  });
}

// ── Test Suite ───────────────────────────────────────────────────────────

describe('ProxyServer', () => {
  const servers: Array<{ close(): void }> = [];

  afterEach(() => {
    for (const s of servers) {
      try { s.close(); } catch {}
    }
    servers.length = 0;
  });

  it('injects bridge script into HTML responses', async () => {
    const { server: upstream, port: upPort } = await startUpstream((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><head><title>Test</title></head><body>Hello</body></html>');
    });
    servers.push(upstream);

    const proxy = createProxyServer({ upstream: `http://localhost:${upPort}`, wsPort: 9999 });
    proxy.listen(0);
    await waitForListen(proxy, 0);
    servers.push(proxy);

    const proxyPort = (proxy.server.address() as { port: number }).port;
    const { status, body } = await fetchText(`http://localhost:${proxyPort}/`);

    expect(status).toBe(200);
    // Bridge script should be injected after <head>
    expect(body).toContain('<head>');
    expect(body).toContain('<script>');
    expect(body).toContain('__bridge');
    expect(body).toContain('ws://localhost:9999');
    // Original content should still be present
    expect(body).toContain('<title>Test</title>');
    expect(body).toContain('Hello');
  });

  it('passes through non-HTML responses untouched', async () => {
    const cssContent = 'body { color: red; }';
    const jsContent = 'console.log("hello");';
    const jsonContent = '{"key":"value"}';

    const { server: upstream, port: upPort } = await startUpstream((req, res) => {
      if (req.url === '/style.css') {
        res.writeHead(200, { 'Content-Type': 'text/css' });
        res.end(cssContent);
      } else if (req.url === '/app.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(jsContent);
      } else if (req.url === '/data.json') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(jsonContent);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    servers.push(upstream);

    const proxy = createProxyServer({ upstream: `http://localhost:${upPort}`, wsPort: 9999 });
    proxy.listen(0);
    await waitForListen(proxy, 0);
    servers.push(proxy);

    const proxyPort = (proxy.server.address() as { port: number }).port;

    // CSS should pass through without bridge injection
    const css = await fetchText(`http://localhost:${proxyPort}/style.css`);
    expect(css.body).toBe(cssContent);
    expect(css.body).not.toContain('<script>');

    // JS should pass through
    const js = await fetchText(`http://localhost:${proxyPort}/app.js`);
    expect(js.body).toBe(jsContent);

    // JSON should pass through
    const json = await fetchText(`http://localhost:${proxyPort}/data.json`);
    expect(json.body).toBe(jsonContent);
  });

  it('intercepts /__forge/ paths (not proxied to upstream)', async () => {
    let upstreamHit = false;
    const { server: upstream, port: upPort } = await startUpstream((req, res) => {
      upstreamHit = true;
      res.writeHead(200);
      res.end('upstream');
    });
    servers.push(upstream);

    const proxy = createProxyServer({ upstream: `http://localhost:${upPort}`, wsPort: 9999 });
    proxy.addMiddleware('/__forge', (req, res, pathname) => {
      if (pathname === '/__forge/jwks.json') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ keys: ['test-jwk'] }));
        return true;
      }
      return false;
    });
    proxy.listen(0);
    await waitForListen(proxy, 0);
    servers.push(proxy);

    const proxyPort = (proxy.server.address() as { port: number }).port;
    upstreamHit = false;

    const { status, body } = await fetchText(`http://localhost:${proxyPort}/__forge/jwks.json`);
    expect(status).toBe(200);
    expect(JSON.parse(body)).toEqual({ keys: ['test-jwk'] });
    expect(upstreamHit).toBe(false);
  });

  it('intercepts /__tools/ paths (not proxied to upstream)', async () => {
    let upstreamHit = false;
    const { server: upstream, port: upPort } = await startUpstream((req, res) => {
      upstreamHit = true;
      res.writeHead(200);
      res.end('upstream');
    });
    servers.push(upstream);

    const proxy = createProxyServer({ upstream: `http://localhost:${upPort}`, wsPort: 9999 });
    proxy.addMiddleware('/__tools', (req, res, pathname) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body>Tools UI</body></html>');
      return true;
    });
    proxy.listen(0);
    await waitForListen(proxy, 0);
    servers.push(proxy);

    const proxyPort = (proxy.server.address() as { port: number }).port;
    upstreamHit = false;

    const { status, body } = await fetchText(`http://localhost:${proxyPort}/__tools/`);
    expect(status).toBe(200);
    expect(body).toContain('Tools UI');
    expect(upstreamHit).toBe(false);
  });

  it('returns useful error page when upstream is unreachable', async () => {
    // Use a port that nothing is listening on
    const proxy = createProxyServer({ upstream: 'http://localhost:19999', wsPort: 9999 });
    proxy.listen(0);
    await waitForListen(proxy, 0);
    servers.push(proxy);

    const proxyPort = (proxy.server.address() as { port: number }).port;
    const { status, body } = await fetchText(`http://localhost:${proxyPort}/`);

    expect(status).toBe(502);
    expect(body).toContain('Upstream Connection Error');
    expect(body).toContain('localhost:19999');
  });

  it('routes WebSocket upgrade for registered prefix to local handler (not upstream)', async () => {
    // Regression: in proxy mode, /__tools/ws was being piped to upstream,
    // which broke the Tools UI live log/state stream. Local upgrade handlers
    // must claim the upgrade before the upstream pipe runs.
    let upstreamUpgradeHit = false;
    const { server: upstream, port: upPort } = await startUpstream((req, res) => {
      res.writeHead(404);
      res.end();
    });
    const upstreamWss = new WebSocketServer({ server: upstream });
    upstreamWss.on('connection', () => { upstreamUpgradeHit = true; });
    servers.push(upstream);
    servers.push(upstreamWss);

    const proxy = createProxyServer({ upstream: `http://localhost:${upPort}`, wsPort: 9999 });

    // Register a local handler for /__tools/ws — it should win over the upstream pipe
    const localWss = new WebSocketServer({ noServer: true });
    let localUpgradeHit = false;
    localWss.on('connection', (ws) => {
      localUpgradeHit = true;
      ws.send('local-hello');
    });
    proxy.addUpgradeHandler('/__tools/ws', (req, socket, head) => {
      localWss.handleUpgrade(req, socket, head, (ws) => {
        localWss.emit('connection', ws, req);
      });
    });

    proxy.listen(0);
    await waitForListen(proxy, 0);
    servers.push(proxy);
    servers.push(localWss);

    const proxyPort = (proxy.server.address() as { port: number }).port;
    const clientWs = new WebSocket(`ws://localhost:${proxyPort}/__tools/ws`);
    servers.push({ close: () => clientWs.close() });

    const reply = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WS timeout')), 5000);
      clientWs.on('message', (data) => { clearTimeout(timeout); resolve(data.toString()); });
      clientWs.on('error', (err) => { clearTimeout(timeout); reject(err); });
    });

    expect(reply).toBe('local-hello');
    expect(localUpgradeHit).toBe(true);
    expect(upstreamUpgradeHit).toBe(false);
  });

  it('forwards WebSocket upgrade requests to upstream', async () => {
    // Start a WebSocket server as upstream
    const { server: upstream, port: upPort } = await startUpstream((req, res) => {
      res.writeHead(404);
      res.end();
    });
    const wss = new WebSocketServer({ server: upstream });
    let wsMessageReceived = '';
    wss.on('connection', (ws) => {
      ws.on('message', (data) => {
        wsMessageReceived = data.toString();
        ws.send('echo:' + data.toString());
      });
    });
    servers.push(upstream);
    servers.push(wss);

    const proxy = createProxyServer({ upstream: `http://localhost:${upPort}`, wsPort: 9999 });
    proxy.listen(0);
    await waitForListen(proxy, 0);
    servers.push(proxy);

    const proxyPort = (proxy.server.address() as { port: number }).port;

    // Connect via the proxy's WebSocket
    const clientWs = new WebSocket(`ws://localhost:${proxyPort}`);
    servers.push({ close: () => clientWs.close() });

    const reply = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WS timeout')), 5000);
      clientWs.on('open', () => {
        clientWs.send('hello');
      });
      clientWs.on('message', (data) => {
        clearTimeout(timeout);
        resolve(data.toString());
      });
      clientWs.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    expect(reply).toBe('echo:hello');
    expect(wsMessageReceived).toBe('hello');
  });

  it('handles HTML with attributes on head tag', async () => {
    const { server: upstream, port: upPort } = await startUpstream((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<html><head lang="en"><title>Attr Test</title></head><body>OK</body></html>');
    });
    servers.push(upstream);

    const proxy = createProxyServer({ upstream: `http://localhost:${upPort}`, wsPort: 7777 });
    proxy.listen(0);
    await waitForListen(proxy, 0);
    servers.push(proxy);

    const proxyPort = (proxy.server.address() as { port: number }).port;
    const { body } = await fetchText(`http://localhost:${proxyPort}/`);

    // Should inject after <head lang="en"> not duplicate or break
    expect(body).toContain('<head lang="en">');
    expect(body).toContain('ws://localhost:7777');
    expect(body).toContain('<title>Attr Test</title>');
  });

  it('forwards POST requests with body to upstream', async () => {
    let receivedBody = '';
    const { server: upstream, port: upPort } = await startUpstream((req, res) => {
      let data = '';
      req.on('data', (chunk) => data += chunk);
      req.on('end', () => {
        receivedBody = data;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ received: true }));
      });
    });
    servers.push(upstream);

    const proxy = createProxyServer({ upstream: `http://localhost:${upPort}`, wsPort: 9999 });
    proxy.listen(0);
    await waitForListen(proxy, 0);
    servers.push(proxy);

    const proxyPort = (proxy.server.address() as { port: number }).port;
    const res = await fetch(`http://localhost:${proxyPort}/api/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foo: 'bar' }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);
    expect(receivedBody).toBe('{"foo":"bar"}');
  });
});
