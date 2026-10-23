# Bundled-app reliability — handoff for the next arc

> Written at the end of the session that completed Phases 4 and 5 of the seam
> migration, because context was running out and this environment has no
> memory or reliable compaction. The centrepiece is the **verbatim analysis**
> in the middle; everything around it exists so that analysis makes sense
> cold. Nothing here was re-verified while writing — it is a transcript of
> what was measured during the session. Delete this file when the arc it
> proposes is done or abandoned.

## Why this exists

`#40` (manual packaging) started a long arc: forge-sim used to intercept
`@forge/*` imports by **specifier**, which a bundler erases, so apps that
bundled their dependencies ("shape 2") silently bypassed the simulator. That
arc is now finished — every `@forge/*` package runs for real against a seam,
and forge-sim bundles apps itself. The open question the arc *surfaced* but
did not answer is the subject of this document:

**How do we support shape-2 bundled apps reliably, for any bundler a user
might have used?**

## Where the code stands

Branch `hfi/f71a2d41-2011-41b1-9735-b6717ce99ccb/elm`, nothing pushed.
Session commits, oldest first:

| Commit | Slice |
|---|---|
| `7e0842f` | 4a-1 view-event store + memory history out of the bridge shim |
| `be94d7c` | e2e repair: external-auth spec runs the real `@forge/api` |
| `6646224` | 4a-2 `globalThis.__bridge` installed from the simulator constructor |
| `b0d0bc6` | 4b product-bridge commands routed to both hosts |
| `b9c2efc` | the six `__permission__*` commands the derivation could not see |
| `83b29be` | 4c-1 headless answers into the headless host; dead WS history proxy deleted |
| `5d926b0` | 4c-2 `@forge/bridge` shim dropped |
| `8cd2a33` | 4d+4e `@forge/react` and product-bridge shims dropped |
| `ecd4a69` | **5a** backend bundled like `forge deploy` |
| `b952a59` | **5b** headless render bundles per render; N9 capture/replay retired |
| `d2d5f52` | **5c** bundler-replacement loader hooks retired |
| `71b78a0` | **5d** user-bundled shape-2 app e2e |
| `10ce159` | docs: per-deploy ESM retention recorded in `deferred-issues.md` |

End state: `SHIM_NAMES = ['@forge/resolver']` — the only app-facing shim left,
because it holds its handler map in a closure and has no I/O seam to answer.

Gates at `71b78a0`: core 161 files / 2697 tests, renderer 170, build,
Playwright 63 passed / 3 skipped.

## What the bundler does today (enough to read `src/bundler.ts` cold)

`sim.deploy()` and headless `sim.ui.render()` both run esbuild over the app
first, the way `forge deploy` does, so nothing resolves a bare specifier at
runtime.

- **Backend**: one build per deploy, every dependency inlined, from a
  synthetic entry that re-exports each handler file as a namespace, into a
  fresh `.forge-sim/bundles/deploy-<id>/bundle.mjs`. One artifact, so shared
  modules are single instances per deploy (`@forge/sql`'s migrationRunner
  across handler files). A fresh directory per deploy is what makes a
  redeploy a real re-evaluation; that property replaced the old
  `clearMigrationRegistry`.
- **Frontend**: bundled per render, but the shared runtime (`react*`,
  `@forge/react*`, `@forge/bridge*`, product bridges) is **pinned** to
  absolute paths and left external behind a generated interop facade.
  Inlining it cost ~750 ms per render and a 4x slower suite; pinned, a render
  is ~10 ms on a cache hit. The output file is deleted right after import.
- **Interop**: `forceBundlerInterop()` strips the `isNodeMode` flag from
  esbuild's `__toESM` calls, because esbuild gives a `"type": "module"`
  importer *Node* default-import semantics with no override, and forge-sim's
  own package is `type: module`. `NODE_BANNER` supplies `require`,
  `__filename`, `__dirname` for inlined CJS in ESM output.
- **Cache**: keyed by entry set + platform + a **fingerprint of the compiled
  bundler module**, fresh while every metafile input keeps mtime+size. The
  fingerprint exists because stale entries from an older output shape once
  imported 20x slower than a fresh build.
- **Two sim-side touches on real packages**, both named in `src/bundler.ts`:
  `@forge/resolver` routed to the shim inside the bundle (so resolver keys
  stay enumerable), and one appended line in `@forge/api`'s i18n module
  registering its cache reset so `sim.i18n.setTranslations()` reaches a copy
  inside an app bundle.

## Memory audit (the turn before the analysis below)

Prompted by the user's machine struggling. 16 GB RAM, 10 CPUs, vitest
defaults to 10 workers.

| | node | esbuild | mysqld | whole machine |
|---|---|---|---|---|
| Before Phase 5 (`8cd2a33`) | 7.06 GB | 583 MB | — | — |
| After Phase 5 (`71b78a0`) | 7.65 GB | 645 MB | — | — |
| Current, all processes | 6.26 GB | 654 MB | **2.50 GB** | **12.58 GB** |

- Phase 5 added **~630 MB, ~9%**. Real but not the cause.
- Machine **idle floor was 6.8 GB** before any test ran.
- Biggest single contributor is **up to 8 concurrent `mysqld` instances at
  ~200 MB each** — pre-existing, nothing to do with Phase 5.
- Capping workers to 4 did **not** help (6.07 vs 6.26 GB): each worker just
  absorbs more files.
- Timeline shows a ~45 s burst that drains cleanly — not unbounded growth
  within a run.
- Repeated-deploy probe: **~4 MB retained per deploy now, ~3 MB before**.
  Node's ESM registry never evicts, and every deploy/render imports a fresh
  URL by design. Benign for tests, unbounded for long-running `forge-sim dev`
  / MCP daemon sessions. Recorded in `deferred-issues.md` (`10ce159`) with
  what a fix would have to trade away.
- **The actual cause of the user's memory pressure was the assistant running
  the core suite, renderer suite and Playwright concurrently**, repeatedly.
  Run them sequentially.

## Forge's real bundler, measured

Read off the installed CLI during the final turn: `forge` 14.2.0 →
`@forge/bundler` 7.3.0, at
`/opt/homebrew/lib/node_modules/@forge/cli/node_modules/@forge/bundler/out`.

**Backend** (`config/common.js` `getCommonWebpackConfig` + `runtime.js`
`NodeBundler`): webpack 5, `target: 'node18'`, output `[name].cjs` with
`libraryTarget: 'commonjs'`, `globalObject: 'this'`, `node: { __dirname: true }`,
`mode: 'production'` with `optimization.minimize: false`, `resolve.extensions`
`['.ts','.tsx','.js','.jsx','.json','.cjs']`, **no externals whatsoever**, plus
`IgnorePlugin` for `encoding` (in node-fetch), `bufferutil`/`utf-8-validate`
(in ws), `dtrace-provider` (in bunyan). A runtime loader `__forge__.cjs` plus
`__forge_wrapper__.cjs` and `runtime.json` ship alongside; the loader `require`s
the bundle. `.tsx` via `ts-loader` with `jsx: 'react'`,
`jsxFactory: 'ForgeUI.createElement'`; `.jsx` via Babel.

**Frontend** (`config/nativeui.js` `getNativeUiBuildConfig`): webpack
`target: 'web'`, `HtmlWebpackPlugin` with `inject: 'body'` (a **classic**
script tag, not `type="module"`), `output.publicPath: 'auto'`,
`devtool: 'source-map'`, `node: { __dirname: true }`, Babel
`@babel/plugin-transform-react-jsx` with `pragma: 'React.createElement'` —
**classic JSX**, so `React` must be in scope. Multi-entry builds get
`optimization.splitChunks: { chunks: 'all' }`.

**Also present**: `getNativeUiWorkerBuildConfig` — `target: 'webworker'`,
`experiments: { outputModule: true }`, `output.module: true`,
`splitChunks: false`, `parser.javascript.dynamicImportMode: 'eager'`,
`alias: { 'iframe-resizer': false }`. Suggests UI Kit is moving into a web
worker; worth watching, nothing acted on.

**Manual packaging** (`ManualBundler`): copies `app.package.path`, attaches the
same runtime artifacts, stamps `metadata.bundler = 'manual@2026'`. No
transformation at all.

`@forge/bundler` is **not usable as a library as-is**: it asserts
`require.main`, depends on `@forge/cli-shared` tmpdir conventions, and is
version-locked to the CLI. It is usable as a *specification*.

---

## The analysis (verbatim, final response of the session)

> I read Forge's actual bundler config off your installed CLI (14.2.0 →
> `@forge/bundler` 7.3.0), so this is grounded rather than from memory. It
> changes a few of my earlier assumptions, and it surfaces two parity bugs in
> what I shipped.
>
> ## What Forge actually does
>
> Backend (`getCommonWebpackConfig` + `NodeBundler`): webpack 5,
> `target: 'node18'`, output `[name].cjs` with `libraryTarget: 'commonjs'`,
> `node: { __dirname: true }`, `mode: production` but `minimize: false`, **no
> externals at all** — every dependency inlined, `@forge/*` included — plus
> `IgnorePlugin` for the usual optional natives (`encoding`, `bufferutil`,
> `utf-8-validate`, `dtrace-provider`). A runtime loader `__forge__.cjs` is
> shipped alongside and `require`s the bundle. TSX goes through `ts-loader`
> with `jsx: 'react'`; JSX through Babel with `pragma: 'React.createElement'`.
>
> Frontend (`getNativeUiBuildConfig`): webpack `target: 'web'`,
> `HtmlWebpackPlugin` injecting a **classic** `<script defer>` into
> `index.html`, `publicPath: 'auto'`, Babel JSX with
> `pragma: 'React.createElement'` — classic JSX, so `React` must be in scope.
> There is also a new `native-ui-worker` config (`target: 'webworker'`, ESM
> output, eager dynamic imports) that suggests UI Kit is heading into a web
> worker. Manual packaging just copies `path` and stamps the metadata.
>
> ## Question 1: esbuild versus webpack
>
> The interop "gymnastics" turned out to be exactly two items, both now
> enumerable against the real config:
>
> | Forge webpack behavior | What esbuild needed |
> |---|---|
> | Babel-style `__esModule` default imports, unconditionally | one flag dropped from esbuild's `__toESM` helper |
> | CJS output, so `require` is native | a `createRequire` banner, because we emit ESM |
> | `IgnorePlugin` for named optional natives | our "unresolvable stays external" rule, which generalizes it |
> | `node.__dirname: true` | the same banner |
>
> Everything else matched. So the honest case for esbuild is speed and
> footprint: 6 to 50 ms per build versus webpack's seconds, and we build on
> every deploy, every headless render, and every file save in dev. Given
> today's memory audit, pulling the webpack+Babel+ts-loader tree into every
> vitest worker is also the wrong direction. And `@forge/bundler` isn't a
> library: it asserts `require.main`, depends on `@forge/cli-shared` tmpdir
> conventions, and is version-locked to the CLI.
>
> But there's a better middle than either choice: **treat `@forge/bundler`'s
> config as the specification and pin ours to it.** Add it as a
> devDependency, and have a contract test read `getCommonWebpackConfig()` and
> assert our esbuild options mirror the semantics that matter — target,
> output format, `__dirname`, extension list, the ignore set. That's the same
> move the seam registry and bridge registry make: derive the contract from
> the installed Atlassian artifact so drift fails CI. Right now our bundler is
> calibrated by what the suite happened to catch.
>
> Two concrete deltas that pinning would have caught, both things I
> introduced:
>
> - **JSX.** I used `jsx: 'automatic'` and described the resulting "React is
>   not defined" fix as a win. It's a parity lie: Forge uses classic JSX, so
>   an app without `import React` fails `forge deploy` and now passes in the
>   sim. The `macro-inline-config` fixture is exactly such an app. The fix is
>   `jsx: 'transform'` with `React.createElement`, and that fixture gets its
>   import back.
> - **Output format.** Forge emits CJS and `require`s it. Emitting CJS
>   ourselves would delete the banner, and it has a bigger payoff:
>   `require.cache` entries are deletable, unlike Node's ESM registry, which
>   is the root of the ~4 MB-per-deploy retention from yesterday's audit. It
>   would also take our bundles out of vite-node's import path entirely.
>   Needs a spike, because `import.meta` in app code changes meaning under
>   CJS.
>
> ## Question 2: a general framework for interop
>
> Yes, and the arc already built it. The three globals are the contract
> Forge's own runtime uses, and they are bundler-agnostic by construction: a
> webpack, esbuild, Rollup or Parcel bundle all reach `__forge_fetch__`,
> `__forge_runtime__` and `__bridge` the same way. What varies by bundler is
> only three things:
>
> 1. **Module format of the artifact.** Forge signals this by convention, not
>    sniffing: `.cjs` on the backend, and the `type` attribute of the script
>    tag on the frontend. Our prebuilt UI path assumes
>    `<script type="module">`, which is Vite's convention. **A UI resource
>    built by Forge's own bundler has classic scripts and would be skipped
>    entirely by headless render.** That's a real shape-2 gap.
> 2. **Environment globals touched at evaluation** — `document`, `self`,
>    `__dirname`, `publicPath: 'auto'` reading `currentScript`. Forge never
>    hits this because it runs browser code in a browser.
> 3. **Asset references** (`asset/resource` images, `__LOCALES__` files),
>    served relative to the page.
>
> Point 2 is the one with no clean general answer in-process. Our document
> stub and `Request` patch grow adversarially, one finding at a time, and they
> always will. The robust answer is the obvious one: evaluate browser bundles
> in a browser. The dev server already does this with real Chromium. A
> headless render mode for prebuilt resources that drives the same
> `BrowserHost` through Playwright would make shape-2 frontends work by
> definition, at the cost of a browser launch, while source-mode stays
> in-process for speed.
>
> ## Question 3: supporting shape 2 reliably
>
> Reliability comes from three things, two of which exist:
>
> - **Seam completeness, derived from the installed packages** — done, and
>   version-coupled. An app that bundles a newer `@forge/*` sending a
>   descriptor or command we don't route fails loudly, and the deploy advisory
>   already warns on a major mismatch when a `package.json` ships.
> - **The bundled-app e2e** — done as of 5d, but built with esbuild. The
>   gold-standard fixture is one built by the real thing: with
>   `@forge/bundler` as a devDependency we can run its exact webpack config
>   over a fixture app and deploy that output. That single test covers the CJS
>   loader convention, classic scripts, classic JSX and the ignore set in one
>   go.
> - **Forge's format conventions instead of sniffing** — not done. Honor
>   `.cjs`, honor the script tag's `type`, and the ESM marker becomes a
>   fallback rather than an assumption.
>
> ## What I'd recommend
>
> Don't switch to webpack. Keep esbuild, add `@forge/bundler` as the pinned
> specification, build the gold-standard fixture from it, fix the two parity
> deltas I introduced, and spike CJS output for the retention win. The
> browser-hosted headless render for prebuilt UI is the larger architectural
> piece and I'd scope it separately rather than fold it in.
>
> Want me to write that up as a Phase 6 plan with slices, or start with the
> JSX fix and the classic-script gap since those are parity bugs on the branch
> now?

---

## Unanswered at the cut

The user had not answered that closing question when context ran out. Nothing
below has been decided.

Candidate work items, roughly in the order the analysis argues for:

1. **JSX parity bug** — `src/bundler.ts` uses `jsx: 'automatic'`; Forge uses
   classic with `React.createElement`. An app missing `import React` passes
   here and fails `forge deploy`. Inverted parity violation, on the branch
   now. Fixture `src/__tests__/fixtures/macro-inline-config` relies on the
   automatic behaviour and would need its import back.
2. **Classic-script gap** — `extractEntryScripts` / the prebuilt render path
   assume `<script type="module">`. Forge's own `HtmlWebpackPlugin` output is
   a classic script. A UI resource built by the real CLI is likely skipped
   entirely. Unverified; verify before fixing.
3. **`@forge/bundler` as pinned specification** — devDependency plus a
   contract test asserting our esbuild options mirror its webpack semantics,
   in the spirit of `seam-registry.ts` and `bridge-protocol.test.ts`.
4. **Gold-standard fixture** — build a fixture with the real webpack config
   and deploy that output; supersedes the esbuild-built
   `bundled-app-e2e.test.ts` as the authoritative shape-2 test.
5. **CJS output spike** — would delete `NODE_BANNER`, make retained bundles
   evictable via `require.cache`, and bypass vite-node. Blocked on what
   `import.meta` in app code should mean under CJS.
6. **Browser-hosted headless render for prebuilt UI** — Playwright driving
   the existing `BrowserHost`, so DOM-touching bundles work by definition
   instead of growing the document stub adversarially. Separate, larger piece.

Also still open from the previous arc (see `deferred-issues.md`):
`getFrameDispatch` registered `unsupported:` though the real package looks
like a passthrough; the forge-sim-before-`@forge/bridge` import-order rule;
second headless render of a prebuilt frontend under vite-node; the ~4 MB
per-deploy retention; and 5 pre-existing `~/Projects/okr-tracker` queue
failures that predate this whole arc (verified against `9b2fcd6`).

## Lab measurements (2026-10-22, next session)

A bundler-matrix lab now exists at `lab/bundler-matrix/` (own package, not in
the test suite — see its README). Before the second pass the canonical
requirements were re-read from Atlassian's docs (both "Last updated Sep 24,
2026"): `developer.atlassian.com/platform/forge/manifest-reference/packaging/`
and `.../packaging/standard/`. What they require:

- **Functions**: for handler `<path>.<export>`, an exported function in a
  **CommonJS** module file `<path>.js` (or another extension Node can load)
  inside `app.package.path`; nested paths allowed (`cucumber/two.handler`);
  dependencies must be present in the package dir (`dist/node_modules`)
  unless bundled in; names starting `__` reserved.
- **UI Kit**: single-entry → `index.html`; multi-entry → one HTML per entry
  named per the `entry` map. HTML holds only the needed script references,
  in the body, **relative paths**, shape `<script type="module"
  src="./index.js">`. JS must contain **no JSX — pre-transformed with the
  `React.createElement` pragma**; exactly one file per resource defines the
  app component; asset paths relative to the resource root (Vite/webpack need
  `base: './'`). The docs' worked multi-entry example is Vite +
  `@vitejs/plugin-react` + `base: './'` with `React.StrictMode` at the root.

The lab builds one app seven ways — a faithful replica of `@forge/bundler`
7.3.0's webpack config, Rspack, Vite (single = bare defaults; multi = the
docs' canonical example; backend = the deliberate OFF-standard ESM `.js` +
`type: module` probe), Rollup (single-file + code-split), Parcel 2, user-run
esbuild (IIFE classic single + `splitting` multi), and **tsc-unbundled** (the
docs' "plain TypeScript" shape: transpile-only CJS, nothing bundled,
`node_modules` inside the package dir, nested `resolvers/main.handler`) —
deploys each manual-packaged, and exercises resolver+kvs, product API, the
single-entry render and a two-entry resource (home/settings, shared chunk).
Two headless modes: today's stub DOM, and a jsdom-globals preload (slots in
because `ensureBridgeSeam` only aliases `window` when undefined).

Results (`results-{stub,jsdom}.json`):

- **Backends: 7/7 in both modes**, including the unbundled shape (bare
  `require('@forge/kvs')` resolved from `out/node_modules`, real package →
  seam), `.cjs`, minified CJS, nested handler path, and the off-standard ESM
  probe. The handoff's item 2 ("classic scripts likely skipped") is
  **disproven** for single-entry — warn-and-fallback renders them.
- **Single-entry frontends, stub mode: 6/7.** Sole failure: Rollup
  single-file — its commonjs plugin **eagerly** evaluates `@forge/bridge`'s
  dynamic `import('iframe-resizer')`, whose SSR guard
  (`typeof window === 'undefined'`) is defeated by `src/ui/bridge.ts:443`
  aliasing `window = globalThis` (no `addEventListener`; Node's global is
  not an EventTarget) → `el.addEventListener is not a function`. Every other
  bundler dodges it only because the chunk stays lazy and unloaded. The alias
  couldn't be patched in place without polluting the backend realm, so the
  **fix (landed)** replaces it: `createHeadlessWindow()` in `src/ui/bridge.ts`
  — a distinct object with globalThis as prototype (reads fall through,
  writes stay on the window), a real EventTarget behind add/remove/
  dispatchEvent, self-referential `window`/`self`; nothing added to
  globalThis. Why the alias existed at all: it predates the seam migration,
  from when the sim's own bridge shim was published as `window.__bridge`. The
  real `@forge/bridge` reads `globalThis.__bridge` (out/bridge.js:9,15); the
  only `window.__bridge` in the shipped packages is `@forge/react`'s jest
  setup. `self` carries webpack/Rspack's `self.webpackChunk<app>` runtime.
- **Multi-entry frontends, stub mode: 4/6.** Vite-canonical (StrictMode
  included), Rollup code-split (relative chunk imports → ESM-marker
  propagation works), Parcel shared bundles and esbuild `splitting` all pass.
  **webpack-replica and Rspack fail with "(no doc)"**: `splitChunks` gives
  each page TWO classic scripts (shared chunk, then entry) and
  `extractEntryScripts`' classic fallback is `[scripts[0]]` — only the shared
  chunk is evaluated, the entry never runs. A browser runs every script in
  order. **Fix (landed)**: the fallback returns every classic script in
  document order (`extractEntryScripts`, `src/deployer.ts`), with the warning
  now naming them. One-line parity bug, independent of the window alias.
- **jsdom mode**: Rollup single passes (real `window`), but webpack-replica
  and Rspack single fail with "Automatic publicPath is not supported in this
  browser" — with a real document `setStubCurrentScript` no-ops and
  `document.currentScript` is null during eval. The currentScript
  choreography is load-bearing and must move with any jsdom design (real by
  construction if jsdom executes the scripts; a `defineProperty` otherwise).
  Multi-entry results identical to stub mode (same fallback bug).
- With both fixes in, the stub-mode matrix is **all green: 7/7 backends,
  7/7 single-entry renders, 6/6 multi-entry resources**. No evidence yet that
  a Playwright tier is needed for UIKit frontends. jsdom mode remains an
  experiment (its publicPath/currentScript trade-off above still holds).
- **`type` in package.json**: the sim never reads it. Manual backends are
  `import()`ed as-is (`deployer.ts` ~line 907), so **Node's** nearest-
  `package.json` rule decides CJS vs ESM for `.js` — the same rule the Forge
  runtime's Node applies. Prebuilt UI bundles deliberately IGNORE it: the
  `forge-sim-esm=1` loader marker forces ESM because browsers load module
  scripts as ESM regardless (`loader/hooks.ts` ~line 180); classic IIFE
  scripts tolerate that. In the sim's OWN source-mode bundler `type: module`
  flips esbuild to Node default-import interop, which `forceBundlerInterop`
  undoes to match Forge's webpack (`bundler.ts` ~line 117). The lab tripped
  the same esbuild interop on the USER side (`type: module` in the app's
  package.json + `import Resolver from '@forge/resolver'` → "not a
  constructor") — breaks identically on real Forge, user error, not a sim
  gap. The standard says **CommonJS** handlers, full stop; the deploy error
  hint used to recommend "ship ESM as .js with type: module" and the sim
  accepted the Vite ESM backend silently. **Fixed**: hint corrected, and a
  deploy warning now fires when a manual-packaged `.js` handler sits under
  `"type": "module"` (`nearestPackageType` in `deployer.ts`, Node's own
  rule). The lab keeps the Vite ESM backend only as a negative control whose
  `std-warning` phase asserts the warning fires.
- Not measured: Custom UI resources, the dev-server/browser path, repeated
  renders, `__`-prefixed reserved names, Parcel's `<script type=importmap>`
  in a browser.

## Conventions a next session needs

- **Gates before any commit**: `npx vitest run` (core), `cd renderer &&
  npx vitest run`, `npm run build`, `npx playwright test` — **sequentially**,
  not in parallel, per the memory audit above.
- **Defer work to `deferred-issues.md`**, never a GitHub issue: multiple
  agents work this repo and filing races.
- **Cite `node_modules` file:line** for any claim about a real package's wire
  shape or behaviour; never reconstruct from memory. Every bridge bug in #40
  came from a frame detail guessed wrong.
- `npm run docs:stats` is a **release chore**, not per-commit. Stats blocks in
  markdown are stale on purpose between releases.
- Release ritual also bumps `.claude-plugin/plugin.json` and
  `marketplace.json` by hand.
