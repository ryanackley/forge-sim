/**
 * Bridge module exports — everything needed for browser mode.
 */

export { installBridgeShim, configure, onReconcile } from './forge-bridge-shim';
export { useBrowserDoc } from './useBrowserDoc';
export { forgeSimPlugin, type ForgeSimPluginOptions } from './vite-plugin-forge-sim';
