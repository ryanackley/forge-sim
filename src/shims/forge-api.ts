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
  };
}

function asUser() { return makeApiClient(); }
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
function invokeRemote(_key: string, _payload?: any) { return Promise.resolve(null); }
function invokeService(_key: string, _payload?: any) { return Promise.resolve(null); }

const webTrigger = {
  getUrl: async (_key: string) => `https://sim.atlassian.net/x/trigger/${_key}`,
};

function createRequestStargateAsApp() { return makeApiClient(); }

const privacy = {
  check: async () => ({ hasAccess: true }),
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
const getAppContext = async () => ({
  appId: 'sim-app',
  environmentId: 'sim-env',
  environmentType: 'DEVELOPMENT',
  installationId: 'sim-install',
  moduleKey: 'sim-module',
});

const i18n = {
  getMessage: (key: string) => key,
};

const permissions = {
  check: async () => ({ hasAccess: true }),
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
