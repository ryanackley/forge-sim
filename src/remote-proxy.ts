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
  private logFn: ((level: string, message: string, detail?: any) => void) | null = null;

  constructor(productApi: SimulatedProductApi, fit: FITProvider) {
    this.productApi = productApi;
    this.fit = fit;
  }

  /** Attach a log callback (called by simulator to wire into the log system). */
  onLog(fn: (level: string, message: string, detail?: any) => void): void {
    this.logFn = fn;
  }

  private log(level: string, message: string, detail?: any): void {
    if (this.logFn) {
      this.logFn(level, message, detail);
    }
    // Also log to console for visibility in CDT/terminal
    if (level === 'error') {
      console.error(`[remote-proxy] ${message}`, detail ?? '');
    }
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
      const msg = `Unknown remote: "${remoteKey}". Available: ${[...(this.manifest?.remotes.keys() ?? [])].join(', ')}`;
      this.log('error', msg);
      return this.makeErrorResponse(404, msg);
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
      const msg = 'invokeRemote requires an endpoint key. The calling module must have resolver.endpoint configured in the manifest. ' +
        `Available endpoints: ${[...(this.manifest?.endpoints.keys() ?? [])].join(', ') || 'none'}`;
      this.log('error', msg);
      throw new Error(msg);
    }

    const endpoint = this.manifest?.endpoints.get(endpointKey);
    if (!endpoint) {
      const msg = `Unknown endpoint "${endpointKey}". Available endpoints: ${[...(this.manifest?.endpoints.keys() ?? [])].join(', ') || 'none'}`;
      this.log('error', msg);
      throw new Error(msg);
    }

    const remoteKey = endpoint.remote;
    // Prefix path with endpoint route if defined
    if (endpoint.route?.path && !input.path.startsWith(endpoint.route.path)) {
      const routeBase = endpoint.route.path.replace(/\/+$/, '');
      const inputPath = input.path.startsWith('/') ? input.path : '/' + input.path;
      input = { ...input, path: routeBase + inputPath };
    }

    this.log('info', `invokeRemote → endpoint "${endpointKey}" → remote "${remoteKey}" ${input.method ?? 'GET'} ${input.path}`);

    const response = await this.invoke(remoteKey, input);
    const result = await response.json();

    if (!response.ok) {
      this.log('error', `invokeRemote failed: ${response.status} ${response.statusText} — ${JSON.stringify(result)}`, {
        endpoint: endpointKey, remote: remoteKey, path: input.path, status: response.status,
      });
    }

    return result;
  }

  /**
   * Bridge requestRemote — called from @forge/bridge.
   * Takes a remoteKey and fetch-like options. Returns a Response-like object.
   */
  async request(remoteKey: string, options?: RemoteInvokeOptions): Promise<ProductApiResponse> {
    if (!options) {
      this.log('error', `requestRemote("${remoteKey}"): missing options (at least path is required)`);
      return this.makeErrorResponse(400, 'requestRemote requires options with at least a path');
    }
    this.log('info', `requestRemote → remote "${remoteKey}" ${options.method ?? 'GET'} ${options.path}`);
    return this.invoke(remoteKey, options);
  }

  /**
   * Make a real HTTP request to the remote backend with FIT auth.
   */
  private async realFetch(baseUrl: string, options: RemoteInvokeOptions): Promise<ProductApiResponse> {
    // Join baseUrl and path cleanly — avoid double slashes, handle both
    // "http://host:port/" + "/api/foo" and "http://host:port" + "api/foo"
    const base = baseUrl.replace(/\/+$/, '');
    const path = options.path.replace(/^\/+/, '/');
    const url = `${base}${path.startsWith('/') ? path : '/' + path}`;
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

    this.log('info', `Remote fetch: ${method} ${url}`);

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
        this.log('error', `Remote response from ${method} ${url} is not valid JSON (${response.status}). Body: ${responseText.slice(0, 500)}`);
        responseJson = responseText;
      }

      if (!response.ok) {
        this.log('error', `Remote returned ${response.status} ${response.statusText} for ${method} ${url}`, {
          body: typeof responseJson === 'string' ? responseJson.slice(0, 500) : responseJson,
        });
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
      // Connection failures, DNS errors, timeouts, etc.
      const cause = err.cause ?? err;
      const code = cause?.code ?? '';
      const detail = code ? `${err.message} (${code})` : err.message;
      this.log('error', `❌ Remote request failed: ${method} ${url} — ${detail}`, {
        code, message: err.message, cause: cause?.message,
      });
      return this.makeErrorResponse(502, `Remote request failed: ${detail}`);
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
