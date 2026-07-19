# Local development

Run an unmodified Forge app for development that is completely local to your machine with `forge-sim dev`. It serves your UIKit and Custom UI modules and simulates the backend services (functions, queues, consumers, SQL, KVS).

Iterate faster by not having to deploy to Atlassian's servers to test every change.

```bash
cd /path/to/forge/app
forge-sim dev
```

For the full command and its flags (module selection, context injection, ports, `--clean`, theme), see the [CLI reference](../reference/cli.md#forge-sim-dev).

## Running the dev server

Starting `forge-sim dev` opens a browser tab with the **module index**, every UI module declared in your manifest, with its type and title:

![Module index — every UI module in the manifest, ready to render](../media/dev-module-index.png)

Click a module to render it outside of Atlassian products, with the module's Forge context simulated (issue, project, space; injectable via CLI flags). UIKit modules render through real Atlaskit components, backed by your real resolvers running against the simulated backend. Edits hot-reload, and Chrome DevTools debugs your actual source:

![A UIKit module rendering live: real Atlaskit components, real resolver data](../media/dev-uikit-module.png)

The example above works end-to-end locally: The UIKit interface renders AtlasKit components, the Add buttons push events onto Forge queues, consumers process them, and the board re-renders from KVS. The full async loop, locally.

The **dev tools UI** at `http://localhost:5173/__tools/` is a window into the simulated backend. The log viewer below shows that same app booting: queue consumers registering, resolvers invoked with payloads and return values, and the app's own `console.log` output captured inline. Other tabs give you a KVS browser, SQL console, event trigger panel, OAuth provider connections, and TypeScript diagnostics:

![Dev tools — consumer registrations, resolver invocations, and captured console output](../media/dev-tools-logs.png)

See [Dev tools UI](./dev-tools.md) for the full walkthrough.

## The ⚙️ gear menu: preview width and color mode

Every rendered UIKit module gets a small **`⚙️ forge-sim`** button pinned to the bottom-right corner. Click it to open the render settings popover. It's dev-only chrome: not part of your app, and it never appears in a real Forge render.

### Color mode

Switch between **Light**, **Dark**, and **Auto**. Auto follows your OS `prefers-color-scheme` setting (the button shows which mode it currently resolves to). This drives Atlaskit's real theming machinery (the correct theme stylesheet is loaded and every design token flips), so your module renders exactly as it would in Jira or Confluence with the user's theme set to dark. Great for catching hardcoded colors that ignore design tokens.

The choice persists across restarts (stored in browser `localStorage`) and applies to all modules.

> Custom UI modules theme differently: real Forge passes `?theme=dark|light` on the iframe URL, and forge-sim matches that contract; see [Theme in the CLI reference](../reference/cli.md#theme-dark--light).

### Preview width

Forge modules render at very different widths depending on where they live in the product: an issue panel gets a narrow column while a global page gets most of the viewport. The width presets mirror the real surface widths:

| Preset | Width | Matches |
|--------|-------|---------|
| **Narrow** | ~700px | Issue panels, modals |
| **Standard** | ~900px | Full-page apps |
| **Wide** | ~1280px | Global / project pages |
| **Full width** | 100% | Dashboards, edge cases |
| **Custom** | your call | Pixel input (200–4000) |

forge-sim picks a sensible default from the module's type (`jira:issuePanel` starts narrow, `jira:globalPage` starts wide, `jira:dashboardGadget` starts full) and marks that preset with a **• module default** badge in the menu. Override it freely; your choice is remembered **per module**, so your issue panel and your admin page each keep their own width.

The popover footer shows the detected module type so you can confirm which default applied.

## Custom UI and proxy mode

Custom UI pages that are already bundled and referenced in your manifest work out of the box; forge-sim serves them and injects the `@forge/bridge` shim.

While developing, you'll usually run your Custom UI through its own webpack/Vite/Parcel dev server so you get hot reload. Point forge-sim at it with `--proxy`:

```bash
# Start your dev server as usual
cd my-custom-ui-app && npm start  # → http://localhost:3000

# In another terminal, proxy it through forge-sim
forge-sim dev --proxy http://localhost:3000
```

forge-sim sits in front of your dev server and hosts it in an iframe with shimmed Forge APIs, so HMR and Chrome DevTools keep working.

*🎬 Demo video placeholder — proxy mode: Vite dev server running, `forge-sim dev --proxy`, Custom UI inside the simulated Forge frame with HMR.*

<!-- TODO(demo): record proxy-mode demo and replace the line above. To embed on GitHub, edit this file on github.com and drag the .mp4/.mov in. -->

## Atlassian, third party APIs, and remotes

Real apps integrate with things: Atlassian's own APIs, third-party services, your own backend. forge-sim supports all three:

- **[Talking to Atlassian APIs](./atlassian-apis.md)** — connect your real site with a PAT so `requestJira()` / `requestConfluence()` / `requestBitbucket()` return live data.
- **[Talking to third-party APIs](./third-party-apis.md)** — `asUser().withProvider()` OAuth against Google, GitHub, Slack, …: manual tokens or the full live OAuth flow.
- **[Talking to your remote backend](./remotes.md)** — Forge Remotes.

Credential plumbing shared by all three (account management, storage locations, CI environment variables, the LLM key) lives in the [Credentials](./credentials.md) appendix.

## File-based mocks: `.forge-sim/mocks.json`

Without a connected real site, unmocked product API calls return a `501`. You can register mocks at runtime from the dev tools UI or its HTTP API, but anything that runs **during boot** (deploy-time scheduled triggers, resolver warm-up paths) executes before you get the chance. For those, put mocks in a file and they're applied *before* the initial deploy:

```json
// <your-app>/.forge-sim/mocks.json
{
  "jira": {
    "GET /rest/api/3/myself": { "accountId": "abc-123" },
    "PUT /rest/api/3/issue/FAIL-1": {
      "__forgeSimMockResponse": true,
      "status": 500,
      "body": { "error": "rate limited" }
    }
  },
  "graphql": {
    "GetIssue": { "data": { "issue": { "key": "TEST-1" } } }
  }
}
```

- **Top-level keys** are product names (`jira`, `confluence`, `bitbucket`, or a remote key from your manifest); values are route maps in the same shape as the runtime mock APIs. Route keys are `"METHOD /path"` (method defaults to `GET`); path matching is prefix-based.
- A **bare JSON object** value is returned as a `200` response body. Use the tagged `{ "__forgeSimMockResponse": true, "status": ..., "body": ..., "headers": ... }` shape to control status and headers.
- The reserved key **`graphql`** maps GraphQL operation names to response bodies (`"*"` is a catch-all).
- The file is **hot-reloaded** on save. Reloads *merge* into the live mock tables (same semantics as every other mock call), so editing a route's value takes effect immediately — but *deleting* a route from the file doesn't un-mock it until the dev server restarts.
- JSON can't express function-valued (per-request) handlers; for dynamic responses use the [programmatic API](../testing/) in tests.
- When a real account is connected, mocked routes always win over passthrough — the file is an easy way to pin specific calls local while everything else hits your real site.

## App environment variables

Forge apps read configuration from `process.env` (set in production via `forge variables set`). forge-sim injects variables **at deploy time, before handler modules load**, from two sources:

- **`<your-app>/.forge-sim/variables.json`** — re-read at every deploy (including hot-redeploys in dev mode):

  ```json
  {
    "MY_KEY": "value",
    "SECRET": { "value": "s3cret", "encrypt": true }
  }
  ```

- **Host environment variables prefixed `FORGE_USER_VAR_`** — `FORGE_USER_VAR_MY_KEY=x forge-sim dev` exposes `process.env.MY_KEY` to your app. This is the same convention `forge tunnel` uses, so a tunnel-ready environment works unchanged. `variables.json` wins when both define a key.

Matching real Forge: changes take effect at the **next deploy** (in dev mode, saving an app file triggers one), and `encrypt` only masks the value in list surfaces; your app always reads cleartext from `process.env`.

For tests, use `sim.setVariables()` before `sim.deploy()`; see the [API reference](../reference/api.md#environment-variables).

## Debugging

### Frontend: Chrome DevTools just works

UI modules run in the browser as regular source-mapped code. Open DevTools, set breakpoints in your `.tsx`/`.jsx` files, and use React DevTools as usual; there is nothing to configure. This applies to UIKit modules rendered by the dev server and to Custom UI, in both served and `--proxy` mode.

### Backend: attach VS Code to `forge-sim dev`

Resolvers, triggers, and consumers run inside the `forge-sim dev` Node process. forge-sim transpiles and bundles backend code with inline source maps, so once a debugger is attached, breakpoints bind in your original `.ts`/`.tsx`/`.jsx` source.

The zero-config way is VS Code's **JavaScript Debug Terminal**: open one (Command Palette → "Debug: JavaScript Debug Terminal"), run `forge-sim dev` in it, and set breakpoints in your resolver source. The debugger auto-attaches; invoking a resolver from the browser stops on the breakpoint. This works with a global install, no `launch.json` needed.

Prefer F5? Add a launch configuration (this path requires forge-sim installed as a dev dependency):

```json
{
  "name": "forge-sim dev",
  "type": "node",
  "request": "launch",
  "program": "${workspaceFolder}/node_modules/forge-sim/dist/cli.js",
  "args": ["dev"],
  "runtimeArgs": ["--enable-source-maps"],
  "cwd": "${workspaceFolder}",
  "console": "integratedTerminal",
  "skipFiles": ["<node_internals>/**"]
}
```

`--enable-source-maps` is optional; it makes error stack traces printed by the dev server point at your TypeScript source instead of transpiled code.

For debugging automated tests rather than the dev server, see [Debugging tests](../testing/README.md#debugging-tests).

## Common gotchas

### Don't wrap your Custom UI app in `React.StrictMode` with Atlaskit

Atlaskit components (especially anything that uses portals or the design-token theme provider) break under `React.StrictMode`'s double-invoke. Symptoms range from invisible components to portal duplication to "DOM looks empty but the warnings fire." Drop `<React.StrictMode>` from `main.tsx` / `index.tsx` in any Atlaskit-consuming app, including UIKit 2 modules in browser mode. forge-sim's dev server bridge ships with strict mode **off** for the same reason.

### Atlaskit needs `setGlobalTheme()` at boot

Atlaskit reads its colors from design tokens at runtime. Without `setGlobalTheme()`, components render but with unresolved tokens, often invisible. Custom UI apps need this wired into their theme init:

```ts
import { setGlobalTheme } from '@atlaskit/tokens';

setGlobalTheme({
  colorMode: 'auto',
  light: 'light',
  dark: 'dark',
  spacing: 'spacing',
  typography: 'typography-adg3',
  shape: 'shape',
});
```

## In this section

- [Talking to Atlassian APIs](./atlassian-apis.md)
- [Talking to third-party APIs](./third-party-apis.md)
- [Talking to your remote backend (Forge Remotes)](./remotes.md)
- [Credentials](./credentials.md)
- [Dev tools UI](./dev-tools.md)
