/**
 * Shim for @forge/api
 * 
 * This is the big one — provides the full @forge/api surface:
 *   import { route, requestJira, storage, fetch } from '@forge/api';
 *   import { asUser, asApp } from '@forge/api';
 */

import { createRequire } from 'node:module';
import { getSimulator } from './globals.js';
import { WhereConditions as KvsWhereConditions, FilterConditions as KvsFilterConditions } from './forge-kvs.js';
import { buildAuthorizeApi, AUTHORIZE_NO_ACCOUNT_ERROR, type AuthorizeFetch } from '../authorize.js';
import { extractAppIdUuid } from '../app-ari.js';
import { ProductFetchResponse } from './fetch-response.js';
import type { ForgeSupportedLocaleCode } from './i18n-locales.js';

// ── Route template tag: REAL implementation, not a reimplementation ─────
//
// `route()` is Atlassian's path-traversal defense and it is subtle: path
// segments are NOT encoded but reject `..` / `/` / `\` with a throw; query
// segments ARE encoded; the mode flips when the template crosses `?` or `#`.
// Our previous hand-rolled version always-encoded and never threw — a
// works-in-sim/fails-in-Forge divergence with a security flavor (an app
// interpolating a user value containing `/` passed here, threw in prod).
//
// So we fall through to the real package (the CLAUDE.md convention): these
// are pure functions with no cloud I/O, which makes them the ideal
// fallthrough — upstream behavior for free, drift impossible. Resolved via
// createRequire from THIS file, so it binds to forge-sim's own pinned
// @forge/api (a runtime dependency; contract-tested via
// VERIFIED_FORGE_VERSIONS), not whatever the app has installed.
// Runtime require also dodges both interception layers on purpose: the CJS
// patch exempts non-app parents, and the vitest alias only rewrites static
// imports. Verified side-effect-free to load with no simulator present.
// Behavior is pinned by route-parity.test.ts (differential, real-by-path).
const realForgeApi = createRequire(import.meta.url)('@forge/api');

export type Route = { readonly value: string };

const route: (strings: TemplateStringsArray, ...values: any[]) => Route = realForgeApi.route;
const routeFromAbsolute: (path: string) => Route = realForgeApi.routeFromAbsolute;
const assumeTrustedRoute: (path: string) => Route = realForgeApi.assumeTrustedRoute;

/**
 * The real package's (unexported) ReadonlyRoute class, recovered from the
 * real factory's own output — gives us `requireSafeUrl`-identical
 * enforcement without deep-importing Atlassian internals.
 */
const RealReadonlyRoute: new (v: string) => Route =
  (assumeTrustedRoute('/') as any).constructor;

/**
 * Product-request surfaces (requestJira/Confluence/Bitbucket) REQUIRE a
 * Route in real Forge — `wrapRequestProduct` rejects anything else, plain
 * strings included. We used to accept strings here; that leniency let code
 * pass in the sim and die on its first production request.
 *
 * instanceof against the real class, exactly like upstream. A Route from an
 * app's own BUNDLED @forge/api copy would fail this check — consistent,
 * since bundled @forge/* backends are unsupported outright
 * (docs/reference/bundled-forge-packages.md).
 */
function requireRoute(path: unknown, fnName: string): string {
  if (path instanceof RealReadonlyRoute) return path.value;
  const got = typeof path === 'string' ? `a plain string` : `a ${typeof path}`;
  throw new Error(
    `${fnName}() was called with ${got} instead of a Route. Real Forge rejects this — ` +
    `build the path with the \`route\` template literal from '@forge/api' ` +
    `(https://go.atlassian.com/forge-fetch-route), e.g. route\`/rest/api/3/myself\`. ` +
    `forge-sim matches Forge here so the bug surfaces now instead of in production.`
  );
}

/**
 * The `fetch` surfaces (egress fetch, remotes fetch) are the ONE place real
 * @forge/api accepts a plain string OR a Route (`wrapWithRouteUnwrapper`).
 * Keep that exact policy here and nowhere else.
 */
function unwrapRouteOrString(path: Route | string): string {
  return path instanceof RealReadonlyRoute ? path.value : String(path);
}

// ── API client builders ─────────────────────────────────────────────────

/**
 * Real APIResponse = the full fetch Response, so wrap the simulator's smaller
 * ProductApiResponse at the shim boundary (see fetch-response.ts). Single-read
 * body semantics included, exactly like Forge.
 */
async function productResponse(product: string, path: Route, options?: any, fnName = `request${product[0].toUpperCase()}${product.slice(1)}`): Promise<Response> {
  const inner = await getSimulator().productApi.request(product, requireRoute(path, fnName), options);
  return new ProductFetchResponse(inner);
}

function notImplemented(name: string, extra = ''): Promise<never> {
  return Promise.reject(
    new Error(`${name} is not yet implemented in forge-sim.${extra ? ` ${extra}` : ''} It works in real Forge — this is a simulator gap, not an app bug.`),
  );
}

function makeApiClient() {
  return {
    requestJira(path: Route, options?: any) {
      return productResponse('jira', path, options);
    },
    requestConfluence(path: Route, options?: any) {
      return productResponse('confluence', path, options);
    },
    requestBitbucket(path: Route, options?: any) {
      return productResponse('bitbucket', path, options);
    },
    async requestGraph(query: string, variables?: any, headers?: Record<string, string>) {
      return new ProductFetchResponse(await getSimulator().productApi.requestGraph(query, variables, headers));
    },
    requestConnectedData(_path: Route, _options?: any): Promise<Response> {
      return notImplemented('requestConnectedData');
    },
    requestAtlassian(_path: Route, _options?: any): Promise<Response> {
      return notImplemented('requestAtlassian', '(the api.atlassian.com gateway is not simulated; use requestJira/requestConfluence)');
    },
    withContext(_contextAri: string) {
      // Returns context-scoped request methods in real Forge; scoping is not
      // simulated, so fail loudly rather than silently ignore the context.
      const scoped = (name: string) => (_path: Route, _options?: any): Promise<Response> =>
        notImplemented(`withContext().${name}`);
      return {
        requestJira: scoped('requestJira'),
        requestConfluence: scoped('requestConfluence'),
        requestBitbucket: scoped('requestBitbucket'),
      };
    },
  };
}

// ── External Auth (withProvider) ────────────────────────────────────────

function makeExternalAuthAccountMethods(providerKey: string, _remoteName?: string, _accountId?: string) {
  const store = () => getSimulator().externalAuth;
  const api = () => getSimulator().productApi;

  // Resolve the remote name: explicit > first in provider's list > providerKey
  const resolveRemote = () => {
    const provider = store().getProvider(providerKey);
    return _remoteName ?? provider?.remotes?.[0] ?? providerKey;
  };

  return {
    async hasCredentials(scopes?: string[]): Promise<boolean> {
      return store().hasCredentials(providerKey, scopes);
    },

    async requestCredentials(_scopes?: string[]): Promise<boolean> {
      if (store().hasCredentials(providerKey)) return true;

      // Attempt interactive OAuth flow (opens browser popup)
      const token = await store().interactiveOAuthFlow(providerKey);
      return token !== null;
    },

    async fetch(rawUrl: Route | string, options?: any): Promise<any> {
      // Remote fetch takes string OR Route — real wrapWithRouteUnwrapper policy.
      const url = unwrapRouteOrString(rawUrl);
      const remoteName = resolveRemote();

      // Always try mock routes first (same pattern as product API)
      const mockResult = await api().request(remoteName, url, options);
      if (mockResult.status !== 501) {
        // Mock route matched (or returned a real mock response)
        return mockResult;
      }

      // No mock — try real HTTP with token injection
      const token = await store().ensureValidToken(providerKey);
      if (token) {
        const baseUrl = store().getProviderBaseUrl(providerKey, _remoteName);
        if (baseUrl) {
          const fullUrl = url.startsWith('/') ? `${baseUrl}${url}` : `${baseUrl}/${url}`;
          const bearerMethod = store().getProvider(providerKey)?.bearerMethod ?? 'authorization-header';
          const fetchOptions: any = { ...options, headers: { ...options?.headers } };

          if (bearerMethod === 'authorization-header') {
            fetchOptions.headers['Authorization'] = `Bearer ${token.accessToken}`;
          } else if (bearerMethod === 'uri-query') {
            const u = new URL(fullUrl);
            u.searchParams.set('access_token', token.accessToken);
            return globalThis.fetch(u.toString(), fetchOptions);
          }

          return globalThis.fetch(fullUrl, fetchOptions);
        }
      }

      // No mock, no token — return the 501 from mock layer
      return mockResult;
    },

    async getAccount() {
      return store().getAccount(providerKey);
    },
  };
}

function makeExternalAuthClient(providerKey: string, remoteName?: string) {
  const accountMethods = makeExternalAuthAccountMethods(providerKey, remoteName);
  return {
    ...accountMethods,

    async listAccounts() {
      return getSimulator().externalAuth.listAccounts(providerKey);
    },

    // Real Forge returns the credential (token) ids the user has granted for
    // this provider; the sim's account ids serve the same role
    async listCredentials(): Promise<string[]> {
      const accounts = await getSimulator().externalAuth.listAccounts(providerKey);
      return accounts.map((a: any) => a.id ?? a.externalAccountId ?? String(a));
    },

    asAccount(externalAccountId: string) {
      return makeExternalAuthAccountMethods(providerKey, remoteName, externalAccountId);
    },
  };
}

function asUser() {
  const client = makeApiClient();
  return {
    ...client,
    withProvider(provider: string, remoteName?: string) {
      return makeExternalAuthClient(provider, remoteName);
    },
    requestTeamworkGraph(_query: string, _variables?: any, _operationName?: string, _extensions?: any, _headers?: Record<string, any>): Promise<Response> {
      return notImplemented('requestTeamworkGraph', '(planned for the Teamwork Graph shim, roadmap 0.3 / issue #47.)');
    },
  };
}

function asApp() { return makeApiClient(); }

// Top-level convenience (these use asUser by default in real Forge)
function requestJira(path: Route, options?: any) {
  return productResponse('jira', path, options);
}
function requestConfluence(path: Route, options?: any) {
  return productResponse('confluence', path, options);
}
function requestBitbucket(path: Route, options?: any) {
  return productResponse('bitbucket', path, options);
}

// ── Legacy storage (@forge/api storage — deprecated in favor of @forge/kvs) ──

const storage = {
  get(key: string) {
    return getSimulator().kvs.get(key);
  },
  set(key: string, value: any) {
    return getSimulator().kvs.set(key, value);
  },
  delete(key: string) {
    return getSimulator().kvs.delete(key);
  },
  query() {
    return getSimulator().kvs.query();
  },
  getSecret(key: string) {
    return getSimulator().kvs.getSecret(key);
  },
  setSecret(key: string, value: any) {
    return getSimulator().kvs.setSecret(key, value);
  },
  deleteSecret(key: string) {
    return getSimulator().kvs.deleteSecret(key);
  },
};

// ── Simulated fetch (external HTTP) ─────────────────────────────────────

async function forgeFetch(rawUrl: Route | string, options?: any) {
  // Egress fetch takes string OR Route — real wrapWithRouteUnwrapper policy.
  const url = unwrapRouteOrString(rawUrl);
  // In simulation, we can either use real fetch or mock it.
  // Default: use real fetch but log it.
  console.warn(`[forge-sim] External fetch: ${options?.method || 'GET'} ${url}`);
  return globalThis.fetch(url, options);
}

// ── Condition helpers (re-exported from @forge/api) ─────────────────────
//
// Both objects re-export the canonical clause helpers from the forge-kvs
// shim. Keeping a single source of truth avoids the drift that bit
// pre-2026-05-16: this file used to define its own broken FilterConditions
// returning { condition: 'camelCase', value: ... } (singular value, wrong
// shape).

const WhereConditions = KvsWhereConditions;
const FilterConditions = KvsFilterConditions;

const SortOrder = {
  ASC: 'ASC' as const,
  DESC: 'DESC' as const,
};

function startsWith(prefix: string) {
  return WhereConditions.beginsWith(prefix);
}

// ── Error classes ───────────────────────────────────────────────────────

// Error hierarchy mirroring real @forge/api out/api/errors.js — same base
// classes, names (the *_ERR codes), statuses, and message templates, so both
// instanceof checks and err.name/err.status dispatch behave as in Forge.
class HttpError extends Error {
  status: number | undefined;
  constructor(message: string) {
    super(message);
  }
}

class FetchError extends Error {
  constructor(cause: string) {
    super(cause);
    this.stack = undefined;
    this.name = 'FUNCTION_FETCH_ERR';
  }
}

class NotAllowedError extends HttpError {
  constructor(message: string) {
    super(message);
    this.stack = undefined;
    this.name = 'REQUEST_EGRESS_ALLOWLIST_ERR';
    this.status = 403;
  }
}

class ExternalEndpointNotAllowedError extends NotAllowedError {
  constructor(failedURL: string) {
    super(`URL not included in the external fetch backend permissions: ${failedURL}. Visit go.atlassian.com/forge-egress for more information.`);
  }
}

class ProductEndpointNotAllowedError extends NotAllowedError {
  constructor(failedURL: string) {
    super(`URL not allowed: ${failedURL}.`);
  }
}

class RequestProductNotAllowedError extends NotAllowedError {
  constructor(requestedProduct: string, invocationProduct: string) {
    super(`Request ${requestedProduct} is not allowed from ${invocationProduct} context.`);
  }
}

class InvalidWorkspaceRequestedError extends NotAllowedError {
  constructor(failedURL: string) {
    super(`Invalid workspace requested in URL: ${failedURL}.`);
  }
}

class NeedsAuthenticationError extends HttpError {
  constructor(
    error: string,
    readonly serviceKey: string,
    readonly options?: { scopes?: string[]; isExpectedError?: boolean },
  ) {
    super(error);
    this.stack = undefined;
    this.name = 'NEEDS_AUTHENTICATION_ERR';
    this.status = 401;
  }
}

class ProxyRequestError extends HttpError {
  status: number;
  errorCode: string;
  constructor(status: number, errorCode: string) {
    super(`Forge platform failed to process runtime HTTP request - ${status} - ${errorCode}`);
    this.status = status;
    this.errorCode = errorCode;
    this.name = 'PROXY_ERR';
  }
}

const FUNCTION_ERR = 'FUNCTION_ERR';

function isExpectedError(err: any): boolean {
  return err instanceof NotAllowedError || err instanceof NeedsAuthenticationError;
}

function isForgePlatformError(err: any): boolean {
  return err instanceof FetchError || err instanceof HttpError || err instanceof NotAllowedError;
}

function isHostedCodeError(err: any): boolean {
  return err instanceof Error && err.name.includes('HostedCode');
}

// ── authorize() — permission check builders (API-029/030, RT-044) ──────
//
// Mirrors real @forge/api/out/authorization/index.js:
//   const accountId = __getRuntime().aaid;
//   if (!accountId) throw ...;
//   return { ...authorizeConfluenceWithFetch(...), ...authorizeJiraWithFetch(...) };
//
// The sim's equivalent of the invocation runtime's `aaid` is the currently
// executing resolver's merged context (per-call overrides included), falling
// back to the sticky/default context when called outside an invocation
// (e.g. straight from a test).

/** Resolve the invoking user's accountId the same way the context layer does. */
function currentInvokingAccountId(): string | undefined {
  const sim = getSimulator();
  const active = sim.resolver.getActiveContext();
  if (active) return active.accountId as string | undefined;
  const merged = {
    ...sim.getDefaultContext(),
    ...sim.resolver.getContextOverrides(),
    ...sim.resolver.getRenderContext(),
  };
  return merged.accountId as string | undefined;
}

function authorize() {
  const accountId = currentInvokingAccountId();
  if (!accountId) {
    // Byte-for-byte the real error (note the Unicode ’) — thrown
    // synchronously, exactly like real authorize().
    throw new Error(AUTHORIZE_NO_ACCOUNT_ERROR);
  }
  const sim = getSimulator();
  // Real authorize() routes through asUser().requestJira/requestConfluence
  // then res.json(). Our fetch contract also carries the status so the
  // builders can tell "mocked answer" from "unmocked → permissive true".
  const wrapFetch = (product: 'jira' | 'confluence'): AuthorizeFetch =>
    async (path, opts) => {
      const res = await sim.productApi.request(product, assumeTrustedRoute(path).value, opts);
      let json: any;
      try { json = await res.json(); } catch { json = undefined; }
      return { status: res.status, json };
    };
  return buildAuthorizeApi(accountId, wrapFetch('jira'), wrapFetch('confluence'));
}

// ── Stubs for less common APIs ──────────────────────────────────────────

async function invokeRemote(
  remoteKey: string,
  // body union matches real RequestInit (ArrayBuffer | string | URLSearchParams)
  options: { path: string; method?: string; headers?: Record<string, string>; body?: ArrayBuffer | string | URLSearchParams } & Record<string, any> = { path: '/' }
): Promise<any> {
  // The remote proxy sends string bodies; serialize the other RequestInit forms
  const body =
    options.body instanceof URLSearchParams
      ? options.body.toString()
      : options.body instanceof ArrayBuffer
        ? Buffer.from(options.body).toString()
        : options.body;
  return getSimulator().remotes.invoke(remoteKey, { ...options, body });
}

/** Container services are an Atlassian developer preview (roadmap watch item #19). */
function invokeService(
  _serviceKey: string,
  _options: { path: string; method?: string; headers?: Record<string, string>; body?: ArrayBuffer | string | URLSearchParams },
): Promise<any> {
  return notImplemented('invokeService', '(Container services are an Atlassian developer preview, roadmap watch item #19.)');
}

// Mirrors real @forge/api's webTrigger surface (out/webTrigger.js):
//   getUrl(moduleKey, forceCreate = false), deleteUrl(url), queryUrls(moduleKey?)
// Delegates to the simulator's WebTriggerUrlRegistry, which generates
// invokable localhost URLs when the dev server is running and mirrors real
// Forge's URL formats, ID parsing, and error strings otherwise.
const webTrigger = {
  // Real second param is boolean | GetUrlOptions ({ forceCreate?, secretKeyConfig? })
  getUrl: (webTriggerModuleKey: string, optionsOrForceCreate: boolean | { forceCreate?: boolean; secretKeyConfig?: unknown } = false): Promise<string> => {
    const forceCreate =
      typeof optionsOrForceCreate === 'boolean' ? optionsOrForceCreate : optionsOrForceCreate.forceCreate ?? false;
    return getSimulator().webTriggerUrls.getUrl(webTriggerModuleKey, forceCreate);
  },
  deleteUrl: (webTriggerUrl: string): Promise<void> =>
    getSimulator().webTriggerUrls.deleteUrl(webTriggerUrl),
  queryUrls: (moduleKey?: string): Promise<Array<{ moduleKey: string; url: string }>> =>
    getSimulator().webTriggerUrls.queryUrls(moduleKey),
};

/** Real (deprecated) API returns a FetchMethod, not a client object. */
function createRequestStargateAsApp(): (url: string, init?: any) => Promise<Response> {
  return (_url: string, _init?: any) =>
    notImplemented('createRequestStargateAsApp()', '(the api.atlassian.com Stargate gateway is not simulated; it is deprecated upstream — use asApp().requestJira/requestConfluence)');
}

// ── Privacy (GDPR personal data reporting) ──────────────────────────────

interface PrivacyAccount {
  accountId: string;
  [key: string]: any;
}

interface PrivacyAccountUpdate {
  accountId: string;
  // Real @forge/api narrows this to the two legal values
  status: 'updated' | 'closed';
  [key: string]: any;
}

const REPORT_URL = '/app/report-accounts';
const REPORT_BATCH_LIMIT = 90;

const privacy = {
  async reportPersonalData(accounts: PrivacyAccount[]): Promise<PrivacyAccountUpdate[]> {
    if (accounts.length === 0) return [];

    const batch = accounts.slice(0, REPORT_BATCH_LIMIT);
    const rest = accounts.slice(REPORT_BATCH_LIMIT);

    const resp = await getSimulator().productApi.request('jira', REPORT_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accounts: batch }),
    });

    let results: PrivacyAccountUpdate[];
    if (resp.status === 200) {
      const json = await resp.json();
      results = json.accounts;
    } else if (resp.status === 204) {
      results = [];
    } else {
      throw new Error(`reportPersonalData failed: ${resp.status} ${resp.statusText}`);
    }

    if (rest.length > 0) {
      const moreResults = await privacy.reportPersonalData(rest);
      return results.concat(moreResults);
    }
    return results;
  },
};

function __fetchProduct(productOrDescriptor: string | { provider?: string; remote?: string; type?: string }, path?: string, options?: any) {
  // @forge/sql calls __fetchProduct({ provider: 'app', remote: 'sql', type: 'sql' })
  // which returns a fetch-like function (curried)
  if (typeof productOrDescriptor === 'object' && productOrDescriptor.type === 'sql') {
    return getSimulator().sql.createFetchFunction();
  }

  // Legacy direct call: __fetchProduct('jira', '/rest/...', options)
  if (typeof productOrDescriptor === 'string' && path) {
    return getSimulator().productApi.request(productOrDescriptor, path, options);
  }

  // Unknown pattern
  throw new Error(`__fetchProduct: unsupported call pattern: ${JSON.stringify(productOrDescriptor)}`);
}

const __requestAtlassianAsApp = makeApiClient;
const __requestAtlassianAsUser = makeApiClient;
const __getRuntime = () => ({
  isEcosystemApp: false,
  /** Real Forge's runtime carries the invoking user's aaid — authorize() reads it. */
  get aaid(): string | undefined {
    try {
      return currentInvokingAccountId();
    } catch {
      return undefined; // no simulator set
    }
  },
});
// Real impl is AsyncLocalStorage.bind(fn); the sim has no per-invocation ALS,
// so identity preserves behavior. Generic signature matches upstream.
const bindInvocationContext = <Func extends (...args: never[]) => unknown>(fn: Func): Func => fn;
/**
 * getAppContext() — returns app-level metadata for the current invocation.
 * Pulls real values from the simulator's manifest and current module context.
 * Called by resolver/trigger/consumer code (server-side).
 */
function getAppContext() {
  const sim = getSimulator();
  const manifest = sim.getManifest?.();
  // Real runtime appContext.appId is the bare UUID; manifest app.id is the
  // full ARI. Using the ARI here double-prefixed every ARI below.
  const appId = manifest?.raw?.app?.id ? extractAppIdUuid(manifest.raw.app.id) : 'sim-app';
  const moduleKey = sim.currentModuleKey ?? 'sim-module';
  const environmentId = `sim-env-${appId}`;
  const installationId = `sim-install-${appId}`;
  const cloudId = sim.productApi.connectedAccount?.cloudId ?? 'sim-cloud-001';

  // Build ARIs matching real @forge/api's out/api/ari.js builders
  const appAri = {
    appId,
    toString: () => `ari:cloud:ecosystem::app/${appId}`,
    toJSON: () => `ari:cloud:ecosystem::app/${appId}`,
  };
  const environmentAri = {
    environmentId,
    toString: () => `ari:cloud:ecosystem::environment/${appId}/${environmentId}`,
    toJSON: () => `ari:cloud:ecosystem::environment/${appId}/${environmentId}`,
  };
  const installationAri = {
    installationId,
    toString: () => `ari:cloud:ecosystem::installation/${installationId}`,
    toJSON: () => `ari:cloud:ecosystem::installation/${installationId}`,
  };

  return {
    appAri,
    appVersion: '0.0.1-dev',
    environmentAri,
    environmentType: 'DEVELOPMENT',
    invocationId: `sim-invocation-${Date.now()}`,
    invocationRemainingTimeInMillis: () => 25000, // Forge default: 25s
    installationAri,
    moduleKey,
    license: undefined,
    installation: {
      ari: installationAri,
      contexts: [{
        cloudId,
        toString: () => `ari:cloud:jira::site/${cloudId}`,
      }],
    },
    permissions: undefined,
  };
}

// ── i18n (backed by I18nStore, same as @forge/bridge) ───────────────────

type TranslationFunction = (i18nKey: string, defaultValue?: string) => string;

function getI18nStore(): import('../i18n-store.js').I18nStore | null {
  try {
    return getSimulator().i18n ?? null;
  } catch {
    return null;
  }
}

const translationFunctionCache = new Map<string, TranslationFunction>();

const i18n = {
  resetTranslationsCache(): void {
    translationFunctionCache.clear();
    const store = getI18nStore();
    if (store) store.clear();
  },

  async getTranslations(
    locale: string,
    options: { fallback?: boolean } = { fallback: true }
  ): Promise<{ locale: ForgeSupportedLocaleCode; translations: Record<string, any> | null }> {
    const store = getI18nStore();
    if (store?.hasTranslations) {
      // Store works in plain strings; inputs come from the supported set
      return store.getTranslations(locale, { fallback: options.fallback ?? true }) as Promise<{ locale: ForgeSupportedLocaleCode; translations: Record<string, any> | null }>;
    }
    return { locale: locale as ForgeSupportedLocaleCode, translations: null };
  },

  async createTranslationFunction(locale: string): Promise<TranslationFunction> {
    const cached = translationFunctionCache.get(locale);
    if (cached) return cached;

    const store = getI18nStore();
    if (store?.hasTranslations) {
      const fn = await store.createTranslationFunction(locale);
      translationFunctionCache.set(locale, fn);
      return fn;
    }

    // No translations — return identity (key or defaultValue)
    const fn: TranslationFunction = (key, defaultValue) => defaultValue ?? key;
    translationFunctionCache.set(locale, fn);
    return fn;
  },
};

// ── Permissions (manifest-based permission checks) ──────────────────────

const permissions = {
  hasPermission(_requirements: any): { granted: boolean; missing?: any } {
    // In simulation, all permissions are granted
    return { granted: true };
  },
  hasScope(_scope: string): boolean {
    return true;
  },
  canFetchFrom(_type: 'backend' | 'client', _url: string): boolean {
    return true;
  },
  canLoadResource(_type: string, _url: string): boolean {
    return true;
  },
};

// ── Exports (matches real @forge/api) ───────────────────────────────────

export {
  privacy,
  __fetchProduct,
  __requestAtlassianAsApp,
  __requestAtlassianAsUser,
  asApp,
  asUser,
  authorize,
  forgeFetch as fetch,
  invokeRemote,
  invokeService,
  requestBitbucket,
  requestConfluence,
  requestJira,
  storage,
  webTrigger,
  createRequestStargateAsApp,
  FilterConditions,
  SortOrder,
  startsWith,
  WhereConditions,
  ExternalEndpointNotAllowedError,
  FetchError,
  FUNCTION_ERR,
  HttpError,
  InvalidWorkspaceRequestedError,
  isExpectedError,
  isForgePlatformError,
  isHostedCodeError,
  NeedsAuthenticationError,
  NotAllowedError,
  ProductEndpointNotAllowedError,
  ProxyRequestError,
  RequestProductNotAllowedError,
  __getRuntime,
  bindInvocationContext,
  getAppContext,
  assumeTrustedRoute,
  route,
  routeFromAbsolute,
  i18n,
  permissions,
};

export default {
  asApp,
  asUser,
  requestJira,
  requestConfluence,
  requestBitbucket,
  storage,
  route,
  fetch: forgeFetch,
};
