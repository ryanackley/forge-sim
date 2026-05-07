---
name: forge-local-dev
description: Iterate on Atlassian Forge apps locally using forge-sim — the Forge runtime simulator. Use when the user wants to test a Forge app without deploying to Atlassian cloud, run a macro/panel/resolver/trigger locally, drive a fast iterate loop with forge-sim's MCP tools (forge_deploy, forge_invoke, forge_ui_render, forge_ui_interact, forge_logs, forge_reset), inspect KVS/SQL/queue state, or build a Forge app from scratch with local-first testing in mind. Complements the Atlassian forge-skills plugin — forge-app-builder owns scaffolding (forge create), forge-app-review owns pre-deploy audit, and this skill owns the develop-and-test loop in between. Do not use for: deploying to real Atlassian cloud, debugging an already-deployed production app, or scaffolding a new app from scratch (defer to forge-app-builder for those).
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
- Stress-testing an app under different contexts (issue keys, content IDs, spaces) before deploy

**Do NOT use this skill for:**

- Deploying to real Atlassian cloud — that's `forge deploy`, owned by `forge-app-builder`
- Scaffolding a brand-new app from nothing — owned by `forge-app-builder`
- Pre-deploy security/cost audits — owned by `forge-app-review`
- Debugging a deployed app's production failures — owned by `forge-debugger`

## Lifecycle map — where this skill fits

```
┌────────────┐    ┌──────────────────┐    ┌──────────────┐    ┌────────────┐
│  Scaffold  │ →  │   Iterate (here) │ →  │   Review     │ →  │   Deploy   │
│            │    │                  │    │              │    │            │
│ forge      │    │   forge-sim      │    │ forge-app-   │    │ forge-app- │
│ -app-      │    │   MCP tools      │    │ review       │    │ builder    │
│ builder    │    │   (this skill)   │    │              │    │            │
│            │    │                  │    │ security,    │    │ forge      │
│ forge      │    │   forge_deploy,  │    │ cost,        │    │ deploy,    │
│ create     │    │   forge_invoke,  │    │ perf,        │    │ install    │
│ login      │    │   forge_ui_*,    │    │ triggers     │    │            │
│            │    │   forge_logs     │    │              │    │            │
└────────────┘    └──────────────────┘    └──────────────┘    └────────────┘
                          ▲
                          │
                  ────────┴────────
                  iterate until happy
                  (no cloud round-trip)
```

## Prerequisites

| Tool | Required? | Purpose |
|---|---|---|
| **forge-sim MCP server** | ✅ Required | Provides `forge_deploy`, `forge_invoke`, `forge_ui_render`, `forge_ui_interact`, `forge_logs`, etc. Without it, this skill can't run. |
| **Forge MCP server** (`https://mcp.atlassian.com/v1/forge/mcp`) | ✅ Required | Live Forge docs, manifest syntax, module config, UI Kit / backend API guides. The model's training data on Forge is frequently outdated — always verify against this MCP. |
| **Atlassian forge-skills plugin** | ⚠️ Recommended | Provides `forge-app-builder`, `forge-app-review`, `forge-debugger`, `forge-connector`. This skill delegates to those for non-iterate phases. Install: `/plugin marketplace add atlassian/forge-skills` then `/plugin install forge-skills@atlassian-forge-skills`. |
| **ADS MCP server** (`https://mcp.atlassian.com/v1/ads/public/mcp`) | Optional | Atlaskit component / token / icon lookup. Useful for Custom UI work; not used by UIKit. |

If any required tool is missing, **stop and tell the user how to install it**. Don't fabricate forge-sim behavior from training data — too much has changed.

## Workflow

Complete steps 1–5 in order. Stop after step 4 unless the user has explicitly asked you to ship.

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

### Step 3: Iterate — drive the test loop

Pick the right tool for the module type:

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

#### Reset between tests

```
mcp__forge-sim__forge_reset()
```

Clears all sim state. Useful between independent test scenarios. Followed by another `forge_deploy`.

### Step 4: STOP — do NOT run `forge deploy`

After the iterate phase passes, **the workflow gates here**. Do NOT chain into `forge deploy`. Tell the user:

> Local testing passed. Before deploying to Atlassian, run the **forge-app-review** skill to audit security, cost, performance, and trigger configuration. Once the review is clean, the **forge-app-builder** skill walks through real `forge deploy`.

If `forge-app-review` skill is not available, point the user at:
- The pre-deploy checklist in [Forge security](https://developer.atlassian.com/platform/forge/security/)
- Manifest scopes audit (no over-permissive `*` scopes)
- Trigger frequency audit (scheduled triggers shouldn't run hot)

Wait for explicit user confirmation before any cloud deploy.

### Step 5: Real deploy (only after review)

Hand control back to `forge-app-builder` skill for `forge deploy` + `forge install`. **This skill does not deploy to cloud, ever.**

## Common patterns

- **"My resolver returns undefined in the test"** — check `forge_logs({ level: 'error' })`. The simulator captures uncaught exceptions in resolvers. Real Forge would silently 500.
- **"My macro renders blank"** — `forge_ui_state()` shows the ForgeDoc tree. If empty, the bundle didn't import properly. Look for module-resolution errors in logs.
- **"My inline config isn't loading"** — verify the manifest has `config: true` (or `config: { resource: '...' }`). The `MacroConfig` ForgeDoc only emits when `addConfig()` was called in the same bundle.
- **"I changed the manifest and my old behavior is still showing"** — re-run `forge_deploy`. Manifest is parsed at deploy time, not per-render.
- **"I'm hitting a real Atlassian API in my resolver"** — pre-seed with `forge_mock_routes`. forge-sim's product API mocks routes match by prefix; mocks beat real calls.
- **"I want to test with persistence between sessions"** — forge-sim auto-saves KVS/SQL state to disk. Run with `--clean` flag to reset.
- **"My e2e test depends on a previous render"** — `forge_ui_render` is stateful; subsequent calls preserve config. Use `forge_reset` between independent tests.

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
