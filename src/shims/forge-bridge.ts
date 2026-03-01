/**
 * @forge/bridge shim — provides invoke() and view() that route through
 * the simulator's bridge (globalThis.__bridge).
 */

export function invoke(functionKey: string, payload?: any): Promise<any> {
  const bridge = (globalThis as any).__bridge;
  if (!bridge) {
    throw new Error('forge-sim: Bridge not installed. Call installBridge() first.');
  }
  return bridge.callBridge('invoke', { functionKey, payload });
}

export function view(resourceId?: string): Promise<any> {
  const bridge = (globalThis as any).__bridge;
  if (!bridge) {
    throw new Error('forge-sim: Bridge not installed. Call installBridge() first.');
  }
  return bridge.callBridge('getContext');
}

export function requestJira(path: string, options?: any): Promise<any> {
  const bridge = (globalThis as any).__bridge;
  if (!bridge) throw new Error('forge-sim: Bridge not installed.');
  return bridge.callBridge('fetchProduct', { product: 'jira', restPath: path, fetchRequestInit: options });
}

export function requestConfluence(path: string, options?: any): Promise<any> {
  const bridge = (globalThis as any).__bridge;
  if (!bridge) throw new Error('forge-sim: Bridge not installed.');
  return bridge.callBridge('fetchProduct', { product: 'confluence', restPath: path, fetchRequestInit: options });
}
