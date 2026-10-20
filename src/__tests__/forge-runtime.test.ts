/**
 * global.__forge_runtime__ — the backend context seam (Phase 1 of the
 * bare-seam migration; inventory in src/runtime/seam-registry.ts).
 *
 * Pins the three properties the design hangs on:
 *  1. The global always resolves to a full ForgeRuntime — even before any
 *     deploy or invocation — because `import '@forge/llm'` evaluates
 *     __getRuntime()?.tracing at module scope and __getRuntime() throws on a
 *     falsy global (runtime-seam.test.ts pins the upstream side of this).
 *  2. Per-invocation fields come from AsyncLocalStorage, so overlapping
 *     invocations each see their own identity. The old save/restore field
 *     let invocation B's context leak into a still-running invocation A.
 *  3. The REAL @forge/api reads the same view through its own getAppContext(),
 *     so shape drift fails here, not inside some app.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { createSimulator, type ForgeSimulator } from '../simulator.js';
import { installForgeRuntime } from '../runtime/forge-runtime.js';
import type { ForgeRuntime } from '@forge/api';

// CJS require bypasses the vitest shim aliases — this is the REAL package.
const require = createRequire(import.meta.url);

const runtime = () => (globalThis as any).__forge_runtime__ as ForgeRuntime;

const TRIGGER_MANIFEST = `
modules:
  trigger:
    - key: on-created
      function: trig
      events:
        - avi:jira:created:issue
  function:
    - key: trig
      handler: index.run
app:
  id: ari:cloud:ecosystem::app/12345678-1234-1234-1234-123456789abc
  runtime:
    name: nodejs22.x
permissions:
  scopes:
    - read:jira-work
`;

describe('global.__forge_runtime__', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    sim = createSimulator();
  });

  // ── 1. Baseline: always present, import-safe ─────────────────────────────

  it('resolves to a full runtime before any deploy or invocation', () => {
    const rt = runtime();
    expect(rt).toBeTruthy();
    // The @forge/llm import-time contract: __getRuntime() must not throw and
    // tracing must be a real value (its client destructures traceId/spanId).
    expect(rt.tracing.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(rt.tracing.spanId).toMatch(/^[0-9a-f]{16}$/);
    // wrapInMetrics runs on nearly every @forge/api call — the whole
    // interface must be callable.
    const counter = rt.metrics.counter('x');
    counter.incr();
    counter.incrBy(2);
    rt.metrics.timing('x').measure().stop();
    rt.metrics.gauge('x').set(1);
    expect(rt.featureFlags('anything')).toBe(false);
    expect(rt.proxy.token).toBeTruthy();
    // Deliberately absent: presence would flip @forge/kvs onto its proxy
    // fast path at import (seam-registry.ts, when: 'import').
    expect(rt.kvs).toBeUndefined();
    expect(rt.rms).toBeUndefined();
    expect(rt.lambdaContext.getRemainingTimeInMillis()).toBe(25_000);
    expect(rt.aaid).toBe('sim-user-001');
    expect(rt.externalAuth).toEqual([]);
    expect(rt.appContext.moduleType).toBe('sim:none');
  });

  // ── 2. Per-invocation identity ───────────────────────────────────────────

  it('reflects the active invocation: aaid, ids, module info, time budget', async () => {
    let seen: any;
    sim.resolver.define('who', async () => {
      const rt = runtime();
      const r1 = rt.lambdaContext.getRemainingTimeInMillis();
      await new Promise((r) => setTimeout(r, 30));
      seen = {
        aaid: rt.aaid,
        invocationId: rt.appContext.invocationId,
        functionKey: rt.appContext.functionKey,
        moduleType: rt.appContext.moduleType,
        awsRequestId: rt.lambdaContext.awsRequestId,
        tracing: rt.tracing,
        r1,
        r2: rt.lambdaContext.getRemainingTimeInMillis(),
      };
      return seen.invocationId;
    });

    const first = await sim.invoke('who', {}, { context: { accountId: 'alice' } });
    expect(seen.aaid).toBe('alice'); // per-call override, not the sticky default
    expect(seen.functionKey).toBe('who');
    expect(seen.moduleType).toBe('resolver');
    expect(seen.invocationId).toMatch(/^sim-invocation-[0-9a-f-]{36}$/);
    expect(seen.awsRequestId).toBe(seen.invocationId);
    expect(seen.tracing.traceId).not.toBe(runtime().tracing.traceId); // not the baseline ids
    // Budget: a resolver gets 25s, and the clock runs down while the handler does.
    expect(seen.r1).toBeLessThanOrEqual(25_000);
    expect(seen.r1).toBeGreaterThan(20_000);
    expect(seen.r2).toBeLessThan(seen.r1);

    const second = await sim.invoke('who');
    expect(second).not.toBe(first); // fresh invocationId per invocation
    expect(seen.aaid).toBe('sim-user-001'); // override was one-shot
  });

  it('overlapping invocations each see their own aaid (the save/restore race)', async () => {
    let releaseAlice!: () => void;
    const gate = new Promise<void>((r) => (releaseAlice = r));

    sim.resolver.define('who', async ({ payload }: any) => {
      if (payload.wait) {
        await gate; // suspend alice until bob is mid-flight
      } else {
        releaseAlice();
        await new Promise((r) => setTimeout(r, 30)); // keep bob active while alice reads
      }
      return runtime().aaid;
    });

    const alice = sim.invoke('who', { wait: true }, { context: { accountId: 'alice' } });
    const bob = sim.invoke('who', { wait: false }, { context: { accountId: 'bob' } });
    // Before the ALS fix, alice resumed while bob's context was the "active"
    // one and read 'bob' here.
    await expect(alice).resolves.toBe('alice');
    await expect(bob).resolves.toBe('bob');
  });

  // ── 3. Non-resolver entry paths ──────────────────────────────────────────

  it('a trigger invocation carries trigger identity, manifest appId and scopes', async () => {
    await sim.loadManifest(TRIGGER_MANIFEST);
    let seen: any;
    sim.resolver.define('trig', (_event: any, _context: any) => {
      const rt = runtime();
      seen = {
        moduleType: rt.appContext.moduleType,
        moduleKey: rt.appContext.moduleKey,
        functionKey: rt.appContext.functionKey,
        appId: rt.appContext.appId,
        scopes: (rt.appContext.permissions as any)?.scopes,
        budget: rt.lambdaContext.getRemainingTimeInMillis(),
        aaid: rt.aaid,
        runtimeName: rt.container.runtime,
      };
      return 'ok';
    });

    const results = await sim.fireTrigger('avi:jira:created:issue', {});
    expect(results).toEqual(['ok']);
    expect(seen.moduleType).toBe('trigger');
    expect(seen.moduleKey).toBe('on-created');
    expect(seen.functionKey).toBe('trig');
    expect(seen.appId).toBe('12345678-1234-1234-1234-123456789abc');
    expect(seen.scopes).toContain('read:jira-work');
    expect(seen.budget).toBeLessThanOrEqual(55_000);
    expect(seen.budget).toBeGreaterThan(50_000);
    expect(seen.aaid).toBe('sim-user-001');
    expect(seen.runtimeName).toBe('nodejs22.x');
  });

  // ── 4. The REAL @forge/api reads the same view ───────────────────────────

  it('real getAppContext() works against the installed runtime', async () => {
    const realApi = require('@forge/api');
    sim.resolver.define('ctx', () => {
      const ctx = realApi.getAppContext();
      return {
        appAri: ctx.appAri.toString(),
        environmentAri: ctx.environmentAri.toString(),
        installationAri: ctx.installationAri.toString(),
        remaining: ctx.invocationRemainingTimeInMillis(),
        permissions: ctx.permissions.format(),
      };
    });
    const ctx = await sim.invoke('ctx');
    expect(ctx.appAri).toBe('ari:cloud:ecosystem::app/sim-app');
    expect(ctx.environmentAri).toBe(
      'ari:cloud:ecosystem::environment/sim-app/sim-env-sim-app'
    );
    // Derived from the appId so every ARI mentions the same app.
    expect(ctx.installationAri).toBe('ari:cloud:ecosystem::installation/sim-install-sim-app');
    expect(ctx.remaining).toBeGreaterThan(0);
    expect(typeof ctx.permissions).toBe('string');
  });

  // ── 5. The assignment escape hatch ───────────────────────────────────────

  it('assignment replaces the live view; installForgeRuntime re-arms it', () => {
    expect(runtime().aaid).toBe('sim-user-001');
    (globalThis as any).__forge_runtime__ = {};
    expect(runtime()).toEqual({});
    installForgeRuntime(sim);
    expect(runtime().aaid).toBe('sim-user-001');
  });

  // ── 6. externalAuth projection ───────────────────────────────────────────

  it('projects configured providers into ExternalAuthMetaData[]', async () => {
    await sim.loadManifest(`
modules:
  jira:projectPage:
    - key: page
      resource: main
      render: native
      title: Page
      resolver:
        function: res
  function:
    - key: res
      handler: index.run
resources:
  - key: main
    path: src/frontend/index.jsx
app:
  id: ari:cloud:ecosystem::app/12345678-1234-1234-1234-123456789abc
  runtime:
    name: nodejs22.x
permissions:
  scopes: []
  external:
    fetch:
      backend:
        - 'https://api.example.com'
providers:
  auth:
    - key: google
      name: Google
      type: oauth2
      clientId: cid
      scopes:
        - openid
      remotes:
        - google-apis
      bearerMethod: authorization-header
      actions:
        authorization:
          remote: google-account
          path: /o/oauth2/v2/auth
        exchange:
          remote: google-oauth
          path: /token
        refreshToken:
          remote: google-oauth
          path: /token
        revokeToken:
          remote: google-oauth
          path: /revoke
        retrieveProfile:
          remote: google-apis
          path: /userinfo/v2/me
          resolvers:
            id: id
            displayName: email
            avatarUrl: picture
remotes:
  - key: google-apis
    baseUrl: https://api.example.com
  - key: google-account
    baseUrl: https://accounts.example.com
  - key: google-oauth
    baseUrl: https://oauth.example.com
`);
    const auth = runtime().externalAuth!;
    expect(auth).toHaveLength(1);
    expect(auth[0].service).toBe('google');
    expect(auth[0].remotes).toEqual([{ key: 'google-apis', baseUrl: 'https://api.example.com' }]);
    expect(auth[0].accounts).toEqual([]); // no token stored yet
  });
});
