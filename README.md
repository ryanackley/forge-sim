# forge-sim

Simulated Forge runtime for AI-driven development and testing of Atlassian Forge apps.

## What This Does

Provides a full simulation of the Forge platform so you can develop, test, and iterate on Forge apps **without deploying to Atlassian**. Deploy an app with one call — manifest-driven, zero app modifications.

## Features

- **Full @forge/* shim layer** — App code imports `@forge/api`, `@forge/kvs`, `@forge/events`, `@forge/resolver`, `@forge/sql` and gets our sim. Zero changes needed.
- **Manifest-driven deploy** — Point at an app directory, everything gets wired up automatically
- **UIKit rendering** — `@forge/react` apps render through a simulated bridge connected to the backend
- **Forge SQL** — Real ephemeral MySQL 8.4 via `mysql-memory-server`. Migrations, parameterized queries, full DDL.
- **Custom Entity Store** — In-memory `@forge/kvs` entity backend with typed attributes, indexes, partition/range queries, filters, TTL, batch ops, transactions
- **Concurrent queue processing** — Expose real race conditions in consumer code
- **Concurrency keys** — Named semaphores across queues (per Forge spec)
- **Mockable product APIs** — Route-based mocks for Jira, Confluence, Bitbucket
- **MCP server** — 20 tools + 4 resources for AI agent integration (stdio + HTTP)

## Quick Start

```typescript
import { ForgeSimulator, setSimulator } from 'forge-sim';

const sim = new ForgeSimulator();
setSimulator(sim);

// Mock the Jira API
sim.mockProductRoutes('jira', {
  '/rest/api/3/issue/PROJ-1': { key: 'PROJ-1', summary: 'My Issue' },
});

// Deploy your app — reads manifest.yml, imports handlers, wires up UI
const result = await sim.deploy('./my-forge-app');

// Invoke resolvers
const data = await sim.invoke('getIssue', { issueKey: 'PROJ-1' });

// Inspect state
console.log(await sim.kvs.get('views:PROJ-1'));
console.log(sim.getLogs());
```

Run with loader hooks for standalone execution:
```bash
node --import forge-sim/dist/loader/register.js your-app.js
```

## Race Condition Detection

```typescript
const sim = new ForgeSimulator({
  queueMode: 'concurrent',    // process events in parallel
  storageLatency: true,        // simulate async KVS to expose interleaving
});

// This BREAKS — naive get→set loses updates under concurrency:
sim.registerConsumer('work', async () => {
  const val = await kvs.get('counter');
  await kvs.set('counter', val + 1);  // race!
});

// This WORKS — transact is atomic:
sim.registerConsumer('work', async () => {
  await kvs.transact('counter', (val) => (val ?? 0) + 1);
});
```

## What's Simulated

| Feature | Status |
|---|---|
| Key-Value Storage (`@forge/kvs`) | ✅ Full (get/set/delete/query/batch/transact/secrets) |
| Custom Entity Store (`@forge/kvs` entities) | ✅ Full (CRUD, index queries, filters, sort, pagination, TTL, batch, transactions) |
| Forge SQL (`@forge/sql`) | ✅ Full (real MySQL 8.4, migrations, DDL, parameterized queries) |
| Resolvers (`@forge/resolver`) | ✅ Full |
| Async Events / Queues (`@forge/events`) | ✅ Full (concurrent mode, concurrency keys) |
| Product APIs (Jira/Confluence/Bitbucket) | ✅ Mockable |
| UIKit 2 Rendering (`@forge/react`) | ✅ Bridge connected to sim |
| Manifest Parsing + Auto-Deploy | ✅ Full |
| Event Triggers | ✅ Basic |
| MCP Server | ✅ 20 tools, 4 resources (stdio + HTTP) |
| Scheduled Triggers | 🔜 Planned |
| Web Triggers | 🔜 Planned |

## MCP Server

Expose the simulator to AI agents via Model Context Protocol.

```bash
# stdio
node --import ./dist/loader/register.js dist/mcp-server.js

# HTTP (persistent state across calls)
node --import ./dist/loader/register.js dist/mcp-server.js --http --port=3100
```

### Tools (20)

| Tool | Description |
|------|-------------|
| `forge.deploy` | Deploy a Forge app from a directory (reads manifest.yml) |
| `forge.invoke` | Call a resolver function with payload |
| `forge.fire_trigger` | Simulate product event triggers |
| `forge.ui_state` | Get the current ForgeDoc UI tree |
| `forge.ui_interact` | Click buttons, submit forms, interact with UI |
| `forge.kvs_get` | Get a KVS value by key |
| `forge.kvs_list` | List/dump KVS contents (optional prefix filter) |
| `forge.kvs_set` | Set a KVS value (for test setup) |
| `forge.queue_push` | Push events to a queue |
| `forge.queue_state` | Inspect queue jobs and event log |
| `forge.logs` | Get simulator + captured console.* logs |
| `forge.sql_execute` | Execute SQL queries (real MySQL) |
| `forge.sql_migrate` | Run idempotent database migrations |
| `forge.sql_schema` | Inspect database schema (tables, columns, indexes) |
| `forge.entity_get` | Get a Custom Entity by name + key |
| `forge.entity_set` | Create/update a Custom Entity (key policies, TTL) |
| `forge.entity_delete` | Delete a Custom Entity |
| `forge.entity_query` | Query entities with indexes, filters, sort, pagination |
| `forge.entity_list` | List all entities and schemas |
| `forge.reset` | Clear all state |

### Resources (4)

| URI | Description |
|-----|-------------|
| `forge://manifest` | Current deployed manifest |
| `forge://functions` | Registered resolver functions |
| `forge://triggers` | Registered triggers and events |
| `forge://state` | Full state snapshot (KVS + queue + UI) |

## Development

```bash
npm install
npm test          # 100 tests across 12 test files
npm run build     # TypeScript compile
```

## License

Private — not yet published.
