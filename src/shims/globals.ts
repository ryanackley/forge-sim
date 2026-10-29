/**
 * Global singleton the seam installers connect to.
 *
 * The ForgeSimulator instance is set here before loading user app code, and
 * the seams the real @forge/* packages talk to (`__forge_fetch__`,
 * `__forge_runtime__`, `globalThis.__bridge`) are installed against it.
 */

import type { ForgeSimulator } from '../simulator.js';
import { installForgeRuntime } from '../runtime/forge-runtime.js';
import { installForgeFetch } from '../runtime/seam-fetch.js';
import { installBridgeSeam } from '../ui/bridge.js';

const SIM_KEY = Symbol.for('forge-sim.instance');

/**
 * Set the active simulator instance.
 *
 * @deprecated Since v0.x — the ForgeSimulator constructor now calls this automatically.
 * You no longer need to call setSimulator() manually. It remains available for
 * backward compatibility and advanced use cases (e.g., swapping simulator instances).
 *
 * Also installs the three platform seams the real `@forge/*` packages call
 * at runtime, so bundled copies behave like shimmed ones:
 *   global.__forge_fetch__   — backend I/O (src/runtime/seam-fetch.ts)
 *   global.__forge_runtime__ — backend identity + config (src/runtime/forge-runtime.ts)
 *   globalThis.__bridge      — the frontend bridge, headless host (src/ui/bridge.ts)
 */
export function setSimulator(sim: ForgeSimulator): void {
  (globalThis as any)[SIM_KEY] = sim;
  installForgeFetch(sim);
  installForgeRuntime(sim);
  installBridgeSeam(sim);
}

/**
 * Get the active simulator instance (called by shim modules).
 */
export function getSimulator(): ForgeSimulator {
  const sim = (globalThis as any)[SIM_KEY];
  if (!sim) {
    throw new Error(
      'forge-sim: No simulator instance set. Call setSimulator() before loading app code.'
    );
  }
  return sim;
}
