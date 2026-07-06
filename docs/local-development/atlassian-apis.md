# Talking to Atlassian APIs

Out of the box, `requestJira()`, `requestConfluence()`, and `requestBitbucket()` run against forge-sim's mock layer. Connect a real Atlassian site and they return live data instead — mock-first, real-API fallback.

## Connect your site (PAT)

```bash
forge-sim auth
```

You'll be prompted for:
1. **Atlassian site** — e.g., `mysite.atlassian.net`
2. **Email** — your Atlassian account email
3. **API token** — create one at [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)

forge-sim validates by calling `/rest/api/3/myself` and detects your Cloud ID automatically. The token is stored in `~/.forge-sim/credentials.json` (mode `0600`) — see [Credentials](./credentials.md) for storage details, multiple accounts, and CI environment variables.

> **Atlassian OAuth was removed.** PAT setup is 30s; OAuth was a 5-minute developer-app registration dance whose only unique capability was scope-restricted tokens, which forge-sim doesn't enforce locally. Multi-user testing is solved by multiple PATs (one per user/account).
>
> If you have a legacy `authType: 'oauth'` account in `~/.forge-sim/credentials.json`, the next `forge-sim auth` run drops it with a warning. Re-add as a PAT.

### Auth header

```
Authorization: Basic base64(email:token)
```

PAT requests go straight to `https://{site}/...` — no `api.atlassian.com` gateway involved. GraphQL hits `{site}/gateway/api/graphql`.

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

This is the pattern for the whole integration surface: mocks win when registered, everything else falls through to your connected site, and with no site connected an unmocked call fails loudly with a `501` that names the fix.
