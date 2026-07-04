# forge-sim

A local simulation of Atlassian's Forge platform. For CI/CD tests and local development. It's like LocalStack for Forge

* **Fast local development loop.**  Deploying to Forge to test every change slows iteration and is a subtle pain point that grows over time. tunnel → Edit → deploy → wait → check. Repeat. 
* **CI/CD test API** Works for UIKit 2 and backend forge modules. See testing section below

## What's simulated

| Feature | Fidelity |
|---------|----------|
| KVS (`@forge/kvs`) | Full — get/set/delete/query/batch/transact/secrets |
| Custom Entity Store | Full — CRUD, indexed queries, filters, sort, pagination, TTL |
| Forge SQL (`@forge/sql`) | Full — real MySQL 8.4 (via mysql-memory-server), migrations, DDL, parameterized queries |
| Resolvers (`@forge/resolver`) | Full |
| Async Events/Queues (`@forge/events`) | Full — concurrent processing, concurrency keys |
| Product APIs (Jira/Confluence/Bitbucket) | Mock + real API proxy. `requestAtlassian` and `asUser(accountId)` impersonation not implemented |
| Forge Remotes | Full — FIT JWT auth, JWKS endpoint, mock routing |
| External auth providers | Full — `asUser().withProvider()` OAuth + mock-first fetch |
| Custom UI | Full — built-in Vite or `--proxy` your own dev server |
| UIKit 2 (`@forge/react`) | Near-full — 71/73 components; `Tooltip` and `Popup` need React.StrictMode off |
| Event & Scheduled Triggers | Full — 143 event templates with typed payloads, contract validation |
| Web Triggers | Full — `/__trigger/<key>` HTTP endpoints with CORS, dynamic `webTrigger.getUrl()` |
| Background Scripts | Full — `issueView`, `dashboard`, `globalBackgroundScript` via postMessage |
| Custom Fields | Full — `jira:customField`/`customFieldType` with view/edit/viewSubmit |
| Confluence Macros | Full — view + custom config + inline `addConfig()` + `useConfig()` |
| `@forge/llm` (Claude 4.6/4.7) | Full — streaming returns as one chunk, not real SSE |
| `@forge/realtime` | Full — channel pub/sub, scoped + global publishes |
| Rovo Actions | Action invocation: full. Custom UI `rovo.open()` not implemented |
| Workflow Modules | Partial — config UI, function invocation (no transition simulation) |
| Object Store (`@forge/object-store`) | Full — pre-signed URLs, checksums, Range, TTL, CDN bucket |
| Environment Variables | Full — `.forge-sim/variables.json` + `sim.setVariables()`, injected into `process.env` at deploy (redeploy-to-take-effect, like real Forge) |
| Manifest parsing + auto-deploy | Full |
| Persistent state (KVS + SQL + Entities) | Full — save on exit, restore on start |

### Known limitations

forge-sim won't catch bugs that real Forge would:

- **No egress filtering** — `permissions.external` is parsed but not enforced
- **No scope enforcement** — `permissions.scopes` is parsed but not checked at runtime
- **No app lifecycle triggers** — install/uninstall/enable/disable don't fire
- **No rate or memory limits** — Forge's per-app limits aren't simulated
- **`context.environmentType` defaults to `DEVELOPMENT`** — override per render/invoke to simulate staging/prod

## Local Development Loop

Run your Forge app locally by using the `forge-sim dev` command

### Quick Start

Navigate to your forge app directory and run forge-sim in dev mode. This will launch a browser tab that shows a navigable index of all of your UI modules. Click on one to run outside of Atlassian products. 

**Using npx**
```bash
cd /path/to/forge/app
npx forge-sim dev
```

**Installing as a global tool**
```bash
npm install -g forge-sim
cd /path/to/forge/app
forge-sim dev
```

Dev mode features:

- **UIKit 2 and Custom UI** — uses Atlaskit to render UIKit 2 components. Supports Hot Module Reload (HMR) and Chrome Devtools. 
- **Simulates Forge services locally** — Functions, queues, consumers, SQL, KVS, etc.
- **Real API access** — connect your Atlassian account and `requestJira()` hits your real site
- **Local Debugging tools** — KVS browser, SQL console, log viewer, event triggers at `localhost:5173/__tools/`
- **Persistent state** — KVS and SQL survive restarts. `--clean` to start fresh.

```
🔥 forge-sim dev server running!

   UIKit 2 mode • jira:issuePanel:my-panel

   ➜ Local:   http://localhost:5173/
   ➜ Tools:   http://localhost:5173/__tools/
   ➜ WS:      ws://localhost:5174

   🎨 Rendering with real Atlaskit components
   🔧 Source maps enabled — debug in Chrome DevTools
   ♻️  HMR enabled — edits refresh automatically
```

### Connect to your Atlassian site 

```bash
npx forge-sim auth
```

Enter your site URL, email, and [API token](https://id.atlassian.com/manage-profile/security/api-tokens). `requestJira()`, `requestConfluence()`, and `requestBitbucket()` now hit your site for real.

### Proxy mode for Custom UI

Custom UI pages already bundled and referenced in your manifest work out of the box.

Typically, while developing, you will run your Custom UI in development mode using webpack/Vite/Parcel dev server.If your Custom UI has its own dev server, run forge-sim in front of it with `--proxy`:

```bash
# Start your webpack, Vite, or Parcel dev server as usual
cd my-custom-ui-app && npm start  # → http://localhost:3000

# In another terminal, proxy it through forge-sim
npx forge-sim dev --proxy http://localhost:3000
```

forge-sim sits in front of your CustomUI dev server and hosts it in an IFrame with shimmed Forge APIs. HMR and Chrome devtools will just work. 

```
🔥 forge-sim dev (proxy mode)

   Proxied • jira:issuePanel:my-panel
   Upstream:  http://localhost:3000

   ➜ Local:   http://localhost:5173/
   ➜ Tools:   http://localhost:5173/__tools/
   ➜ JWKS:    http://localhost:5173/__forge/jwks.json
   ➜ WS:      ws://localhost:5174

   🔧 Proxying all requests to http://localhost:3000
```

### Forge Remotes — call your own backend (optional)

If your app calls external services via `invokeRemote()` or `requestRemote()`, forge-sim can handle the full flow:

```yaml
# manifest.yml
remotes:
  - key: my-backend
    baseUrl: https://api.example.com

modules:
  endpoint:
    - key: my-endpoint
      remote: my-backend
      route:
        path: /api/v1
```

Every remote request is signed with a **FIT** (Forge Invocation Token) — an RS256 JWT per the [Forge Remote Invocation Contract](https://developer.atlassian.com/platform/forge/forge-remote-invocation-contract/). Your backend validates it against the local JWKS endpoint:

```
http://localhost:5173/__forge/jwks.json
```



See [Remotes documentation](./docs/remotes.md) for the full guide — FIT claims, key persistence, backend validation, and error handling.

### External auth providers (optional)

If your app uses `asUser().withProvider()` for third-party OAuth (Google, GitHub, etc.):

```bash
# Authenticate with providers defined in your manifest.yml
npx forge-sim auth --provider google

# Or authenticate all providers at once
npx forge-sim auth --providers
```

---

## CI\CD testing

**Forge-sim test library — no dependencies on deployments or remote resources** 

Test UIKit, resolvers, queues, triggers, KVS, and SQL against a headless simulated runtime.

```typescript
import { createSimulator } from 'forge-sim';

const sim = createSimulator();

// Deploy your app — manifest.yml drives everything
const result = await sim.deploy('./my-forge-app');

// Mock the product APIs
sim.mockProductRoutes('jira', {
  '/rest/api/3/issue/PROJ-1': { key: 'PROJ-1', summary: 'Fix the thing' },
});

// Test the full stack: resolver → KVS → queue → consumer
const data = await sim.invoke('getIssue', { issueKey: 'PROJ-1' });
expect(data.summary).toBe('Fix the thing');

// Verify side effects
const views = await sim.kvs.get('views:PROJ-1');
expect(views).toBe(1);

// Fire triggers
await sim.fireTrigger('avi:jira:created:issue', { issue: { key: 'PROJ-2' } });

// Run SQL queries
const rows = await sim.sql.query('SELECT * FROM objectives WHERE status = ?', ['active']);
expect(rows).toHaveLength(3);
```

### Test UIKit 2 without a browser

When deployed to Forge, UIKit components are rendered as a json tree called ForgeDoc that is passed to the server to be rendered. forge-sim captures the ForgeDoc output from the actual `@forge/react` package and exposes it to your tests. You can render UIKit 2 modules programmatically, interact with components, and assert on the ForgeDoc tree — no browser, no screenshots, no flaky selectors:

```typescript
// Render a Jira issue panel with context
await sim.ui.render('issue-summary', {
  context: { issueKey: 'PROJ-42' },
});

// Wait for async data to load
const doc = await sim.ui.waitForContent('issue-summary', 'PROJ-42');

// Assert on the rendered component tree
const text = sim.ui.getTextContent(doc);
expect(text).toContain('PROJ-42');
expect(text).toContain('Views: 1');

// Click a button — triggers real React state updates
const { updatedDoc } = await sim.ui.interactWith('Button', { matchText: 'Load Comments' });

// Verify the UI updated
expect(sim.ui.getTextContent(updatedDoc)).toContain('3 comments');

// Verify side effects (KVS writes, queue pushes, etc.)
const views = await sim.kvs.get('views:PROJ-42');
expect(views).toBe(1);
```

A **full integration test of your UI** — resolvers fire, KVS updates, queues process, and the ForgeDoc tree reflects the result. No mocks, no browser automation.

### Mock external services

Same API for product APIs, your own remotes, third-party OAuth providers, and GraphQL:

```typescript
// Product APIs (Jira, Confluence, Bitbucket)
sim.mockProductRoutes('jira', {
  'POST /rest/api/3/issue': { id: '10001', key: 'TEST-1' },
});

// Your Forge Remotes — by manifest key, no real backend needed
sim.mockProductRoutes('my-backend', {
  'GET /api/v1/tasks': [{ id: 1, name: 'Write docs' }],
  'POST /api/v1/tasks': (path, opts) => ({
    id: 2, name: JSON.parse(opts?.body).name,
  }),
});

// Third-party OAuth providers (asUser().withProvider())
sim.mockProductRoutes('google-apis', {
  'GET /userinfo/v2/me': { id: '12345', email: 'test@gmail.com' },
});

// GraphQL operations
sim.mockGraphQL({
  GetCurrentUser: { data: { me: { accountId: 'abc-123' } } },
});
```

Mocks take priority; unmocked routes fall through to a real API if one is connected via `forge-sim auth`.

---

## 🤖 AI-Driven Development

**Let your AI build Forge apps.** forge-sim gives AI agents a complete Forge runtime without credentials, cloud access, or deploy permissions. The agent writes code, deploys it locally, tests it, iterates — all through CLI commands.

```bash
# AI deploys the app (daemon auto-starts)
forge-sim deploy ./my-forge-app

# AI calls a resolver to test it
forge-sim invoke getIssues '{"project": "PROJ"}'

# AI checks what the UI looks like
forge-sim ui

# AI inspects the data layer
forge-sim kvs list
forge-sim sql "SELECT * FROM objectives"

# AI checks logs for errors
forge-sim logs
```

**Zero setup for the AI.** First command auto-starts a background daemon. State persists across calls. Daemon auto-exits after 30 min idle.

### MCP Server

For AI agents that support [Model Context Protocol](https://modelcontextprotocol.io/), forge-sim exposes a full toolkit:

<!-- BEGIN:STATS_COMPACT -->
2,020 tests · 39 MCP tools · 4 MCP resources
<!-- END:STATS_COMPACT -->

```bash
# Native MCP over stdio
forge-sim-mcp

# Or via the daemon's HTTP endpoint
forge-sim serve  # starts on random port, writes to ~/.forge-sim/daemon.port
```

The full tool list: `deploy`, `invoke`, `fire_trigger`, `fire_scheduled_trigger`, `ui_state`, `ui_interact`, `kvs_get`, `kvs_set`, `kvs_list`, `queue_push`, `queue_state`, `logs`, `sql_execute`, `sql_migrate`, `sql_schema`, `entity_get`, `entity_set`, `entity_delete`, `entity_query`, `entity_list`, `auth_status`, `mock_routes`, `mock_graphql`, `llm_mock`, `llm_history`, `realtime_publish`, `realtime_state`, `reset`. 143 trigger event templates with typed payloads are built-in for Confluence, Jira, Jira Software, and App Lifecycle events.

### As an AI Skill

Point your AI agent at the CLI and it just works:

```
Deploy a Forge app:    forge-sim deploy <dir>
Call a resolver:       forge-sim invoke <functionKey> [payloadJSON]
Fire a trigger:        forge-sim trigger <event> [dataJSON]
Check UI state:        forge-sim ui
Read KVS:             forge-sim kvs list
Run SQL:              forge-sim sql "SELECT * FROM ..."
View logs:            forge-sim logs
Reset everything:     forge-sim reset
```

No API keys. No cloud credentials. No risk of the AI accidentally deploying to production. Just a sandbox.

---




## Installation

Requires **Node.js 22+** (uses native TypeScript type stripping for `.ts` loader hooks).

```bash
# As a dev dependency (recommended)
npm install --save-dev forge-sim

# Or install globally
npm install -g forge-sim
```

## Documentation

See [docs/](./docs/) for the full reference:

- [Architecture](./docs/architecture.md) — How forge-sim intercepts `@forge/*` imports and bridges
- [CLI Reference](./docs/cli.md) — All commands and options
- [Authentication](./docs/auth.md) — API tokens, OAuth, external auth providers, credential management
- [Forge Remotes](./docs/remotes.md) — External backends, FIT JWT auth, JWKS endpoint, mock routing
- [Programmatic API](./docs/api.md) — Using forge-sim in code
- [MCP Server](./docs/mcp.md) — AI agent integration
- [UIKit Renderer](./docs/renderer.md) — Architecture, browser mode, component coverage
- [Implementation Matrix](./docs/implementation-matrix.md) — Full API coverage status
- [Module Support](./docs/module-support.md) — Per-module-type support matrix
- [Module Contexts](./docs/module-contexts.md) — Per-module `extension.*` shapes
- [Testing Patterns](./docs/testing.md) — Vitest/Jest examples, fixtures, common patterns
- [Dev Tools](./docs/tools.md) — Built-in KVS browser, SQL console, log viewer

## Development

```bash
npm install
npm run build               # TypeScript compile
npm test                    # core test suite
cd renderer && npx vitest run   # renderer tests
npm run docs:stats          # sync auto-generated stats blocks in docs
npm run docs:stats:check    # CI guard — fails if stats are stale
```

<!-- BEGIN:STATS -->
**2,020 tests** across **104** test files
(1,873 core / 100 files
+ 147 renderer / 4 files)

**39 MCP tools** + **4 resources**
<!-- END:STATS -->

## License

Pre-release. License will be assigned at first npm publish.
