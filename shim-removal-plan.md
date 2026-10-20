# Shim-removal plan — state, map, and Phase 4

> Handoff doc for the bare-seam migration (#40 follow-on). Written at the end
> of the session that completed Phases 0–3, for whoever (human or agent) picks
> up Phase 4. Everything here was verified against code during that session;
> commit SHAs are the receipts. Delete this file when Phase 4 lands.

## Where the migration stands

**Goal (decided by Ryan):** replace import-time shims with the bare platform
seams real Forge injects, reverse-engineered locally from the published
packages — the same approach as the `window.__bridge` frontend consolidation.
Motivation: bundled ("shape 2") apps inline import specifiers, so loader hooks
never fire; seams work regardless of packaging. Bonus discovered along the
way: running the real packages means their client-side validation applies and
the contract can't drift from itself.

**Done, one commit per slice (read these messages — they record what was
verified and every judgement call):**

| Phase | Commit | What |
|---|---|---|
| 0 | `c39f10d` | Seam contract pinned: `src/runtime/seam-registry.ts` (9 `__forge_fetch__` descriptor types, 11 `__forge_runtime__` fields, every entry a `node_modules` file:line) + `runtime-seam.test.ts` re-derives both from the installed packages AND cross-checks field names against the `ForgeRuntime` type in `runtime.d.ts` (independent source — the scan and registry once agreed on a misread `appCodeDir`). |
| 1 | `1d8863c` | `global.__forge_runtime__` as a live getter over an AsyncLocalStorage of per-invocation info; fixed the resolver active-context save/restore race. Getter must NEVER return undefined (`import '@forge/llm'` throws via an eager class-field chain). `runtime.kvs` deliberately omitted / `runtime.proxy` inert (import-time reads freeze closures — `when: 'import'` in the registry). |
| 2 | `9f4b421` | `src/runtime/seam-fetch.ts` routes all 9 descriptor types (native `Response`s; `forge-proxy-error` header is CONTROL FLOW — the packages throw typed errors off it). Bundled backends work; ROADMAP decision resolved. |
| 3a–3f | `6d2b002`, `238ed08`, `281d150`, `e2f4eff`, `71b7eee`, `6923de5` | Shims deleted one package per commit: kvs, llm, object-store, realtime (payload JSON parse + JWT-shaped tokens — the token format is a PLATFORM contract, the real client validates it client-side), events (plus `npm run build` now cleans dist — orphaned compiled shims were resolvable zombies via the `./shims/*` export), api (legacy `storage` gone — Atlassian removed it June 2026; permissive authorize default moved to product-api layer; backend i18n materialization; passthrough resolution fallbacks). |
| pin | `9de331a` | `@forge/api/out/api/i18n.js` deep-require verified (plain node + mutation test) and pinned by name in `runtime-seam.test.ts`. |

**Current `SHIM_NAMES` (8):** `@forge/resolver`, `@forge/react`,
`@forge/react/router`, `@forge/bridge`, `@forge/bridge/realtime`,
`@forge/jira-bridge`, `@forge/confluence-bridge`, `@forge/dashboards-bridge`.

**`PASSTHROUGH_OK` (7):** sql, kvs, llm, object-store, realtime, events, api.
Three of those also need `CJS_DEFAULT_FACADE` in `src/loader/hooks.ts`
(`__esModule` + `exports.default`): sql, kvs, object-store, api. llm/realtime/
events have no default export.

## Vocabulary (reuse these names)

- **Seam A** = `global.__forge_fetch__` (I/O; 9 descriptor types) — impl
  `src/runtime/seam-fetch.ts`. **Seam B** = `global.__forge_runtime__`
  (identity/config) — impl `src/runtime/forge-runtime.ts`.
- **Shape 1 / shape 2** = specifiers preserved vs. bundled-and-inlined
  (`docs/reference/bundled-forge-packages.md` §1).
- **The lessons doc** = `bundled-forge-packages.md` "Lessons from the frontend
  consolidation" (12 numbered lessons). The ones that bit repeatedly this
  session: #5 (only real-package tests prove the real path), #6 (never
  reconstruct a wire shape from memory — read `node_modules` and cite), #10
  (the real package is stricter; fixtures that fail are usually wrong
  fixtures), #4 (never resolve undefined).
- **`*-package.test.ts` pattern** = per-package pins of REAL-package behaviors
  apps depend on (forge-kvs-/llm-/object-store-/events-package.test.ts),
  loaded via `createRequire` (CJS bypasses vitest aliases).

## Phase 4 — finish the bridge in Node (PLANNED, not started)

The frontend consolidation left `@forge/bridge` aliased in Node source mode
(vitest + headless). The browser and prebuilt bundles already run the real
package against `src/bridge/protocol/` + hosts.

### Load-bearing facts (all verified this session)

1. Real `@forge/bridge` captures `globalThis.__bridge` at **module
   evaluation** (`out/bridge.js` getCallBridge; ~25 modules do top-level
   `const callBridge = getCallBridge()`) and THROWS if absent. Headless
   installs the seam only in the render path (`src/ui/simulator-ui.ts:278` →
   `installBridge()` in `src/ui/bridge.ts:573`). Many tests/fixtures import
   `@forge/bridge` at module top — today the alias absorbs the ordering
   problem.
2. The 1,194-line `src/shims/forge-bridge.ts` is a mix: thin `callBridge`
   routing (invoke, view, fetchProduct, router, flags — frames already real,
   pinned by `bridge-shim-frames.test.ts`) AND sim infrastructure that does
   NOT belong in an app-facing module: memory history (v4 listener semantics
   — see the comment block at its top; v5-style notify breaks Route matching),
   the view-event store (`emitViewEvent`/`onViewEvent`), a local cross-module
   events map, `Modal`, `FeatureFlags`, permissions stubs.
3. The sim's own code imports from that shim: `src/bridge/hosts/headless.ts`
   and `src/ui/simulator-ui.ts` (view events, `createMemoryHistory`). That
   coupling must be inverted before the alias can go.
4. Headless `requestJira` through the REAL package only works because
   `installRelativeRequestBase()` (ui/bridge.ts) patches around
   `new Request('', init)` throwing `Invalid URL` under plain Node
   (`@forge/bridge/out/fetch/fetch.js` parseRequest). Whatever installs the
   always-present seam must carry those patches (`installDocumentStub`,
   `installRelativeI18nFetch`, `installRelativeRequestBase`).
5. The three product bridges (`@forge/jira-bridge` etc.) ship **no `main` and
   no `exports`** — a bare import cannot resolve AT ALL without loader/vitest
   assistance mapping the specifier → `out/index.js`. Their real code talks to
   `globalThis.__bridge` and emits **~11 commands that are NOT in
   `BRIDGE_COMMANDS`** (the registry derives only from `@forge/{bridge,react}`):
   `openIssueCreateModal`, `openIssueViewModal`, `refreshIssueView`,
   `getCustomFieldInternalAPI`, `getUiModificationsInternalAPI`,
   `setWorkflowRuleConfigurationCallback`, `getEditorContent`,
   `getMacroContent`, `updateMacro`, `setMacroViewportHeight`, `emit`.
   Under the real packages these would hit the dispatcher's unknown-command
   rejection (correct posture until classified).
6. `@forge/react`'s shim (185 lines) is already the sanctioned
   shim-wraps-real pattern: it patches `render()`/`addConfig()` to capture
   elements for the N9 vitest-cache replay (a cached bundle never re-runs its
   top-level `render()`, so no fresh `reconcile` frame ever reaches the host
   — the capture has no seam equivalent). Recommendation: KEEP it (and
   `@forge/react/router`).

### Slices (one commit each; run core + renderer + **Playwright e2e** per
slice — frontend surface, unlike Phases 1–3 which could skip e2e)

- **4a — seam always present. DONE** in two commits: `7e0842f` (view-event
  store → `src/ui/view-events.ts`, memory history → shared
  `src/bridge/memory-history.ts`; the sim no longer imports from the shim;
  the four sim-only exports left the shim) and the commit after `be94d7c`
  (`installBridgeSeam(sim)` in `src/ui/bridge.ts`, called from
  `setSimulator()` beside Seams A/B, carrying the fact-4 Node patches;
  pinned by `bridge-seam.test.ts`, in-process via `createRequire` AND
  spawned plain-node against `dist/`, with a no-sim negative control).
  Findings that narrowed the slice: the only real coupling was the
  view-event store — the shim's memory history was used by nothing in the
  sim and duplicated the browser host's; and there is a THIRD history
  (`handleCreateHistory` in `src/ui/bridge.ts`, WS-proxied) which is what
  the headless host actually serves, so under the real package headless
  `view.createHistory()` returns that one, not the shim's memory history —
  a 4c behavior question. Also fixed en route: `be94d7c` repaired the
  external-auth Playwright spec that still imported the deleted
  `@forge/api` shim (e2e was never run in Phases 1–3).
- **4b — product-bridge command derivation.** Extend
  `bridge-protocol.test.ts`'s `commandsEmittedBy()` scan to the three product
  bridges; add each command to `BRIDGE_COMMANDS` as routed or
  `unsupported:` with a reason. Mutation-test the derivation (remove/add an
  entry, watch it fail both ways — the Phase 0 ritual).
- **4c — drop `@forge/bridge` + `@forge/bridge/realtime`.** Real package runs
  headless. Budget the lesson-10 fixture pass (flag `id`s,
  `NavigationLocation`, the strictness list in CLAUDE.md's quirks). Sim-only
  helpers formerly exported from the shim move to a `forge-sim` export.
  Watch: the shim's LOCAL cross-module events map vs. the host's event
  channel are two implementations — tests may depend on the shim's; `Modal`
  / `FeatureFlags` `instanceof` identity.
- **4d — drop the three product-bridge stubs.** Loader + vitest resolve the
  bare specifier → `out/index.js` (resolution assistance, kvs-facade spirit —
  real Forge also only loads these through a bundler). Real code then hits
  the 4a seam, answered or loudly rejected per 4b.
- **4e — decision recorded:** keep `@forge/react` + `/router` shims (fact 6).
  End state: `SHIM_NAMES = ['@forge/resolver', '@forge/react',
  '@forge/react/router']` — one seamless package, one documented fallthrough.

### How to work (the ritual that held up across 10 commits)

1. Diff real exports vs shim BEFORE touching anything (node -e with a
   `__forge_runtime__` stub for import-time readers; `createRequire` bypasses
   aliases). 2. Read the real package's wire/behavior code and cite
   file:line in comments — every bug this session was a detail guessed from
   memory (realtime payload stringify, token base64url, `.name` = error CODE
   on upstream error classes, synchronous throwers). 3. Flip registry entries
   + delete shim + repoint tests to the package. 4. Add/extend a
   `*-package.test.ts` pinning real behaviors (especially new client-side
   validation). 5. Full gates before commit; mutation-test any new
   derivation. 6. Doc sweep: `docs/testing/README.md` alias blocks,
   `skills/forge-local-dev/SKILL.md`, `architecture.md`, CLAUDE.md bullets —
   `docs-bundler-config.test.ts` now asserts docs do NOT alias removed shims
   (alias-map syntax only, prose mentions allowed).

### Traps already hit once (don't re-hit)

- **vitest resolution for passthrough packages is a `resolveId` FALLBACK
  plugin** (`forgeSimPassthroughFallback` in vitest.config.ts), NOT an alias:
  an alias overrides apps shipping their own copy and breaks
  `migration-redeploy-parity.test.ts`. Node-side equivalent:
  `resolvePassthroughPackage()` in hooks.ts (importer first, forge-sim
  second). 4d's product-bridge mapping must follow the same precedence.
- **tsc leaves stale dist output.** Build now cleans first; if you see a
  "passing" test that should fail, suspect `dist/` anyway.
- **`@forge/api`'s TranslationsGetter and `@forge/sql`'s migrationRunner are
  module-level singletons** that outlive simulators. i18n invalidation:
  `invalidateRealI18nCache()` in `src/i18n-store.ts` (pinned in
  runtime-seam.test.ts). Any similar singleton found in the bridge family
  needs the same treatment.
- `sim.i18n.i18nRootDir()` is why backend i18n works: appCodeDir must be the
  PARENT of the real `__LOCALES__` dir (standard layout nests it under
  `src/`), and programmatic translations are materialized to a temp bundle
  (sync fs — the runtime getter can't await).
- Full core suite ≈ 40s wall / ~260s CPU; MySQL suites are the long pole.
  Current green baseline: core 158 files / 2825 tests (+1 seam pin = 2826),
  renderer 170.

## After Phase 4 (parked)

- **Bundled-app e2e:** the migration's premise (shape-2 backends work) is
  proven per-package but never with one actually-bundled app deployed
  end-to-end. Build a fixture whose backend is esbuild-bundled WITHOUT
  `--external:@forge/*` and run it through deploy/invoke/queue/kvs.
- `deferred-issues.md`: the architecture.md drift entry is partially resolved
  (kvs bullet struck); re-audit the rest after 4c rewrites the bridge docs.
- `npm run docs:stats` + `docs:stats:check` at the next release (counts moved
  a lot); release ritual also bumps `.claude-plugin/{plugin,marketplace}.json`.
- `tpp` seam: a configured provider with an account whose token is invalid
  gets `forge-proxy-error: NEEDS_AUTHENTICATION_ERR` (agreed design); the
  mock-route-miss 501 was left as-is, and Ryan flagged 404 as the better
  answer "later" — unaddressed.
