/**
 * Simulated Product API (requestJira, requestConfluence, etc.)
 *
 * Provides mock handlers that can be configured per-test or use defaults.
 * Mirrors the @forge/api `api.asUser().requestJira(route`...`)` pattern.
 */

import type { ProductApiHandler, ProductApiRequest, ProductApiResponse } from './types.js';

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

export class SimulatedProductApi {
  private handlers = new Map<string, ProductApiHandler>();

  constructor() {
    // Set up defaults that return helpful errors
    for (const product of ['jira', 'confluence', 'bitbucket']) {
      this.handlers.set(product, unmockedHandler(product));
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

    this.handlers.set(product, (path: string, options?: ProductApiRequest) => {
      const requestMethod = (options?.method ?? 'GET').toUpperCase();

      for (const { method, pathPattern, response } of parsed) {
        if (requestMethod === method && (path === pathPattern || path.startsWith(pathPattern))) {
          const body = typeof response === 'function' ? response(path, options) : response;
          return makeResponse(200, body);
        }
      }
      return makeResponse(404, { error: `No mock route matched: ${requestMethod} ${path}` });
    });
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
