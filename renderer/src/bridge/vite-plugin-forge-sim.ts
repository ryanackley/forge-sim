/**
 * Vite Plugin: run a Forge app's OWN Vite dev server against forge-sim.
 *
 * Injects the forge-sim browser bridge bundle, served by a running
 * `forge-sim dev`, ahead of the app's scripts, and aliases `@forge/bridge`
 * to forge-sim's shim so a source-mode app's imports resolve. Prefer
 * `forge-sim dev --proxy <url>` where possible — it does the same injection
 * server-side with no app config. This plugin is for setups where the app's
 * dev server must be the one serving the page.
 *
 * Usage in the Forge app's vite.config.ts:
 *
 *   import { forgeSimPlugin } from 'forge-sim/renderer/bridge/vite-plugin-forge-sim';
 *
 *   export default defineConfig({
 *     plugins: [react(), forgeSimPlugin({ forgeSimUrl: 'http://localhost:5173', wsPort: 5174 })],
 *   });
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ForgeSimPluginOptions {
  /** Origin of the running `forge-sim dev` HTTP server (default: http://localhost:5173). */
  forgeSimUrl?: string;
  /** Its WebSocket bridge port (default: 5174). */
  wsPort?: number;
  /** Module key to report as this page's placement (there is no /module/<key>/ in the URL here). */
  moduleKey?: string;
}

export function forgeSimPlugin(options: ForgeSimPluginOptions = {}): Plugin {
  const shimPath = resolve(__dirname, 'forge-bridge-shim.ts');
  const forgeSimUrl = (options.forgeSimUrl ?? 'http://localhost:5173').replace(/\/$/, '');
  const config = JSON.stringify({
    wsPort: options.wsPort ?? 5174,
    defaultModuleKey: options.moduleKey ?? null,
    history: 'browser',
  });

  return {
    name: 'vite-plugin-forge-sim',

    config() {
      return {
        resolve: {
          alias: { '@forge/bridge': shimPath },
        },
      };
    },

    // Classic scripts, no async/defer: the parser runs them before any app
    // script, which is what @forge/bridge's getCallBridge() depends on.
    transformIndexHtml() {
      return [
        { tag: 'script', children: `window.__FORGE_SIM_BRIDGE_CONFIG__=${config};`, injectTo: 'head-prepend' },
        { tag: 'script', attrs: { src: `${forgeSimUrl}/__forge/bridge.js` }, injectTo: 'head-prepend' },
      ];
    },
  };
}
