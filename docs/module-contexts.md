# Forge Module Context Reference

What `useProductContext()` / `view.getContext()` returns for every Forge module type.

**Source:** [Atlassian Forge Docs](https://developer.atlassian.com/platform/forge/manifest-reference/modules/)  
**Last updated:** 2026-03-09

---

## Common Context (All Modules)

Every module receives these top-level fields:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `accountId` | string | Current user's Atlassian account ID | `"5b10a2844c20165700ede21g"` |
| `cloudId` | string | Cloud instance ID | `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"` |
| `siteUrl` | string | Base URL of the Atlassian site | `"https://mysite.atlassian.net"` |
| `moduleKey` | string | The key of the current module from manifest | `"my-issue-panel"` |
| `environmentId` | string | Forge environment ID | `"abc123def456"` |
| `environmentType` | string | `"DEVELOPMENT"`, `"STAGING"`, or `"PRODUCTION"` | `"PRODUCTION"` |
| `localId` | string | Unique ID for this module instance | `"ari:cloud:ecosystem::extension/..."` |
| `locale` | string | User's locale | `"en-US"` |
| `timezone` | string | User's timezone | `"America/New_York"` |
| `license` | object | App license info | `{ active: true, type: "PAID" }` |
| `theme` | object | UI theme | `{ colorMode: "light" }` |
| `extension` | object | **Module-specific data (see below)** | varies |

---

## Jira Modules

### Issue-Level Modules

These modules all share the same extension shape. They render in the context of a specific Jira issue.

**Applies to:** `jira:issuePanel`, `jira:issueContext`, `jira:issueGlance`, `jira:issueActivity`, `jira:issueAction`

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `extension.type` | string | Module type | `"jira:issuePanel"` |
| `extension.issue.key` | string | Issue key | `"PROJ-42"` |
| `extension.issue.id` | string | Issue ID | `"10001"` |
| `extension.issue.type` | string | Issue type name | `"Story"` |
| `extension.issue.typeId` | string | Issue type ID | `"10001"` |
| `extension.project.id` | string | Project ID | `"10000"` |
| `extension.project.key` | string | Project key | `"PROJ"` |
| `extension.project.type` | string | Project type key | `"software"` |
| `extension.isNewToIssue` | boolean | First time panel is rendered on this issue | `true` |
| `extension.entryPoint` | string | `"edit"` for edit view, absent for main view | — |

#### `jira:issuePanel` (additional)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `extension.spacing` | string | Panel spacing setting | `"default"` |

---

### `jira:projectPage`

Renders as a tab in Jira project navigation.

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `extension.type` | string | Module type | `"jira:projectPage"` |
| `extension.project.id` | string | Project ID | `"10000"` |
| `extension.project.key` | string | Project key | `"PROJ"` |
| `extension.project.type` | string | Project type | `"software"` |
| `extension.board.id` | string | Board ID (Jira Software only) | `"1"` |
| `extension.board.type` | string | `"simple"`, `"scrum"`, or `"kanban"` | `"scrum"` |
| `extension.location` | string | Full URL of the host page | `"https://site.atlassian.net/..."` |

---

### `jira:projectSettingsPage`

Renders in project settings.

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `extension.type` | string | Module type | `"jira:projectSettingsPage"` |
| `extension.project.id` | string | Project ID | `"10000"` |
| `extension.project.key` | string | Project key | `"PROJ"` |
| `extension.project.type` | string | Project type | `"software"` |

---

### `jira:globalPage`

Full-page module, not scoped to any project or issue.

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `extension.type` | string | Module type | `"jira:globalPage"` |

No additional context. This is a standalone page.

---

### `jira:adminPage`

Renders in Jira admin settings under Apps.

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `extension.type` | string | Module type | `"jira:adminPage"` |

No additional context. Admin-level, not scoped to project or issue.

---

### `jira:dashboardGadget`

Renders as a gadget on a Jira dashboard.

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `extension.type` | string | Module type | `"jira:dashboardGadget"` |
| `extension.gadgetConfiguration` | object | Saved gadget config (from edit view submit) | `{ jql: "project = PROJ" }` |
| `extension.dashboard.id` | string | Dashboard ID | `"10100"` |
| `extension.gadget.id` | string | Gadget instance ID | `"10200"` |
| `extension.entryPoint` | string | `"edit"` for edit mode, absent for view mode | `"edit"` |
| `extension.location` | string | Full URL of the dashboard | `"https://site.atlassian.net/..."` |

---

### `jira:customField`

Renders as a custom field on issues.

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `extension.type` | string | Module type | `"jira:customField"` |
| `extension.fieldId` | string | Custom field ID | `"customfield_10001"` |
| `extension.fieldValue` | any | Current field value (type depends on field config) | `42`, `"text"`, `{...}` |
| `extension.renderContext` | string | Where the field is being rendered | `"issue-view"`, `"issue-create"`, `"issue-transition"` |
| `extension.issue.key` | string | Issue key (when on an issue) | `"PROJ-42"` |
| `extension.issue.id` | string | Issue ID | `"10001"` |
| `extension.issue.type` | string | Issue type name | `"Story"` |
| `extension.issue.typeId` | string | Issue type ID | `"10001"` |
| `extension.project.id` | string | Project ID | `"10000"` |
| `extension.project.key` | string | Project key | `"PROJ"` |
| `extension.project.type` | string | Project type | `"software"` |
| `extension.entryPoint` | string | `"edit"` for edit view | `"edit"` |

---

### `jira:customFieldType`

Same context as `jira:customField`. Used when defining reusable field types.

---

### JSM Modules

#### `jira:serviceManagement:queuePage`

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `extension.type` | string | Module type | `"jira:serviceManagement:queuePage"` |
| `extension.project.id` | string | Project ID | `"10000"` |
| `extension.project.key` | string | Project key | `"SRVDESK"` |
| `extension.project.type` | string | Project type | `"service_desk"` |

#### `jira:serviceManagement:portalRequestDetail`

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `extension.type` | string | Module type | `"jira:serviceManagement:portalRequestDetail"` |
| `extension.portal.id` | string | Portal ID | `"1"` |
| `extension.portal.key` | string | Portal key | `"SRVDESK"` |
| `extension.request.id` | string | Request/issue ID | `"10001"` |
| `extension.request.key` | string | Request/issue key | `"SRVDESK-42"` |

#### `jira:serviceManagement:portalRequestCreate`

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `extension.type` | string | Module type | `"jira:serviceManagement:portalRequestCreate"` |
| `extension.portal.id` | string | Portal ID | `"1"` |
| `extension.portal.key` | string | Portal key | `"SRVDESK"` |
| `extension.requestType.id` | string | Request type ID | `"10"` |

#### `jira:serviceManagement:assetsObjectViewPanel`

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `extension.type` | string | Module type | `"jira:serviceManagement:assetsObjectViewPanel"` |
| `extension.objectId` | string | Assets object ID | `"12345"` |
| `extension.objectTypeId` | string | Object type ID | `"100"` |
| `extension.workspaceId` | string | Assets workspace ID | `"ws-1"` |

---

## Confluence Modules

### `confluence:contentBylineItem`

Renders in the content byline (under the title).

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `extension.type` | string | Module type | `"confluence:contentBylineItem"` |
| `extension.content.id` | string | Content ID | `"12345"` |
| `extension.content.type` | string | Content type | `"page"`, `"blogpost"` |
| `extension.space.id` | string | Space ID | `"65537"` |
| `extension.space.key` | string | Space key | `"MYSPACE"` |

---

### `confluence:contentAction`

Action button on Confluence content.

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `extension.type` | string | Module type | `"confluence:contentAction"` |
| `extension.content.id` | string | Content ID | `"12345"` |
| `extension.content.type` | string | Content type | `"page"` |
| `extension.space.id` | string | Space ID | `"65537"` |
| `extension.space.key` | string | Space key | `"MYSPACE"` |

---

### `confluence:contextMenu`

Context menu item on Confluence content.

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `extension.type` | string | Module type | `"confluence:contextMenu"` |
| `extension.content.id` | string | Content ID | `"12345"` |
| `extension.content.type` | string | Content type | `"page"` |
| `extension.space.id` | string | Space ID | `"65537"` |
| `extension.space.key` | string | Space key | `"MYSPACE"` |

---

### `macro` (Confluence Macro)

Renders inline in Confluence content.

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `extension.type` | string | Module type | `"macro"` |
| `extension.config` | object | Macro configuration set by the user | `{ color: "blue", count: 5 }` |
| `extension.content.id` | string | Content ID of the page containing the macro | `"12345"` |
| `extension.content.type` | string | Content type | `"page"` |
| `extension.space.id` | string | Space ID | `"65537"` |
| `extension.space.key` | string | Space key | `"MYSPACE"` |

**Note:** Macro config comes from the `config` property defined in `manifest.yml`. Users set these values when inserting or editing the macro.

#### Custom config (`config: { resource: '...' }`)

When a macro declares a `config.resource`, forge-sim parses it as a separate sub-module
and renders the macro page with **View / Config tabs**:

```yaml
modules:
  macro:
    - key: pet-info
      title: Pet Info
      resource: main
      render: native
      config:
        resource: config-bundle
        render: native
```

- The **View** tab renders `resource: main` exactly like a normal macro.
- The **Config** tab renders `resource: config-bundle` — typically a `<Form>` with named
  fields (`<Textfield name="age" />`, etc.).
- Submitting the config form (`view.submit()` or pressing the Save button) stores the
  payload as the macro's saved config, scoped to the macro's base key.
- `useConfig()` from `@forge/react` reads `extension.config` from the context. After a
  save, the View tab reloads so the hook returns the new values.

The picker groups these as a single row under the macro's base key. URLs:

- `/module/<key>/` — combined View + Config page
- `/module/<key>--view/` — view iframe (used internally by the combined page)
- `/module/<key>--config/` — config iframe (used internally by the combined page)

#### Inline config (`config: true` or `config: {}`)

When a macro uses simple/inline config — registered at runtime via
`ForgeReconciler.addConfig(<Config />)` from the same bundle as the main view —
the Forge reconciler emits a **second** ForgeDoc tree (with `type: 'MacroConfig'`)
alongside the main view tree. forge-sim captures both, and the renderer shell
shows **in-iframe View / Config tabs** so you can switch between the two trees
without reloading the bundle:

```jsx
// src/frontend/index.jsx
import ForgeReconciler, { Label, Text, Textfield, useConfig } from '@forge/react';

const Config = () => (
  <>
    <Label>Pet age</Label>
    <Textfield name="age" />
  </>
);

const App = () => {
  const config = useConfig();
  return <Text>{config?.age ?? 'Not configured'}</Text>;
};

ForgeReconciler.render(<App />);
ForgeReconciler.addConfig(<Config />);
```

```yaml
# manifest.yml
modules:
  macro:
    - key: pet-info
      title: Pet Info
      resource: main
      render: native
      config: true   # or `config: {}` — inline form via addConfig()
```

- **View tab** shows the `App` tree.
- **Config tab** shows the `Config` tree. Submitting it (`view.submit(payload)` or
  the form's own submit handler) stores the payload and the View tab re-pulls so
  `useConfig()` returns the new values.
- The bridge tags inline-config submits with `submitTree: 'macroConfig'` so the
  dev-server can route them to the inline macro config store (rather than treating
  them as a generic viewSubmit).
- The picker shows the macro as a flat row with an "inline macro config" hint;
  no separate URLs for the trees — they live together at `/module/<key>/`.

---

### `confluence:spacePage`

Renders as a page in Confluence space navigation.

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `extension.type` | string | Module type | `"confluence:spacePage"` |
| `extension.space.id` | string | Space ID | `"65537"` |
| `extension.space.key` | string | Space key | `"MYSPACE"` |
| `extension.location` | string | Full URL of the page | `"https://site.atlassian.net/..."` |

---

### `confluence:globalPage`

Full-page module, not scoped to space or content.

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `extension.type` | string | Module type | `"confluence:globalPage"` |

No additional context.

---

### `confluence:globalSettings`

Renders in Confluence admin settings.

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `extension.type` | string | Module type | `"confluence:globalSettings"` |

No additional context. Admin-level.

---

### `confluence:homepageFeed`

Renders in the Confluence homepage feed.

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `extension.type` | string | Module type | `"confluence:homepageFeed"` |

Limited context. Not scoped to specific content.

---

## Bitbucket Modules

### `bitbucket:repoPage`

Renders as a page in a Bitbucket repository.

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `extension.type` | string | Module type | `"bitbucket:repoPage"` |
| `extension.repository.uuid` | string | Repository UUID | `"{abc-123}"` |
| `extension.repository.fullName` | string | Full repo name | `"workspace/repo-name"` |
| `extension.workspace.uuid` | string | Workspace UUID | `"{def-456}"` |
| `extension.workspace.slug` | string | Workspace slug | `"myworkspace"` |

---

### `bitbucket:pipelineStep`

Renders in Bitbucket Pipelines.

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `extension.type` | string | Module type | `"bitbucket:pipelineStep"` |
| `extension.repository.uuid` | string | Repository UUID | `"{abc-123}"` |
| `extension.repository.fullName` | string | Full repo name | `"workspace/repo-name"` |
| `extension.pipeline.uuid` | string | Pipeline UUID | `"{ghi-789}"` |
| `extension.step.uuid` | string | Step UUID | `"{jkl-012}"` |

---

## Compass Modules

### `compass:componentPage`

Renders on a Compass component page.

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `extension.type` | string | Module type | `"compass:componentPage"` |
| `extension.component.id` | string | Component ARI | `"ari:cloud:compass:..."` |

---

### `compass:adminPage`

Renders in Compass admin settings.

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `extension.type` | string | Module type | `"compass:adminPage"` |

No additional context.

---

## Rovo Modules

### `rovo:agent`

Not a UI module — defines an AI agent. No `useProductContext()` applies.

Context is passed through action invocations, not the extension object.

---

## Context Groups Summary

For quick reference, here's which modules share context shapes:

| Context Group | Modules | Key Fields |
|---------------|---------|------------|
| **Jira Issue** | `issuePanel`, `issueContext`, `issueGlance`, `issueActivity`, `issueAction` | `issue.key`, `issue.id`, `project.key` |
| **Jira Project** | `projectPage`, `projectSettingsPage` | `project.key`, `project.id`, `board.id` |
| **Jira Dashboard** | `dashboardGadget` | `dashboard.id`, `gadget.id`, `gadgetConfiguration` |
| **Jira Custom Field** | `customField`, `customFieldType` | `fieldId`, `fieldValue`, `renderContext`, + issue fields |
| **Jira Global** | `globalPage`, `adminPage` | (none) |
| **JSM Project** | `queuePage` | `project.key` |
| **JSM Portal** | `portalRequestDetail`, `portalRequestCreate` | `portal.id`, `request.key` |
| **Confluence Content** | `contentBylineItem`, `contentAction`, `contextMenu`, `macro` | `content.id`, `content.type`, `space.key` |
| **Confluence Space** | `spacePage` | `space.key`, `space.id` |
| **Confluence Global** | `globalPage`, `globalSettings`, `homepageFeed` | (none) |
| **Bitbucket Repo** | `repoPage`, `pipelineStep` | `repository.uuid`, `workspace.slug` |
| **Compass** | `componentPage` | `component.id` |
