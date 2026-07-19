# AI-driven development

forge-sim gives an AI agent a simulated Forge runtime that needs no Atlassian credentials and no deploy permissions. The agent can write code, deploy it locally, invoke resolvers, fire triggers, inspect KVS/SQL, and read logs, fully sandboxed as long as you use mocks. Connecting a real account (`forge-sim auth`) enables real-API passthrough for unmocked product API calls; mocked routes always stay local, so you control the blast radius.

Agents drive forge-sim two ways: the CLI (paste-able into a prompt) or the MCP server (for clients that speak [Model Context Protocol](https://modelcontextprotocol.io/)).

## In this section

- [MCP server](./mcp.md) — transport options, the tool list, and resources.

The CLI commands an agent uses (`deploy`, `invoke`, `trigger`, `ui`, `kvs`, `sql`, `logs`, `reset`) and the daemon lifecycle are documented in the [CLI reference](../reference/cli.md).

## CLI

The first command auto-starts a background daemon that holds state across calls and exits after 30 minutes idle.

```bash
forge-sim deploy ./my-forge-app
forge-sim invoke getIssues '{"project": "PROJ"}'
forge-sim ui
forge-sim kvs list
forge-sim sql "SELECT * FROM objectives"
forge-sim logs
```

## MCP server

```bash
# Native MCP over stdio
forge-sim-mcp

# Or via the daemon's HTTP endpoint
forge-sim serve   # random port, written to ~/.forge-sim/daemon.port
```

See [MCP server](./mcp.md) for the full tool and resource list and transport details.
