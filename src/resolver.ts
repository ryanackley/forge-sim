/**
 * Simulated @forge/resolver.
 *
 * Mirrors the Resolver class that Forge apps use to define backend handlers.
 */

import type { ResolverRequest, ResolverContext } from './types.js';

export type ResolverHandler = (req: ResolverRequest) => any | Promise<any>;

/**
 * Provider for the default context that gets spread into every resolver
 * invocation. Defaults to the bare `sim-*` placeholders for backward compat
 * when the resolver is used standalone (no ForgeSimulator). When a resolver
 * lives inside a ForgeSimulator, the simulator wires a provider that reads
 * the connected Atlassian account (if any), so cold MCP invokes and
 * UI-mediated invokes both see the same accountId. Fix for N3.
 */
export type ResolverContextProvider = () => ResolverContext;

const DEFAULT_CONTEXT: ResolverContext = {
  accountId: 'sim-user-001',
  cloudId: 'sim-cloud-001',
  siteUrl: 'https://sim-site.atlassian.net',
  moduleKey: 'sim-module',
  installContext: 'ari:cloud:jira::site/sim-site',
};

const defaultContextProvider: ResolverContextProvider = () => ({ ...DEFAULT_CONTEXT });

export class SimulatedResolver {
  private definitions = new Map<string, ResolverHandler>();
  private contextOverrides: Partial<ResolverContext> = {};
  private getDefaults: ResolverContextProvider;

  constructor(getDefaults: ResolverContextProvider = defaultContextProvider) {
    this.getDefaults = getDefaults;
  }

  /**
   * Replace the context defaults provider. Called by ForgeSimulator after
   * construction (or after a connected account changes) so resolvers see
   * the same defaults as the UI render path.
   */
  setDefaultsProvider(provider: ResolverContextProvider): void {
    this.getDefaults = provider;
  }

  /**
   * Define a resolver function (mirrors Resolver.define()).
   */
  define(functionKey: string, handler: ResolverHandler): void {
    if (this.definitions.has(functionKey)) {
      console.warn(
        `[forge-sim] Warning: resolver.define("${functionKey}") is overwriting an existing definition. ` +
        `In Forge, duplicate resolver names across files may cause unexpected behavior.`
      );
    }
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
   *
   * `contextOverride` lets callers supply a one-shot partial context for
   * THIS invocation only — does not mutate the sticky overrides set by
   * setContext(). Merge precedence (highest wins): per-call > sticky >
   * defaults.
   */
  async invoke(
    functionKey: string,
    payload?: any,
    contextOverride?: Partial<ResolverContext>
  ): Promise<any> {
    const handler = this.definitions.get(functionKey);
    if (!handler) {
      const available = [...this.definitions.keys()];
      throw new Error(
        `No resolver defined for "${functionKey}". Available: ${available.join(', ') || 'none'}`
      );
    }

    const context: ResolverContext = {
      ...this.getDefaults(),
      ...this.contextOverrides,
      ...(contextOverride ?? {}),
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

  /** Alias for getDefinitions() — returns all registered resolver keys. */
  getAvailableKeys(): string[] {
    return this.getDefinitions();
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
