/**
 * Core types for the Forge simulation environment.
 */

// ── Manifest Types ──────────────────────────────────────────────────────────

export interface ForgeManifest {
  app: {
    id?: string;
    name?: string;
  };
  modules: Record<string, ManifestModule[]>;
  permissions?: {
    scopes?: string[];
    external?: { fetch?: { backend?: string[] } };
  };
}

export interface ManifestModule {
  key: string;
  function?: string;
  resolver?: { function: string };
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
}
