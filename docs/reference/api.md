# Programmatic API

Use forge-sim directly in your code for tests, scripts, or custom tooling.

## Quick Start

```typescript
import { createSimulator } from 'forge-sim';

const sim = createSimulator();  // Auto-wires global shim state

// Deploy your app — automatically registers @forge/* loader hooks
const result = await sim.deploy('./my-forge-app');

// Invoke resolvers
const data = await sim.invoke('getIssue', { issueKey: 'PROJ-1' });

// Inspect state
const value = await sim.kvs.get('my-key');
const logs = sim.getLogs();
```

> **Note:** `deploy()` automatically registers Node.js loader hooks so that `@forge/api`, `@forge/kvs`, `@forge/resolver`, etc. in your app code resolve to forge-sim's shims. No `--import` flag needed.
>
> **Edge case:** If your *test file itself* imports `@forge/*` packages at the top level (e.g. `import { storage } from '@forge/api'`), those imports run before `deploy()`. In that case, add the `--import` flag:
> ```bash
> node --import forge-sim/dist/loader/register.js your-test.js
> ```
> This is rarely needed — test files should import from `'forge-sim'` (the `sim.*` API), not from `@forge/*` directly.

### Deploy & Reset

```typescript
const result = await sim.deploy('./my-forge-app');
// result.manifest, result.loadedFunctions, result.errors

sim.reset();
```

### Resolvers

```typescript
const result = await sim.invoke('getIssue', { issueKey: 'PROJ-1' });
const defs = sim.resolver.getDefinitions();
```

### Key-Value Storage

```typescript
import { WhereConditions } from 'forge-sim';

await sim.kvs.set('key', { any: 'value' });
const val = await sim.kvs.get('key');
await sim.kvs.delete('key');

const result = await sim.kvs.query()
  .where('key', WhereConditions.beginsWith('board:'))
  .limit(10)
  .getMany();

await sim.kvs.transact()
  .set('key1', value1)
  .set('key2', value2)
  .delete('key3')
  .execute();

const dump = sim.kvs.dump();
```

### Forge SQL

```typescript
await sim.sql.start();   // Optional — starts lazily on first query
const rows = await sim.sql.query('SELECT * FROM users WHERE active = ?', [true]);
```

### Queues

```typescript
const result = await sim.queue.push('my-queue', { body: { action: 'process' } });
const eventLog = sim.queue.getEventLog();
const job = sim.queue.getJob(result.jobId);
```

### Triggers

```typescript
const results = await sim.fireTrigger('avi:jira:created:issue', {
  issue: { key: 'PROJ-1' },
});
const result = await sim.fireScheduledTrigger('run-migrations');
```

### Product API Mocking

```typescript
sim.mockProductRoutes('jira', {
  '/rest/api/3/issue/PROJ-1': { key: 'PROJ-1', summary: 'My Issue' },
  'POST /rest/api/3/issue': { id: '10001', key: 'PROJ-2' },
});
```

### Auth / Environment Connection

```typescript
await sim.deploy('./my-forge-app');
const result = await sim.loadAuthFromEnv();
// result.atlassian = { connected: true, site: 'mysite.atlassian.net', authType: 'pat' }
// result.providers = ['google', 'github']
```

**Environment variables** (take priority over `.forge-sim/` files):

| Variable | Description |
|----------|-------------|
| `FORGE_SIM_SITE` | Atlassian site (e.g. `mysite.atlassian.net`) |
| `FORGE_SIM_EMAIL` | Account email |
| `FORGE_SIM_PAT` | Personal Access Token |
| `FORGE_SIM_CLOUD_ID` | Cloud ID (optional) |
| `FORGE_SIM_ACCOUNT_ID` | Account ID (optional) |
| `FORGE_SIM_PROVIDER_<KEY>_TOKEN` | Third-party provider token (e.g. `FORGE_SIM_PROVIDER_GOOGLE_APIS_TOKEN`) |

**CI/CD example**:

```yaml
env:
  FORGE_SIM_SITE: ${{ secrets.ATLASSIAN_SITE }}
  FORGE_SIM_EMAIL: ${{ secrets.ATLASSIAN_EMAIL }}
  FORGE_SIM_PAT: ${{ secrets.ATLASSIAN_PAT }}
  FORGE_SIM_PROVIDER_GOOGLE_APIS_TOKEN: ${{ secrets.GOOGLE_TOKEN }}
```

### LLM (`@forge/llm`)

```typescript
// Mock-first: queue responses, then invoke
sim.llm.mockResponses(
  { content: 'First reply' },
  { content: 'Second reply' },
);
const result = await sim.invoke('summarize-issues', { issueKey: 'PROJ-1' });

// Assert on what the app sent
const history = sim.llm.getHistory();  // [{ prompt, response }, ...]
```

### UI

```typescript
const doc = await sim.ui.render('issue-panel', {
  context: { issueKey: 'PROJ-42' },
});
const rendered = await sim.ui.waitForContent('issue-panel', 'PROJ-42');
const text = sim.ui.getTextContent(rendered);

const buttons = sim.ui.findByType(doc, 'Button');
const saveBtn = sim.ui.findByTypeAndText(doc, 'Button', 'Save');
sim.ui.interact(saveBtn, 'onClick');

const { result, updatedDoc } = await sim.ui.interactWith('Button', {
  matchText: 'Load Comments',
});
```

### Logs

```typescript
const logs = sim.getLogs();
const console = sim.getConsoleLogs();
sim.clearLogs();
```

---

# Comprehensive API Reference

Complete type signatures for every public method, grouped by subsystem.

## Table of Contents

- [createSimulator](#createsimulator)
- [ForgeSimulator](#forgesimulator) — the main orchestrator
  - [Deploy & Lifecycle](#deploy--lifecycle)
  - [Resolvers & Invocation](#resolvers--invocation)
  - [Triggers](#triggers-1)
  - [Product API Mocking](#product-api-mocking-1)
  - [Auth](#auth-1)
  - [Logs](#logs-1)
- [sim.kvs — Key-Value Storage](#simkvs--key-value-storage)
  - [Basic CRUD](#basic-crud)
  - [Queries](#queries)
  - [Transactions](#transactions)
  - [Entity Store](#entity-store)
  - [Secrets](#secrets)
  - [Dump & Restore](#dump--restore)
- [sim.sql — Forge SQL](#simsql--forge-sql)
- [sim.queue — Async Events](#simqueue--async-events)
- [sim.resolver — Resolver Registry](#simresolver--resolver-registry)
- [sim.productApi — Product API](#simproductapi--product-api)
- [sim.externalAuth — Third-Party Auth](#simexternalauth--third-party-auth)
- [sim.llm — Anthropic LLM](#simllm--anthropic-llm)
- [sim.ui — UI Rendering](#simui--ui-rendering)
  - [Rendering](#rendering)
  - [Querying the ForgeDoc Tree](#querying-the-forgedoc-tree)
  - [Interaction](#interaction)
  - [Events](#events)
- [Types](#types)

---

## `createSimulator`

```typescript
function createSimulator(config?: SimulationConfig): ForgeSimulator
```

Creates and returns a new simulator instance. Auto-wires as the global singleton (so `@forge/*` shims resolve to it).

```typescript
interface SimulationConfig {
  context?: Partial<ResolverContext>;          // Mock context values
  initialStorage?: Record<string, any>;        // Pre-seed KVS data
  productApis?: {                              // Product API mock handlers
    jira?: ProductApiHandler;
    confluence?: ProductApiHandler;
    bitbucket?: ProductApiHandler;
  };
  queueMode?: 'sequential' | 'concurrent';    // Default: 'sequential'
  storageLatency?: boolean | number;           // false=instant, true=yield, number=random ms
  forgeSQL?: {
    mysqlVersion?: string;                     // Default: '8.4.x'
    dbName?: string;                           // Default: 'forge_app'
    logLevel?: 'LOG' | 'WARN' | 'ERROR';      // Default: 'ERROR'
  };
}
```

---

## ForgeSimulator

The main orchestrator. All subsystems are accessible as properties:

| Property | Type | Description |
|----------|------|-------------|
| `sim.kvs` | `UnifiedKVS` | Key-value storage + entity store |
| `sim.sql` | `SimulatedForgeSQL` | Forge SQL (real MySQL backend) |
| `sim.queue` | `SimulatedQueue` | Async event queues |
| `sim.resolver` | `SimulatedResolver` | Resolver function registry |
| `sim.productApi` | `SimulatedProductApi` | Product API mock/proxy |
| `sim.externalAuth` | `ExternalAuthStore` | Third-party OAuth providers |
| `sim.ui` | `SimulatorUI` | UIKit rendering + ForgeDoc |
| `sim.i18n` | `I18nStore` | Internationalization |
| `sim.functions` | `FunctionRegistry` | All registered functions with types |
| `sim.properties` | `PropertyStore` | App/entity property storage |
| `sim.remotes` | `RemoteProxy` | Forge Remote invocation |
| `sim.fit` | `FITProvider` | Forge Invocation Token (JWT) |

### Deploy & Lifecycle

```typescript
sim.deploy(appDir: string): Promise<DeployResult>
```
Deploy a Forge app. Reads `manifest.yml`, imports handlers, wires resolvers/consumers/triggers.

```typescript
sim.reset(): void
```
Reset all state (KVS, queues, resolvers, UI, logs). Does not stop SQL server.

```typescript
sim.stop(): Promise<void>
```
Stop all background services (MySQL server). Call when done.

```typescript
sim.getManifest(): ParsedManifest | null
```
Get the currently deployed manifest.

### Resolvers & Invocation

```typescript
sim.invoke(
  functionKey: string,
  payload?: any,
  options?: { moduleKey?: string; context?: Partial<ResolverContext> }
): Promise<any>
```
Invoke a resolver function. Wraps payload in `{ payload, context }` per the Forge bridge contract.

The third arg (optional) is an `InvokeOptions` object:
- **`moduleKey`** — scope resolver lookup when multiple modules register the same function key.
- **`context`** — per-call context override (one-shot). Merged onto the sim's base + sticky context for THIS invocation only; the sticky `setContext()` state is untouched. Shape matches Forge's `req.context` (`accountId`, `cloudId`, `extension`, `principal`, `license`, ...).

```typescript
// Vary the calling user per invocation without mutating sticky state
await sim.invoke('castVote', { optionIndex: 0 }, { context: { accountId: 'alice' } });
await sim.invoke('castVote', { optionIndex: 1 }, { context: { accountId: 'bob' } });

// Scope to a specific module
await sim.invoke('getData', payload, { moduleKey: 'panel-a' });

// Combine both
await sim.invoke('castVote', payload, {
  moduleKey: 'pulse-macro',
  context: { accountId: 'alice', extension: { contentId: '12345' } },
});
```

Bad shapes throw a `TypeError` with a fix-it hint — e.g. passing `{ accountId: 'x' }` directly tells you to use `{ context: { accountId: 'x' } }` instead.

```typescript
sim.registerFunction(key: string, handler: Function, type: ForgeFunctionType): void
```
Register a non-resolver function (trigger, consumer, webTrigger, etc.).

```typescript
sim.registerConsumer(queueKey: string, handler: (event, context) => any): void
```
Register a consumer handler for a queue key.

### Triggers

```typescript
sim.fireTrigger(event: string, data: object): Promise<any[]>
```
Fire a product event trigger. Typed overloads exist for all 143 known events.

```typescript
sim.fireScheduledTrigger(triggerKey: string): Promise<{ statusCode: number }>
```
Fire a scheduled trigger. Handler receives `{ context: { cloudId, moduleKey }, contextToken }`.

### Product API Mocking

```typescript
sim.mockProductApi(product: string, handler: ProductApiHandler): void
```
Register a mock handler function for a product.

```typescript
sim.mockProductRoutes(product: string, routes: Record<string, any>): void
```
Register route-based mocks. Keys are `"METHOD /path"` (method defaults to GET).

```typescript
sim.mockGraphQL(mocks: Record<string, any>): void
```
Mock GraphQL responses by operation name.

```typescript
// Example
sim.mockProductRoutes('jira', {
  '/rest/api/3/issue/PROJ-1': { key: 'PROJ-1', summary: 'Fix the thing' },
  'POST /rest/api/3/issue': (path, opts) => ({ id: '10001', key: 'PROJ-2' }),
});
```

### Auth

```typescript
sim.loadAuthFromEnv(): Promise<LoadAuthResult>
```
Load credentials from env vars and/or `.forge-sim/` files. **Must be called after `deploy()`.**

```typescript
interface LoadAuthResult {
  atlassian: { connected: boolean; site?: string; authType?: string };
  providers: string[];   // Provider keys with tokens loaded
}
```

**Environment variables** (take priority over `.forge-sim/` files):

| Variable | Description |
|----------|-------------|
| `FORGE_SIM_SITE` | Atlassian site (e.g. `mysite.atlassian.net`) |
| `FORGE_SIM_EMAIL` | Account email |
| `FORGE_SIM_PAT` | Personal Access Token |
| `FORGE_SIM_CLOUD_ID` | Cloud ID (optional) |
| `FORGE_SIM_ACCOUNT_ID` | Account ID (optional) |
| `FORGE_SIM_PROVIDER_<KEY>_TOKEN` | Third-party provider token (e.g. `FORGE_SIM_PROVIDER_GOOGLE_APIS_TOKEN`) |

### Logs

```typescript
sim.getLogs(): LogEntry[]                    // Simulator logs (deploy, invoke, warnings)
sim.getConsoleLogs(): ConsoleLine[]          // Captured console.* from app code
sim.clearLogs(): void
sim.onLog(listener: (entry) => void): () => void   // Real-time log listener, returns unsubscribe
```

---

## `sim.kvs` — Key-Value Storage

Unified storage implementing `@forge/kvs`, `@forge/api` storage, and Custom Entity Store.

### Basic CRUD

```typescript
sim.kvs.get(key: string): Promise<any>
sim.kvs.set(key: string, value: any): Promise<void>
sim.kvs.delete(key: string): Promise<void>
```

### Queries

```typescript
import { WhereConditions } from 'forge-sim';

const result = await sim.kvs.query()
  .where('key', WhereConditions.beginsWith('board:'))
  .limit(10)
  .cursor(lastCursor)
  .getMany();

// result: { results: Array<{ key, value }>, nextCursor?: string }
```

`WhereConditions` mirrors the real `@forge/kvs` clause builder. Available
helpers: `beginsWith(prefix)`, `between(min, max)`, `equalTo(value)`,
`greaterThan(value)`, `greaterThanEqualTo(value)`, `lessThan(value)`,
`lessThanEqualTo(value)`. Plain object literals are rejected at runtime —
the simulator throws a clear error pointing you at the helper form.

### Transactions

```typescript
await sim.kvs.transact()
  .set('key1', value1)
  .set('key2', value2)
  .delete('key3')
  .execute();
```

### Entity Store

```typescript
const api = sim.kvs.entity('Employee');

api.defineSchema(schema: EntitySchema): void
await api.set(key: string, value: any): Promise<void>
await api.get(key: string): Promise<any>
await api.delete(key: string): Promise<void>

// Indexed queries
const result = await api.query()
  .index('by-department')
  .where({ department: 'Engineering' })
  .sort('asc')
  .limit(25)
  .getMany();
```

### Secrets

```typescript
sim.kvs.getSecret(key: string): Promise<string | undefined>
sim.kvs.setSecret(key: string, value: string): Promise<void>
sim.kvs.deleteSecret(key: string): Promise<void>
```

### Dump & Restore

```typescript
sim.kvs.dump(): Record<string, any>               // Plain KVS as raw values
sim.kvs.dumpAll(): EntityStoreDump                 // Full state (KVS + entities + secrets)
sim.kvs.restore(data: Record<string, any>): void   // Restore plain KVS
sim.kvs.restoreAll(dump: EntityStoreDump): void     // Restore full state
sim.kvs.clear(): void                              // Clear runtime data (preserves schemas)
sim.kvs.clearAll(): void                           // Full clear including schemas
```

---

## `sim.sql` — Forge SQL

Real MySQL 8.4 backend via an ephemeral in-memory server. Starts lazily on first query.

```typescript
sim.sql.start(): Promise<void>               // Eager start (optional)
sim.sql.stop(): Promise<void>                // Stop MySQL server
sim.sql.isRunning: boolean                   // Check if server is running
sim.sql.port: number | null                  // MySQL port (for external tools)

sim.sql.query<T>(sql: string, params?: any[]): Promise<T[]>
sim.sql.executeMultiStatement(sql: string): Promise<void>    // For dumps/migrations

sim.sql.createFetchFunction(): FetchFunction  // Returns the __fetchProduct shim
sim.sql.getConnectionConfig(): { host, port, user, database }

sim.sql.setInitSQLFilePath(path: string): void  // Run SQL file on first start
```

```typescript
// Example
await sim.sql.query('INSERT INTO users (name, active) VALUES (?, ?)', ['Alice', true]);
const rows = await sim.sql.query('SELECT * FROM users WHERE active = ?', [true]);
```

---

## `sim.queue` — Async Events

Simulates `@forge/events` queue push → consumer handler flow.

```typescript
sim.queue.push(queueKey: string, events: QueueEvent | QueueEvent[]): Promise<QueuePushResult>
sim.queue.registerConsumer(queueKey: string, handler: Function): void
sim.queue.getEventLog(): Array<{ queueKey, event }>
sim.queue.getJob(jobId: string): QueueJobStats
sim.queue.getStats(): Record<string, QueueJobStats>
sim.queue.setMode(mode: 'sequential' | 'concurrent'): void
sim.queue.clear(): void
```

```typescript
interface QueueEvent {
  body: any;
  concurrencyKey?: string;   // Events with same key run sequentially
}
```

---

## `sim.resolver` — Resolver Registry

Mirrors `@forge/resolver`. Usually populated by `deploy()`, but can be used directly.

```typescript
sim.resolver.define(functionKey: string, handler: Function): void
sim.resolver.invoke(functionKey: string, payload?: any): Promise<any>
sim.resolver.getDefinitions(): string[]
sim.resolver.getHandler(functionKey: string): Function | undefined
sim.resolver.setContext(overrides: Partial<ResolverContext>): void
sim.resolver.clear(): void
```

---

## `sim.productApi` — Product API

Mock and/or proxy for `requestJira()`, `requestConfluence()`, `requestBitbucket()`.

```typescript
sim.productApi.mock(product: string, handler: ProductApiHandler): void
sim.productApi.mockRoutes(product: string, routes: Record<string, any>): void
sim.productApi.mockGraphQL(mocks: Record<string, any>): void
sim.productApi.request(product: string, path: string, opts?: ProductApiRequest): Promise<ProductApiResponse>
sim.productApi.requestGraph(query: string, variables?: object): Promise<ProductApiResponse>

sim.productApi.connectRealApis(account: AtlassianAccount, options?): void
sim.productApi.disconnectRealApis(): void
sim.productApi.isRealMode: boolean
sim.productApi.connectedAccount: AtlassianAccount | null
sim.productApi.clear(): void
```

Mock routes take priority over real APIs. Use `route()` helper for dynamic handlers:

```typescript
import { route } from 'forge-sim';

sim.productApi.mock('jira', route.json({
  '/rest/api/3/issue/:key': (params) => ({ key: params.key, summary: 'Test' }),
}));
```

---

## `sim.externalAuth` — Third-Party Auth

Manages OAuth providers defined in `manifest.yml` (`providers.auth.*`).

```typescript
// Token management
sim.externalAuth.setToken(providerKey: string, token: ThirdPartyToken): void
sim.externalAuth.getToken(providerKey: string): ThirdPartyToken | undefined
sim.externalAuth.hasCredentials(providerKey: string, scopes?: string[]): boolean
sim.externalAuth.revokeToken(providerKey: string): void

// Provider info
sim.externalAuth.getProvider(key: string): ManifestAuthProvider | undefined
sim.externalAuth.listProviders(): ManifestAuthProvider[]

// OAuth flow (interactive — opens browser)
sim.externalAuth.interactiveOAuthFlow(providerKey: string, port?: number): Promise<ThirdPartyToken | null>

// Secrets
sim.externalAuth.setSecret(providerKey: string, clientSecret: string): void
sim.externalAuth.hasSecret(providerKey: string): boolean

// Hook for testing (intercept browser open)
sim.externalAuth.onAuthUrl: ((url: string) => void) | null
```

In mock mode, `asUser().withProvider('google').fetch('/me')` routes through `sim.productApi.mockRoutes('google-apis', ...)`. No tokens needed.

---

## `sim.llm` — Anthropic LLM

Backend for the `@forge/llm` shim. Two modes:

1. **Mock** — pre-registered responses returned FIFO. Good for tests.
2. **Real proxy** — if `ANTHROPIC_API_KEY` is set (env or via `forge-sim auth --llm`), forwards to the Anthropic Messages API and translates between `@forge/llm`'s OpenAI-shaped dialect and Anthropic's native format.

Mock responses take priority over the real proxy — if the queue has entries, they're consumed first.

```typescript
// Direct calls (matches the @forge/llm shim's chat() surface)
sim.llm.chat(prompt: LlmPrompt): Promise<LlmResponse>
sim.llm.stream(prompt: LlmPrompt): Promise<LlmStreamResponse>
sim.llm.list(): Promise<ModelListResponse>

// Mock management
sim.llm.mockResponse(mock: MockLlmResponse): void          // queue one
sim.llm.mockResponses(...mocks: MockLlmResponse[]): void   // queue many (FIFO)

// Assertions & lifecycle
sim.llm.getHistory(): Array<{ prompt: LlmPrompt; response: LlmResponse }>
sim.llm.reset(): void                                      // clear queue + history

// API key (real-proxy mode)
sim.llm.setApiKey(key: string): void
sim.llm.getApiKey(): string | null                          // env wins over config
```

### MockLlmResponse shape

```typescript
interface MockLlmResponse {
  content: string | ContentPart[];        // assistant text
  tool_calls?: LlmToolCall[];             // optional tool-use blocks
  finish_reason?: string;                  // defaults to 'tool_use' if tool_calls, else 'end_turn'
}
```

### Typical test pattern

```typescript
// Queue a multi-turn agent loop
sim.llm.mockResponses(
  { content: '', tool_calls: [{ id: 'c1', type: 'function', index: 0,
    function: { name: 'get_data', arguments: { query: 'issues' } } }] },
  { content: 'Here are your issues.' },
);

const result = await sim.invoke('summarize-issues', { /* ... */ });

// Assert on what was sent
const history = sim.llm.getHistory();
expect(history).toHaveLength(2);
expect(history[1].prompt.messages.at(-1)?.role).toBe('tool');
```

If neither mocks nor `ANTHROPIC_API_KEY` are present, `chat()` throws `LlmApiError` with code `NO_API_KEY`. See [testing § Mocking @forge/llm](../testing/README.md#mocking-forgellm) for the full pattern catalog.

The MCP equivalents are `forge.llm_mock` and `forge.llm_history` — see [mcp.md](../ai/mcp.md#tools).

---

## `sim.ui` — UI Rendering

Renders UIKit 2 modules to ForgeDoc trees. Works both in-process (tests) and in-browser (dev server).

### Rendering

```typescript
sim.ui.render(moduleKey: string, options?: RenderContextOptions): Promise<ForgeDoc | null>
sim.ui.refresh(moduleKey?: string): Promise<ForgeDoc | null>
sim.ui.getForgeDoc(moduleKey?: string): ForgeDoc | null
sim.ui.getRenderedModules(): string[]
sim.ui.waitForContent(moduleKey: string, text: string, timeoutMs?: number): Promise<ForgeDoc>
sim.ui.getContext(moduleKey?: string): ForgeContext | null
```

```typescript
interface RenderContextOptions {
  context?: Partial<ForgeContext>;  // Override context values
}

interface ForgeDoc {
  type: string;                    // Component type (e.g. 'Button', 'Text', 'Fragment')
  props: Record<string, any>;      // Component props
  children: ForgeDoc[];            // Child nodes
  key: string;                     // React key
}
```

### Querying the ForgeDoc Tree

```typescript
sim.ui.findByType(doc: ForgeDoc, type: string): ForgeDoc[]
sim.ui.findFirstByType(doc: ForgeDoc, type: string): ForgeDoc | null
sim.ui.findByTypeAndText(doc: ForgeDoc, type: string, text?: string, nth?: number): ForgeDoc
sim.ui.findByProps(doc: ForgeDoc, props: Record<string, any>): ForgeDoc[]
sim.ui.getTextContent(doc: ForgeDoc): string
sim.ui.listComponentTypes(doc: ForgeDoc): string[]
sim.ui.prettyPrint(doc: ForgeDoc): string
```

### Interaction

```typescript
sim.ui.interact(node: ForgeDoc, eventName: string, ...args: any[]): any
sim.ui.interactWith(type: string, options?: {
  matchText?: string;
  nthMatch?: number;
  event?: string;       // Default: 'onClick'
  args?: any[];
}): Promise<{ result: any; updatedDoc: ForgeDoc }>
```

```typescript
// Example: full integration test
await sim.ui.render('issue-panel', { context: { issueKey: 'PROJ-42' } });
const doc = await sim.ui.waitForContent('issue-panel', 'PROJ-42');
expect(sim.ui.getTextContent(doc)).toContain('PROJ-42');

const btn = sim.ui.findByTypeAndText(doc, 'Button', 'Load Comments');
sim.ui.interact(btn, 'onClick');
```

### Events

```typescript
sim.ui.waitForRender(): Promise<ForgeDoc>
sim.ui.onRender(listener: (doc: ForgeDoc) => void): () => void          // Any module
sim.ui.onModuleRender(moduleKey: string, listener: (doc) => void): () => void
sim.ui.getBridgeCalls(): BridgeCall[]

sim.ui.reset(): void       // Clear UI state, keep simulator connection
sim.ui.resetAll(): void    // Full reset including simulator disconnection
```

### Macro Config

For Confluence `macro` modules with config (inline `config: true` or sub-module `config: { resource: '...' }`):

```typescript
// Inspect the MacroConfig ForgeDoc tree (inline addConfig() registrations)
sim.ui.getMacroConfigDoc(moduleKey: string): ForgeDoc | null

// Read the saved config values (what useConfig() returns)
sim.ui.getMacroConfig(moduleKey: string): Record<string, unknown> | undefined

// Seed config values before render — useConfig() resolves to these
sim.ui.setMacroConfig(moduleKey: string, values: Record<string, unknown>): void
```

For per-render (non-sticky) config injection, pass `macroConfig` in `RenderContextOptions`:

```typescript
await sim.ui.render('pet-card', { macroConfig: { name: 'Rex', age: 5 } });
```

A bonus diagnostic: if you `render()` a macro module before calling `setMacroConfig` and `useConfig()` returns `{}`, forge-sim emits a hint suggesting `setMacroConfig` — surface this when triaging "why is my macro empty?" tests.

---

## Types

Key types exported from `'forge-sim'`:

```typescript
// Core
export { ForgeSimulator, createSimulator } from 'forge-sim';
export type { SimulationConfig, LoadAuthResult } from 'forge-sim';

// Storage
export { UnifiedKVS, KVSQueryBuilder, EntityAPI, EntityQueryBuilder, TransactionBuilder } from 'forge-sim';
export type { EntitySchema, IndexDefinition, EntityStoreDump, StoredEntry } from 'forge-sim';

// Queue
export { SimulatedQueue } from 'forge-sim';
export type { QueueEvent, QueuePushResult, QueueJobStats } from 'forge-sim';

// Resolver
export { SimulatedResolver } from 'forge-sim';
export type { ResolverContext, ResolverRequest } from 'forge-sim';

// Product API
export { SimulatedProductApi, route } from 'forge-sim';
export type { ProductApiHandler, ProductApiRequest, ProductApiResponse } from 'forge-sim';

// External Auth
export { ExternalAuthStore } from 'forge-sim';

// UI
export { SimulatorUI } from 'forge-sim';
export type { ForgeDoc, BridgeCall, ForgeContext, RenderContextOptions } from 'forge-sim';

// Manifest
export { parseManifest, parseManifestContent } from 'forge-sim';
export type { ForgeManifest, ParsedManifest, ManifestModule, ManifestTrigger } from 'forge-sim';

// Trigger Events (typed payloads for fireTrigger)
export type { TriggerPayloadByEvent, KnownTriggerEvent } from 'forge-sim';

// Dev Server
export { createDevServer } from 'forge-sim';
export type { DevServer, DevServerOptions } from 'forge-sim';

// Web Triggers
export { createWebTriggerHandler, getWebTriggerUrl } from 'forge-sim';
export type { WebTriggerConfig } from 'forge-sim';

// I18n
export { I18nStore } from 'forge-sim';
```

## Function Contracts

forge-sim enforces the correct calling convention per Forge function type:

| Type | Signature | Return Contract |
|------|-----------|-----------------|
| **Resolver** (UI bridge) | `({ payload, context }) => result` | Any JSON |
| **Event Trigger** | `(event, context) => result` | Any |
| **Scheduled Trigger** | `({ context }) => { statusCode }` | Must return `{ statusCode }` or 424 |
| **Consumer** (async events) | `(event, context) => result` | `InvocationError` = retry |
| **Web Trigger** | `(request) => { statusCode, body?, headers? }` | HTTP-like response |

### Invocation Time Limits

Warnings fire when a function exceeds its Forge time limit:

| Type | Limit |
|------|-------|
| Resolver / Action / Workflow | 25s |
| Trigger / Consumer / WebTrigger | 55s |
| Scheduled Trigger (with `timeoutSeconds`) | Up to 900s |
