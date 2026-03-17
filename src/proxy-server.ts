/**
 * HTTP Reverse Proxy for forge-sim dev --proxy mode.
 *
 * Sits in front of a developer's existing dev server (webpack, Vite, Parcel, etc.)
 * and injects the bridge shim into HTML responses so @forge/bridge works.
 *
 * - Forwards all HTTP requests to the upstream
 * - For text/html responses, injects the bridge script after <head>
 * - Intercepts forge-sim routes (/__tools/*, /__forge/*) before proxying
 * - Passes through WebSocket upgrade requests to upstream (for HMR)
 * - Uses only Node built-in http module (no npm dependencies)
 */

import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { URL } from 'node:url';
import { Socket } from 'node:net';
import { generateBridgeInlineScript } from './dev-command.js';

export interface ProxyServerOptions {
  /** Upstream dev server URL (e.g., http://localhost:3000) */
  upstream: string;
  /** WebSocket port for the bridge (the forge-sim dev server WS port) */
  wsPort: number;
}

export type MiddlewareHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  searchParams: string,
) => boolean | void;

export interface ProxyServer {
  /** The underlying HTTP server */
  server: Server;
  /** Start listening on the given port */
  listen(port: number): void;
  /** Close the server */
  close(): void;
  /** Register a middleware that intercepts requests matching a path prefix.
   *  Return true from handler to indicate the request was handled. */
  addMiddleware(prefix: string, handler: MiddlewareHandler): void;
}

export function createProxyServer(options: ProxyServerOptions): ProxyServer {
  const { upstream, wsPort } = options;
  const upstreamUrl = new URL(upstream);
  const bridgeScript = generateBridgeInlineScript(wsPort);
  const bridgeTag = `<script>${bridgeScript}</script>`;

  const middlewares: Array<{ prefix: string; handler: MiddlewareHandler }> = [];

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const pathname = url.pathname;
    const searchParams = url.search.slice(1); // strip leading '?'

    // Check middlewares first (forge-sim routes)
    for (const mw of middlewares) {
      if (pathname.startsWith(mw.prefix)) {
        const handled = mw.handler(req, res, pathname, searchParams);
        if (handled) return;
      }
    }

    // Proxy to upstream
    proxyRequest(req, res, upstreamUrl, bridgeTag);
  });

  // WebSocket upgrade passthrough to upstream (for HMR)
  server.on('upgrade', (req, socket, head) => {
    const upstreamReq = httpRequest({
      hostname: upstreamUrl.hostname,
      port: upstreamUrl.port,
      path: req.url,
      method: req.method,
      headers: req.headers,
    });

    upstreamReq.on('upgrade', (upstreamRes, upstreamSocket, upgradeHead) => {
      // Build the raw HTTP 101 response
      let response = `HTTP/${upstreamRes.httpVersion} ${upstreamRes.statusCode} ${upstreamRes.statusMessage}\r\n`;
      for (let i = 0; i < upstreamRes.rawHeaders.length; i += 2) {
        response += `${upstreamRes.rawHeaders[i]}: ${upstreamRes.rawHeaders[i + 1]}\r\n`;
      }
      response += '\r\n';

      socket.write(response);
      if (upgradeHead.length > 0) {
        socket.write(upgradeHead);
      }

      // Pipe bidirectionally
      upstreamSocket.pipe(socket as Socket);
      (socket as Socket).pipe(upstreamSocket);
    });

    upstreamReq.on('error', () => {
      socket.destroy();
    });

    upstreamReq.end();
  });

  return {
    server,
    listen(port: number) {
      server.listen(port, () => {
        // Server is listening — logged by caller
      });
    },
    close() {
      server.close();
    },
    addMiddleware(prefix: string, handler: MiddlewareHandler) {
      middlewares.push({ prefix, handler });
    },
  };
}

/**
 * Forward an HTTP request to the upstream server.
 * If the response is HTML, inject the bridge script after <head>.
 */
function proxyRequest(
  clientReq: IncomingMessage,
  clientRes: ServerResponse,
  upstreamUrl: URL,
  bridgeTag: string,
): void {
  const proxyReq = httpRequest(
    {
      hostname: upstreamUrl.hostname,
      port: upstreamUrl.port,
      path: clientReq.url,
      method: clientReq.method,
      headers: {
        ...clientReq.headers,
        host: `${upstreamUrl.hostname}:${upstreamUrl.port}`,
      },
    },
    (proxyRes) => {
      const contentType = proxyRes.headers['content-type'] ?? '';
      const isHtml = contentType.includes('text/html');

      if (isHtml) {
        // Buffer the response to inject bridge script
        const chunks: Buffer[] = [];
        proxyRes.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        proxyRes.on('end', () => {
          let html = Buffer.concat(chunks).toString('utf-8');
          // Inject right after <head> (before any other scripts)
          html = html.replace(/<head([^>]*)>/i, `<head$1>\n${bridgeTag}`);

          // Forward headers but fix content-length
          const headers = { ...proxyRes.headers };
          delete headers['content-length'];
          delete headers['transfer-encoding'];
          headers['content-length'] = String(Buffer.byteLength(html));

          clientRes.writeHead(proxyRes.statusCode ?? 200, headers);
          clientRes.end(html);
        });
      } else {
        // Non-HTML: stream through untouched
        const headers = { ...proxyRes.headers };
        clientRes.writeHead(proxyRes.statusCode ?? 200, headers);
        proxyRes.pipe(clientRes);
      }
    },
  );

  proxyReq.on('error', (err) => {
    const errorPage = `<!DOCTYPE html>
<html>
<head><title>forge-sim proxy error</title></head>
<body style="font-family:monospace;padding:40px;background:#1e1e2e;color:#cdd6f4">
  <h1 style="color:#f38ba8">Upstream Connection Error</h1>
  <p>Could not connect to upstream server at <strong>${upstreamUrl.origin}</strong></p>
  <pre style="background:#282838;padding:16px;border-radius:8px;color:#f9e2af">${err.message}</pre>
  <p style="color:#a6adc8;margin-top:24px">
    Make sure your dev server is running at ${upstreamUrl.origin} and try again.
  </p>
</body>
</html>`;
    clientRes.writeHead(502, {
      'Content-Type': 'text/html',
      'Content-Length': String(Buffer.byteLength(errorPage)),
    });
    clientRes.end(errorPage);
  });

  // Forward the request body
  clientReq.pipe(proxyReq);
}
