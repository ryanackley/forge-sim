# Forge Sim Tools (Dev UI)

Built-in developer tools available at `http://localhost:5173/__tools/` when running `forge-sim dev`.

The tools API, the daemon API and both WebSockets bind to `127.0.0.1` and answer a browser only when the page's `Origin` is `localhost`, `127.0.0.1` or `::1` (any port). Any other origin gets `403` before a handler runs, and WebSocket handshakes from it are refused. Requests with no `Origin` (curl, the CLI, MCP clients) pass. Nothing is ever answered with `Access-Control-Allow-Origin: *`.

## Panels

### Logs
Real-time log viewer for both simulator and app output. Filter by level:
- **info** — general simulator messages
- **invoke** — resolver invocations
- **trigger** — event/scheduled trigger firings
- **warn/error** — warnings and errors
- **console** — captured `console.log/warn/error` from your app code

Logs stream over WebSocket. No polling.

### KVS
Browse, search, and edit Key-Value Storage entries:
- Search by key prefix
- View values inline (JSON-formatted)
- Type indicators (string, number, object, array)
- Auto-refreshes on tab switch

### SQL
Interactive SQL console:
- Table sidebar — click to `SELECT * FROM <table>`
- Query editor with `Ctrl+Enter` to execute
- Schema inspector (`DESCRIBE <table>`)
- Results displayed as a table

### Events
Fire triggers and push queue events:
- **Product triggers** — select from manifest-defined triggers, provide JSON payload. 143 built-in event templates auto-fill sample payloads for Confluence, Jira, Jira Software, and App Lifecycle events.
- **Scheduled triggers** — one-click "Fire Now" for each scheduled trigger
- **Queue push** — select a queue, provide event body

### Providers
Manage external OAuth provider credentials (Google, GitHub, Slack, …):
- One row per `providers.auth` entry from your manifest
- Status badge (✓ Connected / ✗ Disconnected) + connected-account display name
- **Connect** opens a popup OAuth flow that bounces through the unified
  callback URL (`/__tools/oauth/callback`) and auto-closes on success
- **Disconnect** revokes the stored token (in-memory + on-disk)
- Updates live via WebSocket: connecting in the popup auto-refreshes
  the panel without a manual reload
- The provider must have a client secret set first (via
  `forge-sim auth --provider <key> --secret`); rows without a secret
  show a warning and the Connect button is disabled

### TypeScript
Real-time TypeScript type checking panel:
- Integrated `tsc --watch` — shows type errors as you edit
- Errors update live via WebSocket
- Works for plain-JS apps too (via a synthetic `checkJs` config). Type-strictness
  diagnostics that can only be fixed with JSDoc annotations (property access /
  iteration on library union types: TS2339, TS2488, TS2349) are suppressed for
  apps without their own `tsconfig.json`; add a `tsconfig.json` to opt in to the
  full check. Real errors (missing modules, wrong argument types, typo
  suggestions) are always reported.

## WebSocket API

Connect to `ws://localhost:5173/__tools/ws` for live updates.

### Server → Client Events

```typescript no-check
// Initial state on connect
{ type: 'init', data: { manifest: {...}, functionCount: N } }

// Live log entries
{ type: 'log', data: { timestamp, level, message, data? } }

// State change notifications
// changeType values include: 'kvs', 'deploy', 'providerConnected',
// 'providerDisconnected', ...
{ type: 'stateChange', changeType: string, data?: any }
```

## HTTP API

All endpoints are under `/__tools/api/`. Request bodies are JSON; responses are JSON. Field names are the **same as the equivalent MCP tool's** (`triggerKey`, `queueKey`, `events`, …) — one vocabulary across both surfaces, so anything written against `forge_*` tool schemas works here verbatim. Pre-unification names (`key` for triggers, `queue`/`body` for queue push) remain accepted as legacy aliases.

| Method | Path | Request body | Response / notes |
|--------|------|--------------|------------------|
| GET | `/api/manifest` | — | Deployed app manifest summary |
| GET | `/api/functions` | — | `{ registered: [{key, type}], resolverDefinitions }` |
| GET | `/api/kvs?prefix=` | — | `[{ key, value }]` |
| GET | `/api/kvs/:key` | — | `{ key, value }`; 404 if absent |
| PUT | `/api/kvs/:key` | `{ "value": <data> }` — the stored value rides in a `value` wrapper; a raw body is a 400 with this hint | `{ success, key }` |
| DELETE | `/api/kvs/:key` | — | `{ success, key }` |
| GET | `/api/sql/tables` | — | `{ tables: [...] }` |
| POST | `/api/sql/query` | `{ "query": "SELECT ..." }` | `{ rows, rowCount }`; SQL errors are 400 |
| GET | `/api/sql/schema` | — | `{ <table>: [columns...] }` |
| GET | `/api/queues` | — | Queue statistics |
| POST | `/api/queue/push` | `{ "queueKey": "<key>", "events": [{ "body": {...}, "delayInSeconds"? }] }` — same shape as real `@forge/events` `push()` (legacy `{ "queue", "body" }` single-event form also accepted) | `{ jobId }` |
| GET | `/api/logs` | — | All simulator logs |
| GET | `/api/logs/console` | — | Captured console output only |
| POST | `/api/invoke` | `{ "functionKey": "<key>", "payload"?: {...}, "moduleKey"?, "context"?, "actionKey"? }` | `{ success, result }` |
| POST | `/api/trigger` | `{ "event": "avi:...", "data"?: {...} }` | `{ event, triggersMatched, results }` |
| POST | `/api/scheduled-trigger` | `{ "triggerKey": "<trigger key>" }` (legacy `key` also accepted) | `{ statusCode }` — 204 on completion; 500 + `error` if the handler threw |
| POST | `/api/webtrigger` | `{ "triggerKey": "<trigger key>", "method"?, "userPath"?, "headers"?, "queryParameters"?, "body"? }` (legacy `key` also accepted) | The Forge `{ statusCode, headers, body }` response; handler errors come back as 5xx *inside* it |
| POST | `/api/deploy` | `{ "appDir": "<path>", "reset"?: true, "connect"?: boolean }` (a non-boolean `connect` is a 400) | Deploy summary (`loadedFunctions`, `errors`, `warnings`, …), plus `auth` when the deploy connected and `disconnected` when it unloaded credentials an earlier connect had loaded. Under `forge-sim dev` it connects unless `--offline` or `"connect": false`; on the daemon only with `"connect": true`. Every deploy first unloads what an earlier connect loaded; one that connects reloads stored credentials after deploying (deploy-time triggers run without them). A deploy that throws is a 500 `{ error }` that still reconnects when it connects and carries the same `auth`, `disconnected` and `mockFile` fields |
| POST | `/api/reset` | — | Clears all simulator state and unloads loaded credentials. Under `forge-sim dev` it then re-applies `.forge-sim/mocks.json` (`mockFile` in the response) and, unless `--offline`, reloads stored credentials (`auth`) |
| GET | `/api/health` | — | `{ status, deployed, appName, uptime }` |
| GET | `/api/ui/state` | — | Current ForgeDoc UI tree (headless renders only — see note) |
| POST | `/api/ui/render` | `{ "moduleKey": "<key>", "issueKey"?, "contentId"?, "spaceKey"?, "context"?, "extension"? }` | `{ rendered, tree, context }` (headless renders only — see note) |
| GET | `/api/ui/context?module=` | — | Forge context of the last headless render; 404 before one |
| GET | `/api/entities` | — | `{ schemas, entities }` |
| GET/PUT/DELETE | `/api/entities/:name/:key` | PUT: `{ "value": <entity data> }` | Schema-validated; unknown entity is 404, schema violation is 400 |
| POST | `/api/mock/routes` | `{ "product": "jira", "routes": { "<METHOD /path>": <response> } }` (in-memory; cleared on restart) | `{ success, product, routeCount }` |
| POST | `/api/mock/graphql` | `{ "operations": { "<OperationName>": <response> } }` (in-memory; cleared on restart) | `{ success, operationCount }` |
| GET | `/api/providers` | — | External OAuth providers + connection status |
| POST | `/api/providers/:key/start` | — | `{ authUrl, state, redirectUri }` |
| DELETE | `/api/providers/:key` | — | Disconnect — revoke stored provider token |
| GET | `/__tools/oauth/callback` | — | Unified OAuth callback URL (dispatched to pending flow by `state`) |

> **The `ui/*` endpoints track headless renders, not browser pages.** `POST /api/ui/render` renders a module *in the simulator process* (its own esbuild pass, independent of Vite) and works in `forge-sim dev` as well as the daemon — handy for inspecting a ForgeDoc tree without driving a browser. A module open in a browser tab is a separate render that lives in the browser's own React tree, so it does not populate `/api/ui/state` or `/api/ui/context`; those answer only after a headless render through this API (or `sim.ui.render()` in the same process).

> The Tools UI also accepts `?theme=dark|light|auto` on the URL. See [cli.md](../reference/cli.md#theme-dark--light) for the convention shared with the renderer.
