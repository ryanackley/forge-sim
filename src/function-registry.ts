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

export type ForgeFunctionType =
  | 'resolver'
  | 'action'
  | 'workflow'
  | 'trigger'
  | 'consumer'
  | 'scheduledTrigger'
  | 'webTrigger'
  | 'preUninstall'
  | 'customFieldValue'
  | 'jqlFunction'
  | 'generic';

/**
 * The kinds Forge attaches a user to: invocations a person starts from the
 * app's own UI (a resolver behind a bridge `invoke`, a Rovo action). Every
 * other kind runs as the app, so `asUser()` has nobody to act as and
 * `authorize()` throws:
 *
 * - scheduled triggers "run without a user context"
 *   (https://developer.atlassian.com/platform/forge/manifest-reference/modules/scheduled-trigger/)
 * - web triggers: "Atlassian user information is not attached to invocations,
 *   which means asUser API calls will not work"
 *   (https://developer.atlassian.com/platform/forge/manifest-reference/modules/web-trigger/)
 * - event triggers and queue consumers: "app code that responds to events
 *   runs under the identity of the app system user"
 *   (https://developer.atlassian.com/platform/forge/events/)
 * - pre-uninstall: "Pre-uninstall functions run without a user context"
 *   (https://developer.atlassian.com/platform/forge/manifest-reference/modules/pre-uninstall-trigger/)
 * - custom field value functions: "asUser isn't supported"
 *   (https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-custom-field-type/)
 * - workflow validators, conditions and post functions: `asUser` only as
 *   offline impersonation
 *   (https://developer.atlassian.com/platform/forge/check-jira-issues-assigned-using-workflow-validator/)
 * - JQL functions: "Precomputations are not scoped to users"
 *   (https://developer.atlassian.com/cloud/jira/platform/jql-functions/)
 *
 * `generic` is a function no known module binds (a bare `modules.function`
 * entry driven straight through `sim.invoke()`); it keeps the user so test
 * helpers behave as a resolver would.
 */
const USER_INVOKED_TYPES: ReadonlySet<ForgeFunctionType> = new Set(['resolver', 'action', 'generic']);

/** Does a function of this kind run with an invoking user (aaid, `asUser()`, `authorize()`)? */
export function functionTypeHasUser(type: ForgeFunctionType | undefined): boolean {
  return USER_INVOKED_TYPES.has(type ?? 'generic');
}

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
