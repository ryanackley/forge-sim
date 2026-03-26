# Module Improvement Plan

Actionable plan to bring every non-green module closer to full support. Ordered by impact and feasibility.

**Last updated:** 2026-03-22

---

## ~~1. Web Triggers — ⚠️ → ✅~~ ✅ DONE (2026-03-22)

Implemented! HTTP endpoints at `/__trigger/<key>` in both Vite and proxy dev server modes. 17 tests covering request/response mapping, error handling, CORS, multi-value headers/params, and dynamic `webTrigger.getUrl()`.

---

## ~~2. Background Scripts — ⚠️ → ✅~~ ✅ DONE (2026-03-23)

Implemented! Background scripts are filtered from the module picker. Compatible UI modules show a checkbox (checked by default) that loads the background script in a hidden iframe via `?bg=<key>`. Cross-module events relay via `window.postMessage` with the parent page acting as broker — matching how real Forge relays events between module iframes. Experience scoping for `jira:globalBackgroundScript` (`issue-view`, `board`, `dashboard`, `all`). 43 tests covering manifest parsing, context mapping, experience scoping, module picker filtering, and event relay.

---

## ~~3. Jira Custom Fields — ❌ → ✅~~ ✅ DONE (2026-03-24)

Implemented! `jira:customField` and `jira:customFieldType` modules are now fully supported:
- **Manifest parser** extracts `view.resource` and `edit.resource` as separate sub-modules (`<key>--view`, `<key>--edit`)
- **Module picker** groups view/edit sub-modules into a single row with View/Edit toggle buttons and a purple "Custom Field" badge + field type badge
- **Context enrichment** provides mock `fieldValue` based on field data type (number→42, string→"Sample value", user→mock user, etc.) and `fieldType` in `extension`
- **Value function** registered as resolver if present
- 22 new tests covering manifest parsing, module picker grouping, and context enrichment
- **Not implemented:** Jira Expressions (formatter, searchSuggestions, validation), schema validation, `jira:customFieldType` reuse patterns

---

## ~~4. Partial Context Modules (4a-4d) — ⚠️ → ✅~~ ✅ DONE (2026-03-26)

Implemented! Module-type-specific default contexts:
- `jira:projectSettingsPage` + `jira:projectPage` → default project context (key: SIM, id: 10001)
- `confluence:spaceSettings`, `confluence:spaceSidebar`, `confluence:spacePage` → default space context (key: SIM, id: 65536)
- `confluence:globalSettings`, `confluence:homepageFeed` → type-only context
- New `--project <key>` CLI flag with Jira project API hydration
- 10 new context tests

### 4b. Jira Agile Context (Preview modules) — Deferred
**Modules:** `jira:backlogAction`, `jira:boardAction`, `jira:sprintAction`, `jira:issueNavigatorAction`  
**Note:** All Preview modules. Low urgency. Need `--board`, `--sprint` flags + agile REST API hydration.  
**Effort:** ~2 hours when needed

### 4e. Bitbucket Context
**Modules:** All 9 Bitbucket UI modules  
**Fix:** Add Bitbucket context hydration:
- Repo modules need `repository: { uuid, slug, fullName }` — add `--repo` flag, hit Bitbucket API `2.0/repositories/<workspace>/<slug>`
- PR modules need `pullRequest: { id, title }` — add `--pr` flag
- This requires Bitbucket API auth support (currently we only support Jira/Confluence)
**Effort:** ~4 hours (including auth for Bitbucket API)  
**Priority:** Low unless someone asks. Bitbucket Forge apps are relatively rare.

### 4f. Compass Context
**Modules:** `compass:componentPage`, `compass:teamPage`, `compass:adminPage`  
**Fix:** Component/team IDs in context. Compass API is GraphQL-based, more complex to hydrate.  
**Effort:** ~3 hours  
**Priority:** Low. Compass Forge ecosystem is small.

### 4g. JSM Portal Context
**Modules:** All 12 JSM portal modules  
**Fix:** Portal modules need customer/request/queue context. JSM APIs are Jira-based but with service desk specifics (`/rest/servicedeskapi/...`).  
**Effort:** ~4 hours  
**Priority:** Low-medium. JSM has a real Forge ecosystem but portal modules are niche.

---

## 5. Jira Command Palette — ⚠️ → ✅

**Current state:** `jira:command` parsed as UI module if it has `resource:`. No command palette simulation.

**Plan:**
1. If the module has no `resource:` (pure function command), just register the function — it's invocable via MCP/CLI already
2. If it has `resource:`, it renders a configuration UI. Treat it as a standard UI module (already works)
3. **Optional:** Add a "Command Palette" simulation in the dev tools — a search box that lists registered commands and lets you trigger them. Nice UX but not essential.

**Effort:** 1 hour for the basic fix, ~3 hours with command palette simulation  
**Tests:** Command module detection, function invocation

---

## 6. Rovo Actions — ❌ → ⚠️

**Current state:** `action` module type not parsed at all. These are typed functions with input/output schemas callable by Rovo agents.

**Plan:**
1. Parse `action` modules from manifest — extract `key`, `function`, `inputSchema`, `outputSchema`
2. Register the function as a regular resolver (it's just a function handler)
3. Add an MCP tool `invoke_action` that validates input against the schema and calls the function
4. Skip the Rovo agent integration entirely — we're not simulating AI agent orchestration

**Effort:** ~3 hours  
**Tests:** Schema extraction, function invocation with schema validation  
**What we skip:** `rovo:agent` (AI orchestration), conversation flow, agent-to-action wiring

---

## 7. JQL Functions — ❌ → ⚠️

**Current state:** `jira:jqlFunction` not parsed. Has `resolver.function` or `resolver.endpoint` but no resource.

**Plan:**
1. Parse `jira:jqlFunction` as a non-UI module — extract function key, register it
2. Add an MCP tool `invoke_jql_function` that calls it with mock JQL context:
   ```json
   { "clause": { "field": "customFunction", "operator": "in", "values": ["arg1"] } }
   ```
3. The function returns JQL-compatible issue data. Display the result.
4. Skip actual JQL integration (we're not a JQL engine)

**Effort:** ~2 hours  
**Tests:** Function invocation with JQL-shaped payload  
**What we skip:** JQL parsing, JQL expression evaluation, search integration

---

## 8. Time Tracking Provider — ❌ → ⚠️

**Current state:** `jira:timeTrackingProvider` not parsed. Nested UI pattern (`view.resource`, `edit.resource`).

**Plan:** Same nested resource approach as custom fields (item 3). Extract view/edit resources, render with mode toggle, provide mock time tracking data in context.

**Effort:** ~2 hours (if custom fields are done first — reuses the nested resource infrastructure)  
**Depends on:** Item 3 (custom fields)

---

## 9. Workflow Modules — ❌ → ⚠️

**Current state:** `jira:workflowValidator`, `jira:workflowCondition`, `jira:workflowPostFunction` not parsed.

**Plan:**
1. Parse the function from manifest, register it
2. Add MCP tools to invoke each type with appropriate mock payloads:
   - Validator: `{ transition: { from, to }, issue: { key } }` → returns `{ isValid: true/false, errorMessage? }`
   - Condition: same input → returns boolean
   - Post-function: same input → side effects (KVS writes, API calls)
3. If the module has `resource:` (config UI), parse and render it

**Effort:** ~3 hours  
**Tests:** Invocation with mock transition data, config UI rendering  
**What we skip:** Actual workflow integration (transition simulation)

---

## 10. Host-Driven / Config-Only — ❌ (No Change)

These modules have no practical simulation path. Documenting why and moving on.

| Module | Why No Simulation |
|--------|-------------------|
| `jira:entityProperty` | Config-only. Declares JQL-indexable properties. No function, no resource. Nothing to run. |
| `jira:globalPermission` / `jira:projectPermission` | Function returns boolean, but only called by Jira's permission engine during specific API calls. We'd need to intercept permission checks in the product API proxy — extremely invasive for minimal value. |
| `bitbucket:mergeCheck` | Called during PR merge flow. Would need a "simulate merge" UI. Very niche. |
| `bitbucket:dynamicPipelinesProvider` | Generates pipeline YAML at runtime. Would need a "simulate pipeline creation" flow. |
| `compass:dataProvider` | Pushes data to Compass graph. The function runs but the destination doesn't exist locally. |
| `rovo:agent` | AI agent orchestration. Completely different paradigm — needs LLM integration, conversation management, action routing. Not worth it until Rovo stabilizes. |
| `automation:condition` / `automation:action` | Jira/Confluence automation rule components. Would need an automation rule simulator. Enormous scope for tiny audience. |
| `teamwork:entityDataProvider` | Pushes to Atlassian's internal Teamwork Graph. No local equivalent. |
| `jira:uiModifications` | Already stubbed (🔇). Per Ryan: we don't care about this one. |

---

## Priority Summary

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| ~~🔴 P1~~ | ~~Web triggers~~ | ✅ Done | ~~Unlocks HTTP-triggered Forge apps~~ |
| ~~🔴 P1~~ | ~~Background script UX~~ | ✅ Done | ~~Fixes module picker noise~~ |
| ~~🟡 P2~~ | ~~Custom fields~~ | ✅ Done | ~~Unlocks major app category~~ |
| 🟡 P2 | Partial context (4a-4d) | ~2h | Quick wins, better DX for existing modules |
| 🟢 P3 | Rovo actions | ~3h | Forward-looking, schema-validated functions |
| 🟢 P3 | Command palette | ~1-3h | Nice UX polish |
| 🟢 P3 | JQL functions | ~2h | Niche but completeness |
| 🟢 P3 | Workflow modules | ~3h | Niche but some real apps use these |
| 🔵 P4 | Bitbucket/Compass/JSM context | ~11h total | Only if someone asks |
| 🔵 P4 | Time tracking provider | ~2h | Depends on custom fields |
| ⚪ Skip | Host-driven / Config-only | — | No practical simulation path |

**Total estimated effort for P1+P2:** ~14-16 hours  
**Total estimated effort for everything actionable:** ~40-45 hours
