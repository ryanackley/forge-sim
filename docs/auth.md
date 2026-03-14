# Authentication

forge-sim can connect to real Atlassian APIs so `requestJira()`, `requestConfluence()`, and `requestBitbucket()` return live data from your site.

## API Token (recommended)

The simplest way to connect. Takes about 30 seconds:

```bash
forge-sim auth
```

You'll be prompted for:
1. **Atlassian site** — e.g., `mysite.atlassian.net`
2. **Email** — your Atlassian account email
3. **API token** — create one at [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)

forge-sim validates your credentials by calling `/rest/api/3/myself` and automatically detects your Cloud ID.

## OAuth 2.0 (multi-user testing)

For testing with multiple user accounts or specific permission scopes:

```bash
# First time: register your OAuth app
forge-sim auth --setup

# Then add accounts via browser-based OAuth
forge-sim auth --oauth
```

**OAuth app setup:**
1. Go to [developer.atlassian.com/console/myapps](https://developer.atlassian.com/console/myapps/)
2. Create an OAuth 2.0 (3LO) app
3. Set callback URL: `http://localhost:5173/__tools/oauth/callback`
4. Add Jira and/or Confluence API permissions
5. Copy Client ID and Secret into `forge-sim auth --setup`

## Managing Accounts

```bash
forge-sim auth              # Add account or switch default
forge-sim auth --list       # List all configured accounts
forge-sim auth --remove ID  # Remove a specific account
forge-sim auth --clear      # Remove all accounts (keeps OAuth app config)
forge-sim auth --clear-all  # Remove everything (accounts + OAuth app config)
forge-sim auth --local      # Store credentials per-app instead of global
```

## How It Works

When `forge-sim dev` starts, it checks for stored credentials and automatically connects:

```
📡 Connected to real APIs as Ryan Ackley @ mysite.atlassian.net
```

If no credentials exist, it falls back to mock APIs:

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

## Credential Storage

| File | Contents |
|------|----------|
| `~/.forge-sim/config.json` | OAuth app config (Client ID/Secret) |
| `~/.forge-sim/credentials.json` | User accounts and tokens |
| `<app>/.forge-sim/credentials.json` | Per-app override (with `--local`) |

All credential files are created with `0600` permissions (owner read/write only).

## External Auth (Third-Party OAuth)

Forge apps can authenticate with external APIs (Google, GitHub, Slack, etc.) using OAuth 2.0 via `asUser().withProvider()`. forge-sim supports this through three modes:

### Mock Mode (default)

No tokens needed. Use mock routes to simulate external API responses:

```typescript
sim.mockProductRoutes('google-apis', {
  'GET /userinfo/v2/me': { id: '12345', email: 'test@gmail.com' },
});

// In your app code:
const response = await api.asUser()
  .withProvider('google', 'google-apis')
  .fetch('/userinfo/v2/me');
```

The remote name from your manifest (`google-apis`) is the mock route key. Same mock system as `requestJira()`.

### Token Mode (manual)

Set a token directly (e.g., from a provider's dev console) and forge-sim injects it as a Bearer header on real HTTP requests:

```typescript
// Via the simulator
sim.externalAuth.setToken('google', {
  provider: 'google',
  accessToken: 'ya29.your-test-token',
  scopes: ['profile', 'email'],
  account: { id: '12345', displayName: 'test@gmail.com', scopes: ['profile', 'email'] },
});
```

Or set tokens via the CLI before running:

```bash
forge-sim auth --provider google
```

### Live OAuth Mode

Run the full OAuth 3LO dance against the provider's real endpoints (read from your `manifest.yml`):

```bash
# Set up the client secret (one-time per provider)
forge-sim auth --provider google --secret

# Authorize (opens browser, handles callback)
forge-sim auth --provider google

# Authorize all providers in the manifest at once
forge-sim auth --providers

# Check auth status for all providers
forge-sim auth --providers --list
```

This reads the `providers.auth` and `remotes` sections from your manifest to build the authorization URL, exchange tokens, and retrieve profiles — exactly like Forge does in production.

### Manifest Configuration

forge-sim reads provider config directly from your `manifest.yml`:

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

### Provider Credential Storage

| File | Contents |
|------|----------|
| `<app>/.forge-sim/providers.json` | Provider client secrets (per-project, `0600`) |
| `<app>/.forge-sim/credentials.json` | Third-party tokens (in `thirdParty` field) |

Provider secrets are always per-project because `clientId` comes from the manifest (which varies per app). Add `.forge-sim/` to your `.gitignore`.

### Priority Order

When `withProvider().fetch()` is called:

1. **Mock routes** — checked first (same as product API pattern)
2. **Real HTTP + token** — if a valid token exists and no mock matched
3. **501 Unmocked** — if neither mock nor token exists

This means you can mock specific endpoints while using real tokens for everything else.

## Environment Variables

For CI/CD or non-interactive environments:

```bash
# API Token
export FORGE_SIM_SITE=mysite.atlassian.net
export FORGE_SIM_EMAIL=user@example.com
export FORGE_SIM_API_TOKEN=ATATT3x...

# OAuth (alternative)
export FORGE_SIM_OAUTH_CLIENT_ID=your-client-id
export FORGE_SIM_OAUTH_CLIENT_SECRET=your-client-secret
```
