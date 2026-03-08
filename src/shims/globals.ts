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
 *
 * Also installs global.__forge_fetch__ so that the real @forge/api CJS package
 * (used internally by @forge/sql and others) routes through our simulator.
 */
export function setSimulator(sim: ForgeSimulator): void {
  (globalThis as any)[SIM_KEY] = sim;
  installGlobalForgeFetch(sim);
}

/**
 * Install global.__forge_fetch__ — the low-level hook that the real @forge/api
 * package calls under the hood. This bridges CJS @forge/* packages to our sim.
 *
 * Signature: global.__forge_fetch__(descriptor, path, init) => Response
 * Where descriptor is { type, provider, remote, accountId }
 */
function installGlobalForgeFetch(sim: ForgeSimulator): void {
  // Install __forge_fetch__ — called by the real @forge/api CJS package
  (global as any).__forge_fetch__ = async (
    descriptor: { type?: string; provider?: string; remote?: string; accountId?: string },
    path: string,
    init?: any
  ) => {
    let response;

    if (descriptor.type === 'sql') {
      response = await sim.sql.handleRequest(path, init);
    } else if (descriptor.type === 'kvs') {
      response = await sim.kvs.handleRequest(path, init);
    } else {
      const product = descriptor.remote ?? descriptor.provider ?? 'unknown';
      response = await sim.productApi.request(product, path, init);
    }

    // Wrap response to have Web API-compatible headers.get()
    return toWebResponse(response);
  };

  // Install __forge_runtime__ — the real @forge/api calls __getRuntime() for metrics
  (global as any).__forge_runtime__ = {
    metrics: {
      counter: () => ({ incr: () => {} }),
      timing: () => ({ measure: () => ({ stop: () => {} }) }),
    },
    externalAuth: [],
  };
}

/**
 * Wrap a plain response object to have Web API-compatible headers (with .get()).
 */
function toWebResponse(res: any): any {
  const rawHeaders: Record<string, string> = res.headers ?? {};
  return {
    ...res,
    headers: {
      ...rawHeaders,
      get(name: string) {
        return rawHeaders[name.toLowerCase()] ?? null;
      },
      has(name: string) {
        return name.toLowerCase() in rawHeaders;
      },
    },
  };
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
