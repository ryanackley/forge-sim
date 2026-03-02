/**
 * Vite Plugin: forge-sim browser mode
 *
 * Aliases @forge/bridge to our WebSocket-based shim so that
 * Forge app code can run in the browser with CDT debugging,
 * while resolver calls route to forge-sim on the backend.
 *
 * Usage in the Forge app's vite.config.ts:
 *
 *   import { forgeSimPlugin } from 'forge-sim/renderer/bridge/vite-plugin-forge-sim';
 *
 *   export default defineConfig({
 *     plugins: [react(), forgeSimPlugin({ wsUrl: 'ws://localhost:5174' })],
 *   });
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ForgeSimPluginOptions {
  /** WebSocket URL for the forge-sim dev server (default: ws://localhost:5174) */
  wsUrl?: string;
}

export function forgeSimPlugin(options: ForgeSimPluginOptions = {}): Plugin {
  const shimPath = resolve(__dirname, 'forge-bridge-shim.ts');
  const wsUrl = options.wsUrl ?? 'ws://localhost:5174';

  return {
    name: 'vite-plugin-forge-sim',

    config() {
      return {
        resolve: {
          alias: {
            // Redirect @forge/bridge imports to our WebSocket shim
            '@forge/bridge': shimPath,
          },
        },
        define: {
          // Inject the WebSocket URL as a global
          '__FORGE_SIM_WS_URL__': JSON.stringify(wsUrl),
        },
      };
    },

    // Inject a banner that installs the bridge before any app code runs
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          attrs: { type: 'module' },
          children: `
            // forge-sim: install bridge shim before app code
            window.__FORGE_SIM__ = true;
            window.__FORGE_SIM_WS_URL__ = ${JSON.stringify(wsUrl)};
          `,
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}
