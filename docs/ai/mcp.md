# MCP Server

forge-sim exposes the testing engine as a headless simulator to AI agents via [Model Context Protocol](https://modelcontextprotocol.io/).

## Transport Options

### Stdio (stateless per-connection)

```bash
forge-sim-mcp
```

Each MCP client connection gets a fresh simulator. Good for one-shot tool calls, but state doesn't persist between connections.

### Daemon (stateful, recommended for AI agents)

```bash
# CLI commands auto-start the daemon
forge-sim deploy ./my-app
forge-sim invoke myResolver

# Or start explicitly
forge-sim serve
```

The daemon runs as a background process. State persists across all CLI and API calls. See [CLI Reference](../reference/cli.md#daemon-lifecycle) for lifecycle details.

### Claude Code / MCP Client Config

For MCP clients that support stdio servers, add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "forge-sim": {
      "command": "forge-sim-mcp",
      "args": []
    }
  }
}
```


## Talking to real Atlassian APIs and providers

By default the MCP simulator is fully isolated: unmocked product API calls return a `501` with a hint to register a mock, and `withProvider()` calls run in mock mode. That's the right default for automated tests, but for live iteration you often want the AI's app code hitting your real Jira/Confluence site and real provider endpoints instead of mocks.

Credential setup happens **outside** the MCP session, with the CLI. `forge_deploy` re-reads the credential store on every call, so credentials added mid-session are picked up on the next deploy, no daemon restart needed.

### Atlassian APIs (PAT)

Add an Atlassian account with a Personal Access Token:

```bash
forge-sim auth
```

This prompts for your site URL, email, and PAT, and stores them in the credential store (`.forge-sim/credentials.json` in the app directory if present, otherwise `~/.forge-sim/credentials.json`). After the next `forge_deploy`, `requestJira` / `requestConfluence` calls that don't match a registered mock go to your real site, authenticated with the PAT.

### Third-party providers (OAuth)

For providers declared in your manifest (`providers.auth`), run the OAuth dance from the CLI before the MCP session:

```bash
forge-sim auth --provider google --secret   # set the client secret first (one time)
forge-sim auth --provider google            # opens the browser, runs the authorization flow
```

Tokens land in the same credential store. After the next `forge_deploy`, `api.asUser().withProvider('google')` calls use the real token instead of mock mode.

> If `forge-sim dev` is running, the CLI can't run the OAuth dance (the callback listener needs port 5173, which the dev server holds). Use the Providers panel in the Tools UI at `http://localhost:5173/__tools/` instead; tokens end up in the same store either way.

### Environment variables

As an alternative to the credential store, credentials can come from env vars (env vars win when both are set):

```
FORGE_SIM_SITE=mysite.atlassian.net
FORGE_SIM_EMAIL=you@example.com
FORGE_SIM_PAT=ATATT3x...
FORGE_SIM_PROVIDER_GOOGLE_TOKEN=ya29...   # FORGE_SIM_PROVIDER_<KEY>_TOKEN, key uppercased, hyphens → underscores
```

These must be set in the **MCP server's process environment**; exporting them in your shell profile does not reach a server launched by an MCP client. Put them in the `env` block of your `.mcp.json`:

```json
{
  "mcpServers": {
    "forge-sim": {
      "command": "forge-sim-mcp",
      "env": {
        "FORGE_SIM_SITE": "mysite.atlassian.net",
        "FORGE_SIM_EMAIL": "you@example.com",
        "FORGE_SIM_PAT": "ATATT3x..."
      }
    }
  }
}
```

### How routing works once connected

Mocks still take priority. A route registered with `forge_mock_routes` or `forge_mock_graphql` is served from the mock; anything unmatched falls through to the real API. This lets an AI agent mix both: mock the endpoints under test, hit the real site for everything else.

The `forge_deploy` response includes an `auth` block showing what connected, and `forge_auth_status` reports the current account, provider tokens, and manifest providers at any time.

See [Credentials](../local-development/credentials.md) for the full `forge-sim auth` flag reference.

## Overlap with `forge-sim dev`

The MCP daemon and `forge-sim dev` are **separate processes with separate runtime state**. Each holds its own simulator: its own in-memory KVS, its own embedded MySQL instance, its own queues, logs, and deployed app. Nothing you do in one is visible in the other at runtime.

Common point of confusion: `forge-sim kvs list` (and the other daemon CLI commands) talk to the **daemon**, not the dev server. Running it while `forge-sim dev` is up works fine, but it shows the daemon's KVS, not what your dev-mode app has stored. To inspect dev-mode state, use the Dev Tools at `http://localhost:5173/__tools/`.

What the two surfaces **do** share is the `.forge-sim/` directory on disk:

| Path | Shared? | Notes |
|------|---------|-------|
| `credentials.json` | ✅ Shared | Atlassian accounts + provider tokens. Local `.forge-sim/` checked first, then `~/.forge-sim/`. Auth once with the CLI; dev mode, MCP, and the test library all read it. |
| `providers.json` | ✅ Shared | OAuth client secrets for manifest providers. |
| `variables.json` | ✅ Shared | Environment variables — read at deploy time by every surface. |
| `fit-keys/` | ✅ Shared | FIT signing keys for remotes. Sharing these means your remote backend's cached JWKS stays valid across surfaces. |
| `bundles/` | ✅ Shared | Resolver bundle cache. Each deploy writes fresh files, so concurrent use is safe. |
| `state/` | ❌ Dev mode only | Persisted KVS + SQL state, auto-saved and restored by `forge-sim dev`. The MCP daemon and test library never read or write it: seeding KVS via `forge_kvs_set` does not appear in dev mode, and dev-mode data does not appear in `forge_kvs_list`. |

In practice: credentials, secrets, and variables are set-once-and-shared; runtime data is per-process. Running `forge-sim dev` and an MCP session against the same app directory at the same time is fine; they won't corrupt each other, they just won't see each other's data.

## Tools

<!-- BEGIN:STATS_COMPACT -->
2,427 tests · 41 MCP tools · 4 MCP resources
<!-- END:STATS_COMPACT -->

| Tool | Description |
|------|-------------|
| `forge_deploy` | Deploy a Forge app from a directory (auto-loads auth credentials) |
| `forge_sim_info` | Return daemon-process metadata (PID, start time, dist mtime, stale flag); sanity-check before debugging confusing tool errors |
| `forge_invoke` | Call a resolver function with payload |
| `forge_fire_trigger` | Simulate product event triggers |
| `forge_fire_scheduled_trigger` | Fire a scheduled trigger by key |
| `forge_fire_web_trigger` | Fire a web trigger by key — simulated HTTP request, `(request, context)` convention, returns `{ statusCode, headers, body }` |
| `forge_ui_render` | Render a UI module by manifest key: loads bundle, builds context, returns ForgeDoc (and MacroConfig tree for inline-config macros) |
| `forge_ui_wait_for` | Wait for text to appear in a module's rendered tree; settles async `useEffect → invoke()` chains after `ui_render` or `ui_interact` |
| `forge_ui_state` | Get the current ForgeDoc UI tree |
| `forge_ui_interact` | Click buttons and fire events on components found by type/text |
| `forge_ui_fill_form` | Fill form fields **by name** and optionally submit — fires the correct per-type event shape (Select option objects, checked booleans) and settles effects first; prefer over `ui_interact` for form input |
| `forge_kvs_get` | Get a KVS value by key |
| `forge_kvs_set` | Set a KVS value (for test setup) |
| `forge_kvs_list` | List/dump KVS contents (optional prefix filter) |
| `forge_objectstore_list` | List Object Store objects (metadata, optional bucket filter) |
| `forge_objectstore_get` | Get object metadata + content (utf-8 or base64, 64 kB cap) |
| `forge_objectstore_put` | Seed an object directly (test setup) |
| `forge_objectstore_delete` | Delete an object by key |
| `forge_objectstore_create_download_url` | Pre-signed download URL (curl-able, Range-capable) |
| `forge_variables_set` | Set ephemeral env variables; take effect at next deploy (Forge parity) |
| `forge_variables_unset` | Remove an ephemeral env variable |
| `forge_variables_list` | List env variables from all sources (encrypted values masked) |
| `forge_queue_push` | Push events to a queue |
| `forge_queue_state` | Inspect queue jobs and event log |
| `forge_logs` | Get simulator + captured console.* logs |
| `forge_sql_execute` | Execute SQL queries (real MySQL) |
| `forge_sql_migrate` | Run idempotent database migrations |
| `forge_sql_schema` | Inspect database schema |
| `forge_entity_get` | Get a Custom Entity by name + key |
| `forge_entity_set` | Create/update a Custom Entity |
| `forge_entity_delete` | Delete a Custom Entity |
| `forge_entity_query` | Query entities with indexes, filters, sort, pagination |
| `forge_entity_list` | List all entities and schemas |
| `forge_auth_status` | Show Atlassian account info, 3p provider tokens, and auth status |
| `forge_mock_routes` | Register mock HTTP responses for product APIs (Jira, Confluence, Bitbucket) or remotes |
| `forge_mock_graphql` | Register mock GraphQL operation responses (gateway) |
| `forge_llm_mock` | Queue mock responses for `@forge/llm` chat() calls |
| `forge_llm_history` | Inspect captured `@forge/llm` chat() call history |
| `forge_realtime_publish` | Publish events to a Forge Realtime channel |
| `forge_realtime_state` | Inspect realtime subscriptions and event log |
| `forge_reset` | Clear all state |


## Resources (4)

| URI | Description |
|-----|-------------|
| `forge://manifest` | Current deployed manifest |
| `forge://functions` | Registered resolver functions |
| `forge://triggers` | Registered triggers and events |
| `forge://state` | Full state snapshot (KVS + queue + UI) |

## Common gotchas

### `forge-sim` is rebuilt mid-session → the daemon serves stale code

This bites devs working on forge-sim itself, not app authors. If you're hitting "method is not a function" errors from MCP calls right after rebuilding `dist/`, the long-lived daemon has the old code in memory. The simulator self-checks dist mtimes on every MCP response — and when stale, it **restarts itself automatically**: the in-flight response carries a `♻️ STALE ... auto-restarting` notice, the daemon exits right after replying, and the MCP client respawns it with fresh code on the next tool call. In-memory simulator state dies with the daemon, so call `forge_deploy` again before invoking. `forge_sim_info` reports the daemon's PID, start time, stale flag, and auto-restart status on demand. Set `FORGE_SIM_STALE_AUTORESTART=off` for the old warn-only behavior (manual `kill <pid>` recovery). See [architecture.md § Known gotcha: stale daemon](../reference/architecture.md#known-gotcha-stale-daemon-on-rebuild).
