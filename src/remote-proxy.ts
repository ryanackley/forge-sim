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
  async invoke(remoteKey: string, options: RemoteInvokeOptions, invokeContext?: {
    endpointAuth?: { appSystemToken?: { enabled: boolean }; appUserToken?: { enabled: boolean } };
    moduleKey?: string;
    moduleType?: string;
    endpointKey?: string;
  }): Promise<ProductApiResponse> {
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
    return this.realFetch(remote.baseUrl, options, invokeContext);
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

    const response = await this.invoke(remoteKey, input, {
      endpointAuth: endpoint.auth,
      moduleKey: input.moduleKey,
      moduleType: input.moduleType,
      endpointKey,
    });
    const body = await response.text();
    const headers = response.headers ?? {};

    if (!response.ok) {
      this.log('error', `invokeRemote failed: ${response.status} ${response.statusText} — ${body.slice(0, 500)}`, {
        endpoint: endpointKey, remote: remoteKey, path: input.path, status: response.status,
      });
      // Match @forge/bridge's _setupInvokeEndpointFn expected response format:
      // { success: false, error: { status, statusText, headers, body } }
      return {
        success: false,
        error: {
          status: response.status,
          statusText: response.statusText,
          headers,
          body,
        },
      };
    }

    // Match @forge/bridge's _setupInvokeEndpointFn expected response format:
    // { success: true, payload: { status, statusText, headers, body } }
    return {
      success: true,
      payload: {
        status: response.status,
        statusText: response.statusText,
        headers,
        body,
      },
    };
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
  private async realFetch(baseUrl: string, options: RemoteInvokeOptions, invokeContext?: {
    endpointAuth?: { appSystemToken?: { enabled: boolean }; appUserToken?: { enabled: boolean } };
    moduleKey?: string;
    moduleType?: string;
    endpointKey?: string;
  }): Promise<ProductApiResponse> {
    // Join baseUrl and path cleanly — avoid double slashes, handle both
    // "http://host:port/" + "/api/foo" and "http://host:port" + "api/foo"
    const base = baseUrl.replace(/\/+$/, '');
    const path = options.path.replace(/^\/+/, '/');
    const url = `${base}${path.startsWith('/') ? path : '/' + path}`;
    const method = options.method ?? 'GET';

    // Build required Forge Remote contract headers
    // See: https://developer.atlassian.com/platform/forge/forge-remote-invocation-contract/
    const forgeHeaders: Record<string, string> = {};

    // Required: x-b3-traceid and x-b3-spanid (trace context)
    const traceId = this.generateTraceId();
    const spanId = this.generateSpanId();
    forgeHeaders['x-b3-traceid'] = traceId;
    forgeHeaders['x-b3-spanid'] = spanId;

    // Build context from connected account (if available) or defaults
    const connectedAccount = this.productApi.connectedAccount;
    const cloudId = connectedAccount?.cloudId ?? 'sim-cloud-001';
    const siteUrl = connectedAccount ? `https://${connectedAccount.site}` : 'https://sim.atlassian.net';
    const accountId = connectedAccount?.accountId ?? 'sim-user-001';
    const endpointAuth = invokeContext?.endpointAuth;

    // Required: authorization — FIT as bearer token
    if (this.fit.isInitialized) {
      const token = await this.fit.sign({
        aud: this.appId,
        app: {
          id: this.appId,
          version: '1.0.0',
          installationId: `${this.appId}/install/${cloudId}`,
          environment: {
            type: 'DEVELOPMENT',
            id: `${this.appId}/env/development`,
          },
          module: invokeContext?.moduleKey ? {
            type: invokeContext.moduleType ?? 'unknown',
            key: invokeContext.moduleKey,
          } : undefined,
        },
        context: {
          cloudId,
          siteUrl,
          moduleKey: invokeContext?.moduleKey,
          localId: invokeContext?.endpointKey,
        },
        principal: accountId,
      });
      forgeHeaders['authorization'] = `Bearer ${token}`;
    } else {
      this.log('error', `FIT not initialized — authorization header will be missing from remote request to ${url}. ` +
        `Remote backends that validate the FIT will reject this request.`);
    }

    // Optional: x-forge-oauth-system (if endpoint.auth.appSystemToken is enabled)
    if (endpointAuth?.appSystemToken?.enabled) {
      // In real Forge, this is an OAuth system token for calling Atlassian APIs.
      // In forge-sim, we provide a placeholder — the remote should use the FIT for validation.
      forgeHeaders['x-forge-oauth-system'] = 'forge-sim-system-token';
    }

    // Optional: x-forge-oauth-user (if endpoint.auth.appUserToken is enabled)
    if (endpointAuth?.appUserToken?.enabled) {
      forgeHeaders['x-forge-oauth-user'] = 'forge-sim-user-token';
    }

    this.log('info', `Remote fetch: ${method} ${url} (trace: ${traceId})`);

    // Ensure body is serialized — it may arrive as an object from the bridge
    const body = options.body != null && typeof options.body !== 'string'
      ? JSON.stringify(options.body)
      : options.body;

    try {
      const response = await globalThis.fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...forgeHeaders,
          ...options.headers, // App-specified headers can override
        },
        body,
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

  /** Generate a 128-bit hex trace ID (matches x-b3-traceid format). */
  private generateTraceId(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /** Generate a 64-bit hex span ID (matches x-b3-spanid format). */
  private generateSpanId(): string {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
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
