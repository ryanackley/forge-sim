# CLI Reference

## `forge-sim dev`

Start the dev server with live UI preview. This is the primary command for local development.

```bash
forge-sim dev [appDir]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--port <port>` | 5173 | Vite dev server port |
| `--ws-port <port>` | 5174 | WebSocket bridge port |
| `--no-open` | — | Don't open browser automatically |
| `--module <key>` | auto | Specific UI module key to render |
| `--clean` | — | Start fresh (wipe app state, keep credentials) |

**What starts:**
- Vite dev server at `http://localhost:5173` (app preview)
- WebSocket bridge at `ws://localhost:5174` (event bridge)
- Dev tools at `http://localhost:5173/__tools/` (KVS browser, SQL console, logs, events)

**State persistence:** On exit (`Ctrl+C`), KVS and SQL data are saved to `<app>/.forge-sim/state/`. On next startup, state is restored. Use `--clean` to ignore persisted state.

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

Manage Atlassian account credentials. See [Authentication](./auth.md) for details.

```bash
forge-sim auth              # Add account (interactive)
forge-sim auth --list       # List configured accounts
forge-sim auth --remove ID  # Remove a specific account
forge-sim auth --clear      # Remove all accounts (keeps OAuth config)
forge-sim auth --clear-all  # Remove everything
forge-sim auth --oauth      # Add account via OAuth browser flow
forge-sim auth --setup      # Configure OAuth app (Client ID/Secret)
forge-sim auth --local      # Store credentials per-app instead of global
```

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
