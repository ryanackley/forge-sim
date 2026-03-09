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
