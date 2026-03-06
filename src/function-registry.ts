/**
 * Function Registry — tracks all Forge function handlers and their invocation types.
 *
 * Forge has multiple function calling conventions:
 * - Resolver: ({ payload, context }) — single wrapped object (UI bridge only)
 * - Trigger: (event, context) — two args
 * - Consumer: (event, context) — two args
 * - Scheduled trigger: (request, context) — request has { context: { cloudId, moduleKey }, contextToken }
 * - Web trigger: (request, context) — request has { method, path, headers, body, queryParameters }
 * - Generic: (payload, context) — two args
 *
 * The registry stores handlers with their type so the correct calling convention
 * can be used at invocation time.
 */

export type ForgeFunctionType = 'resolver' | 'trigger' | 'consumer' | 'scheduledTrigger' | 'webTrigger' | 'generic';

export interface RegisteredFunction {
  key: string;
  type: ForgeFunctionType;
  handler: (...args: any[]) => any | Promise<any>;
}

export class FunctionRegistry {
  private functions = new Map<string, RegisteredFunction>();

  /**
   * Register a function with its type.
   */
  register(key: string, handler: (...args: any[]) => any, type: ForgeFunctionType = 'generic'): void {
    this.functions.set(key, { key, type, handler });
  }

  /**
   * Get a registered function entry.
   */
  get(key: string): RegisteredFunction | undefined {
    return this.functions.get(key);
  }

  /**
   * Get just the handler for a function key.
   */
  getHandler(key: string): ((...args: any[]) => any) | undefined {
    return this.functions.get(key)?.handler;
  }

  /**
   * Get the type of a registered function.
   */
  getType(key: string): ForgeFunctionType | undefined {
    return this.functions.get(key)?.type;
  }

  /**
   * Check if a function is registered.
   */
  has(key: string): boolean {
    return this.functions.has(key);
  }

  /**
   * List all registered function keys.
   */
  keys(): string[] {
    return [...this.functions.keys()];
  }

  /**
   * List all registered function keys of a given type.
   */
  keysOfType(type: ForgeFunctionType): string[] {
    return [...this.functions.entries()]
      .filter(([, fn]) => fn.type === type)
      .map(([key]) => key);
  }

  /**
   * Remove a function.
   */
  remove(key: string): boolean {
    return this.functions.delete(key);
  }

  /**
   * Clear all registered functions.
   */
  clear(): void {
    this.functions.clear();
  }
}
