# Forge Sim Tools (Dev UI)

Built-in developer tools available at `http://localhost:5173/__tools/` when running `forge-sim dev`.

## Panels

### Logs
Real-time log viewer for both simulator and app output. Filter by level:
- **info** — general simulator messages
- **invoke** — resolver invocations
- **trigger** — event/scheduled trigger firings
- **warn/error** — warnings and errors
- **console** — captured `console.log/warn/error` from your app code

Logs stream over WebSocket — no polling.

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
- **Product triggers** — select from manifest-defined triggers, provide JSON payload. 141 built-in event templates auto-fill sample payloads for Confluence, Jira, Jira Software, and App Lifecycle events.
- **Scheduled triggers** — one-click "Fire Now" for each scheduled trigger
- **Queue push** — select a queue, provide event body

### TypeScript
Real-time TypeScript type checking panel:
- Integrated `tsc --watch` — shows type errors as you edit
- Errors update live via WebSocket

## WebSocket API

Connect to `ws://localhost:5173/__tools/ws` for live updates.

### Server → Client Events

```typescript
// Initial state on connect
{ type: 'init', data: { manifest: {...}, functionCount: N } }

// Live log entries
{ type: 'log', data: { timestamp, level, message, data? } }

// State change notifications
{ type: 'stateChange', changeType: 'kvs' | 'deploy' | ..., data?: any }
```

## HTTP API

All endpoints are under `/__tools/api/`:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/manifest` | Deployed app manifest |
| GET | `/api/functions` | Registered functions |
| GET | `/api/kvs` | List all KVS entries |
| GET | `/api/kvs/:key` | Get a KVS value |
| PUT | `/api/kvs/:key` | Set a KVS value |
| DELETE | `/api/kvs/:key` | Delete a KVS entry |
| GET | `/api/sql/tables` | List SQL tables |
| POST | `/api/sql/query` | Execute a SQL query |
| GET | `/api/sql/schema` | Full schema dump |
| GET | `/api/queues` | Queue statistics |
| POST | `/api/queue/push` | Push an event to a queue |
| GET | `/api/logs` | All simulator logs |
| GET | `/api/logs/console` | Captured console output only |
| POST | `/api/invoke` | Invoke a resolver function |
| POST | `/api/trigger` | Fire a product event trigger |
| POST | `/api/scheduled-trigger` | Fire a scheduled trigger |
| POST | `/api/deploy` | Deploy a Forge app |
| POST | `/api/reset` | Reset all simulator state |
| GET | `/api/health` | Health check |
| GET | `/api/ui/state` | Current ForgeDoc UI tree |
| POST | `/api/ui/render` | Render a UI module |
