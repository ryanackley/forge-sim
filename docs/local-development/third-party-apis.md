# Talking to third-party APIs

Forge apps can authenticate with external APIs (Google, GitHub, Slack, …) using OAuth 2.0 via `asUser().withProvider()` / `asApp().withProvider()`.

The Forge platform has built-in mechanics to support OAuth. Forge-sim mimics these so you can use these locally. They require some configuration similar to what you would do in forge.

## Configuration

First, you'll need to set the provider's client secret

```bash
# Set the client secret once per provider (stored in <app>/.forge-sim/providers.json)
forge-sim auth --provider google --secret
```

Then you'll need to add the forge-sim OAuth callback url in the provider's developer console.

```
http://localhost:5173/__tools/oauth/callback
```

## What the sim loads

The manifest's `providers.auth` entries are loaded whenever a manifest reaches the simulator: `sim.deploy()` in a test, MCP `forge_deploy`, `forge-sim dev` and `sim.loadManifest()` alike. They are what the real `@forge/api` builds `withProvider()` from, so a provider missing from the manifest fails at construction with "Bad provider or missing config", exactly as on Forge. A redeploy that removes a provider removes it; stored tokens for providers still declared survive the redeploy.

## Request URL and bearer method

A `withProvider(provider, remote).fetch(path)` call goes to the remote's `baseUrl` with the fetch API's rule: a path starting with `/` replaces the base URL's path, any other path is appended to it. The provider's `bearerMethod` decides how the token travels, per the providers reference: `authorization-header` (the default) puts `Bearer <token>` in `Authorization`, the advanced object form sets its own `prefix` and `parameter`, `form-encoded` (deprecated) puts `access_token` in a form-encoded request body, and `uri-query` (deprecated) adds it as a query parameter.

`hasCredentials()` answers true only for a token that is usable: unexpired, or expired with a refresh token, a client secret and a refresh endpoint to use it, which is what the automatic refresh needs. An expired token with no way to refresh reads as no credentials, so `fetch()` fails client-side with "no credentials previously requested" rather than reaching the provider.

## Authorization Flow

**From app code:** nothing. `withProvider().requestCredentials()` behaves exactly as in Forge: it rejects with `NeedsAuthenticationError`, because in production the frontend drives the consent prompt off that error. The sim renders no consent button: the resolver's invocation rejects with that error, and the sim log says which provider asked and how to authorize it. Authorizing a provider locally is a sim-side action, done one of the two ways below.

**Via the Tools UI:**

1. Open `http://localhost:5173/__tools/` and click the **Providers** tab
2. Click **Connect** on a provider; a popup opens the provider's auth URL
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

## Unified callback URL

Every external provider uses the same redirect URI:

```
http://localhost:5173/__tools/oauth/callback
```

Set this in each provider's developer console. The callback is dispatched to the right pending flow by the `state` parameter. Multiple concurrent flows (e.g. two browser tabs, two providers) settle independently.

## Token refresh

External provider tokens with `expiresAt` and a `refreshToken` are refreshed automatically before each request via `ExternalAuthStore.ensureValidToken()`. The refresh action is read from the provider's manifest entry (`actions.refreshToken`). Tokens without expiry just keep working.

## Where things are stored


| File                              | Contents                                                        |
| --------------------------------- | --------------------------------------------------------------- |
| `<app>/.forge-sim/providers.json` | Provider client secrets (per-project,`0600`)                    |
| `~/.forge-sim/credentials.json`   | Third-party tokens (in the`thirdParty` field, keyed by account) |

Provider secrets are per-project because `clientId` comes from the manifest, which varies per app. Full credential-management reference: [Credentials](./credentials.md).
