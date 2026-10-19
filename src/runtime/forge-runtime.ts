/**
 * global.__forge_runtime__ — the backend context seam (Seam B).
 *
 * Real Forge's container installs a ForgeRuntime global before the handler
 * is imported; every backend `@forge/*` package reads identity, metrics and
 * configuration from it (field inventory with citations:
 * `src/runtime/seam-registry.ts`). forge-sim installs the same global as a
 * PROPERTY GETTER so each read sees the invocation that is actually running:
 *
 *  - Real Forge hands one invocation to a container at a time, so a plain
 *    assignment per invocation is safe there. This process runs invocations
 *    concurrently, so per-invocation state lives in an AsyncLocalStorage and
 *    the getter resolves it at read time. Fields the packages read at IMPORT
 *    time (`when: 'import'` in the registry) can't vary per invocation by
 *    construction — they only get baseline values.
 *
 *  - The getter must never return undefined: `import '@forge/llm'` evaluates
 *    `__getRuntime()?.tracing` in a class-field initializer, and __getRuntime
 *    THROWS when the global is falsy (runtime-seam.test.ts pins this). With
 *    no invocation active, the getter serves a baseline built from the sim's
 *    default context — which also matches real Forge's module-scope
 *    semantics, where top-level app code runs inside the first invocation's
 *    container and sees a real runtime.
 *
 * The ForgeRuntime type is imported from the INSTALLED @forge/api (type-only,
 * erased at runtime — the vitest alias never sees it), so an upstream bump
 * that reshapes the contract fails compilation here.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes, randomUUID } from 'node:crypto';
import type { ForgeRuntime } from '@forge/api';
import type { ForgeSimulator } from '../simulator.js';

type ExternalAuthMetaData = NonNullable<ForgeRuntime['externalAuth']>[number];
type AppPermissions = NonNullable<ForgeRuntime['appContext']['permissions']>;

/** What one invocation contributes to the runtime view. */
export interface InvocationRuntimeInfo {
  invocationId: string;
  functionKey: string | null;
  /** The module the invocation is attributed to (trigger key, frontend module, queue key). */
  moduleKey: string | null;
  /** Forge function type: resolver / trigger / scheduledTrigger / webTrigger / consumer / action / workflow. */
  moduleType: string;
  startMs: number;
  /** The enforced budget for this invocation (per-type limit or manifest timeoutSeconds). */
  timeoutMs: number;
  /**
   * The Forge context handed to the handler, for entry paths that build it
   * OUTSIDE the resolver (triggers, scheduled, consumers). Resolver
   * invocations leave this unset: their merged context (defaults + sticky +
   * render overlay + per-call) is computed inside resolver.invoke() and read
   * live via getActiveContext(), which per-call overrides flow into.
   */
  context?: Record<string, unknown>;
  /** B3 trace ids, generated on entry; packages stamp these on x-b3-* headers. */
  tracing?: { traceId: string; spanId: string };
}

const invocationRuntimeStorage = new AsyncLocalStorage<InvocationRuntimeInfo>();

const newTracing = () => ({
  traceId: randomBytes(16).toString('hex'),
  spanId: randomBytes(8).toString('hex'),
});

/** Stable ids served outside any invocation (and for import-time reads). */
const BASELINE = {
  tracing: newTracing(),
  invocationId: `sim-no-invocation-${randomUUID()}`,
};

/** Enter an invocation: every handler entry path in the simulator funnels through this. */
export function runWithInvocationRuntime<T>(info: InvocationRuntimeInfo, fn: () => T): T {
  if (!info.tracing) info.tracing = newTracing();
  return invocationRuntimeStorage.run(info, fn);
}

/** The invocation currently executing, or undefined outside any invocation. */
export function currentInvocationRuntime(): InvocationRuntimeInfo | undefined {
  return invocationRuntimeStorage.getStore();
}

/** Inert metrics — there is no metrics backend locally, but the interface must be total: */
/** wrapInMetrics() runs on nearly every @forge/api call path and would throw on a hole. */
const noopMetrics: ForgeRuntime['metrics'] = {
  counter: () => ({ incr: () => {}, incrBy: () => {}, decr: () => {}, decrBy: () => {} }),
  timing: () => ({ measure: () => ({ stop: () => {} }) }),
  gauge: () => ({ set: () => {} }),
};

/** `ari:cloud:ecosystem::app/<uuid>` → `<uuid>`; sim fallback when no manifest is loaded. */
function appIdFrom(sim: ForgeSimulator): string {
  const ari = (sim.getManifest()?.raw.app as { id?: string } | undefined)?.id;
  return ari?.split('/').pop() || 'sim-app-001';
}

/**
 * Project the sim's ExternalAuthStore into the ExternalAuthMetaData[] shape
 * the real withProvider() builds itself from on every call (fetch.js:53-100).
 * Real Forge distinguishes account.id (the platform's credential handle, sent
 * back as the tpp descriptor's accountId) from externalAccountId (the
 * provider-side id the app sees); the sim's store has one id serving both
 * roles, so both fields carry it. An empty store projects to [], which makes
 * every withProvider(p) throw "Bad provider or missing config" — same as an
 * app with no providers configured in real Forge.
 */
function projectExternalAuth(sim: ForgeSimulator): ExternalAuthMetaData[] {
  return sim.externalAuth.listProviders().map((provider) => ({
    service: provider.key,
    remotes: (provider.remotes ?? []).map((key) => ({
      key,
      baseUrl: sim.externalAuth.getProviderBaseUrl(provider.key, key) ?? '',
    })),
    accounts: sim.externalAuth.listAccounts(provider.key).map((account) => ({
      id: account.id,
      externalAccountId: account.id,
      displayName: account.displayName,
      ...(account.avatarUrl !== undefined ? { avatarUrl: account.avatarUrl } : {}),
      scopes: account.scopes ?? [],
    })),
  }));
}

/**
 * The runtime view at this moment, from the sim's state plus the active
 * invocation. Built fresh per property read — the packages destructure what
 * they need per call and never compare identities.
 */
export function buildForgeRuntime(sim: ForgeSimulator): ForgeRuntime {
  const info = currentInvocationRuntime();
  // Who/where: the resolver's merged context wins (it includes per-call
  // overrides), then the context a non-resolver entry path recorded, then
  // the same defaults + sticky + render merge the resolver would start from.
  const ctx: Record<string, unknown> =
    sim.resolver.getActiveContext() ??
    info?.context ?? {
      ...sim.getDefaultContext(),
      ...sim.resolver.getContextOverrides(),
      ...sim.resolver.getRenderContext(),
    };

  const manifest = sim.getManifest();

  return {
    // Required by the type but inert here: the token authenticates to Forge's
    // egress proxy, which doesn't exist locally. Only @forge/kvs reads it, and
    // only on its fast path, which stays off because `kvs` is absent below
    // (see seam-registry.ts: kvs/proxy, when: 'import').
    proxy: { token: 'sim-proxy-token', url: 'https://sim-proxy.invalid' },
    contextAri: (ctx.installContext as string | undefined) ?? 'ari:cloud:jira::site/sim-site',
    container: {
      runtime: manifest?.raw.app?.runtime?.name,
      // Backend i18n reads locale JSON from disk under here (__LOCALES__).
      ...(sim.getAppDir() ? { appCodeDir: sim.getAppDir()! } : {}),
    },
    appContext: {
      appId: appIdFrom(sim),
      appVersion: '1.0.0',
      environmentId: 'sim-env-development',
      environmentType: 'DEVELOPMENT',
      invocationId: info?.invocationId ?? BASELINE.invocationId,
      installationId: 'sim-installation-001',
      functionKey: info?.functionKey ?? 'sim-no-function',
      moduleType: info?.moduleType ?? 'sim:none',
      // The entry path's attribution wins: the context's moduleKey is often
      // the 'sim-module' default, while info carries the trigger/queue/module
      // key the invocation actually belongs to.
      moduleKey: info?.moduleKey ?? (ctx.moduleKey as string | undefined) ?? 'sim-module',
      ...(ctx.license !== undefined ? { license: ctx.license as ForgeRuntime['appContext']['license'] } : {}),
      // getAppContext() re-wraps this in its own RuntimePermissions, reading
      // only .scopes/.external — a plain object satisfies it. Constructing
      // the real class would need a VALUE import from @forge/api, which the
      // vitest alias would resolve to our shim.
      permissions: {
        scopes: manifest?.permissions ?? [],
        external: (manifest?.raw as { permissions?: { external?: unknown } } | undefined)
          ?.permissions?.external ?? {},
      } as unknown as AppPermissions,
    },
    ...(ctx.accountId !== undefined ? { aaid: ctx.accountId as string } : {}),
    lambdaContext: {
      awsRequestId: info?.invocationId ?? BASELINE.invocationId,
      // Wired to the same budget checkInvocationTime() warns against. Outside
      // an invocation (module scope at import), report a fresh default-resolver
      // budget — real module scope runs inside the first invocation's container.
      getRemainingTimeInMillis: () =>
        info ? Math.max(0, info.timeoutMs - (Date.now() - info.startMs)) : 25_000,
    },
    tracing: info?.tracing ?? BASELINE.tracing,
    realtime: { contextToken: 'sim-context-token' },
    metrics: noopMetrics,
    // `kvs` (and `rms`) stay absent: setting kvs.url/host flips @forge/kvs
    // onto its proxy fast path AT IMPORT, freezing one invocation's token and
    // trace ids into a module-scope closure. Absent ⇒ the package takes the
    // default descriptor branch we already route. See seam-registry.ts.
    externalAuth: projectExternalAuth(sim),
    featureFlags: () => false,
  };
}

/**
 * Install the global as a live getter. Assignment is kept as an escape hatch
 * for tests that impersonate a broken runtime (e.g. authorize.test.ts forcing
 * the no-aaid error from the REAL @forge/api): assigning replaces the live
 * view with the assigned plain value; call installForgeRuntime(sim) again to
 * re-arm. App code never assigns this — in real Forge the platform owns it.
 */
export function installForgeRuntime(sim: ForgeSimulator): void {
  Object.defineProperty(globalThis, '__forge_runtime__', {
    configurable: true,
    enumerable: true,
    get: () => buildForgeRuntime(sim),
    set: (value: unknown) => {
      Object.defineProperty(globalThis, '__forge_runtime__', {
        configurable: true,
        enumerable: true,
        writable: true,
        value,
      });
    },
  });
}
