/**
 * ForgeSimulator — the main orchestrator.
 *
 * Ties together storage, queues, resolvers, product APIs, and manifest parsing
 * into a unified simulated Forge environment.
 */

import { UnifiedKVS } from './kvs.js';
import { SimulatedQueue } from './queue.js';
import { SimulatedResolver } from './resolver.js';
import { SimulatedProductApi, route } from './product-api.js';
import { SimulatedForgeSQL, type ForgeSQLOptions } from './forge-sql.js';
import { FunctionRegistry, type ForgeFunctionType } from './function-registry.js';
import { parseManifest, parseManifestContent, type ParsedManifest } from './manifest.js';
import { withCapture, type ConsoleLine } from './console-capture.js';
import { SimulatorUI } from './ui/simulator-ui.js';
import { PropertyStore } from './property-store.js';
import { I18nStore } from './i18n-store.js';
import { ExternalAuthStore } from './external-auth-store.js';
import { FITProvider } from './fit-provider.js';
import { RemoteProxy } from './remote-proxy.js';
import type { SimulationConfig, ResolverContext, ProductApiHandler, ProductApiRequest, ProductApiResponse } from './types.js';

export class ForgeSimulator {
  readonly kvs: UnifiedKVS;
  readonly queue: SimulatedQueue;
  readonly resolver: SimulatedResolver;
  readonly productApi: SimulatedProductApi;
  readonly sql: SimulatedForgeSQL;
  readonly functions: FunctionRegistry;
  readonly properties: PropertyStore;
  readonly i18n: I18nStore;
  readonly externalAuth: ExternalAuthStore;
  readonly fit: FITProvider;
  readonly remotes: RemoteProxy;

  /** UI API — ForgeDoc access, tree traversal, interaction, bridge lifecycle. */
  readonly ui: SimulatorUI;

  /**
   * @deprecated Use sim.kvs instead — entity store is now unified into UnifiedKVS.
   * This getter exists for backward compatibility only.
   */
  get entityStore(): UnifiedKVS {
    return this.kvs;
  }

  private manifest: ParsedManifest | null = null;
  private logs: LogEntry[] = [];
  private consoleLogs: ConsoleLine[] = [];
  private logListeners: Array<(entry: LogEntry) => void> = [];

  constructor(config?: SimulationConfig) {
    this.kvs = new UnifiedKVS();
    this.queue = new SimulatedQueue({ mode: config?.queueMode ?? 'sequential' });
    this.resolver = new SimulatedResolver();
    this.productApi = new SimulatedProductApi();
    this.sql = new SimulatedForgeSQL(config?.forgeSQL);
    this.functions = new FunctionRegistry();
    this.properties = new PropertyStore();
    this.i18n = new I18nStore();
    this.externalAuth = new ExternalAuthStore();
    this.fit = new FITProvider();
    this.remotes = new RemoteProxy(this.productApi, this.fit);
    this.ui = new SimulatorUI(this);

    // Register property store as fallback routes for product APIs
    this.productApi.registerPropertyStore(this.properties);

    if (config?.storageLatency !== undefined) {
      this.kvs.setLatency(config.storageLatency);
    }

    if (config?.context) {
      this.resolver.setContext(config.context);
    }

    if (config?.initialStorage) {
      for (const [key, value] of Object.entries(config.initialStorage)) {
        this.kvs.set(key, value); // fire-and-forget, sync-safe in our impl
      }
    }

    if (config?.productApis) {
      for (const [product, handler] of Object.entries(config.productApis)) {
        if (handler) this.productApi.mock(product, handler);
      }
    }
  }

  // ── Manifest Loading ────────────────────────────────────────────────────

  async loadManifest(pathOrContent: string): Promise<ParsedManifest> {
    if (pathOrContent.includes('\n') || pathOrContent.includes('modules:')) {
      this.manifest = parseManifestContent(pathOrContent);
    } else {
      this.manifest = await parseManifest(pathOrContent);
    }

    // Wire up consumers from manifest
    for (const consumer of this.manifest.consumers) {
      this.log('info', `Registered consumer "${consumer.key}" for queue "${consumer.queue}"`);
    }

    // Log discovered modules
    for (const ui of this.manifest.uiModules) {
      this.log('info', `Found UI module: ${ui.type} "${ui.key}"`);
    }

    // Wire up remotes from manifest
    this.remotes.setManifest(this.manifest);
    for (const [key, remote] of this.manifest.remotes) {
      this.log('info', `Found remote: "${key}" → ${remote.baseUrl}`);
    }
    for (const [key, ep] of this.manifest.endpoints) {
      this.log('info', `Found endpoint: "${key}" → remote "${ep.remote}"`);
    }

    // Wire up external auth providers from manifest
    if (this.manifest.authProviders.size > 0) {
      this.externalAuth.loadFromManifest(this.manifest.authProviders, this.manifest.remotes);
      for (const [key, provider] of this.manifest.authProviders) {
        this.log('info', `Found auth provider: "${key}" (${provider.name})`);
      }
    }

    return this.manifest;
  }

  getManifest(): ParsedManifest | null {
    return this.manifest;
  }

  /**
   * Set an already-parsed manifest (used by deployer).
   */
  /** The app directory from the last deploy() — used by sim.ui.render() to resolve resources. */
  private appDir: string | null = null;

  /** Get the deployed app directory. */
  getAppDir(): string | null {
    return this.appDir;
  }

  /** Set the app directory (called by deployer). */
  setAppDir(dir: string): void {
    this.appDir = dir;
    // Auto-load translations if the app has a __LOCALES__ directory
    this.i18n.loadFromAppDir(dir);
  }

  loadManifestData(manifest: ParsedManifest): void {
    this.manifest = manifest;

    for (const consumer of manifest.consumers) {
      this.log('info', `Registered consumer "${consumer.key}" for queue "${consumer.queue}"`);
    }
    for (const ui of manifest.uiModules) {
      this.log('info', `Found UI module: ${ui.type} "${ui.key}"`);
    }

    // Wire up remotes with manifest data
    this.remotes.setManifest(manifest);
    if (manifest.remotes.size > 0) {
      for (const [key, remote] of manifest.remotes) {
        this.log('info', `Found remote: "${key}" → ${remote.baseUrl}`);
      }
    }
    if (manifest.endpoints.size > 0) {
      for (const [key, ep] of manifest.endpoints) {
        this.log('info', `Found endpoint: "${key}" → remote "${ep.remote}"`);
      }
    }
  }

  /**
   * Deploy a Forge app directory into this simulator.
   * Reads the manifest, imports handler modules, and wires everything up.
   */
  async deploy(appDir: string): Promise<import('./deployer.js').DeployResult> {
    const { deploy } = await import('./deployer.js');
    return deploy(this, appDir);
  }

  // ── Function Registration ────────────────────────────────────────────────

  /**
   * Register a function with its Forge type.
   * This is the primary way to register non-resolver functions (triggers, consumers, etc.).
   * Resolver-defined functions should use sim.resolver.define() instead.
   */
  registerFunction(key: string, handler: (...args: any[]) => any, type: ForgeFunctionType = 'generic'): void {
    this.functions.register(key, handler, type);
  }

  // ── Resolver Invocation ─────────────────────────────────────────────────

  /**
   * Invoke a resolver function, simulating the @forge/bridge invoke() call.
   * This uses the resolver's { payload, context } wrapping — the UI bridge pattern.
   */
  async invoke(functionKey: string, payload?: any): Promise<any> {
    this.log('invoke', `Invoking resolver: ${functionKey}`, payload);

    try {
      const { result, console: captured } = await withCapture(() =>
        this.resolver.invoke(functionKey, payload)
      );
      this.consoleLogs.push(...captured);
      for (const line of captured) {
        this.log(`console.${line.level}`, line.message);
      }
      this.log('invoke', `Resolver "${functionKey}" returned`, result);
      return result;
    } catch (err) {
      if ((err as any).capturedConsole) {
        this.consoleLogs.push(...(err as any).capturedConsole);
      }
      this.log('error', `Resolver "${functionKey}" failed: ${err}`);
      throw err;
    }
  }

  // ── Product API shortcuts ───────────────────────────────────────────────

  /**
   * Create an API client that mirrors @forge/api's interface.
   */
  createApiClient(mode: 'asUser' | 'asApp' = 'asUser') {
    const sim = this;
    return {
      requestJira: (path: string, options?: ProductApiRequest) =>
        sim.productApi.request('jira', path, options),
      requestConfluence: (path: string, options?: ProductApiRequest) =>
        sim.productApi.request('confluence', path, options),
      requestBitbucket: (path: string, options?: ProductApiRequest) =>
        sim.productApi.request('bitbucket', path, options),
    };
  }

  /**
   * Mock product API with simple route definitions.
   */
  mockProductApi(product: string, handler: ProductApiHandler): void {
    this.productApi.mock(product, handler);
  }

  mockProductRoutes(
    product: string,
    routes: Record<string, any>
  ): void {
    this.productApi.mockRoutes(product, routes);
  }

  // ── Queue shortcuts ─────────────────────────────────────────────────────

  /**
   * Create a Queue instance (mirrors @forge/events Queue constructor).
   */
  createQueue(options: { key: string }) {
    return this.queue.createQueue(options);
  }

  /**
   * Register a consumer handler for a queue.
   */
  registerConsumer(queueKey: string, handler: (event: any, context: any) => Promise<any>): void {
    this.queue.registerConsumer(queueKey, handler);
  }

  // ── Trigger Simulation ──────────────────────────────────────────────────

  /**
   * Look up a function handler — checks function registry first, then resolver.
   * This allows both the new registerFunction() path and the legacy resolver.define() path to work.
   */
  private getFunction(key: string): ((...args: any[]) => any) | undefined {
    return this.functions.getHandler(key) ?? this.resolver.getHandler(key);
  }

  /**
   * Build the standard Forge context object.
   */
  private buildContext(overrides?: Record<string, unknown>): Record<string, unknown> {
    return {
      accountId: 'sim-user-001',
      cloudId: 'sim-cloud-001',
      installContext: 'ari:cloud:jira::site/sim-site',
      ...this.resolver.getContextOverrides(),
      ...overrides,
    };
  }

  /**
   * Fire a product event trigger (e.g., 'avi:jira:created:issue').
   *
   * Per Forge docs, trigger handlers receive TWO arguments: (event, context)
   * - event: event-specific payload ({ issue: {...} }, { sprint: {...} }, etc.)
   * - context: standard context object
   */
  async fireTrigger(eventName: string, data: Record<string, unknown> = {}): Promise<any[]> {
    if (!this.manifest) {
      throw new Error('No manifest loaded. Call loadManifest() first.');
    }

    const matchingTriggers = this.manifest.triggers.filter(
      (t) => t.events.includes(eventName)
    );

    if (matchingTriggers.length === 0) {
      this.log('warn', `No triggers registered for event: ${eventName}`);
      return [];
    }

    const context = this.buildContext();
    const event = { event: eventName, ...data };

    const results: any[] = [];
    for (const trigger of matchingTriggers) {
      this.log('trigger', `Firing trigger "${trigger.key}" for event: ${eventName}`);

      const handler = this.getFunction(trigger.functionKey);
      if (!handler) {
        this.log('error', `No handler registered for trigger function: ${trigger.functionKey}`);
        results.push({ error: `No handler for ${trigger.functionKey}` });
        continue;
      }

      try {
        const { result, console: captured } = await withCapture(() =>
          handler(event, context)
        );
        this.consoleLogs.push(...captured);
        for (const line of captured) {
          this.log(`console.${line.level}`, line.message);
        }
        results.push(result);
      } catch (err) {
        if ((err as any).capturedConsole) {
          this.consoleLogs.push(...(err as any).capturedConsole);
        }
        this.log('error', `Trigger "${trigger.key}" failed: ${err}`);
        results.push({ error: String(err) });
      }
    }
    return results;
  }

  /**
   * Fire a scheduled trigger.
   *
   * Per Forge docs, scheduled trigger handlers receive a SINGLE argument:
   *   { context: { cloudId, moduleKey }, contextToken }
   *
   * They MUST return: { statusCode: number, body?: string, headers?: object, statusText?: string }
   * - statusCode 204 = success
   * - statusCode 5xx = error
   * - Missing/wrong format = 424 Failed Dependency (platform error)
   */
  async fireScheduledTrigger(triggerKey: string): Promise<{ statusCode: number; body?: string; error?: string }> {
    if (!this.manifest) {
      throw new Error('No manifest loaded. Call loadManifest() first.');
    }

    const st = this.manifest.scheduledTriggers.find(t => t.key === triggerKey);
    if (!st) {
      throw new Error(`No scheduled trigger with key "${triggerKey}". Available: ${this.manifest.scheduledTriggers.map(t => t.key).join(', ')}`);
    }

    const handler = this.getFunction(st.functionKey);
    if (!handler) {
      throw new Error(`No handler registered for scheduled trigger function: ${st.functionKey}`);
    }

    this.log('scheduledTrigger', `Firing scheduled trigger: ${triggerKey} (${st.functionKey})`);

    // Build the request object per Forge docs
    const request = {
      context: {
        cloudId: 'sim-cloud-001',
        moduleKey: triggerKey,
      },
      contextToken: 'sim-context-token',
    };

    // Build context (principal is undefined for scheduled triggers — no user involved)
    const context = this.buildContext({ principal: undefined });

    try {
      const { result, console: captured } = await withCapture(() =>
        handler(request, context)
      );
      this.consoleLogs.push(...captured);
      for (const line of captured) {
        this.log(`console.${line.level}`, line.message);
      }

      // Validate response format per Forge docs
      if (result === undefined || result === null || typeof result !== 'object' || !('statusCode' in result)) {
        this.log('warn',
          `Scheduled trigger "${triggerKey}" returned invalid response (missing statusCode). ` +
          `Forge would record a 424 Failed Dependency. Got: ${JSON.stringify(result)}`
        );
        return {
          statusCode: 424,
          error: `Invalid response from scheduled trigger "${triggerKey}": must return { statusCode, body?, headers?, statusText? }`,
        };
      }

      const typedResult = result as { statusCode: number; body?: string; headers?: Record<string, string[]>; statusText?: string };

      if (typedResult.statusCode >= 500) {
        this.log('error', `Scheduled trigger "${triggerKey}" returned error status: ${typedResult.statusCode}`);
      } else if (typedResult.statusCode === 204) {
        this.log('scheduledTrigger', `Scheduled trigger "${triggerKey}" completed successfully (204)`);
      }

      return typedResult;
    } catch (err) {
      if ((err as any).capturedConsole) {
        this.consoleLogs.push(...(err as any).capturedConsole);
      }
      this.log('error', `Scheduled trigger "${triggerKey}" threw: ${err}`);
      return { statusCode: 500, error: String(err) };
    }
  }

  // ── Logging ─────────────────────────────────────────────────────────────

  private log(level: string, message: string, data?: any): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      data,
    };
    this.logs.push(entry);
    for (const listener of this.logListeners) {
      try { listener(entry); } catch {}
    }
  }

  /** Register a listener for real-time log events. Returns unsubscribe function. */
  onLog(listener: (entry: LogEntry) => void): () => void {
    this.logListeners.push(listener);
    return () => {
      this.logListeners = this.logListeners.filter(l => l !== listener);
    };
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  getConsoleLogs(): ConsoleLine[] {
    return [...this.consoleLogs];
  }

  clearLogs(): void {
    this.logs.length = 0;
    this.consoleLogs.length = 0;
  }

  // ── Full Reset ──────────────────────────────────────────────────────────

  reset(): void {
    // Tear down UI bridge first — swallows stale React effects that fire after reset
    this.ui.reset();
    this.kvs.clear();
    this.queue.clear();
    this.resolver.clear();
    this.functions.clear();
    this.productApi.clear();
    this.properties.clear();
    this.i18n.clear();
    this.remotes.setManifest(null);
    this.manifest = null;
    this.logs.length = 0;
    this.consoleLogs.length = 0;
    // Note: SQL server is NOT stopped on reset — it's expensive to restart.
    // Call stop() explicitly when done.
  }

  /**
   * Stop all background services (MySQL server, etc.).
   * Call this when you're done with the simulator.
   */
  async stop(): Promise<void> {
    await this.sql.stop();
  }
}

export interface LogEntry {
  timestamp: number;
  level: string;
  message: string;
  data?: any;
}

// Re-export everything for convenience
export { UnifiedKVS, WhereConditions, KVSQueryBuilder } from './kvs.js';
/** @deprecated Use UnifiedKVS instead */
export { UnifiedKVS as SimulatedKVS } from './kvs.js';
export { SimulatedQueue } from './queue.js';
export { SimulatedResolver } from './resolver.js';
export { SimulatedProductApi, route } from './product-api.js';
export { parseManifest, parseManifestContent } from './manifest.js';
export { setSimulator, getSimulator } from './shims/globals.js';
export type { ParsedManifest } from './manifest.js';
export type { ConsoleLine } from './console-capture.js';
export { SimulatedForgeSQL } from './forge-sql.js';
export type { ForgeSQLOptions } from './forge-sql.js';
/** @deprecated Use UnifiedKVS instead */
export { UnifiedKVS as SimulatedEntityStore } from './kvs.js';
export type { EntitySchema, IndexDefinition, StoredEntry } from './kvs.js';
export { FunctionRegistry } from './function-registry.js';
export type { ForgeFunctionType, RegisteredFunction } from './function-registry.js';
export { FITProvider } from './fit-provider.js';
export { RemoteProxy } from './remote-proxy.js';
