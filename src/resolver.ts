/**
 * Simulated @forge/resolver.
 *
 * Mirrors the Resolver class that Forge apps use to define backend handlers.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { ResolverRequest, ResolverContext } from './types.js';

export type ResolverHandler = (req: ResolverRequest) => any | Promise<any>;

/**
 * The function shape real `@forge/resolver`'s `getDefinitions()` returns.
 *
 * Apps run the real package, so a resolver function's export is this
 * closure over a private handler map, and the platform only ever calls the
 * closure. The sim does the same (`registerDispatch`); the keys a closure
 * owns are known only when the bundler tagged it (src/bundler.ts).
 */
export type ResolverDispatch = (
  payload: {
    call: { functionKey: string; payload?: unknown; jobId?: string };
    context: Record<string, unknown>;
  },
  backendRuntimePayload?: Record<string, unknown>,
) => unknown | Promise<unknown>;

/**
 * Where an invoke comes from: the module the bridge call was made in and the
 * resolver function that module's manifest entry names. With it, `invoke()`
 * asks only that function's closure, as the platform does.
 */
export interface InvokeRoute {
  moduleKey?: string;
  functionKey?: string;
  /**
   * True when the caller named the module (`sim.invoke(key, p, { moduleKey })`,
   * the dev server): only that module's function may answer. False when the
   * module is the one being rendered: it settles a key several functions
   * define, but a key it does not define is still looked up by owner, since
   * a module-less `sim.invoke()` during a render is attributed by ownership.
   */
  explicit?: boolean;
}

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
  installContext: 'ari:cloud:jira::site/sim-cloud-001',
};

const defaultContextProvider: ResolverContextProvider = () => ({ ...DEFAULT_CONTEXT });

/** A resolver function's dispatch closure, registered under its manifest function key. */
interface RegisteredDispatch {
  dispatch: ResolverDispatch;
  /**
   * The definition keys the closure owns, from the bundler's tag; null for a
   * closure forge-sim did not bundle (manual packaging, a Resolver built in
   * a test file), whose keys can only be found by asking it.
   */
  keys: ReadonlySet<string> | null;
}

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
   * baseline. AsyncLocalStorage, not a save/restore field: overlapping async
   * invocations each see their own context. The old field restore unwound
   * nested invokes correctly but let invocation B's context leak into a
   * still-running invocation A.
   */
  private activeContextStorage = new AsyncLocalStorage<ResolverContext>();
  /**
   * Keys carried over from a previous deploy epoch. Redefining one of these
   * is a silent replacement (that's what a redeploy *is* — real Forge never
   * warns you for deploying your app again). Redefining a key NOT in this
   * set means it was defined twice within the current epoch — the actual
   * footgun (same key in two files) — and still warns. Publish-gate F6.
   */
  private staleKeys = new Set<string>();
  /**
   * The app's resolver functions: each manifest function whose export is a
   * `@forge/resolver` dispatch closure, in manifest order. A module reaches
   * exactly its own function's closure, as on Forge; a module-less
   * `invoke(key)` finds the function whose tag owns the key, and asks the
   * untagged closures in order when no tag does.
   */
  private dispatchers = new Map<string, RegisteredDispatch>();
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
    // Dispatchers are rebuilt from scratch by each deploy pass. Unlike
    // definitions (which a programmatic define() re-registers), a stale
    // dispatch closure holds the PREVIOUS deploy's handler code — keeping it
    // would let a redeploy keep serving old resolvers forever.
    this.dispatchers.clear();
  }

  /**
   * Register a resolver function's export: the dispatch closure real
   * `@forge/resolver` returns from `getDefinitions()`, under the manifest
   * function key that exported it. The platform calls that closure with the
   * requested key and it routes internally; so does the sim. `keys` is the
   * set of definitions the closure owns when known (the bundler tags every
   * closure it builds, src/bundler.ts); leave it out for a closure built
   * elsewhere and the sim asks it at invoke time instead.
   */
  registerDispatch(functionKey: string, dispatch: ResolverDispatch, keys?: Iterable<string> | null): void {
    this.dispatchers.set(functionKey, { dispatch, keys: keys ? new Set(keys) : null });
  }

  /** Manifest function keys that registered a dispatch closure. */
  getDispatchKeys(): string[] {
    return [...this.dispatchers.keys()];
  }

  /**
   * Does the resolver function `functionKey` define `key`? True for a tagged
   * closure that owns the key and for an untagged one (only asking it would
   * tell); false for a tagged closure without it or no closure at all.
   */
  dispatchDefines(functionKey: string, key: string): boolean {
    const d = this.dispatchers.get(functionKey);
    return !!d && (d.keys === null || d.keys.has(key));
  }

  /** The resolver functions whose tag owns `key`, in manifest order. */
  definingFunctions(key: string): string[] {
    return [...this.dispatchers.entries()].filter(([, d]) => d.keys?.has(key)).map(([fn]) => fn);
  }

  /**
   * Define a resolver function (mirrors Resolver.define()).
   */
  define(functionKey: string, handler: ResolverHandler): void {
    if (this.definitions.has(functionKey) || this.definingFunctions(functionKey).length > 0) {
      if (this.staleKeys.has(functionKey)) {
        // Redeploy replacing a previous epoch's definition — silent.
        this.staleKeys.delete(functionKey);
      } else {
        // A programmatic define() shadows the app's own definition of the
        // key (definitions are consulted before the app's closures).
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
    contextOverride?: Partial<ResolverContext>,
    route?: InvokeRoute,
  ): Promise<any> {
    return this.invokeWithContext(functionKey, payload, this.resolveContext(contextOverride), route);
  }

  /**
   * The context a user-kind invocation would run with right now: defaults,
   * then the sticky `setContext()` overrides, then the render overlay, then
   * the per-call override. `invoke()` uses it; so does the simulator when it
   * calls a Rovo action with Forge's `(payload, context)` convention, where
   * the user becomes `context.principal`.
   */
  resolveContext(contextOverride?: Partial<ResolverContext>): ResolverContext {
    return {
      ...this.getDefaults(),
      ...this.contextOverrides,
      ...this.renderContextOverlay,
      ...(contextOverride ?? {}),
    };
  }

  /**
   * Run `fn` with `context` as the active invocation context, so the
   * runtime seam (`__forge_runtime__.aaid`, `getActiveContext()`) describes
   * that invocation. invokeWithContext() runs every resolver this way; the
   * simulator uses it for functions it calls directly.
   */
  runWithContext<T>(context: ResolverContext, fn: () => Promise<T>): Promise<T> {
    return this.activeContextStorage.run(context, fn);
  }

  /**
   * Invoke with exactly this context: no defaults, sticky or render merge.
   * This is how a function kind that runs without a user (scheduled, web
   * trigger, pre-uninstall, custom field value, workflow, JQL) is driven
   * through `sim.invoke()` — the simulator builds Forge's documented Context
   * for the kind and the user-flavoured layers never apply.
   */
  async invokeWithContext(
    functionKey: string,
    payload: any,
    context: Record<string, unknown>,
    route?: InvokeRoute,
  ): Promise<any> {
    const req: ResolverRequest = {
      payload: payload ?? {},
      context: context as ResolverContext,
    };

    return this.runWithContext(context as ResolverContext, () => this.dispatch(functionKey, req, route));
  }

  /**
   * Find and call the handler for `functionKey`, the way the platform routes
   * a bridge invoke.
   *
   *  1. A programmatic `define()` of the key (a test's override; there is no
   *     such thing on Forge, so it shadows the app's own definition).
   *  2. The named module's own resolver function (`route.functionKey`, from
   *     the module's `resolver.function`): Forge hands the key to that
   *     function's closure and to nothing else, so a key it does not define
   *     is an error even when another function defines it.
   *  3. The one resolver function whose tag owns the key; among several, the
   *     one the module being rendered names. Otherwise two owners is an
   *     error: Forge has no module-less invoke, and picking one would run
   *     the wrong resolver silently.
   *  4. Untagged closures (code forge-sim did not bundle), asked in manifest
   *     order. Real @forge/resolver's "Resolver has no definition for 'x'"
   *     means "not mine" and the next is tried; any OTHER error is the app's
   *     own handler failing and propagates untouched (swallowing it would
   *     turn a real bug into a confusing "no resolver defined").
   */
  private async dispatch(functionKey: string, req: ResolverRequest, route?: InvokeRoute): Promise<any> {
    const handler = this.definitions.get(functionKey);
    if (handler) return await handler(req);

    const own = route?.explicit && route.functionKey !== undefined ? this.dispatchers.get(route.functionKey) : undefined;
    if (own) {
      if (own.keys && !own.keys.has(functionKey)) {
        throw new Error(
          `No resolver defined for "${functionKey}" in function "${route!.functionKey}", the resolver of ` +
          `module "${route!.moduleKey ?? '?'}". It defines: ${[...own.keys].join(', ') || 'none'}. ` +
          `In Forge, a module can only invoke functions defined in its own resolver.`
        );
      }
      try {
        return await callDispatch(own.dispatch, functionKey, req);
      } catch (err) {
        if (!isNoDefinitionError(err, functionKey)) throw err;
        throw new Error(
          `No resolver defined for "${functionKey}" in function "${route!.functionKey}", the resolver of ` +
          `module "${route!.moduleKey ?? '?'}". In Forge, a module can only invoke functions defined in its own resolver.`
        );
      }
    }

    const owners = this.definingFunctions(functionKey);
    if (owners.length > 1 && route?.functionKey !== undefined && owners.includes(route.functionKey)) {
      return await callDispatch(this.dispatchers.get(route.functionKey)!.dispatch, functionKey, req);
    }
    if (owners.length > 1) {
      throw new Error(
        `Resolver function "${functionKey}" is defined by more than one function: ` +
        `${owners.map((k) => `"${k}"`).join(', ')}. In Forge, each module invokes its own resolver function's ` +
        `definitions, so pass { moduleKey } to say which module is invoking.`
      );
    }
    if (owners.length === 1) {
      return await callDispatch(this.dispatchers.get(owners[0])!.dispatch, functionKey, req);
    }

    const untagged = [...this.dispatchers.entries()].filter(([, d]) => d.keys === null);
    for (const [, d] of untagged) {
      try {
        return await callDispatch(d.dispatch, functionKey, req);
      } catch (err) {
        if (isNoDefinitionError(err, functionKey)) continue;
        throw err;
      }
    }

    const available = this.getDefinitions();
    throw new Error(
      `No resolver defined for "${functionKey}". Available: ${available.join(', ') || 'none'}` +
      (untagged.length > 0
        ? ` (also not defined by the bundled resolver(s) exported from ` +
          `${untagged.map(([k]) => `"${k}"`).join(', ')})`
        : '')
    );
  }

  /**
   * Get the merged context of the invocation currently executing, or null
   * when called outside a resolver invocation.
   */
  getActiveContext(): ResolverContext | null {
    const active = this.activeContextStorage.getStore();
    return active ? { ...active } : null;
  }

  /**
   * Every definition key the sim can name: programmatic `define()`s plus the
   * keys of each tagged dispatch closure, in registration order, deduplicated.
   * An untagged closure's keys are not listed (they are private to it).
   */
  getDefinitions(): string[] {
    const keys = new Set(this.definitions.keys());
    for (const d of this.dispatchers.values()) for (const k of d.keys ?? []) keys.add(k);
    return [...keys];
  }

  /**
   * Get a single programmatic handler by key (for direct invocation outside
   * the resolver pattern). A dispatch closure's definitions are reached only
   * through `invoke()`.
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
    this.dispatchers.clear();
    this.contextOverrides = {};
    this.renderContextOverlay = {};
    this.staleKeys.clear();
  }
}

/**
 * Call a `@forge/resolver` dispatch closure the way the Forge platform does.
 *
 * The second argument matters: real @forge/resolver OVERWRITES
 * `context.accountId`, `installContext`, `license` and `installation` from
 * `backendRuntimePayload`, so passing `{}` would blank out the very fields
 * the app reads off `req.context`.
 */
export function callDispatch(
  dispatch: ResolverDispatch,
  functionKey: string,
  req: ResolverRequest,
): unknown {
  const context = req.context as Record<string, unknown>;
  // The closure sets `context.jobId` from the call, never from the context
  // it is handed (a queue delivery's job id rides on the request).
  const jobId = typeof context.jobId === 'string' ? context.jobId : undefined;
  return dispatch(
    { call: { functionKey, payload: req.payload, ...(jobId !== undefined ? { jobId } : {}) }, context },
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
