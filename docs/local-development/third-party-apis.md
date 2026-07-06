# Talking to third-party APIs

Forge apps can authenticate with external APIs (Google, GitHub, Slack, …) using OAuth 2.0 via `asUser().withProvider()` / `asApp().withProvider()`. forge-sim supports three modes, from zero-setup mocks to the full live OAuth dance.

## 1. Mock mode (default)

No tokens needed. Mock the route by its remote name:

```typescript
sim.mockProductRoutes('google-apis', {
  'GET /userinfo/v2/me': { id: '12345', email: 'test@gmail.com' },
});

// In app code:
import api from '@forge/api';

const response = await api.asUser()
  .withProvider('google', 'google-apis')
  .fetch('/userinfo/v2/me');
```

## 2. Token mode (manual)

Set a token directly — useful for dev tokens from a provider's console:

```typescript
sim.externalAuth.setToken('google', {
  provider: 'google',
  accessToken: 'ya29.your-test-token',
  scopes: ['profile', 'email'],
  account: { id: '12345', displayName: 'test@gmail.com', scopes: ['profile', 'email'] },
});
```

Or via the CLI:

```bash
forge-sim auth --provider google
```

## 3. Live OAuth mode

Run the full 3LO dance against the provider's real endpoints (read from `manifest.yml`).

**Via the Tools UI (recommended when `forge-sim dev` is running):**

1. Open `http://localhost:5173/__tools/` and click the **Providers** tab
2. Click **Connect** on a provider — a popup opens the provider's auth URL
3. After the user grants access, the popup bounces through `/__tools/oauth/callback`, auto-closes, and the panel updates via WebSocket to show ✓ Connected
4. The token is persisted to `~/.forge-sim/credentials.json` under the default Atlassian account

**Via the CLI (when dev isn't running):**

```bash
# Set the client secret once per provider (stored in <app>/.forge-sim/providers.json)
forge-sim auth --provider google --secret

# Authorize — spins up a minimal callback host on port 5173, opens the browser
forge-sim auth --provider google

# Authorize all manifest providers
forge-sim auth --providers

# Check status
forge-sim auth --providers --list
```

If `forge-sim dev` is already running on 5173, the CLI exits with a clear error and points at the Tools UI Providers panel — both flows would otherwise race for the same port.

## Unified callback URL

Every external provider uses the same redirect URI:

```
http://localhost:5173/__tools/oauth/callback
```

Set this in each provider's developer console. The callback is dispatched to the right pending flow by the `state` parameter — multiple concurrent flows (e.g. two browser tabs, two providers) settle independently.

## Manifest configuration

forge-sim reads provider config directly from `manifest.yml`:

```yaml
providers:
  auth:
    - key: google
      name: Google
      type: oauth2
      clientId: YOUR_CLIENT_ID
      scopes:
        - profile
        - email
      remotes:
        - google-apis
      bearerMethod: authorization-header
      actions:
        authorization:
          remote: google-account
          path: /o/oauth2/v2/auth
        exchange:
          remote: google-oauth
          path: /token
        retrieveProfile:
          remote: google-apis
          path: /userinfo/v2/me
          resolvers:
            id: id
            displayName: email

remotes:
  - key: google-apis
    baseUrl: https://www.googleapis.com
  - key: google-account
    baseUrl: https://accounts.google.com
  - key: google-oauth
    baseUrl: https://oauth2.googleapis.com
```

## Priority order

When `withProvider().fetch()` is called:

1. **Mock routes** — checked first (same as the [Atlassian API pattern](./atlassian-apis.md))
2. **Real HTTP + token** — if a valid token exists and no mock matched
3. **501 Unmocked** — if neither mock nor token exists

This means you can mock specific endpoints while using real tokens for everything else.

## Token refresh

External provider tokens with `expiresAt` and a `refreshToken` are refreshed automatically before each request via `ExternalAuthStore.ensureValidToken()`. The refresh action is read from the provider's manifest entry (`actions.refreshToken`). Tokens without expiry just keep working.

## Where things are stored

| File | Contents |
|------|----------|
| `<app>/.forge-sim/providers.json` | Provider client secrets (per-project, `0600`) |
| `~/.forge-sim/credentials.json` | Third-party tokens (in the `thirdParty` field, keyed by account) |

Provider secrets are per-project because `clientId` comes from the manifest, which varies per app. Full credential-management reference: [Credentials](./credentials.md).
