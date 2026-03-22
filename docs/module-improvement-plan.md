# Module Improvement Plan

Actionable plan to bring every non-green module closer to full support. Ordered by impact and feasibility.

**Last updated:** 2026-03-22

---

## ~~1. Web Triggers — ⚠️ → ✅~~ ✅ DONE (2026-03-22)

Implemented! HTTP endpoints at `/__trigger/<key>` in both Vite and proxy dev server modes. 17 tests covering request/response mapping, error handling, CORS, multi-value headers/params, and dynamic `webTrigger.getUrl()`.

---

## 2. Background Scripts — ⚠️ → ✅

**Current state:** Parsed as UI modules because they have `resource:`. Show up in the module picker alongside real panels. Functionally they *work* — they load and run — but the UX is wrong.

**Affected modules:**
- `jira:issueViewBackgroundScript`
- `jira:dashboardBackgroundScript`
- `jira:globalBackgroundScript`
- `confluence:backgroundScript`

**Plan:**
1. Add a `BACKGROUND_SCRIPT_MODULES` set in `manifest.ts` (or `dev-command.ts`)
2. In the module picker (`generateModulePickerHtml`), either:
   - Filter them out entirely, OR
   - Show them in a separate "Background Scripts" section with a different badge (grey, "BG")
3. In the dev server, still load and serve them — they're valid resources that need to run. Just don't present them as "click to view" modules.
4. The `events` API (`view.on` / `view.emit`) that background scripts use for cross-module communication is already stubbed. If we want full support, wire `view.emit()` in one module to `view.on()` listeners in other modules via the WebSocket bridge.

**Effort:** ~2 hours for the UX fix, ~4 hours if we add cross-module events  
**Tests:** Module picker filtering, background script loading without errors

---

## 3. Jira Custom Fields — ❌ → ⚠️

**Current state:** Not parsed at all. The manifest parser skips them because they use a nested resource pattern (`view.resource`, `edit.resource`) instead of top-level `resource:`.

**Affected modules:**
- `jira:customField`
- `jira:customFieldType`

**Plan:**
1. **Manifest parser** — Extend `parseManifest` to detect nested resource patterns:
   ```yaml
   jira:customField:
     - key: my-field
       name: Priority Score
       type: number
       view:
         resource: main
       edit:
         resource: main
       value:
         function: calculateValue
       formatter:
         expression: "value"
   ```
   Extract `view.resource` and `edit.resource` as separate "sub-modules" or as a single module with multiple resource modes.

2. **Mode switching UI** — In the dev server, render custom fields with a toggle:
   - **View mode** — Renders the `view.resource` component (read-only display of field value)
   - **Edit mode** — Renders the `edit.resource` component (input for changing value)
   - Provide a mock field value in context that the view/edit components can read

3. **Value function** — If `value.function` is defined, register it as a resolver. This function computes the field value from issue data.

4. **Skip formatter expressions** — `formatter.expression` uses Jira Expressions (a DSL). Not worth implementing. Document as unsupported.

5. **Skip search suggestions** — `jira:customFieldType` has `searchSuggestions.expression`. Same story — Jira Expressions, skip it.

**Effort:** ~6-8 hours for basic view/edit rendering, value function  
**Tests:** Nested resource extraction, view/edit mode toggle, value function invocation  
**What we skip:** Jira Expressions (formatter, searchSuggestions), schema validation, `jira:customFieldType` reuse patterns

---

## 4. Partial Context Modules — ⚠️ → ✅

**Current state:** ~20 modules that parse and render correctly but have generic/empty extension context instead of product-specific context.

**Plan:** Group by context type and batch the fixes.

### 4a. Jira Project Context
**Modules:** `jira:projectSettingsPage`  
**Fix:** Add to `JIRA_PROJECT_MODULES` set in `context.ts`. Already have project hydration logic — just need the module type in the set.  
**Effort:** 15 minutes

### 4b. Jira Agile Context (Preview modules)
**Modules:** `jira:backlogAction`, `jira:boardAction`, `jira:sprintAction`, `jira:issueNavigatorAction`  
**Fix:** These need board/sprint/backlog IDs in context. Add CLI flags (`--board`, `--sprint`) and a new hydration path that hits `/rest/agile/1.0/board/<id>` etc. Keep it simple — accept the ID, stuff it in extension, optionally hydrate the name.  
**Effort:** ~2 hours  
**Note:** These are all Preview modules. Low urgency unless someone's actively building for them.

### 4c. Confluence Settings Context
**Modules:** `confluence:spaceSettings`, `confluence:globalSettings`  
**Fix:** `spaceSettings` needs `space: { key, id }` in context. Add to a `CONFLUENCE_SPACE_MODULES` set and reuse the `--space` flag for hydration. `globalSettings` just needs `{ type }` which it already gets.  
**Effort:** 30 minutes

### 4d. Confluence Secondary Pages
**Modules:** `confluence:spaceSidebar`, `confluence:homepageFeed`, `confluence:pageBanner`, `confluence:customContent`  
**Fix:** These are mostly `{ type }` context with maybe space info. Add to the appropriate context sets. `customContent` is more complex (defines a content type) but rendering-wise it's just a UI module.  
**Effort:** 1 hour

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
| 🔴 P1 | Background script UX | ~2h | Fixes module picker noise |
| 🟡 P2 | Custom fields (basic) | ~6-8h | Unlocks major app category |
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
