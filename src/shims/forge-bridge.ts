/**
 * @forge/bridge shim — provides invoke(), view, requestJira(), requestConfluence(),
 * requestBitbucket(), router, events, showFlag, Modal, etc. that route through
 * the simulator's bridge (globalThis.__bridge).
 *
 * The bridge object is installed by installBridge() in ui/bridge.ts.
 *
 * This shim is loaded in server mode (Node.js) when @forge/bridge is imported
 * by app code or by @forge/react's internal hooks (useIssueProperty, etc.).
 */

function getBridge() {
  const bridge = (globalThis as any).__bridge;
  if (!bridge) {
    throw new Error('forge-sim: Bridge not installed. Call installBridge() first.');
  }
  return bridge;
}

// ── Memory History (history v5 compatible) ──────────────────────────────

interface HistoryLocation {
  pathname: string;
  search: string;
  hash: string;
  state: any;
  key: string;
}

interface HistoryUpdate {
  action: string;
  location: HistoryLocation;
}

function createMemoryHistory(): any {
  const entries: HistoryLocation[] = [
    { pathname: '/', search: '', hash: '', state: null, key: 'default' },
  ];
  let index = 0;
  let listeners: Array<(update: HistoryUpdate) => void> = [];
  let blockers: Array<(tx: any) => void> = [];

  function generateKey(): string {
    return Math.random().toString(36).slice(2, 10);
  }

  function parsePath(to: string | Partial<HistoryLocation>): Partial<HistoryLocation> {
    if (typeof to === 'object') return to;
    const path = to || '/';
    let pathname = path, search = '', hash = '';
    const hashIdx = path.indexOf('#');
    if (hashIdx >= 0) { hash = path.slice(hashIdx); pathname = path.slice(0, hashIdx); }
    const searchIdx = pathname.indexOf('?');
    if (searchIdx >= 0) { search = pathname.slice(searchIdx); pathname = pathname.slice(0, searchIdx); }
    return { pathname, search, hash };
  }

  function createLocation(to: string | Partial<HistoryLocation>, state?: any): HistoryLocation {
    const parsed = parsePath(to);
    return {
      pathname: parsed.pathname || '/',
      search: parsed.search || '',
      hash: parsed.hash || '',
      state: state ?? null,
      key: generateKey(),
    };
  }

  function notify(action: string): void {
    const update = { action, location: entries[index] };
    for (const fn of listeners) {
      try { fn(update); } catch (e) { console.error(e); }
    }
  }

  const history = {
    get action() { return 'POP'; },
    get location() { return entries[index]; },
    set location(loc: HistoryLocation) { /* mutable per history v5 spec */ },

    createHref(to: string | Partial<HistoryLocation>): string {
      if (typeof to === 'string') return to;
      return (to.pathname || '') + (to.search || '') + (to.hash || '');
    },

    push(to: string | Partial<HistoryLocation>, state?: any): void {
      const loc = createLocation(to, state);
      if (blockers.length > 0) {
        blockers[0]({ action: 'PUSH', location: loc, retry: () => history.push(to, state) });
        return;
      }
      // Truncate forward stack and push
      entries.splice(index + 1);
      entries.push(loc);
      index = entries.length - 1;
      notify('PUSH');
    },

    replace(to: string | Partial<HistoryLocation>, state?: any): void {
      const loc = createLocation(to, state);
      if (blockers.length > 0) {
        blockers[0]({ action: 'REPLACE', location: loc, retry: () => history.replace(to, state) });
        return;
      }
      entries[index] = loc;
      notify('REPLACE');
    },

    go(delta: number): void {
      const nextIndex = Math.max(0, Math.min(entries.length - 1, index + delta));
      if (nextIndex === index) return;
      index = nextIndex;
      notify('POP');
    },

    back(): void { history.go(-1); },
    forward(): void { history.go(1); },

    listen(fn: (update: HistoryUpdate) => void): () => void {
      listeners.push(fn);
      return () => { listeners = listeners.filter(l => l !== fn); };
    },

    block(fn: (tx: any) => void): () => void {
      blockers.push(fn);
      return () => { blockers = blockers.filter(b => b !== fn); };
    },
  };

  return history;
}

// Expose for testing
export { createMemoryHistory };

// ── Response wrapper ────────────────────────────────────────────────────

/**
 * Wraps product API responses to match the Response-like interface
 * that @forge/react hooks expect (.ok, .status, .json(), .text(), .headers).
 */
class BridgeResponse {
  private _body: any;
  public ok: boolean;
  public status: number;
  public statusText: string;
  public headers: Map<string, string>;

  constructor(body: any, status = 200) {
    this._body = body;
    this.status = status;
    this.ok = status >= 200 && status < 300;
    this.statusText = this.ok ? 'OK' : 'Error';
    this.headers = new Map([['content-type', 'application/json']]);
  }

  async json(): Promise<any> {
    if (typeof this._body === 'string') {
      return JSON.parse(this._body);
    }
    return this._body;
  }

  async text(): Promise<string> {
    if (typeof this._body === 'string') return this._body;
    return JSON.stringify(this._body);
  }
}

// ── invoke ──────────────────────────────────────────────────────────────

export function invoke(functionKey: string, payload?: any): Promise<any> {
  return getBridge().callBridge('invoke', { functionKey, payload });
}

// ── view ────────────────────────────────────────────────────────────────

/**
 * View event system — allows tests to observe view.submit(), view.close(),
 * and view.refresh() calls from app code.
 *
 * Events fire through globalThis.__forgeSimViewEvents so SimulatorUI can
 * listen without a circular dependency.
 */
export type ViewEventType = 'submit' | 'close' | 'refresh';
export type ViewEventListener = (event: ViewEventType, payload: any) => void;

const viewEventStore = ((globalThis as any).__forgeSimViewEvents ??= {
  listeners: [] as ViewEventListener[],
}) as { listeners: ViewEventListener[] };

function emitViewEvent(event: ViewEventType, payload: any): void {
  for (const fn of viewEventStore.listeners) {
    try { fn(event, payload); } catch {}
  }
}

/**
 * Register a listener for view events. Returns an unbind function.
 * @internal — used by SimulatorUI to wire onSubmit/onClose/onRefresh.
 */
export function onViewEvent(listener: ViewEventListener): () => void {
  viewEventStore.listeners.push(listener);
  return () => {
    const idx = viewEventStore.listeners.indexOf(listener);
    if (idx >= 0) viewEventStore.listeners.splice(idx, 1);
  };
}

/** Clear all view event listeners. @internal */
export function resetViewEvents(): void {
  viewEventStore.listeners.length = 0;
}

export const view = {
  getContext(): Promise<any> {
    return getBridge().callBridge('getContext');
  },
  submit(payload?: any): Promise<void> {
    emitViewEvent('submit', payload);
    return Promise.resolve();
  },
  close(payload?: any): Promise<void> {
    emitViewEvent('close', payload);
    return Promise.resolve();
  },
  onClose(callback: () => void): void {
    // Registered but won't fire in sim
  },
  open(): Promise<void> {
    return Promise.resolve();
  },
  refresh(payload?: any): Promise<void> {
    emitViewEvent('refresh', payload);
    return Promise.resolve();
  },
  createHistory(): Promise<any> {
    return Promise.resolve(createMemoryHistory());
  },
  theme: {
    enable(): void {
      console.log('[forge-sim] view.theme.enable()');
    },
  },
  changeWindowTitle(title: string): void {
    console.log(`[forge-sim] view.changeWindowTitle("${title}")`);
  },
  emitReadyEvent(): void {
    // No-op
  },
};

// ── Product API requests ────────────────────────────────────────────────

async function productRequest(product: string, path: string, options?: any): Promise<BridgeResponse> {
  try {
    const result = await getBridge().callBridge('fetchProduct', {
      product,
      restPath: path,
      fetchRequestInit: options,
    });

    // If the bridge already returned a Response-like object, wrap it
    if (result && typeof result === 'object' && 'status' in result) {
      const body = result.body ?? result.data ?? result;
      return new BridgeResponse(body, result.status);
    }

    // Raw result — wrap as 200
    return new BridgeResponse(result, 200);
  } catch (err: any) {
    // Return error as a non-ok response
    const status = err.status ?? err.statusCode ?? 500;
    return new BridgeResponse({ error: err.message }, status);
  }
}

export function requestJira(path: string, options?: any): Promise<BridgeResponse> {
  return productRequest('jira', path, options);
}

export function requestConfluence(path: string, options?: any): Promise<BridgeResponse> {
  return productRequest('confluence', path, options);
}

export function requestBitbucket(path: string, options?: any): Promise<BridgeResponse> {
  return productRequest('bitbucket', path, options);
}

// ── router ──────────────────────────────────────────────────────────────

export const router = {
  navigate(location: string): Promise<void> {
    console.log(`[forge-sim] router.navigate("${location}")`);
    return Promise.resolve();
  },
  open(location: string): Promise<void> {
    console.log(`[forge-sim] router.open("${location}")`);
    return Promise.resolve();
  },
  getUrl(location: string): Promise<string | null> {
    return Promise.resolve(null);
  },
  reload(): void {
    console.log('[forge-sim] router.reload()');
  },
};

export const NavigationTarget = {
  JIRA: 'jira',
  CONFLUENCE: 'confluence',
  BITBUCKET: 'bitbucket',
};

// ── events (cross-module) ───────────────────────────────────────────────

const eventListeners = new Map<string, Set<Function>>();

export const events = {
  emit(event: string, payload?: any): Promise<void> {
    console.log(`[forge-sim] events.emit("${event}")`, payload);
    const listeners = eventListeners.get(event);
    if (listeners) {
      for (const fn of listeners) {
        try { fn(payload); } catch (e) { console.error(e); }
      }
    }
    return Promise.resolve();
  },
  on(event: string, callback: Function): Promise<{ unsubscribe: () => void }> {
    if (!eventListeners.has(event)) {
      eventListeners.set(event, new Set());
    }
    eventListeners.get(event)!.add(callback);
    return Promise.resolve({
      unsubscribe: () => eventListeners.get(event)?.delete(callback),
    });
  },
  emitPublic(event: string, payload?: any): Promise<void> {
    console.log(`[forge-sim] events.emitPublic("${event}")`, payload);
    return Promise.resolve();
  },
  onPublic(event: string, callback: Function): Promise<{ unsubscribe: () => void }> {
    return events.on(`public:${event}`, callback);
  },
};

// ── Modal ───────────────────────────────────────────────────────────────

export class Modal {
  private options: any;
  constructor(options?: any) {
    this.options = options;
  }
  open(): void {
    console.log('[forge-sim] Modal.open()', this.options);
  }
}

// ── showFlag ────────────────────────────────────────────────────────────

export function showFlag(options: {
  id?: string;
  title: string;
  type: 'info' | 'success' | 'warning' | 'error';
  description?: string;
  isAutoDismiss?: boolean;
  actions?: Array<{ text: string; onClick?: () => void }>;
}): { close: () => void } {
  console.log(`[forge-sim] showFlag("${options.title}", type=${options.type})`);
  return { close: () => {} };
}

// ── permissions ─────────────────────────────────────────────────────────

export const permissions = {
  check(): Promise<{ hasPermission: boolean }> {
    return Promise.resolve({ hasPermission: true });
  },
};

// ── Feature Flags ───────────────────────────────────────────────────────

export const featureFlags = {
  evaluate(flagKey: string, defaultValue: any): Promise<any> {
    return Promise.resolve(defaultValue);
  },
};

// ── i18n ────────────────────────────────────────────────────────────────

/**
 * Get the I18nStore from the simulator (if available).
 * Falls back to a stub that returns keys as-is.
 */
function getI18nStore(): import('../i18n-store.js').I18nStore | null {
  try {
    const sim = (globalThis as any).__forgeSimulator;
    return sim?.i18n ?? null;
  } catch {
    return null;
  }
}

export type TranslationFunction = (i18nKey: string, defaultValue?: string) => string;

export interface GetTranslationsResult {
  locale: string;
  translations: Record<string, any> | null;
}

export interface GetTranslationsOptions {
  fallback: boolean;
}

let translationFunctionCache: Map<string, TranslationFunction> = new Map();

export const i18n = {
  resetTranslationsCache(): void {
    translationFunctionCache.clear();
    const store = getI18nStore();
    if (store) {
      store.clear();
    }
  },

  async getTranslations(
    locale?: string | null,
    options: GetTranslationsOptions = { fallback: true }
  ): Promise<GetTranslationsResult> {
    let targetLocale: string = locale ?? '';
    if (!targetLocale) {
      const ctx = await view.getContext();
      targetLocale = ctx.locale ?? 'en-US';
    }

    const store = getI18nStore();
    if (store?.hasTranslations) {
      return store.getTranslations(targetLocale, options);
    }

    // No store or no translations loaded — return empty
    return { locale: targetLocale, translations: null };
  },

  async createTranslationFunction(locale?: string | null): Promise<TranslationFunction> {
    let targetLocale: string = locale ?? '';
    if (!targetLocale) {
      const ctx = await view.getContext();
      targetLocale = ctx.locale ?? 'en-US';
    }

    // Check cache
    const cached = translationFunctionCache.get(targetLocale);
    if (cached) return cached;

    const store = getI18nStore();
    if (store?.hasTranslations) {
      const fn = await store.createTranslationFunction(targetLocale);
      translationFunctionCache.set(targetLocale, fn);
      return fn;
    }

    // No translations — return identity function (key or defaultValue)
    const fn: TranslationFunction = (key, defaultValue) => defaultValue ?? key;
    translationFunctionCache.set(targetLocale, fn);
    return fn;
  },
};

// ── Forge Remotes ───────────────────────────────────────────────────────

function getRemoteProxy(): import('../remote-proxy.js').RemoteProxy | null {
  try {
    const sim = (globalThis as any)[Symbol.for('forge-sim.instance')];
    return sim?.remotes ?? null;
  } catch {
    return null;
  }
}

/**
 * Bridge invokeRemote — takes a single options object { path, method, headers, body }.
 * No remoteKey arg — resolves the remote from the current module's endpoint config.
 */
export async function invokeRemote(input: { path: string; method?: string; headers?: Record<string, string>; body?: any }): Promise<any> {
  const sim = (globalThis as any)[Symbol.for('forge-sim.instance')];
  const proxy = sim?.remotes;
  if (!proxy) {
    console.warn('[forge-sim] invokeRemote — no simulator connected');
    return null;
  }
  // Resolve endpoint from the active module's config
  const endpointKey = sim.currentModuleKey ? sim.resolveModuleEndpoint(sim.currentModuleKey) : undefined;
  const bridgeResponse = await proxy.invokeFromBridge({ ...input, endpointKey });

  // Unwrap the { success, payload, error } format (same as real @forge/bridge's _setupInvokeEndpointFn)
  const { success, payload, error } = bridgeResponse ?? {};
  return { ...(success ? payload : error) };
}

/**
 * Bridge requestRemote — direct fetch to a remote, returns Response-like object.
 * Takes (remoteKey, { path, ...requestInit }).
 */
export function requestRemote(remoteKey: string, options?: { path: string; method?: string; headers?: Record<string, string>; body?: string }): Promise<any> {
  const proxy = getRemoteProxy();
  if (!proxy) {
    console.warn('[forge-sim] requestRemote — no simulator connected');
    return Promise.resolve(null);
  }
  return proxy.request(remoteKey, options);
}

export function invokeService(serviceKey: string, options?: any): Promise<any> {
  console.warn(`[forge-sim] invokeService("${serviceKey}") — not implemented`);
  return Promise.resolve(null);
}
