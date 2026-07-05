# CLI Reference

## `forge-sim dev`

Start the dev server with live UI preview. This is the primary command for local development.

```bash
forge-sim dev [appDir]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--port <port>` | 5173 | Dev server port |
| `--ws-port <port>` | 5174 | WebSocket bridge port |
| `--proxy <url>` | — | Proxy mode: reverse-proxy an existing dev server, inject bridge shim |
| `--no-open` | — | Don't open browser automatically |
| `--module <key>` | auto | Specific UI module key to render |
| `--clean` | — | Start fresh (wipe app state, keep credentials) |
| `--issue <key>` | — | Set Jira issue context (e.g., `PROJ-42`) — hydrates via real API if connected |
| `--content <id>` | — | Set Confluence content context (e.g., `12345`) |
| `--space <key>` | — | Set Confluence space context (e.g., `SPACEKEY`) |
| `--project <key>` | — | Set Jira project context (e.g., `PROJ`) — hydrates via real API if connected |
| `--context <json>` | — | Set raw context JSON (merged into `extension`) |
| `--strict-mode` | off | Enable React.StrictMode (off by default — breaks Atlaskit portals) |

**What starts:**
- Dev server at `http://localhost:5173` (app preview — Vite for UIKit/Custom UI, reverse proxy with `--proxy`)
- WebSocket bridge at `ws://localhost:5174` (event bridge)
- Dev tools at `http://localhost:5173/__tools/` (KVS browser, SQL console, logs, events)
- JWKS endpoint at `http://localhost:5173/__forge/jwks.json` (when remotes are configured)
- Web trigger endpoints at `http://localhost:5173/__trigger/<key>` (when web triggers are defined)

**State persistence:** On exit (`Ctrl+C`), KVS and SQL data are saved to `<app>/.forge-sim/state/`. On next startup, state is restored. Use `--clean` to ignore persisted state.

### Module Context

UI modules like `jira:issuePanel` need product context to render properly. Use the context flags to provide it:

```bash
# Issue panel with real Jira issue data (hydrated via API if authenticated)
forge-sim dev --issue PROJ-42

# Confluence macro with content + space context
forge-sim dev --content 12345 --space MYSPACE

# Arbitrary context JSON (merged into the extension object)
forge-sim dev --context '{"issueKey":"PROJ-42","customField":"value"}'

# Combine with other flags
forge-sim dev --module my-issue-panel --issue PROJ-42 --port 3000
```

**Context resolution order:**
1. `--issue` / `--content` / `--space` — shortcut flags, hydrated via real product API if an account is connected (falls back to minimal synthetic context)
2. `--context` — raw JSON merged into the `extension` object (smart detection: if you pass `issueKey` for a Jira module, it tries to hydrate)
3. Defaults — `{ type: moduleType }` if nothing is provided

When connected to a real Atlassian site (`forge-sim auth`), `--issue PROJ-42` fetches the actual issue data (type, project, IDs) so your app gets the same context it would in production.

### Proxy Mode

Use `--proxy` when your Custom UI app has its own dev server (webpack, Vite, Parcel, etc.):

```bash
# Your dev server runs at http://localhost:3000
forge-sim dev --proxy http://localhost:3000
```

In proxy mode, forge-sim:

- **Reverse-proxies** all HTTP requests to your upstream dev server
- **Injects the bridge shim** into HTML responses (after `<head>`) so `@forge/bridge` works
- **Passes through WebSocket** upgrades to upstream (HMR continues to work)
- **Intercepts forge-sim routes** (`/__tools/*`, `/__forge/*`) before proxying
- **Bakes the module key** into the bridge script for automatic endpoint resolution
- **Requests uncompressed responses** (`accept-encoding: identity`) from upstream so HTML injection works reliably

If the upstream server is unreachable, forge-sim returns a styled 502 error page with the connection error details.

**Note:** In proxy mode, the `/__tools/` UI is minimal. The tools API endpoints still work for programmatic access.

#### Theme (dark / light)

Real Forge hosts your iframe with `?theme=dark` or `?theme=light` on the URL. forge-sim matches that contract — append the query string to pick a theme:

```
http://localhost:5173/?theme=dark
http://localhost:5173/?theme=light
```

Your app's theme init should read `?theme=` from `window.location.search` — the same code works in both forge-sim and production. Omit the param to fall back to OS preference (`prefers-color-scheme`). Bookmark both if you toggle often.

> Atlaskit gotcha: components require `setGlobalTheme({ colorMode, light, dark, spacing, typography, shape, motion })` at app boot, otherwise they render with unresolved tokens and can appear invisible.

---

## Daemon Commands

These commands interact with the forge-sim daemon — a background process that maintains simulator state across CLI calls. The daemon auto-starts on first use and auto-exits after 30 minutes of inactivity.

### `forge-sim deploy`

Deploy a Forge app to the simulator daemon.

```bash
forge-sim deploy [appDir]
forge-sim deploy ./my-app --no-reset
```

| Option | Description |
|--------|-------------|
| `--no-reset` | Keep existing state (don't reset before deploying) |

### `forge-sim invoke`

Call a resolver function.

```bash
forge-sim invoke <functionKey> [payloadJSON]

# Examples
forge-sim invoke getIssue '{"issueKey": "PROJ-1"}'
forge-sim invoke listItems
```

### `forge-sim trigger`

Fire a product event trigger.

```bash
forge-sim trigger <event> [dataJSON]

# Example
forge-sim trigger avi:jira:created:issue '{"issue": {"key": "PROJ-1"}}'
```

### `forge-sim scheduled`

Fire a scheduled trigger by key.

```bash
forge-sim scheduled <triggerKey>

# Example
forge-sim scheduled run-migrations
```

### `forge-sim kvs`

Key-Value Store operations.

```bash
forge-sim kvs list [--prefix <prefix>]
forge-sim kvs get <key>
forge-sim kvs set <key> <jsonValue>

# Examples
forge-sim kvs list
forge-sim kvs list --prefix board:
forge-sim kvs get settings:theme
forge-sim kvs set counter '42'
forge-sim kvs set config '{"debug": true}'
```

### `forge-sim sql`

Execute a SQL query against the simulated Forge SQL database (real MySQL 8.4).

```bash
forge-sim sql <query>

# Examples
forge-sim sql "SELECT * FROM objectives"
forge-sim sql "SHOW TABLES"
forge-sim sql "DESCRIBE users"
```

### `forge-sim ui`

Get the current ForgeDoc UI tree (pretty-printed component tree).

```bash
forge-sim ui
```

### `forge-sim logs`

Get simulator logs including captured `console.*` output from app code.

```bash
forge-sim logs
```

### `forge-sim reset`

Reset all simulator state — KVS, queues, SQL, resolvers, UI, logs.

```bash
forge-sim reset
```

### `forge-sim status`

Show daemon status — PID, port, uptime, idle time, deployed app.

```bash
forge-sim status
```

### `forge-sim stop`

Stop the daemon explicitly (normally it auto-exits after 30 min idle).

```bash
forge-sim stop
```

### `forge-sim serve`

Start the daemon in the foreground (useful for debugging the daemon itself).

```bash
forge-sim serve [--port=N]
```

---

## `forge-sim auth`

Manage Atlassian account credentials. See [Authentication](../local-development/auth.md) for details.

```bash
# Atlassian accounts (PAT only — OAuth was removed)
forge-sim auth              # Add account (interactive PAT flow)
forge-sim auth --list       # List configured accounts
forge-sim auth --remove ID  # Remove a specific account
forge-sim auth --clear      # Remove all accounts (service config preserved)
forge-sim auth --clear-all  # Remove credentials AND service config
forge-sim auth --local      # Store credentials per-app instead of global
forge-sim auth --llm        # Configure Anthropic API key (for @forge/llm)

# External auth providers (third-party OAuth)
forge-sim auth --provider google          # OAuth dance for a specific provider
forge-sim auth --provider google --secret # Set client secret first, then dance
forge-sim auth --providers                # OAuth dance for all manifest providers
forge-sim auth --providers --list         # Show auth status for all providers
```

External auth reads `providers.auth` and `remotes` from your `manifest.yml`. Provider client secrets are stored per-project in `<app>/.forge-sim/providers.json` (mode 0600). See [Authentication — External Auth](../local-development/auth.md#external-auth-third-party-oauth) for details.

---

## Daemon Lifecycle

The daemon is a background HTTP server that maintains simulator state across CLI calls.

| File | Purpose |
|------|---------|
| `~/.forge-sim/daemon.pid` | Process ID |
| `~/.forge-sim/daemon.port` | Port number |
| `~/.forge-sim/daemon.log` | Stderr log |

- **Auto-starts** on first CLI command (`deploy`, `invoke`, `kvs`, etc.)
- **Binds to `127.0.0.1`** only (not accessible from network)
- **Random port** — avoids collisions, written to `~/.forge-sim/daemon.port`
- **Idle timeout** — exits after 30 minutes with no API calls
- **`forge-sim stop`** — kills it explicitly
