# Authentication

forge-sim can connect to real Atlassian APIs so `requestJira()`, `requestConfluence()`, and `requestBitbucket()` return live data from your site. External providers (Google, GitHub, Slack, …) are also supported via OAuth.

## Atlassian (PAT only)

```bash
forge-sim auth
```

You'll be prompted for:
1. **Atlassian site** — e.g., `mysite.atlassian.net`
2. **Email** — your Atlassian account email
3. **API token** — create one at [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)

forge-sim validates by calling `/rest/api/3/myself` and detects your Cloud ID automatically. The token is stored in `~/.forge-sim/credentials.json` (mode `0600`).

> **Atlassian OAuth was removed.** PAT setup is 30s; OAuth was a 5-minute developer-app registration dance whose only unique capability was scope-restricted tokens, which forge-sim doesn't enforce locally. Multi-user testing is solved by multiple PATs (one per user/account).
>
> If you have a legacy `authType: 'oauth'` account in `~/.forge-sim/credentials.json`, the next `forge-sim auth` run drops it with a warning. Re-add as a PAT.

### Auth header

```
Authorization: Basic base64(email:token)
```

PAT requests go straight to `https://{site}/...` — no `api.atlassian.com` gateway involved. GraphQL hits `{site}/gateway/api/graphql`.

## Managing accounts

```bash
forge-sim auth                # Add account or switch default
forge-sim auth --list         # List configured accounts + LLM key status
forge-sim auth --remove ID    # Remove a specific account
forge-sim auth --clear        # Remove all credentials (service config preserved)
forge-sim auth --clear-all    # Remove credentials AND service config
forge-sim auth --local        # Store credentials per-app instead of global
forge-sim auth --llm          # Configure Anthropic API key (for @forge/llm)
```

## How it works

When `forge-sim dev` starts, it loads stored credentials and connects automatically:

```
📡 Connected to real APIs as Ryan Ackley @ mysite.atlassian.net
```

If no credentials exist, mock APIs are used:

```
📡 No Atlassian accounts — using mock APIs
   Run 'forge-sim auth' to connect to a real site
```

**Mock routes take priority** — you can mock specific endpoints while using real APIs for everything else:

```typescript
sim.mockProductRoutes('jira', {
  'POST /rest/api/3/issue': { id: '10001', key: 'TEST-1' },
});
```

## Credential storage

| File | Contents |
|------|----------|
| `~/.forge-sim/credentials.json` | Atlassian PAT accounts + third-party tokens (`0600`) |
| `~/.forge-sim/config.json` | Service config (Anthropic API key, future settings) |
| `<app>/.forge-sim/credentials.json` | Per-app override (`--local`) |
| `<app>/.forge-sim/providers.json` | External provider client secrets (`0600`) |

Add `.forge-sim/` to your `.gitignore`.

## Environment variables

For CI/CD or non-interactive environments:

```bash
export FORGE_SIM_SITE=mysite.atlassian.net
export FORGE_SIM_EMAIL=user@example.com
export FORGE_SIM_PAT=ATATT3x...
```

Per-provider third-party tokens:

```bash
export FORGE_SIM_PROVIDER_GOOGLE_APIS_TOKEN=ya29.your-test-token
# Convention: FORGE_SIM_PROVIDER_<KEY_UPPERCASE_WITH_UNDERSCORES>_TOKEN
```

Anthropic key (for `@forge/llm`):

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

---

## External Auth (Third-Party OAuth)

Forge apps can authenticate with external APIs (Google, GitHub, Slack, …) using OAuth 2.0 via `asUser().withProvider()` / `asApp().withProvider()`. forge-sim supports three modes.

### 1. Mock mode (default)

No tokens needed. Mock the route by its remote name:

```typescript
sim.mockProductRoutes('google-apis', {
  'GET /userinfo/v2/me': { id: '12345', email: 'test@gmail.com' },
});

// In app code:
const response = await api.asUser()
  .withProvider('google', 'google-apis')
  .fetch('/userinfo/v2/me');
```

### 2. Token mode (manual)

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

### 3. Live OAuth mode

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

### Unified callback URL

Every external provider uses the same redirect URI:

```
http://localhost:5173/__tools/oauth/callback
```

Set this in each provider's developer console. The callback is dispatched to the right pending flow by the `state` parameter — multiple concurrent flows (e.g. two browser tabs, two providers) settle independently.

### Manifest configuration

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

### Provider credential storage

| File | Contents |
|------|----------|
| `<app>/.forge-sim/providers.json` | Provider client secrets (per-project, `0600`) |
| `~/.forge-sim/credentials.json` | Third-party tokens (in the `thirdParty` field, keyed by account) |

Provider secrets are per-project because `clientId` comes from the manifest, which varies per app.

### Priority order

When `withProvider().fetch()` is called:

1. **Mock routes** — checked first (same as product API pattern)
2. **Real HTTP + token** — if a valid token exists and no mock matched
3. **501 Unmocked** — if neither mock nor token exists

This means you can mock specific endpoints while using real tokens for everything else.

### Token refresh (external providers)

External provider tokens with `expiresAt` and a `refreshToken` are refreshed automatically before each request via `ExternalAuthStore.ensureValidToken()`. The refresh action is read from the provider's manifest entry (`actions.refreshToken`). Tokens without expiry just keep working.
