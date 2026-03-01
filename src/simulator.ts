/**
 * ForgeSimulator — the main orchestrator.
 *
 * Ties together storage, queues, resolvers, product APIs, and manifest parsing
 * into a unified simulated Forge environment.
 */

import { SimulatedKVS } from './storage.js';
import { SimulatedQueue } from './queue.js';
import { SimulatedResolver } from './resolver.js';
import { SimulatedProductApi, route } from './product-api.js';
import { parseManifest, parseManifestContent, type ParsedManifest } from './manifest.js';
import type { SimulationConfig, ResolverContext, ProductApiHandler, ProductApiRequest, ProductApiResponse } from './types.js';

export class ForgeSimulator {
  readonly kvs: SimulatedKVS;
  readonly queue: SimulatedQueue;
  readonly resolver: SimulatedResolver;
  readonly productApi: SimulatedProductApi;

  private manifest: ParsedManifest | null = null;
  private logs: LogEntry[] = [];

  constructor(config?: SimulationConfig) {
    this.kvs = new SimulatedKVS();
    this.queue = new SimulatedQueue();
    this.resolver = new SimulatedResolver();
    this.productApi = new SimulatedProductApi();

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

    return this.manifest;
  }

  getManifest(): ParsedManifest | null {
    return this.manifest;
  }

  // ── Resolver Invocation ─────────────────────────────────────────────────

  /**
   * Invoke a resolver function, simulating the bridge invoke call.
   */
  async invoke(functionKey: string, payload?: any): Promise<any> {
    this.log('invoke', `Invoking resolver: ${functionKey}`, payload);
    try {
      const result = await this.resolver.invoke(functionKey, payload);
      this.log('invoke', `Resolver "${functionKey}" returned`, result);
      return result;
    } catch (err) {
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
   * Fire a product event trigger (e.g., 'avi:jira:created:issue').
   * Looks up registered trigger handlers and invokes them.
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

    const results: any[] = [];
    for (const trigger of matchingTriggers) {
      this.log('trigger', `Firing trigger "${trigger.key}" for event: ${eventName}`);
      try {
        const result = await this.resolver.invoke(trigger.functionKey, {
          event: eventName,
          ...data,
        });
        results.push(result);
      } catch (err) {
        this.log('error', `Trigger "${trigger.key}" failed: ${err}`);
        results.push({ error: String(err) });
      }
    }
    return results;
  }

  // ── Logging ─────────────────────────────────────────────────────────────

  private log(level: string, message: string, data?: any): void {
    this.logs.push({
      timestamp: Date.now(),
      level,
      message,
      data,
    });
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs.length = 0;
  }

  // ── Full Reset ──────────────────────────────────────────────────────────

  reset(): void {
    this.kvs.clear();
    this.queue.clear();
    this.resolver.clear();
    this.productApi.clear();
    this.manifest = null;
    this.logs.length = 0;
  }
}

interface LogEntry {
  timestamp: number;
  level: string;
  message: string;
  data?: any;
}

// Re-export everything for convenience
export { SimulatedKVS } from './storage.js';
export { SimulatedQueue } from './queue.js';
export { SimulatedResolver } from './resolver.js';
export { SimulatedProductApi, route } from './product-api.js';
export { parseManifest, parseManifestContent } from './manifest.js';
export { WhereConditions } from './storage.js';
export { setSimulator, getSimulator } from './shims/globals.js';
export type { ParsedManifest } from './manifest.js';
