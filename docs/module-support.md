# Forge Module Support Matrix

Every Forge module type catalogued with forge-sim's implementation level.

**Last updated:** 2026-03-21

## Legend

| Level | Meaning |
|-------|---------|
| ✅ Full | Manifest parsed, UI rendered or function invocable, context hydrated |
| ⚠️ Partial | Parsed and usable but missing some features (noted) |
| 🔇 Stub | Won't crash — imported shims are no-ops, but no real simulation |
| ❌ None | Not parsed, not handled. Would be silently ignored or error |

## Execution Patterns

Every Forge module falls into one of these patterns:

| Pattern | Description | How forge-sim handles it |
|---------|-------------|------------------------|
| **UI + Resolver** | Has `resource:` + `render: native` + `resolver.function` or `resolver.endpoint`. UIKit 2 server-rendered components. | ✅ Full render pipeline: deploy → ForgeDoc → Atlaskit renderer |
| **UI + Custom UI** | Has `resource:` pointing to static HTML/JS/CSS. No `render: native`. Iframe with `@forge/bridge`. | ✅ Vite serves resource dir, bridge shim handles RPC |
| **UI + Proxy** | Same as Custom UI but dev uses external bundler. `forge-sim dev --proxy <url>` | ✅ Reverse proxy with bridge injection |
| **Function (trigger)** | `trigger` module with `function:` and `events:[]`. Called as `(event, context)` | ✅ Fireable via MCP/CLI |
| **Function (consumer)** | `consumer` module with `function:` and `queue:`. Called as `(event, context)` | ✅ Wired to SimulatedQueue |
| **Function (scheduled)** | `scheduledTrigger` with `function:` and `schedule.interval`. Called as `(request)` single arg | ✅ Fireable via MCP/CLI |
| **Function (web trigger)** | `webtrigger` with `function:`. Called as `(request, context)` → returns `{ statusCode, headers, body }` | ✅ HTTP endpoints at `/__trigger/<key>`, full request/response mapping |
| **Config-only** | Pure manifest declaration, no function or resource. Declares metadata for Forge platform. | N/A — nothing to simulate |
| **Host-driven** | Has `function:` but only invoked by host product during specific workflows (not user-initiated) | 🔇 Function loads but no invocation path |
| **Nested UI** | Has `view.resource` / `edit.resource` instead of top-level `resource:` | ❌ Manifest parser doesn't extract nested resources |

---

## Platform Modules (Product-Agnostic)

| Module Key | Pattern | Level | Notes |
|------------|---------|-------|-------|
| `function` | — | ✅ Full | Loaded, registered in FunctionRegistry, invocable |
| `consumer` | Function (consumer) | ✅ Full | Wired to queues, correct `(event, context)` calling convention |
| `trigger` | Function (trigger) | ✅ Full | Registered by event name, fireable via `fire_trigger` |
| `scheduledTrigger` | Function (scheduled) | ✅ Full | Single-arg `(request)` convention, fireable on demand |
| `webtrigger` | Function (web trigger) | ✅ Full | Manifest parsed, function registered, HTTP endpoints served at `/__trigger/<key>`. Full request/response mapping: headers and query params as multi-value maps, CORS support. `webTrigger.getUrl()` returns the real local URL when dev server is running. |
| `endpoint` | — | ✅ Full | Parsed, used for Forge Remotes endpoint resolution |

---

## Jira Modules

### Standard UI Modules

These all follow the **UI + Resolver** or **UI + Custom UI** pattern. They have `resource:`, optional `resolver:`, and render in the browser.

| Module Key | Level | Context | Notes |
|------------|-------|---------|-------|
| `jira:issuePanel` | ✅ Full | `issue: { key, id, type, typeId }, project: { key, id }` | Primary test target. Full context hydration via real API. |
| `jira:issueActivity` | ✅ Full | Issue context | Same as issuePanel |
| `jira:issueContext` | ✅ Full | Issue context | Same as issuePanel |
| `jira:issueGlance` | ✅ Full | Issue context | Same as issuePanel |
| `jira:issueAction` | ✅ Full | Issue context | Renders in modal in real Forge. We render as panel. |
| `jira:globalPage` | ✅ Full | `{ type }` | Full-page module. `view.createHistory()` works for routing. |
| `jira:projectPage` | ✅ Full | `project: { key, id }` | Project-scoped page |
| `jira:adminPage` | ✅ Full | `{ type }` | Admin settings page |
| `jira:projectSettingsPage` | ⚠️ Partial | Generic | Parsed as UI module. No project-settings-specific context. |
| `jira:personalSettingsPage` | ⚠️ Partial | Generic | Parsed as UI module. No user-settings-specific context. (Preview) |
| `jira:dashboardGadget` | ✅ Full | `{ type }` | Dashboard widget |
| `jira:issueNavigatorAction` | ⚠️ Partial | Generic | Parsed as UI module. No issue-navigator-specific context. (Preview) |
| `jira:backlogAction` | ⚠️ Partial | Generic | Parsed as UI module. No backlog-specific context. (Preview) |
| `jira:boardAction` | ⚠️ Partial | Generic | Parsed as UI module. No board-specific context. (Preview) |
| `jira:sprintAction` | ⚠️ Partial | Generic | Parsed as UI module. No sprint-specific context. (Preview) |
| `jira:command` | ⚠️ Partial | Generic | Command palette item. Parsed as UI module if it has `resource:`. No command palette simulation. (Preview) |

### Background Scripts

| Module Key | Level | Notes |
|------------|-------|-------|
| `jira:issueViewBackgroundScript` | ⚠️ Partial | Has `resource:` so gets parsed as a UI module. Would render/serve correctly. **Issue:** shows up in module picker as if it's a visible panel. Should be invisible. Uses `events` API for cross-module communication. |
| `jira:dashboardBackgroundScript` | ⚠️ Partial | Same as above. Invisible container for dashboard data sharing. |
| `jira:globalBackgroundScript` | ⚠️ Partial | Same pattern. (Preview) |

### Custom Fields

| Module Key | Level | Notes |
|------------|-------|-------|
| `jira:customField` | ❌ None | **Nested UI pattern.** Has `view.resource`, `edit.resource`, `view.value.function`, `formatter.expression` — none of which our manifest parser extracts. These are structurally different from standard UI modules. Would need: (1) nested resource extraction, (2) view/edit mode switching, (3) Jira expression evaluation for formatters, (4) value function invocation. |
| `jira:customFieldType` | ❌ None | Same as `jira:customField` but defines a reusable type. Also has `resolver:` for data. Even more complex — needs `schema` validation and `searchSuggestions` expression eval. |

### Data / Logic Modules

| Module Key | Level | Notes |
|------------|-------|-------|
| `jira:jqlFunction` | ❌ None | Has `resolver.function` or `resolver.endpoint` but no `resource:`. Returns JQL-compatible data. Not parsed as UI module (correctly), but no invocation path exists. Would need a JQL context simulation. |
| `jira:entityProperty` | ❌ None | **Config-only.** Declares indexed entity properties for JQL. No function, no resource. Nothing to simulate — this is a Forge platform indexing instruction. |
| `jira:globalPermission` | ❌ None | **Host-driven function.** `function:` returns boolean. Only invoked by Jira permission checks. No simulation path. |
| `jira:projectPermission` | ❌ None | Same as globalPermission but project-scoped. |
| `jira:timeTrackingProvider` | ❌ None | **Nested UI.** Has `view.resource`, `edit.resource`. Replaces Jira's native time tracking. (Preview) |

### Workflow Modules

| Module Key | Level | Notes |
|------------|-------|-------|
| `jira:workflowValidator` | ❌ None | **Host-driven function.** Called during workflow transitions. May also have `resource:` for config UI. `@forge/jira-bridge` `workflowRules.onConfigure()` is stubbed (🔇). |
| `jira:workflowCondition` | ❌ None | Same pattern. (Preview) |
| `jira:workflowPostFunction` | ❌ None | Same pattern. (Preview) |

### UI Modifications

| Module Key | Level | Notes |
|------------|-------|-------|
| `jira:uiModifications` | 🔇 Stub | No resource/function in manifest. Host calls `uiModificationsApi.onInit/onChange` from `@forge/jira-bridge`, which we stub as no-ops. **Per Ryan: we don't care about this one.** |

### Full Page (New)

| Module Key | Level | Notes |
|------------|-------|-------|
| `jira:fullPage` | ⚠️ Partial | Parsed as UI module if it has `resource:`. Functionally same as `jira:globalPage`. (Preview) |

---

## Confluence Modules

### Standard UI Modules

| Module Key | Level | Context | Notes |
|------------|-------|---------|-------|
| `confluence:globalPage` | ✅ Full | `{ type }` | Full-page Confluence module |
| `confluence:spacePage` | ✅ Full | `{ type }` | Space-scoped page |
| `confluence:contentAction` | ✅ Full | `content: { id }, space: { key, id }` | More actions menu on pages/blogs |
| `confluence:contentBylineItem` | ✅ Full | `content: { id }, space: { key, id }` | Content byline metadata |
| `confluence:contextMenu` | ✅ Full | `content: { id }, space: { key, id }` | Text selection context menu |
| `macro` | ✅ Full | `content: { id }, space: { key }` | Confluence macro. Full support. |
| `confluence:spaceSettings` | ⚠️ Partial | Generic | Parsed as UI module. No space-settings-specific context. |
| `confluence:globalSettings` | ⚠️ Partial | Generic | Parsed as UI module. No global-settings-specific context. |
| `confluence:spaceSidebar` | ⚠️ Partial | Generic | Parsed as UI module if it has `resource:`. |
| `confluence:homepageFeed` | ⚠️ Partial | Generic | Parsed as UI module. No homepage-specific context. |
| `confluence:pageBanner` | ⚠️ Partial | Generic | Parsed as UI module. |
| `confluence:customContent` | ⚠️ Partial | Generic | Parsed as UI module if it has `resource:`. Custom content type definition. |

### Background Scripts

| Module Key | Level | Notes |
|------------|-------|-------|
| `confluence:backgroundScript` | ⚠️ Partial | Same situation as Jira background scripts — parsed as UI module, would render, but should be invisible. |

---

## Bitbucket Modules

All Bitbucket modules follow standard UI patterns (resource + resolver) but we have no Bitbucket-specific context hydration.

| Module Key | Level | Notes |
|------------|-------|-------|
| `bitbucket:repoCodeOverviewCard` | ⚠️ Partial | Parsed as UI module. No repo context. |
| `bitbucket:repoCodeOverviewAction` | ⚠️ Partial | Parsed as UI module. Renders modal in real Forge. |
| `bitbucket:repoCodeOverviewPanel` | ⚠️ Partial | Parsed as UI module. |
| `bitbucket:repoPullRequestCard` | ⚠️ Partial | Parsed as UI module. No PR context. |
| `bitbucket:repoPullRequestAction` | ⚠️ Partial | Parsed as UI module. |
| `bitbucket:repoPullRequestOverviewPanel` | ⚠️ Partial | Parsed as UI module. |
| `bitbucket:repoMainMenuPage` | ⚠️ Partial | Parsed as UI module. Full page. |
| `bitbucket:repoSettingsMenuPage` | ⚠️ Partial | Parsed as UI module. Settings page. |
| `bitbucket:workspaceSettingsMenuPage` | ⚠️ Partial | Parsed as UI module. |
| `bitbucket:mergeCheck` | ❌ None | **Host-driven function.** Called during PR merge. Returns pass/fail. No simulation path. |
| `bitbucket:dynamicPipelinesProvider` | ❌ None | **Host-driven function.** Generates pipeline YAML at runtime. |

---

## Compass Modules

| Module Key | Level | Notes |
|------------|-------|-------|
| `compass:adminPage` | ⚠️ Partial | Parsed as UI module. Standard admin page pattern. |
| `compass:componentPage` | ⚠️ Partial | Parsed as UI module. No component context. |
| `compass:globalPage` | ⚠️ Partial | Parsed as UI module. |
| `compass:teamPage` | ⚠️ Partial | Parsed as UI module. No team context. |
| `compass:dataProvider` | ❌ None | **Host-driven function.** Pushes metrics/events to Compass. |

---

## Jira Service Management Modules

All JSM modules follow standard UI patterns but target the customer portal, which has its own context and rendering surface.

| Module Key | Level | Notes |
|------------|-------|-------|
| `jiraServiceManagement:assetsImportType` | ❌ None | Modal for configuring asset imports. Specialized UI. |
| `jiraServiceManagement:organizationPanel` | ⚠️ Partial | Parsed as UI module. No org context. |
| `jiraServiceManagement:portalFooter` | ⚠️ Partial | Parsed as UI module. Portal-specific. |
| `jiraServiceManagement:portalHeader` | ⚠️ Partial | Parsed as UI module. Portal-specific. |
| `jiraServiceManagement:portalProfilePanel` | ⚠️ Partial | Parsed as UI module. |
| `jiraServiceManagement:portalRequestCreatePropertyPanel` | ⚠️ Partial | Parsed as UI module. Saves data as issue properties during request creation. |
| `jiraServiceManagement:portalRequestDetail` | ⚠️ Partial | Parsed as UI module. |
| `jiraServiceManagement:portalRequestDetailPanel` | ⚠️ Partial | Parsed as UI module. Side panel. |
| `jiraServiceManagement:portalRequestViewAction` | ⚠️ Partial | Parsed as UI module. |
| `jiraServiceManagement:portalSubheader` | ⚠️ Partial | Parsed as UI module. |
| `jiraServiceManagement:portalUserMenuAction` | ⚠️ Partial | Parsed as UI module. |
| `jiraServiceManagement:queuePage` | ⚠️ Partial | Parsed as UI module. Queue management page. |

---

## Rovo Modules

| Module Key | Level | Notes |
|------------|-------|-------|
| `rovo:agent` | ❌ None | **Config-only + AI.** Defines an AI agent with prompt, conversation starters, and action references. No function, no resource (except for icons). Would need an LLM integration to simulate. Entirely different paradigm. |
| `action` | ❌ None | **Typed function.** Called by Rovo agents. Has input/output schema in manifest + `function:` handler. Could theoretically be invoked like a regular function, but we don't parse the `action` module type. |

---

## Automation Modules

| Module Key | Level | Notes |
|------------|-------|-------|
| `automation:condition` | ❌ None | Jira/Confluence automation rule condition. Function-based. |
| `automation:action` | ❌ None | Automation rule action. Function-based. |

---

## Teamwork Graph Modules

| Module Key | Level | Notes |
|------------|-------|-------|
| `teamwork:entityDataProvider` | ❌ None | Pushes data to Atlassian's Teamwork Graph. |

---

## Summary by Level

| Level | Count | Modules |
|-------|-------|---------|
| ✅ Full | 22 | `function`, `consumer`, `trigger`, `scheduledTrigger`, `webtrigger`, `endpoint`, `jira:issuePanel`, `jira:issueActivity`, `jira:issueContext`, `jira:issueGlance`, `jira:issueAction`, `jira:globalPage`, `jira:projectPage`, `jira:adminPage`, `jira:dashboardGadget`, `confluence:globalPage`, `confluence:spacePage`, `confluence:contentAction`, `confluence:contentBylineItem`, `confluence:contextMenu`, `macro`, `jira:fullPage` |
| ⚠️ Partial | 33 | all Bitbucket UI, all JSM portal, all Compass UI, background scripts, Jira preview modules, Confluence secondary pages |
| 🔇 Stub | 1 | `jira:uiModifications` |
| ❌ None | 17 | `jira:customField`, `jira:customFieldType`, `jira:jqlFunction`, `jira:entityProperty`, `jira:globalPermission`, `jira:projectPermission`, `jira:timeTrackingProvider`, `jira:workflowValidator`, `jira:workflowCondition`, `jira:workflowPostFunction`, `bitbucket:mergeCheck`, `bitbucket:dynamicPipelinesProvider`, `compass:dataProvider`, `rovo:agent`, `action`, `automation:*`, `teamwork:*` |

## Key Gaps (Ordered by Impact)

1. ~~**Web triggers** — Parsed but no HTTP endpoint. Half-day fix. High value.~~ ✅ **Done!** HTTP endpoints at `/__trigger/<key>`, full request/response mapping, dynamic `getUrl()`.
2. **Custom fields** (`jira:customField`, `jira:customFieldType`) — Nested `view`/`edit` resource pattern breaks our manifest parser. Medium-high effort. Would unlock a significant class of Forge apps.
3. **Background scripts** — Work but show in module picker as visible panels. Quick UX fix (filter by module type).
4. **JQL functions** — Resolver exists but no invocation path outside UI context. Niche but some apps depend on it.
5. **Bitbucket/Compass/JSM context** — UI renders but extension context is generic. Low priority unless someone's actually building for those products.
6. **Rovo** — Completely different paradigm (AI agents). Not worth simulating until Atlassian's Rovo story stabilizes.
7. **Workflow/Permission/Merge Check** — Host-driven functions with no simulation trigger. Very niche.
