# Forge Function Invocation Contracts

Audit of how Forge invokes different function types, vs what forge-sim does.

## 1. Resolver Functions (UI Bridge)

**Forge docs:** `@forge/resolver` — the ONLY function type that uses `({ payload, context })` as a single wrapped object.

```ts
// Definition
const resolver = new Resolver();
resolver.define('functionKey', ({ payload, context }) => { ... });
export const handler = resolver.getDefinitions();

// Invoked by frontend via @forge/bridge
import { invoke } from '@forge/bridge';
const result = await invoke('functionKey', { someData: true });
```

**Context shape:**
- `accountId`, `accountType`, `cloudId`, `workspaceId`, `localId`
- `installContext`, `environmentId`, `environmentType`
- `extension` (module-specific, includes `config` for macros)
- `installation` (ari, contexts[])

**forge-sim status:** ✅ Correct — `resolver.invoke()` wraps as `{ payload, context }`

---

## 2. Event Triggers

**Forge docs:** Two separate arguments: `(event, context)`

```ts
export async function myTriggerFunction(event, context) {
  // event = event-specific payload (e.g., { issue: {...} } for avi:jira:updated:issue)
  // context = standard context object
}
```

**Context shape:**
- `principal` (Principal | undefined)
- `installContext` (string)
- `workspaceId` (string | undefined)
- `license` (License | undefined)
- `installation` (Installation | undefined)

**forge-sim status:** ✅ Fixed in baa2754 — `fireTrigger()` now calls `handler(event, context)` directly

---

## 3. Scheduled Triggers

**Forge docs:** Handler receives `({ context })` as a single object (NOT two args!).
Must return HTTP-like response: `{ statusCode, body?, headers?, statusText? }`
- `statusCode: 204` = success
- `statusCode: 5xx` = error
- Missing/wrong format = platform records `424 Failed dependency`

```ts
export const trigger = ({ context }) => {
  console.log(context);
  return { statusCode: 204, body: 'OK' };
}
```

**Request object:**
- `context.cloudId` (string)
- `context.moduleKey` (string)
- `contextToken` (string, opaque)

**forge-sim status:** ❌ WRONG
- Currently calls handler via `handler({ scheduledTrigger: { key, interval } })` in deployer
- Should call with `({ context: { cloudId, moduleKey }, contextToken })` shape
- Should validate return value has `statusCode` (warn/error if missing)

---

## 4. Queue Consumers (Async Events)

**Forge docs:** Two separate arguments: `(event, context)`

```ts
import { AsyncEvent } from '@forge/events';

export async function handler(event, context) {
  // event.body = the pushed payload
  // event.retryContext = { retryCount, retryReason, retryData, retentionWindow? }
  // context = standard context
}
```

**Event shape:**
- `body` (Record<string, unknown>) — the pushed payload
- `retryContext?` (RetryContext) — present on retries

**Return value:**
- Normal return = success
- Return `InvocationError` = request retry
- Throw = platform error (auto-retry with backoff)

**forge-sim status:** ✅ Mostly correct — queue.ts calls `consumer({ body, jobId }, context)`
- Missing: `retryContext` on retries (we don't simulate retries yet)
- Extra: `jobId` in event (docs don't show this in event, but it's available via push result)

---

## 5. Generic Functions (non-resolver)

**Forge docs:** Two separate arguments: `(payload, context)`

```ts
export const handler = (payload, context) => {
  // payload = module-specific
  // context = standard context
}
```

> "Functions implemented with `@forge/resolver` resolver definitions receive arguments differently."

**forge-sim status:** ⚠️ We don't distinguish — everything goes through `resolver.invoke()` which wraps as `{ payload, context }`. Non-resolver functions registered via `sim.resolver.define()` get the wrong signature.

---

## 6. Web Triggers

**Forge docs:** Two arguments: `(request, context)`

```ts
export async function handler(request, context) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': ['application/json'] },
    body: JSON.stringify({ message: 'Hello' })
  };
}
```

**Request shape:**
- `method` (string)
- `path` (string)
- `headers` (object)
- `queryParameters` (object)
- `body` (string)

**forge-sim status:** ❌ Not implemented yet (no web trigger support)

---

## Summary of Changes Needed

### Critical
1. **Refactor function registry** — Distinguish between resolver-defined functions (single `{ payload, context }` arg) and plain functions (two separate args `(event/payload, context)`)
2. **Scheduled trigger contract** — Pass correct request shape `({ context: { cloudId, moduleKey }, contextToken })`, validate return has `statusCode`, warn on `424`-like responses
3. **Deployer** — When wiring functions, tag them by type (resolver vs trigger vs consumer vs scheduled) so invocation uses the right calling convention

### Nice-to-have
4. **Web trigger support** — Not implemented, but spec is clear
5. **Consumer retry context** — Add `retryContext` on retries
6. **InvocationError** — Support retry signaling from consumers
