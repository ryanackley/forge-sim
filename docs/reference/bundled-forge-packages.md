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


## Lessons from the frontend consolidation (for the backend bare-seam work)

The frontend went from three hand-written `callBridge` switches plus an aliased `@forge/bridge` shim to one protocol and two hosts, with every surface running the real package (commits `7a57bfd`..`4e0f9c7`, October 2026; design in [`architecture.md`](./architecture.md#the-bridge-one-protocol-two-hosts)). The backend has the same shape in front of it — `src/shims/*` behind loader-hook aliases, plus `global.__forge_fetch__` as the one bare seam the real CJS packages already use — so the same things will matter.

1. **Find the seam the real package already uses, then implement that completely.** `window.__bridge` was not something we designed; it is what `@forge/bridge` calls. Once it was implemented fully, the alias could simply go — the real package ran unchanged. The backend equivalent is whatever each real `@forge/*` package calls out to at runtime (`__forge_fetch__`, the Atlassian-internal HTTP endpoints, env vars like `FORGE_*`). Measure it from `node_modules/@forge/<pkg>/out/*.js` and write it down with file references, as `bundled-forge-packages.md` already does for the descriptor shapes. Where a package has **no** seam (`@forge/resolver` holds its map in a closure; `@forge/bridge` i18n fetches files), name that explicitly and design around it rather than discovering it late.
2. **Derive the contract from the installed package, in a test.** `bridge-protocol.test.ts` greps `node_modules/@forge/bridge/out` for every `callBridge('x')` and fails if the registry is missing or over-complete. That turned "did a bump add a command?" from a memory exercise into CI. For the backend, the analogue is enumerating every `__forge_fetch__({ type })` descriptor and every outbound URL/env read per package, and pinning the table to `VERIFIED_FORGE_VERSIONS`.
3. **One dispatcher, hosts behind a typed interface; keep transport out of the protocol.** `BridgeHost` has two kinds of methods — backend calls that vary by transport, surface calls that vary by environment — and that split is what let headless and browser share a dispatcher while answering differently. A backend `__forge_runtime__` will likely split the same way: storage/HTTP/queue calls that always reach `sim.*`, versus things like `process.env`, timers, and "who am I" that differ between in-process tests, the dev server, and a bundled handler.
4. **Never resolve `undefined` for something you don't handle.** Every late-found bridge bug (`invokeType`, header pairs, `fetchRemote`, modals in Custom UI) had the same symptom: a missing case returned `undefined` and the app failed somewhere unrelated. The dispatcher now rejects unknown and unsupported commands, and that rule alone would have surfaced each bug on first use. The backend's `globals.ts` already does this for the four unrouted packages; apply it to every descriptor type.
5. **Tests that drove the shim's exports proved nothing about the real path.** Source-mode tests were green for months because they tested our stand-in against itself. The tests that caught real bugs were the ones running the **real package** against the host — prebuilt bundles in Chromium, and jsdom suites that install the real host and send the real package's frames. For the backend: test handlers that `require` the real `@forge/kvs`/`@forge/sql` (already the pattern via `__forge_fetch__`), not handlers that import our shim.
6. **Don't reimplement details from memory.** The modal flag (`modal=1` vs `_modal=true`) and `?context=` decoding (URI-encoded vs base64) were both wrong in a first draft written without reading the code being replaced; porting the modal properly forced the read and found both. Diff the old implementation line by line before deleting it.
7. **Environment isolation by compiler, not by comment.** `tsconfig.bridge-protocol.json` (`lib: ES2022`, `types: []`) makes a stray `window` or `process` a build error. A backend protocol module should get the same gate so it can be shared by Node, the dev server, and any future non-Node host without accreting dependencies.
8. **Build boundaries decide packaging.** A workspace package for the protocol was considered and rejected: the renderer is shipped as *source* and materialized with `npm ci` into `~/.forge-sim/renderer/<version>/`, where a `file:` dependency dangles. Check how each consumer is published before choosing `file:`, workspaces, or bundling — for the backend the consumers are `dist/` (tsc) and whatever the loader hooks inject, so a plain `src/` directory with its own tsconfig gate is probably again the right answer.
9. **Replace injected strings with built artifacts.** The 538-line inline bridge script existed because it had to run before app code and could not import. A classic `<script src>` without `async`/`defer` has the same ordering guarantee and can be ordinary TypeScript with tests. Backend analogue: anything currently stringified into a generated entry or `--import` preamble is a candidate for a built module.
10. **Expect the real package to be stricter than the shim, and let fixtures fail.** `showFlag` without an `id`, `getUrl` with a plain string, `requestJira` with a plain string — all accepted by shims, all rejected by the real packages. Each surfaced as a fixture "regression" that was really the fixture being wrong. Budget for a pass over `src/__tests__/fixtures/*` and `e2e/fixtures/*` when the backend shims come out.
11. **Fix the harness before chasing flakes.** Two full days of "random" `ERR_CONNECTION_REFUSED` were another worktree's dev server on a hardcoded port, invisible because the harness killed nothing and reported nothing. Free ports, awaited shutdown, and printing the child's last output on unexpected exit turned every later failure into a real signal. The core suite's port use (`bridge-invoke-routing`, dev-server tests) should get the same treatment before the backend work adds more servers.
12. **Phase it, verify every slice end to end, commit each slice.** Protocol + headless first (pinned by the existing suite), then the new host behind a feature that already had e2e coverage (Custom UI), then the surface with the most hidden state (UI Kit), then the alias. Each slice ran core, renderer, e2e and a clean build before commit, and each commit message records what was verified and what was not. The one thing left unexplained is in the commit that touched it (`29e94df`: why a plain-string `requestJira` fixture ever passed).
