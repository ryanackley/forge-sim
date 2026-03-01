# CLAUDE.md — forge-sim

## What is this?

Simulated Atlassian Forge runtime for AI-driven development and testing. An AI agent (or human) can deploy a Forge app into the sim, invoke resolvers, interact with UIKit components, and validate behavior — all without deploying to Atlassian.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 ForgeSimulator                    │
│  (orchestrator — ties everything together)        │
├─────────┬──────────┬───────────┬────────────────┤
│ KVS     │ Queue    │ Resolver  │ Product API     │
│ storage │ events   │ handlers  │ Jira/Conf/BB    │
│ secrets │ consumers│ invoke()  │ mockable routes │
│ query   │ semaphore│           │                 │
│ transact│ concurr. │           │                 │
└─────────┴──────────┴───────────┴────────────────┘
         ▲                ▲
         │                │
    @forge/* shims    Bridge (callBridge)
    (loader hooks)    (invoke/fetchProduct)
         ▲                ▲
         │                │
    Backend code      UIKit frontend
    (resolvers,       (@forge/react →
     consumers)        ForgeDoc tree)
```

## Key Modules

- **src/simulator.ts** — `ForgeSimulator` orchestrator, main entry point
- **src/storage.ts** — `SimulatedKVS` with latency simulation for race detection
- **src/queue.ts** — `SimulatedQueue` with concurrent mode + concurrency semaphores
- **src/resolver.ts** — `SimulatedResolver` for backend handler functions
- **src/product-api.ts** — Mockable Jira/Confluence/Bitbucket API responses
- **src/manifest.ts** — YAML manifest parser (functions, consumers, triggers, resources)
- **src/deployer.ts** — Manifest-driven app loading (one-call deploy)
- **src/console-capture.ts** — Intercepts console.* during handler execution
- **src/shims/** — Drop-in replacements for `@forge/api`, `@forge/kvs`, `@forge/events`, `@forge/resolver`, `@forge/react`, `@forge/bridge`
- **src/loader/** — Node.js `--import` hooks that intercept `@forge/*` imports → shims
- **src/ui/bridge.ts** — Forge bridge connecting `@forge/react` reconciler to simulator
- **src/ui/doc-utils.ts** — ForgeDoc tree query/interaction utilities

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
6. App code runs **completely unmodified** — `@forge/*` imports are intercepted by loader hooks

## @forge/* Shim Layer

The shim modules match the real package export surfaces. In tests, vitest aliases handle the mapping. For standalone execution, use Node loader hooks:

```bash
node --import ./dist/loader/register.js app.js
```

## Concurrent Queue Processing

Two modes controlled by `SimulationConfig.queueMode`:

- **`sequential`** (default): Fast, deterministic, no races
- **`concurrent`**: Events run in parallel, exposes race conditions

With concurrent mode + `storageLatency: true`:
- Naive `get → modify → set` patterns will race (lost updates)
- `kvs.transact()` is atomic (per-key lock chain) — the correct pattern
- Concurrency keys act as named semaphores across queues (per Forge spec)

## Testing

```bash
npm test          # 57 tests
npm run build     # TypeScript compile
```

Test files:
- `__tests__/storage.test.ts` — KVS operations
- `__tests__/queue.test.ts` — Queue push/consume basics
- `__tests__/simulator.test.ts` — Orchestrator integration
- `__tests__/shims.test.ts` — @forge/* shim layer + full flow
- `__tests__/deployer.test.ts` — Manifest-driven deploy
- `__tests__/ui-integration.test.ts` — UIKit → bridge → simulator
- `__tests__/concurrency.test.ts` — Race detection, semaphores, transact safety
- `__tests__/mcp-server.test.ts` — MCP server integration (deploy → invoke → state)

Smoke test (full end-to-end in one process):
```bash
npx tsx --import ./dist/loader/register.js scripts/smoke-test.ts
```

## MCP Server

The MCP server (`src/mcp-server.ts`) exposes the simulator over stdio transport.

```bash
# stdio (each connection gets fresh state)
node --import ./dist/loader/register.js dist/mcp-server.js

# HTTP (persistent state across calls)
node --import ./dist/loader/register.js dist/mcp-server.js --http --port=3100
```

**Important:** The `--import ./dist/loader/register.js` flag is required so that deployed apps can resolve `@forge/*` imports through our shims.

### Tools

| Tool | Description |
|------|-------------|
| `forge.deploy` | Deploy a Forge app from a directory (reads manifest.yml) |
| `forge.invoke` | Call a resolver function with payload |
| `forge.fire_trigger` | Simulate product event triggers |
| `forge.ui_state` | Get the current ForgeDoc UI tree |
| `forge.ui_interact` | Click buttons, submit forms, interact with UI components |
| `forge.kvs_get` | Get a KVS value by key |
| `forge.kvs_list` | List/dump KVS contents (optional prefix filter) |
| `forge.kvs_set` | Set a KVS value (for test setup) |
| `forge.queue_push` | Push events to a queue |
| `forge.queue_state` | Inspect queue jobs and event log |
| `forge.logs` | Get simulator + captured console.* logs |
| `forge.reset` | Clear all state |

### Resources

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

- **Forge SQL simulation**
- **Scheduled trigger execution**
- **Web trigger modules** (HTTP endpoint simulation)
- **ForgeDoc visual renderer** (rendering the UIKit tree to HTML — shelved for now)
- **Level 2/3 testing** (real API calls, actual Forge deployment)

## Forge Platform Quirks to Know

- Handler format: `file.export` — file relative to `src/`, dot-separated export name
- Resources are top-level in manifest (not under modules)
- Concurrency keys scoped to installation, NOT to a specific queue
- Publisher sets concurrency on events, not subscriber (unusual but per spec)
- KVS uses `@forge/kvs` (new) — `@forge/api` storage is legacy
- Function timeout: 25s default, 55s for resolvers, up to 900s for consumers
- Queue limits: 50 events/push, 200KB payload, 15min max delay
