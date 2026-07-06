# forge-sim

There are three main components

* **Local Forge simulation**  A local simulation of Atlassian's Forge platform for a faster development loop. Makes iterating faster by removing the deploy to cloud step. Think of it as LocalStack for Forge. 
* **CI/CD test API** Works for backend forge modules as well as UIKit 2. See testing section below. 
* **MCP for AI-first development** A simulated Forge environment for AIs to iterate on Forge Apps without giving them access to your Cloud environment and teaching them to navigate Atlassian apps. 

## Installation

Requires **Node.js 22+** (uses native TypeScript type stripping for `.ts` loader hooks).

```bash
# As a dev dependency (recommended)
npm install --save-dev forge-sim

# Or install globally
npm install -g forge-sim
```

## Local development loop

Run your Forge app locally by using the `forge-sim dev` command

### Quick start

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

*🎬 Demo video placeholder — `forge-sim dev`: launch, module index, UIKit panel rendering live, edit a file and watch HMR refresh.*

<!--
TODO(demo): record dev-mode demo and replace the line above.
To embed on GitHub: edit this file on github.com and drag the .mp4/.mov in —
it uploads to user-attachments and inserts a bare URL on its own line, which
GitHub renders as an inline player. (GIFs in the repo work too: docs/media/)
-->

**Full guide:** [Local development](./docs/local-development/) — connecting to your Atlassian site, Custom UI and proxy mode, Forge Remotes, external auth providers, and the dev tools UI.

---

## CI/CD testing

Run your app against a headless simulated runtime — no deployment, no Atlassian site, no browser. The test API deploys your unmodified app and exposes its storage, queues, triggers, and rendered UI for assertions.

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createSimulator, type ForgeSimulator } from 'forge-sim';

describe('my forge app', () => {
  let sim: ForgeSimulator;

  beforeAll(async () => {
    sim = createSimulator();
    await sim.sql.start();              // embedded MySQL — only if the app uses @forge/sql
    await sim.deploy('./my-forge-app'); // manifest.yml drives everything
  });

  afterAll(async () => {
    await sim.stop();
  });

  it('reads an issue and records a view', async () => {
    sim.mockProductRoutes('jira', {
      '/rest/api/3/issue/PROJ-1': { key: 'PROJ-1', summary: 'Fix the thing' },
    });

    // The resolver runs your real handler, which writes to KVS
    const data = await sim.invoke('getIssue', { issueKey: 'PROJ-1' });
    expect(data.summary).toBe('Fix the thing');
    expect(await sim.kvs.get('views:PROJ-1')).toBe(1);
  });

  it('handles an issue-created trigger', async () => {
    await sim.fireTrigger('avi:jira:created:issue', { issue: { key: 'PROJ-2' } });

    const rows = await sim.sql.query(
      'SELECT * FROM objectives WHERE status = ?',
      ['active'],
    );
    expect(rows).toHaveLength(3);
  });
});
```

Features:

- Runs your real handler code through the actual `@forge/*` packages, not hand-written mocks.
- Invokes resolvers, triggers, scheduled triggers, queues, and consumers directly.
- Gives direct read/write access to KVS, the Custom Entity Store, and Forge SQL (embedded MySQL) for setup and assertions.
- Renders UIKit 2 modules to a ForgeDoc tree you can query and interact with — no browser.
- Mocks product APIs, Forge Remotes, third-party OAuth, and GraphQL by route; unmocked routes fall through to a connected real API.
- Mocks and records `@forge/llm` calls so tests stay offline.

**Full guide:** [CI/CD testing](./docs/testing/) — bundler configuration, every testing pattern, UIKit rendering, mocking, and the programmatic API reference.

---

## AI-driven development

forge-sim gives AI agents a local Forge runtime with no Atlassian credentials and no deploy permissions, so an agent can write code, deploy it locally, test it, and iterate without any way of touching a real site. Everything is reachable through CLI commands:

```bash
# Deploy the app (daemon auto-starts)
forge-sim deploy ./my-forge-app

# Call a resolver to test it
forge-sim invoke getIssues '{"project": "PROJ"}'

# Check what the UI looks like
forge-sim ui

# Inspect the data layer
forge-sim kvs list
forge-sim sql "SELECT * FROM objectives"

# Check logs for errors
forge-sim logs
```

The first command auto-starts a background daemon; state persists across calls and the daemon exits after 30 minutes idle.

### MCP server

For AI agents that support [Model Context Protocol](https://modelcontextprotocol.io/), forge-sim exposes the same operations as MCP tools:

<!-- BEGIN:STATS_COMPACT -->
2,122 tests · 39 MCP tools · 4 MCP resources
<!-- END:STATS_COMPACT -->

```bash
# Native MCP over stdio
forge-sim-mcp

# Or via the daemon's HTTP endpoint
forge-sim serve  # starts on random port, writes to ~/.forge-sim/daemon.port
```

The full tool list: `deploy`, `invoke`, `fire_trigger`, `fire_scheduled_trigger`, `ui_state`, `ui_interact`, `kvs_get`, `kvs_set`, `kvs_list`, `queue_push`, `queue_state`, `logs`, `sql_execute`, `sql_migrate`, `sql_schema`, `entity_get`, `entity_set`, `entity_delete`, `entity_query`, `entity_list`, `auth_status`, `mock_routes`, `mock_graphql`, `llm_mock`, `llm_history`, `realtime_publish`, `realtime_state`, `reset`, `objectstore_list`, `objectstore_get`, `objectstore_put`, `objectstore_delete`, `objectstore_create_download_url`, `variables_set`, `variables_unset`, `variables_list`. 143 trigger event templates with typed payloads are built-in for Confluence, Jira, Jira Software, and App Lifecycle events.

### As an AI skill

The CLI surface is small enough to paste into an agent prompt:

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

**Full guide:** [AI-driven development](./docs/ai/) — the MCP server (tools and resources), transport options, and the agent CLI.

---

## Known limitations

forge-sim won't catch bugs that real Forge would:

- **No egress filtering** — `permissions.external` is parsed but not enforced
- **No scope enforcement** — `permissions.scopes` is parsed but not checked at runtime
- **No app lifecycle triggers** — install/uninstall/enable/disable don't fire
- **No rate or memory limits** — Forge's per-app limits aren't simulated
- **`context.environmentType` defaults to `DEVELOPMENT`** — override per render/invoke to simulate staging/prod

See the [implementation matrix](./docs/reference/implementation-matrix.md) for full coverage detail.

## Documentation

The docs are organized around the three ways to use forge-sim, with a shared reference section:

- **[Local development](./docs/local-development/)** — the `forge-sim dev` server, connecting to Atlassian, Custom UI and proxy mode, Forge Remotes, external auth, and the dev tools UI.
- **[CI/CD testing](./docs/testing/)** — the test API, bundler config, testing patterns, UIKit rendering, mocking, and the programmatic `sim.*` reference.
- **[AI-driven development](./docs/ai/)** — the MCP server and agent CLI.
- **[Reference](./docs/reference/)** — architecture, full CLI reference, implementation matrix, module support, and module contexts.

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
**2,122 tests** across **109** test files
(1,975 core / 105 files
+ 147 renderer / 4 files)

**39 MCP tools** + **4 resources**
<!-- END:STATS -->

## License

[MIT](./LICENSE)
