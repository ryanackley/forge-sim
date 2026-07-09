# Module Contexts

What `useProductContext()` / `view.getContext()` return when your module runs in forge-sim.

You can either fully mock contexts, let forge-sim inject fake data, or pull data from a connected Atlassian site. 


---

## Fully Mocked Contexts

For tests you usually want to control the entire context yourself. Combine the two override options: `context` for the canonical top-level fields, `extension` for the module-specific data.

```ts
await sim.ui.render('my-panel', {
  // Canonical fields → promoted to the top level of the context
  context: {
    accountId: 'alice-001',
    cloudId: 'test-cloud',
    siteUrl: 'https://test.atlassian.net',
    locale: 'fr-FR',
    timezone: 'Europe/Paris',
    license: { active: true, type: 'PAID' },
  },
  // Extension → used exactly as given. Skips ALL hydration.
  extension: {
    issue: { key: 'PROJ-42', id: '10042', type: 'Bug' },
    project: { key: 'PROJ', id: '10000' },
    issueKey: 'PROJ-42',
    projectKey: 'PROJ',
  },
});
```

- Passing `extension` **replaces** the extension object: it's merged over `{ type: '<moduleType>' }` and used verbatim. Hydration is never attempted.
- `context` **merges**: canonical fields (see [the whitelist below](#how-context-is-built)) override the sim defaults and any sticky resolver context; loose fields fill extension gaps under your explicit `extension` keys.
- The two are deliberately separate options with different semantics: nesting `extension` inside `context` is **rejected** on every surface (compile error in TypeScript, `TypeError` at runtime).
- The only field you can't override is `moduleKey`; it always comes from the render call.
- Both options work the same on the test library (`sim.ui.render`, `sim.invoke(fn, payload, { context, extension })`) and MCP (`forge.ui_render`, `forge.invoke`). The CLI has `--context` but no `--extension` flag yet, so pass loose fields through `--context` there (they merge into `extension`, they just don't suppress shorthand-key hydration).

---

## Hydrated Contexts (the shorthand keys)

The other main approach: pass a key and let forge-sim build the context around it. With a [connected account](../local-development/credentials.md) the data is fetched live from your Atlassian site; without one, registered mock routes answer, and failing that the context is built offline from the key itself, no auth or network required.

```ts
await sim.ui.render('issue-panel', { issueKey: 'PROJ-42' });
await sim.ui.render('project-page', { projectKey: 'PROJ' });
await sim.ui.render('byline-item', { contentId: '12345', spaceKey: 'ENG' });
await sim.ui.render('space-page', { spaceKey: 'ENG' });
```

The complete set of options, with the same names in the test library, MCP `forge.ui_render`, and (where noted) `forge-sim dev` flags:

- **`issueKey`** — hydrates `extension.issue` and `extension.project`, plus flat `issueKey` / `issueId` / `projectKey` / `projectId`. Live fetch: `GET /rest/api/3/issue/<key>`. Offline: the key as-is, project key from the prefix. CLI: `--issue`.
- **`projectKey`** — hydrates `extension.project` plus flat `projectKey` / `projectId`. Live fetch: `GET /rest/api/3/project/<key>`. CLI: `--project`.
- **`contentId`** — hydrates `extension.content` and `extension.space`, plus flat `contentId` / `spaceKey`. Live fetch: `GET /rest/api/content/<id>?expand=space`. CLI: `--content`.
- **`spaceKey`** — a hint alongside `contentId` (seeds the space when offline), or standalone for space modules. Never fetched on its own. CLI: `--space`.
- **`context`** — raw context object. Canonical fields promoted to the top level, everything else merged into `extension`. `context: { issueKey }` on a Jira issue module behaves like the `issueKey` shortcut. A literal `extension` key inside `context` is rejected; use the top-level `extension` option. CLI: `--context '<JSON>'`.
- **`extension`** — full extension override; skips hydration entirely (the [fully mocked](#fully-mocked-contexts) path). Test library and MCP; no CLI flag yet, so pass loose fields via `--context` there.
- **`macroConfig`** — one-shot saved-config injection for `macro` modules, surfaced via `useConfig()`. Doesn't persist across renders; use `sim.ui.setMacroConfig(key, config)` for sticky values. Test library and MCP only.

Only one hydration shortcut applies per render (`issueKey` wins over `contentId`, which wins over `projectKey`), and `extension` beats them all. The shortcuts aren't gated by module type: `issueKey` on a non-issue module still hydrates issue fields into its extension.

---

## How Context Is Built in forge-sim

`sim.ui.render(moduleKey, options)`, `forge.ui_render` (MCP), and the [`forge-sim dev` flags](#cli-hydration-flags) resolve these options in the same order (surface availability per option is noted [above](#hydrated-contexts-the-shorthand-keys)). For the `extension` object, first match wins:

1. **`extension` override** — used as-is (merged over `{ type }`). No hydration. A `context` option passed alongside still applies: canonical fields are promoted to the top level, and loose context fields fill extension gaps under your explicit `extension` keys.
2. **`issueKey` / `contentId` / `projectKey`** — hydrated via the product API (see the groups below). Mock-first, offline-safe: mock routes answer if registered, a connected account is used if present, and otherwise the context is built from the key itself with no network call.
3. **`context`** — a raw object. Canonical top-level fields (`accountId`, `cloudId`, `siteUrl`, `environmentId`, `environmentType`, `localId`, `locale`, `timezone`, `license`, `theme`, `surfaceColor`, `userAccess`, `permissions`) are promoted to the top level of the context; everything else is merged into `extension`. A literal `extension` key here throws a `TypeError`; extension data goes through the top-level `extension` option. One smart mapping: `context: { issueKey: 'PROJ-1' }` on a Jira issue module behaves like the `issueKey` shortcut and hydrates.
4. **Module-type defaults** — project and space modules get canned defaults; custom fields get a mock field value; macros get an empty config; everything else gets bare `{ type }`.

Two more layers on the top-level fields:

- **Connected account** — with [credentials configured](../local-development/credentials.md), `accountId`, `cloudId`, and `siteUrl` come from your real account instead of the sim defaults, and the hydration shortcuts fetch live data from your site.
- **Sticky resolver context** — canonical fields set via `sim.resolver.setContext({ accountId: 'alice' })` apply to rendered contexts too, so the UI's `useProductContext()` and the resolvers it invokes see the same user. An explicit `context` option still wins over sticky values.

```ts
// All equivalent surfaces:
await sim.ui.render('my-panel', { issueKey: 'PROJ-42' });          // test library
// forge.ui_render { moduleKey: "my-panel", issueKey: "PROJ-42" }  // MCP
// forge-sim dev --module my-panel --issue PROJ-42                 // dev server
```

---

## Common Context (All Modules)

Every module receives these top-level fields:


| Field             | Default                            | Notes                                                                                            |
| ----------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| `accountId`       | `"sim-user-001"`                   | Connected account's real account ID when[auth is set up](../local-development/credentials.md).   |
| `cloudId`         | `"sim-cloud-001"`                  | Connected account's real cloud ID when auth is set up.                                           |
| `siteUrl`         | `"https://sim-site.atlassian.net"` | `https://<your-site>` when auth is set up.                                                       |
| `moduleKey`       | —                                 | The module key being rendered. Always set from the render call; can't be overridden via context. |
| `environmentId`   | `"sim-env"`                        |                                                                                                  |
| `environmentType` | `"DEVELOPMENT"`                    | Always`DEVELOPMENT` unless overridden.                                                           |
| `localId`         | `"forge-sim-<timestamp>"`          | Unique per render. Real Forge uses an ARI here; forge-sim uses a plain unique string.            |
| `locale`          | `"en-US"`                          |                                                                                                  |
| `timezone`        | host machine's timezone            |                                                                                                  |
| `extension`       | `{ type: "<moduleType>" }`         | Module-specific data — see below.                                                               |

`license`, `theme`, `surfaceColor`, `userAccess`, and `permissions` are **not set by default**. They're recognized as canonical fields, so if you pass them via a context override they land at the top level (not inside `extension`), but a module that reads `context.license` without supplying one gets `undefined`, same as an unlicensed dev app on the real platform.

---

## Hydrated Module Groups

### Jira issue modules

**Applies to:** `jira:issuePanel`, `jira:issueContext`, `jira:issueGlance`, `jira:issueActivity`, `jira:issueAction`

Pass `issueKey` (or `context: { issueKey }`) to hydrate. With a connected account the issue is fetched live (`GET /rest/api/3/issue/<key>`); without one, the key is used as-is and the project key is extracted from the issue key prefix (`PROJ-1` → `PROJ`).


| Field                    | Live API            | Offline fallback           |
| ------------------------ | ------------------- | -------------------------- |
| `extension.issue.key`    | ✅                  | ✅ (the key you passed)    |
| `extension.issue.id`     | ✅                  | —                         |
| `extension.issue.type`   | ✅ issue type name  | —                         |
| `extension.issue.typeId` | ✅                  | —                         |
| `extension.project.key`  | ✅                  | ✅ (extracted from prefix) |
| `extension.project.id`   | ✅                  | —                         |
| `extension.project.type` | ✅ project type key | —                         |

Convenience flat fields are set alongside the nested objects; many apps read these directly: `extension.issueKey`, `extension.issueId`, `extension.projectKey`, `extension.projectId` (the last two only when available).

Without `issueKey`, issue modules get bare `{ type }`; there is no auto-default issue.

### Jira project modules

**Applies to:** `jira:projectPage`, `jira:projectSettingsPage`

Pass `projectKey` to hydrate (`GET /rest/api/3/project/<key>` when connected; key-only fallback otherwise). Sets `extension.project.{ id, key, type }` plus flats `extension.projectKey` / `extension.projectId`.

With no options at all, project modules auto-default to:

```
extension.project = { key: 'SIM', id: '10001', type: 'software' }
extension.projectKey = 'SIM'
extension.projectId = '10001'
```

### Confluence content modules

**Applies to:** `confluence:contentAction`, `confluence:contentBylineItem`, `confluence:contextMenu`, `macro`

Pass `contentId` (optionally with `spaceKey` as a hint) to hydrate (`GET /rest/api/content/<id>?expand=space` when connected). Sets `extension.content.{ id, type }` and `extension.space.{ key, id }`, plus flats `extension.contentId` / `extension.spaceKey`. In the offline fallback, `content.type` and `space.id` are omitted, and `space` is only set if you passed `spaceKey`.

Content modules have **no auto-default**: without `contentId` they get bare `{ type }` (macros additionally get `config`, see [Macros](#macros)).

### Confluence space modules

**Applies to:** `confluence:spacePage`, `confluence:spaceSettings`, `confluence:spaceSidebar`

With no options, these auto-default to:

```
extension.space = { key: 'SIM', id: '65536' }
extension.spaceKey = 'SIM'
```

Passing `spaceKey` substitutes your key (no API fetch for space-only hydration).

### Everything else

`jira:globalPage`, `jira:adminPage`, `confluence:globalPage`, `confluence:globalSettings`, `confluence:homepageFeed`, dashboard gadgets, JSM modules, Bitbucket modules, Compass modules, commands, Rovo actions: all get the common context plus bare `extension: { type }`.

That's correct for the global/admin pages (the real platform sends no extra context there either). For the rest, the real platform sends richer shapes (`gadgetConfiguration`, `portal.id`, `repository.uuid`, …) that forge-sim doesn't fabricate; check the [Atlassian module reference](https://developer.atlassian.com/platform/forge/manifest-reference/modules/) for the shape your module expects, then inject it:

```ts
await sim.ui.render('my-gadget', {
  extension: {
    gadgetConfiguration: { jql: 'project = PROJ' },
    dashboard: { id: '10100' },
    gadget: { id: '10200' },
  },
});
```

---

## Custom Fields

**Applies to:** `jira:customField`, `jira:customFieldType`

When no context options are given, forge-sim provides a mock `extension.fieldValue` based on the field's data type (from the manifest), plus `extension.fieldType`:


| Field type | Mock value                                               |
| ---------- | -------------------------------------------------------- |
| `number`   | `42`                                                     |
| `string`   | `"Sample value"`                                         |
| `user`     | `{ accountId: 'sim-user-001', displayName: 'Sim User' }` |
| `group`    | `{ groupId: 'sim-group-001', name: 'Sim Group' }`        |
| `date`     | today,`YYYY-MM-DD`                                       |
| `datetime` | now, ISO 8601                                            |
| `object`   | `{ key: 'value' }`                                       |
| (other)    | `"Sample value"`                                         |

To test with a specific value, pass it explicitly: `sim.ui.render(key, { context: { fieldValue: 87 } })`.

**Sub-module keys.** Custom fields split on parse into `--view` and `--edit` sub-modules so the two render targets are addressable independently:

- `priority-score--view` — the cell renderer (read-only)
- `priority-score--edit` — the inline editor (with submit handler)

Both render with the same field context; the `--edit` sub-module's `view.submit(payload)` is captured by `sim.ui.onSubmit()` in tests rather than dispatched to the host product (see [testing § Custom field subviews](../testing/README.md#custom-field-subviews)).

---

## Macros

Macros are Confluence content modules (hydration above), plus config handling: when no config has been saved, `extension.config` defaults to `{}` so `useConfig()` resolves instead of hanging.

Config can be seeded three ways:

- `sim.ui.render(key, { macroConfig: {...} })` / `forge.ui_render` with `macroConfig` — one-shot, doesn't persist
- `sim.ui.setMacroConfig(key, {...})` — sticky across renders
- Submitting the config form in dev mode or via `renderInlineConfig().save(values)`: the saved values persist and are returned on subsequent renders

### Custom config (`config: { resource: '...' }`)

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
- The **Config** tab renders `resource: config-bundle`, typically a `<Form>` with named
  fields (`<Textfield name="age" />`, etc.).
- Submitting the config form (`view.submit()` or pressing the Save button) stores the
  payload as the macro's saved config, scoped to the macro's base key.
- `useConfig()` from `@forge/react` reads `extension.config` from the context. After a
  save, the View tab reloads so the hook returns the new values.

The picker groups these as a single row under the macro's base key. URLs:

- `/module/<key>/` — combined View + Config page
- `/module/<key>--view/` — view iframe (used internally by the combined page)
- `/module/<key>--config/` — config iframe (used internally by the combined page)

### Inline config (`config: true` or `config: {}`)

When a macro uses simple/inline config (registered at runtime via
`ForgeReconciler.addConfig(<Config />)` from the same bundle as the main view),
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
      config: true   # or `config: {}`, inline form via addConfig()
```

- **View tab** shows the `App` tree.
- **Config tab** shows the `Config` tree. Submitting it (`view.submit(payload)` or
  the form's own submit handler) stores the payload and the View tab re-pulls so
  `useConfig()` returns the new values.
- The bridge tags inline-config submits with `submitTree: 'macroConfig'` so the
  dev-server can route them to the inline macro config store (rather than treating
  them as a generic viewSubmit).
- The picker shows the macro as a flat row with an "inline macro config" hint;
  no separate URLs for the trees; they live together at `/module/<key>/`.

---

## Workflow Modules

`jira:workflowCondition`, `jira:workflowValidator`, `jira:workflowPostFunction`: each has up to three UI sub-modules for the create/edit/view phases of the workflow rule wizard. forge-sim splits these on parse, so a manifest module with key `my-condition` becomes:

- `my-condition--create` — the configuration form shown when the rule is first added
- `my-condition--edit` — the configuration form shown when the rule is edited later
- `my-condition--view` — the read-only summary shown on the workflow diagram

Each sub-module renders independently with its own ForgeDoc tree, using the common context plus `extension.type` set to the parent module type. The real platform additionally provides workflow/transition metadata and (in edit/view) previously saved config. forge-sim doesn't fabricate those; inject them via `extension` or `context` overrides if your component reads them.

The function side (the `function` declared on the same module) receives the saved config and the workflow event payload at invocation time; see [the Forge docs on workflow rules](https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-workflow-condition/) for the full event shape.

---

## Non-UI Modules (no `useProductContext()`)

Some modules don't render UI in the conventional sense. They appear in the manifest and forge-sim parses them, but they receive event payloads rather than `useProductContext()`:


| Module Type                                                                                                                                           | What it gets instead                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Background scripts (`jira:issueViewBackgroundScript`, `jira:dashboardBackgroundScript`, `jira:globalBackgroundScript`, `confluence:backgroundScript`) | Run inside a hidden iframe in the host page; broker`postMessage` to/from the experience. No `useProductContext()`; the host page provides whatever payload the script subscribes to. |
| Web triggers (`webtrigger`)                                                                                                                           | Receive an HTTP request object via the function signature`(request) => { statusCode, body? }`. See [api.md § Web Triggers](./api.md).                                               |
| Event triggers / consumers                                                                                                                            | Receive the platform event payload (issue created, page updated, queue message, …). See[the trigger event templates registry](./api.md).                                            |
| Scheduled triggers                                                                                                                                    | Receive`{ context }` and must return `{ statusCode }`.                                                                                                                               |
| Rovo actions (`action`)                                                                                                                               | Invoked as a function call with input validated against the manifest`inputSchema`; `sim.invoke(fn, payload, { actionKey })` throws on invalid payloads before dispatching.         |

---

## CLI Hydration Flags

`forge-sim dev` builds the initial render context for a module from these flags. Pass any subset; missing pieces default to canned sim values (`sim-user-001`, `https://sim-site.atlassian.net`, etc.).


| Flag                 | Hydrates                                                                                                                                                             | Notes                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `--issue <KEY>`      | Jira issue context (issue.key, issue.id, issue.type, project.key, project.id, …)                                                                                    | Fetches the live issue if a real API account is connected; falls back to extracting the project key from the issue key (`PROJ-1` → `PROJ`). |
| `--project <KEY>`    | Jira project context (project.key, project.id, project.type)                                                                                                         | Fetches the live project when possible.                                                                                                      |
| `--content <ID>`     | Confluence content context (content.id, content.type, space.key, space.id)                                                                                           | Combine with`--space` to seed the space when no real API is available.                                                                       |
| `--space <KEY>`      | Confluence space context (space.key, space.id)                                                                                                                       | Standalone, or as a hint for`--content`.                                                                                                     |
| `--context '<JSON>'` | Arbitrary raw context — canonical fields (`accountId`, `cloudId`, `locale`, `permissions`, …) are promoted to the top level; everything else lands in `extension`. | The same shape`sim.invoke(fn, payload, { context })` and `sim.ui.render(key, { context })` accept.                                           |

```bash
# Render a Jira issue panel as if viewing PROJ-42
forge-sim dev --module my-panel --issue PROJ-42

# Same panel but with a custom user
forge-sim dev --module my-panel --issue PROJ-42 \
  --context '{"accountId":"alice-001","locale":"fr-FR"}'

# A Confluence content byline with explicit space override
forge-sim dev --module byline --content 12345 --space ENG
```

The MCP equivalent is `forge.ui_render`: same fields, same precedence. The MCP tool additionally accepts `extension` (full extension override, [fully mocked](#fully-mocked-contexts) path) and `macroConfig` for one-shot config injection on `macro` modules. The in-process `sim.ui.render(moduleKey, { extension, macroConfig })` shares that contract.
