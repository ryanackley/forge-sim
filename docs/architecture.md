# Architecture

How forge-sim runs your Forge app code unmodified, and the (small) set of tricks that makes it work.

## The big picture

forge-sim is a single in-process simulator (`ForgeSimulator`) that exposes Forge's storage, queues, product APIs, UI rendering, triggers, remotes, LLM, and realtime as plain methods on a `sim` object. The interesting question is how *your* app code — which calls `requestJira()`, `kvs.set()`, `chat()`, etc. — ends up reaching those methods.

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

The two strategies are different because the real packages on each side work differently — see below.

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

The backend `@forge/*` packages are thin facades over this runtime object. By contrast, the frontend `@forge/bridge` *is* the network layer — `bridge.invoke('method', args)` becomes a `postMessage` to the parent iframe, which the Atlassian container relays.

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

```ts
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

The real `@forge/llm` package still sits in `node_modules`. It just never loads. We bypass `__forge_runtime__` entirely — there is no runtime object to fake.

For programmatic use (`createSimulator()` in tests), `sim.deploy()` registers the hooks for you via `module.register()`. No `--import` flag needed.

### A few packages need a different shape

`@forge/sql` and `@forge/kvs` are partially CJS, partially using a different bridge model — they call `global.__forge_fetch__({ type: 'kvs', ... })` internally. For those, the shim imports the real package and substitutes only the bridge function on `globalThis`. See `src/shims/globals.ts`. This is the "shim → real package fallthrough" convention noted in `CLAUDE.md` — same Atlassian code path, just routed to our backing storage.

## Frontend: bridge replacement at the network layer

Frontend interception is fundamentally simpler because the bridge is already a network boundary. `@forge/bridge.invoke('method', args)` is a `postMessage` envelope. We swap the bridge implementation itself:

- **UIKit 2 mode** — forge-sim's Vite dev server serves our bridge JS, which talks to the simulator over WebSocket. The renderer in the browser receives ForgeDoc updates the same way real Forge would.
- **`--proxy` mode** — forge-sim sits in front of any external dev server (webpack/Vite/Parcel/etc.), injects the bridge shim into HTML responses, and intercepts `/__forge/*` and `/__tools/*` routes. The upstream dev server's HMR WebSocket falls through unchanged.
- **UIKit reconciler** — `@forge/react` calls `bridge.callBridge('reconcile', { forgeDoc })`. The shim captures the tree, fires listeners, and the renderer turns ForgeDoc into Atlaskit components.

In all three cases, the bridge contract — `bridge.invoke(method, args) → Promise<result>` — stays exactly the shape real Forge enforces.

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
- [`docs/api.md`](./api.md) — programmatic surface (`sim.*`)
- [`docs/renderer.md`](./renderer.md) — ForgeDoc → Atlaskit, color modes
- [`docs/remotes.md`](./remotes.md) — FIT JWT signing and JWKS, the one place forge-sim *does* hit a network boundary inside the simulator
