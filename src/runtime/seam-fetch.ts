/**
 * global.__forge_fetch__ — the backend I/O seam (Seam A).
 *
 * Every real backend `@forge/*` package funnels its platform I/O through this
 * one global (descriptor inventory with citations: seam-registry.ts). This
 * dispatcher routes each descriptor type to the sim subsystem the matching
 * shim already talks to, so a BUNDLED package (shape 2 — no import specifier
 * left to alias) behaves exactly like the shimmed one.
 *
 * Rules, inherited from the bridge consolidation:
 *  - Never resolve `undefined`: an unknown descriptor type or an unroutable
 *    platform operation rejects with a named error.
 *  - Frames come from reading `node_modules/@forge/<pkg>/out`, not memory —
 *    every path and body shape below cites its source.
 *  - Responses are real fetch Responses (fetch-response.ts): the packages
 *    call .json()/.text(), read .ok/.status/.statusText, and dispatch typed
 *    errors off the `forge-proxy-error` HEADER (api/out/api/fetch.js:66-75,
 *    endpoint.js:44-53, llm error-handling.js getUnstructuredForgeError) —
 *    that header is control flow, not diagnostics.
 */

import type { ForgeSimulator } from '../simulator.js';
import {
  ProductFetchResponse,
  ValueFetchResponse,
  type ProductApiResponseLike,
} from '../shims/fetch-response.js';
import { publishAppEventsViaTriggers } from '../app-events.js';
import { ObjectStoreError } from '../object-store.js';
import { LlmApiError } from '../llm.js';
import { noMockAnswer } from '../product-api.js';
import { buildForgeRuntime, currentInvocationRuntime } from './forge-runtime.js';
import type { ProductApiRequest } from '../types.js';

export interface ForgeFetchDescriptor {
  type?: string;
  provider?: string;
  remote?: string;
  service?: string;
  accountId?: string;
  contextAri?: string;
  model?: string;
}

export interface ForgeFetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  [key: string]: unknown;
}

export function installForgeFetch(sim: ForgeSimulator): void {
  (global as any).__forge_fetch__ = (
    descriptor: ForgeFetchDescriptor | null | undefined,
    path: string,
    init?: ForgeFetchInit,
  ) => dispatchForgeFetch(sim, descriptor ?? {}, path, init);
}

async function dispatchForgeFetch(
  sim: ForgeSimulator,
  descriptor: ForgeFetchDescriptor,
  path: string,
  init?: ForgeFetchInit,
): Promise<Response> {
  switch (descriptor.type) {
    case 'sql':
      return asResponse(await sim.sql.handleRequest(path, init));
    case 'kvs':
      return asResponse(await sim.kvs.handleRequest(path, init));
    case 'os':
      return handleObjectStore(sim, path, init);
    case 'llm':
      return handleLlm(sim, path, init);
    case 'realtime':
      return handleRealtime(sim, parseJsonBody(init));
    case 'frc':
      return handleRemoteInvoke(sim, descriptor, path, init);
    case 'fcc':
      // Same posture as the @forge/api shim: container services are an
      // Atlassian developer preview (roadmap watch item #19). Faking
      // INVALID_SERVICE_KEY would misreport "sim doesn't support this" as
      // "your key is wrong".
      throw new Error(
        `forge-sim: invokeService("${descriptor.service}") — container services are not yet ` +
        `implemented (Atlassian developer preview, roadmap watch item #19).`
      );
    case 'tpp':
      return handleThirdParty(sim, descriptor, path, init);
    case 'fpp':
      return handleProduct(sim, descriptor, path, init);
    default:
      // Lesson 4 from the bridge work: a missing case that returns undefined
      // surfaces as a failure somewhere unrelated. Every type the installed
      // packages can send is in FETCH_DESCRIPTORS (runtime-seam.test.ts
      // re-derives that), so an unknown one here means a package bump added
      // a protocol — fail where it's diagnosable.
      throw new Error(
        `forge-sim: unknown __forge_fetch__ descriptor type "${descriptor.type}" for path ` +
        `"${path}". The seam registry (src/runtime/seam-registry.ts) doesn't know it — if a ` +
        `@forge/* package bump added it, runtime-seam.test.ts should be failing too.`
      );
  }
}

// ── Response plumbing ───────────────────────────────────────────────────────

/** Sim subsystems return fetch-LIKE objects ({status, headers, json(), text()}); normalize to a real Response. */
function asResponse(result: unknown): Response {
  if (result instanceof Response) return result;
  const r = result as {
    status: number;
    statusText?: string;
    headers?: unknown;
    json?: () => Promise<unknown>;
    text?: () => Promise<string>;
    body?: unknown;
  };
  const headers = plainHeaders(r.headers);
  if (typeof r.json === 'function' && typeof r.text === 'function') {
    return new ProductFetchResponse({
      status: r.status,
      statusText: r.statusText ?? (r.status >= 200 && r.status < 300 ? 'OK' : 'Error'),
      headers,
      json: r.json.bind(r),
      text: r.text.bind(r),
    } as ProductApiResponseLike);
  }
  return new ValueFetchResponse(r.body ?? '', r.status, r.statusText, headers);
}

/** kvs returns headers with get()/has() mixed into the record; keep only the string entries. */
function plainHeaders(headers: unknown): Record<string, string> {
  if (!headers || typeof headers !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

function json(status: number, body: unknown, headers?: Record<string, string>): Response {
  return new ValueFetchResponse(body, status, undefined, {
    'content-type': 'application/json',
    ...headers,
  });
}

/**
 * A failure delivered on the channel the real packages branch on:
 * handleProxyResponseErrors reads the `forge-proxy-error` header and throws
 * the matching typed error (NeedsAuthenticationError, InvalidRemoteError, …).
 */
function proxyError(status: number, code: string, message: string): Response {
  return json(status, { code, message }, { 'forge-proxy-error': code });
}

function parseJsonBody(init?: ForgeFetchInit): Record<string, any> {
  if (!init?.body) return {};
  try {
    return JSON.parse(init.body);
  } catch {
    return {};
  }
}

// ── fpp: product REST + the Forge platform operations that ride on it ───────

/**
 * Most fpp traffic is requestJira/requestConfluence/requestBitbucket and goes
 * to the product-API mock layer, same as before. Three Forge platform
 * surfaces arrive under fpp because their packages call through
 * @forge/api's __requestAtlassianAsApp (seam-registry.ts `riders`):
 *
 *  - @forge/events queue: POST /webhook/queue/{publish|stats|cancel}/… with
 *    the {contextAri} placeholders UNEXPANDED — the real proxy fills them
 *    server-side (events/out/queries.js:4-6). Push expects 201, stats 200,
 *    cancel 204; a 404 on stats/cancel is how the package reports
 *    JobDoesNotExistError (events/out/validators.js:107-123).
 *  - @forge/events appEvents: POST /forge/events/v1/app-events
 *    {events:[{key}]} → 200 {failedEvents} (events/out/appEvents.js:15-37).
 *  - @forge/api webTrigger: GraphQL on /graphql — forge_app_createWebTriggerUrl,
 *    forge_app_deleteWebTriggerUrl, webTriggerUrlsByAppContext
 *    (api/out/webTrigger.js:22-118).
 */
async function handleProduct(
  sim: ForgeSimulator,
  descriptor: ForgeFetchDescriptor,
  path: string,
  init?: ForgeFetchInit,
): Promise<Response> {
  if (path.startsWith('/webhook/queue/')) {
    return handleQueueApi(sim, path, parseJsonBody(init));
  }
  if (path === '/forge/events/v1/app-events') {
    const body = parseJsonBody(init);
    const { failedEvents } = await publishAppEventsViaTriggers(sim, body.events ?? []);
    return json(200, { failedEvents });
  }
  if (path === '/graphql') {
    const handled = await handleStargateGraphql(sim, parseJsonBody(init));
    if (handled) return handled;
    // Not a Forge platform operation — the app's own requestGraph traffic;
    // fall through to the gateway product, whose first layer is the
    // operation-name mocks (sim.mockGraphQL).
  }
  if (path === '/forge/entities/graphql') {
    // The `storage` export of @forge/api ≤ 7 talked to this endpoint.
    // Atlassian removed it in June 2026; the bundled package is older than
    // the platform it targets.
    throw new Error(
      `forge-sim: @forge/api's legacy \`storage\` export was removed by Atlassian (June 2026) and ` +
      `its endpoint ${path} no longer exists. Migrate to @forge/kvs (kvs.get/set/delete, ` +
      `kvs.entity()) and bump @forge/api.`,
    );
  }
  const product = productFor(descriptor);
  const actor = actingUser(sim, descriptor);
  if ('refused' in actor) return actor.refused;
  const options: ProductApiRequest = {
    ...(init ?? {}),
    ...(descriptor.provider !== undefined ? { provider: descriptor.provider } : {}),
    ...actor,
  };
  return asResponse(await sim.productApi.request(product, path, options));
}

const IMPERSONATION_DOC = 'https://developer.atlassian.com/platform/forge/manifest-reference/permissions/';

/**
 * The mock-layer product a descriptor addresses. Plain product requests and
 * the gateway name their remote (api/out/api/fetch.js:185-200). `withContext`
 * (:136-143) sends no remote, only the installation context ARI, and the
 * product is the ARI's resource owner: ari:cloud:jira::site/…,
 * ari:cloud:confluence::site/…, ari:cloud:bitbucket::workspace/….
 */
function productFor(descriptor: ForgeFetchDescriptor): string {
  if (descriptor.remote) return descriptor.remote;
  if (descriptor.contextAri) {
    const owner = /^ari:cloud:([a-z-]+):/.exec(descriptor.contextAri)?.[1];
    if (owner === 'jira' || owner === 'confluence' || owner === 'bitbucket') return owner;
    throw new Error(
      `forge-sim: withContext("${descriptor.contextAri}") is not implemented for that context: ` +
      `only Jira, Confluence and Bitbucket installation ARIs are routed ` +
      `(ari:cloud:jira::site/<cloudId>, ari:cloud:confluence::site/<cloudId>, ` +
      `ari:cloud:bitbucket::workspace/<id>).`,
    );
  }
  return descriptor.provider ?? 'unknown';
}

/**
 * Who a product request acts as. `asApp()` needs nobody. `asUser()` needs the
 * invoking user, and Forge attaches one only to user-invoked kinds
 * (function-registry.ts): from a scheduled trigger, web trigger, event
 * trigger, consumer, pre-uninstall, custom field value, workflow or JQL
 * function the proxy answers 401 with `forge-proxy-error:
 * NEEDS_AUTHENTICATION_ERR`, which the real package turns into
 * NeedsAuthenticationError('Authentication Required',
 * 'atlassian-token-service-key') (api/out/api/fetch.js:66-74).
 * `asUser(accountId)` for another user is offline impersonation and needs a
 * scope declared with `allowImpersonation: true`; without one it gets the
 * same 401.
 */
function actingUser(
  sim: ForgeSimulator,
  descriptor: ForgeFetchDescriptor,
): { accountId?: string } | { refused: Response } {
  if (descriptor.provider !== 'user') return {};
  const invoking = buildForgeRuntime(sim).aaid;
  const requested = descriptor.accountId;
  if (requested !== undefined && requested !== invoking) {
    if ((sim.getManifest()?.impersonationScopes.length ?? 0) === 0) {
      return noUser(
        `asUser("${requested}") is offline user impersonation, which needs a scope declared ` +
          `with allowImpersonation: true under permissions.scopes (${IMPERSONATION_DOC}).`,
      );
    }
    return { accountId: requested };
  }
  if (invoking === undefined) {
    const kind = currentInvocationRuntime()?.moduleType ?? 'this';
    return noUser(
      `asUser() has no user to act as: a ${kind} invocation runs as the app, without a user ` +
        `context. Use asApp(), or asUser(accountId) with a scope declared allowImpersonation: ` +
        `true (${IMPERSONATION_DOC}).`,
    );
  }
  return { accountId: invoking };
}

/**
 * The real package throws NeedsAuthenticationError('Authentication Required')
 * off the header alone and never shows the body, so the explanation goes to
 * the console, which the invocation captures into the sim's console log.
 */
function noUser(message: string): { refused: Response } {
  console.warn(`[forge-sim] ${message}`);
  return { refused: proxyError(401, 'NEEDS_AUTHENTICATION_ERR', message) };
}

async function handleQueueApi(
  sim: ForgeSimulator,
  path: string,
  body: Record<string, any>,
): Promise<Response> {
  const op = path.split('/')[3]; // /webhook/queue/<op>/{contextAri}/...
  switch (op) {
    case 'publish': {
      try {
        // The push request carries the client-minted jobId and the events as
        // `payload` (events/out/queue.js:20-28); honoring that id is what
        // makes the later getStats/cancel calls find the job.
        await sim.queue.push(body.queueName, body.payload ?? [], { jobId: body.jobId });
        return json(201, {});
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // The package maps 413 to PayloadTooBigError with the body's
        // errorMessage (events/out/validators.js:82-85).
        if (message.startsWith('PayloadTooBigError')) {
          return json(413, { errorMessage: message });
        }
        return json(500, { message });
      }
    }
    case 'stats': {
      const job = sim.queue.getJob(body.jobId);
      if (!job) return json(404, {});
      return json(200, { ...job.stats });
    }
    case 'cancel': {
      const job = sim.queue.getJob(body.jobId);
      if (!job) return json(404, {});
      sim.queue.cancelJob(body.jobId);
      return new ValueFetchResponse('', 204);
    }
    default:
      throw new Error(
        `forge-sim: unknown @forge/events queue operation "${op}" (path "${path}"). ` +
        `Known: publish, stats, cancel — a package bump may have added one.`
      );
  }
}

async function handleStargateGraphql(
  sim: ForgeSimulator,
  body: Record<string, any>,
): Promise<Response | null> {
  const query: string = typeof body.query === 'string' ? body.query : '';
  const variables = (body.variables ?? {}) as Record<string, any>;

  if (query.includes('createWebTriggerUrl')) {
    try {
      const url = await sim.webTriggerUrls.getUrl(
        variables.input?.triggerKey,
        variables.forceCreate ?? false,
      );
      return json(200, { data: { createWebTriggerUrl: { url } } });
    } catch (err) {
      return json(200, {
        data: null,
        errors: [{ message: err instanceof Error ? err.message : String(err) }],
      });
    }
  }

  if (query.includes('deleteWebTriggerUrl')) {
    try {
      // The client already parsed the id out of the URL and sends only {id}
      // (api/out/webTrigger.js:48-70); the registry's deleteUrl re-parses an
      // /x1/ URL, so reconstruct the shape its regex expects.
      await sim.webTriggerUrls.deleteUrl(`/x1/${variables.id}`);
      return json(200, { data: { deleteWebTriggerUrl: { success: true } } });
    } catch (err) {
      return json(200, {
        data: {
          deleteWebTriggerUrl: {
            success: false,
            message: err instanceof Error ? err.message : String(err),
          },
        },
      });
    }
  }

  if (query.includes('webTriggerUrlsByAppContext')) {
    const urls = await sim.webTriggerUrls.queryUrls();
    return json(200, {
      data: {
        webTriggerUrlsByAppContext: urls.map((u) => ({ triggerKey: u.moduleKey, url: u.url })),
      },
    });
  }

  return null;
}

// ── os: @forge/object-store ─────────────────────────────────────────────────

/**
 * Seven JSON POST endpoints (object-store/out/object-store.js:43-86 — note
 * the paths have NO leading slash). Content bytes never cross this seam: the
 * package PUTs/GETs them against the minted URLs over plain fetch, which
 * SimulatedObjectStore already serves over real HTTP. The client treats 404
 * as undefined and an empty body as undefined (requestJson, :22-42).
 */
/**
 * Real Forge requires a `modules.objectStore` entry to enable Object Store.
 * The exact module shape is undocumented (forge-spec open question #9), so
 * the sim is permissive — warn once per simulator instead of failing. Lived
 * in the @forge/object-store shim until phase 3c; at the seam it fires for
 * bundled and unbundled apps alike.
 */
const warnedMissingObjectStoreModule = new WeakSet<ForgeSimulator>();

async function handleObjectStore(
  sim: ForgeSimulator,
  path: string,
  init?: ForgeFetchInit,
): Promise<Response> {
  if (!warnedMissingObjectStoreModule.has(sim)) {
    warnedMissingObjectStoreModule.add(sim);
    const manifest = sim.getManifest();
    const modules = manifest?.raw?.modules as Record<string, unknown> | undefined;
    if (manifest && (!modules || !('objectStore' in modules))) {
      console.warn(
        '[forge-sim] ⚠️ @forge/object-store used without an `objectStore` module in the manifest. ' +
        'Real Forge requires one to enable Object Store — continuing anyway.'
      );
    }
  }
  const body = parseJsonBody(init);
  const endpoint = path.replace(/^\//, '');
  const store = sim.objectStore;

  try {
    switch (endpoint) {
      case 'api/v1/metadata': {
        const ref = await store.get(body.key, { cdn: body.cdn });
        return ref ? json(200, ref) : json(404, { code: 'NOT_FOUND', message: `No object for key "${body.key}"` });
      }
      case 'api/v1/delete':
        await store.delete(body.key, { cdn: body.cdn });
        return new ValueFetchResponse('', 200);
      case 'api/v1/upload-url':
        return json(200, await store.createUploadUrl(body as any));
      case 'api/v1/public-upload-url':
        return json(200, await store.createPublicUploadUrl(body as any));
      case 'api/v1/download-url': {
        const result = await store.createDownloadUrl(body.key, { cdn: body.cdn });
        return result ? json(200, result) : json(404, { code: 'NOT_FOUND', message: `No object for key "${body.key}"` });
      }
      case 'api/v1/public-download-url': {
        const result = await store.createPublicDownloadUrl(body.key, { cdn: body.cdn });
        return result ? json(200, result) : json(404, { code: 'NOT_FOUND', message: `No object for key "${body.key}"` });
      }
      case 'api/v1/cdn-url': {
        const result = await store.createCDNUrl(body.key, { ttlSeconds: body.ttlSeconds });
        return result ? json(200, result) : json(404, { code: 'NOT_FOUND', message: `No object for key "${body.key}"` });
      }
      default:
        throw new Error(
          `forge-sim: unknown @forge/object-store endpoint "${path}". ` +
          `A package bump may have added one — check object-store/out/object-store.js.`
        );
    }
  } catch (err) {
    if (err instanceof ObjectStoreError) {
      const status = err.code === 'KEY_ALREADY_EXISTS' ? 409 : 400;
      return json(status, { code: err.code, message: err.message });
    }
    throw err;
  }
}

// ── llm: @forge/llm ─────────────────────────────────────────────────────────

/**
 * GET https://llm → model list; POST https://llm/<model> → chat, with
 * `stream` in the body (llm/out/llm-client.js:7,39-41, llm-api.js:15-40).
 * A stream response is newline-delimited JSON chunks (llm-stream-parser.js),
 * and the package reads it via response.body — so the stream case must be a
 * NATIVE Response, whose string body exposes a real ReadableStream.
 * Errors surface as !ok with a {code, message} body (error-handling.js).
 */
async function handleLlm(
  sim: ForgeSimulator,
  path: string,
  init?: ForgeFetchInit,
): Promise<Response> {
  try {
    if ((init?.method ?? 'GET').toUpperCase() === 'GET') {
      return json(200, await sim.llm.list());
    }
    const model = decodeURIComponent(path.replace(/^https:\/\/llm\/?/, ''));
    const { stream, ...request } = parseJsonBody(init);
    const result = await sim.llm.chat({ model, ...request } as any);
    if (stream) {
      return new Response(JSON.stringify(result) + '\n', {
        status: 200,
        headers: { 'content-type': 'application/x-ndjson' },
      });
    }
    return json(200, result);
  } catch (err) {
    if (err instanceof LlmApiError) {
      return json(err.code === 'NO_API_KEY' ? 401 : 500, {
        code: err.code,
        message: err.message,
      });
    }
    throw err;
  }
}

// ── realtime: @forge/realtime ───────────────────────────────────────────────

/**
 * POST '/' with a GraphQL body: publishRealtimeChannel (publish.js:7-27) or
 * signRealtimeToken (signRealtimeToken.js:5-29). The package reads errors
 * from the TOP-LEVEL GraphQL errors array (publish.js:62-65,
 * signRealtimeToken.js:64-69), so sim-side failures (e.g. the scoped-publish
 * "Unauthorized request" gate) map there, keeping their messages.
 */
async function handleRealtime(
  sim: ForgeSimulator,
  body: Record<string, any>,
): Promise<Response> {
  const query: string = typeof body.query === 'string' ? body.query : '';
  const variables = (body.variables ?? {}) as Record<string, any>;

  if (query.includes('publishRealtimeChannel')) {
    // `payload` crosses the wire pre-stringified (publish.js:92) and the real
    // service parses it before delivery — subscribers receive the VALUE, not
    // the JSON string. Sim publish treats a string payload as opaque, so
    // parse here; the round-trip is identity for every JSON type (a string
    // payload 'hi' arrives as '"hi"' and parses back to 'hi').
    let payload: unknown = variables.payload;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        // Unreachable from the real client (it always JSON.stringifies);
        // deliver the raw string rather than invent a failure.
      }
    }
    const options: Record<string, unknown> = { token: variables.token ?? undefined };
    if (typeof variables.context === 'string') {
      try {
        options.contextOverrides = JSON.parse(variables.context).contextOverrides;
      } catch {
        /* malformed context falls back to no overrides, same as absent */
      }
    }
    const result = variables.isGlobal
      ? await sim.realtime.publishGlobal(variables.name, payload as any, { token: options.token as string | undefined })
      : await sim.realtime.publish(variables.name, payload as any, options as any);
    if (result.errors?.length) {
      return json(200, { errors: result.errors });
    }
    return json(200, {
      data: {
        ecosystem: {
          publishRealtimeChannel: {
            eventId: result.eventId,
            eventTimestamp: result.eventTimestamp,
          },
        },
      },
    });
  }

  if (query.includes('signRealtimeToken')) {
    const result = await sim.realtime.signRealtimeToken(
      variables.channelName,
      variables.claims,
      variables.permissions,
    );
    if (result.errors?.length) {
      return json(200, { errors: result.errors });
    }
    return json(200, {
      data: {
        ecosystem: {
          signRealtimeToken: {
            forgeRealtimeToken: { jwt: result.token, expiresAt: result.expiresAt },
            success: true,
            errors: null,
          },
        },
      },
    });
  }

  throw new Error(
    `forge-sim: unknown @forge/realtime operation. Known: publishRealtimeChannel, ` +
    `signRealtimeToken — a package bump may have added one (check realtime/out/*.js).`
  );
}

// ── frc: @forge/api invokeRemote ────────────────────────────────────────────

async function handleRemoteInvoke(
  sim: ForgeSimulator,
  descriptor: ForgeFetchDescriptor,
  path: string,
  init?: ForgeFetchInit,
): Promise<Response> {
  const remoteKey = descriptor.remote ?? '';
  if (!sim.getManifest()?.remotes.get(remoteKey)) {
    // The header is what makes the real package throw InvalidRemoteError
    // instead of a generic failure (api/out/api/endpoint.js:44-53).
    return proxyError(
      404,
      'INVALID_REMOTE',
      `No remote "${remoteKey}" in the manifest. Available: ` +
      `${[...(sim.getManifest()?.remotes.keys() ?? [])].join(', ') || 'none'}`,
    );
  }
  const result = await sim.remotes.invoke(remoteKey, {
    path,
    method: init?.method,
    headers: init?.headers,
    body: init?.body,
  });
  return asResponse(result);
}

// ── tpp: @forge/api withProvider().fetch() ──────────────────────────────────

/**
 * Mock-first, mirroring the shim (forge-api.ts makeExternalAuthAccountMethods):
 * a matched mock route answers regardless of credentials. Past the mocks, a
 * configured provider with no stored token gets NEEDS_AUTHENTICATION_ERR on
 * the proxy-error header — the real package converts that to
 * NeedsAuthenticationError, which is the code path apps catch to drive their
 * auth prompt. A provider with a valid token gets real HTTP with the bearer
 * injected. No provider config: the mock layer's 501 passes through.
 */
async function handleThirdParty(
  sim: ForgeSimulator,
  descriptor: ForgeFetchDescriptor,
  path: string,
  init?: ForgeFetchInit,
): Promise<Response> {
  const providerKey = descriptor.provider ?? '';
  const mockProduct = descriptor.remote ?? providerKey;
  const mock = await sim.productApi.request(mockProduct, path, init);
  // Past the mocks only when NOTHING is mocked for this provider remote: a
  // mock's answer is final whatever its status (`mockResponse(501)`
  // included), so a mocked call never reaches the provider WITH the stored
  // bearer token.
  if (noMockAnswer(mock) !== 'unmocked') return asResponse(mock);

  const provider = sim.externalAuth.getProvider(providerKey);
  if (provider) {
    const token = await sim.externalAuth.ensureValidToken(providerKey);
    if (!token) {
      return proxyError(
        401,
        'NEEDS_AUTHENTICATION_ERR',
        `Provider "${providerKey}" is configured but has no stored credentials. ` +
        `Run \`forge-sim auth\` (or seed a token) to authorize it.`,
      );
    }
    const baseUrl = sim.externalAuth.getProviderBaseUrl(providerKey, descriptor.remote);
    if (baseUrl) {
      const fullUrl = path.startsWith('/') ? `${baseUrl}${path}` : `${baseUrl}/${path}`;
      const headers: Record<string, string> = { ...init?.headers };
      if ((provider.bearerMethod ?? 'authorization-header') === 'uri-query') {
        const u = new URL(fullUrl);
        u.searchParams.set('access_token', token.accessToken);
        return globalThis.fetch(u.toString(), { ...init, headers });
      }
      headers['Authorization'] = `Bearer ${token.accessToken}`;
      return globalThis.fetch(fullUrl, { ...init, headers });
    }
  }
  return asResponse(mock);
}
