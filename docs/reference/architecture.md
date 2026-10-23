# Architecture

How forge-sim runs your Forge app code unmodified, and the (small) set of tricks that makes it work.

## The big picture

forge-sim is a single in-process simulator (`ForgeSimulator`) that exposes Forge's storage, queues, product APIs, UI rendering, triggers, remotes, LLM, and realtime as plain methods on a `sim` object. The interesting question is how *your* app code (which calls `requestJira()`, `kvs.set()`, `chat()`, etc.) ends up reaching those methods.

The answer is two parallel interception strategies, one for the frontend and one for the backend:

```
┌──────────────────────────────────────┐    ┌──────────────────────────────────────┐
│           Frontend (browser)         │    │           Backend (Node)             │
│                                      │    │                                      │
│   Custom UI / UIKit module           │    │   resolver.ts, trigger.ts, etc.      │
│            │                         │    │            │                         │
│   import { invoke } from             │    │   import { requestJira } from        │
│   '@forge/bridge'                    │    │   '@forge/api'                       │
│            │                         │    │            │                         │
│   ┌────────▼────────┐                │    │   ┌────────▼────────────────────┐   │
│   │ forge-sim's     │ network swap   │    │   │ Node loader hook redirects  │   │
│   │ bridge.js,      │ (served by     │    │   │ specifier @forge/api →      │   │
│   │ delivered by    │  dev server)   │    │   │ src/shims/forge-api.js      │   │
│   │ proxy / Vite    │                │    │   │  (real package never loads) │   │
│   └────────┬────────┘                │    │   └────────┬────────────────────┘   │
│            │                         │    │            │                         │
│       WebSocket                      │    │     direct call                      │
│            │                         │    │            │                         │
└────────────┼─────────────────────────┘    └────────────┼─────────────────────────┘
             │                                            │
             └──────────────────────┬─────────────────────┘
                                    ▼
                          ┌──────────────────────┐
                          │   ForgeSimulator     │
                          │    (sim.kvs, sim.    │
                          │     productApi, ...) │
                          └──────────────────────┘
```

The two strategies are different because the real packages on each side work differently; see below.

## How real Forge backends work

The real `@forge/api`, `@forge/kvs`, `@forge/sql`, `@forge/llm`, and friends do **not** issue HTTP/RPC calls themselves. They look up a host-injected runtime object:

```js
// node_modules/@forge/api/out/api/runtime.js
function __getRuntime() {
  const runtime = global.__forge_runtime__;
  if (!runtime) throw new Error('Forge runtime not found.');
  return runtime;
}
```

Atlassian's Lambda host attaches `__forge_runtime__` to `global` before invoking your handler. The runtime exposes `invoke`, `fetch`, `asApp`, `asUser`, metrics, etc., and *that* is what crosses the network into Atlassian's services.

The backend `@forge/*` packages are thin facades over this runtime object. By contrast, the frontend `@forge/bridge` *is* the network layer: `bridge.invoke('method', args)` becomes a `postMessage` to the parent iframe, which the Atlassian container relays.

Different model, different interception.

## Backend: bundle first, then inject the globals

forge-sim runs an app the way Forge does: **bundled**. `sim.deploy()` runs esbuild over every handler file with every dependency inlined, and headless `sim.ui.render()` bundles the UI Kit entry with its runtime pinned (both in `src/bundler.ts`, details under "Bundle caching" below). The runtime then loads one file and the three seams are already in place — `global.__forge_fetch__`, `global.__forge_runtime__`, `globalThis.__bridge`. No bare specifier is resolved at runtime, so there is nothing for a module loader to intercept.

Node's loader hooks (`src/loader/hooks.ts`, registered by `sim.deploy()` via `module.register()` or by `node --import ./dist/loader/register.js`) are therefore small and apply only to what forge-sim does **not** bundle — manual-packaged handlers and UI resources, imported as-is, and a test script run under plain Node. For those they:

- route `@forge/resolver` to `dist/shims/forge-resolver.js`, the one shimmed package (below);
- warn once about an `@forge/*` import the sim does not simulate;
- force ESM for marked prebuilt UI bundles and propagate the marker to their chunk imports;
- transpile a stray `.tsx`/`.jsx` and infer extensions on relative imports.

They no longer rewrite any `@forge/*` import, synthesize a CommonJS default-import facade, infer extensions on deep `@forge/*` imports, map the product bridges' browser-only entry, or deduplicate React. Each of those was a re-implementation of something Forge's bundler does, and the bundler does it here now (`loader-hooks.test.ts` pins that the hook hands those specifiers to Node untouched). A manual-packaged app that relied on any of them would have been relying on behaviour real Forge does not have.

```ts
const SHIM_NAMES = ['@forge/resolver'];
```

The bare-seam migration emptied this list of BACKEND packages: every one whose
I/O the seam can serve moved to `PASSTHROUGH_OK`, so the app runs the real
Atlassian package (see "Every package but `@forge/resolver`" below). The
frontend seam migration then did the same for every frontend package:
`@forge/bridge`, `@forge/react` and the three product bridges all run for real
against `globalThis.__bridge`, which `src/ui/bridge.ts` installs the moment
forge-sim is loaded. What is left is `@forge/resolver`, the one that can never
move — it holds its handler map in a closure and performs no I/O, so there is
no seam to answer. Inside a forge-sim-built bundle the **bundler** routes
`@forge/resolver` to the shim; the loader hook does the same for a
manual-packaged ESM app, and `src/loader/cjs-interception.ts` for a
manual-packaged CommonJS one. The shim is a tiny file:

```ts no-check
// src/shims/forge-resolver.ts
class Resolver {
  define(functionKey, handler) {
    globalThis[Symbol.for('forge-sim.instance')].resolver.define(functionKey, handler);
  }
}
```

So the call chain is:

```
app code   → import Resolver from '@forge/resolver'
bundler    → inlines dist/shims/forge-resolver.js in its place
shim       → sim.resolver.define(key, handler)
simulator  → sim.invoke(key) can now reach the app's handler
```

### Every package but `@forge/resolver` has no shim at all

Every backend `@forge/*` package ships CJS and routes its I/O through
`global.__forge_fetch__({ type, ... })` internally. They are
deliberately **not** aliased (`PASSTHROUGH_OK` in
`src/shims/shim-registry.ts`): the app loads the real Atlassian package and
`src/runtime/seam-fetch.ts` answers its I/O from the sim's MySQL / entity
store. Same Atlassian code path, just pointed at our backing storage — and
nothing to drift, because there is no second implementation.

This is now true of EVERY backend package — `@forge/api`, `@forge/kvs`,
`@forge/sql`, `@forge/llm`, `@forge/object-store`, `@forge/events` and the
backend `@forge/realtime` — and, since the frontend seam migration, of every
FRONTEND package too: `@forge/bridge`, `@forge/react` and the three product
bridges run against `globalThis.__bridge`. The only app-facing impersonation
left is `@forge/resolver`, and since Phase 5 even that is applied by the
bundler rather than a loader (next section). A package
listed in `PASSTHROUGH_OK` that sets `__esModule` + `exports.default` gets
the documented default-import style from the bundler (`forceBundlerInterop`
and the pinned-import facade in `src/bundler.ts`), not from any loader list.

Running the real `@forge/api` is also what keeps `route` / `routeFromAbsolute` / `assumeTrustedRoute` honest: a hand-rolled version once drifted in a security-relevant way (always-encoding instead of real `route()`'s mode-aware escaping, which *rejects* path-traversal shapes in path position) — pinned by the differential suite in `route-parity.test.ts`. Backend product requests (`requestJira` et al.) enforce the real package's Route-only policy; plain strings throw exactly as they do in Forge. The FRONTEND `requestJira` in `@forge/bridge` is a different API that takes a plain path string — two similar surfaces with a nuanced difference, and the bridge host must keep accepting the string.

### Bundle caching for handler imports

There are two places where a module cache fights the iterate loop, and both are now answered the same way. The first is `sim.ui.render()`: a source UI Kit entry is bundled per render (`src/bundler.ts`, platform browser) into a fresh directory, so a second render of the same module is a real re-evaluation whose top-level `ForgeReconciler.render()` runs again. The file is removed as soon as the import resolves (the module is in memory, its sourcemap inline). Unlike the backend, the frontend bundle **pins** the shared runtime — `react*`, `@forge/react*`, `@forge/bridge*`, the product bridges — rather than inlining it: a fully self-contained bundle re-evaluated React and the reconciler on every render (measured ~750 ms a render, a 4x slower suite). Pinned packages are resolved at build time to absolute paths (importer-first, forge-sim's copy as the fallback, React always from wherever `@forge/react` resolves so there is one React) and imported through a generated interop facade inside the bundle — the loader hook's old CJS default facade, now emitted by the bundler. Nothing is resolved at runtime; a render is ~10 ms on a cache hit. The cache key includes a fingerprint of the bundler module itself, so a bundler change invalidates every on-disk entry (a stale entry from a previous output shape once imported 20x slower than a fresh build). That retired N9 — the vite-node cache workaround that captured the React element on first evaluation and replayed it — along with the only patch the sim ever applied to a real package at runtime. `forge-react-package.test.ts` pins the second-render case with a tmpdir fixture, the one vite-node externalizes. Prebuilt bundles are imported as-is and keep the `?t=` cache-bust; see `deferred-issues.md` for their vite-node caveat.

The second is `sim.deploy()`. Node keys the dynamic-import cache on the full specifier URL, so appending `?t=Date.now()` to the entry-point URL busts the entry's cache, but **not** its transitive imports. Those resolve to plain URLs with no query string and stay cached forever across redeploys. The agent edits `validation.js`, redeploys, and the resolver still throws the old error message.

The fix lives in `src/deployer.ts` + `src/bundler.ts`, and since Phase 5 it does what `forge deploy` does: **one esbuild build per deploy, every dependency inlined**, written to a fresh `<appDir>/.forge-sim/bundles/deploy-<timestamp>-<random>/bundle.mjs`. A synthetic entry re-exports each handler file as its own namespace (`export * as e0 from '<file>'`), so there is one artifact per app, shared modules are single instances per deploy (`@forge/sql`'s migrationRunner across handler files, exactly as in Forge's single bundle), and the directory name makes the URL one that neither Node's ESM cache nor vite-node's path cache has seen. A fresh bundle also means a fresh `@forge/sql` singleton, which retired the old reach into the app's copy to clear it. Stale deploy directories are swept at the start of each redeploy.

Three bundler behaviours worth knowing, each because Forge's bundler has them and Node's loader does not:

- **Bundler-style CommonJS interop, forced.** esbuild gives an ESM importer inside a `"type": "module"` package *Node* default-import semantics (`import kvs from '@forge/kvs'` → the whole `module.exports`, `kvs.get` undefined), with no option to override; Forge's bundler applies the `__esModule`-aware convention to every app. `forceBundlerInterop()` drops the `isNodeMode` flag from esbuild's `__toESM` calls in the output. forge-sim's own `package.json` is `"type": "module"`, so every in-repo fixture without one would otherwise be in Node mode.
- **A `require` banner.** Inlined CommonJS packages call `require('fs')`; in ESM output esbuild leaves a helper that throws "Dynamic require is not supported" unless a real `require` is in scope. The banner is esbuild's own documented fix, and esbuild renames an app's own top-level `require` so the two never collide. `__dirname`/`__filename` point at the bundle, as in Forge's output.
- **Unresolvable bare specifiers stay external** (an optional dependency a package `require`s behind a try/catch), so the failure happens at call time as under Node, not at build time where it would block an app that never calls it. Native `.node` addons are external too; they do not run in Forge either.

Scratch apps with no `node_modules` of their own resolve `@forge/*` from forge-sim's copy through esbuild's `nodePaths` fallback; an app's own copy always wins (importer-first, the same precedence everywhere in the sim).

**Cache.** A build is keyed by its entry set and platform and stays fresh while every input file esbuild recorded (the metafile) has the same mtime and size — so an unchanged redeploy copies the cached output into the new unique directory instead of rebuilding, and editing *any* transitive file is a miss. Entries live under `.forge-sim/bundles/cache/<key>/` and are written atomically (temp dir + rename) because vitest workers share fixture directories. `DeployResult.bundle.cached` reports which happened.

**Two sim-side touches on real packages happen at bundle time**, both named in `src/bundler.ts`: `@forge/resolver` is routed to forge-sim's shim *inside* the bundle (the real class keeps definitions private; the shim additionally registers each key with the simulator, which is what the resolver list, per-module ownership and the "No resolver defined for X" hint rest on), and `@forge/api/out/api/i18n.js` gets one appended line registering its module-level cache reset in a global set, so `sim.i18n.setTranslations()` still reaches the TranslationsGetter of a copy that lives inside an app bundle.

`data:` URLs were the obvious first attempt but don't work: no parent path, so nothing left external (node builtins) can resolve. Sourcemaps are inline, so stack traces still point at user source.

### Manual packaging: no bundling at all

Apps that declare [manual packaging](https://developer.atlassian.com/platform/forge/manifest-reference/packaging/) (`app.package.bundler: manual@2026`) ship prebuilt output, and real Forge uploads it **unmodified**. The simulator matches that: handlers resolve ONLY inside `app.package.path` (no `src/` fallback — that would load files Forge never uploads), and the esbuild step above is skipped entirely. Skipping it is the point: bundling breaks exactly the things manual packaging legitimizes — CommonJS `require()`/`module.exports`/`__dirname`, data files read relative to the module, and `.wasm` imports (Node's native wasm-ESM integration handles those once no bundler is in the way).

Three consequences the deployer handles:

- **Cache busting without a bundle.** The entry import gets a per-deploy query string, and the app's slice of the CommonJS `require` cache is evicted before each deploy (realpath-aware — `require.cache` keys are realpaths and macOS tmpdirs are symlinks). Transitive **native-ESM** files inside the package dir have no evictable cache; rebuilds that touch helpers should also touch the entry, which content-hashing bundlers do anyway.
- **CJS `@forge/*` interception.** Manual output is typically TypeScript-compiled CJS, and `require('@forge/api')` bypasses the ESM loader hooks entirely. A scoped `Module._resolveFilename` patch (`src/loader/cjs-interception.ts`) maps shim names — only for requests from inside a deployed app dir, never from `node_modules/@forge/` (real packages' internal cross-requires stay native), and never from forge-sim's own shims, whose fallthrough requires *depend* on bypassing interception.
- **Handler extensions follow the packaging standard**: `.js`/`.cjs`, plus `.ts` with a parity warning (Node 22.18+ strips types). No `.tsx`/`.jsx` — Node can't load JSX. No `.mjs` — lint rejects it. Handlers must be CommonJS; an ESM `.js` under `"type": "module"` loads but draws a deploy warning.
- **Bundled `@forge/resolver`** — see below; the one shimmed package with no runtime seam.

### Bundled `@forge/*` backends are the normal case

This section used to say the opposite — that backends bundling `@forge/*` were unsupported because both interception mechanisms keyed on the specifier string, which a bundler erases. Two migrations inverted it. The bare-seam migration made every backend package run for real against `global.__forge_fetch__` / `global.__forge_runtime__`, so an inlined copy reaches the simulator the same way a resolved one does; the measurements behind that are in [`bundled-forge-packages.md`](./bundled-forge-packages.md). Then Phase 5 made the simulator *itself* bundle `@forge/*` into every deploy (previous section), so there is no "shape 1" left to distinguish from: every backend the sim runs is bundled output, as in Forge.

The one package with no seam at all is `@forge/resolver` — pure in-process glue: `define()` stores a callback in a private map and `getDefinitions()` returns a closure over it. forge-sim's shim works by *side effect*, registering each key on `sim.resolver` as the app defines it, and the bundler routes `@forge/resolver` to that shim inside every bundle it builds, so source-mode apps keep full key enumeration. For a bundle forge-sim did **not** build — manual packaging, where the real class ran — the simulator cannot enumerate the keys. The deployer detects the dispatch shape by source inspection (`detectResolverDispatch()`, never by probing, since calling the function would execute app handlers at deploy time) and registers it via `resolver.registerDispatch()`. `invoke()` then consults registered dispatchers for any key with no explicit handler, passing a realistic `backendRuntimePayload` (the real package *overwrites* `context.accountId`, `installContext`, `license` and `installation` from that second argument, so passing `{}` blanks exactly the fields the app reads). Routing works; listing doesn't.

### Prebuilt UI bundles: the bridge seam survives where module interception can't

A manual-packaged UI Kit resource is built output with the app's own `@forge/react` and `@forge/bridge` **inlined** — no bare `@forge/*` import ever executes, so loader hooks and aliases have nothing to intercept. The seam that survives is the one real Forge uses: `window.__bridge`. The bundled `@forge/bridge` looks it up at call time, and both forge-sim surfaces already provide it (the in-process bridge for headless renders, the injected/served bridge in the dev server). Reconcile capture, `invoke` routing, and function props flow through the exact same pipeline as source-mode UI Kit; only the imported files differ: **every** `<script type="module">` in the resource's entry HTML is imported in document order (quoted or unquoted attributes — Parcel's optimizer emits unquoted), because multi-entry builds list shared bundles before the entry bundle and a browser executes them all.

### The bridge: one protocol, two hosts

Real Forge gives an app iframe exactly one seam: `window.__bridge.callBridge(command, frame)`. Real `@forge/bridge` captures it at module evaluation and sends 40 distinct commands through it (the three product bridges add 12 more) — every frontend host interaction, for UI Kit and Custom UI alike; `@forge/react` adds only `reconcile` and `onError`. forge-sim answers that seam with a protocol and two hosts, and **every surface runs the real `@forge/bridge`**: there is no alias, no app-facing shim, and no difference between a source-mode app, a prebuilt bundle, a Custom UI page, a page proxied with `--proxy`, or a headless render.

- **`src/bridge/protocol/`** — dependency-free. The registry of every command (re-derived from the installed `@forge/bridge` and `@forge/react` by `src/__tests__/bridge-protocol.test.ts`, so a package bump that adds one fails CI), the frame normalizers, the `BridgeHost` interface, and `createBridgeDispatcher(host)`. The dispatcher normalizes each wire frame and calls one typed host method; a host never sees a frame. Unknown and unsupported commands **reject** — never resolve `undefined`, which is how a missing command used to surface as a failure somewhere unrelated in the app. `tsconfig.bridge-protocol.json` compiles the subtree with no DOM and no Node types, so an environment dependency is a build error.
- **`src/bridge/hosts/headless.ts`** — answers against the simulator in process (test API, MCP). The seam it serves is installed the moment a `ForgeSimulator` is constructed (`installBridgeSeam()` in `src/ui/bridge.ts`, called from `setSimulator()` next to the two backend seams), not at the first render: the real `@forge/bridge` captures `globalThis.__bridge` at module evaluation and throws if it is absent, so it has to exist before any app module loads, exactly as in Forge. `src/__tests__/bridge-seam.test.ts` pins this with the real package under plain `node`. Backend calls go straight to `sim.*`. Surface calls with no window resolve inertly and are recorded in `getBridgeCalls()`; `Modal.open()` throws with a pointer to `forge-sim dev` (see `deferred-issues.md`). Render-lifecycle state (ForgeDoc capture and waiters, forge context) stays in `src/ui/bridge.ts` and is passed in as dependencies.
- **`src/bridge/hosts/product-surfaces.ts`** — the twelve product-bridge commands (`@forge/jira-bridge`, `@forge/confluence-bridge`, `@forge/dashboards-bridge`), shared by BOTH hosts. These drive host-product chrome — a Jira issue modal, the issue form UI modifications rewrite, the Confluence editor, the dashboard widget save cycle — and no forge-sim surface renders a product around the app, dev page included, so the answer does not vary by environment. Each one logs that the app asked and returns the smallest answer the real package accepts: these packages validate what comes back and throw a `BridgeAPIError` from inside themselves otherwise, so `undefined` is not an option. The one surface that is not inert is `uiModificationsApi.onInit()` — the real package runs the app's callbacks the moment the internal API resolves, so there is no "registered, waiting" state to simulate; it runs against an empty form and the changes it submits are dropped.
- **`src/bridge/hosts/browser/`** — answers inside a dev page: WebSocket RPC to the dev server, plus flags, modal, history, navigation and the cross-frame event relay in the DOM. Type-checked by `tsconfig.bridge-browser.json` (DOM allowed), bundled by esbuild to `dist/bridge.js` at `npm run build` (~54 kB IIFE, no imports — unminified, so the source comments ship with it), served at `/__forge/bridge.js`. Every page `forge-sim dev` produces loads it as a classic `<script src>` in `<head>` — no `async`/`defer`, so the parser runs it before any app code, which is what `getCallBridge()` depends on — after a one-line config script carrying the WebSocket port, an optional default module key (proxied pages have no `/module/<key>/` in their URL) and the history mode. UI Kit pages use an in-memory `view.createHistory()` because the module key lives in the URL path and the bridge reads it back on every call; Custom UI keeps browser history. Realtime subscriptions ask the server for their channel key (`realtimeSubscribe` → `realtime.resolveSubscriptionKey`), so the bundle carries none of the key algorithm and dev and headless key identically. It also exposes `window.__forgeSimBridge` — reconcile stream and raw RPC — for forge-sim's own chrome; app code never touches it.

`renderer/src/bridge/forge-bridge-shim.ts` is **not** `@forge/bridge`: it is the chrome hooks the shell, module page and component-map use (`onReconcile`, `rpc`, `setActiveSubmitTree`, and a `view`/`requestJira` that send the real package's frames). Under jsdom it installs a minimal stand-in so renderer unit tests run without the bundle.

Frame details worth knowing, each measured from the installed package (file references in `src/bridge/protocol/dispatcher.ts`): `invokeRemote()`/`invokeService()` ride the same `invoke` command as resolver calls, distinguished only by `invokeType: 'ui-remote-fetch' | 'ui-container-fetch'`; `requestRemote()` is its own `fetchRemote` command with the path *inside* `fetchRequestInit`; request headers cross as `[name, value]` pairs; `view.submit()`/`close()` send the bare payload; `getUrl` requires a `NavigationLocation` with a `target` and runs `new URL()` on what the host returns, so hosts return absolute strings; `showFlag` requires an `id`; `Modal.open()` passes the real class's defaults. The real package's **i18n has no bridge command at all** — it does a page-relative `fetch('./__LOCALES__/i18n-info.json')` and `fetch('./__LOCALES__/<locale>.json')`, static files Forge's build places beside the entry HTML — so the dev server answers `<page>/__LOCALES__/<file>` from `sim.i18n` on both the Vite and `--proxy` paths (real shapes: `{ config }` for the info file, 404 for a missing locale so the package raises its own error), and headless patches `fetch` to do the same. `forge-sim dev` loads the app's `__LOCALES__` at boot with the same lookup as deploy.

Four Node-vs-browser gaps are papered over for headless renders:

- **Format forcing.** Browsers load `<script type="module">` as ESM unconditionally; Node infers a `.js` file's format from the app's `package.json`. A `forge-sim-esm` query marker on the entry import (propagated to relative chunk imports by the resolve hook) forces ESM so a `"type": "commonjs"` backend package can't misparse its own frontend dist.
- **A minimal `document` stub** (installed only when no real `document` exists). Vite's default build injects a modulepreload polyfill whose first statement touches `document`; the stub answers `relList.supports('modulepreload') → true`, so the polyfill exits on its own fast path — the browser-parity answer, since every browser Forge supports has native modulepreload. While each bundle is being imported, `document.currentScript` points at that script's file URL (null at rest, like a browser) — webpack/Rspack's `publicPath: 'auto'` runtime reads it at module eval and otherwise dies with an opaque "Automatic publicPath is not supported in this browser". Any *other* browser-global access at module eval is translated into an error naming the global instead of a minified-stack `ReferenceError`.
- **A page base for `new Request('')`.** Real `@forge/bridge` normalizes every `requestJira` / `requestConfluence` / `requestBitbucket` / `requestRemote` init through `new Request('', init)` to derive headers and body text (`out/fetch/fetch.js`, `parseRequest`). A browser resolves the empty URL against the document; undici has no base and throws `Invalid URL` inside the package, before any bridge command fires — taking `useIssueProperty` / `useContentProperty` / `useSpaceProperty` down with it, since they are built on `requestJira`. `installBridge()` wraps the global `Request` so relative and empty URLs resolve against the real document's base when one exists and a synthetic headless origin otherwise. Absolute URLs are untouched.
- **Page-relative `__LOCALES__` fetches.** See the bridge section above: headless has no page, so the global `fetch` is wrapped to answer exactly `./__LOCALES__/i18n-info.json` and `./__LOCALES__/<locale>.json` from `sim.i18n`. Everything else, absolute URLs included, goes to the real `fetch`.

Version skew is detected at the only place it's visible: the reconcile payload carries a protocol major (`forgeReactMajorVersion`), checked against `VERIFIED_FORGE_REACT_DOC_MAJOR`. Note the upstream quirk: the protocol major is NOT the npm major (`@forge/react` 12.x emits 11).

## Frontend: bridge replacement at the network layer

Frontend interception is simpler than backend interception because the bridge is already a boundary: `@forge/bridge` never imports anything of Atlassian's at runtime, it calls `window.__bridge.callBridge`. We provide that object (see "The bridge: one protocol, two hosts" above) and leave the package alone.

- **UIKit 2 mode** — `forge-sim dev` serves the app's source through Vite with the bridge bundle loaded ahead of it; `@forge/react` runs in the browser, its reconcile goes to the browser host, and the renderer turns ForgeDoc into Atlaskit components.
- **Custom UI mode** — the resource directory (or entry HTML of a prebuilt resource) is served with the same bundle injected into `<head>`.
- **`--proxy` mode** — forge-sim sits in front of any external dev server, injects the same bundle into HTML responses, and intercepts `/__forge/*`, `/__tools/*` and `__LOCALES__` requests. The upstream dev server's HMR WebSocket falls through unchanged.

In every case the app runs the real client against the real contract.

### Module-type auto-detection

`forge-sim dev` picks the rendering mode per module by inspecting the manifest resource: no flag, no config. The detection rules live in `detectModuleType()` in `src/dev-command.ts`:

1. **No `resource` key** → server-only module, no UI rendered.
2. **Resource declares `bundler: manual@2026`** → the dir is prebuilt output, which can't be sniffed, so the manifest decides: `render: native` on the module means UIKit (the entry HTML's module script is resolved and fed through the normal UIKit pipeline), anything else is Custom UI serving the entry HTML. Multi-entry resources pick their entry via the module's `resource: <key>/<entry>` reference. Rebuilds that rename hashed bundles are re-resolved on the fly (`refreshPrebuiltModules`).
3. **Resource path is a directory containing `index.html`** → Custom UI mode (served by Vite or proxied to an external dev server via `--proxy`).
4. **Resource path is a file (`.tsx` / `.ts` / `.jsx` / `.js` / `index.*` inside a dir)** → read it. If the source imports `@forge/react` or references `ForgeReconciler`, it's UIKit. Otherwise, Custom UI. (Entry maps without manual packaging resolve the per-module source file first, then sniff the same way.)

This is why a UIKit app and a Custom UI app coexist happily in the same project; the detector classifies each module independently and the dev server wires the right surface for each.

## Trade-offs

The decoupled approach has nice properties:

- **No need to mimic Lambda host internals.** We never build a fake `__forge_runtime__`. Our shim surface is what `import { ... } from '@forge/*'` exposes, which is a smaller, more stable contract than the runtime invoke graph.
- **Real packages unchanged in `node_modules`.** Apps see the same dependency tree as production. `npm ls @forge/api` shows the real package.
- **Frontend and backend interception are cleanly separated.** Browser-side WebSocket plumbing and Node-side loader hooks don't share code; either side can evolve independently.

The cost:

- **Manual parity tax.** When Atlassian ships a new top-level export from `@forge/api` (or changes a method's shape), our shim has to track it. We mitigate this by:
  - The "shim → real package fallthrough" convention (`src/shims/globals.ts`) — many calls land in the real CJS package and only the network-bound parts are intercepted, so patch releases align automatically.
  - The "no silent stubs" rule in `CLAUDE.md` — unimplemented methods throw a clear "not yet implemented" error rather than returning `undefined`. Parity violations are visible.
- **Two interception layers to reason about.** A frontend bug and a backend bug can look similar from the app's perspective. The architecture diagram above is the disambiguator.

## Known gotcha: stale daemon on rebuild

The MCP server is a long-lived Node process. It loads `dist/*.js` once at startup. If `forge-sim` is rebuilt during development (or upgraded via `npm install` in published-package usage), the daemon keeps the **old** compiled code in memory: new methods are `not a function`, properties on shared globals drift, parity bugs you just fixed don't actually go away. This trap has bit at least three times in skill runs across two days.

The self-check in `src/staleness.ts` compares the in-memory `dist/mcp-server.js` mtime against the file on disk on every tool response. If disk is newer (beyond a 2-second grace window for stat resolution noise), the daemon **auto-restarts**: the in-flight response is answered first (prepended with a self-contained `♻️ auto-restarting` notice flagging that it ran on the old code), then the process exits after a short flush delay. The MCP client respawns a fresh daemon (running the rebuilt dist) on the next tool call. In-memory simulator state does not survive the restart, so the notice tells the agent to re-deploy before invoking again.

The check is on by default when forge-sim is running from a checkout (`import.meta.url` doesn't contain `/node_modules/`) and off when installed as a dependency; `npm`-installed users don't rebuild the package mid-session and don't need the noise. Override with `FORGE_SIM_STALE_CHECK=on|off`. Auto-restart can be disabled independently with `FORGE_SIM_STALE_AUTORESTART=off`, which restores the warn-only behavior (response carries a `kill <pid>` hint; state is preserved until you restart manually).

## Where this lives in the code

| Concern | File(s) |
|---|---|
| Backend interception | `src/loader/hooks.ts`, `src/loader/register.ts`, `src/shims/*.ts` |
| Backend bridge fallthrough (real packages) | `src/shims/globals.ts` (`__forge_fetch__`) |
| Frontend bridge (UIKit 2 mode) | `src/ui/bridge.ts`, dev server in `src/dev-command.ts` |
| Frontend bridge (proxy mode) | `src/proxy-server.ts` |
| UIKit reconciler capture | `src/ui/simulator-ui.ts`, `src/ui/doc-utils.ts` |
| Renderer (browser-side) | `renderer/` package |
| Simulator orchestrator | `src/simulator.ts` |

## Further reading

- `CLAUDE.md` — quick orientation for agents working in the repo
- [`api.md`](./api.md) — programmatic surface (`sim.*`)
- [`renderer.md`](./renderer.md) — ForgeDoc → Atlaskit, color modes
- [`remotes.md`](../local-development/remotes.md) — FIT JWT signing and JWKS, the one place forge-sim *does* hit a network boundary inside the simulator
