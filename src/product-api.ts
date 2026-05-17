/**
 * Simulated Product API (requestJira, requestConfluence, etc.)
 *
 * Provides mock handlers that can be configured per-test or use defaults.
 * Mirrors the @forge/api `api.asUser().requestJira(route`...`)` pattern.
 */

import type { ProductApiHandler, ProductApiRequest, ProductApiResponse } from './types.js';
import type { AtlassianAccount } from './auth/credentials.js';
import type { PropertyStore } from './property-store.js';

function makeResponse(
  status: number,
  body: any,
  headers: Record<string, string> = {}
): ProductApiResponse {
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    headers: { 'content-type': 'application/json', ...headers },
    ok: status >= 200 && status < 300,
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
    text: async () => bodyStr,
  };
}

// ── Non-200 mock responses ──────────────────────────────────────────────
//
// `mockRoutes` has historically only supported 200 OK responses: the value
// for a route became the body, and the status was hardcoded. That hid a
// real class of test — "what does my app do when this PUT fails?" — and
// quietly swallowed user attempts to specify status (e.g. `{ __status: 500 }`
// passed straight through as a body). Skill run #13 surfaced this as the
// main ergonomic gap.
//
// We follow MSW's spirit: keep a bare-body shortcut for the 200 case, but
// provide an explicit `mockResponse(status, body?, headers?)` factory for
// anything else. The factory returns a plain object with a marker property
// so it survives JSON round-trip (which matters for the MCP path — agents
// can construct the literal directly when they can't import the factory).
//
// Detection rule: a route value (or a function's return value) is a
// MockResponseTag if it's an object with `__forgeSimMockResponse === true`.
// Bare values are wrapped as 200 OK bodies.

/** Marker property used to distinguish a `mockResponse(...)` from a plain
 *  body object. Long and specific so it can't plausibly collide with real
 *  product API payloads. */
export const MOCK_RESPONSE_MARKER = '__forgeSimMockResponse' as const;

/**
 * Tagged plain object returned by `mockResponse(...)`. Plain object (not
 * a class instance) so it survives JSON serialization across the MCP
 * boundary — agents can construct the literal shape directly:
 *
 *   { __forgeSimMockResponse: true, status: 500, body: { error: '...' } }
 *
 * is equivalent to in-process:
 *
 *   mockResponse(500, { error: '...' })
 */
export interface MockResponseTag {
  __forgeSimMockResponse: true;
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Build an explicit response for `sim.mockRoutes(...)`. Use this for any
 * route that needs a non-200 status, custom headers, or a deliberately-
 * empty body.
 *
 * Examples:
 *   mockResponse(500)                                 // 500 Internal Server Error, no body
 *   mockResponse(404, { error: 'not found' })        // 404 with JSON body
 *   mockResponse(429, { msg: '...' }, { 'Retry-After': '60' })
 *   mockResponse(204)                                 // 204 No Content
 *
 * Lambda routes can also return one of these for per-request control:
 *   sim.mockRoutes('jira', {
 *     'PUT /rest/api/3/issue/:key': (path) =>
 *       path.endsWith('FAIL') ? mockResponse(500, { error: 'oops' }) : { ok: true },
 *   })
 */
export function mockResponse(
  status: number,
  body?: unknown,
  headers?: Record<string, string>,
): MockResponseTag {
  return {
    [MOCK_RESPONSE_MARKER]: true,
    status,
    body,
    headers,
  };
}

/** Type guard for the tagged response shape. Tolerates the value being null,
 *  a primitive, or an object without the marker — only returns true for the
 *  exact shape produced by `mockResponse(...)`. */
function isMockResponseTag(value: unknown): value is MockResponseTag {
  return (
    typeof value === 'object'
    && value !== null
    && (value as Record<string, unknown>)[MOCK_RESPONSE_MARKER] === true
    && typeof (value as MockResponseTag).status === 'number'
  );
}

/**
 * Unwrap a route value (or a lambda return) into the (status, body, headers)
 * triple expected by `makeResponse`. Bare values become 200 OK bodies; the
 * tagged factory shape carries through.
 *
 * Throws on a known footgun shape — `{ __status: <number> }` — because the
 * agent in skill run #13 tried that and it was silently accepted as a body.
 * Failing loudly here points the next person directly at `mockResponse`.
 */
function unwrapMockResponse(value: unknown): {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
} {
  if (isMockResponseTag(value)) {
    return { status: value.status, body: value.body, headers: value.headers };
  }
  // Catch the most common misuse pattern: someone reached for `__status`
  // (or `_status`) thinking it would set the response code. Silent
  // pass-through is the dangerous behavior — call it out clearly.
  if (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && (
      typeof (value as Record<string, unknown>).__status === 'number'
      || typeof (value as Record<string, unknown>)._status === 'number'
    )
  ) {
    throw new Error(
      'mockRoutes value looks like an attempt to set a status code with `__status`/`_status`, ' +
      'but those keys are not recognized. Use the `mockResponse(status, body?, headers?)` factory ' +
      'from `forge-sim` instead, or — if calling via MCP — pass the literal shape ' +
      '`{ __forgeSimMockResponse: true, status: <n>, body?: <any>, headers?: {...} }`.'
    );
  }
  return { status: 200, body: value };
}

/**
 * Default handler that returns a helpful error for unmocked API calls.
 */
function unmockedHandler(product: string): ProductApiHandler {
  return (path: string) => {
    return makeResponse(501, {
      error: `Unmocked ${product} API call: ${path}. Register a handler with sim.mockProductApi('${product}', handler)`,
    });
  };
}

// ── Product → base URL mapping ──────────────────────────────────────────

const PRODUCT_BASE_URLS: Record<string, (cloudId: string) => string> = {
  jira: (cloudId) => `https://api.atlassian.com/ex/jira/${cloudId}`,
  confluence: (cloudId) => `https://api.atlassian.com/ex/confluence/${cloudId}`,
  bitbucket: () => `https://api.bitbucket.org/2.0`,
};

// ── GraphQL types ───────────────────────────────────────────────────────

export type GraphQLHandler = (
  query: string,
  variables?: Record<string, any>,
) => any | Promise<any>;

/**
 * Extract the operation name from a GraphQL query string.
 * Matches: query OperationName, mutation OperationName, subscription OperationName
 * Returns null for anonymous operations.
 */
function extractOperationName(query: string): string | null {
  const match = query.match(/(?:query|mutation|subscription)\s+(\w+)/);
  return match ? match[1] : null;
}

export class SimulatedProductApi {
  private handlers = new Map<string, ProductApiHandler>();
  private mockRouteHandlers = new Map<string, ProductApiHandler>();
  private graphqlMocks = new Map<string, GraphQLHandler | any>();
  private realApiAccount: AtlassianAccount | null = null;
  private onTokenRefresh?: (account: AtlassianAccount) => void;
  private propertyStore: PropertyStore | null = null;

  constructor() {
    // Set up defaults that return helpful errors
    for (const product of ['jira', 'confluence', 'bitbucket']) {
      this.handlers.set(product, unmockedHandler(product));
    }
  }

  /**
   * Register a PropertyStore for handling issue/content/space property routes.
   * Property routes are checked before mock routes and real API.
   */
  registerPropertyStore(store: PropertyStore): void {
    this.propertyStore = store;
  }

  /**
   * Connect to real Atlassian APIs using an OAuth account.
   * Mock routes still take priority — real API is the fallback.
   */
  connectRealApis(
    account: AtlassianAccount,
    options?: { onTokenRefresh?: (account: AtlassianAccount) => void },
  ): void {
    this.realApiAccount = account;
    this.onTokenRefresh = options?.onTokenRefresh;

    // Set up real API handlers for each product
    for (const [product, baseUrlFn] of Object.entries(PRODUCT_BASE_URLS)) {
      const realHandler = this.createRealHandler(product, baseUrlFn);
      this.handlers.set(product, realHandler);
    }

    console.log(`  📡 Connected to real APIs as ${account.name} @ ${account.site}`);
  }

  /**
   * Disconnect from real APIs, revert to mocks.
   */
  disconnectRealApis(): void {
    this.realApiAccount = null;
    this.onTokenRefresh = undefined;
    for (const product of ['jira', 'confluence', 'bitbucket']) {
      if (!this.mockRouteHandlers.has(product)) {
        this.handlers.set(product, unmockedHandler(product));
      }
    }
  }

  get isRealMode(): boolean {
    return this.realApiAccount !== null;
  }

  get connectedAccount(): AtlassianAccount | null {
    return this.realApiAccount;
  }

  private createRealHandler(product: string, baseUrlFn: (cloudId: string) => string): ProductApiHandler {
    return async (path: string, options?: ProductApiRequest): Promise<ProductApiResponse> => {
      // Check mock routes first — they take priority over real API
      const mockHandler = this.mockRouteHandlers.get(product);
      if (mockHandler) {
        const mockResult = await mockHandler(path, options);
        // If mock returned a real match (not 404 from route matching), use it
        if (mockResult.status !== 404) {
          return mockResult;
        }
      }

      // Real API call
      if (!this.realApiAccount) {
        return makeResponse(501, { error: 'Not connected to real APIs' });
      }

      // Token refresh if needed
      await this.ensureValidToken();

      // PAT uses site URL directly, OAuth uses api.atlassian.com proxy
      const baseUrl = this.realApiAccount.authType === 'pat'
        ? `https://${this.realApiAccount.site}`
        : baseUrlFn(this.realApiAccount.cloudId);
      const url = `${baseUrl}${path}`;

      // PAT uses Basic auth (email:token), OAuth uses Bearer
      const authHeader = this.realApiAccount.authType === 'pat'
        ? `Basic ${Buffer.from(`${this.realApiAccount.email}:${this.realApiAccount.accessToken}`).toString('base64')}`
        : `Bearer ${this.realApiAccount.accessToken}`;

      try {
        const response = await fetch(url, {
          method: options?.method ?? 'GET',
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...options?.headers,
          },
          body: options?.body,
        });

        const responseText = await response.text();
        let responseJson: any;
        try {
          responseJson = JSON.parse(responseText);
        } catch {
          responseJson = responseText;
        }

        return {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          ok: response.ok,
          json: async () => responseJson,
          text: async () => responseText,
        };
      } catch (err: any) {
        return makeResponse(502, {
          error: `Real API request failed: ${err.message}`,
          product,
          path,
        });
      }
    };
  }

  private async ensureValidToken(): Promise<void> {
    if (!this.realApiAccount) return;

    // PATs don't expire
    if (this.realApiAccount.authType === 'pat') return;

    const BUFFER_MS = 5 * 60 * 1000; // 5 minutes
    if (Date.now() < this.realApiAccount.expiresAt - BUFFER_MS) return;

    // Token expired or expiring soon — refresh it
    try {
      const { refreshAccessToken } = await import('./auth/oauth.js');
      const refreshed = await refreshAccessToken(this.realApiAccount);
      this.realApiAccount.accessToken = refreshed.accessToken;
      this.realApiAccount.refreshToken = refreshed.refreshToken;
      this.realApiAccount.expiresAt = refreshed.expiresAt;

      // Notify caller so they can persist the new tokens
      this.onTokenRefresh?.(this.realApiAccount);
    } catch (err: any) {
      console.error(`  ⚠️  Token refresh failed: ${err.message}`);
      console.error(`     Run 'forge-sim auth' to re-authorize.`);
    }
  }

  /**
   * Register a mock handler for a product API.
   */
  mock(product: string, handler: ProductApiHandler): void {
    this.handlers.set(product, handler);
  }

  /**
   * Register a simple route-based mock.
   * 
   * Route keys are "METHOD /path" tuples (e.g. "GET /rest/api/3/issue/TEST-1").
   * Method defaults to GET if omitted (just "/rest/api/3/issue/TEST-1").
   * Path matching is prefix-based so "/rest/api/3/issue" matches "/rest/api/3/issue/TEST-1".
   */
  mockRoutes(
    product: string,
    routes: Record<string, any | ((path: string, options?: ProductApiRequest) => any)>
  ): void {
    // Parse route keys into [method, pathPattern] tuples
    const parsed = Object.entries(routes).map(([key, response]) => {
      const match = key.match(/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(.+)$/i);
      const method = match ? match[1].toUpperCase() : 'GET';
      const pathPattern = match ? match[2] : key;
      return { method, pathPattern, response };
    });

    const routeHandler: ProductApiHandler = (path: string, options?: ProductApiRequest) => {
      const requestMethod = (options?.method ?? 'GET').toUpperCase();

      for (const { method, pathPattern, response } of parsed) {
        if (requestMethod === method && (path === pathPattern || path.startsWith(pathPattern))) {
          // Resolve the route value — function form OR static value.
          const raw = typeof response === 'function' ? response(path, options) : response;
          // Unwrap the (optional) mockResponse() shape into a status/body/headers
          // triple. Bare values become 200 OK bodies. Throws on the `__status`
          // footgun so the next agent finds the right helper fast.
          const { status, body, headers } = unwrapMockResponse(raw);
          return makeResponse(status, body, headers);
        }
      }
      return makeResponse(404, { error: `No mock route matched: ${requestMethod} ${path}` });
    };

    // Store as mock route handler (real API handler checks this first)
    this.mockRouteHandlers.set(product, routeHandler);

    // If not in real mode, also set as the primary handler
    if (!this.realApiAccount) {
      this.handlers.set(product, routeHandler);
    }
  }

  /**
   * Make a request (called by the simulated @forge/api module).
   */
  async request(
    product: string,
    path: string,
    options?: ProductApiRequest
  ): Promise<ProductApiResponse> {
    // Check property store first (issue/content/space properties)
    if (this.propertyStore) {
      let propResult: ProductApiResponse | null = null;
      if (product === 'jira') {
        propResult = this.propertyStore.handleJiraRoute(path, options);
      } else if (product === 'confluence') {
        propResult = this.propertyStore.handleConfluenceRoute(path, options);
      }
      if (propResult) return propResult;
    }

    const handler = this.handlers.get(product);
    if (!handler) {
      return makeResponse(501, {
        error: `Unknown product: ${product}`,
      });
    }
    return handler(path, options);
  }

  // ── GraphQL (Atlassian Gateway) ───────────────────────────────────────

  /**
   * Register mock handlers for GraphQL operations, keyed by operation name.
   * 
   * Values can be:
   * - A static object (returned as-is as the response body)
   * - A function (query, variables) => response body
   * 
   * Use '*' as a catch-all for anonymous queries or unmatched operations.
   * 
   * Example:
   *   sim.productApi.mockGraphQL({
   *     'GetIssue': { data: { issue: { key: 'TEST-1' } } },
   *     'SearchUsers': (query, variables) => ({ data: { users: [] } }),
   *     '*': { errors: [{ message: 'Unknown operation' }] },
   *   });
   */
  mockGraphQL(mocks: Record<string, GraphQLHandler | any>): void {
    for (const [key, value] of Object.entries(mocks)) {
      this.graphqlMocks.set(key, value);
    }
  }

  /**
   * Execute a GraphQL request. Checks mocks first (by operation name),
   * then falls back to the real Atlassian Gateway if connected.
   */
  async requestGraph(
    query: string,
    variables?: Record<string, any>,
    headers?: Record<string, string>,
  ): Promise<ProductApiResponse> {
    const operationName = extractOperationName(query);

    // 1. Check mocks — exact operation name match, then '*' catch-all
    const mockHandler = (operationName && this.graphqlMocks.get(operationName))
      || this.graphqlMocks.get('*');

    if (mockHandler !== undefined) {
      const body = typeof mockHandler === 'function'
        ? await mockHandler(query, variables)
        : mockHandler;
      return makeResponse(200, body);
    }

    // 2. Real API fallback
    if (!this.realApiAccount) {
      return makeResponse(501, {
        error: `Unmocked GraphQL operation: ${operationName ?? '(anonymous)'}. Register a handler with sim.mockGraphQL({ '${operationName ?? '*'}': ... })`,
      });
    }

    await this.ensureValidToken();

    // OAuth uses api.atlassian.com/graphql
    // PAT/API tokens use {site}/gateway/api/graphql (tenanted gateway)
    const url = this.realApiAccount.authType === 'pat'
      ? `https://${this.realApiAccount.site}/gateway/api/graphql`
      : 'https://api.atlassian.com/graphql';
    const authHeader = this.realApiAccount.authType === 'pat'
      ? `Basic ${Buffer.from(`${this.realApiAccount.email}:${this.realApiAccount.accessToken}`).toString('base64')}`
      : `Bearer ${this.realApiAccount.accessToken}`;

    const requestBody: Record<string, any> = { query };
    if (variables) requestBody.variables = variables;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();
      let responseJson: any;
      try {
        responseJson = JSON.parse(responseText);
      } catch {
        responseJson = responseText;
      }

      return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        ok: response.ok,
        json: async () => responseJson,
        text: async () => responseText,
      };
    } catch (err: any) {
      return makeResponse(502, {
        error: `GraphQL request failed: ${err.message}`,
      });
    }
  }

  clear(): void {
    this.handlers.clear();
    this.mockRouteHandlers.clear();
    this.graphqlMocks.clear();
    this.realApiAccount = null;
    this.onTokenRefresh = undefined;
    for (const product of ['jira', 'confluence', 'bitbucket']) {
      this.handlers.set(product, unmockedHandler(product));
    }
  }
}

// ── Route template tag (mirrors @forge/api route) ───────────────────────

/**
 * Template tag that builds a path string, matching @forge/api's `route` tag.
 * Encodes interpolated values for safety.
 */
export function route(
  strings: TemplateStringsArray,
  ...values: any[]
): string {
  let result = '';
  for (let i = 0; i < strings.length; i++) {
    result += strings[i];
    if (i < values.length) {
      result += encodeURIComponent(String(values[i]));
    }
  }
  return result;
}
