# Local development

Run an unmodified Forge app on your machine with `forge-sim dev`. It serves your UIKit and Custom UI modules, simulates the backend services (functions, queues, consumers, SQL, KVS), and gives you a browsable index of every UI module in the app.

```bash
cd /path/to/forge/app
npx forge-sim dev
```

For the full command and its flags (module selection, context injection, ports, `--clean`, theme), see the [CLI reference](../reference/cli.md#forge-sim-dev).

## In this section

- [Authentication](./auth.md) — connect your Atlassian site (PAT), configure the LLM key, and authorize third-party OAuth providers.
- [Forge Remotes](./remotes.md) — call your own backend with `invokeRemote()` / `requestRemote()`, FIT JWT signing, and the local JWKS endpoint.
- [Dev tools UI](./dev-tools.md) — the KVS browser, SQL console, log viewer, and event triggers served at `/__tools/`.

## Connect to your Atlassian site

```bash
npx forge-sim auth
```

Enter your site URL, email, and [API token](https://id.atlassian.com/manage-profile/security/api-tokens). After that, `requestJira()`, `requestConfluence()`, and `requestBitbucket()` hit your real site. See [Authentication](./auth.md) for managing multiple accounts, credential storage, and the LLM key.

## Custom UI and proxy mode

Custom UI pages that are already bundled and referenced in your manifest work out of the box — forge-sim serves them and injects the `@forge/bridge` shim.

While developing, you'll usually run your Custom UI through its own webpack/Vite/Parcel dev server so you get hot reload. Point forge-sim at it with `--proxy`:

```bash
# Start your dev server as usual
cd my-custom-ui-app && npm start  # → http://localhost:3000

# In another terminal, proxy it through forge-sim
npx forge-sim dev --proxy http://localhost:3000
```

forge-sim sits in front of your dev server and hosts it in an iframe with shimmed Forge APIs, so HMR and Chrome DevTools keep working.

*🎬 Demo video placeholder — proxy mode: Vite dev server running, `forge-sim dev --proxy`, Custom UI inside the simulated Forge frame with HMR.*

<!-- TODO(demo): record proxy-mode demo and replace the line above. To embed on GitHub, edit this file on github.com and drag the .mp4/.mov in. -->

## Forge Remotes

If your app calls your own backend via `invokeRemote()` or `requestRemote()`, forge-sim signs each request with a real FIT (Forge Invocation Token) JWT and serves a local JWKS endpoint your backend can validate against. See [Forge Remotes](./remotes.md) for the manifest configuration, FIT claims, key persistence, backend validation, and mock routing.

## External auth providers

If your app uses `asUser().withProvider()` for third-party OAuth (Google, GitHub, and so on), authorize the providers declared in your manifest:

```bash
npx forge-sim auth --provider google   # one provider
npx forge-sim auth --providers         # all providers in the manifest
```

See [Authentication — External Auth](./auth.md#external-auth-third-party-oauth) for the client-secret setup and credential storage.
