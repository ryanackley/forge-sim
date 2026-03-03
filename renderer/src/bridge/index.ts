/**
 * Bridge module exports — everything needed for browser mode.
 *
 * NOTE: Do NOT export vite-plugin-forge-sim here — it uses node:path
 * and would break in the browser. Import it directly from the file
 * when needed in Vite configs (server-side only).
 */

export { installBridgeShim, configure, onReconcile } from './forge-bridge-shim';
export { useBrowserDoc } from './useBrowserDoc';
