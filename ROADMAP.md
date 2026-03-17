# forge-sim Roadmap

> **If it works in forge-sim, it should work in Forge. If it wouldn't work in Forge, it shouldn't work in forge-sim.**

## Architecture Overview

```
┌──────────────────────────────────────────────┐
│            Forge Sim Tools (/__tools/)         │
│  ┌─────┬──────┬──────┬──────┬────────┐       │
│  │ UI  │State │Events│ Auth │  Logs  │       │
│  │Picker│     │      │      │        │       │
│  └─────┴──────┴──────┴──────┴────────┘       │
├──────────────────────────────────────────────┤
│  App Preview (:5173)      │  Proxy Mode       │
│  Vite + Atlaskit render   │  --proxy <url>    │
│  UIKit 2 / Custom UI      │  Any bundler      │
├──────────────────────────────────────────────┤
│         Bridge RPC (:5174 WebSocket)          │
├──────────────────────────────────────────────┤
│              forge-sim core                    │
│  ┌─────┬─────┬─────┬──────┬────────┬──────┐ │
│  │ KVS │ SQL │Queue│Remote│ProdAPI │ FIT  │ │
│  │     │     │     │Proxy │mock/real│ JWT  │ │
│  └─────┴─────┴─────┴──────┴────────┴──────┘ │
│  ┌──────────┬────────────┬─────────────────┐ │
│  │ Entity   │ Module     │ Function        │ │
│  │ Store    │ Routing    │ Registry        │ │
│  └──────────┴────────────┴─────────────────┘ │
│         .forge-sim/ (persistent)              │
│    credentials │ state │ config               │
└──────────────────────────────────────────────┘
```

---

## ✅ Completed

### Forge Sim Tools (MVP)
- Browser-based dev tools at `/__tools/` — KVS browser, SQL runner, log streaming, event firing
- Served as Vite middleware (same port as app preview) or proxy middleware
- 15+ REST endpoints, WebSocket real-time log streaming

### Persistent State
- KVS + Entity Store saved as JSON, SQL via mysqldump
- Auto-save on SIGINT, auto-restore on startup
- `--clean` flag to start fresh
- Directory: `.forge-sim/state/`

### Credentials + Real API Calls
- PAT (Basic auth) and OAuth 2.0 (3LO) support
- `forge-sim auth` CLI for account management
- Real API proxy: mock routes take priority, real API as fallback
- Token refresh for OAuth accounts
- Storage: `.forge-sim/credentials.json`

### Universal Dev Server Proxy
- `forge-sim dev --proxy http://localhost:3000` — works with any bundler
- HTTP reverse proxy injects bridge shim into HTML responses
- WebSocket passthrough for upstream HMR
- Module key baked into bridge script for endpoint resolution
- Single-endpoint auto-resolve when module context is unavailable
- Zero config for the developer — no bundler plugins needed
- **Full proposal:** [proposals/universal-dev-server-proxy.md](proposals/universal-dev-server-proxy.md)

### Forge Remotes
- `invokeRemote` / `requestRemote` / `invokeService` — full bridge support
- FIT (Forge Invocation Token) — local RSA key pairs, JWT signing, JWKS endpoint
- Endpoint resolution from manifest (module → endpoint → remote → baseUrl)
- Module routing with resolver boundary enforcement
- Mock-first with real HTTP fallback

### UIKit 2 Renderer
- 73/73 UIKit 2 components mapped to real Atlaskit
- ForgeDoc → Atlaskit component rendering
- Dual-mode: Browser (CDT debuggable) + Server (MCP/AI-driven)
- Live preview via WebSocket dev server
- Vite plugin for one-line setup

### Custom UI Support
- Auto-detects Custom UI apps from manifest
- Serves resource directory via Vite or proxies external dev server
- `@forge/bridge` shim injection (inline script or Vite alias)
- `invoke()`, `view.getContext()`, `requestJira()` all routed through simulator

---

## Current Priorities

### 1. General Hardening ⬅️ NOW
Make forge-sim bulletproof. Testing, error handling, parity, performance, docs.

**Full plan:** [proposals/general-hardening.md](proposals/general-hardening.md)

Five areas, ~74 items:
1. **Testing gaps** — renderer integration tests, e2e dev server tests, negative case testing (verify clear errors when the app would break in real Forge), manifest edge cases
2. **Error handling & DX** — silent error audit, structured error messages, `--verbose` flag
3. **Behavioral parity audit** — bridge commands, context object, response formats
4. **Performance & reliability** — MySQL race, file watcher debounce, port conflicts, memory leaks
5. **Documentation** — README overhaul, `--help`, examples, troubleshooting guide

### 2. Web Triggers
HTTP endpoints for `webTrigger` modules.

1. Parse webTrigger modules from manifest
2. Register routes: `POST /x/{installationId}/{triggerKey}`
3. Call `handler(request, context)` with standard Forge web trigger contract
4. Return `{ statusCode, headers, body }` as HTTP response

**Effort:** Half a day

### 3. NPM Publishing
Make forge-sim installable via `npx forge-sim dev`.

- Package name `forge-sim` is available on NPM
- Add `files`, `exports`, `keywords`, `license`, `repository` to package.json
- `--inspect` flag for Node debugger attachment
- Generate `.vscode/launch.json` template

**Effort:** Half a day

### 4. Forge Realtime
Real-time pub/sub channels (Forge Preview feature — wait for GA).

**Phase 1:** In-memory pub/sub + `@forge/realtime` shim
**Phase 2:** WebSocket transport for multi-window testing

**Effort:** 2-4 days (defer until GA)

---

## Test Suite
- **670 tests**, 38 test files, all passing
- Coverage: simulator core, remotes, module routing, bridge invoke routing, proxy server, modal bridge, multi-module routing, deployer, manifest parser, KVS, SQL, queues, entity store, product API

---

## Three Modes

| Scenario | Command | What Happens |
|----------|---------|--------------|
| UIKit app | `forge-sim dev` | Vite renders Atlaskit components from ForgeDoc |
| Custom UI (simple) | `forge-sim dev` | Vite serves resource directory, injects bridge |
| Custom UI (own dev server) | `forge-sim dev --proxy <url>` | Proxies external server, injects bridge |
