# MCP Server

forge-sim exposes the full simulator to AI agents via [Model Context Protocol](https://modelcontextprotocol.io/).

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

The daemon runs as a background process. State persists across all CLI and API calls. See [CLI Reference](./cli.md#daemon-lifecycle) for lifecycle details.

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

> **Note:** The stdio transport is stateless — each connection starts fresh. For persistent state, use the daemon CLI commands instead.

## Tools (22)

| Tool | Description |
|------|-------------|
| `forge.deploy` | Deploy a Forge app from a directory (auto-loads auth credentials) |
| `forge.invoke` | Call a resolver function with payload |
| `forge.fire_trigger` | Simulate product event triggers |
| `forge.fire_scheduled_trigger` | Fire a scheduled trigger by key |
| `forge.ui_state` | Get the current ForgeDoc UI tree |
| `forge.ui_interact` | Click buttons, submit forms, interact with UI |
| `forge.kvs_get` | Get a KVS value by key |
| `forge.kvs_set` | Set a KVS value (for test setup) |
| `forge.kvs_list` | List/dump KVS contents (optional prefix filter) |
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
| `forge.auth_status` | Show Atlassian account info, 3p provider tokens, and auth status |
| `forge.reset` | Clear all state |

## Resources (4)

| URI | Description |
|-----|-------------|
| `forge://manifest` | Current deployed manifest |
| `forge://functions` | Registered resolver functions |
| `forge://triggers` | Registered triggers and events |
| `forge://state` | Full state snapshot (KVS + queue + UI) |
