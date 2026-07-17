# forge-sim Roadmap

> **If it works in forge-sim, it should work in Forge. If it wouldn't work in Forge, it shouldn't work in forge-sim.**

## Architecture overview

```
┌──────────────────────────────────────────────┐
│            Forge Sim Tools (/__tools/)        │
│  ┌─────┬──────┬──────┬──────┬────────┐       │
│  │ UI  │State │Events│ Auth │  Logs  │       │
│  │Picker│     │      │      │        │       │
│  └─────┴──────┴──────┴──────┴────────┘       │
├──────────────────────────────────────────────┤
│  App Preview (:5173)      │  Proxy Mode      │
│  Vite + Atlaskit render   │  --proxy <url>   │
│  UIKit 2 / Custom UI      │  Any bundler     │
├──────────────────────────────────────────────┤
│         Bridge RPC (:5174 WebSocket)         │
├──────────────────────────────────────────────┤
│              forge-sim core                   │
│  ┌─────┬─────┬─────┬──────┬────────┬──────┐ │
│  │ KVS │ SQL │Queue│Remote│ProdAPI │ FIT  │ │
│  │     │     │     │Proxy │mock+real│ JWT  │ │
│  └─────┴─────┴─────┴──────┴────────┴──────┘ │
│  ┌──────────┬────────────┬─────────────────┐ │
│  │ Entity   │ Module     │ Function        │ │
│  │ Store    │ Routing    │ Registry        │ │
│  └──────────┴────────────┴─────────────────┘ │
│         .forge-sim/ (persistent)              │
│    credentials │ state │ config               │
└──────────────────────────────────────────────┘
```

## Current focus

### NPM publishing — first public release

Get forge-sim onto npm so it installs with `npm install -g forge-sim`.

- Decide license (MIT recommended for adoption)
- Add `files` allowlist, `keywords`, `repository`, `homepage`, `bugs`, `author`, `engines.node` to `package.json`
- Add `LICENSE` + `CHANGELOG.md`
- Add `prepublishOnly` to prevent stale-dist publishes
- Verify `npm pack` tarball contents
- Tag and publish as `0.1.0-beta.1`

**Status:** All engineering work done; this is packaging.

### Forge Realtime (deferred)

Real-time pub/sub channels. The shim is shipped (`@forge/realtime` shim with channel pub/sub), but the production wire format is in Atlassian's preview. **Waiting for Atlassian GA** before chasing parity on the network layer.

## Recently shipped

For the full history, see `git log`. Highlights of the last few weeks:

- **Dark / light / auto color mode** in the renderer (real-Forge `?theme=` contract)
- **Tools UI parity in `--proxy` mode** — full WebSocket log streaming + type-error broadcasts
- **`@forge/llm` shim** with Claude 4.6 / 4.7 + `forge-sim auth --llm`
- **`@forge/realtime` shim** — channel pub/sub, scoped + global publishes
- **Mock routes** via CLI / MCP / HTTP
- **Trigger event templates** — 141 typed events across Confluence, Jira, Jira Software, App Lifecycle
- **`appEvents.publish()`** — custom app event pub/sub
- **Custom Fields** (`jira:customField` / `customFieldType`) with view/edit/viewSubmit
- **Workflow modules** (validator / condition / postFunction)
- **Rovo Actions** (`action` module) + Command Palette (`jira:command`)
- **Web Triggers** — `/__trigger/<key>` HTTP endpoints with CORS
- **Background scripts** — `issueView`, `dashboard`, `globalBackgroundScript` via postMessage
- **Universal `--proxy` mode** — works with any bundler (forgebuilder uses this)
- **Real API proxy** (PAT + OAuth, mock-first with real fallback)
- **Forge Remotes** (FIT JWT + JWKS endpoint)
- **Per-function-type invocation timeouts** (resolver 25s, trigger 55s, scheduled/consumer up to 900s)
- **TypeScript type checking** integrated into dev workflow
- **General hardening pass** — silent-failure audit, manifest edge cases, error handling, e2e dev server tests, renderer integration tests
- **Universal Dev Server Proxy** ([proposal](proposals/universal-dev-server-proxy.md))

## Completed (foundational)

### Core simulator
- KVS, SQL (real MySQL), Queues, Entity Store, Secrets — all persistent + MCP-introspectable
- `.forge-sim/state/` directory: `entities.json` + `sql.dump`, auto-save / restore, `--clean` flag

### UIKit 2 renderer
- 73/73 components mapped to real Atlaskit
- Dual-mode: browser (CDT-debuggable) + server (MCP/AI-driven)
- Live preview via WebSocket dev server
- Dark / light / auto color mode

### Custom UI support
- Auto-detects from manifest, serves resource directory via Vite OR proxies external dev server
- `@forge/bridge` shim injection
- `invoke()`, `view.getContext()`, `requestJira()` all routed through simulator

### Tools UI (`/__tools/`)
- KVS browser, SQL runner, log streaming, event firing, mock routes
- Served by Vite middleware AND by proxy mode (full parity)

### Credentials + real API
- PAT (Basic auth) + OAuth 2.0 (3LO) + LLM API key
- `forge-sim auth` CLI
- Real API proxy: mock routes priority, real API fallback
- OAuth token refresh
- External auth providers (`asUser().withProvider()`)

## Test suite

<!-- BEGIN:STATS -->
**2,305 tests** across **122** test files
(2,158 core / 118 files
+ 147 renderer / 4 files)

**41 MCP tools** + **4 resources**
<!-- END:STATS -->

> The block above is auto-generated by `npm run docs:stats`. Run after adding tests or MCP tools.

Coverage spans simulator core, remotes, module routing, bridge invoke routing, proxy server, modal bridge, multi-module routing, deployer, manifest parser + edge cases, KVS, SQL, queues, entity store, product API mock + real, custom fields, workflow modules, Rovo actions, web triggers, background scripts, persistence, dev server e2e, and visual snapshots.

## Three dev modes

| Scenario | Command | What happens |
|----------|---------|--------------|
| UIKit app | `forge-sim dev` | Vite renders Atlaskit components from ForgeDoc |
| Custom UI (simple) | `forge-sim dev` | Vite serves resource directory, injects bridge |
| Custom UI (own dev server) | `forge-sim dev --proxy <url>` | Proxies external server, injects bridge, full Tools UI |
