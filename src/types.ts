/**
 * Core types for the Forge simulation environment.
 */

// ── Manifest Types ──────────────────────────────────────────────────────────

export interface ForgeManifest {
  app: {
    id?: string;
    name?: string;
    runtime?: {
      name?: string;       // nodejs24.x | nodejs22.x | nodejs20.x
      architecture?: string; // arm64 | x86_64
      memoryMB?: number;     // 128-1024, default 512
    };
    storage?: {
      entities?: ManifestEntityDef[];
    };
  };
  modules: Record<string, ManifestModule[]>;
  permissions?: {
    scopes?: string[];
    external?: { fetch?: { backend?: string[] } };
  };
  remotes?: ManifestRemote[];
  providers?: {
    auth?: ManifestAuthProvider[];
  };
}

/**
 * Custom Entity Store schema (manifest-declared).
 * Mirrors Forge's app.storage.entities[*] shape — see
 * https://developer.atlassian.com/platform/forge/storage-reference/entities-manifest/
 */
export interface ManifestEntityDef {
  name: string;
  attributes: Record<string, ManifestEntityAttribute>;
  indexes?: ManifestEntityIndex[];
}

export interface ManifestEntityAttribute {
  /** Forge supports: integer | float | string | boolean | any */
  type: string;
}

export interface ManifestEntityIndex {
  name: string;
  partition: string[];
  range?: string;
}

export interface ManifestRemote {
  key: string;
  baseUrl: string;
  operations?: string[];  // 'storage' | 'compute' | 'fetch' | 'other'
  auth?: {
    appUserToken?: { enabled: boolean };
    appSystemToken?: { enabled: boolean };
  };
}

export interface ManifestEndpoint {
  key: string;
  remote: string;
  route?: { path: string };
  auth?: {
    appUserToken?: { enabled: boolean };
    appSystemToken?: { enabled: boolean };
  };
}

export interface ManifestAuthProvider {
  key: string;
  name: string;
  type: string; // 'oauth2'
  clientId?: string;
  scopes?: string[];
  remotes?: string[];  // remote keys
  bearerMethod?: string;
  actions: {
    authorization: { remote: string; path: string; queryParameters?: Record<string, string> };
    exchange: { remote: string; path: string; resolvers?: Record<string, string>; useBasicAuth?: boolean };
    refreshToken?: { remote: string; path: string; resolvers?: Record<string, string>; useBasicAuth?: boolean };
    revokeToken?: { remote: string; path: string };
    retrieveProfile?: { remote: string; path: string; resolvers?: Record<string, string> };
  };
}

export interface ManifestModule {
  key: string;
  function?: string;
  resolver?: { function?: string; endpoint?: string };
  resource?: string;
  title?: string;
  queue?: string;
  schedule?: { interval: string };
  [key: string]: unknown;
}

// ── Resolver Types ──────────────────────────────────────────────────────────

export interface ResolverDefinition {
  functionKey: string;
  handler: (req: ResolverRequest) => Promise<any>;
}

export interface ResolverRequest {
  payload: any;
  context: ResolverContext;
}

export interface ResolverContext {
  accountId: string;
  cloudId: string;
  siteUrl: string;
  moduleKey: string;
  installContext: string;
  [key: string]: unknown;
}

/**
 * Options for sim.invoke() — the third arg.
 *
 * - `moduleKey` scopes resolver lookup when multiple modules register the
 *   same function key (mirrors how Forge routes invokes through a specific
 *   UI module). Required only when there's ambiguity.
 *
 * - `context` overrides the request context for THIS invocation only.
 *   Merged on top of the sim's base context (set via setContext()) and
 *   does NOT mutate sticky state — the next call without an override
 *   sees the unchanged base. Shape matches Forge's `req.context`, so any
 *   field there is fair game: `accountId`, `cloudId`, `localId`,
 *   `extension`, `principal`, `license`, `installContext`.
 *
 * Example:
 *   await sim.invoke('castVote', payload, { context: { accountId: 'alice' } });
 *   await sim.invoke('castVote', payload, { context: { accountId: 'bob' } });
 */
export interface InvokeOptions {
  moduleKey?: string;
  context?: Partial<ResolverContext>;
}

// ── Storage Types ───────────────────────────────────────────────────────────

export interface StorageEntry {
  key: string;
  value: any;
}

export interface StorageQueryOptions {
  where?: {
    field: 'key';
    condition: 'beginsWith';
    value: string;
  };
  limit?: number;
  cursor?: string;
  sortDirection?: 'ASC' | 'DESC';
}

export interface StorageQueryResult {
  results: StorageEntry[];
  nextCursor?: string;
}

// ── Queue / Async Events Types ──────────────────────────────────────────────

export interface QueueConcurrency {
  key: string;
  limit: number;
}

export interface QueueEvent {
  body: Record<string, unknown>;
  delayInSeconds?: number;
  concurrency?: QueueConcurrency;
}

export interface QueuePushResult {
  jobId: string;
}

export interface QueueJobStats {
  success: number;
  inProgress: number;
  failed: number;
}

// ── Product API Types ───────────────────────────────────────────────────────

export interface ProductApiRequest {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface ProductApiResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  ok: boolean;
  json: () => Promise<any>;
  text: () => Promise<string>;
}

export type ProductApiHandler = (
  path: string,
  options?: ProductApiRequest
) => ProductApiResponse | Promise<ProductApiResponse>;

// ── Trigger / Event Types ───────────────────────────────────────────────────

export interface TriggerEvent {
  event: string;
  data: Record<string, unknown>;
}

export type FunctionHandler = (event: any, context: any) => Promise<any>;

// ── Simulation Environment ──────────────────────────────────────────────────

export interface SimulationConfig {
  /** Mock context values */
  context?: Partial<ResolverContext>;
  /** Pre-seed storage with data */
  initialStorage?: Record<string, any>;
  /** Product API mock handlers */
  productApis?: {
    jira?: ProductApiHandler;
    confluence?: ProductApiHandler;
    bitbucket?: ProductApiHandler;
  };
  /** Queue processing mode: 'sequential' (default) or 'concurrent' */
  queueMode?: 'sequential' | 'concurrent';
  /**
   * Simulate async latency on KVS operations to expose race conditions.
   * - false (default): instant
   * - true: yield to event loop
   * - number: random delay up to this many ms
   */
  storageLatency?: boolean | number;
  /** Forge SQL options (ephemeral MySQL backend) */
  forgeSQL?: {
    /** MySQL version (default: '8.4.x') */
    mysqlVersion?: string;
    /** Database name (default: 'forge_app') */
    dbName?: string;
    /** Log level (default: 'ERROR') */
    logLevel?: 'LOG' | 'WARN' | 'ERROR';
  };
}
