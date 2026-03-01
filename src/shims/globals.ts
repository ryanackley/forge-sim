/**
 * Global singleton that all @forge/* shims connect to.
 * 
 * The ForgeSimulator instance is set here before loading user app code,
 * and each shim module reads from it to provide the simulated APIs.
 */

import { ForgeSimulator } from '../simulator.js';

const SIM_KEY = Symbol.for('forge-sim.instance');

/**
 * Set the active simulator instance (call before loading app code).
 */
export function setSimulator(sim: ForgeSimulator): void {
  (globalThis as any)[SIM_KEY] = sim;
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
