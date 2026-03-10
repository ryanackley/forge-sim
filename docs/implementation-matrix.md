# Forge Platform Implementation Matrix

Complete mapping of every Forge API, hook, component, and platform feature against forge-sim's implementation status.

**Last updated:** 2026-03-10  
**forge-sim test count:** 531 tests across 32 files

### Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Fully implemented and tested |
| ⚠️ | Partially implemented or stubbed |
| ❌ | Not implemented (will error or return undefined) |
| 🔇 | Stubbed no-op (won't crash, but doesn't do anything) |

---

## @forge/api

The main backend API package. Imported by resolver/trigger/consumer functions.

### Fetch & Product APIs

| API | Status | Tests | Notes |
|-----|--------|-------|-------|
| `requestJira(route, options)` | ✅ | `shims.test.ts`, `simulator.test.ts`, `my-issues-e2e.test.ts` | Supports mock + real API proxy |
| `requestConfluence(route, options)` | ✅ | `shims.test.ts` | Same as Jira |
| `requestBitbucket(route, options)` | ✅ | — | Same as Jira (no dedicated test) |
| `asApp().requestJira()` | ✅ | `shims.test.ts` | |
| `asUser().requestJira()` | ✅ | `shims.test.ts` | |
| `asUser(accountId).requestJira()` | ⚠️ | — | `accountId` param is ignored — no user impersonation |
| `asApp().requestConfluence()` | ✅ | `shims.test.ts` | |
| `asApp().requestBitbucket()` | ✅ | — | |
| `asApp().requestGraph()` | ❌ | — | GraphQL API not implemented |
| `asUser().requestGraph()` | ❌ | — | GraphQL API not implemented |
| `asApp().requestConnectedData()` | ❌ | — | Connected Data API not implemented |
| `asUser().requestConnectedData()` | ❌ | — | Connected Data API not implemented |
| `asApp().requestAtlassian()` | ❌ | — | Generic Atlassian API not implemented |
| `asUser().requestAtlassian()` | ❌ | — | Generic Atlassian API not implemented |
| `asUser().requestTeamworkGraph()` | ❌ | — | Teamwork Graph API not implemented |
| `asUser().withProvider()` (External Auth) | ❌ | — | External auth / third-party OAuth not implemented |
| `fetch(url, options)` | ✅ | — | Passes through to real `globalThis.fetch` with warning log |
| `route\`...\`` | ✅ | `shims.test.ts` | Template tag with encoding |
| `routeFromAbsolute()` | 🔇 | — | Exported but untested |
| `assumeTrustedRoute()` | 🔇 | — | Exported but untested |

### Storage (Legacy — deprecated)

| API | Status | Tests | Notes |
|-----|--------|-------|-------|
| `storage.get(key)` | ✅ | `shims.test.ts`, `storage.test.ts` | Routes to sim.kvs |
| `storage.set(key, value)` | ✅ | `shims.test.ts`, `storage.test.ts` | Routes to sim.kvs |
| `storage.delete(key)` | ✅ | `storage.test.ts` | Routes to sim.kvs |
| `storage.getSecret(key)` | ✅ | `storage.test.ts` | |
| `storage.setSecret(key, value)` | ✅ | `storage.test.ts` | |
| `storage.deleteSecret(key)` | ✅ | `storage.test.ts` | |
| `storage.query()` | ⚠️ | — | Basic query works via KVS shim, but entity-style `storage.entity()` from legacy API may not |
| `storage.entity()` | ⚠️ | — | Routes to entity store if available |
| `storage.transact()` | ⚠️ | — | May not fully match legacy API signature |

### Other APIs

| API | Status | Tests | Notes |
|-----|--------|-------|-------|
| `authorize(provider)` | 🔇 | — | No-op, always resolves |
| `invokeRemote(key, payload)` | 🔇 | — | Returns `null` — Forge Remotes not simulated |
| `invokeService(key, payload)` | 🔇 | — | Returns `null` |
| `webTrigger.getUrl(key)` | ⚠️ | — | Returns fake URL, not a real endpoint |
| `getAppContext()` | ⚠️ | — | Returns hardcoded values (`sim-app`, `sim-env`, etc.) |
| `__getRuntime()` | 🔇 | — | Returns `{ isEcosystemApp: false }` |
| `bindInvocationContext(fn)` | 🔇 | — | Returns the function unchanged |
| `privacy.check()` | 🔇 | — | Always returns `{ hasAccess: true }` |
| `privacy.reportPersonalData()` | ❌ | — | Not implemented |
| `permissions.check()` | 🔇 | — | Always returns `{ hasAccess: true }` |
| `i18n.getMessage(key)` | ⚠️ | — | Backend i18n — returns the key as-is (no translation). See @forge/bridge i18n for frontend |
| `createRequestStargateAsApp()` | 🔇 | — | Returns same API client |
| `__fetchProduct()` | ✅ | `forge-sql.test.ts` | Handles SQL fetch function and product API calls |

### Error Classes

| Export | Status | Notes |
|--------|--------|-------|
| `FetchError` | ✅ | |
| `HttpError` | ✅ | |
| `NotAllowedError` | ✅ | |
| `ExternalEndpointNotAllowedError` | ✅ | |
| `ProductEndpointNotAllowedError` | ✅ | |
| `RequestProductNotAllowedError` | ✅ | |
| `NeedsAuthenticationError` | ✅ | |
| `InvalidWorkspaceRequestedError` | ✅ | |
| `ProxyRequestError` | ✅ | |
| `FUNCTION_ERR` | ✅ | |
| `isExpectedError()` | ✅ | |
| `isForgePlatformError()` | ✅ | |
| `isHostedCodeError()` | ✅ | |

### Re-exports from @forge/storage

| Export | Status | Notes |
|--------|--------|-------|
| `WhereConditions` | ✅ | |
| `FilterConditions` | ✅ | |
| `SortOrder` | ✅ | |
| `startsWith` | ✅ | |

---

## @forge/kvs

The primary key-value storage package.

| API | Status | Tests | Notes |
|-----|--------|-------|-------|
| `kvs.get(key)` | ✅ | `kvs.test.ts`, `shims.test.ts` | |
| `kvs.set(key, value)` | ✅ | `kvs.test.ts`, `shims.test.ts` | |
| `kvs.delete(key)` | ✅ | `kvs.test.ts` | |
| `kvs.getMany(keys)` | ✅ | `kvs.test.ts` | |
| `kvs.query().where().getMany()` | ✅ | `kvs.test.ts`, `shims.test.ts` | Full query builder |
| `kvs.query().where().cursor().getMany()` | ✅ | `kvs.test.ts` | Cursor-based pagination |
| `kvs.query().where().limit().getMany()` | ✅ | `kvs.test.ts` | |
| `kvs.query().where().sortBy().getMany()` | ✅ | `kvs.test.ts` | |
| `kvs.transact().set().delete().execute()` | ✅ | `kvs.test.ts`, `shims.test.ts` | Atomic batch operations |
| `kvs.getSecret(key)` | ✅ | `shims.test.ts` | Separate secrets store |
| `kvs.setSecret(key, value)` | ✅ | `shims.test.ts` | |
| `kvs.deleteSecret(key)` | ✅ | `shims.test.ts` | |
| Entity Store: `kvs.entity(name).set()` | ✅ | `entity-store.test.ts`, `entity-store-e2e.test.ts` | |
| Entity Store: `kvs.entity(name).get()` | ✅ | `entity-store.test.ts` | |
| Entity Store: `kvs.entity(name).delete()` | ✅ | `entity-store.test.ts` | |
| Entity Store: `kvs.entity(name).query()` | ✅ | `entity-store.test.ts` | Indexed queries, filters, sort, pagination |
| `WhereConditions` | ✅ | `kvs.test.ts` | |
| `FilterConditions` | ✅ | `kvs.test.ts` | |
| `ForgeKvsError` | ✅ | | |
| `ForgeKvsAPIError` | ✅ | | |
| `MetadataField` | ✅ | | |
| `Sort` | ✅ | | |

---

## @forge/sql

Forge SQL — relational data with real MySQL.

| API | Status | Tests | Notes |
|-----|--------|-------|-------|
| `sql.prepare(query).bindParams(...).execute()` | ✅ | `forge-sql.test.ts`, `forge-sql-e2e.test.ts` | Parameterized queries |
| `sql.prepare(query).execute()` | ✅ | `forge-sql.test.ts` | |
| `sql._executeRaw(query)` | ✅ | `forge-sql.test.ts` | |
| `migrationRunner.enqueue(migrations)` | ✅ | `forge-sql-e2e.test.ts`, `okr-tracker-e2e.test.ts` | Real `@forge/sql` migrationRunner works through shims |
| DDL (CREATE TABLE, ALTER, INDEX) | ✅ | `forge-sql-e2e.test.ts` | Real MySQL 8.4 via mysql-memory-server |
| JOINs, aggregation, subqueries | ✅ | `okr-tracker-e2e.test.ts` | AVG, COUNT, SUM, CASE WHEN, etc. |
| Foreign keys, constraints | ✅ | `persistence.test.ts` | |
| `sql`` tagged template` | ❌ | — | Some apps use tagged template syntax instead of prepare/execute |
| Connection pooling / limits | ❌ | — | No simulation of Forge's connection limits |

---

## @forge/events

Async events and queue processing.

| API | Status | Tests | Notes |
|-----|--------|-------|-------|
| `new Queue({ key })` | ✅ | `shims.test.ts`, `queue.test.ts` | |
| `queue.push(events)` | ✅ | `shims.test.ts`, `queue.test.ts`, `retro-board-e2e.test.ts` | Single and batch push |
| `queue.push({ body, delayInSeconds })` | ✅ | `queue.test.ts` | Delayed delivery |
| `queue.push({ body, concurrencyKey })` | ✅ | `concurrency.test.ts` | Controls parallel execution |
| `queue.getJob(jobId)` | ✅ | `queue.test.ts` | |
| `InvocationError` | ✅ | `function-contracts.test.ts` | Thrown by consumers to trigger retry |
| `InvocationErrorCode` | ✅ | | |
| `JobProgress` | ✅ | | |
| `InvalidQueueNameError` | ✅ | `shims.test.ts` | |
| `TooManyEventsError` | ✅ | | |
| `PayloadTooBigError` | ✅ | | |
| `NoEventsToPushError` | ✅ | | |
| `RateLimitError` | ✅ | | |
| `PartialSuccessError` | ✅ | | |
| `InternalServerError` | ✅ | | |
| `JobDoesNotExistError` | ✅ | | |
| `appEvents.onInstalled()` | 🔇 | — | No-op callback |
| `appEvents.onUninstalled()` | 🔇 | — | No-op callback |
| `appEvents.onEnabled()` | 🔇 | — | No-op callback |
| `appEvents.onDisabled()` | 🔇 | — | No-op callback |

---

## @forge/resolver

Resolver function registration.

| API | Status | Tests | Notes |
|-----|--------|-------|-------|
| `new Resolver().define(key, handler)` | ✅ | `shims.test.ts`, `deployer.test.ts` | |
| `resolver.getDefinitions()` | ✅ | `shims.test.ts` | |
| Multi-function resolvers | ✅ | `deploy-e2e.test.ts` | Multiple `define()` calls |

---

## @forge/react

UIKit components and hooks. The reconciler produces ForgeDoc.

### Core

| Export | Status | Tests | Notes |
|--------|--------|-------|-------|
| `ForgeReconciler` (default export) | ✅ | `simulator-ui.test.ts`, `ui-integration.test.ts` | Re-exports real @forge/react reconciler |
| `xcss()` | ✅ | — | Style objects |

### Hooks

| Hook | Status | Tests | Notes |
|------|--------|-------|-------|
| `useProductContext()` | ✅ | — | Re-exported from real package |
| `useConfig()` | ✅ | — | Re-exported from real package |
| `useTheme()` | ✅ | — | Re-exported from real package |
| `usePermissions()` | ✅ | — | Re-exported from real package |
| `useIssueProperty(key, init)` | ✅ | — | Re-exported from real package; routes through bridge shim → PropertyStore |
| `useContentProperty(key, init)` | ✅ | — | Re-exported from real package; routes through bridge shim → PropertyStore |
| `useSpaceProperty(key, init)` | ✅ | — | Re-exported from real package; routes through bridge shim → PropertyStore |
| `useTranslation()` | ✅ | — | Re-exported from real package; reads from I18nProvider context → bridge i18n → I18nStore |
| `I18nProvider` | ✅ | — | Re-exported from real package; calls bridge.i18n.createTranslationFunction() |
| `useForm()` | ✅ | — | Re-exported from real package (wraps react-hook-form) |
| `useObjectStore()` | ❌ | — | File upload/download. Needs Object Store backend (EAP) |
| `replaceUnsupportedDocumentNodes()` | ❌ | — | ADF utility |

### UIKit Components (from ui-kit-components.d.ts)

| Component | Status | Tests | Notes |
|-----------|--------|-------|-------|
| `Badge` | ✅ | `ui-integration.test.ts` | |
| `BarChart` | ✅ | — | |
| `Box` | ✅ | `ui-integration.test.ts` | |
| `Button` | ✅ | `ui-integration.test.ts`, `simulator-ui.test.ts` | |
| `ButtonGroup` | ✅ | — | |
| `Calendar` | ✅ | — | |
| `Checkbox` | ✅ | — | |
| `CheckboxGroup` | ✅ | — | |
| `ChromelessEditor` | ✅ | — | Placeholder in renderer |
| `Code` | ✅ | — | |
| `CodeBlock` | ✅ | — | |
| `CommentEditor` | ✅ | — | Placeholder in renderer |
| `DatePicker` | ✅ | — | |
| `DonutChart` | ✅ | — | |
| `EmptyState` | ✅ | — | |
| `ErrorMessage` | ✅ | — | In renderer mapping, not in shim re-export |
| `FileCard` | ✅ | — | In renderer mapping |
| `FilePicker` | ✅ | — | In renderer mapping |
| `Form` | ✅ | — | |
| `FormFooter` | ✅ | — | In renderer mapping |
| `FormHeader` | ✅ | — | In renderer mapping |
| `FormSection` | ✅ | — | In renderer mapping |
| `Heading` | ✅ | — | |
| `HelperMessage` | ✅ | — | In renderer mapping |
| `HorizontalBarChart` | ✅ | — | |
| `HorizontalStackBarChart` | ✅ | — | |
| `Icon` | ✅ | — | |
| `Inline` | ✅ | — | |
| `Label` | ✅ | — | In renderer mapping |
| `LineChart` | ✅ | — | |
| `LinkButton` | ✅ | — | In renderer mapping |
| `List` | ✅ | — | In renderer mapping |
| `ListItem` | ✅ | — | In renderer mapping |
| `LoadingButton` | ✅ | — | In renderer mapping |
| `Lozenge` | ✅ | — | |
| `Modal` | ✅ | — | |
| `ModalBody` | ✅ | — | |
| `ModalFooter` | ✅ | — | |
| `ModalHeader` | ✅ | — | |
| `ModalTitle` | ✅ | — | |
| `ModalTransition` | ✅ | — | |
| `PieChart` | ✅ | — | |
| `Pressable` | ✅ | — | In renderer mapping |
| `ProgressBar` | ✅ | — | |
| `ProgressTracker` | ✅ | — | In renderer mapping |
| `Radio` | ✅ | — | |
| `RadioGroup` | ✅ | — | |
| `Range` | ✅ | — | |
| `RequiredAsterisk` | ✅ | — | In renderer mapping |
| `SectionMessage` | ✅ | `ui-integration.test.ts` | |
| `SectionMessageAction` | ✅ | — | In renderer mapping |
| `Select` | ✅ | — | |
| `Spinner` | ✅ | — | |
| `Stack` | ✅ | `ui-integration.test.ts` | |
| `StackBarChart` | ✅ | — | |
| `Tab` | ✅ | — | |
| `TabList` | ✅ | — | |
| `TabPanel` | ✅ | — | |
| `Tabs` | ✅ | — | |
| `Tag` | ✅ | — | |
| `TagGroup` | ✅ | — | |
| `Text` | ✅ | `ui-integration.test.ts` | |
| `TextArea` | ✅ | — | |
| `Textfield` / `TextField` | ✅ | — | Both casings exported |
| `Tile` | ✅ | — | In renderer mapping |
| `AtlassianTile` | ✅ | — | In renderer mapping |
| `AtlassianIcon` | ✅ | — | In renderer mapping |
| `TimePicker` | ✅ | — | In renderer mapping |
| `Toggle` | ✅ | — | |
| `Tooltip` | ✅ | — | |
| `ValidMessage` | ✅ | — | In renderer mapping |

### Non-UIKit Components (from components/index.d.ts)

| Component | Status | Tests | Notes |
|-----------|--------|-------|-------|
| `DynamicTable` | ✅ | — | Separate module, re-exported |
| `Image` | ✅ | — | |
| `Link` | ✅ | — | |
| `UserPicker` | ✅ | — | |
| `Table` / `Head` / `Row` / `Cell` | ✅ | — | |
| `InlineEdit` | ✅ | — | Re-exported from @forge/react, rendered via @atlaskit/inline-edit |
| `Popup` | ✅ | — | Re-exported from @forge/react, rendered via @atlaskit/popup |
| `Comment` | ✅ | — | Re-exported + styled comment block with author/time |
| `AdfRenderer` | ✅ | — | Lightweight ADF renderer — handles paragraphs, headings, lists, code blocks, tables, panels, tasks, media, mentions, dates, etc. (not @atlaskit/renderer — that pulls in 100+ broken deps) |
| `Global` | ✅ | — | Re-exported, renders sidebar + main layout |
| `User` | ✅ | — | Re-exported, renders avatar + accountId badge |
| `UserGroup` | ✅ | — | Re-exported, renders grouped user avatars |
| `Em` | ✅ | — | Re-exported, renders `<em>` |
| `Strike` | ✅ | — | Re-exported, renders `<s>` |
| `Strong` | ✅ | — | Re-exported, renders `<strong>` |
| `Frame` | ✅ | — | Re-exported, renders sandboxed `<iframe>` |
| `InlineDialog` | ✅ | — | Already in shim (via Flag/InlineDialog) |
| `Flag` | ✅ | — | Already in shim |

### Types Only (no runtime needed)

| Export | Status | Notes |
|--------|--------|-------|
| `XCSSObject` | ✅ | Type |
| `DocNode` | ✅ | Type |
| `Event` | ✅ | Type |
| All `*Props` types | ✅ | Types from @atlaskit/forge-react-types |

---

## @forge/bridge

Frontend API for Custom UI apps (runs in iframe).

### Core

| API | Status | Tests | Notes |
|-----|--------|-------|-------|
| `invoke(functionKey, payload)` | ✅ | `custom-ui-e2e.test.ts` | Routes through bridge to resolver |
| `requestJira(path, options)` | ✅ | `custom-ui-e2e.test.ts` | Routes through bridge to product API |
| `requestConfluence(path, options)` | ✅ | — | |
| `requestBitbucket(path, options)` | ✅ | — | |
| `requestRemote(remoteKey, options)` | ⚠️ | — | Stubbed in browser shim, logs warning |

### View

| API | Status | Tests | Notes |
|-----|--------|-------|-------|
| `view.getContext()` | ✅ | `custom-ui-e2e.test.ts` | Full ForgeContext: accountId, cloudId, locale, timezone, theme, license, extension data. Hydrates via product API for Jira Issue + Confluence Content modules |
| `view.submit(payload)` | ✅ | `modal-bridge.test.ts` | In modal: postMessage to parent → closes overlay → fires onClose. Outside modal: RPC to backend |
| `view.close(payload)` | ✅ | `modal-bridge.test.ts` | Same as submit — postMessage in modal, RPC otherwise |
| `view.onClose(callback)` | ✅ | `modal-bridge.test.ts` | Stores callback, fires when modal closes |
| `view.open()` | 🔇 | — | No-op |
| `view.refresh(payload)` | ✅ | — | Triggers page reload to re-render module |
| `view.createHistory()` | ❌ | — | Client-side routing history. Returns nothing |
| `view.theme.enable()` | ✅ | `bridge-features.test.ts` | Sets `data-color-mode=dark` on document root |
| `view.changeWindowTitle(title)` | ✅ | `bridge-features.test.ts` | Sets `document.title` |
| `view.emitReadyEvent()` | ✅ | `bridge-features.test.ts` | Dispatches `forge-sim:ready` custom event |
| `view.createAdfRendererIframeProps()` | ❌ | — | ADF rendering setup |

### Modal

| API | Status | Tests | Notes |
|-----|--------|-------|-------|
| `new Modal(options)` | ✅ | `modal-bridge.test.ts` | Full options: resource, onClose, size, context, closeOnEscape, closeOnOverlayClick, title |
| `modal.open()` | ✅ | `modal-bridge.test.ts` | Creates Atlaskit-style overlay + iframe to `/module/<resource>/?_modal=true&context=<b64>` |

### Router

| API | Status | Tests | Notes |
|-----|--------|-------|-------|
| `router.navigate(location)` | ✅ | `bridge-features.test.ts` | Resolves NavigationTarget to product URL, navigates |
| `router.open(location)` | ✅ | `bridge-features.test.ts` | Resolves NavigationTarget to product URL, opens in new tab |
| `router.getUrl(location)` | ✅ | `bridge-features.test.ts` | Resolves NavigationTarget → URL (Issue, Content, Space, Dashboard, etc.) |
| `router.reload()` | ✅ | — | Calls `window.location.reload()` |
| `NavigationTarget` | ✅ | — | Constant exported |

### Events (cross-module communication)

| API | Status | Tests | Notes |
|-----|--------|-------|-------|
| `events.emit(event, payload)` | ✅ | — | Local dispatch within process (in-memory listener registry) |
| `events.on(event, callback)` | ✅ | — | Registers listener, returns unsubscribe handle |
| `events.emitPublic(event, payload)` | ✅ | `bridge-features.test.ts` | Dispatches locally with `public:` prefix + notifies server |
| `events.onPublic(event, callback)` | ✅ | `bridge-features.test.ts` | Subscribes with `public:` prefix, returns unsubscribe handle |

### Realtime (pub/sub)

| API | Status | Tests | Notes |
|-----|--------|-------|-------|
| `realtime.publish(channel, payload)` | ❌ | — | Not implemented |
| `realtime.subscribe(channel, callback)` | ❌ | — | Not implemented |
| `realtime.publishGlobal(channel, payload)` | ❌ | — | Not implemented |
| `realtime.subscribeGlobal(channel, callback)` | ❌ | — | Not implemented |

### Object Store (file storage)

| API | Status | Tests | Notes |
|-----|--------|-------|-------|
| `objectStore.upload(params)` | ❌ | — | File upload from Custom UI |
| `objectStore.download(params)` | ❌ | — | File download |
| `objectStore.getMetadata(params)` | ❌ | — | File metadata |
| `objectStore.delete(params)` | ❌ | — | File deletion |

### Other

| API | Status | Tests | Notes |
|-----|--------|-------|-------|
| `showFlag(options)` | ✅ | `bridge-features.test.ts` | Renders Atlaskit-styled toast in browser (stacking, auto-dismiss, actions, close handle) |
| `rovo.open(payload)` | ❌ | — | Rovo AI agent sidebar |
| `rovo.isEnabled()` | ❌ | — | |
| `i18n.getTranslations(locale, options)` | ✅ | — | Reads from I18nStore (app's __LOCALES__ dir) |
| `i18n.createTranslationFunction(locale)` | ✅ | — | Returns t(key, defaultValue) backed by I18nStore |
| `i18n.resetTranslationsCache()` | ✅ | — | Clears translation cache and store |
| `permissions.check()` | ✅ | `bridge-features.test.ts` | Always returns `{ hasPermission: true }` |
| `featureFlags.evaluate()` | 🔇 | `bridge-features.test.ts` | Returns undefined (stub — no feature flag backend) |
| `invokeRemote(key, options)` | 🔇 | — | Forge Remotes not simulated |
| `invokeService(key, options)` | 🔇 | — | |

---

## @forge/resolver

| API | Status | Tests | Notes |
|-----|--------|-------|-------|
| `new Resolver()` | ✅ | `shims.test.ts` | |
| `resolver.define(key, handler)` | ✅ | `shims.test.ts`, `deployer.test.ts` | |
| `resolver.getDefinitions()` | ✅ | `shims.test.ts` | |

---

## Packages Not Shimmed (direct imports will load real package or fail)

| Package | Status | Notes |
|---------|--------|-------|
| `@forge/auth` | ❌ | `authorizeJiraWithFetch`, `authorizeConfluenceWithFetch`. Not intercepted by loader hooks. |
| `@forge/i18n` | ⚠️ | Not intercepted by loader hooks, but bridge shim's I18nStore provides equivalent functionality. Real package partially works for types/constants. |
| `@forge/egress` | ❌ | Egress filtering rules. Not intercepted. Not commonly imported directly by apps. |
| `@forge/manifest` | ❌ | Manifest types. Not intercepted. Types-only usage would work at compile time. |
| `@forge/storage` | ⚠️ | Not directly shimmed, but `@forge/api` re-exports its query types. Direct `import { storage } from '@forge/storage'` would load the real package. |

---

## Manifest Modules

Module types recognized by forge-sim manifest parser.

### Parsed & Rendered

| Module Type | Status | Notes |
|-------------|--------|-------|
| `jira:issuePanel` | ✅ | Full: deploy, render, dev preview |
| `jira:issueActivity` | ✅ | Parsed and renderable |
| `jira:issueContext` | ✅ | Parsed and renderable |
| `jira:issueGlance` | ✅ | Parsed and renderable |
| `jira:issueAction` | ✅ | Parsed and renderable |
| `jira:globalPage` | ✅ | Parsed and renderable |
| `jira:projectPage` | ✅ | Parsed and renderable |
| `jira:adminPage` | ✅ | Parsed and renderable |
| `jira:dashboardGadget` | ✅ | Parsed and renderable |
| `confluence:globalPage` | ✅ | Parsed and renderable |
| `confluence:spacePage` | ✅ | Parsed and renderable |
| `confluence:contentAction` | ✅ | Parsed and renderable |
| `confluence:contentBylineItem` | ✅ | Parsed and renderable |
| `confluence:contextMenu` | ✅ | Parsed and renderable |
| `macro` | ✅ | Confluence macro |

### Parsed but Not Rendered

| Module Type | Status | Notes |
|-------------|--------|-------|
| `function` | ✅ | Loaded and invocable |
| `consumer` | ✅ | Wired to queues |
| `trigger` | ✅ | Event triggers registered |
| `scheduledTrigger` | ✅ | Fireable on demand + on startup in dev mode |
| `webtrigger` | ⚠️ | Parsed but no HTTP endpoint served |

### Not Parsed

| Module Type | Status | Notes |
|-------------|--------|-------|
| `jira:serviceDeskPortalRequestDetail` | ❌ | JSM modules |
| `jira:serviceDeskPortalRequestCreate` | ❌ | |
| `jira:serviceDeskPortalRequestList` | ❌ | |
| `jira:serviceDeskQueuePage` | ❌ | |
| `jira:backlogItemAction` | ❌ | |
| `jira:boardIssueAction` | ❌ | |
| `jira:sprintAction` | ❌ | |
| `jira:customField` | ❌ | Custom field types |
| `jira:customFieldType` | ❌ | |
| `jira:uiModificationsOverride` | ❌ | UI modifications |
| `jira:workflowValidator` | ❌ | Workflow extensions |
| `jira:workflowCondition` | ❌ | |
| `jira:workflowPostFunction` | ❌ | |
| `confluence:homepageFeed` | ❌ | |
| `confluence:spaceSidebarItem` | ❌ | |
| `bitbucket:pipelineStep` | ❌ | Bitbucket modules |
| `bitbucket:repoPullRequestOverview` | ❌ | |
| `bitbucket:repoPage` | ❌ | |
| `compass:component` | ❌ | Compass modules |
| `compass:adminPage` | ❌ | |
| `rovo:agent` | ❌ | Rovo AI agent definition |
| `rovo:action` | ❌ | |
| `app:adminPage` | ❌ | Cross-product admin |

---

## Platform Features

Features beyond individual APIs.

| Feature | Status | Tests | Notes |
|---------|--------|-------|-------|
| Manifest-driven deploy | ✅ | `deployer.test.ts`, `deploy-e2e.test.ts` | Reads manifest.yml, wires everything |
| Module loader hooks | ✅ | `loader-hooks.test.ts` | Intercepts @forge/* imports |
| Function contracts (calling conventions) | ✅ | `function-contracts.test.ts` | Resolver, trigger, consumer, scheduled, webtrigger |
| Product API mock + real proxy | ✅ | `product-api-proxy.test.ts` | Route-level mock priority |
| OAuth authentication | ✅ | `credentials.test.ts` | PAT + OAuth 2.0 |
| Persistent state (KVS) | ✅ | `persistence.test.ts` | Save/restore on exit/start |
| Persistent state (SQL) | ✅ | `persistence.test.ts`, `persistence-okr.test.ts` | MySQL dump/restore |
| Persistent state (Entities) | ✅ | `persistence.test.ts` | |
| Concurrent queue processing | ✅ | `concurrency.test.ts` | Concurrency keys, parallel execution |
| Multi-module UI isolation | ✅ | `dual-panel.test.ts` | Separate ForgeDoc trees per module |
| UIKit → Atlaskit rendering | ✅ | — | 73/73 component mappings in renderer |
| Custom UI serving | ✅ | `custom-ui-e2e.test.ts` | Vite serves resource directory |
| Dev server (HMR + WebSocket) | ✅ | — | `forge-sim dev` |
| Stateful daemon (CLI) | ✅ | — | Auto-start, idle timeout, PID management |
| MCP server (stdio) | ✅ | `mcp-server.test.ts` | 20 tools, 4 resources |
| MCP server (HTTP) | ✅ | — | StreamableHTTP transport |
| Egress filtering | ❌ | — | No enforcement of `permissions.external` |
| Content Security Policy | ❌ | — | No CSP enforcement |
| App installation lifecycle | 🔇 | — | `onInstalled` etc. are no-ops |
| Scoped permissions enforcement | ❌ | — | No checking of `permissions.scopes` |
| Rate limiting simulation | ❌ | — | No simulation of Forge rate limits |
| Memory/timeout limits | ❌ | — | No simulation of 128MB/25s limits |
| Forge Remotes | ❌ | — | External API integration via manifest `remotes:` |
| Forge Environments | ⚠️ | — | Always returns "DEVELOPMENT" |

---

## Summary

| Category | Implemented | Partial/Stub | Not Implemented | Total |
|----------|-------------|-------------|-----------------|-------|
| @forge/api | 21 | 8 | 6 | 35 |
| @forge/kvs | 18 | 0 | 0 | 18 |
| @forge/sql | 6 | 0 | 2 | 8 |
| @forge/events | 12 | 0 | 4 | 16 |
| @forge/resolver | 3 | 0 | 0 | 3 |
| @forge/react hooks | 11 | 0 | 2 | 13 |
| @forge/react components (UIKit) | 70 | 0 | 0 | 70 |
| @forge/react components (other) | 18 | 0 | 0 | 18 |
| @forge/bridge | 29 | 1 | 2 | 32 |
| Manifest modules | 16 | 1 | 18 | 35 |
| Platform features | 14 | 2 | 6 | 22 |
| **Total** | **218** | **11** | **40** | **269** |

**Coverage: 81% implemented, 4% partial, 15% missing**
