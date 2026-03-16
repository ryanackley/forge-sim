/**
 * RemoteProxy — handles Forge Remote invocations.
 *
 * Routes remote requests through the product API mock system first,
 * falling back to real HTTP with FIT authorization headers.
 */

import type { SimulatedProductApi } from './product-api.js';
import type { FITProvider } from './fit-provider.js';
import type { ParsedManifest } from './manifest.js';
import type { ProductApiResponse } from './types.js';

export interface RemoteInvokeOptions {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  [key: string]: any;
}

export class RemoteProxy {
  private productApi: SimulatedProductApi;
  private fit: FITProvider;
  private manifest: ParsedManifest | null = null;
  private appId = 'forge-sim-app';

  constructor(productApi: SimulatedProductApi, fit: FITProvider) {
    this.productApi = productApi;
    this.fit = fit;
  }

  /**
   * Update the manifest reference (called when manifest is loaded).
   */
  setManifest(manifest: ParsedManifest | null): void {
    this.manifest = manifest;
    if (manifest?.raw.app?.id) {
      this.appId = manifest.raw.app.id;
    }
  }

  /**
   * Backend invokeRemote — called from @forge/api.
   * Takes a remoteKey and options with path/method/headers/body.
   * Returns a Response-like object (same shape as ProductApiResponse).
   */
  async invoke(remoteKey: string, options: RemoteInvokeOptions): Promise<ProductApiResponse> {
    const remote = this.manifest?.remotes.get(remoteKey);
    if (!remote) {
      return this.makeErrorResponse(404, `Unknown remote: "${remoteKey}". Available: ${[...(this.manifest?.remotes.keys() ?? [])].join(', ')}`);
    }

    // Try mock routes first (remote key = product key in mock system)
    const mockResult = await this.productApi.request(remoteKey, options.path, {
      method: options.method,
      headers: options.headers,
      body: options.body,
    });

    // If mock returned a real match (not 501 unmocked / not 404 no route), use it
    if (mockResult.status !== 501) {
      return mockResult;
    }

    // Fall back to real HTTP
    return this.realFetch(remote.baseUrl, options);
  }

  /**
   * Bridge invokeRemote — called from @forge/bridge.
   * Takes a single options object. Resolves the endpoint from the manifest.
   * Returns parsed JSON (not a Response — bridge convention).
   */
  async invokeFromBridge(input: RemoteInvokeOptions & { endpointKey?: string }): Promise<any> {
    const endpointKey = input.endpointKey;

    if (!endpointKey) {
      throw new Error(
        'invokeRemote requires an endpoint key. The calling module must have resolver.endpoint configured in the manifest. ' +
        `Available endpoints: ${[...(this.manifest?.endpoints.keys() ?? [])].join(', ') || 'none'}`
      );
    }

    const endpoint = this.manifest?.endpoints.get(endpointKey);
    if (!endpoint) {
      throw new Error(
        `Unknown endpoint "${endpointKey}". Available endpoints: ${[...(this.manifest?.endpoints.keys() ?? [])].join(', ') || 'none'}`
      );
    }

    const remoteKey = endpoint.remote;
    // Prefix path with endpoint route if defined
    if (endpoint.route?.path && !input.path.startsWith(endpoint.route.path)) {
      input = { ...input, path: endpoint.route.path + input.path };
    }

    const response = await this.invoke(remoteKey, input);
    return response.json();
  }

  /**
   * Bridge requestRemote — called from @forge/bridge.
   * Takes a remoteKey and fetch-like options. Returns a Response-like object.
   */
  async request(remoteKey: string, options?: RemoteInvokeOptions): Promise<ProductApiResponse> {
    if (!options) {
      return this.makeErrorResponse(400, 'requestRemote requires options with at least a path');
    }
    return this.invoke(remoteKey, options);
  }

  /**
   * Make a real HTTP request to the remote backend with FIT auth.
   */
  private async realFetch(baseUrl: string, options: RemoteInvokeOptions): Promise<ProductApiResponse> {
    const url = `${baseUrl}${options.path}`;
    const method = options.method ?? 'GET';

    // Build FIT token
    let authHeader: string | undefined;
    if (this.fit.isInitialized) {
      const token = await this.fit.sign({
        aud: this.appId,
        context: {
          cloudId: 'sim-cloud-001',
          siteUrl: 'https://sim.atlassian.net',
        },
      });
      authHeader = `Bearer ${token}`;
    }

    try {
      const response = await globalThis.fetch(url, {
        method,
        headers: {
          ...(authHeader ? { Authorization: authHeader } : {}),
          'Content-Type': 'application/json',
          ...options.headers,
        },
        body: options.body,
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
      return this.makeErrorResponse(502, `Remote request failed: ${err.message}`);
    }
  }

  private makeErrorResponse(status: number, message: string): ProductApiResponse {
    return {
      status,
      statusText: 'Error',
      headers: { 'content-type': 'application/json' },
      ok: false,
      json: async () => ({ error: message }),
      text: async () => JSON.stringify({ error: message }),
    };
  }
}
