/**
 * Simulated @forge/resolver.
 *
 * Mirrors the Resolver class that Forge apps use to define backend handlers.
 */

import type { ResolverRequest, ResolverContext } from './types.js';

export type ResolverHandler = (req: ResolverRequest) => any | Promise<any>;

const DEFAULT_CONTEXT: ResolverContext = {
  accountId: 'sim-user-001',
  cloudId: 'sim-cloud-001',
  siteUrl: 'https://sim-site.atlassian.net',
  moduleKey: 'sim-module',
  installContext: 'ari:cloud:jira::site/sim-site',
};

export class SimulatedResolver {
  private definitions = new Map<string, ResolverHandler>();
  private contextOverrides: Partial<ResolverContext> = {};

  /**
   * Define a resolver function (mirrors Resolver.define()).
   */
  define(functionKey: string, handler: ResolverHandler): void {
    this.definitions.set(functionKey, handler);
  }

  /**
   * Set context overrides for all invocations.
   */
  setContext(overrides: Partial<ResolverContext>): void {
    this.contextOverrides = overrides;
  }

  /**
   * Invoke a resolver function by key (mirrors bridge invoke call).
   */
  async invoke(functionKey: string, payload?: any): Promise<any> {
    const handler = this.definitions.get(functionKey);
    if (!handler) {
      const available = [...this.definitions.keys()];
      throw new Error(
        `No resolver defined for "${functionKey}". Available: ${available.join(', ') || 'none'}`
      );
    }

    const context: ResolverContext = {
      ...DEFAULT_CONTEXT,
      ...this.contextOverrides,
    };

    const req: ResolverRequest = {
      payload: payload ?? {},
      context,
    };

    return handler(req);
  }

  /**
   * Get all defined function keys.
   */
  getDefinitions(): string[] {
    return [...this.definitions.keys()];
  }

  /**
   * Get a single handler by key (for direct invocation outside resolver pattern).
   */
  getHandler(functionKey: string): ResolverHandler | undefined {
    return this.definitions.get(functionKey);
  }

  /**
   * Get the current context overrides.
   */
  getContextOverrides(): Partial<ResolverContext> {
    return { ...this.contextOverrides };
  }

  /**
   * Get the handler map (for wiring into the bridge mock).
   */
  getHandlerMap(): Map<string, ResolverHandler> {
    return new Map(this.definitions);
  }

  clear(): void {
    this.definitions.clear();
    this.contextOverrides = {};
  }
}
