# General Hardening Plan

**Status:** Active
**Date:** 2026-03-17
**Author:** Nyx + Ryan

> **If it works in forge-sim, it should work in Forge. If it wouldn't work in Forge, it shouldn't work in forge-sim.**

This document tracks the hardening work to make forge-sim production-quality.

---

## 1. Testing Gaps

### Renderer Integration Tests
Add `@testing-library/react` tests for `ForgeDocRenderer` + `component-map.tsx`.

- [ ] Setup: vitest jsdom environment, @testing-library/react, mock Atlaskit theme provider
- [ ] Form field grouping paths: Field wrapper, Fieldset + CheckboxField, RangeField
- [ ] Standalone components (CheckboxGroup, RadioGroup — props vs children)
- [ ] Event handler wiring (`__fn__:` markers → real callbacks in bridge mode)
- [ ] Fallback component for unknown ForgeDoc types
- [ ] Empty/null children handling

### End-to-End Dev Server Tests
Spin up the full `forge-sim dev` server, hit it with HTTP/WS, verify the whole chain.

- [ ] UIKit mode: start server → fetch HTML → verify Atlaskit rendered
- [ ] Custom UI mode: start server → fetch HTML → verify bridge script injected
- [ ] Proxy mode: start upstream + proxy → fetch through proxy → verify injection + passthrough
- [ ] Bridge RPC round-trip: connect WS → invoke resolver → get response
- [ ] Module picker: GET / → see all modules listed
- [ ] Module routing: GET /module/<key>/ → correct module served
- [ ] Tools: GET /__tools/api/manifest → returns manifest JSON
- [ ] JWKS: GET /__forge/jwks.json → valid JWKS with keys (when remotes configured)
- [ ] State persistence: start → write KVS → shutdown → restart → KVS still there

### Negative Case Testing
Verify that forge-sim fails clearly when the Forge app would be broken in production. These tests protect the core principle — forge-sim should NOT silently succeed where Forge would reject.

- [ ] Calling a URL not declared in manifest `permissions.external.fetch` → clear error
- [ ] `invokeRemote` from a module with no `resolver.endpoint` → error with available endpoints listed
- [ ] `invoke('nonexistent')` with a function key that no resolver defines → error
- [ ] Resolver returning wrong format (e.g., not serializable) → error
- [ ] Scheduled trigger handler not returning `{ statusCode }` → 424 error
- [ ] Duplicate `resolver.define()` names across different resolvers → warning/error about collision
- [ ] Missing `resource` key on a UI module → clear error at startup
- [ ] Endpoint referencing a nonexistent remote → error at deploy time
- [ ] Queue consumer referencing nonexistent function → error at deploy
- [ ] Web trigger handler returning invalid response format → error
- [ ] `requestJira()` / `requestConfluence()` to a path not matching any mock and no real API connected → clear error (not silent empty response)
- [ ] OAuth scopes: calling an API that requires scopes not declared in manifest → warning

### Test Isolation
Tests must be self-contained — no references to `~/Projects/` or external directories.

- [ ] Audit all test files for paths outside the repo (grep for `/Users/`, `~/Projects/`, hardcoded absolute paths)
- [ ] Move any external fixture apps into `src/__tests__/fixtures/` with minimal manifests
- [ ] Ensure `npm test` works on a clean clone with zero external dependencies

### Edge Cases in Manifest Parsing
- [ ] Malformed YAML → clear parse error with line number
- [ ] Missing `app.id` → error
- [ ] Module with `function:` but no `resource:` (UIKit 1 style) → warning about deprecated pattern
- [ ] Empty modules section → graceful handling
- [ ] Unknown module types → logged but not fatal
- [ ] Circular endpoint → remote → endpoint references → detect and error

---

## 2. Error Handling & DX

### Silent Error Audit
Walk through every `catch` block in the codebase and classify:

- [ ] `dev-command.ts` — the FIT cascade bug was caused by a catch that swallowed a fatal error as a warning. Are there others?
- [ ] `deployer.ts` — deploy errors that silently skip functions
- [ ] `remote-proxy.ts` — already improved (2026-03-16), verify coverage
- [ ] `product-api.ts` — real API errors vs mock fallback
- [ ] `dev-server.ts` — RPC error handling (already logs, but are responses always useful?)
- [ ] Bridge shims — errors in shim code that get swallowed by the app

### Structured Error Messages
Every error should answer three questions: **what** went wrong, **why**, and **what to do**.

```
❌ Bad:  "Cannot read property 'key' of undefined"
✅ Good: "Module "my-panel" has no endpoint configured. invokeRemote() requires 
         resolver.endpoint in the manifest. Available endpoints: azure-backend"
```

- [ ] Audit all `throw new Error()` calls — do they include context?
- [ ] Audit all `console.error` / `console.warn` calls — are they actionable?
- [ ] Add a `forge-sim doctor` command? (validates manifest, checks dependencies, tests connections)

### Verbose/Debug Mode
- [ ] `--verbose` flag for detailed logging (module resolution, function dispatch, API routing)
- [ ] Environment variable alternative: `FORGE_SIM_DEBUG=1`
- [ ] Log categories: `loader`, `bridge`, `rpc`, `remote`, `api`, `sql`, `kvs`
- [ ] Don't clutter normal output — verbose is opt-in

---

## 3. Behavioral Parity Audit

### Bridge Commands
Walk through `@forge/bridge` exports and verify we handle each one:

- [x] `invoke(functionKey, payload)` — resolver dispatch
- [x] `invokeRemote(input)` — endpoint-resolved remote call
- [x] `requestRemote(remoteKey, opts)` — direct remote fetch
- [x] `invokeService(input)` — container/service call (via ui-container-fetch)
- [x] `view.getContext()` — returns module context
- [x] `view.submit(payload)` — modal/view submission
- [x] `view.close(payload)` — modal/view close
- [x] `view.refresh()` — page reload
- [ ] `view.createHistory()` — navigation history for SPA
- [ ] `showFlag(options)` — in-app flag/notification
- [ ] `router.open(url)` / `router.navigate(url)` — Atlassian product navigation
- [ ] `events.on(event, callback)` — product event subscription
- [ ] `authorize(remoteKey)` — OAuth flow trigger
- [ ] `requestJira(path, init)` — already working via fetchProduct
- [ ] `requestConfluence(path, init)` — already working via fetchProduct
- [ ] `requestBitbucket(path, init)` — verify
- [ ] `enableTheming()` — currently no-op, document why

### Context Object
Verify our context matches the real Forge context shape:

- [ ] `accountId` — from connected account or simulated
- [ ] `cloudId` — from connected account
- [ ] `siteUrl` — from connected account
- [ ] `moduleKey` — from URL/baked-in key
- [ ] `localId` — unique per installation
- [ ] `extension.type` — module type from manifest
- [ ] `extension.entryPoint` — which entry point triggered this
- [ ] `extension.*` — product-specific (issueKey, contentId, spaceKey, projectKey, etc.)

### Response Formats
- [ ] Resolver invoke response — matches Forge's wrapper format
- [ ] Remote invoke response — `{ success, payload: { status, statusText, headers, body } }`
- [ ] Remote request response — raw Response-like object
- [ ] Product API response — matches real Atlassian API response shape
- [ ] Error responses — match Forge's error format (not our own invention)

---

## 4. Performance & Reliability

- [ ] **MySQL lazy-start race**: Migrations can fire before MySQL is ready. Add readiness check/retry.
- [ ] **File watcher debouncing**: Rapid saves → coalesce into single redeploy (200ms debounce?)
- [ ] **WebSocket reconnection**: Bridge shim already retries on disconnect (2s interval). Verify it works reliably.
- [ ] **Port conflict handling**: If :5173 or :5174 is in use, show clear error with suggestion (--port/--ws-port)
- [ ] **Large state restore**: Test with big KVS (10k+ keys) and SQL dumps — any startup lag?
- [ ] **Memory leaks**: Long-running dev sessions — does the simulator leak? (log listeners, WS connections, etc.)

---

## 5. Documentation

- [ ] **README overhaul**: Current feature set, three modes (UIKit/Custom UI/Proxy), quick start
- [ ] **`--help` output**: All commands and flags documented
- [ ] **Examples section**: One example per mode with expected output
- [ ] **Troubleshooting guide**: Common issues (port conflicts, MySQL not starting, bridge not connecting)
- [ ] **API reference**: MCP tools + REST API for tools server
- [ ] **CONTRIBUTING.md**: How to add new shims, new bridge commands, new test apps

---

## Progress Tracking

| Area | Items | Done | % |
|------|-------|------|---|
| Renderer Tests | 6 | 0 | 0% |
| E2E Dev Server Tests | 9 | 0 | 0% |
| Negative Case Tests | 12 | 0 | 0% |
| Manifest Edge Cases | 6 | 0 | 0% |
| Error Handling | 9 | 0 | 0% |
| Parity Audit | ~20 | ~10 | 50% |
| Performance | 6 | 0 | 0% |
| Documentation | 6 | 0 | 0% |
| **Total** | **~74** | **~10** | **~14%** |
