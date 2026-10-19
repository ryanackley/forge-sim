/**
 * The backend seam registry — everything the real `@forge/*` packages ask of
 * the runtime they execute inside.
 *
 * Real Forge runs app code in a container that installs two globals before the
 * handler is imported:
 *
 *   global.__forge_fetch__(descriptor, path, init) -> Response   (all I/O)
 *   global.__forge_runtime__: ForgeRuntime                       (identity + config)
 *
 * forge-sim's backend has historically intercepted the `@forge/*` *import
 * specifier* instead (`src/shims/*` behind the loader hooks in `src/loader/`).
 * That only works while a specifier survives into the app's output: a bundled
 * ("shape 2") app inlines the real package and there is nothing left to alias,
 * so the inlined real code runs and reaches for these globals directly. See
 * `docs/reference/bundled-forge-packages.md`.
 *
 * This file is the backend counterpart of `src/bridge/protocol/commands.ts`,
 * and exists for the same reason: so "what does the platform have to provide?"
 * is a table with citations rather than a memory exercise.
 *
 * DERIVED, NOT REMEMBERED. `src/__tests__/runtime-seam.test.ts` re-derives both
 * tables from the INSTALLED packages on every run — a bump that starts sending
 * a new descriptor type, or reading a new runtime field, fails CI here rather
 * than surfacing as an `undefined` deep inside someone's app. Every `source`
 * below is a real file:line in `node_modules`; when you change an entry, read
 * the file and cite it (lesson 6 in bundled-forge-packages.md: every bridge bug
 * in #40 was a detail someone reconstructed from memory).
 *
 * Scope note: the tables record what the packages *ask for*. Whether we answer,
 * and how, is the dispatcher's business in Phase 2 — `status` / `plan` below are
 * the current intent, not an implemented contract. The environment tsconfig gate
 * (lesson 7) lands with that dispatcher; this module is data with no imports.
 */

// ── Seam A: global.__forge_fetch__ ──────────────────────────────────────────

export interface FetchDescriptorSpec {
  /** The package whose code builds this descriptor. */
  owner: string;
  /** Where the literal appears: `node_modules/@forge/<owner>/out/...`. */
  source: string;
  /** One line on what the app is asking for. */
  summary: string;
  /**
   * Other packages whose traffic arrives under this same descriptor, because
   * they call through the owner's exported helpers rather than the raw seam.
   * These are invisible to a grep for `__forge_fetch__` in their own source.
   */
  riders?: string[];
  /**
   * Present when forge-sim does NOT route this descriptor today, explaining
   * why. `src/shims/globals.ts` throws a named error for these rather than
   * letting them fall through to the product-API mock and surface as a
   * bewildering 501. Phase 2 empties this field.
   */
  unrouted?: string;
}

export const FETCH_DESCRIPTORS: Readonly<Record<string, FetchDescriptorSpec>> = {
  // ── Atlassian product + platform traffic ─────────────────────────────────
  fpp: {
    owner: '@forge/api',
    source: 'api/out/api/fetch.js:185-207 (literals) via :21-33 (`type: args.type`)',
    summary: 'Forge Product Proxy — requestJira/Confluence/Bitbucket, requestGraph, requestAtlassian, as app or user',
    riders: [
      '@forge/events — queue push, app events, job progress, all GraphQL via __requestAtlassianAsApp (events/out/queue.js:12)',
      '@forge/api webTrigger — getUrl/deleteUrl/queryUrls GraphQL mutations (api/out/webTrigger.js:22,55,83)',
      '@forge/storage — legacy api.storage, POSTs /forge/entities/graphql through the injected @forge/api client',
    ],
  },
  tpp: {
    owner: '@forge/api',
    source: 'api/out/api/fetch.js:36-45',
    summary: 'Third-Party Proxy — withProvider().fetch(), egress to an external service with Forge-held OAuth credentials',
  },
  frc: {
    owner: '@forge/api',
    source: 'api/out/api/endpoint.js:33-36, built by constructInvokePayload() and passed at :26',
    summary: 'invokeRemote() — call a Forge Remote by key',
  },
  fcc: {
    owner: '@forge/api',
    source: 'api/out/api/endpoint.js:37-41, built by constructInvokePayload() and passed at :26',
    summary: 'invokeService() — call a Forge container service by key',
  },

  // ── Storage ──────────────────────────────────────────────────────────────
  kvs: {
    owner: '@forge/kvs',
    source: 'kvs/out/index.js:12 (proxy fast path) and :25 (default path)',
    summary: 'KVS and the Custom Entity Store — /api/v1/{get,set,delete,query,entity/*,secret/*,batch/*}',
  },
  sql: {
    owner: '@forge/sql',
    source: 'sql/out/sql.js:14, via @forge/api __fetchProduct',
    summary: 'Forge SQL — /api/v1/execute and /api/v1/execute/ddl',
  },
  os: {
    owner: '@forge/object-store',
    source: 'object-store/out/object-store.js:16, via @forge/api __fetchProduct',
    summary: 'Object Store — blob put/get/delete/list and pre-signed download URLs',
    unrouted:
      'the Object Store wire protocol is an undocumented Atlassian internal; forge-sim intercepts the @forge/object-store import instead, so only a bundled copy reaches the seam',
  },

  // ── Everything else ──────────────────────────────────────────────────────
  llm: {
    owner: '@forge/llm',
    source: 'llm/out/llm-client.js:18 (GET list) and :35 (POST chat/stream)',
    summary: 'Forge LLM — model list and chat/stream completions against https://llm',
    unrouted:
      'forge-sim intercepts the @forge/llm import and serves sim.llm (mocks + recorded history); the raw seam protocol is undocumented',
  },
  realtime: {
    owner: '@forge/realtime',
    source: 'realtime/out/publish.js:40 and realtime/out/signRealtimeToken.js:33',
    summary: 'Realtime — publishRealtimeChannel GraphQL mutation and context-token signing',
    unrouted:
      'forge-sim intercepts the @forge/realtime import and serves sim.realtime; the raw seam protocol is undocumented',
  },
};

/**
 * Call sites that pass a descriptor the scanner cannot read as a literal,
 * because a helper builds it. Pinned so that if upstream ever inlines one, the
 * derivation test notices the shape changed rather than silently finding the
 * literals in a new place.
 *
 * Keys are what appears at the call site; values say where the literals live.
 */
export const INDIRECT_DESCRIPTOR_BUILDERS: Readonly<Record<string, string>> = {
  'args.type': 'api/out/api/fetch.js:24 — __fetchProduct() forwards its caller\'s literal; the fpp/sql/os literals are in the callers',
  'call:constructInvokePayload': 'api/out/api/endpoint.js:26 — returns the frc/fcc literals from :30-43',
};

// ── Seam B: global.__forge_runtime__ ────────────────────────────────────────

/**
 * WHEN the field is read, which decides whether a per-invocation value is even
 * possible:
 *
 *  - 'call'   — read inside a function, every time. A getter backed by the
 *               invocation store gives correct per-invocation values.
 *  - 'import' — read while the package's module body evaluates, ONCE. Whatever
 *               is visible then is frozen into a closure or class field for the
 *               life of the process. Per-invocation values are impossible here,
 *               so the only safe designs are "same for every invocation" or
 *               "absent, so the package takes its other branch".
 */
export type RuntimeReadTiming = 'call' | 'import';

export interface RuntimeFieldSpec {
  /** Packages that read it. */
  readers: string[];
  /** Where: `node_modules/@forge/<pkg>/out/...`. */
  source: string;
  /** One line on what it carries and what breaks without it. */
  summary: string;
  when: RuntimeReadTiming;
  /**
   * What forge-sim intends to put there:
   *  - 'populate' — a real value built from sim state
   *  - 'noop'     — structurally present, behaviourally inert (metrics)
   *  - 'omit'     — deliberately absent, to steer a package down its other
   *                 branch. Always explain in `note`.
   */
  plan: 'populate' | 'noop' | 'omit';
  note?: string;
}

export const RUNTIME_FIELDS: Readonly<Record<string, RuntimeFieldSpec>> = {
  appContext: {
    readers: ['@forge/api', '@forge/realtime'],
    source: 'api/out/api/runtime.js:117, api/out/webTrigger.js:9-10,96-97, realtime/out/publish.js:78,100',
    summary: 'App identity: appId, appVersion, environmentId/Type, invocationId, installationId, functionKey, moduleType, moduleKey, license, installation, permissions. Backs the whole of getAppContext().',
    when: 'call',
    plan: 'populate',
  },
  lambdaContext: {
    readers: ['@forge/api'],
    source: 'api/out/api/runtime.js:118-121',
    summary: 'getRemainingTimeInMillis(). getAppContext() substitutes a thrower when absent, so the app sees a confusing "update your Forge CLI" error rather than a missing field.',
    when: 'call',
    plan: 'populate',
    note: 'maps onto the per-module timeouts forge-sim already enforces (resolvers 25s, triggers 55s, scheduled/consumer 900s)',
  },
  metrics: {
    readers: ['@forge/api'],
    source: 'api/out/api/fetch.js:11, api/out/api/permissions.js:20, api/out/api/runtime.js:138',
    summary: 'counter/timing/gauge. wrapInMetrics() wraps nearly every exported call, so a missing metrics object throws on the happy path.',
    when: 'call',
    plan: 'noop',
    note: 'counters and timers that discard; there is no metrics backend to report to locally',
  },
  contextAri: {
    readers: ['@forge/api'],
    source: 'api/out/webTrigger.js:12,98',
    summary: 'The ARI of the context the invocation belongs to; sent as contextId in the web-trigger GraphQL mutations.',
    when: 'call',
    plan: 'populate',
  },
  aaid: {
    readers: ['@forge/api'],
    source: 'api/out/authorization/index.js:7',
    summary: 'The invoking user\'s Atlassian account id. authorize() throws "Couldn\'t find the accountId of the invoking user" without it.',
    when: 'call',
    plan: 'populate',
    note: 'must come from the invocation store, not a save/restore field — the current globals.ts getter reads resolver.getActiveContext() and can report the wrong user when invocations overlap',
  },
  container: {
    readers: ['@forge/api'],
    source: 'api/out/api/i18n.js:8-11 (destructures .appCodeDir off it)',
    summary: 'Container metadata ({region?, runtime?, handler?, appCodeDir?}). Only appCodeDir is read by any installed package: backend i18n joins it with the i18n bundle folder and reads locale JSON off DISK — a filesystem contract, not a network one.',
    when: 'call',
    plan: 'populate',
    note: 'the backend twin of the frontend __LOCALES__ quirk; the locale folder has to be materialized next to the deployed bundle. appCodeDir is NOT a top-level ForgeRuntime field — the type-definition cross-check in runtime-seam.test.ts exists because this registry once said it was.',
  },
  externalAuth: {
    readers: ['@forge/api'],
    source: 'api/out/api/fetch.js:54-62 (findExternalAuthProviderConfigOrThrow)',
    summary: 'ExternalAuthMetaData[] — the provider/remote/account table that withProvider() is built from on every call. An empty array means every provider throws "Bad provider or missing config".',
    when: 'call',
    plan: 'populate',
    note: 'projected live from the ExternalAuthStore (forge-runtime.ts projectExternalAuth). The sim\'s single account id serves as both `id` (the credential handle echoed back as the tpp accountId) and `externalAccountId` (the provider-side id the app sees); split them if a fixture ever needs the two to differ',
  },
  realtime: {
    readers: ['@forge/realtime'],
    source: 'realtime/out/publish.js:78,100 (reads .contextToken)',
    summary: 'Realtime context token, passed as the x-forge-context-token header on publish.',
    when: 'call',
    plan: 'populate',
  },
  tracing: {
    readers: ['@forge/kvs', '@forge/llm'],
    source: 'kvs/out/index.js:10, llm/out/llm-client.js:6',
    summary: 'B3 trace ids (traceId, spanId) stamped on outbound x-b3-* headers.',
    when: 'import',
    plan: 'populate',
    note: 'LOAD-BEARING AT IMPORT. @forge/llm reads it from a class field initializer (llm-client.js:6) reached eagerly via llm/out/index.js:7 -> llm-api.js:9, and __getRuntime() THROWS when the global is falsy — so `import "@forge/llm"` fails outright unless __forge_runtime__ is already a non-null object with a tracing value. The runtime global must therefore always resolve to a baseline object, never undefined, even outside an invocation.',
  },
  kvs: {
    readers: ['@forge/kvs'],
    source: 'kvs/out/index.js:9-10 (gate: runtime.kvs.url && runtime.kvs.host)',
    summary: 'KVS service url/host. Setting both switches @forge/kvs onto its proxy "fast path": descriptor {type:"kvs"} plus Authorization/Host/x-b3-* headers, instead of the default {type:"kvs", provider:"app", remote:"kvs"}.',
    when: 'import',
    plan: 'omit',
    note: 'DELIBERATELY ABSENT. Three reasons: (1) the default branch is already what globals.ts routes and what entity-store-e2e.test.ts proves; (2) the branch is chosen once at import (index.js:32) and destructures proxy/tracing into a closure, so a package first imported mid-invocation would freeze that invocation\'s token and trace ids into every later call; (3) the gate checks only kvs.url/kvs.host then dereferences proxy.token and tracing.traceId unguarded, so a partial population is a TypeError at import.',
  },
  proxy: {
    readers: ['@forge/kvs'],
    source: 'kvs/out/index.js:10 (reads .token)',
    summary: 'Egress-proxy bearer token for the KVS fast path. Only read when `kvs` is set.',
    when: 'import',
    plan: 'noop',
    note: 'structurally present — ProxyInfo is a REQUIRED ForgeRuntime field — but carries an inert token; nothing ever reads it while `kvs` stays omitted, and there is no proxy to authenticate against locally',
  },
};

/**
 * Packages whose `out/` the derivation test scans. Everything forge-sim can
 * meet on the backend, including the ones that turn out to have no seam: an
 * upstream release that ADDS one to @forge/resolver (which holds its handler
 * map in a closure) or @forge/storage is exactly the news we want to fail on.
 */
export const SCANNED_PACKAGES: readonly string[] = [
  '@forge/api',
  '@forge/kvs',
  '@forge/sql',
  '@forge/events',
  '@forge/object-store',
  '@forge/llm',
  '@forge/realtime',
  '@forge/storage',
  '@forge/resolver',
  '@forge/auth',
  '@forge/egress',
  '@forge/i18n',
];

/** True when the registry knows the descriptor and forge-sim deliberately doesn't route it. */
export function isUnroutedDescriptor(type: string): boolean {
  const spec = FETCH_DESCRIPTORS[type];
  return !!spec && typeof spec.unrouted === 'string';
}
