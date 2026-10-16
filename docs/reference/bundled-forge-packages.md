# Bundled `@forge/*` packages: findings

Reference notes on how forge-sim's interception interacts with apps that
**bundle** the `@forge/*` packages into their output, gathered while
investigating adversarial finding D (manual packaging, #40).

This document records **facts** — measured behavior, package internals, and
code locations. Support decisions live in
[`docs/local-development/README.md`](../local-development/README.md); the
architectural narrative lives in
[`architecture.md`](./architecture.md).

Every claim below was verified against the installed `@forge/*` versions
pinned in `src/forge-package-versions.ts`. Re-verify after a dependency bump.

## 1. Two packaging shapes

Manual packaging (`app.package.bundler: manual@2026`) uploads the app's
output unmodified. Real Forge does not run `npm install` on it, so
dependencies must ship inside the package. That admits two shapes:

| | Shape 1 — compiled, not bundled | Shape 2 — bundled |
|---|---|---|
| Produced by | `tsc` and similar | esbuild / webpack / rollup / Parcel over the backend |
| `@forge/*` imports in output | present as bare specifiers | inlined; no specifier remains |
| `node_modules` | shipped in the package | not needed for `@forge/*` |

Both are legal in real Forge.

**The split applies to the backend only.** A UI resource is always built
output — raw JSX cannot be shipped to a browser — so a manual-packaged UI Kit
resource always has `@forge/react` and `@forge/bridge` inlined.

## 2. Interception is keyed on the specifier

Both mechanisms match the **specifier string** `@forge/<pkg>`:

- `src/loader/hooks.ts` — Node ESM resolve hooks
- `src/loader/cjs-interception.ts` — scoped `Module._resolveFilename` patch

Shape 1 keeps the specifiers, so interception fires and the shims run. Shape 2
has no specifier left, so no shim loads. This is true of **every** shimmed
package; what differs is whether the real inlined code still reaches the
simulator by another route.

## 3. Runtime seams that survive bundling

Two globals are read by the real packages at call time, independent of module
resolution:

- `global.__forge_fetch__(descriptor, path, init)` — installed in
  `src/shims/globals.ts`
- `window.__bridge.callBridge(cmd, data)` — installed in `src/ui/bridge.ts`

| Package | Seam reached when bundled | Routed by forge-sim |
|---|---|---|
| `@forge/api` | `__forge_fetch__` | yes — product REST |
| `@forge/kvs` | `__forge_fetch__` (`type: 'kvs'`) | yes |
| `@forge/sql` | `__forge_fetch__` (`type: 'sql'`) | yes |
| `@forge/events` | `__forge_fetch__` (`type: 'fpp'`) | **no** |
| `@forge/object-store` | `__forge_fetch__` (`type: 'os'`) | **no** |
| `@forge/llm` | `__forge_fetch__` (`type: 'llm'`) | **no** |
| `@forge/realtime` | `__forge_fetch__` (`type: 'realtime'`) | **no** |
| `@forge/react`, `@forge/bridge`, `@forge/*-bridge` | `window.__bridge` (see note) | yes |
| `@forge/resolver` | **none — makes no I/O** | n/a |

**Note on `@forge/bridge`:** two of its paths do not go through `window.__bridge`
at all and only work headless because `src/ui/bridge.ts` patches the
corresponding browser globals (measured October 2026, `@forge/bridge` pinned in
`src/forge-package-versions.ts`):

- `i18n.createTranslationFunction` / `getTranslations` load
  `./__LOCALES__/i18n-info.json` and `./__LOCALES__/<locale>.json` with a
  **page-relative global `fetch()`** (`out/i18n/index.js`). No bridge command.
  Headless, undici rejects the relative URL; the real `I18nProvider` effect
  rejects and `t()` silently returns keys.
- `parseRequest` (`out/fetch/fetch.js`) runs every `requestJira` /
  `requestConfluence` / `requestBitbucket` / `requestRemote` init through
  `new Request('', init)`. In Node that throws `Invalid URL` **before**
  `fetchProduct` / `fetchRemote` is ever sent — so the property hooks
  (`useIssueProperty` et al., built on `requestJira`) fail headless too.

Also measured: `invokeRemote` / `invokeService` are sent on the **`invoke`**
command with `invokeType: 'ui-remote-fetch'` / `'ui-container-fetch'`
(`out/invoke-endpoint/invoke-endpoint.js`), not a command of their own;
`requestRemote` is `fetchRemote` with the path inside `fetchRequestInit`; and
request headers cross the bridge as `[...headers.entries()]` pairs, not a
record. Our shim never emits any of these shapes, so they were invisible to
source-mode tests until `manual-packaging-ui.test.ts` ran the real package.

### Descriptor shapes observed

Captured by wrapping `__forge_fetch__` and calling each real package:

```
@forge/events  {"type":"fpp","provider":"app","remote":"stargate"}
               /webhook/queue/{publish,cancel,stats}/{contextAri}/{environmentId}/{appId}/{appVersion}
               (placeholders arrive UNEXPANDED)
@forge/object-store  {"type":"os","provider":"app","remote":"os"}   api/v1/metadata
@forge/llm           {"type":"llm"}        (model on the descriptor for POST)
@forge/realtime      {"type":"realtime"}   path "/" (GraphQL body)
```

`type: 'fpp'` is **not** unique to `@forge/events` — `requestJira`,
`requestConfluence`, `requestBitbucket` and `requestGraph` all send it
(`node_modules/@forge/api/out/api/fetch.js`). Only the path distinguishes
them.

### Unrouted behavior before the guard

A bundled `@forge/events` `queue.push()` fell through to the product-API mock
and surfaced in app code as `InternalServerError: 501 Error`, with nothing
connecting it to the bundler configuration. The event was never enqueued.
Loud, but unactionable. `src/shims/globals.ts` now detects these four
surfaces and throws a named error instead.

## 4. `@forge/resolver` is the one package with no seam

`node_modules/@forge/resolver/out/index.js` is pure in-process glue:
`define()` stores a callback in a private map; `getDefinitions()` returns a
closure over it. It never performs I/O.

Our shim (`src/shims/forge-resolver.ts`) works by **side effect** — its
`define()` also registers each key on `sim.resolver`. When the real package is
inlined, that registration never happens and the simulator cannot enumerate
the app's resolver keys; they are private to the app's own `Resolver`
instance. The exported dispatch function is the only entry point:

```js
async ({ call: { functionKey, payload, jobId }, context }, backendRuntimePayload) => …
```

Two behaviors of the real dispatcher matter:

- It **overwrites** `context.accountId`, `installContext`, `license` and
  `installation` from `backendRuntimePayload`. Passing `{}` as that second
  argument blanks the fields the app reads.
- It throws `Resolver has no definition for '<key>'.` for keys it does not
  own — usable as a "not mine" signal, not as a general error.

forge-sim detects this shape by source inspection
(`detectResolverDispatch` in `src/deployer.ts`) and registers it as a dispatch
fallback (`SimulatedResolver.registerDispatch`). Detection is never done by
probing: calling the function would execute app handlers at deploy time.

Note this code path predates the shape-2 investigation. It was introduced by
`852ea7b` (March 2026) for an unrelated cause — tsx's loader hooks
short-circuiting ours, so the real `@forge/resolver` loaded even for ordinary
source apps.

**Limitation:** a bundled resolver's definition keys still cannot be
enumerated, so they do not appear in `sim.resolver.getDefinitions()` or in
"Available:" error text. Routing works; listing does not.

A measured consequence of that: `sim.registerResolverOwnership()` is driven
by iterating a definitions map, so for a bundled resolver no ownership is
recorded. The cross-module guard in `simulator.ts` reads

```
const owner = this.resolverOwnership.get(functionKey);
if (owner && owner !== route.resolverFunctionKey) throw …
```

— permissive when `owner` is `undefined`. So a `moduleKey`-scoped invoke
that real Forge would reject ("each module can only invoke functions defined
in its own resolver") is **permitted** when the resolver was bundled. This
is the residual of the adversarial-F "webpack moduleKey-scoped invoke"
report, whose original repro was confounded by finding D: the bundler is
irrelevant, non-enumerable keys are the cause. It affects unsupported
shape-2 backends, plus the tsx-bypass path in §4; the effect is a missing
guard, not broken routing.

## 5. The real `@forge/api` runs on the seam alone

Loaded by explicit path (bypassing the shim alias) against a bare
`createSimulator()`:

- imports cleanly — 37 exports
- `route()` works
- `asApp().requestJira(...)` routes through `__forge_fetch__` into
  `sim.productApi`

Only the I/O path was exercised. `storage` (removed upstream in 8.x, retained
by our shim per `SIM_ONLY_EXPORTS`) and egress/permission checks on `fetch`
were not.

### Measured divergence between the real package and our shim

**Status: fixed (October 2026).** `route`, `routeFromAbsolute` and
`assumeTrustedRoute` now fall through to the real package, product-request
surfaces enforce the Route requirement, and `route-parity.test.ts` pins both
differentially. The table below records the divergence as measured, before
the fix — `src/shims/forge-api.ts` reimplemented `route()` at the time:

| Input | real `@forge/api` | forge-sim shim |
|---|---|---|
| `` route`/x/${'a b'}` `` | `/x/a b` — path segments not encoded | `/x/a%20b` |
| `` route`/x/${'../y'}` `` | **throws** `Disallowing path manipulation attempt` | silently encodes |
| return value | `ReadonlyRoute` (assigning `.value` throws) | plain object |

Real `route()` is mode-aware (`node_modules/@forge/api/out/safeUrl.js`):
before `?` or `#` it rejects `..`, `/`, `\`; after, it
`encodeURIComponent`s. The shim always encodes and never throws. The second
row is a works-in-sim / fails-in-Forge divergence.

## 6. Where the developer-experience instrumentation lives

| Location | `log()` call sites |
|---|---|
| `src/simulator.ts` | 43 |
| backend shims (`api`, `kvs`, `events`, `object-store`, `llm`, `realtime`) | 0 |
| frontend bridge shims (`bridge`, `jira-bridge`, `confluence-bridge`, `dashboards-bridge`) | 26 |

Console capture (`withCapture`), invocation logging, the `forge_logs` MCP
tool and mock registration all hang off `sim.*`, below both the shim and seam
paths. `__forge_fetch__` routes into the same `sim.kvs` / `sim.productApi`
objects the shims call, so a seam-routed call retains that instrumentation —
provided the seam routes to the correct backend (see §3).

The 26 frontend messages are shim-only. They describe **host-driven no-ops**
(e.g. `uiModificationsApi.onChange() — registered (no-op, host-driven)`) which
have no remote leg, so no seam can produce them. In shape 2 they degrade to
`Unhandled bridge command` from `src/ui/bridge.ts`.

## 7. Cost of the reimplementation approach

- `src/shims/` — ~3,200 lines
- `src/__tests__/shim-contract-{surface,types,quirks}.test.ts` — 669 lines,
  existing solely to detect drift from upstream
- the three-step dependency-bump ritual in `CLAUDE.md`

## Reproducing these findings

The descriptor shapes were captured by wrapping the global and invoking each
real package by explicit path:

```ts
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { createSimulator } from 'forge-sim';

async function captureSeamCalls(repoRoot: string) {
  createSimulator(); // installs global.__forge_fetch__
  const g = global as unknown as Record<string, any>;
  const orig = g.__forge_fetch__;
  g.__forge_fetch__ = async (d: unknown, p: string, i?: unknown) => {
    console.log('SEAM', JSON.stringify(d), p);
    return orig(d, p, i);
  };

  // Explicit path: a bare specifier resolves to the SHIM under vitest.
  const real = createRequire(import.meta.url)(
    join(repoRoot, 'node_modules/@forge/events/out/index.js'),
  );
  await new real.Queue({ key: 'q' }).push([{ body: {} }]);
}
```

That explicit-path load is the same idiom
`src/__tests__/shim-contract-types.test.ts` uses, and it is required: a bare
`@forge/*` specifier resolves to the **shim** under vitest (`resolve.alias`),
so importing it normally would measure our own code rather than Atlassian's.
