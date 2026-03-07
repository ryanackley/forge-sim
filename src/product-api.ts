/**
 * Simulated Product API (requestJira, requestConfluence, etc.)
 *
 * Provides mock handlers that can be configured per-test or use defaults.
 * Mirrors the @forge/api `api.asUser().requestJira(route`...`)` pattern.
 */

import type { ProductApiHandler, ProductApiRequest, ProductApiResponse } from './types.js';
import type { AtlassianAccount } from './auth/credentials.js';

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

export class SimulatedProductApi {
  private handlers = new Map<string, ProductApiHandler>();
  private mockRouteHandlers = new Map<string, ProductApiHandler>();
  private realApiAccount: AtlassianAccount | null = null;
  private onTokenRefresh?: (account: AtlassianAccount) => void;

  constructor() {
    // Set up defaults that return helpful errors
    for (const product of ['jira', 'confluence', 'bitbucket']) {
      this.handlers.set(product, unmockedHandler(product));
    }
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
          const body = typeof response === 'function' ? response(path, options) : response;
          return makeResponse(200, body);
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
    const handler = this.handlers.get(product);
    if (!handler) {
      return makeResponse(501, {
        error: `Unknown product: ${product}`,
      });
    }
    return handler(path, options);
  }

  clear(): void {
    this.handlers.clear();
    this.mockRouteHandlers.clear();
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
