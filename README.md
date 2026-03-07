# forge-sim

Simulated Forge runtime for developing and testing Atlassian Forge apps — without deploying to Atlassian.

## What This Does

Run your Forge app locally with a full simulation of the Forge platform. Deploy an app with one call — manifest-driven, zero app modifications. Optionally connect to real Atlassian APIs for live data.

## Features

- **Full @forge/\* shim layer** — App code imports `@forge/api`, `@forge/kvs`, `@forge/events`, `@forge/resolver`, `@forge/sql` and gets our sim. Zero changes needed.
- **Manifest-driven deploy** — Point at an app directory, everything wires up automatically
- **Real Atlassian API access** — Connect your account and `requestJira()` hits real Jira (PAT or OAuth)
- **UIKit 2 Renderer** — Real Atlaskit components, live preview, Chrome DevTools debugging
- **Forge SQL** — Real ephemeral MySQL 8.4 via `mysql-memory-server`
- **Custom Entity Store** — In-memory `@forge/kvs` entity backend with indexes, filters, TTL, transactions
- **Persistent state** — KVS and SQL data survive restarts
- **Concurrent queue processing** — Expose real race conditions in consumer code
- **Mockable product APIs** — Route-based mocks, with real API fallback when credentials exist
- **MCP server** — 20 tools + 4 resources for AI agent integration (stdio + HTTP)

## Quick Start

```bash
# In your Forge app directory
npm install --save-dev forge-sim

# Connect to your Atlassian site (one-time)
npx forge-sim auth

# Start developing
npx forge-sim dev
```

## Installation

### As a dev tool (recommended)

```bash
npm install --save-dev forge-sim
```

### Via npm link (development)

```bash
# In the forge-sim repo
npm run build
npm link

# In your Forge app directory
npm link forge-sim
```

## Authentication

forge-sim can connect to real Atlassian APIs so `requestJira()`, `requestConfluence()`, etc. return live data. Two auth methods are supported:

### API Token (default — recommended)

The simplest way to connect. Takes about 30 seconds:

```bash
forge-sim auth
```

You'll be prompted for:
1. **Atlassian site** — e.g., `mysite.atlassian.net`
2. **Email** — your Atlassian account email
3. **API token** — create one at [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)

forge-sim validates your credentials by calling `/rest/api/3/myself` and automatically detects your Cloud ID.

### OAuth 2.0 (advanced — multi-user testing)

For testing with multiple user accounts or specific permission scopes:

```bash
# First time: register your OAuth app
forge-sim auth --setup

# Then add accounts via browser-based OAuth
forge-sim auth --oauth
```

**OAuth app setup:**
1. Go to [developer.atlassian.com/console/myapps](https://developer.atlassian.com/console/myapps/)
2. Create an OAuth 2.0 (3LO) app
3. Set callback URL: `http://localhost:5173/__tools/oauth/callback`
4. Add Jira and/or Confluence API permissions
5. Copy Client ID and Secret into `forge-sim auth --setup`

### Managing Accounts

```bash
forge-sim auth              # Add account or switch default
forge-sim auth --list       # List all configured accounts
forge-sim auth --remove ID  # Remove a specific account
forge-sim auth --clear      # Remove all accounts (keeps OAuth app config)
forge-sim auth --clear-all  # Remove everything (accounts + OAuth app config)
forge-sim auth --local      # Store credentials per-app instead of global
```

### How It Works

When `forge-sim dev` starts, it checks for stored credentials and automatically connects to real APIs:

```
📡 Connected to real APIs as Ryan Ackley @ mysite.atlassian.net
```

If no credentials exist, it falls back to mock APIs with a helpful message:

```
📡 No Atlassian accounts — using mock APIs
   Run 'forge-sim auth' to connect to a real site
```

**Mock routes take priority** — you can mock specific endpoints while using real APIs for everything else:

```typescript
// Real API for most calls, but mock this specific endpoint
sim.mockProductRoutes('jira', {
  'POST /rest/api/3/issue': { id: '10001', key: 'TEST-1' },
});
```

### Credential Storage

| File | Contents |
|------|----------|
| `~/.forge-sim/config.json` | OAuth app config (Client ID/Secret) |
| `~/.forge-sim/credentials.json` | User accounts and tokens |
| `<app>/.forge-sim/credentials.json` | Per-app override (with `--local`) |

All credential files are created with `0600` permissions (owner read/write only).

### Environment Variables

For CI/CD or non-interactive environments:

```bash
# API Token
export FORGE_SIM_SITE=mysite.atlassian.net
export FORGE_SIM_EMAIL=user@example.com
export FORGE_SIM_API_TOKEN=ATATT3x...

# OAuth (alternative)
export FORGE_SIM_OAUTH_CLIENT_ID=your-client-id
export FORGE_SIM_OAUTH_CLIENT_SECRET=your-client-secret
```

## CLI Reference

### `forge-sim dev`

Start the dev server with live UI preview.

```bash
forge-sim dev [appDir]

Options:
  --port <port>     Vite dev server port (default: 5173)
  --ws-port <port>  WebSocket bridge port (default: 5174)
  --no-open         Don't open browser automatically
  --module <key>    Specific UI module key to render
  --clean           Start fresh (ignore persisted state)
```

### `forge-sim auth`

Manage Atlassian account credentials. See [Authentication](#authentication) above.

### `forge-sim mcp`

Start the MCP server for AI agent integration.

```bash
forge-sim mcp [--http] [--port 3100]
```

## Persistent State

App data survives restarts. On `Ctrl+C`, forge-sim saves:

- **KVS data** → `<app>/.forge-sim/state/kvs.json`
- **SQL data** → `<app>/.forge-sim/state/sql.dump`

On next startup, state is restored automatically. Use `--clean` to start fresh:

```bash
forge-sim dev --clean
```

**Important:** `--clean` only wipes app state (KVS/SQL). Your credentials are stored separately in `~/.forge-sim/` and are never affected.

The `.forge-sim/` directory in your app is auto-gitignored.

## Programmatic API

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

Run with loader hooks for standalone execution (intercepts `@forge/*` imports):

```bash
node --import forge-sim/dist/loader/register.js your-app.js
```

## UIKit 2 Renderer

Real-time visual preview of Forge UIKit apps using genuine Atlaskit components. See your app exactly as it would look in Jira/Confluence — without deploying.

### Architecture

Two modes, one backend:

**Server mode (AI/MCP-driven):**
```
Node (forge-sim)
├── @forge/react reconciler → produces ForgeDoc
├── Resolvers, KVS, SQL, Product APIs
├── MCP tools for programmatic control
└── WebSocket → Renderer (optional browser visualization)
```

**Browser mode (human dev, CDT debuggable):**
```
Browser
├── @forge/react runs HERE (debuggable in Chrome DevTools)
├── Event handlers, useState, useEffect — all client-side
├── @forge/bridge shim → WebSocket → forge-sim backend

forge-sim (Node)
├── Resolvers, KVS, SQL, Product APIs
└── Handles invoke() and requestProduct() calls
```

### Browser Mode (@forge/bridge Shim)

For Chrome DevTools debugging, use the Vite plugin to alias `@forge/bridge` to our WebSocket shim:

```typescript
// vite.config.ts (in your Forge app)
import { forgeSimPlugin } from 'forge-sim/renderer/bridge/vite-plugin-forge-sim';

export default defineConfig({
  plugins: [react(), forgeSimPlugin()],
});
```

This lets you set breakpoints in event handlers, use React DevTools, and inspect state changes in real-time — all while `invoke()` calls route to forge-sim's backend.

### Component Coverage: 73/73 UIKit 2 Components

| Category | Components |
|----------|-----------|
| Layout | Box, Stack, Inline, Pressable, Text, Heading |
| Buttons | Button, ButtonGroup, LinkButton, LoadingButton |
| Form | Form, FormHeader, FormFooter, FormSection, TextField, TextArea, Select, Checkbox, CheckboxGroup, Radio, RadioGroup, Toggle, Range, DatePicker, TimePicker, Calendar |
| Form Helpers | Label, ErrorMessage, HelperMessage, ValidMessage, RequiredAsterisk |
| Display | Badge, Lozenge, Spinner, ProgressBar, ProgressTracker, SectionMessage, SectionMessageAction, EmptyState, Code, CodeBlock, Tooltip, Tag, TagGroup, Link, Image, Icon, Flag, InlineDialog |
| Table | Table, Head, Row, Cell, DynamicTable |
| Tabs | Tabs, Tab, TabList, TabPanel |
| Modal | Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter, ModalTransition |
| List | List, ListItem |
| Tiles | Tile, AtlassianTile, AtlassianIcon |
| File | FileCard, FilePicker |
| Editors | ChromelessEditor, CommentEditor (placeholder) |
| Charts | BarChart, StackBarChart, HorizontalBarChart, HorizontalStackBarChart, LineChart, PieChart, DonutChart |

## Forge Sim Tools

Built-in dev tools UI at `http://localhost:5173/__tools/` when running `forge-sim dev`. Provides:

- **Logs** — Real-time log viewer (app + simulator)
- **KVS** — Browse, edit, and delete key-value storage entries
- **SQL** — Run queries, inspect schema and tables
- **Events** — Queue stats, push events, fire triggers

WebSocket at `/__tools/ws` broadcasts live updates (`log`, `stateChange` events).

## Transactions

Forge KVS transactions are **write-only** — a builder pattern for atomic multi-key writes:

```typescript
import { kvs } from '@forge/kvs';

await kvs.transact()
  .set('board:sprint-42', updatedBoard)
  .set('votes:sprint-42:item-1', voterList)
  .delete('temp:draft-42')
  .execute();
```

## Function Contracts

forge-sim enforces the correct calling convention for each Forge function type:

| Type | Signature | Return Contract |
|------|-----------|-----------------|
| **Resolver** (UI bridge) | `({ payload, context }) => result` | Any JSON |
| **Event Trigger** | `(event, context) => result` | Any |
| **Scheduled Trigger** | `({ context }) => { statusCode }` | Must return `{ statusCode }` or 424 |
| **Consumer** (async events) | `(event, context) => result` | `InvocationError` = retry |
| **Web Trigger** | `(request, context) => { statusCode, body?, headers? }` | HTTP-like response |

## What's Simulated

| Feature | Status |
|---------|--------|
| Key-Value Storage (`@forge/kvs`) | ✅ Full (get/set/delete/query/batch/transact/secrets) |
| Custom Entity Store (`@forge/kvs` entities) | ✅ Full (CRUD, index queries, filters, sort, pagination, TTL, batch, transactions) |
| Forge SQL (`@forge/sql`) | ✅ Full (real MySQL 8.4, migrations, DDL, parameterized queries) |
| Resolvers (`@forge/resolver`) | ✅ Full |
| Async Events / Queues (`@forge/events`) | ✅ Full (concurrent mode, concurrency keys) |
| Product APIs (Jira/Confluence/Bitbucket) | ✅ Mock + Real API proxy |
| UIKit 2 Rendering (`@forge/react`) | ✅ 73/73 components, live preview, event bridge |
| Browser Mode (CDT debuggable) | ✅ @forge/bridge shim + Vite plugin |
| Manifest Parsing + Auto-Deploy | ✅ Full |
| Event Triggers | ✅ Full |
| Scheduled Triggers | ✅ Full (with `statusCode` validation) |
| Persistent State (KVS + SQL) | ✅ Full (save on exit, restore on start) |
| Authentication (PAT + OAuth) | ✅ Full |
| Forge Sim Tools (Dev UI) | ✅ MVP (logs, KVS, SQL, events) |
| MCP Server | ✅ 20 tools, 4 resources (stdio + HTTP) |
| `forge-sim dev` CLI | ✅ One-command dev experience |
| Custom UI Support | ✅ Basic (Vite serves resource directory) |
| Web Triggers | 🔜 Planned |

## MCP Server

Expose the simulator to AI agents via Model Context Protocol.

```bash
# stdio
forge-sim mcp

# HTTP (persistent state across calls)
forge-sim mcp --http --port 3100
```

### Tools (20)

| Tool | Description |
|------|-------------|
| `forge.deploy` | Deploy a Forge app from a directory |
| `forge.invoke` | Call a resolver function with payload |
| `forge.fire_trigger` | Simulate product event triggers |
| `forge.fire_scheduled_trigger` | Fire a scheduled trigger |
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
| `forge.sql_schema` | Inspect database schema |
| `forge.entity_get` | Get a Custom Entity by name + key |
| `forge.entity_set` | Create/update a Custom Entity |
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
npm run build      # TypeScript compile
npm test           # 239 tests across 22 test files
```

## License

Private — not yet published.
