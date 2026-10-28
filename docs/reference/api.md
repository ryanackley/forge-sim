# Programmatic API

Use this API for writing CI/CD tests for your Forge App without relying on deploying to Atlassian's servers.

## Quick Start

```typescript
import { createSimulator } from 'forge-sim';

const sim = createSimulator();  // Auto-wires global shim state

// Deploy your app; automatically registers @forge/* loader hooks
const result = await sim.deploy('./my-forge-app');

// Invoke resolvers
const data = await sim.invoke('getIssue', { issueKey: 'PROJ-1' });

// Inspect state
const value = await sim.kvs.get('my-key');
const logs = sim.getLogs();
```

> **Edge case:** If your *test file itself* imports `@forge/*` packages at the top level (e.g. `import { kvs } from '@forge/kvs'`), import `forge-sim` first — the real packages work against the seams `createSimulator()`'s module installs on load. Only `@forge/resolver` has no seam; a test file importing it directly needs the `--import` flag so the loader routes it to the shim:
> ```bash
> node --import forge-sim/dist/loader/register.js your-test.js
> ```
> This is rarely needed; test files should import from `'forge-sim'` (the `sim.*` API), not from `@forge/*` directly.

### Deploy & Reset

```typescript
const result = await sim.deploy('./my-forge-app');
// result.manifest, result.loadedFunctions, result.errors

await sim.reset();
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
  .set('key1', { count: 1 })
  .set('key2', { count: 2 })
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

`createSimulator()` and `deploy()` never load credentials; this call is the only way the test library connects. (`forge-sim dev` calls it by default, the MCP server and CLI daemon only with `--connect`; see [Credentials](../local-development/credentials.md#when-stored-credentials-are-used).)

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
const doc = await sim.ui.render('issue-panel', { issueKey: 'PROJ-42' });
if (!doc) throw new Error('module did not render');   // render() returns ForgeDoc | null
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
  - [Latency Simulation](#latency-simulation)
- [sim.sql — Forge SQL](#simsql--forge-sql)
- [sim.objectStore — Object Store](#simobjectstore--object-store)
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

```typescript no-check
function createSimulator(config?: SimulationConfig): ForgeSimulator
```

Creates and returns a new simulator instance. Auto-wires as the global singleton (so `@forge/*` shims resolve to it).

```typescript no-check
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

```typescript no-check
sim.deploy(appDir: string, options?: DeployOptions): Promise<DeployResult>

interface DeployOptions {
  fireScheduledTriggers?: boolean;  // default: true
  throwOnError?: boolean;           // default: true — throw DeployError (with .result) on any error
  typeCheck?: boolean;              // default: false
  reset?: boolean;                  // default: false — sim.reset() after a SUCCESSFUL build, before wiring
  afterReset?: () => void | Promise<void>;
}
```
Deploy a Forge app. Reads `manifest.yml`, builds the backend the way `forge deploy` does (one output per handler file, every dependency inlined, so module state is per handler file), imports the handlers, wires resolvers/consumers/triggers.

A build error (a syntax error, a top-level `await`) lands in `errors[]` with one entry per function, naming the failing file, and nothing is loaded: `forge deploy` uploads nothing when the bundle fails. With `reset: true` the reset happens only after the build succeeded, so a failed redeploy leaves the previous version running; MCP `forge_deploy` and the daemon use this.

By default, each scheduled trigger fires **once at deploy time**. This mirrors real Forge, where every scheduled trigger starts ~5 minutes after deployment (and redeploys reset/re-create them). It's also what runs migration triggers before your tests touch the database. If a scheduled job has side effects you don't want on every deploy (daily digest, outbound webhook), pass `{ fireScheduledTriggers: false }` and fire it explicitly with `sim.fireScheduledTrigger(key)`. (`forge-sim dev` fires them on the initial deploy only — hot redeploys on file save deliberately do **not** re-fire scheduled work, matching `forge tunnel`, even though a real `forge deploy` would reset the schedules.)

```typescript no-check
sim.reset(): Promise<void>
```
Reset all state (KVS, queues, resolvers, UI, logs) **including module wiring**: consumer registrations and entity schemas are torn down, so call `deploy()` again afterwards. It's async (SQL table drops are FK-aware and must be awaited); an unawaited reset can race the next deploy's migrations. Does not stop the SQL server.

```typescript no-check
sim.stop(): Promise<void>
```
Stop all background services (MySQL server). Call when done.

```typescript no-check
sim.getManifest(): ParsedManifest | null
```
Get the currently deployed manifest.

### Environment Variables

```typescript no-check
sim.setVariables(vars: Record<string, string | { value: string; encrypt?: boolean }>): void
sim.unsetVariable(key: string): boolean
sim.listVariables(): VariableListEntry[]
```

Simulates `forge variables set`. Variables are injected into `process.env` **at deploy time, before handler modules load**; set them before calling `sim.deploy()`. Changing a variable does not take effect until the next deploy, exactly like real Forge (its #1 env-var footgun). `encrypt: true` only masks the value in `listVariables()` output; app code always reads cleartext from `process.env`, matching Forge's encrypted-at-rest-only semantics.

Three sources, in ascending precedence:

1. Host env vars prefixed `FORGE_USER_VAR_` — `FORGE_USER_VAR_MY_KEY=x` becomes `process.env.MY_KEY` (same convention `forge tunnel` uses)
2. `<appDir>/.forge-sim/variables.json` — re-read at every deploy: `{ "MY_KEY": "value", "SECRET": { "value": "s3cret", "encrypt": true } }`
3. `sim.setVariables({...})` — ephemeral, never written to disk; survives `reset()` (Forge vars are environment-scoped, not deployment-scoped)

`listVariables()` returns `{ key, value, encrypt, source }` entries with encrypted values masked: the `forge variables list` view.

### Resolvers & Invocation

```typescript no-check
sim.invoke(
  functionKey: string,
  payload?: any,
  options?: { moduleKey?: string; context?: Partial<ResolverContext>; extension?: Record<string, unknown> }
): Promise<any>
```
Invoke a resolver function. Wraps payload in `{ payload, context }` per the Forge bridge contract.

The third arg (optional) is an `InvokeOptions` object:
- **`moduleKey`** — scope resolver lookup when multiple modules register the same function key.
- **`context`** — per-call context override (one-shot). Merged onto the sim's base + sticky context for THIS invocation only; the sticky `setContext()` state is untouched. Fields match Forge's `req.context` (`accountId`, `cloudId`, `principal`, `license`, ...), except `extension`, which is not allowed here.
- **`extension`** — replaces `req.context.extension` wholesale for THIS invocation. Kept separate from `context` on purpose: `context` fields *merge* onto the base, while extension data *replaces* the whole object.

```typescript
// Vary the calling user per invocation without mutating sticky state
await sim.invoke('castVote', { optionIndex: 0 }, { context: { accountId: 'alice' } });
await sim.invoke('castVote', { optionIndex: 1 }, { context: { accountId: 'bob' } });

// Scope to a specific module
await sim.invoke('getData', payload, { moduleKey: 'panel-a' });

// Combine all three
await sim.invoke('castVote', payload, {
  moduleKey: 'pulse-macro',
  context: { accountId: 'alice' },
  extension: { content: { id: '12345' } },
});
```

Bad shapes throw a `TypeError` with a fix-it hint; e.g. passing `{ accountId: 'x' }` directly tells you to use `{ context: { accountId: 'x' } }` instead, and nesting `extension` inside `context` points you at the top-level `extension` option.

```typescript no-check
sim.registerFunction(key: string, handler: Function, type: ForgeFunctionType): void
```
Register a non-resolver function (trigger, consumer, webTrigger, etc.).

```typescript no-check
sim.registerConsumer(queueKey: string, handler: (event, context) => any): void
```
Register a consumer handler for a queue key.

### Triggers

```typescript no-check
sim.fireTrigger(event: string, data: object): Promise<any[]>
```
Fire a product event trigger. Typed overloads exist for all 143 known events.

#### Who a function runs as

Forge attaches a user only to invocations a person starts from the app's own
UI: resolvers behind a bridge `invoke` and Rovo actions. Every other kind runs
as the app, and forge-sim decides this by the function's kind (the module that
binds it in the manifest), never by which sim API fired it:

| Kind | Runs as | Handler `context` |
|---|---|---|
| resolver, action | the invoking user (`setContext`, render context, per-call `context`) | the resolver `req.context` |
| trigger, scheduledTrigger, webTrigger, consumer, preUninstall, custom field value, workflow validator/condition/post function, JQL function | the app | `{ installContext, license? }`, no `accountId`, `cloudId` or `principal` |

In an app-identity kind, the real `@forge/api` behaves as on Forge:
`asApp()` works; `asUser()` is answered 401 with `forge-proxy-error:
NEEDS_AUTHENTICATION_ERR`, which the package throws as
`NeedsAuthenticationError('Authentication Required')`; `authorize()` throws
"Couldn’t find the accountId of the invoking user". A sticky
`setContext({ accountId })`, a render as another user, or the resolver that
pushed a queue event do not leak a user into these kinds: a consumer is its
own invocation. Only the installation-level fields of `setContext()`
(`installContext`, `license`) reach them.

`asUser(accountId)` for another user is offline impersonation. It works from
any kind once a scope is declared with `allowImpersonation: true` (the map
form of `permissions.scopes`); without one it gets the same 401. Mock route
handlers receive `options.provider` (`'app'` | `'user'`) and, for user
requests, `options.accountId`, so a mock can answer per identity.

```typescript no-check
sim.fireScheduledTrigger(triggerKey: string): Promise<{ statusCode: number; error?: string }>
```
Fire a scheduled trigger. Handler receives `{ context: { cloudId, moduleKey }, contextToken }`.

Parity note: per Atlassian's scheduled-trigger doc, the handler's **return value is ignored** — a handler that returns nothing (like Atlassian's own example) succeeds. The result is the sim's report, not a platform response: `{ statusCode: 204 }` when the handler completes, `{ statusCode: 500, error }` when it throws (real Forge logs the error and does not retry).

```typescript no-check
sim.fireWebTrigger(triggerKey: string, request?: WebTriggerRequestInit): Promise<WebTriggerResponse>
```
Fire a web trigger in-process, no HTTP server needed. The handler is called with the Forge `(request, context)` convention; the request is Forge-shaped (`method`, `path`, multi-value `headers`/`queryParameters`, string `body`). All init fields are optional: a bare `fireWebTrigger(key)` simulates `GET <trigger-url>`. Object bodies are JSON-stringified as a convenience.

```typescript no-check
interface WebTriggerRequestInit {
  method?: string;                                       // default GET
  userPath?: string;                                     // extra path after the trigger URL
  headers?: Record<string, string | string[]>;           // normalized to lowercase string[]
  queryParameters?: Record<string, string | string[]>;
  body?: string | object | unknown[];                    // objects → JSON.stringify
}

interface WebTriggerResponse {
  statusCode: number;
  headers: Record<string, string[]>;
  body: string;
}
```

Parity note: handler exceptions and malformed results become **500 responses** (what the real webhook caller would see), never thrown errors. Only setup problems throw: no manifest, unknown trigger key, handler not loaded. Static-output triggers (`response.type: static`) resolve their configured output.

Web trigger functions are **not** resolvers: `sim.invoke()` on one throws with a pointer here, because real Forge has no bridge-invoke path to a web trigger and the calling conventions differ (`(request, context)` vs `{ payload, context }`).

### Product API Mocking

```typescript no-check
sim.mockProductApi(product: string, handler: ProductApiHandler): void
```
Register a mock handler function for a product: it answers every call to that product (full replacement, routes included).

```typescript no-check
sim.mockProductRoutes(product: string, routes: Record<string, any>): void
```
Register route-based mocks. Keys are `"METHOD /path"` (method defaults to GET). Routes registered after a `mockProductApi()` handler answer first, and the handler answers whatever they don't match.

**Mocks always win over a connected site**, whether registered before or after `loadAuthFromEnv()`, and whatever status they return: a route mocked as `mockResponse(404, …)` answers 404, it is never read as "unmocked" and sent to the site (or, for a remote or provider remote, a `mockResponse(501)` to the real backend). A call no mock answers goes to the connected site for `jira`/`confluence`/`bitbucket`/`stargate` (the gateway, at the site's `/gateway/api`); to the real backend for a remote or provider remote only when nothing at all is mocked for that key (otherwise `404 "No mock route matched"`).

```typescript no-check
sim.mockGraphQL(mocks: Record<string, any>): void
```
Mock GraphQL responses by operation name. The gateway is one backend: the
real `@forge/api` `requestGraph()` and `requestTeamworkGraph()` in app code,
`sim.productApi.requestGraph()` in tests, `forge_mock_graphql` over MCP and
the `"graphql"` key of `.forge-sim/mocks.json` all meet on the `stargate`
product's `POST /graphql`. An operation-name mock (the request's
`operationName`, else the name in the query text, else `'*'`) answers first,
then a `mockProductRoutes('stargate', { 'POST /graphql': … })` route, then a
full `mockProductApi('stargate', …)` handler, then the connected site's
gateway; unmocked, the `501` names those four fixes. `requestAtlassian`,
`requestConnectedData` and the privacy API are plain `stargate` routes.
`withContext(ari)` routes to the product named by the ARI's resource owner.

```typescript
// Example
sim.mockProductRoutes('jira', {
  '/rest/api/3/issue/PROJ-1': { key: 'PROJ-1', summary: 'Fix the thing' },
  'POST /rest/api/3/issue': (path: string, opts?: { body?: string }) =>
    ({ id: '10001', key: 'PROJ-2' }),
});
```

### Auth

```typescript no-check
sim.loadAuthFromEnv(): Promise<LoadAuthResult>
```
Load credentials from env vars and/or `.forge-sim/` files. **Must be called after `deploy()`.** It is the only way the in-process library connects to a real site: nothing else loads credentials, and `FORGE_SIM_CONNECT` does not apply here. Mocks registered before or after the call keep answering ahead of the real site.

```typescript
interface LoadAuthResult {
  atlassian: { connected: boolean; site?: string; authType?: string };
  providers: string[];        // Provider keys with tokens loaded
  providerSecrets?: number;   // Provider client secrets loaded from <app>/.forge-sim/providers.json (present when > 0)
  llm?: { configured: boolean; source: 'env' | 'config' };  // Anthropic key, when one was found
}
```

```typescript no-check
sim.unloadAuth(): UnloadAuthResult
```
Take back what `loadAuthFromEnv()` loaded: disconnect its Atlassian account and drop the provider tokens, provider client secrets and `forge-sim auth --llm` key it set. A provider token derived from one of those goes too: a loaded token that was refreshed since (`withProvider()` refreshes an expiring token on use), or a token an OAuth flow exchanged with a loaded client secret. Anything else is left alone: a value set some other way (your own `sim.externalAuth.setToken(...)` or `setSecret(...)` after the load), and an `ANTHROPIC_API_KEY` in the process env, which `@forge/llm` reads at call time and which `loadAuthFromEnv()` therefore reports (`llm.source: 'env'`) but does not record. A value the load overwrote (your own `setToken(...)` made *before* it) is removed, not restored. Recording is cumulative across `loadAuthFromEnv()` calls; `unloadAuth()` clears it.

`reset()` does not do this: it drops the Atlassian connection but keeps provider tokens and the LLM key. The daemon and dev Tools API call it on every `/api/reset` and before every `/api/deploy`; a deploy that connects then reloads from the store *after* deploying (also when the deploy throws), so deploy-time triggers always run without stored credentials. MCP `forge_deploy` does the same. A deploy that did not ask to connect therefore keeps none of the stored credentials; what is not gated by credentials (an unmocked `invokeRemote`, an env `ANTHROPIC_API_KEY`) still works as on every channel.

```typescript
interface UnloadAuthResult {
  atlassian?: string;       // site it disconnected, if any
  providers: string[];      // provider keys whose loaded (or refreshed / exchanged-from-loaded) token it removed
  providerSecrets: number;  // provider client secrets it removed
  llm: boolean;             // whether it cleared the `auth --llm` key
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

```typescript no-check
sim.getLogs(): LogEntry[]                    // Simulator logs (deploy, invoke, warnings)
sim.getConsoleLogs(): ConsoleLine[]          // Captured console.* from app code
sim.clearLogs(): void
sim.onLog(listener: (entry) => void): () => void   // Real-time log listener, returns unsubscribe
```

---

## `sim.kvs` — Key-Value Storage

Unified storage implementing `@forge/kvs`, `@forge/api` storage, and Custom Entity Store.

### Basic CRUD

```typescript no-check
sim.kvs.get(key: string): Promise<any>
sim.kvs.set(key: string, value: any, options?: SetOptions): Promise<void | SetResult>
sim.kvs.delete(key: string): Promise<void>
```

`options` is what the real `kvs.set` takes: `keyPolicy` (`'OVERRIDE'` |
`'FAIL_IF_EXISTS'`), `returnValue` (`'PREVIOUS'` | `'LATEST'`, which makes the
call resolve with that entry) and `ttl` (`{ value, unit }`).

#### Limits and error codes

Forge's storage limits apply on every path into the store, and with the same
error codes: this direct API, `kvs.entity().set()`, `setSecret()`, batch items,
transaction items, and the `@forge/kvs` package inside a deployed app (which
validates nothing itself and reaches the same checks through the runtime seam).
A rejected direct call throws a `KVSQueryError` with the code in `.code`; the
real package surfaces the same code on its `ForgeKvsAPIError`.

| Rule | Code |
|---|---|
| Key matches `/^(?!\s+$)[a-zA-Z0-9:._\s-#]+$/` | `INVALID_KEY` |
| Key is at most 500 characters | `KEY_TOO_LONG` |
| Key is non-empty | `KEY_TOO_SHORT` (KVS, secrets) / `EMPTY_KEY` (entities) |
| Value is not `null`/`undefined` | `INVALID_VALUE` |
| Serialized value is at most 240 KiB | `MAX_SIZE` |
| Object depth is at most 31 | `MAX_DEPTH` |
| `keyPolicy: 'FAIL_IF_EXISTS'` on an existing key | `KEY_ALREADY_EXISTS` |

Codes follow [KVS error handling](https://developer.atlassian.com/platform/forge/storage-reference/kvs-errorhandling/)
and [Custom Entity Store error handling](https://developer.atlassian.com/platform/forge/storage-reference/entities-errorhandling/);
limits follow [KVS and Custom Entity Store limits](https://developer.atlassian.com/platform/forge/limits-kvs-ce/).

### Queries

```typescript
import { WhereConditions } from 'forge-sim';

const page = await sim.kvs.query()
  .where('key', WhereConditions.beginsWith('board:'))
  .limit(10)
  .getMany();
// page: { results: Array<{ key, value }>, nextCursor?: string }

if (page.nextCursor) {
  const nextPage = await sim.kvs.query()
    .where('key', WhereConditions.beginsWith('board:'))
    .limit(10)
    .cursor(page.nextCursor)
    .getMany();
}
```

`WhereConditions` mirrors the real `@forge/kvs` clause builder. Available
helpers: `beginsWith(prefix)`, `between(min, max)`, `equalTo(value)`,
`greaterThan(value)`, `greaterThanEqualTo(value)`, `lessThan(value)`,
`lessThanEqualTo(value)`. Plain object literals are rejected at runtime;
the simulator throws a clear error pointing you at the helper form.

A page holds 10 results unless `limit(n)` says otherwise, and `n` must be an
integer from 1 to 100, as on Forge. Out of range is `LIST_QUERY_LIMIT_EXCEEDED`
for `kvs.query()` and `COMPLEX_QUERY_PAGE_LIMIT_NOT_IN_RANGE` for entity
queries. Keys come back in code-unit order on every surface (this builder, the
`@forge/kvs` package in a deployed app, `forge_kvs_list`, the dev-tools KVS
listing), so a page looks the same whichever way it was fetched.

### Transactions

```typescript run=docs-examples/api-examples.test.ts#kvs-transactions
await sim.kvs.transact()
  .set('key1', { count: 1 })
  .set('key2', { count: 2 })
  .delete('key3')
  .execute();
```

### Entity Store

```typescript
const employees = sim.kvs.entity('Employee');   // schema comes from manifest.yml

await employees.set('emp-1', { name: 'Pat', department: 'Engineering' });
// set() takes the same options as sim.kvs.set(): keyPolicy, returnValue, ttl
const emp = await employees.get('emp-1');
await employees.delete('emp-1');

// Indexed queries — index + partition defined in the manifest entity schema.
// In app code, import the Sort enum: `import { Sort } from '@forge/kvs'` —
// the real package types .sort() against the enum, so the string 'ASC'
// fails type checking there.
const result = await employees.query()
  .index('by-department', { partition: ['Engineering'] })
  .sort(Sort.ASC)
  .limit(25)
  .getMany();
```

#### Manifest schema (`app.storage.entities`)

Entities are declared in `manifest.yml` under `app.storage.entities`, the same
place real Forge reads them from ([Atlassian's Custom Entities docs](https://developer.atlassian.com/platform/forge/runtime-reference/custom-entities/)).
The simulator parses the schema at deploy time and auto-registers every entity
with `sim.kvs`, so `entity(name).set()` validates attribute types and
`query().index()` resolves partition/range keys exactly as declared.

```yaml
app:
  storage:
    entities:
      - name: employee                # required, unique per manifest
        attributes:                   # required — map of attribute name → type
          surname:
            type: string              # integer | float | string | boolean | any
          department:
            type: string
          age:
            type: integer
        indexes:                      # optional
          - surname                   # string shorthand: range key on that attribute
          - name: by-department       # object form
            partition:
              - department            # partition key attribute(s)
            range: [age]              # single range key attribute (must be a list)
```

Parsing rules (mirroring real Forge):

- **`name`** — required string, unique across the manifest. Duplicates are a
  deploy error.
- **`attributes`** — required map. Each attribute needs a `type` of
  `integer`, `float`, `string`, `boolean`, or `any`. Unknown types produce a
  deploy warning (real Forge may reject them).
- **`indexes`** — optional. Two forms per entry:
  - **String shorthand** — `- surname` declares an index named `surname`
    with that attribute as the range key (this is the form Atlassian's docs
    use in their first example).
  - **Object form** — `name` (required, unique), `partition` (optional list
    of attribute names), `range` (optional **one-element list**, `range: [age]`).
    A bare string (`range: age`) is rejected at deploy by the upstream
    `@forge/manifest` validator — the schema requires an array here — and an
    empty or multi-element list is a deploy error, because real Forge rejects
    multi-attribute range keys.
- Partition or range keys referencing attributes that aren't declared in
  `attributes` produce deploy warnings.

Querying an index that isn't declared in the manifest throws
`INDEX_NOT_FOUND`, the same failure you'd get from real Forge, rather than a
silent empty result.

### Secrets

```typescript no-check
sim.kvs.getSecret(key: string): Promise<string | undefined>
sim.kvs.setSecret(key: string, value: string): Promise<void>
sim.kvs.deleteSecret(key: string): Promise<void>
```

### Dump & Restore

```typescript no-check
sim.kvs.dump(): Record<string, any>               // Plain KVS as raw values
sim.kvs.dumpAll(): EntityStoreDump                 // Full state (KVS + entities + secrets)
sim.kvs.restore(data: Record<string, any>): void   // Restore plain KVS
sim.kvs.restoreAll(dump: EntityStoreDump): void     // Restore full state
sim.kvs.clear(): void                              // Clear runtime data (preserves schemas)
sim.kvs.clearAll(): void                           // Full clear including schemas
```

### Latency Simulation

```typescript no-check
sim.kvs.setLatency(latency: boolean | number): void
```

Injects artificial latency into every KVS operation. `true` yields a macrotask per call, a number adds a random delay between 0 and that many milliseconds, `false` (the default) turns it off. In-memory KVS calls normally complete too fast for concurrent code paths to interleave; enabling latency opens real read-modify-write windows. Pair it with `sim.queue.setMode('concurrent')` to expose race conditions in consumer code. See [Hunting race conditions](../testing/README.md#hunting-race-conditions-concurrent-mode--kvs-latency) in the testing guide.

---

## `sim.sql` — Forge SQL

Real MySQL 8.4 backend via an ephemeral in-memory server. Starts lazily on first query.

```typescript no-check
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

### Errors

A failing statement answers with Forge's error envelope on every surface, never the raw MySQL error: the app's `@forge/sql` throws a `ForgeSQLAPIError` with `code: 'SQL_EXECUTION_ERROR'`, `message: 'Unknown SQL execution error'`, a `suggestion`, and the native error under `context.debug` (`{ code: 'ER_DUP_ENTRY', errno, sqlMessage, sqlState }`), so the documented `error.code === errorCodes.SQL_EXECUTION_ERROR` branch and the `debug.code` check work as on Forge ([error handling](https://developer.atlassian.com/platform/forge/storage-reference/sql-handling-errors/)). A driver timeout is `QUERY_TIMED_OUT`. `sim.sql.query()` throws a `ForgeSqlError` carrying the same `code`, `suggestion` and `debug`, with the native message in `.message`; MCP `forge_sql_execute` and the dev-tools query route print the same fields.

---

## `sim.objectStore` — Object Store

Simulates `@forge/object-store` (requires a `modules.objectStore` entry in the
manifest, same as real Forge). Backs the pre-signed upload/download URL flow
with an ephemeral HTTP server, enforces the 1 GB object limit, 90-day max TTL,
and CRC32/CRC32C/SHA1/SHA256 checksums.

```typescript no-check
// Backend API (mirrors @forge/object-store)
sim.objectStore.createUploadUrl(body: UploadUrlBody): Promise<{ url: string }>
sim.objectStore.createDownloadUrl(key: string, options?: { cdn?: boolean }): Promise<{ url: string } | undefined>  // key string, NOT a body object; absent key → undefined
sim.objectStore.get(key: string, options?: { cdn?: boolean }): Promise<ObjectReference | undefined>  // metadata
sim.objectStore.delete(key: string, options?: { cdn?: boolean }): Promise<void>
sim.objectStore.put(key, data, ttlSeconds?): Promise<void>       // deprecated in @forge/object-store, kept for parity
sim.objectStore.download(key): Promise<Buffer | undefined>       // deprecated in @forge/object-store, kept for parity

// Test setup & introspection (sim-only)
sim.objectStore.seedObject({ key, data, contentType?, cdn?, ttlSeconds? }): ObjectReference
sim.objectStore.listObjects(bucket?: 'default' | 'cdn'): ObjectMetadata[]
sim.objectStore.getObjectContent(key, options?): { buffer: Buffer; contentType: string } | undefined
sim.objectStore.dumpAll(): ObjectStoreDump
sim.objectStore.restoreAll(dump: ObjectStoreDump): void
sim.objectStore.reset(): void
```

```typescript no-check
// Example: seed a file, then exercise app code that reads it
sim.objectStore.seedObject({ key: 'reports/q3.csv', data: 'a,b\n1,2', contentType: 'text/csv' });
const meta = await sim.objectStore.get('reports/q3.csv');   // { key, checksum, size, ... }
```

Do NOT alias `@forge/object-store` in tests — since the backend seam
migration the real package runs against the sim through
`global.__forge_fetch__` (see the [testing guide](../testing/README.md)).

---

## `sim.queue` — Async Events

Simulates `@forge/events` queue push → consumer handler flow.

```typescript no-check
sim.queue.push(queueKey: string, events: QueueEvent | QueueEvent[]): Promise<QueuePushResult>
sim.queue.registerConsumer(queueKey: string, handler: Function): void
sim.queue.getEventLog(): Array<{ queueKey, event }>
sim.queue.getJob(jobId: string): QueueJobStats
sim.queue.getStats(): Record<string, { consumers: number; jobs: number; events: number; succeeded: number; failed: number }>
sim.queue.setMode(mode: 'sequential' | 'concurrent'): void
sim.queue.clear(): void                            // Clears jobs/events/stats; consumers stay registered
sim.queue.clearAll(): void                         // Full teardown incl. consumers (reset/deploy infrastructure)
```

`clear()` is safe test hygiene (e.g. in `beforeEach`): it wipes runtime data but
preserves consumer registrations: consumers are module wiring owned by
`deploy()`/`reset()`, not runtime state. After `clearAll()`, pushed events have
no consumers until the next deploy re-wires them.

```typescript
interface QueueEvent {
  body: Record<string, unknown>;
  delayInSeconds?: number;   // Accepted for API parity; not simulated (events process immediately)
  concurrency?: {
    key: string;             // Named semaphore, shared across queues (per Forge spec)
    limit: number;           // Max events processing under this key at once
  };
}
```

The default processing mode is `sequential`: `push()` runs consumers one at a time and resolves when all have finished. Switch to `concurrent` (via `setMode()` above or `queueMode` in `createSimulator()`) to process a push's events in parallel and hunt race conditions; see [Hunting race conditions](../testing/README.md#hunting-race-conditions-concurrent-mode--kvs-latency) in the testing guide.

---

## `sim.resolver` — Resolver Registry

Mirrors `@forge/resolver`. Usually populated by `deploy()`, but can be used directly.

```typescript no-check
sim.resolver.define(functionKey: string, handler: Function): void
sim.resolver.invoke(functionKey: string, payload?: any): Promise<any>
sim.resolver.getDefinitions(): string[]
sim.resolver.getHandler(functionKey: string): Function | undefined
sim.resolver.setContext(overrides: Partial<ResolverContext>): void
sim.resolver.clear(): void                         // Deploy/reset infrastructure — prefer sim.reset()
```

`clear()` wipes all resolver definitions. It exists for deploy infrastructure
(the dev server's hot-redeploy uses it before re-registering handlers); for
between-test cleanup, prefer `sim.reset()` so wiring and state stay consistent.

---

## `sim.productApi` — Product API

Mock and/or proxy for `requestJira()`, `requestConfluence()`, `requestBitbucket()`.

```typescript no-check
sim.productApi.mock(product: string, handler: ProductApiHandler): void
sim.productApi.mockRoutes(product: string, routes: Record<string, any>): void
sim.productApi.mockGraphQL(mocks: Record<string, any>): void
sim.productApi.request(product: string, path: string, opts?: ProductApiRequest): Promise<ProductApiResponse>
sim.productApi.requestGraph(query: string, variables?: object): Promise<ProductApiResponse>  // = request('stargate', '/graphql', …)

sim.productApi.connectRealApis(account: AtlassianAccount, options?): void
sim.productApi.disconnectRealApis(): void
sim.productApi.isRealMode: boolean
sim.productApi.connectedAccount: AtlassianAccount | null
sim.productApi.clear(): void
```

Mock routes take priority over real APIs.

**Repeated `mockRoutes()` calls merge**: routes accumulate across calls for the same product, as if all were passed in one call. Re-registering the same `"METHOD /path"` key updates that route's response in place. Paths match by prefix and the **longest matching prefix wins** — a `GET /rest/api/3/issue/` catch-all never shadows a more specific `GET /rest/api/3/issue/PROJ-1`, no matter which was registered first (ties on length fall back to registration order). To wipe mocks, use `sim.reset()` or `sim.productApi.clear()`; `mock(product, handler)` replaces the product's handler wholesale.

Use a function handler for dynamic responses (the `route` export is the template tag mirroring `@forge/api`'s, for building request paths):

```typescript
sim.mockProductRoutes('jira', {
  'GET /rest/api/3/issue': (path: string) =>
    ({ key: path.split('/').pop(), summary: 'Test' }),
});
```

### `mockResponse()` — non-200 responses

Bare route values become 200 OK bodies. For explicit status codes, headers, or empty bodies, wrap with the `mockResponse` export:

```typescript no-check
mockResponse(status: number, body?: unknown, headers?: Record<string, string>): MockResponseTag
```

```typescript
import { mockResponse } from 'forge-sim';

sim.mockProductRoutes('jira', {
  'PUT /rest/api/3/issue/FAIL-1': mockResponse(500, { error: 'boom' }),
  'POST /rest/api/3/search/jql': mockResponse(429, { msg: 'slow down' }, { 'Retry-After': '60' }),
  'DELETE /rest/api/3/version/10001': mockResponse(204),
});
```

Matches real Forge semantics: `requestJira()` does not throw on non-2xx; app code sees `res.ok === false` / `res.status`. Function handlers may also return a `mockResponse(...)` for per-request control. The return value is a plain tagged object (`{ __forgeSimMockResponse: true, status, body?, headers? }`), so it survives JSON serialization; over MCP, construct the literal directly. See [Testing → Error responses with mockResponse()](../testing/README.md#error-responses-with-mockresponse) for full examples.

---

## `sim.externalAuth` — Third-Party Auth

Manages OAuth providers defined in `manifest.yml` (`providers.auth.*`).

```typescript no-check
// Token management
sim.externalAuth.setToken(providerKey: string, token: ThirdPartyToken): void
sim.externalAuth.getToken(providerKey: string): ThirdPartyToken | undefined
sim.externalAuth.hasCredentials(providerKey: string, scopes?: string[]): boolean
sim.externalAuth.revokeToken(providerKey: string): void

// Provider info
sim.externalAuth.getProvider(key: string): ManifestAuthProvider | undefined
sim.externalAuth.listProviders(): ManifestAuthProvider[]

// OAuth flow (interactive, opens browser)
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
2. **Real proxy** — if an Anthropic key is available, forwards to the Anthropic Messages API and translates between `@forge/llm`'s OpenAI-shaped dialect and Anthropic's native format.

An `ANTHROPIC_API_KEY` in the process env always counts as available; the `forge-sim auth --llm` key only after `sim.loadAuthFromEnv()` loaded it (or on a channel that connects; `sim.unloadAuth()` drops it again).

Mock responses take priority over the real proxy: if the queue has entries, they're consumed first.

```typescript no-check
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

```typescript no-check
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

The MCP equivalents are `forge_llm_mock` and `forge_llm_history`; see [mcp.md](../ai/mcp.md#tools).

---

## `sim.ui` — UI Rendering

Renders UIKit 2 modules to ForgeDoc trees. Works both in-process (tests) and in-browser (dev server).

### Rendering

```typescript no-check
sim.ui.render(moduleKey: string, options?: RenderContextOptions): Promise<ForgeDoc | null>
sim.ui.refresh(moduleKey?: string): Promise<ForgeDoc | null>
sim.ui.getForgeDoc(moduleKey?: string): ForgeDoc | null
sim.ui.getRenderedModules(): string[]
sim.ui.waitForContent(moduleKey: string, text: string, timeout?: number | { timeoutMs?: number }): Promise<ForgeDoc>
sim.ui.getContext(moduleKey?: string): ForgeContext | null
```

```typescript no-check
interface RenderContextOptions {
  context?: Partial<ForgeContext>;      // Raw context fields (merge semantics, see below)
  issueKey?: string;                    // Jira issue key — hydrates issue data into context
  projectKey?: string;                  // Jira project key — hydrates project data
  contentId?: string;                   // Confluence content ID — hydrates content data
  spaceKey?: string;                    // Confluence space key — hydrates space data
  extension?: Record<string, any>;      // Replace the FULL extension object (see below)
  macroConfig?: Record<string, unknown>; // One-shot useConfig() values (macro modules only)
}

interface ForgeDoc {
  type: string;                    // Component type (e.g. 'Button', 'Text', 'Fragment')
  props: Record<string, any>;      // Component props
  children: ForgeDoc[];            // Child nodes
  key: string;                     // React key
}
```

**`context` vs `extension`** — same split as [`sim.invoke`](#resolvers--invocation):

- **`context`** *merges*: canonical `ForgeContext` fields (`accountId`, `cloudId`, `locale`, `license`, `theme`, ...) are promoted to the top level of the rendered context; anything unrecognized is merged into `extension`. Putting an `extension` key *inside* `context` is not allowed — use the top-level option.
- **`extension`** *replaces* the extension object wholesale (placement data: `issue`, `project`, `content`, `space`, `config`, ...). It also suppresses `issueKey`/`contentId`/etc. hydration — you're declaring the exact placement shape, so nothing is fetched on top of it.
- **`issueKey`/`projectKey`/`contentId`/`spaceKey`** hydrate placement data into `extension` for you. Lookups go through the product API, so mock routes apply; `issueKey` pulls the project from the fetched issue (falling back to the key prefix, with a warning, if the lookup fails).
- **`macroConfig`** is a per-render `useConfig()` seed for `macro` modules — as if a previous config save had run. It does not persist; use `sim.ui.setMacroConfig` for sticky values.

```typescript
// Hydrate issue placement from a (mocked) Jira issue
await sim.ui.render('issue-panel', { issueKey: 'PROJ-1', context: { accountId: 'alice' } });

// Or declare the placement shape exactly — no hydration
await sim.ui.render('issue-panel', {
  extension: { type: 'jira:issuePanel', issue: { id: '10042', key: 'PROJ-1' } },
});
```

### Querying the ForgeDoc Tree

```typescript no-check
sim.ui.findByType(doc: ForgeDoc, type: string): ForgeDoc[]
sim.ui.findFirstByType(doc: ForgeDoc, type: string): ForgeDoc | null
sim.ui.findByTypeAndText(doc: ForgeDoc, type: string, text?: string, nth?: number): ForgeDoc
sim.ui.findByProps(doc: ForgeDoc, props: Record<string, any>): ForgeDoc[]
sim.ui.getTextContent(doc: ForgeDoc): string
sim.ui.listComponentTypes(doc: ForgeDoc): string[]
sim.ui.prettyPrint(doc: ForgeDoc): string
```

### Interaction

```typescript no-check
sim.ui.interact(node: ForgeDoc, eventName: string, ...args: any[]): any
sim.ui.interactWith(type: string, options?: {
  matchText?: string;
  nthMatch?: number;
  event?: string;       // Default: 'onClick'
  args?: any[];
}): Promise<{ result: any; updatedDoc: ForgeDoc }>
sim.ui.fillField(moduleKey: string, name: string, value: unknown): void
sim.ui.submitForm(moduleKey: string, values?: Record<string, unknown>): Promise<unknown>
```

`fillField` fires the same onChange a user typing/selecting would: Textfield/TextArea get a synthetic input event; Select resolves the value against the component's options and emits the `{ label, value }` option object react-select emits (arrays for `isMulti`).

`submitForm` finds the module's `<Form>` and fires its `onSubmit` with a synthetic event (what react-hook-form's `handleSubmit` wrapper expects). If `values` is provided, each field is filled via `fillField` first; fields not in `values` keep their current state. Returns whatever the form's onSubmit returns. If validation blocks the submit (required field missing), the user handler is never called (same as production) and the validation errors are visible in the rendered tree afterward:

```typescript no-check
await sim.ui.submitForm('settings-page');                          // submit current state
await sim.ui.submitForm('settings-page', { name: 'Pat', age: 5 }); // fill + submit
```

### Quiescence — settling async UI state

`sim.ui.render()` only awaits the initial reconcile; data fetched in a `useEffect` lands later. These helpers wait out the `invoke → setState → effect` chain so interactions can't be clobbered by a late effect:

```typescript no-check
sim.ui.waitForContent(moduleKey: string, text: string, timeout?: number | { timeoutMs?: number }): Promise<ForgeDoc>
sim.ui.settle(moduleKey?: string, options?: { quietMs?: number; timeoutMs?: number }): Promise<ForgeDoc | null>
sim.pendingInvokes: number                                          // resolver invocations in flight
sim.idle(options?: { quietMs?: number; timeoutMs?: number }): Promise<void>
```

- **`waitForContent`** waits for the text to appear **and** for the UI to settle (renders quiet + zero pending invokes), then re-verifies the text. The returned doc is the settled tree — safe to `fillField`/`interact` immediately. The timeout accepts a bare number of milliseconds or the `{ timeoutMs }` shape its siblings use — both work; an options object with neither key throws rather than silently defaulting.
- **`settle`** waits until no render commits for `quietMs` (default 50ms) and no invokes are in flight; returns the latest doc. Use after a manual `render()` or after an interaction that kicks off async work. If the UI never goes quiet (interval re-renders, hung resolver), it resolves at `timeoutMs` (default 5s) with a warning.
- **`sim.idle()`** resolves once no resolver invocations are in flight — drains fire-and-forget effect invokes before assertions or shutdown. Throws at `timeoutMs` naming how many invocations are stuck.
- **`sim.stop()`** calls `idle()` internally (3s cap), so in-flight invokes finish before MySQL shuts down.

```typescript
// Example: full integration test
await sim.ui.render('issue-panel', { issueKey: 'PROJ-42' });
const doc = await sim.ui.waitForContent('issue-panel', 'PROJ-42');
expect(sim.ui.getTextContent(doc)).toContain('PROJ-42');

const btn = sim.ui.findByTypeAndText(doc, 'Button', 'Load Comments');
sim.ui.interact(btn, 'onClick');
```

### Events

```typescript no-check
sim.ui.waitForRender(): Promise<ForgeDoc>
sim.ui.onRender(listener: (doc: ForgeDoc) => void): () => void          // Any module
sim.ui.onModuleRender(moduleKey: string, listener: (doc) => void): () => void
sim.ui.getBridgeCalls(): BridgeCall[]

sim.ui.reset(): void       // Clear UI state, keep simulator connection
sim.ui.resetAll(): void    // Full reset including simulator disconnection
```

### Macro Config

For Confluence `macro` modules with config (inline `config: true` or sub-module `config: { resource: '...' }`):

```typescript no-check
// Inspect the MacroConfig ForgeDoc tree (inline addConfig() registrations)
sim.ui.getMacroConfigDoc(moduleKey: string): ForgeDoc | null

// Read the saved config values (what useConfig() returns)
sim.ui.getMacroConfig(moduleKey: string): Record<string, unknown> | undefined

// Seed config values before render; useConfig() resolves to these
sim.ui.setMacroConfig(moduleKey: string, values: Record<string, unknown>): void
```

For per-render (non-sticky) config injection, pass `macroConfig` in `RenderContextOptions`:

```typescript
await sim.ui.render('pet-card', { macroConfig: { name: 'Rex', age: 5 } });
```

A bonus diagnostic: if you `render()` a macro module before calling `setMacroConfig` and `useConfig()` returns `{}`, forge-sim emits a hint suggesting `setMacroConfig`; surface this when triaging "why is my macro empty?" tests.

---

## Types

Key types exported from `'forge-sim'`:

```typescript no-check
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
// (0.2 breaking change: the string-returning `route` helper is no longer
// exported — import `route` from '@forge/api' instead. forge-sim serves the
// real implementation, and product requests reject plain-string paths just
// like real Forge.)
export { SimulatedProductApi } from 'forge-sim';
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
| **Scheduled Trigger** | `({ context }) => void` | Return value **ignored** (per Forge docs); only a thrown error fails the fire |
| **Consumer** (async events) | `(event, context) => result` | Returning `new InvocationError(retryOptions)` (or a `QueueResponse` with `.retry()` called) requests a retry — re-delivered with `event.retryContext`, capped at 4 retries. Re-delivery is immediate; forge-sim does not wait out `retryAfter`. |
| **Web Trigger** | `(request) => { statusCode, body?, headers? }` | HTTP-like response |

### Invocation Time Limits

Warnings fire when a function exceeds its Forge time limit:

| Type | Limit |
|------|-------|
| Resolver / Action / Workflow | 25s |
| Trigger / Scheduled Trigger / WebTrigger | 55s |
| Consumer (with `timeoutSeconds`) | Up to 900s |
