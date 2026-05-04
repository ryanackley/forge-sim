# forge-sim - Build and test Forge apps locally

forge-sim has two major components. 

* A simulated forge environment for local development and testing - no deploys, no tunnels, no waiting.
* A unit testing library for forge apps including components to test UIKit. 

---

## Local Development

**Deploying to Forge for development sucks** Forge's edit → deploy → tunnel → wait → check cycle kills flow state. forge-sim replaces it with instant feedback.

```bash
# In your Forge app directory
npx forge-sim dev
```

That's it. One command gives you:

- **Live UI preview** — Real Atlaskit components rendered in your browser, exactly how they'll look in Jira/Confluence
- **Hot reload** — Edit your code, see changes instantly
- **Chrome DevTools** — Set breakpoints in your event handlers, inspect React state, use the console
- **Real API access** — Connect your Atlassian account and `requestJira()` hits your actual site
- **Built-in dev tools** — KVS browser, SQL console, log viewer, event triggers at `localhost:5173/__tools/`
- **Persistent state** — KVS and SQL data survive restarts. `--clean` to start fresh.

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

### Connect to your Atlassian site (optional)

```bash
npx forge-sim auth
```

Enter your site URL, email, and [API token](https://id.atlassian.com/manage-profile/security/api-tokens). Now `requestJira()`, `requestConfluence()`, and `requestBitbucket()` return real data. Mock specific endpoints while using real APIs for everything else:

```typescript
sim.mockProductRoutes('jira', {
  'POST /rest/api/3/issue': { id: '10001', key: 'TEST-1' },
});
```

### Proxy mode — use your own dev server (optional)

Already have a webpack, Vite, or Parcel dev server? Use `--proxy` instead of forge-sim's built-in Vite:

```bash
# Start your dev server as usual
cd my-custom-ui-app && npm start  # → http://localhost:3000

# In another terminal, proxy it through forge-sim
npx forge-sim dev --proxy http://localhost:3000
```

forge-sim sits in front of your dev server and:

- **Injects the bridge shim** into HTML responses so `@forge/bridge` works
- **Passes through WebSocket** upgrades for HMR (hot module reload)
- **Intercepts forge-sim routes** (`/__tools/*`, `/__forge/*`) before proxying
- **Bakes in the module key** so endpoint resolution works automatically

Your existing dev workflow stays exactly the same — forge-sim just adds the Forge runtime on top.

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

If your app calls external services via `invokeRemote()` or `requestRemote()`, forge-sim handles the full flow:

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

forge-sim signs every remote request with a **FIT (Forge Invocation Token)** — an RS256 JWT matching the [Forge Remote Invocation Contract](https://developer.atlassian.com/platform/forge/forge-remote-invocation-contract/). Your backend validates it against the local JWKS endpoint:

```
http://localhost:5173/__forge/jwks.json
```

For testing, mock remote responses without a real backend:

```typescript
sim.mockProductRoutes('my-backend', {
  'GET /api/v1/tasks': [{ id: 1, name: 'Write docs' }],
  'POST /api/v1/tasks': (path, opts) => ({
    id: 2, name: JSON.parse(opts?.body).name,
  }),
});
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

In mock mode (the default), just register mock routes — no tokens needed:

```typescript
sim.mockProductRoutes('google-apis', {
  'GET /userinfo/v2/me': { id: '12345', email: 'test@gmail.com' },
});
```

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

**Zero setup for the AI.** No server to start, no ports to configure. The first command auto-starts a background daemon. State persists across calls. The daemon auto-exits after 30 minutes of inactivity.

### MCP Server

For AI agents that support [Model Context Protocol](https://modelcontextprotocol.io/), forge-sim exposes a full toolkit:

<!-- BEGIN:STATS_COMPACT -->
1,207 tests · 28 MCP tools · 4 MCP resources
<!-- END:STATS_COMPACT -->

```bash
# Native MCP over stdio
forge-sim-mcp

# Or via the daemon's HTTP endpoint
forge-sim serve  # starts on random port, writes to ~/.forge-sim/daemon.port
```

The full tool list: `deploy`, `invoke`, `fire_trigger`, `fire_scheduled_trigger`, `ui_state`, `ui_interact`, `kvs_get`, `kvs_set`, `kvs_list`, `queue_push`, `queue_state`, `logs`, `sql_execute`, `sql_migrate`, `sql_schema`, `entity_get`, `entity_set`, `entity_delete`, `entity_query`, `entity_list`, `auth_status`, `mock_routes`, `mock_graphql`, `llm_mock`, `llm_history`, `realtime_publish`, `realtime_state`, `reset`. 141 trigger event templates with typed payloads are built-in for Confluence, Jira, Jira Software, and App Lifecycle events.

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

## 🧪 Integration Testing

**Real integration tests without the real integration point.** Test your resolvers, queues, triggers, KVS, and SQL against an actual simulated runtime — not mocked function calls.

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

### Test your UI without a browser

Render UIKit modules programmatically, interact with components, and assert on the ForgeDoc tree — no browser, no screenshots, no flaky selectors:

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

This is a **full integration test of your UI** — resolvers fire, KVS updates, queues process, and the ForgeDoc tree reflects the result. No mocking, no browser automation.

### Why not just mock `@forge/kvs`?

Because mocking individual imports doesn't test your app. It tests your assumptions about the platform. forge-sim runs your **actual code** through an **actual runtime** — manifest parsing, function wiring, queue processing, transaction atomicity, SQL migrations — the works. When your tests pass here, they pass on Forge.

### What's simulated

| Feature | Fidelity |
|---------|----------|
| KVS (`@forge/kvs`) | Full — get/set/delete/query/batch/transact/secrets |
| Custom Entity Store | Full — CRUD, indexed queries, filters, sort, pagination, TTL |
| Forge SQL (`@forge/sql`) | Full — real MySQL 8.4, migrations, DDL, parameterized queries |
| Resolvers (`@forge/resolver`) | Full |
| Async Events/Queues (`@forge/events`) | Full — concurrent processing, concurrency keys |
| Product APIs (Jira/Confluence/Bitbucket) | Mock + real API proxy |
| Forge Remotes | Full — FIT JWT auth, JWKS endpoint, mock routing |
| Custom UI | Full — built-in Vite or `--proxy` your own dev server |
| UIKit 2 (`@forge/react`) | Full — 73/73 components, live preview, dark/light/auto color mode |
| Event & Scheduled Triggers | Full — 141 event templates with typed payloads, contract validation |
| Web Triggers | Full — `/__trigger/<key>` HTTP endpoints with CORS, dynamic `webTrigger.getUrl()` |
| Background Scripts | Full — `issueView`, `dashboard`, `globalBackgroundScript` via postMessage |
| Custom Fields | Full — `jira:customField`/`customFieldType` with view/edit/viewSubmit |
| `@forge/llm` (Claude 4.6/4.7) | Full — `forge-sim auth --llm` for the Anthropic key |
| `@forge/realtime` | Full — channel pub/sub, scoped + global publishes |
| Rovo Actions | Full — manifest parsing, input schema validation, MCP invocation |
| Workflow Modules | Partial — config UI, function invocation (no transition simulation) |
| Manifest parsing + auto-deploy | Full |
| Persistent state (KVS + SQL) | Full — save on exit, restore on start |

### CI-friendly

No browser, no GUI, no Atlassian credentials required. Runs in any Node.js environment:

```typescript
import { createSimulator } from 'forge-sim';

const sim = createSimulator();
await sim.deploy('./my-forge-app');  // Auto-registers @forge/* loader hooks
```

`deploy()` automatically registers Node.js loader hooks that intercept `@forge/*` imports and redirect them to forge-sim's shims. Your app code doesn't know the difference. No `--import` flag needed.

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
**1,207 tests** across **63** test files
(1,095 core / 61 files
+ 112 renderer / 2 files)

**28 MCP tools** + **4 resources**
<!-- END:STATS -->

## License

Pre-release. License will be assigned at first npm publish.
