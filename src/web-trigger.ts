/**
 * Web Trigger HTTP handler for forge-sim.
 *
 * Serves HTTP endpoints at /__trigger/<key> that invoke Forge web trigger
 * functions with the standard (request, context) calling convention.
 *
 * Forge web trigger request shape:
 *   { method, path, headers, queryParameters, body }
 *   - headers: Record<string, string[]> (multi-value)
 *   - queryParameters: Record<string, string[]> (multi-value)
 *   - body: string (raw)
 *
 * Forge web trigger response shape:
 *   { statusCode, headers, body }
 *   - headers: Record<string, string[]> (multi-value)
 *   - body: string
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ForgeSimulator } from './simulator.js';
import type { ManifestWebTrigger } from './manifest.js';

export interface WebTriggerConfig {
  /** Parsed web trigger definitions from manifest */
  triggers: ManifestWebTrigger[];
  /** Simulator instance for handler lookup and context */
  simulator: ForgeSimulator;
}

/**
 * Build the Forge-compatible request object from an incoming HTTP request.
 */
function buildForgeRequest(
  req: IncomingMessage,
  triggerKey: string,
  body: string,
  userPath: string,
): Record<string, any> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  // Headers → multi-value map (Forge sends string[] per header)
  const headers: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers[key.toLowerCase()] = Array.isArray(value) ? value : [value];
  }

  // Query params → multi-value map
  const queryParameters: Record<string, string[]> = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (!queryParameters[key]) queryParameters[key] = [];
    queryParameters[key].push(value);
  }

  return {
    method: req.method ?? 'GET',
    // `path` keeps the full pathname incl. the trigger prefix (matches Forge,
    // where it includes /x1/<id>). `userPath` is only the suffix the caller
    // appended after the trigger URL — "" when the bare URL was hit (WTR-007).
    path: url.pathname,
    userPath,
    headers,
    queryParameters,
    body,
  };
}

/**
 * Build a Forge context object for web trigger invocation.
 */
function buildWebTriggerContext(sim: ForgeSimulator, triggerKey: string): Record<string, any> {
  const account = sim.productApi.connectedAccount;
  return {
    installContext: `ari:cloud:jira::site/${account?.cloudId ?? 'sim-cloud-001'}`,
    principal: null, // Web triggers are anonymous (no user)
  };
}

/**
 * Read the full request body as a string.
 */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

/**
 * Create an HTTP request handler for web triggers.
 *
 * Returns a function that handles requests to /__trigger/<key>.
 * Returns true if the request was handled, false otherwise.
 */
export function createWebTriggerHandler(config: WebTriggerConfig) {
  const { triggers, simulator } = config;
  const triggerMap = new Map(triggers.map((t) => [t.key, t]));

  return async (
    req: IncomingMessage,
    res: ServerResponse,
    pathname: string,
  ): Promise<boolean> => {
    // Two invocation styles:
    //   1. Legacy dev route:   /__trigger/<moduleKey>[/user/path]
    //   2. Managed URL routes: /x1/<id>[/user/path] (v1) and
    //                          /public/<id>[/user/path] (v2)
    //      where <id> was minted by webTrigger.getUrl() (WebTriggerUrlRegistry).
    let triggerKey: string | undefined;
    let userPath = '';

    const legacyMatch = pathname.match(/^\/__trigger\/([^/]+)(\/.*)?$/);
    const managedMatch = pathname.match(/^\/(?:x1|public)\/([^/]+)(\/.*)?$/);

    if (legacyMatch) {
      triggerKey = legacyMatch[1];
      userPath = legacyMatch[2] ?? '';
    } else if (managedMatch) {
      const id = managedMatch[1];
      userPath = managedMatch[2] ?? '';
      triggerKey = simulator.webTriggerUrls.resolveId(id);
      if (!triggerKey) {
        // Unknown or deleted URL — must NOT invoke the handler (WTR-004).
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Web trigger URL not found or deleted' }));
        return true;
      }
    } else {
      return false;
    }

    const trigger = triggerMap.get(triggerKey);

    if (!trigger) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: `Web trigger "${triggerKey}" not found`,
        available: [...triggerMap.keys()],
      }));
      return true;
    }

    // Look up the handler function
    const handlerMap = simulator.resolver.getHandlerMap();
    const handler = handlerMap.get(trigger.functionKey);

    if (!handler) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: `Function "${trigger.functionKey}" not loaded for web trigger "${triggerKey}"`,
      }));
      return true;
    }

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
      res.end();
      return true;
    }

    try {
      const body = await readBody(req);
      const forgeRequest = buildForgeRequest(req, triggerKey, body, userPath);
      const context = buildWebTriggerContext(simulator, triggerKey);

      // Call with Forge web trigger convention: (request, context) as two args
      const result = await (handler as Function)(forgeRequest, context);

      // ── Static response mode (WTR-011) ────────────────────────────────
      // When the manifest declares response.type: static, the handler
      // returns { outputKey } and the HTTP response comes from the
      // matching configured output. Unknown outputKey → 500.
      if (trigger.responseType === 'static') {
        const outputKey = result?.outputKey;
        const output = (trigger.outputs ?? []).find((o) => o.key === outputKey);
        if (!output) {
          res.writeHead(500, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(JSON.stringify({
            error: `Web trigger "${triggerKey}" returned unknown outputKey "${outputKey}"`,
            available: (trigger.outputs ?? []).map((o) => o.key),
          }));
          console.log(`[forge-sim] [webtrigger] ${req.method} ${pathname} → 500 (unknown outputKey)`);
          return true;
        }
        res.writeHead(output.statusCode, {
          'Content-Type': output.contentType ?? 'text/plain',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(output.body ?? '');
        console.log(`[forge-sim] [webtrigger] ${req.method} ${pathname} → ${output.statusCode} (static output "${output.key}")`);
        return true;
      }

      // ── Dynamic response mode (default) ───────────────────────────────
      // WTR-009: the handler result must match the documented response
      // shape — an object with a numeric statusCode. Anything else (bare
      // string, undefined, missing/non-numeric statusCode) → 500, matching
      // real Forge, which rejects malformed results rather than guessing.
      if (
        result === null ||
        typeof result !== 'object' ||
        Array.isArray(result) ||
        typeof result.statusCode !== 'number'
      ) {
        res.writeHead(500, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify({
          error: `Web trigger "${triggerKey}" returned an invalid response: expected { statusCode: number, headers?, body? }`,
        }));
        console.error(
          `[forge-sim] [webtrigger] ${req.method} ${pathname} → 500 (invalid handler response: ${
            result === undefined ? 'undefined' : JSON.stringify(result)?.slice(0, 200)
          })`,
        );
        return true;
      }

      const statusCode = result.statusCode;
      const responseHeaders: Record<string, string> = {
        'Access-Control-Allow-Origin': '*',
      };

      // Forge headers are multi-value: { 'content-type': ['text/html'] }
      if (result?.headers) {
        for (const [key, values] of Object.entries(result.headers)) {
          if (Array.isArray(values) && values.length > 0) {
            responseHeaders[key] = (values as string[]).join(', ');
          } else if (typeof values === 'string') {
            responseHeaders[key] = values;
          }
        }
      }

      // Default content-type if not set
      if (!responseHeaders['content-type'] && !responseHeaders['Content-Type']) {
        responseHeaders['Content-Type'] = 'text/plain';
      }

      res.writeHead(statusCode, responseHeaders);
      res.end(result?.body ?? '');

      console.log(`[forge-sim] [webtrigger] ${req.method} ${pathname} → ${statusCode}`);
    } catch (err: any) {
      console.error(`[forge-sim] [webtrigger] ${triggerKey} threw: ${err.message}`);
      res.writeHead(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({
        error: 'Web trigger function threw an error',
        message: err.message,
      }));
    }

    return true;
  };
}

/**
 * Get the local URL for a web trigger (used by webTrigger.getUrl() shim).
 */
export function getWebTriggerUrl(triggerKey: string, port: number): string {
  return `http://localhost:${port}/__trigger/${triggerKey}`;
}
