/**
 * Shim for @forge/api
 * 
 * This is the big one — provides the full @forge/api surface:
 *   import { route, requestJira, storage, fetch } from '@forge/api';
 *   import { asUser, asApp } from '@forge/api';
 */

import { getSimulator } from './globals.js';
import { WhereConditions as KvsWhereConditions } from './forge-kvs.js';

// ── Route template tag ──────────────────────────────────────────────────

function route(strings: TemplateStringsArray, ...values: any[]): string {
  let result = '';
  for (let i = 0; i < strings.length; i++) {
    result += strings[i];
    if (i < values.length) {
      result += encodeURIComponent(String(values[i]));
    }
  }
  return result;
}

function routeFromAbsolute(path: string): string {
  return path;
}

function assumeTrustedRoute(path: string): string {
  return path;
}

// ── API client builders ─────────────────────────────────────────────────

function makeApiClient() {
  return {
    requestJira(path: string, options?: any) {
      return getSimulator().productApi.request('jira', path, options);
    },
    requestConfluence(path: string, options?: any) {
      return getSimulator().productApi.request('confluence', path, options);
    },
    requestBitbucket(path: string, options?: any) {
      return getSimulator().productApi.request('bitbucket', path, options);
    },
    requestGraph(query: string, variables?: any, headers?: Record<string, string>) {
      return getSimulator().productApi.requestGraph(query, variables, headers);
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

    async fetch(url: string, options?: any): Promise<any> {
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
  };
}

function asApp() { return makeApiClient(); }

// Top-level convenience (these use asUser by default in real Forge)
function requestJira(path: string, options?: any) {
  return getSimulator().productApi.request('jira', path, options);
}
function requestConfluence(path: string, options?: any) {
  return getSimulator().productApi.request('confluence', path, options);
}
function requestBitbucket(path: string, options?: any) {
  return getSimulator().productApi.request('bitbucket', path, options);
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

async function forgeFetch(url: string, options?: any) {
  // In simulation, we can either use real fetch or mock it.
  // Default: use real fetch but log it.
  console.warn(`[forge-sim] External fetch: ${options?.method || 'GET'} ${url}`);
  return globalThis.fetch(url, options);
}

// ── Condition helpers (re-exported from @forge/api) ─────────────────────

const WhereConditions = KvsWhereConditions;

const FilterConditions = {
  equal: (value: any) => ({ condition: 'equal', value }),
  greaterThan: (value: any) => ({ condition: 'greaterThan', value }),
  greaterThanEqualTo: (value: any) => ({ condition: 'greaterThanEqualTo', value }),
  lessThan: (value: any) => ({ condition: 'lessThan', value }),
  lessThanEqualTo: (value: any) => ({ condition: 'lessThanEqualTo', value }),
  beginsWith: (value: string) => ({ condition: 'beginsWith', value }),
  exists: () => ({ condition: 'exists' }),
};

const SortOrder = {
  ASC: 'ASC' as const,
  DESC: 'DESC' as const,
};

function startsWith(prefix: string) {
  return WhereConditions.beginsWith(prefix);
}

// ── Error classes ───────────────────────────────────────────────────────

class FetchError extends Error {
  constructor(message: string) { super(message); this.name = 'FetchError'; }
}

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message); this.name = 'HttpError'; this.status = status;
  }
}

class NotAllowedError extends Error {
  constructor(message = 'Not allowed') { super(message); this.name = 'NotAllowedError'; }
}

class ExternalEndpointNotAllowedError extends NotAllowedError {
  constructor(url?: string) { super(`External endpoint not allowed: ${url}`); }
}

class ProductEndpointNotAllowedError extends NotAllowedError {
  constructor(path?: string) { super(`Product endpoint not allowed: ${path}`); }
}

class RequestProductNotAllowedError extends NotAllowedError {
  constructor(product?: string) { super(`Request product not allowed: ${product}`); }
}

class NeedsAuthenticationError extends Error {
  constructor(message = 'Needs authentication') { super(message); this.name = 'NeedsAuthenticationError'; }
}

class InvalidWorkspaceRequestedError extends Error {
  constructor(message = 'Invalid workspace') { super(message); this.name = 'InvalidWorkspaceRequestedError'; }
}

class ProxyRequestError extends Error {
  constructor(message = 'Proxy request error') { super(message); this.name = 'ProxyRequestError'; }
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

// ── Stubs for less common APIs ──────────────────────────────────────────

function authorize(_provider: string) { return Promise.resolve(); }

async function invokeRemote(
  remoteKey: string,
  options: { path: string; method?: string; headers?: Record<string, string>; body?: string } & Record<string, any> = { path: '/' }
): Promise<any> {
  return getSimulator().remotes.invoke(remoteKey, options);
}

function invokeService(_key: string, _payload?: any) { return Promise.resolve(null); }

const webTrigger = {
  getUrl: async (_key: string) => {
    // If dev server port is set, return real local URL
    const port = (globalThis as any).__forgeSim_devPort__;
    if (port) return `http://localhost:${port}/__trigger/${_key}`;
    return `https://sim.atlassian.net/x/trigger/${_key}`;
  },
};

function createRequestStargateAsApp() { return makeApiClient(); }

// ── Privacy (GDPR personal data reporting) ──────────────────────────────

interface PrivacyAccount {
  accountId: string;
  [key: string]: any;
}

interface PrivacyAccountUpdate {
  accountId: string;
  status: string;
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
const __getRuntime = () => ({ isEcosystemApp: false });
const bindInvocationContext = (fn: Function) => fn;
/**
 * getAppContext() — returns app-level metadata for the current invocation.
 * Pulls real values from the simulator's manifest and current module context.
 * Called by resolver/trigger/consumer code (server-side).
 */
function getAppContext() {
  const sim = getSimulator();
  const manifest = sim.getManifest?.();
  const appId = manifest?.raw?.app?.id ?? 'sim-app';
  const moduleKey = sim.currentModuleKey ?? 'sim-module';
  const environmentId = `sim-env-${appId}`;
  const installationId = `sim-install-${appId}`;
  const cloudId = sim.productApi.connectedAccount?.cloudId ?? 'sim-cloud-001';

  // Build ARIs matching Atlassian's format
  const appAri = {
    appId,
    toString: () => `ari:cloud:ecosystem::app/${appId}`,
    toJSON: () => `ari:cloud:ecosystem::app/${appId}`,
  };
  const environmentAri = {
    environmentId,
    toString: () => `ari:cloud:ecosystem::app/${appId}/environment/${environmentId}`,
    toJSON: () => `ari:cloud:ecosystem::app/${appId}/environment/${environmentId}`,
  };
  const installationAri = {
    installationId,
    toString: () => `ari:cloud:ecosystem::app/${appId}/installation/${installationId}`,
    toJSON: () => `ari:cloud:ecosystem::app/${appId}/installation/${installationId}`,
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
    options: { fallback: boolean } = { fallback: true }
  ): Promise<{ locale: string; translations: Record<string, any> | null }> {
    const store = getI18nStore();
    if (store?.hasTranslations) {
      return store.getTranslations(locale, options);
    }
    return { locale, translations: null };
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

// Named re-exports matching real @forge/api
const { resetTranslationsCache, getTranslations, createTranslationFunction } = i18n;
export { resetTranslationsCache, getTranslations, createTranslationFunction };

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
