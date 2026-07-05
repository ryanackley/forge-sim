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

// ── Memory History (history v4 semantics) ───────────────────────────────
//
// Real Forge's bridge history uses the history v4 runtime contract:
//   listen((location, action) => void)   — NOT v5's listen(({action, location}))
//   goBack() / goForward()
// Source of truth: the createHistory signature in the official view docs, and
// the @ts-ignore in @forge/react's Router ("the history object returned by
// the bridge does not conform to the v5 types. Instead it uses v4 types").
// @forge/bridge's own createHistory wrapper and @forge/react/router both
// destructure the first listener arg as the location — v5-style notify
// breaks Route matching after every navigation.
//
// We also keep back()/forward() (v5 names): @forge/bridge's .d.ts types the
// return as history v5's `History`, so TS apps are told those exist.

interface HistoryLocation {
  pathname: string;
  search: string;
  hash: string;
  state: any;
  key: string;
}

type HistoryListener = (location: HistoryLocation, action: string) => void;

function createMemoryHistory(): any {
  const entries: HistoryLocation[] = [
    { pathname: '/', search: '', hash: '', state: null, key: 'default' },
  ];
  let index = 0;
  let listeners: HistoryListener[] = [];
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
    const location = entries[index];
    for (const fn of listeners) {
      try { fn(location, action); } catch (e) { console.error(e); }
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

    // v4 names (the documented Forge contract)
    goBack(): void { history.go(-1); },
    goForward(): void { history.go(1); },
    // v5 names (what @forge/bridge's .d.ts promises)
    back(): void { history.go(-1); },
    forward(): void { history.go(1); },

    listen(fn: HistoryListener): () => void {
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

// ── Realtime (Preview) ──────────────────────────────────────────────────

function getRealtimeBackend(): import('../realtime.js').SimulatedRealtime | null {
  try {
    const sim = (globalThis as any)[Symbol.for('forge-sim.instance')];
    return sim?.realtime ?? null;
  } catch {
    return null;
  }
}

function getCurrentModuleKeyForBridge(): string | null {
  try {
    const sim = (globalThis as any)[Symbol.for('forge-sim.instance')];
    return sim?.currentModuleKey ?? null;
  } catch {
    return null;
  }
}

export const realtime = {
  async subscribe(
    channel: string,
    callback: (payload?: string | Record<string, unknown>) => any,
    options?: { replaySeconds?: number; token?: string; contextOverrides?: string[] },
  ): Promise<{ unsubscribe: () => void }> {
    const rt = getRealtimeBackend();
    if (!rt) {
      console.warn('[forge-sim] realtime.subscribe — no simulator connected');
      return { unsubscribe: () => {} };
    }
    const moduleKey = getCurrentModuleKeyForBridge();
    return rt.subscribe(channel, callback as any, moduleKey, options);
  },

  async subscribeGlobal(
    channel: string,
    callback: (payload?: string | Record<string, unknown>) => any,
    options?: { replaySeconds?: number; token?: string; contextOverrides?: string[] },
  ): Promise<{ unsubscribe: () => void }> {
    const rt = getRealtimeBackend();
    if (!rt) {
      console.warn('[forge-sim] realtime.subscribeGlobal — no simulator connected');
      return { unsubscribe: () => {} };
    }
    return rt.subscribeGlobal(channel, callback as any, options);
  },

  async publish(
    channel: string,
    payload: string | Record<string, unknown>,
    options?: { token?: string; contextOverrides?: string[] },
  ): Promise<{ eventId: string | null; eventTimestamp: string | null; errors?: string[] }> {
    const rt = getRealtimeBackend();
    if (!rt) {
      console.warn('[forge-sim] realtime.publish — no simulator connected');
      return { eventId: null, eventTimestamp: null, errors: ['No simulator connected'] };
    }
    const moduleKey = getCurrentModuleKeyForBridge();
    return rt.publishFromBridge(channel, payload, moduleKey, options);
  },

  async publishGlobal(
    channel: string,
    payload: string | Record<string, unknown>,
    options?: { token?: string; contextOverrides?: string[] },
  ): Promise<{ eventId: string | null; eventTimestamp: string | null; errors?: string[] }> {
    const rt = getRealtimeBackend();
    if (!rt) {
      console.warn('[forge-sim] realtime.publishGlobal — no simulator connected');
      return { eventId: null, eventTimestamp: null, errors: ['No simulator connected'] };
    }
    return rt.publishGlobalFromBridge(channel, payload, options);
  },
};

// ── Object Store bridge surface ─────────────────────────────────────────
//
// Ported from the real @forge/bridge 6.x `out/object-store/*` sources —
// same validation messages, same result shapes, same checksum-mapping
// flow. The real implementation is `invoke()` + plain fetch() against
// pre-signed URLs, so it runs against SimulatedObjectStore's HTTP
// endpoints unmodified. Node 22 provides Blob/atob/btoa/fetch/
// crypto.subtle globally, so this works headless in vitest too.

/** Matches @forge/bridge's BridgeAPIError (it's a bare Error subclass). */
export class BridgeAPIError extends Error {}

const BRIDGE_OBJECT_STORE_RESTRICTED_ENVIRONMENT_ERROR =
  'Object Store bridge methods are restricted to Forge apps in a non-production environment. For more information please see https://developer.atlassian.com/platform/forge/cli-reference/environments/ for reference on Forge app environments.';

export interface Base64Object {
  data: string;
  mimeType?: string;
}

export interface UploadResult {
  success: boolean;
  key: string;
  status?: number;
  error?: string;
}

export interface DownloadResult {
  success: boolean;
  key: string;
  blob?: Blob;
  status?: number;
  error?: string;
}

export interface UploadPromiseItem {
  promise: Promise<UploadResult>;
  index: number;
  objectType?: string;
  objectSize?: number;
}

async function checkRestrictedEnvironment(): Promise<void> {
  const { environmentType } = await view.getContext();
  if (environmentType === 'PRODUCTION') {
    throw new BridgeAPIError(BRIDGE_OBJECT_STORE_RESTRICTED_ENVIRONMENT_ERROR);
  }
}

function trackObjectStoreAction(action: string): void {
  // Fire-and-forget analytics call — must never reject the caller.
  void getBridge().callBridge('trackObjectStoreAction', { action }).catch(() => {});
}

function base64ToBlob(base64: string, mimeType?: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType || 'application/octet-stream' });
}

async function getUploadObjectMetadata(blob: Blob): Promise<{ length: number; checksum: string; checksumType: 'SHA256' }> {
  const length = blob.size;
  const arrayBuffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = new Uint8Array(hashBuffer);
  const checksum = btoa(String.fromCharCode(...hashArray));
  return { length, checksum, checksumType: 'SHA256' };
}

export async function createUploadPromises({
  functionKey,
  objects,
}: {
  functionKey: string;
  objects: Array<Blob | Base64Object>;
}): Promise<UploadPromiseItem[]> {
  if (!functionKey || functionKey.length === 0) {
    throw new BridgeAPIError('functionKey is required to filter and generate presigned URLs');
  }
  if (!Array.isArray(objects) || objects.length === 0) {
    throw new BridgeAPIError('objects array is required and must not be empty');
  }

  const blobs = objects.map((obj, index) => {
    if (obj instanceof Blob) return obj;
    const isBase64Object = obj && typeof obj === 'object' && 'data' in obj && typeof obj.data === 'string';
    if (!isBase64Object) {
      throw new BridgeAPIError(
        `Invalid object type at index ${index}. Only Blob or Base64Object (with data string and optional mimeType) are accepted.`,
      );
    }
    try {
      return base64ToBlob(obj.data, obj.mimeType);
    } catch {
      throw new BridgeAPIError(
        `Invalid base64 data at index ${index}. The data string must be valid base64 encoded.`,
      );
    }
  });

  const allObjectMetadata = await Promise.all(blobs.map((blob) => getUploadObjectMetadata(blob)));

  const presignedURLsToObjectMetadata = (await invoke(functionKey, { allObjectMetadata })) as
    | Record<string, { key: string; checksum: string }>
    | undefined;

  if (!presignedURLsToObjectMetadata || typeof presignedURLsToObjectMetadata !== 'object') {
    throw new BridgeAPIError('Invalid response from functionKey');
  }

  const checksumToBlobMap = new Map<string, Blob>();
  const checksumToIndexMap = new Map<string, number>();
  blobs.forEach((blob, index) => {
    const metadata = allObjectMetadata[index];
    checksumToBlobMap.set(metadata.checksum, blob);
    checksumToIndexMap.set(metadata.checksum, index);
  });

  return Object.entries(presignedURLsToObjectMetadata).map(([presignedUrl, metadata]) => {
    const { key, checksum } = metadata;
    const object = checksumToBlobMap.get(checksum);
    const index = checksumToIndexMap.get(checksum);
    if (index === undefined) {
      return {
        promise: Promise.resolve({ success: false, key, error: `Index not found for checksum ${checksum}` }),
        index: -1,
      };
    }
    if (!object) {
      return {
        promise: Promise.resolve({ success: false, key, error: `Blob not found for checksum ${checksum}` }),
        index,
      };
    }
    const uploadPromise = (async (): Promise<UploadResult> => {
      try {
        const response = await fetch(presignedUrl, {
          method: 'PUT',
          body: object,
          headers: {
            'Content-Type': object.type || 'application/octet-stream',
            'Content-Length': object.size.toString(),
          },
        });
        return {
          success: response.ok,
          key,
          status: response.status,
          error: response.ok ? undefined : `Upload failed with status ${response.status}`,
        };
      } catch (error) {
        return {
          success: false,
          key,
          status: 503,
          error: error instanceof Error ? error.message : 'Upload failed',
        };
      }
    })();
    return { promise: uploadPromise, index, objectType: object.type, objectSize: object.size };
  });
}

async function objectStoreUpload({
  functionKey,
  objects,
}: {
  functionKey: string;
  objects: Array<Blob | Base64Object>;
}): Promise<UploadResult[]> {
  await checkRestrictedEnvironment();
  trackObjectStoreAction('upload');
  const uploadPromises = await createUploadPromises({ functionKey, objects });
  return Promise.all(uploadPromises.map((item) => item.promise));
}

async function objectStoreDownload({
  functionKey,
  keys,
}: {
  functionKey: string;
  keys: string[];
}): Promise<DownloadResult[]> {
  await checkRestrictedEnvironment();
  trackObjectStoreAction('download');
  if (!functionKey || functionKey.length === 0) {
    throw new BridgeAPIError('functionKey is required to filter and generate download URLs');
  }
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new BridgeAPIError('keys array is required and must not be empty');
  }

  const downloadUrlsToKeys = (await invoke(functionKey, { keys })) as Record<string, string> | undefined;
  if (!downloadUrlsToKeys || typeof downloadUrlsToKeys !== 'object') {
    throw new BridgeAPIError('Invalid response from functionKey');
  }

  return Promise.all(
    Object.entries(downloadUrlsToKeys).map(async ([downloadUrl, key]): Promise<DownloadResult> => {
      try {
        const response = await fetch(downloadUrl, { method: 'GET' });
        if (!response.ok) {
          return { success: false, key, status: response.status, error: `Download failed with status ${response.status}` };
        }
        const blob = await response.blob();
        return { success: true, key, blob, status: response.status };
      } catch (error) {
        return {
          success: false,
          key,
          status: 503,
          error: error instanceof Error ? error.message : 'Download failed',
        };
      }
    }),
  );
}

async function objectStoreGetMetadata({
  functionKey,
  keys,
}: {
  functionKey: string;
  keys: string[];
}): Promise<Array<Record<string, unknown>>> {
  await checkRestrictedEnvironment();
  trackObjectStoreAction('getMetadata');
  if (!functionKey || functionKey.length === 0) {
    throw new BridgeAPIError('functionKey is required to filter and generate object metadata');
  }
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new BridgeAPIError('keys array is required and must not be empty');
  }
  return Promise.all(
    keys.map(async (key) => {
      const result = await invoke(functionKey, { key });
      if (!result || typeof result !== 'object') {
        return { key, error: 'Invalid response from functionKey' };
      }
      return result as Record<string, unknown>;
    }),
  );
}

async function objectStoreDelete({
  functionKey,
  keys,
}: {
  functionKey: string;
  keys: string[];
}): Promise<void> {
  await checkRestrictedEnvironment();
  trackObjectStoreAction('delete');
  if (!functionKey || functionKey.length === 0) {
    throw new BridgeAPIError('functionKey is required to delete objects');
  }
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new BridgeAPIError('keys array is required and must not be empty');
  }
  await Promise.all(keys.map(async (key) => { await invoke(functionKey, { key }); }));
}

export const objectStore = {
  upload: objectStoreUpload,
  download: objectStoreDownload,
  getMetadata: objectStoreGetMetadata,
  delete: objectStoreDelete,
};
