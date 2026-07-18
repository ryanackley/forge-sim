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

// ── In-process invocation core ────────────────────────────────────────────
// Shared by the HTTP route handler below, `sim.fireWebTrigger()`, and the
// MCP `forge.fire_web_trigger` tool — one code path for request shaping,
// handler invocation, response validation (WTR-009), and static outputs
// (WTR-011), so the surfaces cannot drift (eval B4/B5).

/**
 * Friendly request init for in-process web trigger firing. Everything is
 * optional — a bare `fireWebTrigger(key)` simulates `GET <trigger-url>`.
 * Header/query values accept string or string[]; they're normalized to the
 * multi-value string[] shape Forge delivers.
 */
export interface WebTriggerRequestInit {
  method?: string;
  /** Extra path appended after the trigger URL (Forge's `userPath`). */
  userPath?: string;
  headers?: Record<string, string | string[]>;
  queryParameters?: Record<string, string | string[]>;
  /** Raw body string — Forge always delivers the body as a string. An object is JSON-stringified as a convenience. */
  body?: string | Record<string, unknown> | unknown[];
}

/** Forge web trigger response shape (multi-value headers, string body). */
export interface WebTriggerResponse {
  statusCode: number;
  headers: Record<string, string[]>;
  body: string;
  /**
   * How to convert `body` back into wire bytes. Default 'utf8' (body is the
   * text the handler returned). 'latin1' means the body has been normalized
   * to a byte-per-char view of the wire bytes — set when a binary
   * content-type response contained non-ASCII characters (see
   * encodeBodyForWire / eval-7 F3).
   */
  bodyEncoding?: 'utf8' | 'latin1';
}

/**
 * Content types whose bodies are text on the wire — an HTTP client decodes
 * them back to the original string (UTF-8), so the handler's string is
 * already the faithful in-process representation. Everything else is
 * byte-oriented (images, octet-stream, pdf, ...).
 */
function isTextContentType(contentType: string): boolean {
  const ct = contentType.split(';')[0].trim().toLowerCase();
  return ct.startsWith('text/')
    || ct === 'application/json'
    || ct === 'application/javascript'
    || ct === 'application/xml'
    || ct === 'application/x-www-form-urlencoded'
    || ct.endsWith('+json')
    || ct.endsWith('+xml');
}

/**
 * Wire-faithfulness normalization (eval-7 F3). Web trigger bodies are
 * strings; both forge-sim's HTTP surface and real Forge UTF-8-encode them
 * onto the wire. A handler that stuffs raw binary into a latin1 string
 * (`buf.toString('latin1')`) gets corrupted on the wire — every byte ≥ 0x80
 * expands to two — but the in-process surface used to hand the string back
 * untouched, so tests could green-light an app that corrupts data over a
 * real socket.
 *
 * For binary content-types with non-ASCII characters, normalize the body to
 * the latin1 (byte-per-char) view of the actual wire bytes so every surface
 * — in-process, MCP, and HTTP — observes the same bytes, and warn loudly
 * with the fix (base64-encode binary bodies; real Forge requires it).
 * Text content-types are left untouched: an HTTP client decodes them back
 * to the original string, so the string IS the faithful representation.
 */
function encodeBodyForWire(
  triggerKey: string,
  body: string,
  headers: Record<string, string[]>,
): { body: string; bodyEncoding?: 'latin1' } {
  if (!/[^\x00-\x7F]/.test(body)) return { body };
  const ctEntry = Object.entries(headers).find(([k]) => k.toLowerCase() === 'content-type');
  const contentType = ctEntry?.[1]?.[0] ?? 'text/plain';
  if (isTextContentType(contentType)) return { body };

  const wire = Buffer.from(body, 'utf8');
  console.warn(
    `[forge-sim] [webtrigger] "${triggerKey}": response body contains non-ASCII characters ` +
    `with binary content-type "${contentType}". Web trigger bodies are strings and are ` +
    `UTF-8 encoded on the wire (real Forge does the same), so raw binary WILL be corrupted ` +
    `(${body.length} chars → ${wire.length} bytes). Base64-encode binary bodies instead. ` +
    `The response body now reflects the actual wire bytes on all surfaces.`,
  );
  return { body: wire.toString('latin1'), bodyEncoding: 'latin1' };
}

/**
 * Build the Forge request object from a friendly init (in-process path).
 */
export function buildInProcessForgeRequest(
  triggerKey: string,
  init: WebTriggerRequestInit = {},
): Record<string, any> {
  const normalizeMultiValue = (
    input?: Record<string, string | string[]>,
  ): Record<string, string[]> => {
    const out: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(input ?? {})) {
      out[key.toLowerCase()] = Array.isArray(value) ? value.map(String) : [String(value)];
    }
    return out;
  };

  const userPath = init.userPath ?? '';
  const body = init.body === undefined
    ? ''
    : typeof init.body === 'string' ? init.body : JSON.stringify(init.body);

  return {
    method: (init.method ?? 'GET').toUpperCase(),
    path: `/__trigger/${triggerKey}${userPath}`,
    userPath,
    headers: normalizeMultiValue(init.headers),
    queryParameters: normalizeMultiValue(init.queryParameters),
    body,
  };
}

/**
 * Invoke a web trigger handler with a Forge-shaped request and return the
 * Forge-shaped response the HTTP caller would see. Mirrors real Forge:
 * a throwing handler or a malformed result becomes a 500 *response*
 * (never a thrown error) because that's what the webhook caller observes.
 *
 * Throws only for simulation-setup problems the caller can fix:
 * unknown trigger key or a handler function that failed to load.
 */
export async function executeWebTrigger(
  simulator: ForgeSimulator,
  trigger: ManifestWebTrigger,
  forgeRequest: Record<string, any>,
): Promise<WebTriggerResponse> {
  // Function registry first (deploy registers web trigger functions with
  // type 'webTrigger'); fall back to the resolver handler map for
  // programmatic registration in tests.
  const handler = simulator.functions.getHandler(trigger.functionKey)
    ?? simulator.resolver.getHandlerMap().get(trigger.functionKey);

  if (!handler) {
    throw new Error(
      `Function "${trigger.functionKey}" not loaded for web trigger "${trigger.key}". ` +
      `Did the deploy succeed? Check the manifest's modules.function entry for "${trigger.functionKey}".`,
    );
  }

  const context = buildWebTriggerContext(simulator, trigger.key);

  let result: any;
  try {
    // Forge web trigger convention: (request, context) as two args.
    result = await (handler as Function)(forgeRequest, context);
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: { 'content-type': ['application/json'] },
      body: JSON.stringify({
        error: 'Web trigger function threw an error',
        message: err?.message ?? String(err),
      }),
    };
  }

  // ── Static response mode (WTR-011) ──────────────────────────────────────
  if (trigger.responseType === 'static') {
    const outputKey = result?.outputKey;
    const output = (trigger.outputs ?? []).find((o) => o.key === outputKey);
    if (!output) {
      return {
        statusCode: 500,
        headers: { 'content-type': ['application/json'] },
        body: JSON.stringify({
          error: `Web trigger "${trigger.key}" returned unknown outputKey "${outputKey}"`,
          available: (trigger.outputs ?? []).map((o) => o.key),
        }),
      };
    }
    const staticHeaders = { 'content-type': [output.contentType ?? 'text/plain'] };
    return {
      statusCode: output.statusCode,
      headers: staticHeaders,
      ...encodeBodyForWire(trigger.key, output.body ?? '', staticHeaders),
    };
  }

  // ── Dynamic response mode (WTR-009) ─────────────────────────────────────
  if (
    result === null ||
    typeof result !== 'object' ||
    Array.isArray(result) ||
    typeof result.statusCode !== 'number'
  ) {
    return {
      statusCode: 500,
      headers: { 'content-type': ['application/json'] },
      body: JSON.stringify({
        error: `Web trigger "${trigger.key}" returned an invalid response: expected { statusCode: number, headers?, body? }`,
        received: result === undefined ? 'undefined' : JSON.stringify(result)?.slice(0, 200),
      }),
    };
  }

  // Normalize handler headers to multi-value string[]. Key casing is
  // preserved exactly as the handler wrote it (eval 3 finding #4) — request
  // headers arrive lowercased (Node + Forge both do that), but the response
  // is the handler's to shape.
  const headers: Record<string, string[]> = {};
  if (result.headers && typeof result.headers === 'object') {
    for (const [key, values] of Object.entries(result.headers)) {
      if (Array.isArray(values) && values.length > 0) {
        headers[key] = (values as unknown[]).map(String);
      } else if (typeof values === 'string') {
        headers[key] = [values];
      }
    }
  }
  const hasContentType = Object.keys(headers).some(
    (k) => k.toLowerCase() === 'content-type',
  );
  if (!hasContentType) {
    headers['content-type'] = ['text/plain'];
  }

  const rawBody = result.body ?? '';
  return {
    statusCode: result.statusCode,
    headers,
    ...(typeof rawBody === 'string'
      ? encodeBodyForWire(trigger.key, rawBody, headers)
      : { body: rawBody }),
  };
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

      const response = await executeWebTrigger(simulator, trigger, forgeRequest);

      // Map the Forge-shaped response onto HTTP: multi-value headers are
      // joined, CORS is layered on for browser callers.
      const responseHeaders: Record<string, string> = {
        'Access-Control-Allow-Origin': '*',
      };
      for (const [key, values] of Object.entries(response.headers)) {
        responseHeaders[key] = values.join(', ');
      }

      res.writeHead(response.statusCode, responseHeaders);
      // A latin1-normalized body is a byte-per-char view of the wire bytes
      // (eval-7 F3) — write those exact bytes rather than letting Node
      // UTF-8-encode the normalized string (which would double-encode).
      res.end(
        response.bodyEncoding === 'latin1'
          ? Buffer.from(response.body, 'latin1')
          : response.body,
      );

      if (response.statusCode >= 500) {
        console.error(`[forge-sim] [webtrigger] ${req.method} ${pathname} → ${response.statusCode} (${response.body.slice(0, 200)})`);
      } else {
        console.log(`[forge-sim] [webtrigger] ${req.method} ${pathname} → ${response.statusCode}`);
      }
    } catch (err: any) {
      // executeWebTrigger throws only for setup problems (handler not
      // loaded). Handler exceptions and malformed results are already
      // mapped to 500 responses inside the core.
      console.error(`[forge-sim] [webtrigger] ${triggerKey}: ${err.message}`);
      res.writeHead(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({ error: err.message }));
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
