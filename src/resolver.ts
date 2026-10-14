/**
 * Simulated @forge/resolver.
 *
 * Mirrors the Resolver class that Forge apps use to define backend handlers.
 */

import type { ResolverRequest, ResolverContext } from './types.js';

export type ResolverHandler = (req: ResolverRequest) => any | Promise<any>;

/**
 * The function shape real `@forge/resolver`'s `getDefinitions()` returns.
 *
 * Apps that BUNDLE @forge/resolver (rather than importing it bare) run the
 * real package, so our shim's registering `define()` never executes and the
 * individual definition keys are invisible to us — they live in a private
 * map inside the app's own Resolver instance. The only way in is the
 * exported dispatch function. See `registerDispatch`.
 */
export type ResolverDispatch = (
  payload: {
    call: { functionKey: string; payload?: unknown; jobId?: string };
    context: Record<string, unknown>;
  },
  backendRuntimePayload?: Record<string, unknown>,
) => unknown | Promise<unknown>;

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
  /**
   * Per-render context overlay. Set by `sim.ui.render(...)` to expose the
   * rendered module's view (accountId/cloudId/extension fields) to resolver
   * invokes triggered DURING the render lifecycle (including React effects
   * that fire after render() returns).
   *
   * Sits between sticky `contextOverrides` and per-call overrides in the
   * merge order — render's view wins over the user's sticky baseline for
   * the lifecycle of the rendered module, but a per-call invoke override
   * still wins over render.
   *
   * Crucially this is SEPARATE from `contextOverrides`, so `sim.ui.render`
   * never clobbers what the user set via `setContext()`. Cleared on
   * `clear()` (which runs on `sim.reset()`).
   */
  private renderContextOverlay: Partial<ResolverContext> = {};
  /**
   * The fully-merged context of the invocation currently executing (null
   * when no resolver is running). This is the sim's equivalent of real
   * Forge's per-invocation runtime (`__getRuntime().aaid`) — APIs that need
   * to know "who is the invoking user right now" (e.g. authorize()) read
   * this so per-call context overrides are honored, not just the sticky
   * baseline. Saved/restored around handler execution so nested invokes
   * unwind correctly.
   */
  private activeInvocationContext: ResolverContext | null = null;
  /**
   * Keys carried over from a previous deploy epoch. Redefining one of these
   * is a silent replacement (that's what a redeploy *is* — real Forge never
   * warns you for deploying your app again). Redefining a key NOT in this
   * set means it was defined twice within the current epoch — the actual
   * footgun (same key in two files) — and still warns. Publish-gate F6.
   */
  private staleKeys = new Set<string>();
  /**
   * Dispatch functions from apps that bundled @forge/resolver in, keyed by
   * the manifest function key that exported them. Consulted by invoke() only
   * when no explicit definition matches — a bundled resolver's definition
   * keys cannot be enumerated (they're private to the app's own Resolver),
   * so "ask the dispatcher" is the only way to reach them. Insertion order
   * is the try order; manifest-declared functions are registered in manifest
   * order, so the first-declared resolver wins a key collision.
   */
  private dispatchFallbacks = new Map<string, ResolverDispatch>();
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
   * Mark the start of a deploy epoch. Every currently-registered key becomes
   * "stale" — a subsequent define() of that key silently replaces it instead
   * of warning, because a redeploy re-evaluating app code and re-registering
   * the same resolvers is normal Forge behavior, not a duplicate-key bug.
   * Called by the deployer before handler modules are (re-)evaluated.
   * Publish-gate F6: `sim.deploy()` twice without `reset()` used to print
   * one "overwriting an existing definition" warning per resolver.
   */
  beginDeployEpoch(): void {
    this.staleKeys = new Set(this.definitions.keys());
    // Dispatch fallbacks are rebuilt from scratch by each deploy pass. Unlike
    // definitions (which the app's own define() calls re-register), a stale
    // dispatch closure holds the PREVIOUS deploy's handler code — keeping it
    // would let a redeploy keep serving old resolvers forever.
    this.dispatchFallbacks.clear();
  }

  /**
   * Register a bundled-resolver dispatch function as a fallback route for
   * definition keys that have no explicit handler.
   *
   * Real Forge fully supports an inlined @forge/resolver: the platform calls
   * the exported dispatch function with the requested `functionKey` and it
   * routes internally. We can't enumerate those keys up front, so we mirror
   * the platform and ask the dispatcher at invoke time.
   */
  registerDispatch(functionKey: string, dispatch: ResolverDispatch): void {
    this.dispatchFallbacks.set(functionKey, dispatch);
  }

  /** Manifest function keys that registered a bundled-resolver dispatcher. */
  getDispatchKeys(): string[] {
    return [...this.dispatchFallbacks.keys()];
  }

  /**
   * A `define()`-able handler that forwards straight to ONE registered
   * dispatcher. Used for the manifest function key itself, so
   * `sim.invoke('<resolverFunctionKey>')` reaches the dispatcher instead of
   * being handed the raw closure (whose two-argument signature would fail
   * with "Cannot read properties of undefined (reading 'functionKey')").
   * Forwards directly rather than re-entering invoke(), which would recurse.
   */
  makeDispatchAdapter(dispatchKey: string): ResolverHandler {
    return (req: ResolverRequest) => {
      const dispatch = this.dispatchFallbacks.get(dispatchKey);
      if (!dispatch) {
        throw new Error(`No bundled resolver registered for "${dispatchKey}".`);
      }
      return callDispatch(dispatch, dispatchKey, req);
    };
  }

  /**
   * Define a resolver function (mirrors Resolver.define()).
   */
  define(functionKey: string, handler: ResolverHandler): void {
    if (this.definitions.has(functionKey)) {
      if (this.staleKeys.has(functionKey)) {
        // Redeploy replacing a previous epoch's definition — silent.
        this.staleKeys.delete(functionKey);
      } else {
        console.warn(
          `[forge-sim] Warning: resolver.define("${functionKey}") is overwriting an existing definition. ` +
          `In Forge, duplicate resolver names across files may cause unexpected behavior.`
        );
      }
    } else {
      this.staleKeys.delete(functionKey);
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
   * Set the per-render context overlay. Called by `simulator-ui.render`
   * with the active module's ForgeContext flattened into a resolver-shaped
   * partial. Replaces (not merges) any previous overlay.
   *
   * Pass `null` or an empty object to clear the overlay.
   */
  setRenderContext(overlay: Partial<ResolverContext> | null): void {
    this.renderContextOverlay = overlay ?? {};
  }

  /**
   * Get the current per-render context overlay. Returns a copy.
   */
  getRenderContext(): Partial<ResolverContext> {
    return { ...this.renderContextOverlay };
  }

  /**
   * Invoke a resolver function by key (mirrors bridge invoke call).
   *
   * `contextOverride` lets callers supply a one-shot partial context for
   * THIS invocation only — does not mutate the sticky overrides set by
   * setContext(). Merge precedence (highest wins):
   *   per-call > renderOverlay > sticky > defaults.
   */
  async invoke(
    functionKey: string,
    payload?: any,
    contextOverride?: Partial<ResolverContext>
  ): Promise<any> {
    const handler = this.definitions.get(functionKey);
    if (!handler && this.dispatchFallbacks.size === 0) {
      const available = [...this.definitions.keys()];
      throw new Error(
        `No resolver defined for "${functionKey}". Available: ${available.join(', ') || 'none'}`
      );
    }

    const context: ResolverContext = {
      ...this.getDefaults(),
      ...this.contextOverrides,
      ...this.renderContextOverlay,
      ...(contextOverride ?? {}),
    };

    const req: ResolverRequest = {
      payload: payload ?? {},
      context,
    };

    const previous = this.activeInvocationContext;
    this.activeInvocationContext = context;
    try {
      if (handler) return await handler(req);
      return await this.invokeViaDispatch(functionKey, req);
    } finally {
      this.activeInvocationContext = previous;
    }
  }

  /**
   * Route an unmatched key through the registered bundled-resolver
   * dispatchers, in registration order. A dispatcher that doesn't own the
   * key throws real @forge/resolver's "Resolver has no definition for 'x'"
   * — we treat that as "not mine" and try the next one, then report the key
   * as undefined. Any OTHER error is the app's own handler failing and
   * propagates untouched (swallowing it would turn a real bug into a
   * confusing "no resolver defined").
   */
  private async invokeViaDispatch(functionKey: string, req: ResolverRequest): Promise<any> {
    for (const dispatch of this.dispatchFallbacks.values()) {
      try {
        return await callDispatch(dispatch, functionKey, req);
      } catch (err: any) {
        if (isNoDefinitionError(err, functionKey)) continue;
        throw err;
      }
    }

    const available = [...this.definitions.keys()];
    throw new Error(
      `No resolver defined for "${functionKey}". Available: ${available.join(', ') || 'none'}` +
      (this.dispatchFallbacks.size > 0
        ? ` (also not defined by the bundled resolver(s) exported from ` +
          `${[...this.dispatchFallbacks.keys()].map((k) => `"${k}"`).join(', ')})`
        : '')
    );
  }

  /**
   * Get the merged context of the invocation currently executing, or null
   * when called outside a resolver invocation.
   */
  getActiveContext(): ResolverContext | null {
    return this.activeInvocationContext ? { ...this.activeInvocationContext } : null;
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
    this.dispatchFallbacks.clear();
    this.contextOverrides = {};
    this.renderContextOverlay = {};
    this.activeInvocationContext = null;
    this.staleKeys.clear();
  }
}

/**
 * Call a bundled-resolver dispatch function the way the Forge platform does.
 *
 * The second argument matters: real @forge/resolver OVERWRITES
 * `context.accountId`, `installContext`, `license` and `installation` from
 * `backendRuntimePayload`, so passing `{}` would blank out the very fields
 * the app reads off `req.context`.
 */
function callDispatch(
  dispatch: ResolverDispatch,
  functionKey: string,
  req: ResolverRequest,
): unknown {
  const context = req.context as Record<string, unknown>;
  return dispatch(
    { call: { functionKey, payload: req.payload }, context },
    {
      principal: { accountId: context.accountId },
      installContext: context.installContext,
      license: context.license,
      installation: context.installation,
    },
  );
}

/**
 * Is this real @forge/resolver's "this dispatcher doesn't own that key"
 * error? Matched on the upstream message shape:
 *   `Resolver has no definition for 'someKey'.`
 * Deliberately requires the key to appear, so an app handler that happens to
 * throw a lookalike message about a DIFFERENT key still propagates.
 */
function isNoDefinitionError(err: unknown, functionKey: string): boolean {
  const msg = (err as { message?: unknown })?.message;
  if (typeof msg !== 'string') return false;
  return /Resolver has no definition for/i.test(msg) && msg.includes(functionKey);
}
