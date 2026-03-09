# Forge Platform Gaps Audit

Comprehensive audit of what the real Forge platform provides vs what forge-sim currently implements.

**Last updated:** 2026-03-09

---

## 🔴 Not Implemented (will cause runtime errors)

### @forge/bridge — Missing APIs

| API | What it does | Impact |
|-----|-------------|--------|
| **`realtime.publish/subscribe`** | Pub/sub between frontend instances and backend | Apps using real-time collaboration will crash. Used for live updates (e.g., two users seeing each other's cursors). |
| **`objectStore.upload/download/delete/getMetadata`** | File/blob storage (upload from Custom UI, download in backend) | Any app handling file attachments or binary data through the Forge Object Store will fail. |
| **`rovo.open/isEnabled`** | Opens Rovo AI agent sidebar | Rovo-integrated apps will fail. Newer feature, but Atlassian is pushing it hard. |
| **`invokeRemote / invokeService`** | Call external services defined in manifest `remotes:` | Apps using Forge Remotes (external API integrations) will crash. We stub these in @forge/api but not in @forge/bridge. |

### @forge/react — Missing Hooks

| Hook | What it does | Impact |
|------|-------------|--------|
| **`useContentProperty`** | Read/write Confluence content properties from UI | Confluence apps using content properties in the frontend will get undefined. |
| **`useSpaceProperty`** | Read/write Confluence space properties from UI | Same — Confluence space-level storage. |
| **`useIssueProperty`** | Read/write Jira issue properties from UI | Jira apps using issue properties in the frontend. This is a common pattern. |
| **`useObjectStore`** | File upload/download from UI (wraps objectStore bridge API) | Any UIKit file handling. |
| **`useForm`** | Form state management hook | Apps using the newer form patterns. Might fall back okay since it's mostly a convenience wrapper. |
| **`useTranslation / I18nProvider`** | Internationalization in UIKit apps | i18n apps will get raw keys instead of translated strings. |

### @forge/react — Missing Components

| Component | What it does | Impact |
|-----------|-------------|--------|
| **`User`** | Renders an Atlassian user avatar + name by accountId | Common in issue/project UIs. Will be undefined. |
| **`UserGroup`** | Renders multiple user avatars | Same. |
| **`Popup`** | Popup/popover component | Apps using inline popovers. |
| **`InlineEdit`** | Inline editable text field | Common UX pattern in Atlassian products. |
| **`Comment`** | Renders an ADF comment block | Confluence/Jira comment rendering. |
| **`AdfRenderer`** | Renders Atlassian Document Format content | Any app displaying rich text from Jira/Confluence. |
| **`Global`** | Global page layout (sidebar + main) | `jira:globalPage` / `confluence:globalPage` apps with navigation. |
| **`Frame`** | Iframe embedding component | Custom UI embedding scenarios. |
| **`Em / Strike / Strong`** | Inline text formatting | Less common, but used in rich text UIs. |

### Packages — Not Shimmed At All

| Package | What it does | Impact |
|---------|-------------|--------|
| **`@forge/auth`** | `authorizeJiraWithFetch`, `authorizeConfluenceWithFetch` — permission checks | Apps that check permissions before making API calls. We have stubs in @forge/api but the dedicated package isn't intercepted. |
| **`@forge/i18n`** | Translation utilities, locale constants, translation file parsing | Direct imports will load the real package (which might work since it's mostly utility functions), but it won't have the Forge runtime context. |

---

## 🟡 Partially Implemented (works but incomplete)

### @forge/bridge — Incomplete APIs

| API | What works | What's missing |
|-----|-----------|---------------|
| **`view.getContext()`** | Returns basic context (accountId, cloudId, siteUrl, moduleKey) | Missing: `license`, `locale`, `timezone`, `theme`, `surfaceColor`, `userAccess`, `permissions`, `environmentId`, `environmentType`, `extension` data. Apps that check `context.license.active` or `context.extension.issueKey` may fail. |
| **`view.submit()`** | Logged but no-op | Should close modal and return data to parent. Apps using modal submit/close flow won't see their data propagated. |
| **`view.close()`** | Logged but no-op | Same as submit. |
| **`view.createHistory()`** | Not implemented | Apps using client-side routing in Custom UI. |
| **`view.theme.enable()`** | Not implemented | Theme-aware apps won't get dark mode tokens. |
| **`view.changeWindowTitle()`** | Not implemented | Minor, title won't update. |
| **`events.emit/on`** | Basic stub | Cross-module event communication doesn't actually propagate. Apps using `events.emit('myEvent')` in one module and `events.on('myEvent')` in another won't work. |
| **`events.emitPublic/onPublic`** | Stub | Public events (cross-app communication) not implemented. |
| **`showFlag()`** | Stub in bridge shim | Flag is created but not actually displayed anywhere. In `forge-sim dev`, flags should appear in the browser. |
| **`router.navigate/open`** | Stub | Navigation doesn't actually happen. Apps that navigate to Jira issues or Confluence pages will silently fail. |
| **`permissions.check`** | Always returns `{hasPermission: true}` | No actual permission checking. Apps that conditionally render based on permissions will always see the "has permission" path. |
| **`featureFlags`** | Stub | Feature flag evaluation doesn't work. Apps using `featureFlags.evaluate()` will get undefined. |

### @forge/api — Incomplete APIs

| API | What works | What's missing |
|-----|-----------|---------------|
| **`asUser(accountId)`** | Treated same as `asUser()` | Offline user impersonation — making API calls as a different user. The `accountId` parameter is ignored. |
| **`storage` (legacy)** | Basic get/set/delete | The legacy `@forge/api` storage (deprecated) supports get/set/delete but not `query()`, `getSecret()`, or `transaction()`. Most apps should use `@forge/kvs` instead, but old apps may still use this. |
| **`authorize()`** | No-op | Should check if user has granted OAuth permissions. Always resolves. |
| **`getAppContext()`** | Returns hardcoded sim values | `appId`, `environmentId`, `installationId` are all fake. Apps that use these for conditional logic may behave differently. |
| **`webTrigger.getUrl()`** | Returns fake URL | The URL isn't actually reachable. Web trigger handlers aren't wired up to receive HTTP requests. |

### Manifest — Missing Module Types

| Module Type | What it does | Impact |
|-------------|-------------|--------|
| **`webtrigger`** | HTTP endpoint that triggers a function | We parse them but don't serve actual HTTP endpoints. |
| **`compass:*`** | Compass modules | Not parsed from manifest. |
| **`bitbucket:*`** | Bitbucket modules (PR panels, repo pages, etc.) | Not parsed from manifest. |
| **`jira:serviceDeskPortal*`** | JSM portal modules | Not parsed from manifest. |
| **`jira:dashboard*`** | Some dashboard sub-types | Partially parsed. |
| **`rovo:agent`** | Rovo AI agent definition | Not parsed. |
| **`confluence:homepageFeed`** | Confluence feed module | Not parsed. |

### Forge SQL

| What works | What's missing |
|-----------|---------------|
| Real MySQL 8.4, migrations, DDL, queries | **Connection pooling simulation** — real Forge has connection limits. **`@forge/sql` `sql` tagged template** — some apps use ``sql`SELECT * FROM ...` `` syntax instead of the migration runner. |

---

## 🟢 Well Implemented (high fidelity)

- **`@forge/kvs`** — Full: get/set/delete/query/batch/transact/secrets/entities
- **`@forge/resolver`** — Full: define/invoke/multi-function
- **`@forge/events`** — Full: Queue push/getJob, consumers, concurrency, error types
- **`@forge/sql`** — Full: real MySQL, migrations, parameterized queries
- **`@forge/api`** — Core: requestJira/Confluence/Bitbucket, route, asApp/asUser, storage, fetch
- **`@forge/react`** — 56/75+ components exported, ForgeReconciler, xcss
- **Manifest parsing** — Functions, UI modules (Jira + Confluence + macro), consumers, triggers, scheduled triggers, resources
- **Product API proxy** — Mock + real with route-level priority
- **Persistent state** — KVS + SQL save/restore

---

## Priority Recommendations

### P0 — Will block real-world apps

1. **`useIssueProperty` / `useContentProperty` / `useSpaceProperty`** — Extremely common in Jira/Confluence apps. These are how frontend code reads issue-level metadata.
2. **`view.getContext()` — full context object** — Many apps read `context.extension.issueKey` or `context.extension.project`. Our context is too sparse.
3. **`User` component** — Very common in issue panels. Shows who did something.
4. **`AdfRenderer`** — Any app that displays Jira descriptions or Confluence content.
5. **Web Triggers** — Not just parsing — actually serving HTTP endpoints.

### P1 — Will block common patterns

6. **`objectStore`** — File upload/download is a growing Forge use case.
7. **`events.emit/on`** — Cross-module communication (e.g., modal result → parent panel).
8. **`view.submit()` / `view.close()` propagation** — Modal workflows are broken without this.
9. **`Popup` / `InlineEdit`** — Common UI components.
10. **`showFlag()` rendering** — Flags should actually appear in `forge-sim dev` browser.

### P2 — Nice to have

11. **`realtime`** — Pub/sub for live collaboration.
12. **`useTranslation / I18nProvider`** — i18n support.
13. **`rovo`** — Rovo agent integration.
14. **Missing manifest module types** — Bitbucket, Compass, JSM, Rovo.
15. **`@forge/auth`** — Permission checking.
