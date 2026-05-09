---
name: forge-local-dev
description: Iterate on Atlassian Forge apps locally using forge-sim — the Forge runtime simulator. Use when the user wants to test a Forge app without deploying to Atlassian cloud, run a macro/panel/resolver/trigger locally, drive a fast iterate loop, inspect KVS/SQL/queue state, write automated tests, or build a Forge app from scratch with local-first testing in mind. forge-sim has three driver surfaces — MCP for headless live iteration with an LLM in chat, the in-process API (`createSimulator()` from `'forge-sim'`) for automated tests in vitest/jest, and full-stack `forge-sim dev` for Custom UI iframe work. Complements the Atlassian forge-skills plugin — forge-app-builder owns scaffolding (forge create), forge-app-review owns pre-deploy audit, and this skill owns the develop-and-test loop in between. Do not use for: deploying to real Atlassian cloud, debugging an already-deployed production app, or scaffolding a new app from scratch (defer to forge-app-builder for those).
license: Apache-2.0
labels:
  - forge
  - atlassian
  - testing
  - local-development
---

# Forge Local Dev (forge-sim Workflow)

This skill drives the **iterate phase** of Forge app development using
[forge-sim](https://github.com/ryanackley/forge-sim), a local Forge runtime
simulator. forge-sim's whole pitch is parity: *if it works in forge-sim, it
should work in Forge — and if it wouldn't work in Forge, it shouldn't work
in forge-sim*. That's the contract; honor it.

## When to use this skill

Use when the user is:

- Building a Forge app and wants a fast feedback loop without `forge deploy`
- Asking to test a macro/panel/resolver/trigger locally
- Debugging app logic and needs to invoke resolvers, fire triggers, render UI without round-tripping to Atlassian
- Inspecting KVS, SQL, queue, or entity-store state during development
- Writing automated tests (vitest/jest) for an app's resolvers, triggers, queues, or SQL persistence
- Stress-testing an app under different contexts (issue keys, content IDs, spaces) before deploy

**Do NOT use this skill for:**

- Deploying to real Atlassian cloud — that's `forge deploy`, owned by `forge-app-builder`
- Scaffolding a brand-new app from nothing — owned by `forge-app-builder`
- Pre-deploy security/cost audits — owned by `forge-app-review`
- Debugging a deployed app's production failures — owned by `forge-debugger`

## Lifecycle map — where this skill fits

```
┌────────────┐    ┌──────────────────────────┐    ┌──────────────┐    ┌────────────┐
│  Scaffold  │ →  │     Iterate (here)       │ →  │   Review     │ →  │   Deploy   │
│            │    │                          │    │              │    │            │
│ forge      │    │   forge-sim              │    │ forge-app-   │    │ forge-app- │
│ -app-      │    │   (this skill)           │    │ review       │    │ builder    │
│ builder    │    │                          │    │              │    │            │
│            │    │  ┌──────┐  ┌──────────┐  │    │ security,    │    │ forge      │
│ forge      │    │  │ MCP  │  │ in-proc  │  │    │ cost,        │    │ deploy,    │
│ create     │    │  │      │  │   API    │  │    │ perf,        │    │ install    │
│ login      │    │  │ live │  │  tests   │  │    │ triggers     │    │            │
│            │    │  │ iter │  │ (vitest) │  │    │              │    │            │
│            │    │  └──────┘  └──────────┘  │    │              │    │            │
│            │    │                          │    │              │    │            │
│            │    │  full-stack only         │    │              │    │            │
│            │    │  for Custom UI           │    │              │    │            │
└────────────┘    └──────────────────────────┘    └──────────────┘    └────────────┘
                            ▲
                            │
                    ────────┴────────
                    iterate until happy
                    (no cloud round-trip)
```

Iterate mode breakdown:
- **MCP (chat with the user)** → headless live iteration, fastest feedback
- **In-process API (`createSimulator()` in vitest/jest)** → automated tests, runs in CI, deterministic, breakpoint-debuggable
- **Full stack (`forge-sim dev`)** → only for Custom UI iframe work; rarely needed

These are separate processes. State doesn't cross between them — pick the surface that matches the phase.

## Prerequisites

| Tool | Required? | Purpose |
|---|---|---|
| **forge-sim MCP server** | ✅ Required | Provides `forge_deploy`, `forge_invoke`, `forge_ui_render`, `forge_ui_interact`, `forge_logs`, etc. Without it, this skill can't run. |
| **Forge MCP server** (`https://mcp.atlassian.com/v1/forge/mcp`) | ✅ Required | Live Forge docs, manifest syntax, module config, UI Kit / backend API guides. The model's training data on Forge is frequently outdated — always verify against this MCP. |
| **Atlassian forge-skills plugin** | ⚠️ Recommended | Provides `forge-app-builder`, `forge-app-review`, `forge-debugger`, `forge-connector`. This skill delegates to those for non-iterate phases. Install: `/plugin marketplace add atlassian/forge-skills` then `/plugin install forge-skills@atlassian-forge-skills`. |
| **ADS MCP server** (`https://mcp.atlassian.com/v1/ads/public/mcp`) | Optional | Atlaskit component / token / icon lookup. Useful for Custom UI work; not used by UIKit. |

If any required tool is missing, **stop and tell the user how to install it**. Don't fabricate forge-sim behavior from training data — too much has changed.

## Three driver surfaces, three processes

forge-sim has three driver surfaces. **They're separate Node processes — they do NOT share state.** Pick the right one for the job; don't try to use one surface from another's process.

| Surface | Process | Driven by | Use for |
|---|---|---|---|
| **MCP** (`mcp__forge-sim__*`) | Spawned by Claude Code as a subprocess | An LLM in chat (you, here) | **Headless live iteration.** Render, invoke, fire triggers, inspect logs while developing in conversation. The fastest feedback loop. |
| **In-process** (`createSimulator()` from `'forge-sim'`) | Same Node process as the test runner | Test code, scripts, custom tooling | **Automated tests.** Direct method calls — `sim.invoke`, `sim.fireTrigger`, `sim.kvs.get`, `sim.ui.render`, etc. No HTTP, no daemon, breakpoint-debuggable. |
| **Full stack** (`forge-sim dev`) | Vite + daemon + browser | A real browser | **Custom UI work only.** Use this when you need real Atlaskit DOM, real bridge messaging, real React effects in an iframe. **Rarely needed.** UIKit, resolvers, triggers, scheduled triggers, web triggers, queues, consumers, SQL, KVS, custom fields, workflows, Rovo actions — all driveable headless via MCP or in-process. |

> **Note on the daemon.** `forge-sim serve` runs a fourth process — a stateful HTTP daemon — that the **CLI** uses so commands like `forge-sim deploy ./app` and `forge-sim invoke foo` can share state across separate terminal invocations. It is **not** the test surface and **not** what the MCP tools talk to. Tests use the in-process API; the LLM uses MCP. Only mention the daemon if a user asks about CLI workflows.

Critical rule: **state from one surface is invisible to the others.** The MCP server spawned by Claude Code has its own `ForgeSimulator` instance. A vitest run starts another via `createSimulator()`. The `forge-sim dev` process has a third. If you write KVS via MCP and then expect to read it from a vitest test, you'll get nothing — different sims.

### Surface-by-phase

- **You're iterating with the user in chat right now**: MCP. Skip ahead to Step 3.
- **You're writing automated tests for the user's app**: in-process API. Skip ahead to Step 4. Do NOT call `mcp__forge-sim__*` tools from inside test files — those tools live in a different Node process the test runner can't reach.
- **You're building or debugging Custom UI iframes**: full stack mode. Run `forge-sim dev`, point Playwright at it. (Out of scope for this skill in most cases — only invoke when the user is explicitly working on Custom UI.)

If you find yourself wanting to "run an MCP tool from a test," that's a category error. Switch to `createSimulator()` in-process — it's the same simulator, just imported as a library instead of driven over JSON-RPC.

## Workflow

Complete steps 1–6 in order. Stop after step 5 unless the user has explicitly asked you to ship.

### Step 1: Make sure the app has a valid appId

Before deploying to forge-sim, the app needs to have been created via `forge create`. This is non-negotiable for any app that will eventually ship — without a real appId, the manifest can't be installed in real Forge later, and forge-sim's parity guarantee is meaningless.

**If the `forge-app-builder` skill is available**, delegate to it for scaffolding. It handles `forge create`, dev-space selection, `forge login`, and template choice properly.

**If `forge-app-builder` is NOT available**, fall back to the minimal recipe:

```bash
# Once per machine: install the Forge CLI and log in
npm install -g @forge/cli
forge login   # Run in the user's terminal — NEVER accept Atlassian API tokens in chat

# Per app: scaffold
forge create my-app
# Pick a template. forge create produces a manifest with a real app.id.
cd my-app
npm install
```

Verify the manifest has a real app.id:

```bash
grep "^app:" -A 1 manifest.yml
# Should show: id: ari:cloud:ecosystem::app/<uuid>
# NOT: id: sim-app  ← that's a forge-sim placeholder, not a real appId
```

If the user has an existing app with a placeholder appId (e.g. `sim-app`), warn them: forge-sim works fine for local testing, but the app will not be installable in real Forge until they run `forge create` and merge the resulting `app.id` back in.

### Step 2: Deploy to forge-sim

Use the MCP tool, NOT the real Forge CLI:

```
mcp__forge-sim__forge_deploy({ appDir: '/path/to/app' })
```

Then check for issues:

```
mcp__forge-sim__forge_logs({ level: 'error', limit: 20 })
```

If deploy fails, the logs will tell you why. Common issues:

- **Manifest parse errors** — fix syntax, redeploy
- **Missing module bundle** — check `resources` in manifest matches actual file paths
- **Runtime mismatch warnings** — usually just a Node version notice, not blocking

### Step 3: Iterate headlessly via MCP

This is the live-iteration loop you'll spend most of your time in while chatting with the user. Drive sim with `mcp__forge-sim__*` tools. Pick the right tool for the module type:

#### UI modules (macros, issue panels, custom fields, global pages)

```
mcp__forge-sim__forge_ui_render({ moduleKey: 'my-macro' })
mcp__forge-sim__forge_ui_state()                           # inspect current ForgeDoc tree
mcp__forge-sim__forge_ui_interact({ componentType: 'Button', matchText: 'Save' })
```

For modules that need context:
```
mcp__forge-sim__forge_ui_render({
  moduleKey: 'issue-panel',
  issueKey: 'PROJ-1'         # hydrates extension.issue context
})
```

For macros with inline config:
```
# Render the config tree (no resolver invocation needed):
mcp__forge-sim__forge_ui_render({ moduleKey: 'my-macro--config' })

# Or set config directly to test the view:
mcp__forge-sim__forge_ui_render({
  moduleKey: 'my-macro',
  macroConfig: { projectKey: 'PROJ', lookbackDays: 14 }
})
```

#### Resolvers

```
mcp__forge-sim__forge_invoke({
  functionKey: 'getHealth',           # the handler name from the resolver
  payload: { projectKey: 'PROJ' }
})
```

Pre-seed mock product API responses if the resolver hits Jira / Confluence:
```
mcp__forge-sim__forge_mock_routes({
  product: 'jira',
  routes: { 'GET /rest/api/3/issue/PROJ-1': { key: 'PROJ-1', fields: { summary: 'Bug' } } }
})
```

#### Triggers (events)

```
mcp__forge-sim__forge_fire_trigger({
  event: 'avi:jira:created:issue',
  data: { issue: { key: 'PROJ-1', fields: { summary: 'New bug' } } }
})
```

forge-sim ships sample payloads for 141 events (76 Confluence + 54 Jira + 9 Jira Software + 2 App Lifecycle). Use them rather than handcrafting payloads.

#### Scheduled triggers, web triggers, queues

- `forge_fire_scheduled_trigger({ triggerKey })` — fires a `scheduledTrigger` handler
- For web triggers, hit `http://localhost:<port>/__trigger/<key>` (URL surfaced via `webTrigger.getUrl()` at runtime)
- `forge_queue_push({ queueKey, events })` — pushes to a queue, fires the consumer

#### State inspection

| What | Tool |
|---|---|
| KVS contents | `forge_kvs_list({ prefix? })`, `forge_kvs_get({ key })` |
| Custom Entities | `forge_entity_list({ entityName? })`, `forge_entity_query(...)` |
| Forge SQL | `forge_sql_schema()`, `forge_sql_execute({ query })` |
| Queue events | `forge_queue_state({ jobId? })` |
| Console output | `forge_logs({ level?, limit? })` |
| Realtime channels | `forge_realtime_state()` |

#### Reset between scenarios

```
mcp__forge-sim__forge_reset()
```

Clears all sim state (in-memory + drops SQL tables; MySQL server stays running). Useful between independent scenarios. Followed by another `forge_deploy`.

### Step 4: Write automated tests with the in-process API

When the user asks you to "write tests" / "make this testable" / "add vitest coverage", switch surfaces. Tests run in their own Node process — they can't reach the MCP server. The right answer is **not** to write a custom HTTP client against the daemon; forge-sim already exposes a fully-fleshed in-process API that runs the simulator inline with the test.

**The full reference is [docs/testing.md](https://github.com/ryanackley/forge-sim/blob/main/docs/testing.md)** — read it before writing tests. It covers bundler config, every testing pattern (resolvers, SQL, KVS, triggers, queues, UI), product API mocking, and view-event capture (`onSubmit`/`onClose`/`onRefresh`). The summary below is the minimum needed to bootstrap a test file.

#### Bundler config (one-time per project)

Vitest, Jest, and webpack bypass Node's loader hooks, so you have to alias `@forge/*` imports to forge-sim's shim files. Vitest:

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const SHIMS = resolve(require.resolve('forge-sim'), '..', 'shims');

export default defineConfig({
  resolve: {
    alias: {
      '@forge/resolver': resolve(SHIMS, 'forge-resolver.js'),
      '@forge/api':      resolve(SHIMS, 'forge-api.js'),
      '@forge/kvs':      resolve(SHIMS, 'forge-kvs.js'),
      '@forge/events':   resolve(SHIMS, 'forge-events.js'),
      '@forge/react':    resolve(SHIMS, 'forge-react.js'),
      '@forge/bridge':   resolve(SHIMS, 'forge-bridge.js'),
      // add any other @forge/* the app actually imports
    },
  },
  test: { testTimeout: 30_000, hookTimeout: 60_000 },
});
```

Jest uses `moduleNameMapper` with the same paths — see the [Webpack / Jest section](https://github.com/ryanackley/forge-sim/blob/main/docs/testing.md#webpack--jest) of testing.md.

> No alias needed for `@forge/sql`. The real `@forge/sql` package talks to the simulator through a runtime hook (`global.__forge_fetch__`) that `createSimulator()` installs automatically.

#### The canonical test shape

```ts
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { createSimulator, type ForgeSimulator } from 'forge-sim';
import { resolve } from 'node:path';

describe('audit log', () => {
  let sim: ForgeSimulator;

  beforeAll(async () => {
    sim = createSimulator();
    await sim.sql.start();                       // only if the app uses Forge SQL
    await sim.deploy(resolve(__dirname, '..'));  // path to the app dir
  });

  afterAll(async () => {
    await sim.stop();                            // stops MySQL, releases everything
  });

  it('records updated events into audit_entries', async () => {
    await sim.fireTrigger('avi:jira:updated:issue', {
      issue: { key: 'TEST-1', fields: { summary: 'Test' } },
    });
    const rows = await sim.sql.query(
      'SELECT * FROM audit_entries WHERE issue_key = ? AND event_type = ?',
      ['TEST-1', 'updated'],
    );
    expect(rows).toHaveLength(1);
  });
});
```

That's the whole pattern. Direct method calls. No HTTP, no port file, no client to write.

#### Capabilities at a glance

| Need | Method |
|---|---|
| Invoke a resolver | `sim.invoke(functionKey, payload)` |
| Fire a product event | `sim.fireTrigger(event, data)` (typed for 141 known events) |
| Fire a scheduled trigger | `sim.fireScheduledTrigger(triggerKey)` |
| Push to a queue (consumer fires synchronously) | `sim.queue.push(queueKey, events)` |
| Render a UI module | `sim.ui.render(moduleKey, { context })` then `sim.ui.findByType/findByTypeAndText/interact/...` |
| Wait for async UI content | `sim.ui.waitForContent(moduleKey, expectedText)` |
| Capture `view.submit/close/refresh` | `sim.ui.onSubmit(cb)`, `sim.ui.onClose(cb)`, `sim.ui.onRefresh(cb)` |
| Mock product API (Jira/Confluence/Bitbucket) | `sim.mockProductRoutes('jira', { 'GET /rest/api/3/...': ... })` |
| Mock GraphQL | `sim.mockGraphQL({ OperationName: { data: ... } })` |
| Read/write KVS | `sim.kvs.get/set/delete`, `sim.kvs.query()`, `sim.kvs.entity('Foo')` |
| Run SQL | `sim.sql.query(sql, params)` |
| Inspect logs | `sim.getLogs()`, `sim.getConsoleLogs()` |
| Reset state mid-suite | `await sim.reset()` (clears KVS/queues/UI/logs, drops SQL tables; MySQL stays up) |

#### Test-suite shape

- **One simulator per `describe`** in `beforeAll` / `afterAll` — share the deploy cost across tests in the file.
- **Reset between independent scenarios with `await sim.reset()`** — async since `0ec3289` (drops SQL tables FK-aware before the next deploy).
- **Don't use `sim.stop()` between tests** — that tears down the embedded MySQL server. Save it for `afterAll`.
- **`sim.sql.start()` is opt-in.** Skip it if the app doesn't use `@forge/sql`; tests will be faster.
- **Mock product APIs before `sim.deploy()`** if your app's scheduled triggers hit Jira/Confluence at startup (migrations often do).

#### Async UI rendering caveat

`sim.ui.render()` returns once the initial reconcile finishes. If the component fires a `useEffect → invoke()` chain to load data, the first paint shows the loading state. Wait for the real content with `sim.ui.waitForContent(moduleKey, expectedText)` before asserting — it's a proper waiter, not a poll loop:

```ts
await sim.ui.render('issue-panel', { context: { issueKey: 'PROJ-42' } });
const doc = await sim.ui.waitForContent('issue-panel', 'PROJ-42');
expect(sim.ui.getTextContent(doc)).toContain('Fix the bug');
```

#### What about the daemon / HTTP API?

Skip them for tests. The daemon (`forge-sim serve`) is what the **CLI** talks to so commands like `forge-sim deploy ./app` and `forge-sim invoke foo` can share state across separate terminal invocations. It exposes HTTP `/api/*` endpoints, but those exist for the CLI's benefit. Driving sim from inside the test process via `createSimulator()` is faster, deterministic, breakpoint-debuggable, and doesn't need cross-process coordination.

The HTTP daemon API is only the right call when the test process genuinely cannot host the sim — for example, a Playwright test driving a `forge-sim dev` server end-to-end. That's the exception, not the path. In every other case, import `createSimulator` and call methods on it.

**Don't reach for full-stack mode for tests either.** Unless the test specifically validates Custom UI iframe behavior, the in-process API + vitest is faster, more deterministic, and doesn't need a browser.

### Step 5: STOP — do NOT run `forge deploy`

After the iterate phase passes, **the workflow gates here**. Do NOT chain into `forge deploy`. Tell the user:

> Local testing passed. Before deploying to Atlassian, run the **forge-app-review** skill to audit security, cost, performance, and trigger configuration. Once the review is clean, the **forge-app-builder** skill walks through real `forge deploy`.

If `forge-app-review` skill is not available, point the user at:
- The pre-deploy checklist in [Forge security](https://developer.atlassian.com/platform/forge/security/)
- Manifest scopes audit (no over-permissive `*` scopes)
- Trigger frequency audit (scheduled triggers shouldn't run hot)

Wait for explicit user confirmation before any cloud deploy.

### Step 6: Real deploy (only after review)

Hand control back to `forge-app-builder` skill for `forge deploy` + `forge install`. **This skill does not deploy to cloud, ever.**

## Common patterns

Each pattern shows the MCP tool first (live iteration) and the in-process equivalent (tests).

- **"My resolver returns undefined"** — check logs for the captured exception. The simulator captures uncaught exceptions in resolvers; real Forge would silently 500. *MCP:* `forge_logs({ level: 'error' })`. *Tests:* `sim.getLogs()` / `sim.getConsoleLogs()`.
- **"My macro renders blank"** — inspect the ForgeDoc tree. If empty, the bundle didn't import properly — look for module-resolution errors in logs. *MCP:* `forge_ui_state()`. *Tests:* `sim.ui.getForgeDoc(moduleKey)` (or `sim.ui.prettyPrint(doc)` for a readable dump).
- **"My inline config isn't loading"** — verify the manifest has `config: true` (or `config: { resource: '...' }`). The `MacroConfig` ForgeDoc only emits when `addConfig()` was called in the same bundle.
- **"I changed the manifest and my old behavior is still showing"** — redeploy. Manifest is parsed at deploy time, not per-render. *MCP:* `forge_deploy`. *Tests:* `await sim.deploy(...)` again.
- **"I'm hitting a real Atlassian API in my resolver"** — pre-seed mocks. forge-sim's product API mocks match by prefix; mocks beat real calls. *MCP:* `forge_mock_routes`. *Tests:* `sim.mockProductRoutes('jira', { ... })`.
- **"I want to test with persistence between sessions"** — forge-sim auto-saves KVS/SQL state to disk in CLI/dev-server mode. Run with `--clean` flag to reset. (In-process tests start clean; persistence is a CLI concern.)
- **"My scenario depends on a previous render"** — UI state is stateful; subsequent renders preserve config. Reset between independent scenarios. *MCP:* `forge_reset`. *Tests:* `await sim.reset()` (clears KVS/queues/UI/logs and drops SQL tables; MySQL stays up).

## Pitfalls (parity violations to watch for)

forge-sim is meaningfully strict — these will fail in BOTH forge-sim and real Forge, and that's intentional:

- **`<TextField>`** (capital F) — real Forge only exports `Textfield`. Common Material-UI muscle memory; will fail at import.
- **`<Checkbox name="x">`** in macro inline config — real Forge only allows `CheckboxGroup` in config. forge-sim's validator suggests the alternative.
- **Importing React hooks from `@forge/react`** — `useState`, `useEffect`, etc. come from `react`, not `@forge/react`. Common confusion.
- **Hand-rolled manifests with `app.id: sim-app`** — forge-sim accepts this for testing, but it's a placeholder. Real Forge requires a valid appId from `forge create`.

If any of these slip through, fix the source — don't work around them.

## What this skill does NOT cover

- **Forge CLI commands** (`forge create`, `forge deploy`, `forge install`, `forge logs --tail`) — see `forge-app-builder` skill
- **Pre-deploy audit** (security, cost, perf review) — see `forge-app-review` skill
- **Debugging deployed apps** (real cloud failures, scope issues, install errors) — see `forge-debugger` skill
- **Custom UI app dev with Atlaskit imports** — forge-sim's dev mode supports it, but Atlaskit lookup is the `ads-mcp` server's job
- **Forge connector apps** for Rovo Search ingestion — see `forge-connector` skill

When in doubt, the agent should defer to one of those skills rather than improvise.

## References

- [forge-sim repo](https://github.com/ryanackley/forge-sim) — full docs, MCP tool reference, module support matrix
- [Forge developer documentation](https://developer.atlassian.com/platform/forge/) — official Forge platform docs
- [@forge/react component reference](https://developer.atlassian.com/platform/forge/ui-kit/components/) — canonical list of UIKit components and which ones work in macro config
