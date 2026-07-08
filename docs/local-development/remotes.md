# Talking to your remote backend (Forge Remotes)

If your app calls its own backend with `invokeRemote()` / `requestRemote()`, forge-sim does what production Forge does: resolves the endpoint from your manifest, signs a **FIT** (Forge Invocation Token) JWT, and sends the request to your remote's `baseUrl` with the FIT as a Bearer token. Your manifest and app code run unmodified.

This page covers only what's *different* when the platform is running on your laptop. For remotes concepts, manifest configuration, and the `@forge/api` / `@forge/bridge` call APIs, see the [official Forge Remote docs](https://developer.atlassian.com/platform/forge/remote/).

---

## The hard part: where your backend fetches the JWKS

In production, your backend validates the FIT against Atlassian's public JWKS. Locally, forge-sim signs with its own key and serves the matching JWKS at:

```
http://localhost:5173/__forge/jwks.json
```

So the one real integration task is pointing your backend's JWT validation at that URL (and accepting the dev issuer). There are two cases.

### Backend running locally

Point your JWKS fetcher at localhost and accept `iss: 'forge-sim'`:

```typescript
import { createRemoteJWKSet, jwtVerify } from 'jose';

// Point at forge-sim's JWKS endpoint during development
const JWKS = createRemoteJWKSet(
  new URL('http://localhost:5173/__forge/jwks.json')
);

async function validateFIT(request: { headers: { authorization?: string } }) {
  const token = request.headers.authorization?.replace('Bearer ', '') ?? '';
  const { payload } = await jwtVerify(token, JWKS, {
    audience: 'ari:cloud:ecosystem::app/your-app-id',
    issuer: 'forge-sim',  // In production, issuer is 'forge'
  });
  return payload; // { app, context, principal, ... }
}
```

Make the JWKS URL and issuer configurable (environment variables) so the same code validates against Atlassian in production.

### Backend deployed remotely (ngrok)

If your backend is already deployed somewhere (Azure Functions, Lambda, a VPS), the *outbound* leg already works — forge-sim reaches your backend's public `baseUrl` just fine. What breaks is the *inbound* leg: your deployed backend can't fetch a JWKS from your `localhost`.

Tunnel it:

```bash
ngrok http 5173
```

Then set your backend's JWKS URL to the tunnel:

```
https://<your-tunnel>.ngrok.app/__forge/jwks.json
```

Any tunnel works (cloudflared, Tailscale Funnel, …) — ngrok is just the shortest path. The tunnel only needs to expose the JWKS route; it doesn't route your app's traffic.

---

## What forge-sim sends

Each real HTTP request to a remote carries the headers from the [Forge Remote Invocation Contract](https://developer.atlassian.com/platform/forge/forge-remote-invocation-contract/): `authorization: Bearer <FIT>`, `x-b3-traceid` / `x-b3-spanid`, and — when the manifest's `auth` block enables them — `x-forge-oauth-system` / `x-forge-oauth-user`. An endpoint-level `auth` overrides the remote-level setting, same as production.

Differences from production:

| | Production Forge | forge-sim |
|---|---|---|
| `iss` claim | `forge` | `forge-sim` |
| Signing key / `kid` | Atlassian-managed | local RSA key, `kid: forge-sim-1` |
| JWKS location | Atlassian's public JWKS | `http://localhost:5173/__forge/jwks.json` |
| `x-forge-oauth-*` values | real OAuth tokens | placeholders — but **presence/absence matches production**, so backends that branch on whether the header is set behave correctly |

Everything else in the FIT — `aud`, `exp`, `app` (id, version, installation, environment, module), `context` (cloudId, siteUrl, moduleKey, localId), `principal` — is populated with your app's simulated values, so claims-based logic in your backend exercises the same code paths.

### Key persistence

The RSA keypair is generated on first use and persisted to `<app>/.forge-sim/fit-keys/` (`private.pem` + `jwks.json`). Keys survive restarts, so your backend's JWKS cache stays valid. Corrupt keys are regenerated automatically.

---

## Endpoint resolution

Quick orientation: `invokeRemote()` resolves through the calling module's endpoint (route prefix applied); `requestRemote()` calls a remote directly by key. The sim-specific part is how `invokeRemote()` picks an endpoint when there isn't an obvious one:

1. **From module context** — when the call originates inside a UI module whose manifest has `resolver.endpoint: <key>`, that key is used automatically. No argument needed.
2. **Single-endpoint auto-resolve** — when there's no module context (e.g. an MCP-driven invoke or a test helper) and the manifest declares **exactly one** endpoint, forge-sim picks it and logs a notice. This is the parity rule: an unambiguous app should "just work" without ceremony.
3. **Explicit failure** — when neither rule applies, the call throws with a message that lists every endpoint declared in the manifest:

   ```
   invokeRemote requires an endpoint key. The calling module must have
   resolver.endpoint configured in the manifest.
   Available endpoints: my-endpoint, analytics-endpoint
   ```

If you pass an endpoint key that isn't in the manifest, you get:

```
Unknown endpoint "typo-endpoint". Available endpoints: my-endpoint, analytics-endpoint
```

Endpoint keys are scoped to the app, not to a particular module — a module without `resolver.endpoint` in its own manifest entry still falls back to the single-endpoint auto-resolve rule when there's only one to choose.

---

## Mock routes (no backend needed)

In automated tests and MCP sessions, mock remote responses using the same system as product API mocks. This isn't available in `forge-sim dev` — there, remote calls always go to the real `baseUrl`:

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
  'POST /api/v1/tasks': (path: string, options?: { body?: string }) => ({
    id: 3,
    name: JSON.parse(options?.body ?? '{}').name,
  }),
});

// Now invokeRemote hits your mocks
const response = await sim.remotes.invoke('my-backend', { path: '/api/v1/tasks' });
const tasks = await response.json();
// → [{ id: 1, name: 'Write docs' }, { id: 2, name: 'Ship feature' }]
```

**Mock-first routing:** forge-sim checks mock routes before making real HTTP requests. If a mock matches, it's used. If not, the request falls through to the real `baseUrl` with FIT auth.

---

## Dev server output

When remotes are configured, the dev server prints the JWKS URL:

```
🔥 forge-sim dev server running!

   UIKit 2 mode • jira:issuePanel:my-panel

   ➜ Local:   http://localhost:5173/
   ➜ Tools:   http://localhost:5173/__tools/
   ➜ JWKS:    http://localhost:5173/__forge/jwks.json
   ➜ WS:      ws://localhost:5174
```

The JWKS endpoint is available in both regular and `--proxy` mode.

---

## Error handling

| Scenario | Result |
|----------|--------|
| Unknown remote key | 404 with "Unknown remote" listing available remotes |
| Module has no endpoint configured | Error: "has no endpoint configured" |
| No active module and no endpoint key | Error: "requires an endpoint key" listing available endpoints |
| Remote backend unreachable | 502 with connection error details |
| Remote returns non-200 | Error logged, response forwarded to caller |
| FIT not initialized | Error logged, `authorization` header omitted |
