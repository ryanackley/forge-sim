# forge-sim Roadmap

> **If it works in forge-sim, it should work in Forge. If it wouldn't work in Forge, it shouldn't work in forge-sim.**

## Architecture overview

```
┌──────────────────────────────────────────────┐
│            Forge Sim Tools (/__tools/)        │
│  ┌─────┬──────┬──────┬──────┬────────┐       │
│  │ UI  │State │Events│ Auth │  Logs  │       │
│  │Picker│     │      │      │        │       │
│  └─────┴──────┴──────┴──────┴────────┘       │
├──────────────────────────────────────────────┤
│  App Preview (:5173)      │  Proxy Mode      │
│  Vite + Atlaskit render   │  --proxy <url>   │
│  UIKit 2 / Custom UI      │  Any bundler     │
├──────────────────────────────────────────────┤
│         Bridge RPC (:5174 WebSocket)         │
├──────────────────────────────────────────────┤
│              forge-sim core                   │
│  ┌─────┬─────┬─────┬──────┬────────┬──────┐ │
│  │ KVS │ SQL │Queue│Remote│ProdAPI │ FIT  │ │
│  │     │     │     │Proxy │mock+real│ JWT  │ │
│  └─────┴─────┴─────┴──────┴────────┴──────┘ │
│  ┌──────────┬────────────┬─────────────────┐ │
│  │ Entity   │ Module     │ Function        │ │
│  │ Store    │ Routing    │ Registry        │ │
│  └──────────┴────────────┴─────────────────┘ │
│         .forge-sim/ (persistent)              │
│    credentials │ state │ config               │
└──────────────────────────────────────────────┘
```

## Current focus

Status as of 2026-10-07: v0.1.18 on npm, 2,526 tests, 41 MCP tools. The simulator is in maintenance plus planned feature releases. The changelog watcher (`forge-changelog-watch` cron) files an `upstream-changelog` issue for every Atlassian Forge changelog entry that touches a simulated surface; those issues are the parity backlog and are triaged into the releases below.

Guiding property for every release: **determinism**. Same inputs, same outputs, no credentials and no Docker required for the common case.

### 0.2 Platform catch-up (4 to 6 weeks)

Close the gap between what Forge shipped since July and what the simulator accepts. Gate: the contract test suite (#10) runs every shim against the real `@forge/*` typings, so drift is caught automatically instead of by memory.

- Contract tests against real `@forge/*` package typings (#10). First, because it gates everything else.
- Manual packaging: `bundler: manual@2026` and `app.package` (#40). Loader resolves entry points from the package path; `.wasm` imports and data-file requires must load (apps that work in Forge must not fail in the simulator).
- `rovo:mcp` (#46, #25) and `rovo:skill` (#44) modules: parse, validate references, invoke an action as an external MCP client.
- New dashboard modules GA and legacy dashboard deprecation (#37, #38); global full page (#20); `jira:fullPage` and `confluence:fullPage` deprecation (#23); Confluence static macros (#48); Jira page display conditions (#42).
- Small parity items: invocation limits (#31), LLM TPM limit (#45), Opus 5 in the `@forge/llm` shim (#21), bridge invoke metadata (#24), browser storage manifest key (#22), Object Store `currentVersion` deprecation (#17), Bitbucket PR `changes` field (#35), bulk-edit custom field context (#32), `migratedFrom` (#34), regional remote URLs (#49), refreshed labelling (#50).
- `@forge/react` component sync automation (#3).
- Maintenance: stale-daemon self-detection in the MCP server, runtime-mismatch warning dedupe, `resolver.define` overwrite warning noise on reset+deploy.
- Watch only: Container services developer preview (#19), User Impersonation RFC-149 (#43), dashboard filters EAP.

### 0.3 Graph and agents (3 to 4 weeks)

Forge apps are becoming agent surfaces. The simulator should be the place you test that before deploying.

- Teamwork Graph shim (#47): `requestTeamworkGraph` on `@forge/bridge` and `@forge/api`, `read:graph:jira` / `read:graph:confluence` scope validation, a canned fixture graph (work items, sprints, pages, teams, external PRs and deployments) routed through `forge_mock_graphql`. Note: the API is EAP as of 2026-10-07; the shim is built against the documented Cypher-in-GraphQL shape and must be re-verified when Atlassian publishes Preview.
- Local MCP bridge: expose an app's declared `rovo:mcp` tools as a real MCP server on localhost so Claude Desktop, Cursor, or Codex can call a Forge app before it is deployed. Tool invocations run through the same simulator the Tools UI inspects.
- `@forge/llm` shim: current model list, 500k TPM limit, rate-limit error shapes.

### 0.4 Interop and determinism (3 to 4 weeks)

- **Record/replay (cassettes).** Priority chain becomes: property routes, mock routes, cassette, real API, record. Record mode captures every request that falls through the mocks while connected with a PAT into `.forge-sim/cassettes/<name>.json`; replay mode answers from the cassette with no credentials and returns the existing 501 contract (naming the cassette and key) on a miss; auto mode replays when present and records when not (never the CI default). Matching key is method plus path plus query, with a body hash for non-GET and a per-cassette `matchOn` to ignore cache-buster params. A cassette is an ordered sequence, not a map: repeated keys are consumed in order so GET, PUT, GET replays honestly. Redaction is mandatory: strip auth headers and cookies at record time; tokenize account IDs, emails, display names, and site hostnames consistently across the cassette; `cassette scrub` re-cleans old files. Kept response headers are an allowlist (`content-type`, `x-ratelimit-*`, `retry-after`, `link`). Cassette bodies are validated against the OpenAPI spec per route so neither mocks nor the spec can drift unnoticed. `cassette diff` re-records to a temp file and reports shape changes. Surfaces: CLI flags on `dev`, `createSimulator({ cassette })`, MCP tools (`forge_cassette_record`, `forge_cassette_replay`, `forge_cassette_list`, `forge_cassette_scrub`), and a record button in the Tools UI mock panel. The docs sample app and fixture tests move to cassettes so a fresh clone runs without an Atlassian account.
- **RFC-148 alignment.** Atlassian's Docker-backed local storage prototype becomes the reference for KVS, Custom Entity, Secret Store, and SQL semantics. Build a differential suite that runs the same operations against both, fix the simulator where it disagrees, file upstream where the emulator is wrong. Adopt the `seed --kvs <json>` and `seed --sql <sql>` file formats so seed data moves between `forge tunnel --local-storage` and `forge-sim dev`. Stretch: a `--storage=atlassian-emulator` backend so the simulator can run on their storage while owning modules, renderer, triggers, product API, and cassettes.
- **Playwright story for Custom UI (#8).** A `forge-sim/test` helper boots the dev server in-process on a free port, opens a module with context (`openModule('issue-panel', { issueKey })`), routes bridge `invoke` calls to the same simulator instance the test can inspect, and tears down cleanly. Resolve or properly document the headless Atlaskit-in-iframe `ERR_INSUFFICIENT_RESOURCES` failure instead of tagging tests `@headed`.
- Consumer-install e2e (#2) and richer context mocking (#7) ride along.

### Forge Realtime

Shim shipped and scoping fixed in v0.1.19 (#11). Production wire format is still Atlassian preview; network-layer parity waits for GA.

## Recently shipped

For the full history, see `git log`. Highlights of the last few weeks:

- **Dark / light / auto color mode** in the renderer (real-Forge `?theme=` contract)
- **Tools UI parity in `--proxy` mode** — full WebSocket log streaming + type-error broadcasts
- **`@forge/llm` shim** with Claude 4.6 / 4.7 + `forge-sim auth --llm`
- **`@forge/realtime` shim** — channel pub/sub, scoped + global publishes
- **Mock routes** via CLI / MCP / HTTP
- **Trigger event templates** — 141 typed events across Confluence, Jira, Jira Software, App Lifecycle
- **`appEvents.publish()`** — custom app event pub/sub
- **Custom Fields** (`jira:customField` / `customFieldType`) with view/edit/viewSubmit
- **Workflow modules** (validator / condition / postFunction)
- **Rovo Actions** (`action` module) + Command Palette (`jira:command`)
- **Web Triggers** — `/__trigger/<key>` HTTP endpoints with CORS
- **Background scripts** — `issueView`, `dashboard`, `globalBackgroundScript` via postMessage
- **Universal `--proxy` mode** — works with any bundler (forgebuilder uses this)
- **Real API proxy** (PAT + OAuth, mock-first with real fallback)
- **Forge Remotes** (FIT JWT + JWKS endpoint)
- **Per-function-type invocation timeouts** (resolver 25s, trigger 55s, scheduled/consumer up to 900s)
- **TypeScript type checking** integrated into dev workflow
- **General hardening pass** — silent-failure audit, manifest edge cases, error handling, e2e dev server tests, renderer integration tests

## Completed (foundational)

### Core simulator
- KVS, SQL (real MySQL), Queues, Entity Store, Secrets — all persistent + MCP-introspectable
- `.forge-sim/state/` directory: `entities.json` + `sql.dump`, auto-save / restore, `--clean` flag

### UIKit 2 renderer
- 73/73 components mapped to real Atlaskit
- Dual-mode: browser (CDT-debuggable) + server (MCP/AI-driven)
- Live preview via WebSocket dev server
- Dark / light / auto color mode

### Custom UI support
- Auto-detects from manifest, serves resource directory via Vite OR proxies external dev server
- `@forge/bridge` shim injection
- `invoke()`, `view.getContext()`, `requestJira()` all routed through simulator

### Tools UI (`/__tools/`)
- KVS browser, SQL runner, log streaming, event firing, mock routes
- Served by Vite middleware AND by proxy mode (full parity)

### Credentials + real API
- PAT (Basic auth) + OAuth 2.0 (3LO) + LLM API key
- `forge-sim auth` CLI
- Real API proxy: mock routes priority, real API fallback
- OAuth token refresh
- External auth providers (`asUser().withProvider()`)

## Test suite

<!-- BEGIN:STATS -->
**2,732 tests** across **146** test files
(2,566 core / 139 files
+ 166 renderer / 7 files)

**41 MCP tools** + **4 resources**
<!-- END:STATS -->

> The block above is auto-generated by `npm run docs:stats`. Run after adding tests or MCP tools.

Coverage spans simulator core, remotes, module routing, bridge invoke routing, proxy server, modal bridge, multi-module routing, deployer, manifest parser + edge cases, KVS, SQL, queues, entity store, product API mock + real, custom fields, workflow modules, Rovo actions, web triggers, background scripts, persistence, dev server e2e, and visual snapshots.

## Three dev modes

| Scenario | Command | What happens |
|----------|---------|--------------|
| UIKit app | `forge-sim dev` | Vite renders Atlaskit components from ForgeDoc |
| Custom UI (simple) | `forge-sim dev` | Vite serves resource directory, injects bridge |
| Custom UI (own dev server) | `forge-sim dev --proxy <url>` | Proxies external server, injects bridge, full Tools UI |
