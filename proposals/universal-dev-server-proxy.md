# Proposal: Universal Dev Server Proxy

**Status:** Proposed  
**Date:** 2026-03-16  
**Author:** Nyx  

## Problem

Custom UI Forge apps use a variety of frontend build tools (webpack, Vite, Parcel, esbuild, etc.) during development. Each bundler has its own module resolution, dev server, and HMR setup. Currently, forge-sim handles Custom UI by:

1. **Simple apps (no dev server):** Serving the resource directory directly via Vite
2. **Pre-built apps:** Injecting a `window.__bridge` script into `index.html`

Neither approach works well for developers who have their own dev server running (e.g., webpack-dev-server with HMR, custom middleware, etc.). Forgebuilder is a perfect example — it uses webpack dev server with a custom forge shim for local development.

To replace custom shims and tighten the dev loop for the masses, forge-sim needs to work with **any** JavaScript build system without requiring per-bundler plugins.

## Key Insight

`@forge/bridge`'s `getCallBridge()` checks for `window.__bridge` before anything else. If `window.__bridge` is set before the app's bundled code runs, the bridge routes through it regardless of how the app was built. We proved this with the HTML injection fix for forgebuilder (2026-03-15).

The problem reduces to: **"How do we inject our bridge before any dev server's output, universally?"**

## Solution: Reverse Proxy

forge-sim acts as an HTTP reverse proxy in front of the developer's existing dev server.

```
┌──────────────────────────────────┐
│  Developer's dev server          │
│  (webpack/Vite/Parcel/whatever)  │
│  localhost:3000                   │
└──────────────┬───────────────────┘
               │ proxied
┌──────────────▼───────────────────┐
│  forge-sim proxy                 │
│  localhost:4999                   │
│                                  │
│  - Intercepts HTML responses     │
│    → injects window.__bridge     │
│  - Bridge WebSocket              │
│    → routes to simulator         │
│  - Everything else passes        │
│    through untouched             │
└──────────────┬───────────────────┘
               │
         Browser hits :4999
         App works with full sim
```

### How It Works

1. Developer starts their dev server normally (`npm start`, `webpack serve`, etc.)
2. Developer runs `forge-sim dev --proxy http://localhost:3000`
3. forge-sim starts its simulator (resolvers, KVS, SQL, queues, etc.) as usual
4. forge-sim creates an HTTP proxy that:
   - **Forwards all requests** to the upstream dev server
   - **Intercepts HTML responses** and injects a `<script>` tag after `<head>` that sets up `window.__bridge`
   - **Serves the bridge WebSocket** on a distinct path (`/__forge-sim/ws`)
   - **Passes through the dev server's WebSocket** connections (HMR) untouched

### The Injected Script

```js
<script>
// forge-sim bridge — injected by proxy
(function() {
  const ws = new WebSocket(`ws://${location.host}/__forge-sim/ws`);
  const pending = new Map();
  let reqId = 0;
  
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    const resolve = pending.get(msg.requestId);
    if (resolve) {
      pending.delete(msg.requestId);
      resolve(msg.result);
    }
  };

  window.__bridge = {
    callBridge: (method, args) => new Promise((resolve) => {
      const id = ++reqId;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ requestId: id, method, args }));
    })
  };
})();
</script>
```

This is essentially the same bridge shim we already use — just injected via proxy instead of Vite plugin.

### WebSocket Routing

Both the upstream dev server (for HMR) and forge-sim (for bridge RPC) use WebSockets. They're differentiated by path:

| Path | Destination |
|------|-------------|
| `/__forge-sim/ws` | forge-sim bridge (invoke, requestJira, getContext, etc.) |
| Everything else (`/ws`, `/sockjs-node`, etc.) | Upstream dev server (HMR) |

The proxy's WebSocket upgrade handler checks the path and routes accordingly.

## Developer Experience

### Three Modes (Clean Matrix)

| Scenario | Command | What Happens |
|----------|---------|--------------|
| UIKit app | `forge-sim dev` | Runs renderer directly, no proxy needed |
| Simple Custom UI (no dev server) | `forge-sim dev` | Serves resource dir via Vite (existing behavior) |
| Custom UI with own dev server | `forge-sim dev --proxy http://localhost:3000` | Proxies external dev server, injects bridge |

### Zero Config for the Developer

- No bundler plugin to install
- No webpack/Vite config changes
- No `@forge/bridge` aliasing or shimming in their build
- Just point forge-sim at their dev server URL

### Forgebuilder Migration Path

1. Remove custom forge shim from webpack config
2. Run `webpack serve` as normal (port 3001)
3. Run `forge-sim dev --proxy http://localhost:3001`
4. All resolvers, remotes, KVS, queues route through forge-sim
5. Ryan's custom shim is replaced entirely

## Why Not Bundler Plugins?

We *could* ship `forge-sim/webpack`, `forge-sim/vite`, `forge-sim/esbuild` plugins. But:

- **Maintenance burden** — each bundler has different plugin APIs, they change between versions
- **Config burden** — developers need to modify their build config
- **Incomplete coverage** — always another bundler, always an edge case
- **Solves an already-solved problem** — the proxy approach is bundler-agnostic by design

Plugins could be a future addition for developers who want deeper integration (e.g., better source maps, HMR for resolver code), but the proxy is the 90% solution with zero developer config.

## Implementation Plan

### Phase 1: Core Proxy (MVP)
- HTTP reverse proxy using `http-proxy` or built-in `http` module
- HTML response interception (detect `Content-Type: text/html`, inject script after `<head>`)
- WebSocket upgrade routing (forge-sim path vs. passthrough)
- `--proxy <url>` flag on `forge-sim dev`
- Estimated effort: **1 day**

### Phase 2: Polish
- Auto-detect upstream dev server readiness (retry until it responds)
- Graceful error messages when upstream is down
- Support HTTPS upstream (self-signed certs common in dev)
- `--proxy-port` flag to customize forge-sim's listen port
- Estimated effort: **half a day**

### Phase 3: Optional Bundler Plugins (if demand warrants)
- Vite plugin (we basically have this already)
- Webpack plugin
- Only if developers specifically ask for deeper integration

## Open Questions

1. **Should `--proxy` auto-detect the port?** Could scan `package.json` scripts for common patterns (`"start": "webpack serve --port 3000"`) but that feels fragile. Explicit URL is safer.
2. **Multiple Custom UI resources?** Some apps have multiple Custom UI modules pointing to different resource directories. The proxy handles this naturally if they're on the same dev server, but what about multiple dev servers?
3. **SSR/streaming HTML?** Some dev servers stream HTML responses. The proxy needs to buffer the full response to inject the script. Should be fine for dev — responses are small.

## References

- `window.__bridge` injection fix: commit from 2026-03-15 (forgebuilder Custom UI support)
- `@forge/bridge` source: `getCallBridge()` checks `window.__bridge` first
- forge-sim bridge WebSocket: `src/dev-server.ts`
