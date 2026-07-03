/**
 * ForgeSimulator — the main orchestrator.
 *
 * Ties together storage, queues, resolvers, product APIs, and manifest parsing
 * into a unified simulated Forge environment.
 */

import { setSimulator } from './shims/globals.js';
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
import { SimulatedLLM } from './llm.js';
import { SimulatedRealtime } from './realtime.js';
import { SimulatedObjectStore } from './object-store.js';
import type { SimulationConfig, ResolverContext, InvokeOptions, ProductApiHandler, ProductApiRequest, ProductApiResponse } from './types.js';
import type { TriggerPayloadByEvent } from './trigger-event-types.js';
import type { ManifestAction } from './manifest.js';

// ── Forge Invocation Time Limits (seconds) ──────────────────────────────
// Per https://developer.atlassian.com/platform/forge/limits-invocation/
const INVOCATION_LIMITS: Record<string, number> = {
  resolver: 25,        // UI module resolvers (user-led)
  trigger: 55,         // Event triggers
  scheduledTrigger: 55, // Default; can be up to 900s with timeoutSeconds
  consumer: 55,        // Async event consumers; default, up to 900s
  webTrigger: 55,      // Web trigger handlers
  action: 25,          // Rovo actions (user-led, same as resolvers)
  workflow: 25,        // Workflow post-functions (treated as user-led)
  remote: 5,           // Remote events (Forge Remote)
};

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
  readonly llm: SimulatedLLM;
  readonly realtime: SimulatedRealtime;
  readonly objectStore: SimulatedObjectStore;

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

  /**
   * Module routing: maps moduleKey → { resolverFunctionKey?, endpointKey? }
   * Built by the deployer from manifest UI modules.
   */
  private moduleRouting = new Map<string, { resolverFunctionKey?: string; endpointKey?: string; moduleType?: string }>();

  /**
   * The currently active module key (set by dev-command when rendering a module).
   * Used by server-side shims that don't have URL context.
   */
  currentModuleKey: string | undefined;

  /**
   * Resolver ownership: maps define()'d function key → manifest resolver function key (which module's resolver owns it)
   * Used to scope function lookups to the correct module's resolver.
   */
  private resolverOwnership = new Map<string, string>();

  constructor(config?: SimulationConfig) {
    this.kvs = new UnifiedKVS();
    this.queue = new SimulatedQueue({ mode: config?.queueMode ?? 'sequential' });
    // Resolver gets a callback so cold MCP invokes see the same default
    // context (notably accountId/cloudId/siteUrl) as the UI render path.
    // Fix for N3 — without this, cold invokes used sim-user-001 even when
    // a real Atlassian account was connected, while UI-mediated invokes
    // used the real ARI. The asymmetry confused tests that mixed surfaces.
    this.resolver = new SimulatedResolver(() => this.getDefaultContext());
    this.productApi = new SimulatedProductApi();
    this.sql = new SimulatedForgeSQL(config?.forgeSQL);
    this.functions = new FunctionRegistry();
    this.properties = new PropertyStore();
    this.i18n = new I18nStore();
    this.externalAuth = new ExternalAuthStore();
    this.fit = new FITProvider();
    this.remotes = new RemoteProxy(this.productApi, this.fit);
    this.remotes.onLog((level, message, detail) => this.log(level, message, detail));
    this.llm = new SimulatedLLM((level, message, detail) => this.log(level, message, detail));
    this.realtime = new SimulatedRealtime((level, message, detail) => this.log(level, message, detail));
    this.objectStore = new SimulatedObjectStore();
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

    // Auto-wire as the active global simulator
    setSimulator(this);
  }

  // ── Manifest Loading ────────────────────────────────────────────────────

  async loadManifest(pathOrContent: string): Promise<ParsedManifest> {
    if (pathOrContent.includes('\n') || pathOrContent.includes('modules:')) {
      this.manifest = parseManifestContent(pathOrContent);
    } else {
      this.manifest = await parseManifest(pathOrContent);
    }

    // Clear previous routing state
    this.moduleRouting.clear();
    this.resolverOwnership.clear();

    // Wire up consumers from manifest
    for (const consumer of this.manifest.consumers) {
      this.log('info', `Registered consumer "${consumer.key}" for queue "${consumer.queue}"`);
    }

    // Register module routing and log discovered modules
    for (const ui of this.manifest.uiModules) {
      this.log('info', `Found UI module: ${ui.type} "${ui.key}"`);
      this.registerModuleRoute(ui.key, {
        resolverFunctionKey: ui.resolverFunctionKey,
        endpointKey: ui.endpointKey,
        moduleType: ui.type,
      });
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
    this.moduleRouting.clear();
    this.resolverOwnership.clear();

    for (const consumer of manifest.consumers) {
      this.log('info', `Registered consumer "${consumer.key}" for queue "${consumer.queue}"`);
    }
    for (const ui of manifest.uiModules) {
      this.log('info', `Found UI module: ${ui.type} "${ui.key}"`);
      this.registerModuleRoute(ui.key, {
        resolverFunctionKey: ui.resolverFunctionKey,
        endpointKey: ui.endpointKey,
        moduleType: ui.type,
      });
    }

    for (const wt of manifest.webTriggers) {
      this.log('info', `Found web trigger: "${wt.key}" → function "${wt.functionKey}"`);
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

  // ── Module Routing ────────────────────────────────────────────────────────

  /**
   * Register a UI module's routing info (called by deployer).
   * Maps moduleKey → resolver function key or endpoint key.
   */
  registerModuleRoute(moduleKey: string, route: { resolverFunctionKey?: string; endpointKey?: string; moduleType?: string }): void {
    this.moduleRouting.set(moduleKey, route);
  }

  /**
   * Register resolver ownership: a define()'d function key belongs to a manifest resolver.
   */
  registerResolverOwnership(definedKey: string, resolverFunctionKey: string): void {
    this.resolverOwnership.set(definedKey, resolverFunctionKey);
  }

  /**
   * Get the module route for a given module key.
   */
  getModuleRoute(moduleKey: string): { resolverFunctionKey?: string; endpointKey?: string; moduleType?: string } | undefined {
    return this.moduleRouting.get(moduleKey);
  }

  /**
   * Get the module type (e.g., 'jira:issuePanel', 'confluence:globalPage') for a module key.
   */
  getModuleType(moduleKey: string): string | undefined {
    return this.moduleRouting.get(moduleKey)?.moduleType;
  }

  /**
   * Validate that a function key is reachable from a module.
   * If moduleKey is provided, checks that the function key belongs to that module's resolver.
   * Returns the function key if valid, throws if not.
   */
  validateResolverAccess(functionKey: string, moduleKey?: string): void {
    if (!moduleKey) return; // No module context — skip validation (backward compat)

    const route = this.moduleRouting.get(moduleKey);
    if (!route) {
      throw new Error(
        `Unknown module "${moduleKey}". Available modules: ${[...this.moduleRouting.keys()].join(', ') || 'none'}`
      );
    }

    if (route.endpointKey && !route.resolverFunctionKey) {
      throw new Error(
        `Module "${moduleKey}" is configured with endpoint "${route.endpointKey}", not a resolver. Use invokeRemote() instead of invoke().`
      );
    }

    if (!route.resolverFunctionKey) {
      throw new Error(
        `Module "${moduleKey}" has no resolver or endpoint configured.`
      );
    }

    // Check that the function key belongs to this module's resolver
    const owner = this.resolverOwnership.get(functionKey);
    if (owner && owner !== route.resolverFunctionKey) {
      throw new Error(
        `Function "${functionKey}" belongs to resolver "${owner}", but module "${moduleKey}" uses resolver "${route.resolverFunctionKey}". ` +
        `In Forge, each module can only invoke functions defined in its own resolver.`
      );
    }
  }

  /**
   * Validate and resolve the endpoint for a remote invoke from a module.
   * Returns the endpoint key. Throws if module has no endpoint.
   */
  resolveModuleEndpoint(moduleKey?: string): string | undefined {
    if (!moduleKey) {
      // No module context — fall back to single-endpoint auto-resolve
      const modulesWithEndpoints = [...this.moduleRouting.entries()].filter(([, r]) => r.endpointKey);
      if (modulesWithEndpoints.length === 1) {
        return modulesWithEndpoints[0][1].endpointKey;
      }
      return undefined;
    }

    const route = this.moduleRouting.get(moduleKey);
    if (!route) {
      throw new Error(
        `Unknown module "${moduleKey}". Available modules: ${[...this.moduleRouting.keys()].join(', ') || 'none'}`
      );
    }

    if (!route.endpointKey) {
      throw new Error(
        `Module "${moduleKey}" has no endpoint configured. invokeRemote() requires a resolver.endpoint in the manifest. ` +
        `Available modules with endpoints: ${[...this.moduleRouting.entries()].filter(([, r]) => r.endpointKey).map(([k]) => k).join(', ') || 'none'}`
      );
    }

    return route.endpointKey;
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
   * Uses the resolver's { payload, context } wrapping — the UI bridge pattern.
   *
   * The optional third arg is an `InvokeOptions` object:
   *   - `moduleKey` scopes resolver lookup for module-routed resolvers
   *     (validates the function key is accessible from that module — Forge parity).
   *   - `context` overrides request context for THIS invocation only.
   *     Merged onto base context (sticky `setContext()` + defaults). Mutating
   *     state happens only in setContext(); the override here is one-shot.
   *
   * Example:
   *   await sim.invoke('castVote', payload, { context: { accountId: 'alice' } });
   *   await sim.invoke('getDataA', payload, { moduleKey: 'panel-a' });
   *   await sim.invoke('castVote', payload, {
   *     moduleKey: 'pulse-macro',
   *     context: { accountId: 'bob', extension: { contentId: '12345' } },
   *   });
   */
  async invoke(
    functionKey: string,
    payload?: any,
    options?: InvokeOptions
  ): Promise<any> {
    const { moduleKey, contextOverride } = parseInvokeOptions(options);

    this.log('invoke', `Invoking resolver: ${functionKey}${moduleKey ? ` (module: ${moduleKey})` : ''}`, payload);

    // Validate module → resolver access if module context is available
    this.validateResolverAccess(functionKey, moduleKey);

    // Determine function type for timeout limits
    const fnMeta = this.manifest?.functions.get(functionKey);
    const fnType = fnMeta?.type || 'resolver';

    const startMs = Date.now();
    try {
      const { result, console: captured } = await withCapture(() =>
        this.resolver.invoke(functionKey, payload, contextOverride)
      );
      this.consoleLogs.push(...captured);
      for (const line of captured) {
        this.log(`console.${line.level}`, line.message);
      }
      this.checkInvocationTime(functionKey, startMs, fnType, fnMeta?.timeoutSeconds);
      this.log('invoke', `Resolver "${functionKey}" returned`, result);
      return result;
    } catch (err) {
      if ((err as any).capturedConsole) {
        this.consoleLogs.push(...(err as any).capturedConsole);
      }
      this.checkInvocationTime(functionKey, startMs, fnType, fnMeta?.timeoutSeconds);
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

  /**
   * Mock GraphQL responses by operation name.
   * See SimulatedProductApi.mockGraphQL for details.
   */
  mockGraphQL(mocks: Record<string, any>): void {
    this.productApi.mockGraphQL(mocks);
  }

  // ── Queue shortcuts ─────────────────────────────────────────────────────

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
   * Build the default Forge context, consulting the connected Atlassian
   * account (if any) for accountId/cloudId/siteUrl. Single source of truth
   * shared by the resolver, trigger, and UI render paths so they don't
   * disagree on who the current user is.
   *
   * Falls back to the sim-* placeholders when no real account is connected.
   */
  getDefaultContext(): ResolverContext {
    const account = this.productApi.connectedAccount;
    return {
      accountId: account?.accountId ?? 'sim-user-001',
      cloudId: account?.cloudId ?? 'sim-cloud-001',
      siteUrl: account ? `https://${account.site}` : 'https://sim-site.atlassian.net',
      moduleKey: 'sim-module',
      installContext: account
        ? `ari:cloud:jira::site/${account.cloudId}`
        : 'ari:cloud:jira::site/sim-site',
    };
  }

  /**
   * Build a Forge context for trigger/consumer invocation. Layers any
   * explicit overrides on top of the simulator's default context and the
   * resolver's context overrides.
   */
  private buildContext(overrides?: Record<string, unknown>): Record<string, unknown> {
    return {
      ...this.getDefaultContext(),
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
   *
   * Overload behavior:
   * - known documented trigger names get strong payload typing
   * - arbitrary strings still work for forward-compat and experimentation
   */
  async fireTrigger<K extends keyof TriggerPayloadByEvent>(eventName: K, data: TriggerPayloadByEvent[K]): Promise<any[]>;
  async fireTrigger(eventName: string, data?: Record<string, unknown>): Promise<any[]>;
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

      const triggerStartMs = Date.now();
      try {
        const { result, console: captured } = await withCapture(() =>
          handler(event, context)
        );
        this.consoleLogs.push(...captured);
        for (const line of captured) {
          this.log(`console.${line.level}`, line.message);
        }
        this.checkInvocationTime(`trigger:${trigger.key}`, triggerStartMs, 'trigger');
        results.push(result);
      } catch (err) {
        if ((err as any).capturedConsole) {
          this.consoleLogs.push(...(err as any).capturedConsole);
        }
        this.checkInvocationTime(`trigger:${trigger.key}`, triggerStartMs, 'trigger');
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

    // Scheduled triggers can have custom timeoutSeconds (up to 900s)
    const fnMeta = this.manifest.functions.get(st.functionKey);
    const customTimeout = fnMeta?.timeoutSeconds;

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

    const schedStartMs = Date.now();
    try {
      const { result, console: captured } = await withCapture(() =>
        handler(request, context)
      );
      this.consoleLogs.push(...captured);
      for (const line of captured) {
        this.log(`console.${line.level}`, line.message);
      }
      this.checkInvocationTime(`scheduledTrigger:${triggerKey}`, schedStartMs, 'scheduledTrigger', customTimeout);

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
      try { listener(entry); } catch (err) {
        console.error('[forge-sim] Log listener threw:', err instanceof Error ? err.message : err);
      }
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

  /**
   * Build the response payload for the MCP `forge.logs` tool (and any other
   * caller that wants the same JSON shape). Extracted as a pure function so
   * tests can lock down the contract without spinning up the MCP server.
   *
   * F4: the captured `console.*` lines used to be shown only as a count
   * (`consoleLinesTotal: N`) while the actual lines hid in the main `logs`
   * stream under the obscure `level=console.<kind>` prefix — agents had to
   * guess that filter. Now they live in their own top-level `console` array
   * so they're impossible to miss. The `logs` view still includes the
   * `console.*` entries (mirrored via `this.log()` from each capture site)
   * so existing filter-based discovery keeps working.
   */
  buildLogsResponse(options?: {
    /** Filter `logs` entries by exact level match or level prefix. */
    level?: string;
    /** Maximum entries to return for both `logs` and `console`. Default 100. */
    limit?: number;
  }): {
    totalEntries: number;
    showing: number;
    consoleLinesTotal: number;
    console: Array<{ time: string; level: string; message: string }>;
    logs: Array<{ time: string; level: string; message: string; data?: unknown }>;
  } {
    const { level, limit } = options ?? {};
    let logs = this.getLogs();
    if (level) {
      logs = logs.filter((l) => l.level === level || l.level.startsWith(level));
    }
    const maxEntries = limit ?? 100;
    const recentLogs = logs.slice(-maxEntries);
    const recentConsole = this.consoleLogs.slice(-maxEntries);

    return {
      totalEntries: logs.length,
      showing: recentLogs.length,
      consoleLinesTotal: this.consoleLogs.length,
      console: recentConsole.map((line) => ({
        time: new Date(line.timestamp).toISOString(),
        level: line.level,
        message: line.message,
      })),
      logs: recentLogs.map((l) => ({
        time: new Date(l.timestamp).toISOString(),
        level: l.level,
        message: l.message,
        ...(l.data !== undefined ? { data: l.data } : {}),
      })),
    };
  }

  clearLogs(): void {
    this.logs.length = 0;
    this.consoleLogs.length = 0;
  }

  // ── Invocation Timing ──────────────────────────────────────────────────

  /**
   * Check if an invocation exceeded its Forge time limit and log a warning.
   * Returns the elapsed time in ms.
   */
  private checkInvocationTime(
    label: string,
    startMs: number,
    type: string,
    customTimeoutSeconds?: number,
  ): number {
    const elapsedMs = Date.now() - startMs;
    const limitSeconds = customTimeoutSeconds ?? INVOCATION_LIMITS[type] ?? 25;
    const elapsedSeconds = elapsedMs / 1000;

    if (elapsedSeconds > limitSeconds) {
      this.log('error',
        `⏱️ TIMEOUT: "${label}" took ${elapsedSeconds.toFixed(1)}s — exceeds Forge ${type} limit of ${limitSeconds}s. ` +
        `In production, this invocation would be killed by the Forge runtime.`
      );
    } else if (elapsedSeconds > limitSeconds * 0.8) {
      this.log('warn',
        `⏱️ SLOW: "${label}" took ${elapsedSeconds.toFixed(1)}s — approaching Forge ${type} limit of ${limitSeconds}s (80% threshold).`
      );
    }

    return elapsedMs;
  }

  /**
   * Validate Rovo action inputs against the action's schema.
   * Returns an array of validation errors (empty = valid).
   */
  validateActionInputs(actionKey: string, payload: Record<string, any>): string[] {
    if (!this.manifest) return [];
    const action = this.manifest.actions.find(a => a.key === actionKey);
    if (!action) return [];

    const errors: string[] = [];
    for (const [name, schema] of Object.entries(action.inputs)) {
      const value = payload[name];

      // Check required
      if (schema.required && (value === undefined || value === null || value === '')) {
        errors.push(`Missing required input: "${name}" (${schema.title})`);
        continue;
      }

      if (value === undefined || value === null) continue;

      // Check type
      switch (schema.type) {
        case 'string':
          if (typeof value !== 'string') errors.push(`Input "${name}" should be string, got ${typeof value}`);
          break;
        case 'integer':
          if (typeof value !== 'number' || !Number.isInteger(value)) errors.push(`Input "${name}" should be integer, got ${typeof value === 'number' ? value : typeof value}`);
          break;
        case 'number':
          if (typeof value !== 'number') errors.push(`Input "${name}" should be number, got ${typeof value}`);
          break;
        case 'boolean':
          if (typeof value !== 'boolean') errors.push(`Input "${name}" should be boolean, got ${typeof value}`);
          break;
      }
    }

    return errors;
  }

  // ── Auth / Environment Connection ───────────────────────────────────────

  /**
   * Load auth credentials from environment variables and/or .forge-sim config files.
   * **Must be called after deploy()** — uses the deployed app directory for .forge-sim lookups.
   *
   * ENV vars take priority over .forge-sim files.
   *
   * **Atlassian credentials (ENV):**
   *   FORGE_SIM_SITE, FORGE_SIM_EMAIL, FORGE_SIM_PAT — builds a PAT account
   *   FORGE_SIM_CLOUD_ID, FORGE_SIM_ACCOUNT_ID — optional overrides
   *
   * **Atlassian credentials (.forge-sim fallback):**
   *   Loads from loadCredentials(appDir) → getDefaultAccount()
   *
   * **Third-party provider tokens (ENV):**
   *   FORGE_SIM_PROVIDER_<KEY>_TOKEN — KEY is provider key uppercased, hyphens→underscores
   *
   * **Third-party tokens (.forge-sim fallback):**
   *   Loads from credential store thirdParty tokens for the default account
   *
   * **Provider secrets (.forge-sim only):**
   *   Always tries loadProviderSecrets(appDir)
   */
  async loadAuthFromEnv(): Promise<LoadAuthResult> {
    if (!this.appDir) {
      throw new Error('loadAuthFromEnv() requires deploy() to be called first');
    }
    const appDir = this.appDir;
    const result: LoadAuthResult = { atlassian: { connected: false }, providers: [] };

    // Track which provider keys got tokens from env vars (so we skip them in fallback)
    const envProviderKeys = new Set<string>();

    // ── 1. Atlassian credentials ──────────────────────────────────────────

    const envSite = process.env.FORGE_SIM_SITE;
    const envEmail = process.env.FORGE_SIM_EMAIL;
    const envPat = process.env.FORGE_SIM_PAT;

    if (envSite && envEmail && envPat) {
      // Build PAT account from env vars
      const account: import('./auth/credentials.js').AtlassianAccount = {
        id: 'env-pat',
        name: envEmail.split('@')[0],
        email: envEmail,
        site: envSite,
        cloudId: process.env.FORGE_SIM_CLOUD_ID ?? 'env-cloud-id',
        accountId: process.env.FORGE_SIM_ACCOUNT_ID ?? 'env-user',
        authType: 'pat',
        accessToken: envPat,
        refreshToken: '',
        expiresAt: 0,
        scopes: [],
        default: true,
      };

      this.productApi.connectRealApis(account);
      result.atlassian = { connected: true, site: envSite, authType: 'pat' };
      this.log('info', `Connected to Atlassian via PAT (env): ${envSite}`);
    } else {
      // .forge-sim fallback
      try {
        const { loadCredentials, getDefaultAccount } = await import('./auth/credentials.js');
        const store = await loadCredentials(appDir);
        const account = getDefaultAccount(store);

        if (account) {
          this.productApi.connectRealApis(account);

          result.atlassian = { connected: true, site: account.site, authType: account.authType };
          this.log('info', `Connected to Atlassian via PAT (.forge-sim): ${account.site}`);

          // Load third-party OAuth tokens for this account from credential store
          const thirdPartyTokens = store.thirdParty[account.id];
          if (thirdPartyTokens) {
            for (const [providerKey, token] of Object.entries(thirdPartyTokens)) {
              // Only set if not already set by env var
              if (!envProviderKeys.has(providerKey)) {
                this.externalAuth.setToken(providerKey, token);
                result.providers.push(providerKey);
                this.log('info', `Loaded 3p token (.forge-sim): ${providerKey}`);
              }
            }
          }
        }
      } catch {}
    }

    // ── 2. Third-party provider tokens (ENV) ─────────────────────────────

    const providerEnvPrefix = 'FORGE_SIM_PROVIDER_';
    const providerEnvSuffix = '_TOKEN';
    for (const [envKey, envValue] of Object.entries(process.env)) {
      if (envKey.startsWith(providerEnvPrefix) && envKey.endsWith(providerEnvSuffix) && envValue) {
        // Extract provider key: FORGE_SIM_PROVIDER_GOOGLE_APIS_TOKEN → GOOGLE_APIS → google-apis
        const rawKey = envKey.slice(providerEnvPrefix.length, -providerEnvSuffix.length);
        const providerKey = rawKey.toLowerCase().replace(/_/g, '-');
        this.externalAuth.setToken(providerKey, { provider: providerKey, accessToken: envValue });
        envProviderKeys.add(providerKey);
        if (!result.providers.includes(providerKey)) {
          result.providers.push(providerKey);
        }
        this.log('info', `Loaded 3p token (env): ${providerKey}`);
      }
    }

    // ── 3. Third-party tokens (.forge-sim fallback for non-env providers) ─

    // If we connected via env PAT (no credential store account), try loading 3p tokens from store too
    if (envSite && envEmail && envPat) {
      try {
        const { loadCredentials, getDefaultAccount } = await import('./auth/credentials.js');
        const store = await loadCredentials(appDir);
        const account = getDefaultAccount(store);
        if (account) {
          const thirdPartyTokens = store.thirdParty[account.id];
          if (thirdPartyTokens) {
            for (const [providerKey, token] of Object.entries(thirdPartyTokens)) {
              if (!envProviderKeys.has(providerKey)) {
                this.externalAuth.setToken(providerKey, token);
                if (!result.providers.includes(providerKey)) {
                  result.providers.push(providerKey);
                }
                this.log('info', `Loaded 3p token (.forge-sim): ${providerKey}`);
              }
            }
          }
        }
      } catch {}
    }

    // ── 4. Provider secrets (.forge-sim only) ─────────────────────────────

    try {
      const { loadProviderSecrets } = await import('./external-auth-store.js');
      const secrets = await loadProviderSecrets(appDir);
      this.externalAuth.loadSecrets(secrets);
      const secretCount = Object.keys(secrets).length;
      if (secretCount > 0) {
        this.log('info', `Loaded ${secretCount} provider secret${secretCount > 1 ? 's' : ''}`);
      }
    } catch {}

    // ── 5. LLM API key (Anthropic for @forge/llm) ──────────────────────

    try {
      const { getAnthropicApiKey } = await import('./auth/config.js');
      const llmKey = await getAnthropicApiKey();
      if (llmKey) {
        this.llm.setApiKey(llmKey);
        const source = process.env.ANTHROPIC_API_KEY ? 'env' : 'config';
        result.llm = { configured: true, source };
        this.log('info', `Loaded Anthropic API key (${source})`);
      }
    } catch {}

    return result;
  }

  // ── Full Reset ──────────────────────────────────────────────────────────

  /**
   * Clear all simulator state — KVS, queues, resolvers, manifest, logs,
   * UI bridge, realtime, and SQL tables. The MySQL server itself stays
   * running (restarting it would cost seconds per reset); only its tables
   * are dropped, leaving an empty schema.
   *
   * Async because clearing SQL requires a query roundtrip. If SQL was
   * never started, the SQL portion is a no-op.
   *
   * Call `stop()` (separately) to actually shut down the MySQL server.
   */
  async reset(): Promise<void> {
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
    this.llm.reset();
    this.moduleRouting.clear();
    this.resolverOwnership.clear();
    this.realtime.reset();
    this.objectStore.reset();
    this.manifest = null;
    this.logs.length = 0;
    this.consoleLogs.length = 0;
    // SQL: drop all tables but keep the server running.
    await this.sql.reset();
  }

  /**
   * Stop all background services (MySQL server, etc.).
   * Call this when you're done with the simulator.
   */
  async stop(): Promise<void> {
    this.objectStore.stop();
    await this.sql.stop();
  }
}

export interface LogEntry {
  timestamp: number;
  level: string;
  message: string;
  data?: any;
}

export interface LoadAuthResult {
  atlassian: {
    connected: boolean;
    site?: string;
    authType?: string;
  };
  /** Provider keys that had tokens loaded (from env or .forge-sim). */
  providers: string[];
  /** LLM (Anthropic) API key status. */
  llm?: {
    configured: boolean;
    source: 'env' | 'config';
  };
}

/**
 * Validate and unpack the InvokeOptions third arg of sim.invoke().
 *
 * Pre-release we reject anything that isn't a plain options object — common
 * mistakes get a TypeError pointing at the intended shape rather than a
 * confusing downstream "Unknown module '[object Object]'" failure.
 *
 * Accepts:
 *   - undefined / null  (no options)
 *   - { moduleKey?: string, context?: Partial<ResolverContext> }
 *
 * Rejects (with a fix-it hint):
 *   - strings, numbers, booleans, arrays
 *   - objects with unknown top-level keys (e.g. raw `{ accountId: 'x' }`)
 */
function parseInvokeOptions(
  options: InvokeOptions | undefined
): { moduleKey: string | undefined; contextOverride: Partial<ResolverContext> | undefined } {
  if (options === undefined || options === null) {
    return { moduleKey: undefined, contextOverride: undefined };
  }

  if (typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError(
      `sim.invoke() third arg must be an InvokeOptions object ` +
      `({ moduleKey?, context? }) or omitted. Got: ${typeof options}` +
      (typeof options === 'string'
        ? `. To scope to a module, use { moduleKey: "${options}" }.`
        : '')
    );
  }

  const known = new Set(['moduleKey', 'context']);
  const unknownKeys = Object.keys(options).filter((k) => !known.has(k));

  if (unknownKeys.length > 0) {
    // Detect the most common mistake: passing a bare context shape like
    // { accountId: 'alice' } instead of { context: { accountId: 'alice' } }.
    const looksLikeContext = unknownKeys.some((k) =>
      ['accountId', 'cloudId', 'siteUrl', 'installContext', 'extension', 'principal', 'license', 'localId'].includes(k)
    );
    const hint = looksLikeContext
      ? ` Did you mean { context: { ${unknownKeys.map((k) => `${k}: ...`).join(', ')} } }?`
      : '';
    throw new TypeError(
      `sim.invoke() options object has unknown key(s): ${unknownKeys.map((k) => `"${k}"`).join(', ')}. ` +
      `Valid keys: moduleKey, context.${hint}`
    );
  }

  const { moduleKey, context } = options;

  if (moduleKey !== undefined && typeof moduleKey !== 'string') {
    throw new TypeError(
      `sim.invoke() options.moduleKey must be a string, got: ${typeof moduleKey}`
    );
  }

  if (context !== undefined && (typeof context !== 'object' || context === null || Array.isArray(context))) {
    throw new TypeError(
      `sim.invoke() options.context must be an object (Partial<ResolverContext>), got: ${typeof context}`
    );
  }

  return { moduleKey, contextOverride: context };
}

/**
 * Create (or replace) the global simulator singleton.
 * This is the preferred way to initialize forge-sim.
 *
 * @param config - Optional simulation configuration
 * @returns The new ForgeSimulator instance (also accessible via getSimulator())
 */
export function createSimulator(config?: SimulationConfig): ForgeSimulator {
  return new ForgeSimulator(config);
}

// Re-export everything for convenience
export { UnifiedKVS, WhereConditions, KVSQueryBuilder } from './kvs.js';
/** @deprecated Use UnifiedKVS instead */
export { UnifiedKVS as SimulatedKVS } from './kvs.js';
export { SimulatedQueue } from './queue.js';
export { SimulatedResolver } from './resolver.js';
export { SimulatedProductApi, route } from './product-api.js';
export { parseManifest, parseManifestContent } from './manifest.js';
export { setSimulator };
export { getSimulator } from './shims/globals.js';
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
export type { ResolverContext, ResolverRequest, InvokeOptions } from './types.js';
