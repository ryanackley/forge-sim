# Talking to Atlassian APIs

Connect a real Atlassian site and `requestJira()`, `requestConfluence()`, and `requestBitbucket()` return live data in `forge-sim dev`. Without a connected site, product API calls fail with a `501` that says exactly that.

## Connect your site (PAT)

```bash
forge-sim auth
```

You'll be prompted for:
1. **Atlassian site** — e.g., `mysite.atlassian.net`
2. **Email** — your Atlassian account email
3. **API token** — create one at [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)

forge-sim validates by calling `/rest/api/3/myself` and detects your Cloud ID automatically. The token is stored in `~/.forge-sim/credentials.json` (mode `0600`); see [Credentials](./credentials.md) for storage details, multiple accounts, and CI environment variables.


### Auth header

```
Authorization: Basic base64(email:token)
```

PAT requests go straight to `https://{site}/...`, with no `api.atlassian.com` gateway involved. GraphQL hits `{site}/gateway/api/graphql`.

## How it works

When `forge-sim dev` starts, it loads stored credentials and connects automatically:

```
📡 Connected to real APIs as Ryan Ackley @ mysite.atlassian.net
```

