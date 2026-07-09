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

## Authorization Flow

**Automatically:**
Any call to `withProvider().requestCredentials` will launch your default browser to initiate the oauth flow

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
