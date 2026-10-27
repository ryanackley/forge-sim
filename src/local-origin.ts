/**
 * Loopback-origin policy for every HTTP and WebSocket surface forge-sim
 * serves on this machine.
 *
 * Each listener already binds 127.0.0.1, which keeps other machines out. It
 * does nothing against a page open in the developer's own browser: that
 * page's requests arrive from 127.0.0.1 too, and the tools API, the daemon
 * API and the bridge WebSocket run app code, SQL and KVS writes with no
 * auth. The browser's one signal is the `Origin` header, so that is what is
 * checked here: a request with no Origin comes from curl, the CLI or an MCP
 * client and passes; an Origin on localhost, 127.0.0.1 or ::1 (any port —
 * the dev page on 5173 opens the bridge on 5174) passes and is reflected in
 * the CORS answer; any other Origin is refused with 403 before a handler
 * runs. Wildcards never appear: `Access-Control-Allow-Origin: *` is exactly
 * what let a foreign page read the answers.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** True for no Origin (non-browser client) or a loopback Origin on any port. */
export function isLocalOrigin(origin: string | undefined | null): boolean {
  if (origin === undefined || origin === null || origin === '') return true;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false; // "null" (sandboxed/file: pages) and malformed values
  }
  return LOOPBACK_HOSTS.has(url.hostname);
}

export const FOREIGN_ORIGIN_MESSAGE =
  'Refused: this forge-sim endpoint only answers pages served from localhost. ' +
  'Open the dev server at http://localhost:<port>/ (or 127.0.0.1) and call it from there.';

/**
 * Apply the policy to an HTTP request. Returns true when the request may
 * proceed (CORS headers set for a loopback Origin; nothing set when there is
 * no Origin). On a foreign Origin, writes the 403 and returns false — the
 * caller must stop. A preflight (OPTIONS) from a loopback Origin is answered
 * here with 204 and also returns false, since the handler has nothing to do.
 */
export function applyLocalOriginPolicy(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers.origin;
  if (!isLocalOrigin(origin)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: FOREIGN_ORIGIN_MESSAGE, origin }));
    return false;
  }
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return false;
  }
  return true;
}

/**
 * Apply the policy to a WebSocket upgrade. Returns true when the upgrade may
 * proceed; on a foreign Origin, answers 403 on the raw socket, destroys it
 * and returns false.
 */
export function allowLocalUpgrade(req: IncomingMessage, socket: Duplex): boolean {
  if (isLocalOrigin(req.headers.origin)) return true;
  socket.write(
    'HTTP/1.1 403 Forbidden\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\n' +
    FOREIGN_ORIGIN_MESSAGE + '\n',
  );
  socket.destroy();
  return false;
}
