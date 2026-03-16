# CLAUDE.md — forge-sim

## Core Principle

> **If it works in forge-sim, it should work in Forge. If it wouldn't work in Forge, it shouldn't work in forge-sim.**

This is the foundational ethos. forge-sim is not a loose approximation — it's a faithful simulation. When we make design decisions, validate inputs, resolve endpoints, or handle errors, we match Forge's real behavior. Silently succeeding where Forge would fail is a bug. Throwing where Forge would succeed is also a bug. The goal is **behavioral parity**: developers can trust that passing forge-sim means passing production.

## What is this?

Simulated Atlassian Forge runtime for AI-driven development and testing. An AI agent (or human) can deploy a Forge app into the sim, invoke resolvers, interact with UIKit components, run SQL queries against real MySQL, manipulate Custom Entities, and validate behavior — all without deploying to Atlassian.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      ForgeSimulator                           │
│  (orchestrator — ties everything together)                    │
├──────────┬──────────┬──────────┬──────────┬─────────────────┤
│ KVS      │ Queue    │ Resolver │ Forge SQL│ Product API      │
│ storage  │ events   │ handlers │ MySQL 8.4│ Jira/Conf/BB     │
│ secrets  │ consumers│ invoke() │ migration│ mockable routes  │
│ query    │ semaphore│          │ DDL/DML  │                  │
│ transact │ concurr. │          │          │                  │
├──────────┴──────────┴──────────┴──────────┴─────────────────┤
│                    Entity Store                               │
│  (typed entities, indexes, partition/range queries,           │
│   filters AND/OR, sort, pagination, TTL, batch, transactions) │
└──────────────────────────────────────────────────────────────┘
         ▲                ▲                ▲
         │                │                │
    @forge/* shims    Bridge          global.__forge_fetch__
    (loader hooks)    (callBridge)    (SQL + KVS bridge)
         ▲                ▲                ▲
         │                │                │
    Backend code      UIKit frontend   @forge/sql + @forge/kvs
    (resolvers,       (@forge/react →  (real CJS packages via
     consumers)        ForgeDoc tree)   global bridge)
```

## Key Modules

### Core
- **src/simulator.ts** — `ForgeSimulator` orchestrator, main entry point. Exposes `kvs`, `queue`, `resolver`, `sql`, `entityStore`.
- **src/storage.ts** — `SimulatedKVS` with latency simulation for race detection
- **src/queue.ts** — `SimulatedQueue` with concurrent mode + concurrency semaphores
- **src/resolver.ts** — `SimulatedResolver` for backend handler functions
- **src/product-api.ts** — Mockable Jira/Confluence/Bitbucket API responses
- **src/manifest.ts** — YAML manifest parser (functions, consumers, triggers, resources, entities)
- **src/deployer.ts** — Manifest-driven app loading (one-call deploy)
- **src/console-capture.ts** — Intercepts console.* during handler execution

### Data Stores
- **src/forge-sql.ts** — `SimulatedForgeSQL` — Real ephemeral MySQL 8.4 via `mysql-memory-server`. Routes `__fetchProduct({ type: 'sql' })` to MySQL pool. Supports migrations, parameterized queries, DDL, raw SQL.
- **src/entity-store.ts** — `SimulatedEntityStore` — In-memory backend for `@forge/kvs` entity API. Handles all `/api/v1/*` KVS endpoints: entity CRUD, plain KVS, secrets, batch, transactions. Full query engine with index-based partition/range lookups, filter conditions (BETWEEN, BEGINS_WITH, CONTAINS, EXISTS, EQUAL_TO, etc.), AND/OR operators, sort, cursor pagination, TTL.

### Shims
- **src/shims/** — Drop-in replacements for `@forge/api`, `@forge/kvs`, `@forge/events`, `@forge/resolver`, `@forge/react`, `@forge/bridge`
- **src/shims/globals.ts** — Installs `global.__forge_fetch__` and `global.__forge_runtime__` bridges. This is the critical wiring that lets real `@forge/sql` and `@forge/kvs` CJS packages route through our simulator.
- **src/loader/** — Node.js `--import` hooks that intercept `@forge/*` imports → shims

### UI
- **src/ui/bridge.ts** — Forge bridge connecting `@forge/react` reconciler to simulator
- **src/ui/doc-utils.ts** — ForgeDoc tree query/interaction utilities

### MCP
- **src/mcp-server.ts** — MCP server with 20 tools + 4 resources (stdio + HTTP)

## How Deploy Works

```ts
const sim = new ForgeSimulator();
setSimulator(sim);
sim.mockProductRoutes('jira', { ... });

// One call — reads manifest.yml, imports all handlers and UI resources
await sim.deploy('./my-forge-app');

// Now you can invoke resolvers, inspect KVS, check the ForgeDoc tree
await sim.invoke('getIssue', { issueKey: 'TEST-1' });
```

The deployer:
1. Parses `manifest.yml`
2. Resolves handler strings (e.g. `index.handler` → `src/index.js` export `handler`)
3. Dynamically imports each function module
4. Wires up resolvers, queue consumers, and triggers
5. If UI resources exist: installs bridge, connects to sim, loads resource files
6. If entity definitions exist: registers schemas with `entityStore.registerEntitySchema()`
7. App code runs **completely unmodified** — `@forge/*` imports are intercepted by loader hooks

## The `global.__forge_fetch__` Bridge

This is the key integration point for Forge SQL and Custom Entity Store. Real `@forge/sql` and `@forge/kvs` CJS packages call `global.__forge_fetch__()` internally. We intercept these:

- `{ type: 'sql' }` → routes to `SimulatedForgeSQL` → real MySQL
- `{ type: 'kvs' }` → routes to `SimulatedEntityStore` → in-memory store

Installed in `setSimulator()` via `src/shims/globals.ts`. Also installs `global.__forge_runtime__` stub for metrics.

Response objects must have `.json()`, `.text()`, `.ok`, `.status`, and `headers.get()` methods (Web API compat) for real `@forge/api` CJS package compatibility.

## @forge/* Shim Layer

The shim modules match the real package export surfaces. In tests, vitest aliases handle the mapping. For standalone execution, use Node loader hooks:

```bash
node --import ./dist/loader/register.js app.js
```

## Forge SQL Details

- Uses `mysql-memory-server` for real ephemeral MySQL 8.4.x instances
- System dependency: `libaio1t64` on Ubuntu (plus symlink `libaio.so.1` → `libaio.so.1t64` + `ldconfig`)
- `pool.query()` for parameterless SQL (prepared statements don't support `START TRANSACTION`)
- E2E chain: `@forge/sql` (real) → `@forge/api` (real CJS) → `global.__forge_fetch__` → MySQL
- `migrationRunner`, `sql.prepare().bindParams().execute()`, `executeRaw` all working

## Custom Entity Store Details

- `@forge/kvs` calls `global.__forge_fetch__({ type: 'kvs' })` — same bridge pattern as SQL
- REST endpoints: `/api/v1/entity/get`, `/set`, `/delete`, `/query` + plain KVS + secrets + batch + transactions
- Query: `{ entityName, indexName, partition, range, filters, filterOperator, sort, cursor, limit }`
- Filter conditions: BETWEEN, BEGINS_WITH, EXISTS, NOT_EXISTS, GREATER_THAN, LESS_THAN, CONTAINS, EQUAL_TO
- Entity schemas registered from manifest via `registerEntitySchema()`
- Key policies: FAIL_IF_EXISTS, OVERRIDE with returnValue (PREVIOUS/LATEST)
- TTL support with computed expireTime

## Concurrent Queue Processing

Two modes controlled by `SimulationConfig.queueMode`:

- **`sequential`** (default): Fast, deterministic, no races
- **`concurrent`**: Events run in parallel, exposes race conditions

With concurrent mode + `storageLatency: true`:
- Naive `get → modify → set` patterns will race (lost updates)
- `kvs.transact()` is atomic (per-key lock chain) — the correct pattern
- Concurrency keys act as named semaphores across queues (per Forge spec)

## React useEffect Teardown

- `sim.reset()` calls `resetBridge()` first
- Bridge returns forever-pending promise for stale invoke calls after teardown
- Prevents unhandled rejection that made vitest exit code 1
- `connectSimulator()` clears torn-down flag

## Testing

```bash
npm test          # 100 tests across 12 files
npm run build     # TypeScript compile
```

Test files:
- `__tests__/storage.test.ts` — KVS operations, secrets, query, batch, transact
- `__tests__/queue.test.ts` — Queue push/consume, stats, limits
- `__tests__/simulator.test.ts` — Orchestrator integration
- `__tests__/shims.test.ts` — @forge/* shim layer + full integration flow
- `__tests__/deployer.test.ts` — Manifest-driven deploy
- `__tests__/ui-integration.test.ts` — UIKit → bridge → simulator
- `__tests__/concurrency.test.ts` — Race detection, semaphores, transact safety
- `__tests__/mcp-server.test.ts` — MCP server integration (deploy → invoke → state)
- `__tests__/forge-sql.test.ts` — SQL simulation unit tests
- `__tests__/forge-sql-e2e.test.ts` — E2E: real @forge/sql → global bridge → MySQL
- `__tests__/entity-store.test.ts` — Entity store unit tests (CRUD, queries, filters, TTL)
- `__tests__/entity-store-e2e.test.ts` — E2E: real @forge/kvs → global bridge → entity store

## MCP Server

The MCP server (`src/mcp-server.ts`) exposes the simulator over stdio or HTTP transport.

```bash
# stdio (default)
node --import ./dist/loader/register.js dist/mcp-server.js

# HTTP (persistent state across calls)
node --import ./dist/loader/register.js dist/mcp-server.js --http --port=3100
```

**Important:** The `--import ./dist/loader/register.js` flag is required so that deployed apps can resolve `@forge/*` imports through our shims.

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

### Console Capture

Forge apps log via `console.*`. The simulator intercepts all console.log/warn/error/info/debug calls during handler execution and captures them in the log stream. They appear in `forge.logs` output and are also returned inline with `forge.invoke` results.

### Product API Mocking

Mock routes use method+path tuple keys. Method defaults to GET if omitted:

```ts
sim.mockProductRoutes('jira', {
  'GET /rest/api/3/issue/TEST-1': { key: 'TEST-1', fields: { summary: 'Test' } },
  'POST /rest/api/3/issue': (path, options) => ({ id: '10002', key: 'TEST-2' }),
  '/rest/api/3/myself': { accountId: 'user-1' },  // defaults to GET
});
```

## What's NOT Built Yet

- **Scheduled trigger execution** (manifest parses them, no timer fires them)
- **Web trigger modules** (HTTP endpoint simulation)
- **Auth context / permissions simulation**
- **ForgeDoc visual renderer** (rendering the UIKit tree to HTML)

## Forge Platform Quirks to Know

- Handler format: `file.export` — file relative to `src/`, dot-separated export name
- Resources are top-level in manifest (not under modules)
- Concurrency keys scoped to installation, NOT to a specific queue
- Publisher sets concurrency on events, not subscriber (unusual but per spec)
- KVS uses `@forge/kvs` (new) — `@forge/api` storage is legacy
- Forge SQL is MySQL-compatible (TiDB backend in prod), accessed via `@forge/sql` → `__fetchProduct()`
- Custom Entity Store uses `@forge/kvs .entity()` API — separate from plain KVS
- Both SQL and Entity Store route through `global.__forge_fetch__` — same bridge pattern
- Function timeout: 25s default, 55s for resolvers, up to 900s for consumers
- Queue limits: 50 events/push, 200KB payload, 15min max delay
