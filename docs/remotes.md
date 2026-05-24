# Forge Remotes

Forge Remotes let your app call external HTTP services — your own backend, a third-party API, anything with a URL. forge-sim fully simulates this: manifest parsing, endpoint resolution, mock routing, real HTTP with FIT authentication, and a local JWKS endpoint for token verification.

---

## How It Works

In production Forge, when your app calls `invokeRemote()` or `requestRemote()`, the platform:

1. Resolves the **endpoint** from the manifest (which remote, what route prefix, what auth)
2. Signs a **FIT** (Forge Invocation Token) — an RS256 JWT with app/user/context claims
3. Sends the request to the remote's `baseUrl` with the FIT as a Bearer token
4. Your backend validates the FIT using Atlassian's public JWKS

forge-sim does the same thing, but locally. Your remote backend validates the FIT against forge-sim's JWKS endpoint instead of Atlassian's.

---

## Manifest Configuration

### Remotes

Define your external services in `manifest.yml`:

```yaml
remotes:
  - key: my-backend
    baseUrl: https://api.example.com
    operations:
      - storage
      - compute
    auth:
      appSystemToken:
        enabled: true
      appUserToken:
        enabled: false

  - key: analytics
    baseUrl: https://analytics.example.com
    operations:
      - fetch
```

| Field | Required | Description |
|-------|----------|-------------|
| `key` | ✅ | Unique identifier for the remote |
| `baseUrl` | ✅ | Base URL of the external service |
| `operations` | — | Declared operations (informational) |
| `auth.appSystemToken.enabled` | — | Include system OAuth token in requests |
| `auth.appUserToken.enabled` | — | Include user OAuth token in requests |

### Endpoints

Endpoints connect UI modules to remotes with optional route prefixes and auth config:

```yaml
modules:
  jira:issuePanel:
    - key: my-panel
      resource: main
      resolver:
        endpoint: my-endpoint    # ← instead of function:
      title: My Panel

  endpoint:
    - key: my-endpoint
      remote: my-backend
      route:
        path: /api/v1
      auth:
        appSystemToken:
          enabled: true

    - key: analytics-endpoint
      remote: analytics
```

| Field | Required | Description |
|-------|----------|-------------|
| `key` | ✅ | Endpoint identifier |
| `remote` | ✅ | Which remote to call (matches `remotes[].key`) |
| `route.path` | — | Path prefix prepended to all requests through this endpoint |
| `auth` | — | Override remote-level auth settings |

### Module Binding

UI modules use `resolver.endpoint` instead of `resolver.function` to bind to a remote:

```yaml
# Traditional (local resolver)
resolver:
  function: my-resolver

# Remote (external backend)
resolver:
  endpoint: my-endpoint
```

When a module has `resolver.endpoint`, bridge calls like `invokeRemote()` automatically resolve to the correct remote and route prefix.

---

## Using Remotes in Your App

### From Backend Code (`@forge/api`)

```typescript
import { invokeRemote } from '@forge/api';

// Direct remote call — specify the remote key
const response = await invokeRemote('my-backend', {
  path: '/api/tasks',
  method: 'GET',
});
const tasks = await response.json();
```

### From Frontend Code (`@forge/bridge`)

```typescript
import { invokeRemote, requestRemote } from '@forge/bridge';

// invokeRemote — uses the module's endpoint for resolution
// Returns a flat response object: { status, statusText, headers, body }
const result = await invokeRemote({
  path: '/tasks',
  method: 'GET',
});
// result.body = [{ id: 1, name: 'Write docs' }]
// result.status, result.statusText, result.headers are also available

// requestRemote — direct call to a specific remote
// Returns a Response-like object
const response = await requestRemote('analytics', {
  path: '/events',
  method: 'POST',
  body: JSON.stringify({ event: 'page_view' }),
});
const data = await response.json();
```

**Key difference:**
- `invokeRemote` resolves through the module's endpoint (route prefix applied, returns a flat response object — the `{ success, payload }` envelope from the underlying transport is unwrapped automatically)
- `requestRemote` calls a remote directly by key (no endpoint resolution, returns Response)

---

## Mock Routes (No Backend Needed)

For testing and development, mock remote responses using the same system as product API mocks:

```typescript
import { createSimulator } from 'forge-sim';

const sim = createSimulator();
await sim.deploy('./my-app');

// Mock remote routes (remote key = mock key)
sim.mockProductRoutes('my-backend', {
  'GET /api/v1/tasks': [
    { id: 1, name: 'Write docs' },
    { id: 2, name: 'Ship feature' },
  ],
  'POST /api/v1/tasks': (path, options) => ({
    id: 3,
    name: JSON.parse(options?.body ?? '{}').name,
  }),
});

// Now invokeRemote hits your mocks
const response = await sim.remotes.invoke('my-backend', { path: '/api/v1/tasks' });
const tasks = await response.json();
// → [{ id: 1, name: 'Write docs' }, { id: 2, name: 'Ship feature' }]
```

**Mock-first routing:** forge-sim checks mock routes before making real HTTP requests. If a mock matches, it's used. If not (returns 501), the request falls through to the real `baseUrl` with FIT auth.

---

## FIT (Forge Invocation Token)

When forge-sim makes a real HTTP request to a remote, it signs a JWT with the following structure:

### Token Header

```json
{
  "alg": "RS256",
  "kid": "forge-sim-1"
}
```

### Token Payload

```json
{
  "iss": "forge-sim",
  "aud": "ari:cloud:ecosystem::app/your-app-id",
  "iat": 1710864000,
  "exp": 1710864300,
  "app": {
    "id": "ari:cloud:ecosystem::app/your-app-id",
    "version": "1.0.0",
    "installationId": "your-app-id/install/cloud-id",
    "environment": {
      "type": "DEVELOPMENT",
      "id": "your-app-id/env/development"
    },
    "module": {
      "type": "jira:issuePanel",
      "key": "my-panel"
    }
  },
  "context": {
    "cloudId": "your-cloud-id",
    "siteUrl": "https://your-site.atlassian.net",
    "moduleKey": "my-panel",
    "localId": "my-endpoint"
  },
  "principal": "user-account-id"
}
```

### Request Headers

Every remote request includes these headers (matching the [Forge Remote Invocation Contract](https://developer.atlassian.com/platform/forge/forge-remote-invocation-contract/)):

| Header | Description |
|--------|-------------|
| `authorization` | `Bearer <FIT JWT>` |
| `x-b3-traceid` | 128-bit hex trace ID |
| `x-b3-spanid` | 64-bit hex span ID |
| `x-forge-oauth-system` | System token placeholder (if `appSystemToken.enabled`) |
| `x-forge-oauth-user` | User token placeholder (if `appUserToken.enabled`) |

---

## JWKS Endpoint

forge-sim serves the FIT public key at a local JWKS endpoint so your backend can validate tokens:

```
http://localhost:5173/__forge/jwks.json
```

This is available in both regular and `--proxy` mode.

### Validating FIT in Your Backend

Your remote backend should:

1. Fetch the JWKS from `/__forge/jwks.json` (or configure the URL)
2. Verify the JWT signature using the public key
3. Check the `aud` claim matches your app ID
4. Check the `exp` claim hasn't passed

Example (Node.js with `jose`):

```typescript
import { createRemoteJWKSet, jwtVerify } from 'jose';

// Point at forge-sim's JWKS endpoint during development
const JWKS = createRemoteJWKSet(
  new URL('http://localhost:5173/__forge/jwks.json')
);

async function validateFIT(request) {
  const token = request.headers.authorization?.replace('Bearer ', '');
  const { payload } = await jwtVerify(token, JWKS, {
    audience: 'ari:cloud:ecosystem::app/your-app-id',
    issuer: 'forge-sim',  // In production, issuer is 'forge'
  });
  return payload; // { app, context, principal, ... }
}
```

### Key Persistence

RSA keys are generated on first use and persisted to `<app>/.forge-sim/fit-keys/`:

```
.forge-sim/fit-keys/
├── private.pem    # RSA private key (signs tokens)
└── jwks.json      # Public JWKS document (served at /__forge/jwks.json)
```

Keys survive restarts, so your backend's JWKS cache remains valid. If keys become corrupt, they're automatically regenerated.

---

## Dev Server Output

When remotes are configured, the dev server shows the JWKS URL:

```
🔥 forge-sim dev server running!

   UIKit 2 mode • jira:issuePanel:my-panel

   ➜ Local:   http://localhost:5173/
   ➜ Tools:   http://localhost:5173/__tools/
   ➜ JWKS:    http://localhost:5173/__forge/jwks.json
   ➜ WS:      ws://localhost:5174
```

---

## Error Handling

| Scenario | Result |
|----------|--------|
| Unknown remote key | 404 with "Unknown remote" listing available remotes |
| Module has no endpoint configured | Error: "has no endpoint configured" |
| No active module and no endpoint key | Error: "requires an endpoint key" listing available endpoints |
| Remote backend unreachable | 502 with connection error details |
| Remote returns non-200 | Error logged, response forwarded to caller |
| FIT not initialized | Error logged, `authorization` header omitted |

---

## Testing Remotes

forge-sim includes comprehensive tests for remotes (`src/__tests__/remotes.test.ts`):

- Manifest parsing: remotes, endpoints, resolver.endpoint on UI modules
- Mock routing: mock-first, multiple independent remotes
- `invokeRemote` from `@forge/api`: mock responses, unknown remote errors
- `invokeRemote` from `@forge/bridge`: endpoint resolution, route prefix application
- `requestRemote` from `@forge/bridge`: direct fetch with FIT
- FIT JWT: valid structure, correct claims, signing, key persistence
- RemoteProxy integration with simulator lifecycle (reset clears manifest)
