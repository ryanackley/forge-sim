/**
 * Side-effect entry for test runners: `import 'forge-sim/setup'`.
 *
 * The real `@forge/bridge` captures `globalThis.__bridge` at MODULE
 * EVALUATION — `getCallBridge()` in node_modules/@forge/bridge/out/bridge.js
 * throws BridgeAPIError when the seam is absent, and ~25 of its modules call
 * it in a top-level `const callBridge = getCallBridge()`. forge-sim installs
 * the seam when `src/ui/bridge.ts` evaluates, so a test file that imports
 * '@forge/bridge' BEFORE 'forge-sim' dies inside Atlassian's package with
 * "Unable to establish a connection with the Custom UI bridge" — a message
 * that never mentions forge-sim.
 *
 * Importing this module first makes import order irrelevant. Wire it as a
 * vitest setup file:
 *
 *   // vitest.config.ts
 *   export default defineConfig({ test: { setupFiles: ['forge-sim/setup'] } });
 *
 * It installs only the seam scaffolding (the `__bridge` trampoline, the
 * headless window/document, the fetch/Request patches). Commands dispatched
 * before a ForgeSimulator exists still reject — this is the same
 * before-construction state `createSimulator()` later attaches to.
 */
import './ui/bridge.js';
