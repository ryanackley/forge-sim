# Deferred issues

A staging file for work that should become a GitHub issue but hasn't yet.

**Why this exists:** multiple agents work in this repo concurrently. If each
one files issues directly they collide — duplicates, races on numbering, and
issues opened against work another agent is mid-way through changing. So
agents append here instead, and a single agent is handed this file later to
open the issues in one pass.

## Conventions

- Append to the end; don't renumber or reorder existing entries.
- One `##`-level heading per item, a few sentences at most: what's wrong, why
  it was left, and what a fix would need to decide. Link code as
  `path/to/file.ts` or `path/to/file.ts:123`.
- Don't delete an entry when the work lands — the agent that files the issues
  prunes what's already fixed.

---

## Headless `Modal.open()` throws instead of rendering

`Modal.open()` is the one bridge command whose behaviour differs by surface.
The browser host draws a real overlay; the headless host
(`src/bridge/hosts/headless.ts`) throws, because there is no window to draw
into and silently resolving `undefined` would leave the app waiting on a
modal that never appears. That is defensible today, but it means a headless
test cannot exercise any flow that opens a modal, and a prebuilt bundle
running the real `@forge/bridge` hits it unavoidably.

Worth revisiting: headless could instead treat a modal as a second render
tree (as it already does for macro inline config), so `sim.ui` could render
the modal module by key and drive submit/close through the existing view-event
stream. The decision to make is whether the modal's ForgeDoc becomes a
first-class thing `sim.ui` exposes, or stays a thrown error with a pointer to
`forge-sim dev`.

## Dev mode does not hot-reload `__LOCALES__` edits

`forge-sim dev` now loads the app's translations at boot (`sim.i18n.loadFromAppDir`
in `src/dev-command.ts`) and serves them at `<page>/__LOCALES__/<file>`. The store
caches each locale after first read, and nothing re-reads on change, so editing
`en-US.json` while dev is running has no effect until restart. The file watcher
already fires for the app dir; the fix is to call `loadFromAppDir` again (it
clears the caches) when a changed path is under a `__LOCALES__` directory, then
let the page's next `useTranslation` fetch pick it up. Decide whether a locale
change should also trigger a browser reload, since the real package caches
translations per page load too.

## Per-deploy heap growth that is NOT the module graph (~140–550 KB/deploy)

After the CJS-output switch, bundle retention is provably closed — a heap snapshot after 40
redeploys holds exactly one copy of the app's source and one `.forge-sim/bundles` entry in
`require.cache`, and backend source maps are external so Node's source-map cache holds nothing.
Yet `heapUsed` still grows per deploy: ~137 KB on a one-handler app, ~550 KB on an app inlining
`@forge/api` + `@forge/events` + `@forge/kvs` (measured with `--expose-gc`, gc twice, 40 deploys
after warm-up). It scales with app size but is not source text, so it is sim-side state
produced per deploy — candidates are deploy summaries/warnings kept on the simulator, console
capture buffers, bundler cache metadata (`meta.json` inputs are ~150 bytes × every inlined file),
or registry entries keyed by something per-deploy. Pre-existing: the ESM baseline showed the
same residual (280 KB on the tiny app) underneath the module-graph retention it has now lost.
Harmless for tests; it is the remaining unbounded term for long `forge-sim dev` / MCP daemon
sessions. A fix needs a heap-snapshot retainer-path diff between deploy N and N+10 to name the
holder before changing anything.

## `getFrameDispatch` stays rejected — close by design unless a real app calls it

The real package side is a pure passthrough: `node_modules/@forge/bridge/out/view/
getFrameDispatch.js` is `callBridge('getFrameDispatch')` returned verbatim, so the only
question was ever what the Atlassian host answers — an internal frame-dispatch handle for
nested frames with no documented shape. Guessing a shape would violate no-silent-stubs
worse than rejecting does, so the registry keeps `unsupported` with its current message.
Revisit only if a real app is observed calling it (the command registry will say which
module), in which case capture the real host's answer shape first.

## Adversarial 1019 minors — stale `dev.lock` after clean shutdown (F12)

Ctrl-C / `kill` of `forge-sim dev` leaves `<app>/.forge-sim/state/dev.lock` behind (startup
still works, so stale-lock detection covers it). Left because it is cosmetic; a fix is removing
the lock in the same shutdown path that prints "💾 Saved …", and deciding what SIGKILL leaves
behind is out of scope.

## Adversarial 1019 minors — dev-page console noise from Atlaskit internals (F14)

Every dev-mode UI Kit page logs repeated `Multiple versions of FeatureGateClients found`,
`You are loading @emotion/react when it is already loaded`, and a feature-gate "Client must be
initialized" error object — none from app code. Worth a look at whether the page shell
double-loads something; purely cosmetic otherwise.

## Adversarial 1019 doc gaps — MCP deploy wipes pre-registered mocks; getConsoleLogs shape

Two small doc debts from the trial: (1) `docs/ai/mcp.md` should say that `forge_deploy`
(reset defaults true) wipes mock routes registered before it — agents must re-register after
deploy; the forge_deploy/forge_mock_routes tool descriptions should say so too. (2) The element
shape of `sim.getConsoleLogs()` is undocumented in `docs/reference/api.md`.

## resolve.modules setting has no affect

In the vite.config this seems to be a hallucination for a config that doesn't exist. It's been verified this 
setting has no effect. 

## The render context overlay is one global, not per module

`sim.resolver.setRenderContext()` (`src/ui/simulator-ui.ts`) holds the last
render's user and module key for every later resolver invoke, so after
rendering panel A as alice and panel B as bob, an invoke that panel A's effect
fires late runs as bob. The overlay should be keyed by module (the headless
host already knows which module scope a bridge call comes from via
`runInModuleScope`). A fix must decide what a cold `sim.invoke()` with no
module sees once overlays are per module: defaults + sticky only is the
simplest answer.

## Pre-uninstall, custom field value, workflow and JQL functions have no firing API

They are driven through `sim.invoke()`, which wraps the payload resolver-style
(`{ payload, context }`) while Forge calls them `(payload, context)`. Identity
is right since `invoke` builds a user-less context for these kinds, but the
argument convention is not. A fix would add `sim.firePreUninstall()`,
`sim.fireCustomFieldValue(fieldKey, issues)` and the like, calling the
registered function with Forge's two-argument shape, and point `sim.invoke()`
at them the way it already points web trigger functions at
`fireWebTrigger()`.

## Installation ARIs are always Jira

`getDefaultContext().installContext` and `contextAri` in
`src/runtime/forge-runtime.ts` are `ari:cloud:jira::site/<cloudId>` whatever
the app targets, so a Confluence or Bitbucket app sees a Jira install ARI. The
manifest's module types say which product the app is installed on; a fix must
decide the ARI for apps that span products (Forge installs per product, so one
sim instance would have to pick one or model several contexts).

## Connected `requestAtlassian` paths other than `/graphql` are an unverified guess

An unmocked `stargate` call reaches the connected site's `/gateway/api` for
every path (`createRealHandler` in `src/product-api.ts`). That is known to
work for `/graphql`, which `sim.productApi.requestGraph()` always used. For
any other `requestAtlassian` / `requestConnectedData` path it is a guess
that the tenanted gateway proxies the service and accepts a PAT; real Forge
sends these to `api.atlassian.com` with an app token. Atlassian's fetch docs
do not list `requestAtlassian`; the package's only internal caller is the
privacy API (`/app/report-accounts`). Worth measuring against a real site
before relying on it. A fix must decide whether a non-GraphQL path while
connected should be tried, or refused with a message saying only the GraphQL
gateway is a known-good target.

## ESM manual-packaged handlers are not contained to `app.package.path`

CommonJS requires from inside the package directory are contained by the
`Module._resolveFilename` patch in `src/loader/cjs-interception.ts`. A
manual-packaged handler that is ESM (off the packaging standard, which
requires CommonJS, and already warned about at deploy) is imported by Node
directly, and its bare imports walk up to a `node_modules` Forge would not
upload. Containing them needs the ESM loader hook (`src/loader/hooks.ts`) to
know the registered package directories, which means passing them to the
hook worker (a MessageChannel on `register()`) and refusing a resolution
outside them. Decide whether that is worth the machinery for an off-standard
layout, or whether the deploy warning should become an error instead.
