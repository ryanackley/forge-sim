/**
 * Standalone OAuth callback host.
 *
 * Used by the CLI (`forge-sim auth --provider <key>`) when no dev server is
 * running on port 5173. Spins up a minimal HTTP server that ONLY handles
 * `/__tools/oauth/callback`, delegating to the in-process
 * `OAuthCallbackRegistry` singleton.
 *
 * When dev IS running, port 5173 is already bound by the dev server (which
 * has its own route forwarding to the same singleton). In that case, this
 * host is a no-op — the CLI would need cross-process coordination, which is
 * scoped to a later commit.
 *
 * Lifecycle:
 *   const host = await ensureCallbackHost();
 *   try { ...drive OAuth flow... }
 *   finally { await host.shutdown(); }
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import {
  getOAuthCallbackRegistry,
  OAUTH_CALLBACK_PATH,
  OAUTH_CALLBACK_PORT,
} from './oauth-callback-registry.js';

export interface CallbackHost {
  /** Whether this call actually bound a new server (vs. reusing dev). */
  bound: boolean;
  /** The port the callback URL points at. Matches OAUTH_CALLBACK_PORT. */
  port: number;
  /** Tear down the server (no-op if reusing dev). */
  shutdown: () => Promise<void>;
}

/**
 * Probe localhost:5173 for the forge-sim Tools API. If found, we reuse it.
 * Otherwise spin up a minimal callback-only server.
 *
 * Detection: the Tools API exposes `/__tools/api/manifest` which returns JSON
 * with an `appName` field. Plain "port 5173 in use" without forge-sim is
 * still treated as "can't bind" — we surface a clearer error in that case.
 */
export async function ensureCallbackHost(opts: { port?: number } = {}): Promise<CallbackHost> {
  const port = opts.port ?? OAUTH_CALLBACK_PORT;

  // Step 1: probe for an already-running forge-sim dev server.
  const devDetected = await probeForgeSimDev(port);
  if (devDetected) {
    // Dev server owns the route. The CLI flow in this commit doesn't yet
    // wire through the dev server's API — surface a clear error so we don't
    // silently drop the callback. (The Tools UI Providers panel in the next
    // commit is the right path when dev is running.)
    throw new Error(
      `forge-sim dev is running on port ${port}. Use the Tools UI Providers panel ` +
      `(http://localhost:${port}/__tools/) to add provider credentials, or stop dev ` +
      `and re-run \`forge-sim auth --provider <key>\`.`,
    );
  }

  // Step 2: spin up a minimal callback-only server.
  const server = createServer(handleRequest);

  await new Promise<void>((resolve, reject) => {
    const onError = (err: any) => {
      server.removeListener('error', onError);
      if (err?.code === 'EADDRINUSE') {
        reject(new Error(
          `Port ${port} is in use but not by forge-sim dev. Free the port and retry.`,
        ));
      } else {
        reject(err);
      }
    };
    server.once('error', onError);
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', onError);
      resolve();
    });
  });

  return {
    bound: true,
    port,
    shutdown: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', `http://localhost`);

  if (url.pathname !== OAUTH_CALLBACK_PATH || req.method !== 'GET') {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }

  const { status, html } = await getOAuthCallbackRegistry().handle({
    state: url.searchParams.get('state') ?? '',
    code: url.searchParams.get('code') ?? undefined,
    error: url.searchParams.get('error') ?? undefined,
  });

  res.writeHead(status, { 'Content-Type': 'text/html' });
  res.end(html);
}

/**
 * Return true if localhost:port responds as a forge-sim dev server.
 * Returns false on any non-200, network failure, or unexpected body shape.
 */
async function probeForgeSimDev(port: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 500);
    const res = await fetch(`http://localhost:${port}/__tools/api/manifest`, {
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) return false;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('application/json')) return false;
    const body = await res.json() as Record<string, any>;
    // Tools API manifest endpoint always returns an object with `appName`.
    return typeof body?.appName === 'string';
  } catch {
    return false;
  }
}
