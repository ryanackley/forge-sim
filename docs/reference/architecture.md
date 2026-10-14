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

## Backend: Node module loader hooks

forge-sim does **not** install a fake `__forge_runtime__`. It intercepts at *import resolution*, before the real package can load:

```bash
node --import ./dist/loader/register.js app.js
```

`register.js` registers Node's loader hooks from `src/loader/hooks.ts`. The `resolve()` hook short-circuits any specifier in this list:

```ts
const SHIM_NAMES = [
  '@forge/api', '@forge/kvs', '@forge/events', '@forge/resolver',
  '@forge/react', '@forge/bridge', '@forge/jira-bridge',
  '@forge/confluence-bridge', '@forge/dashboards-bridge',
  '@forge/llm', '@forge/realtime',
];
```

When the app does `import { chat } from '@forge/llm'`, the hook returns `dist/shims/forge-llm.js` instead of the real package. That shim is a tiny file:

```ts no-check
// src/shims/forge-llm.ts
import { getSimulator } from './globals.js';
export async function chat(prompt) {
  return getSimulator().llm.chat(prompt);
}
```

So the call chain is:

```
app code   → import { chat } from '@forge/llm'
loader     → resolves to dist/shims/forge-llm.js
shim       → getSimulator().llm.chat(prompt)
simulator  → llm.chat() runs against sim.llm (mocks or real Anthropic)
```

The real `@forge/llm` package still sits in `node_modules`. It just never loads. We bypass `__forge_runtime__` entirely; there is no runtime object to fake.

For programmatic use (`createSimulator()` in tests), `sim.deploy()` registers the hooks for you via `module.register()`. No `--import` flag needed.

### A few packages need a different shape

`@forge/sql` and `@forge/kvs` are partially CJS, partially using a different bridge model: they call `global.__forge_fetch__({ type: 'kvs', ... })` internally. For those, the shim imports the real package and substitutes only the bridge function on `globalThis`. See `src/shims/globals.ts`. This is the "shim → real package fallthrough" convention noted in `CLAUDE.md`: same Atlassian code path, just routed to our backing storage.

### Bundle caching for handler imports

There's one place where Node's ESM cache fights the iterate loop: `sim.deploy()`. Node keys the dynamic-import cache on the full specifier URL, so appending `?t=Date.now()` to the entry-point URL busts the entry's cache, but **not** its transitive imports. Those resolve to plain URLs with no query string and stay cached forever across redeploys. The agent edits `validation.js`, redeploys, and the resolver still throws the old error message.

The fix lives in `src/deployer.ts`. Before importing the handler, esbuild bundles the entry plus every relative-import descendant into a single ESM file at `<appDir>/.forge-sim/bundles/deploy-<timestamp>-<random>.mjs`. The bundle filename is per-deploy unique, so the resulting `file://` URL is a brand-new module specifier that neither Node's ESM cache nor vite-node's path-based cache has seen before. Stale bundles are swept at the start of each redeploy.

Bare specifiers (`@forge/*`, react, axios, …) stay external. The bundle file lives inside the app directory, so when Node resolves those externals it walks up into the app's `node_modules` normally, and our loader hooks still intercept `@forge/*` from there. The shim interception path survives bundling.

`data:` URLs were the obvious first attempt but don't work: Node can't resolve bare specifiers from a `data:` URL because there's no parent path to anchor the `node_modules` walk. A file URL inside the app dir is the cheapest fix that keeps the resolver behavior intact. Sourcemaps are inline, so stack traces still point at user source.

### Manual packaging: no bundling at all

Apps that declare [manual packaging](https://developer.atlassian.com/platform/forge/manifest-reference/packaging/) (`app.package.bundler: manual@2026`) ship prebuilt output, and real Forge uploads it **unmodified**. The simulator matches that: handlers resolve ONLY inside `app.package.path` (no `src/` fallback — that would load files Forge never uploads), and the esbuild step above is skipped entirely. Skipping it is the point: bundling breaks exactly the things manual packaging legitimizes — CommonJS `require()`/`module.exports`/`__dirname`, data files read relative to the module, and `.wasm` imports (Node's native wasm-ESM integration handles those once no bundler is in the way).

Three consequences the deployer handles:

- **Cache busting without a bundle.** The entry import gets a per-deploy query string, and the app's slice of the CommonJS `require` cache is evicted before each deploy (realpath-aware — `require.cache` keys are realpaths and macOS tmpdirs are symlinks). Transitive **native-ESM** files inside the package dir have no evictable cache; rebuilds that touch helpers should also touch the entry, which content-hashing bundlers do anyway.
- **CJS `@forge/*` interception.** Manual output is typically TypeScript-compiled CJS, and `require('@forge/api')` bypasses the ESM loader hooks entirely. A scoped `Module._resolveFilename` patch (`src/loader/cjs-interception.ts`) maps shim names — only for requests from inside a deployed app dir, never from `node_modules/@forge/` (real packages' internal cross-requires stay native), and never from forge-sim's own shims, whose fallthrough requires *depend* on bypassing interception.
- **Handler extensions follow Forge lint**: `.js`/`.cjs` (plus TS sources with a parity warning). No `.mjs` — lint rejects it; ship ESM as `.js` + `"type": "module"`.

### Prebuilt UI bundles: the bridge seam survives where module interception can't

A manual-packaged UI Kit resource is built output with the app's own `@forge/react` and `@forge/bridge` **inlined** — no bare `@forge/*` import ever executes, so loader hooks and aliases have nothing to intercept. The seam that survives is the one real Forge uses: `window.__bridge`. The bundled `@forge/bridge` looks it up at call time, and both forge-sim surfaces already provide it (the in-process bridge for headless renders, the injected/served bridge in the dev server). Reconcile capture, `invoke` routing, and function props flow through the exact same pipeline as source-mode UI Kit; only the imported files differ: **every** `<script type="module">` in the resource's entry HTML is imported in document order (quoted or unquoted attributes — Parcel's optimizer emits unquoted), because multi-entry builds list shared bundles before the entry bundle and a browser executes them all.

Two Node-vs-browser gaps are papered over for headless renders:

- **Format forcing.** Browsers load `<script type="module">` as ESM unconditionally; Node infers a `.js` file's format from the app's `package.json`. A `forge-sim-esm` query marker on the entry import (propagated to relative chunk imports by the resolve hook) forces ESM so a `"type": "commonjs"` backend package can't misparse its own frontend dist.
- **A minimal `document` stub** (installed only when no real `document` exists). Vite's default build injects a modulepreload polyfill whose first statement touches `document`; the stub answers `relList.supports('modulepreload') → true`, so the polyfill exits on its own fast path — the browser-parity answer, since every browser Forge supports has native modulepreload. While each bundle is being imported, `document.currentScript` points at that script's file URL (null at rest, like a browser) — webpack/Rspack's `publicPath: 'auto'` runtime reads it at module eval and otherwise dies with an opaque "Automatic publicPath is not supported in this browser". Any *other* browser-global access at module eval is translated into an error naming the global instead of a minified-stack `ReferenceError`.

Version skew is detected at the only place it's visible: the reconcile payload carries a protocol major (`forgeReactMajorVersion`), checked against `VERIFIED_FORGE_REACT_DOC_MAJOR`. Note the upstream quirk: the protocol major is NOT the npm major (`@forge/react` 12.x emits 11).

## Frontend: bridge replacement at the network layer

Frontend interception is fundamentally simpler because the bridge is already a network boundary. `@forge/bridge.invoke('method', args)` is a `postMessage` envelope. We swap the bridge implementation itself:

- **UIKit 2 mode** — forge-sim's Vite dev server serves our bridge JS, which talks to the simulator over WebSocket. The renderer in the browser receives ForgeDoc updates the same way real Forge would.
- **`--proxy` mode** — forge-sim sits in front of any external dev server (webpack/Vite/Parcel/etc.), injects the bridge shim into HTML responses, and intercepts `/__forge/*` and `/__tools/*` routes. The upstream dev server's HMR WebSocket falls through unchanged.
- **UIKit reconciler** — `@forge/react` calls `bridge.callBridge('reconcile', { forgeDoc })`. The shim captures the tree, fires listeners, and the renderer turns ForgeDoc into Atlaskit components.

In all three cases, the bridge contract (`bridge.invoke(method, args) → Promise<result>`) stays exactly the shape real Forge enforces.

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
