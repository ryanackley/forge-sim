# forge-sim Roadmap

## Architecture Overview

```
┌─────────────────────────────────────────┐
│           Command Center (:3001)         │
│  ┌─────┬──────┬──────┬──────┬────────┐  │
│  │ UI  │State │Events│ Auth │  Logs  │  │
│  │Picker│     │      │      │        │  │
│  └─────┴──────┴──────┴──────┴────────┘  │
├─────────────────────────────────────────┤
│           App Preview (:3000)            │
│         (Vite + Atlaskit render)         │
├─────────────────────────────────────────┤
│              forge-sim core              │
│  ┌─────┬─────┬─────┬──────┬─────────┐  │
│  │ KVS │ SQL │Queue│ProdAPI│Realtime │  │
│  │     │     │     │mock/real│       │  │
│  └─────┴─────┴─────┴──────┴─────────┘  │
│         .forge-sim/ (persistent)         │
│    credentials │ state │ config          │
└─────────────────────────────────────────┘
```

---

## Priority 1: Command Center

A browser-based dev tools UI for forge-sim. Think "Forge DevTools" — like Chrome DevTools but for your Forge app's backend.

### Overview
- Runs on a separate port (`:3001`) alongside the app preview (`:3000`)
- Backend is the existing MCP tools repackaged as REST/WebSocket API
- Frontend: React + Atlaskit (for the irony 😏)

### Panels

**UI Picker**
- Lists all extension points from the manifest (jira:issuePanel, jira:globalPage, etc.)
- Click to load that module's UI in the preview pane
- Requires deployer changes: track available UI modules without auto-rendering all of them

**State Inspector**
- KVS browser: browse keys, edit values, search
- SQL query runner: execute arbitrary SQL, browse tables/schema
- Entity Store: browse entities by partition, inspect indexes
- Queue state: view pending/completed jobs, stats

**Event Simulator**
- Fire product event triggers from a dropdown (avi:jira:created:issue, etc.)
- JSON editor for event payload
- Fire scheduled triggers with response validation (424 on bad format)
- Push to queues manually
- See consumer execution results

**Logs**
- Real-time console capture stream (WebSocket)
- Filter by level (log, warn, error, invoke, trigger, etc.)
- Clickable stack traces

**Auth** (see Priority 3)
- Connect to Atlassian site
- Manage credentials
- OAuth flow for external services

### Implementation Notes
- Backend: Express/Hono server exposing REST endpoints that mirror MCP tools
- WebSocket for real-time log streaming and state change notifications
- Frontend: Standard React SPA with Atlaskit components
- Trickiest part: multi-extension-point UI switching (mount/unmount different modules on demand)
- Estimated effort: 2-3 days for MVP

---

## Priority 2: Persistent State

Save simulator state on shutdown, restore on startup. No more losing data between restarts.

### What Gets Persisted

| Store | Format | Method |
|---|---|---|
| KVS | JSON | `kvs.dump()` → file → `kvs.restore()` |
| Entity Store | JSON | `entityStore.dump()` → file → restore |
| SQL | MySQL dump | `mysqldump` → file → `mysql < dump` |
| Queues | Skip | Transient by nature — stale jobs on restart would be confusing |

### Directory Structure

```
.forge-sim/
├── credentials.json     # API tokens (0600 perms)
├── state/
│   ├── kvs.json         # KVS dump
│   ├── entities.json    # Entity store dump
│   └── sql.dump         # MySQL dump
└── config.json          # Site URL, preferences, etc.
```

### API

```ts
// On shutdown (SIGINT handler or explicit stop())
await sim.saveState('.forge-sim/state');

// On startup (after SQL server is ready)
await sim.loadState('.forge-sim/state');
```

### Implementation Notes
- KVS/Entity Store: trivial — JSON.stringify/parse
- SQL: shell out to `mysqldump`/`mysql` against the embedded MySQL port
- Hook into process lifecycle: SIGINT handler in dev server, graceful shutdown
- Flag to opt out: `forge-sim dev --no-persist` or `forge-sim dev --clean`
- Estimated effort: half a day

---

## Priority 3: Credentials + Real API Calls

Make `requestJira()`, `requestConfluence()`, etc. hit real Atlassian APIs instead of mocks. This turns forge-sim from a mock environment into a real development proxy.

### Phase 1: API Tokens (PAT)

- Prompt for Atlassian email + API token
- Store in `.forge-sim/credentials.json` (file mode 0600)
- `product-api.ts` gains a "real mode" that proxies to `https://{site}.atlassian.net`
- Basic auth: `Authorization: Basic base64(email:token)`
- Config: `sim.useRealApis({ site: 'mysite.atlassian.net' })`
- In the command center: "Connect to Atlassian" panel

**Limitations:** PATs use the user's permissions, not scoped app permissions. Fine for development.

### Phase 2: OAuth 2.0 (3LO)

- Register a dev OAuth app on developer.atlassian.com
- Full OAuth dance through the command center UI
- Scoped to app permissions (more correct)
- Matches what `forge tunnel` does

### External OAuth (for `authorize` / `requestRemote`)

- Command center HTTP server adds `/oauth/callback` route
- Pop open browser for the OAuth flow
- Capture token, store alongside other credentials
- Standard pattern — every dev tool that does OAuth works this way

### Implementation Notes
- Proxy layer in product-api.ts: `fetch(realUrl, { headers: { Authorization: ... } })`
- Credential storage: simple JSON file with fs permissions
- UX: command center panel for site configuration
- Estimated effort: 1 day for PAT, 2-3 days for full OAuth

---

## Priority 4: Web Triggers

Add HTTP endpoints for web trigger modules. Simple hole to fill.

### How It Works
1. Parse `webTrigger` modules from manifest
2. Register routes on the dev server: `POST /x/{installationId}/{triggerKey}`
3. On request, call `handler(request, context)` with:
   - request: `{ method, path, headers, body, queryParameters }`
   - context: standard context object
4. Return handler's `{ statusCode, headers, body }` as HTTP response

### Implementation Notes
- Reuse existing dev server HTTP server, add route prefix
- Function registry already supports `webTrigger` type
- Could integrate into command center as a "Test Web Trigger" panel
- Estimated effort: half a day

---

## Priority 5: Forge Realtime

Real-time pub/sub channels (currently Preview, targeting GA).

### What It Is
- Frontend: `subscribe(channel, callback)` and `publish(channel, data)` via `@forge/bridge`
- Backend: `publish(channel, data)` and `publishGlobal(channel, data)` via `@forge/realtime`
- Channels scoped to module context by default (same module, same issue/page)
- Backend can only publish, not subscribe
- Transport: WebSocket

### Implementation Plan

**Phase 1: In-memory pub/sub + shims**
- `@forge/realtime` shim: `publish()` / `publishGlobal()` → in-memory event bus
- `@forge/bridge` realtime shim: `subscribe()` / `publish()` → same bus
- Channel scoping logic (module key + install context)
- Inspectable via MCP tool and command center

**Phase 2: WebSocket transport**
- For browser mode: real WebSocket connection between Vite app and sim
- Dev server manages channel subscriptions per connected client
- Enables multi-window/multi-user testing

### Implementation Notes
- The in-memory bus is straightforward (EventEmitter or custom)
- Channel scoping is the fiddly part — needs context awareness
- Wait for GA before investing heavily (API may shift)
- Command center integration: "Realtime" tab showing live channel activity
- Estimated effort: 1-2 days for Phase 1, 2-3 days for Phase 2
