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
- **src/shims/** — Drop-in replacements for `@forge/api`, `@forge/kvs`, `@forge/events`, `@forge/resolver`
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
npm test          # 53 tests
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

## What's NOT Built Yet

- **MCP Server** — AI-facing tool interface (forge:deploy, forge:invoke, etc.)
- **Forge SQL simulation**
- **Scheduled trigger execution**
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
