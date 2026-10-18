/**
 * @forge/bridge browser shim — the `@forge/bridge` module a SOURCE-MODE app
 * gets in `forge-sim dev` (Vite aliases the package here), plus the hooks
 * forge-sim's own chrome needs.
 *
 * This file no longer owns a transport, a command switch, or any DOM. The
 * browser bridge HOST does — src/bridge/hosts/browser, built to
 * dist/bridge.js and loaded by every dev page ahead of app code. It installs
 * `window.__bridge` (the one seam real Forge provides) and
 * `window.__forgeSimBridge` (reconcile stream + raw RPC for the shell).
 *
 * Every export below is therefore a thin adapter:
 *   - app-facing exports send the exact frame real @forge/bridge sends
 *     through `window.__bridge.callBridge`, so a source-mode app and a
 *     prebuilt bundle exercise the identical path;
 *   - chrome-facing exports (onReconcile, rpc, setActiveSubmitTree) read
 *     `window.__forgeSimBridge`.
 *
 * Under jsdom (renderer unit tests) no bundle is loaded. The adapter then
 * installs a minimal local stand-in that supports exactly what those tests
 * drive — reconcile capture with replay, the active submit tree, and an RPC
 * that rejects — and exposes its state on `globalThis.__forgeSim` so the
 * existing tests can reset it between cases.
 *
 * The alias itself is the last step of the bridge consolidation: once it is
 * dropped, source-mode apps run the real package and this file shrinks to
 * the chrome hooks only.
 */

type ReconcileListener = (forgeDoc: any) => void;

/** What the bundle exposes for forge-sim's own UI (see src/bridge/hosts/browser/entry.ts). */
interface ForgeSimBridgeHooks {
  onReconcile(fn: ReconcileListener): () => void;
  onMacroConfigReconcile(fn: ReconcileListener): () => void;
  getLatestForgeDoc(): unknown;
  getLatestMacroConfigDoc(): unknown;
  rpc(method: string, params?: Record<string, unknown>): Promise<any>;
  setActiveSubmitTree(tree: 'view' | 'macroConfig'): void;
}

const G = globalThis as any;

// ── Shared state (jsdom stand-in; also what tests reset) ────────────────

if (!G.__forgeSim) {
  G.__forgeSim = {
    reconcileListeners: [] as ReconcileListener[],
    lastForgeDoc: null as any,
    macroConfigReconcileListeners: [] as ReconcileListener[],
    lastMacroConfigDoc: null as any,
    /** Which reconcile tree the next view.submit() belongs to (macro inline config). */
    activeSubmitTree: 'view' as 'view' | 'macroConfig',
  };
}

/**
 * The hooks object: the bundle's when a dev page loaded it, otherwise a local
 * stand-in (jsdom). Resolved lazily on every call so a test that installs
 * its own `window.__bridge` before importing this module is honoured.
 */
function hooks(): ForgeSimBridgeHooks {
  if (G.__forgeSimBridge) return G.__forgeSimBridge as ForgeSimBridgeHooks;
  return localStandIn();
}

let standIn: ForgeSimBridgeHooks | null = null;
function localStandIn(): ForgeSimBridgeHooks {
  if (standIn) return standIn;
  const S = G.__forgeSim;
  const dispatch = (listeners: ReconcileListener[], doc: any) => {
    for (const fn of [...listeners]) { try { fn(doc); } catch {} }
  };
  standIn = {
    onReconcile(fn) {
      S.reconcileListeners.push(fn);
      if (S.lastForgeDoc) { try { fn(S.lastForgeDoc); } catch {} }
      return () => { const i = S.reconcileListeners.indexOf(fn); if (i >= 0) S.reconcileListeners.splice(i, 1); };
    },
    onMacroConfigReconcile(fn) {
      S.macroConfigReconcileListeners.push(fn);
      if (S.lastMacroConfigDoc) { try { fn(S.lastMacroConfigDoc); } catch {} }
      return () => { const i = S.macroConfigReconcileListeners.indexOf(fn); if (i >= 0) S.macroConfigReconcileListeners.splice(i, 1); };
    },
    getLatestForgeDoc: () => S.lastForgeDoc,
    getLatestMacroConfigDoc: () => S.lastMacroConfigDoc,
    rpc: (method) => Promise.reject(new Error(`[forge-sim] No dev server in this environment (rpc "${method}")`)),
    setActiveSubmitTree: (tree) => { S.activeSubmitTree = tree; },
  };
  // A minimal window.__bridge so @forge/react's reconcile has somewhere to go.
  if (!G.__bridge) {
    G.__bridge = {
      callBridge(cmd: string, data?: any): Promise<any> {
        switch (cmd) {
          case 'reconcile': {
            const doc = data?.forgeDoc;
            if (!doc) return Promise.resolve();
            if (doc.type === 'MacroConfig') { S.lastMacroConfigDoc = doc; dispatch(S.macroConfigReconcileListeners, doc); }
            else { S.lastForgeDoc = doc; dispatch(S.reconcileListeners, doc); }
            return Promise.resolve();
          }
          case 'getContext':
            return standIn!.rpc('getContext');
          case 'submit':
          case 'close':
          case 'onClose':
          case 'onError':
          case 'trackObjectStoreAction':
            return Promise.resolve();
          default:
            return Promise.reject(new Error(`[forge-sim] Bridge command "${cmd}" is not available without the dev server bundle.`));
        }
      },
    };
    if (typeof window !== 'undefined') (window as any).__bridge = G.__bridge;
  }
  return standIn;
}

/** The one seam: whatever installed window.__bridge (the bundle, or the stand-in). */
function callBridge(cmd: string, data?: any): Promise<any> {
  const bridge = G.__bridge ?? (localStandIn(), G.__bridge);
  return bridge.callBridge(cmd, data);
}

// ── Chrome hooks (ForgeSimShell, ForgeSimModulePage, GearPopover) ────────

export function onReconcile(listener: ReconcileListener): () => void {
  return hooks().onReconcile(listener);
}

export function onMacroConfigReconcile(listener: ReconcileListener): () => void {
  return hooks().onMacroConfigReconcile(listener);
}

/** Called by the shell whenever the user switches between View and Config tabs. */
export function setActiveSubmitTree(tree: 'view' | 'macroConfig') {
  G.__forgeSim.activeSubmitTree = tree;
  hooks().setActiveSubmitTree(tree);
}

/**
 * Raw dev-server RPC for forge-sim's own chrome (`getActingUserState`,
 * `searchUsers`, `setActingUser`, i18n). Not a Forge bridge command.
 */
export function rpc(method: string, params: any = {}): Promise<any> {
  return hooks().rpc(method, params);
}

// ── @forge/bridge public API ────────────────────────────────────────────
// Frames below mirror the real package file-for-file (node_modules/@forge/bridge/out).

export async function invoke<T = any>(functionKey: string, payload?: Record<string, any>): Promise<T> {
  return callBridge('invoke', { functionKey, payload }); // out/invoke/invoke.js
}

export function makeInvoke() {
  return invoke;
}

export const view = {
  getContext: () => callBridge('getContext'),
  // Bare payload, as out/view/submit.js sends it.
  submit: (payload?: any) => callBridge('submit', payload),
  close: (payload?: any) => callBridge('close', payload),
  onClose: (cb: () => Promise<void>) => callBridge('onClose', cb).then(() => undefined),
  open: () => callBridge('open'),
  refresh: (payload?: any) => callBridge('refresh', payload),
  createHistory: () => callBridge('createHistory'),
  theme: { enable: () => callBridge('enableTheming') },
  changeWindowTitle: (title: string) => callBridge('changeWindowTitle', title),
  emitReadyEvent: () => callBridge('emitReadyEvent'),
  createAdfRendererIframeProps: () => Promise.reject(new Error('ADF renderer not supported in forge-sim')),
};

/** Product fetch API — out/fetch/fetch.js framing. */
function makeProductFetch(product: string) {
  return async (restPath: string, fetchOptions?: RequestInit): Promise<Response> => {
    const result = await callBridge('fetchProduct', {
      product,
      restPath,
      fetchRequestInit: fetchOptions ? {
        method: fetchOptions.method,
        headers: fetchOptions.headers,
        body: fetchOptions.body,
      } : undefined,
    });
    return new Response(result.body, { status: result.status, statusText: result.statusText, headers: result.headers });
  };
}

export const requestJira = makeProductFetch('jira');
export const requestConfluence = makeProductFetch('confluence');
export const requestBitbucket = makeProductFetch('bitbucket');

/** Remote fetch — the path travels inside fetchRequestInit (out/fetch/fetch.js). */
export async function requestRemote(remoteKey: string, fetchOptions?: RequestInit & { path?: string }): Promise<Response> {
  const result = await callBridge('fetchRemote', {
    remoteKey,
    fetchRequestInit: fetchOptions ? {
      path: fetchOptions.path,
      method: fetchOptions.method,
      headers: fetchOptions.headers,
      body: fetchOptions.body,
    } : undefined,
  });
  return new Response(result.body, { status: result.status, statusText: result.statusText, headers: result.headers });
}

/** Modal API — same option normalisation and frame as out/modal/modal.js. */
export const Modal = class {
  private opts: any;
  constructor(opts?: any) {
    this.opts = {
      resource: opts?.resource ?? null,
      onClose: opts?.onClose ?? (() => {}),
      size: opts?.size ?? 'medium',
      context: opts?.context ?? {},
      closeOnEscape: opts?.closeOnEscape ?? true,
      closeOnOverlayClick: opts?.closeOnOverlayClick ?? true,
      title: opts?.title ?? '',
      icon: opts?.icon ?? '',
    };
  }
  async open(): Promise<void> {
    const success = await callBridge('openModal', this.opts);
    if (success === false) throw new BridgeAPIError('Unable to open modal.');
  }
  onClose(cb: () => void) { this.opts.onClose = cb; return Promise.resolve(); }
};

// ── showFlag — out/flag/flag.js ─────────────────────────────────────────

export function showFlag(options: {
  id?: number | string;
  title?: string;
  description?: string;
  type?: string;
  appearance?: string;
  actions?: Array<{ text: string; onClick?: () => void }>;
  isAutoDismiss?: boolean;
}): { close: () => Promise<boolean | void> } {
  // The real package throws without an id; keep callers working by minting one.
  const id = options.id ?? `forge-sim-flag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const result = callBridge('showFlag', { ...options, id, type: options.type ?? options.appearance ?? 'info' });
  return {
    close: async () => { await result; return callBridge('closeFlag', { id }); },
  };
}

// ── Router — out/router/router.js ───────────────────────────────────────

export const NavigationTarget = {
  ContentView: 'contentView' as const,
  ContentEdit: 'contentEdit' as const,
  ContentList: 'contentList' as const,
  SpaceView: 'spaceView' as const,
  Module: 'module' as const,
  UserProfile: 'userProfile' as const,
  Dashboard: 'dashboard' as const,
  Issue: 'issue' as const,
  ProjectSettingsDetails: 'projectSettingsDetails' as const,
};

type NavigationLocation = { target: string; [key: string]: any };

export const router = {
  navigate: (location: string | NavigationLocation): Promise<void> =>
    typeof location === 'string'
      ? callBridge('navigate', { url: location, type: 'same-tab' })
      : callBridge('navigate', { ...location, type: 'same-tab' }),
  open: (location: string | NavigationLocation): Promise<void> =>
    typeof location === 'string'
      ? callBridge('navigate', { url: location, type: 'new-tab' })
      : callBridge('navigate', { ...location, type: 'new-tab' }),
  getUrl: async (location: string | NavigationLocation): Promise<URL | null> => {
    // The real package requires a NavigationLocation; a string is accepted
    // here as a convenience and resolved the same way.
    const frame = typeof location === 'string' ? { target: 'url', url: location } : location;
    const url = await callBridge('getUrl', frame);
    try { return url ? new URL(url) : null; } catch { return null; }
  },
  reload: (): Promise<void> => callBridge('reload'),
};

// ── Events — out/events/events.js ───────────────────────────────────────

export const events = {
  emit: (event: string, payload?: any): Promise<void> => callBridge('emit', { event, payload }),
  on: (event: string, callback: (payload?: any) => any): Promise<{ unsubscribe: () => void }> =>
    callBridge('on', { event, callback }),
  emitPublic: (event: string, payload?: any): Promise<void> => callBridge('emitPublic', { event, payload }),
  onPublic: (event: string, callback: (payload?: any) => any): Promise<{ unsubscribe: () => void }> =>
    callBridge('onPublic', { event, callback }),
};

// ── Permissions ─────────────────────────────────────────────────────────

/**
 * Matches real @forge/bridge's permissions export: an egress/remote
 * permission ADMIN api, not a checker. (The old sim-invented check()/request()
 * never existed upstream — scope checks live in checkPermissions /
 * createPermissionUtils above.) Managing runtime egress rules is not
 * simulated yet, so every call fails loudly. Mirrors src/shims/forge-bridge.ts.
 */
const permissionsNotImplemented = (name: string) => () =>
  Promise.reject(
    new Error(
      `permissions.${name} is not yet implemented in forge-sim (runtime egress/remote ` +
        'permission management). It works in real Forge — this is a simulator gap, not an app bug.',
    ),
  );

export const permissions = {
  egress: {
    get: permissionsNotImplemented('egress.get') as (payload: any) => Promise<any>,
    set: permissionsNotImplemented('egress.set') as (payload: any) => Promise<any>,
    deleteDomain: permissionsNotImplemented('egress.deleteDomain') as (payload: any) => Promise<void>,
    deleteGroup: permissionsNotImplemented('egress.deleteGroup') as (payload: any) => Promise<void>,
  },
  remote: {
    get: permissionsNotImplemented('remote.get') as (payload: any) => Promise<any>,
    set: permissionsNotImplemented('remote.set') as (payload: any) => Promise<void>,
  },
};

// ── i18n (bridge-level) ─────────────────────────────────────────────────
//
// Deliberately still on rpc(): real @forge/bridge's i18n has NO callBridge
// seam — it fetch()es ./__LOCALES__/*.json relative to the page. Moving
// this means serving those files from the dev server (a later phase of the
// bridge consolidation), not adding a callBridge command that the real
// package would never send.

export const i18n = {
  getLocale: (): Promise<string> => {
    if (typeof navigator !== 'undefined') return Promise.resolve(navigator.language);
    return Promise.resolve('en-US');
  },
  getTranslations: (locale?: string, options?: any) => rpc('getContext').then((ctx: any) => {
    return rpc('i18nGetTranslations', { locale: locale ?? ctx.locale, options });
  }).catch(() => ({ locale: locale ?? 'en-US', translations: null })),
  createTranslationFunction: (locale?: string) => rpc('getContext').then((ctx: any) => {
    return rpc('i18nCreateTranslationFunction', { locale: locale ?? ctx.locale });
  }).catch(() => ((key: string, defaultValue?: string) => defaultValue ?? key)),
  resetTranslationsCache: (): void => {
    rpc('i18nResetTranslationsCache', {}).catch(() => {});
  },
};

// ── Feature flags ───────────────────────────────────────────────────────

/**
 * Matches real @forge/bridge's FeatureFlags class (the old lowercase
 * `featureFlags` object with evaluate/checkBooleanFlag/checkStringFlag never
 * existed upstream). The simulator has no flag definitions, so every flag
 * evaluates to its defaultValue — the same result a real app gets for a flag
 * that doesn't exist.
 */
export class FeatureFlags {
  private initialized = false;

  async initialize(_user: { identifier: string }, _config?: { environment?: string }): Promise<void> {
    this.initialized = true;
  }

  checkFlag(_flagName: string, defaultValue = false): boolean {
    if (!this.initialized) {
      throw new Error('FeatureFlags not initialized. Call initialize() first.');
    }
    return defaultValue;
  }

  shutdown(): void {
    this.initialized = false;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

// ── Rovo / Teamwork Graph / misc parity exports ─────────────────────────
// Mirrors src/shims/forge-bridge.ts — keep behavior in sync between the Node
// shim and this browser shim until the contract suite covers both.

export const rovo = {
  open(_openRovoPayload: unknown): Promise<void> {
    return Promise.reject(
      new Error(
        'rovo.open is not yet implemented in forge-sim (planned alongside the ' +
          'rovo:mcp / rovo:skill modules). Gate calls behind rovo.isEnabled(), ' +
          'which returns false in the simulator.',
      ),
    );
  },
  isEnabled(): Promise<boolean> {
    return Promise.resolve(false);
  },
};

export function requestTeamworkGraph(_query: string, _variables?: Record<string, unknown>): Promise<never> {
  return Promise.reject(
    new Error(
      'requestTeamworkGraph is not yet implemented in forge-sim (planned for the ' +
        'Teamwork Graph shim, roadmap 0.3 / issue #47). It works in real Forge — ' +
        'this is a simulator gap, not an app bug.',
    ),
  );
}

export function fetchUserRecommendations(_input: { query?: string }): Promise<never> {
  return Promise.reject(
    new Error(
      'fetchUserRecommendations is not yet implemented in forge-sim. It works in ' +
        'real Forge — this is a simulator gap, not an app bug.',
    ),
  );
}

/** Counters resolve like production's fire-and-forget; nothing is aggregated. */
export const frontendCustomMetrics = {
  counter(name: string) {
    return {
      incr(): Promise<void> {
        return Promise.resolve();
      },
      incrBy(value: number): Promise<void> {
        if (!(value > 0)) {
          return Promise.reject(new Error(`Counter '${name}' incrBy value must be a positive number, got ${value}`));
        }
        return Promise.resolve();
      },
    };
  },
};

type RuntimePermissions = {
  scopes?: string[] | Record<string, unknown>;
  // Real type is @forge/manifest's External shape — kept loose here
  external?: any;
};

export function createPermissionUtils(runtimePermissions: RuntimePermissions | undefined) {
  if (!runtimePermissions) return null;
  const { scopes, external = {} } = runtimePermissions;
  const scopeArray = Array.isArray(scopes) ? scopes : Object.keys(scopes ?? {});
  const egressNotImplemented = (method: string) => {
    throw new Error(
      `${method} is not yet implemented in forge-sim (real @forge/bridge matches ` +
        `URLs with @forge/egress CSP rules). Scope checks (hasScope, getScopes, ` +
        `checkPermissions scopes) are fully supported.`,
    );
  };
  return {
    hasScope: (scope: string) => scopeArray.includes(scope),
    canFetchFrom: (_type: string, _url: string): boolean => egressNotImplemented('canFetchFrom'),
    canLoadResource: (_type: string, _url: string): boolean => egressNotImplemented('canLoadResource'),
    getScopes: () => scopeArray,
    getExternalPermissions: () => external,
    hasAnyPermissions: () => scopeArray.length > 0 || Object.keys(external).length > 0,
  };
}

export async function checkPermissions(
  requiredPermissions: { scopes?: string[]; external?: Record<string, unknown>; content?: Record<string, unknown> },
  runtimePermissions?: RuntimePermissions,
): Promise<{ granted: boolean; missing: { scopes?: string[] } | null }> {
  if (!requiredPermissions) {
    return { granted: false, missing: null };
  }
  if (requiredPermissions.external && Object.keys(requiredPermissions.external).length > 0) {
    throw new Error(
      'checkPermissions with external requirements is not yet implemented in ' +
        'forge-sim (needs the @forge/egress URL matcher). Scope-only checks are ' +
        'fully supported.',
    );
  }
  if (!requiredPermissions.scopes?.length) {
    return { granted: true, missing: null };
  }
  let permissionsToCheck = runtimePermissions;
  if (!permissionsToCheck) {
    const context = await view.getContext();
    permissionsToCheck = (context as any)?.permissions;
  }
  const utils = createPermissionUtils(permissionsToCheck);
  if (!utils) {
    return { granted: false, missing: null };
  }
  const missingScopes = requiredPermissions.scopes.filter(scope => !utils.hasScope(scope));
  return missingScopes.length > 0
    ? { granted: false, missing: { scopes: missingScopes } }
    : { granted: true, missing: null };
}

// ── Realtime (Preview) — out/realtime/realtime.js ──────────────────────
// Channel identity and token/override validation live on the dev server
// (realtimeSubscribe RPC → realtime.resolveSubscriptionKey), so dev mode and
// headless key identically and this file carries none of the algorithm.

export const realtime = {
  subscribe: (
    channel: string,
    callback: (payload?: string | Record<string, unknown>) => any,
    options?: { replaySeconds?: number; token?: string; contextOverrides?: string[] },
  ): Promise<{ unsubscribe: () => void }> =>
    callBridge('subscribeRealtimeChannel', { channelName: channel, onEvent: callback, options }),
  subscribeGlobal: (
    channel: string,
    callback: (payload?: string | Record<string, unknown>) => any,
    options?: { replaySeconds?: number; token?: string; contextOverrides?: string[] },
  ): Promise<{ unsubscribe: () => void }> =>
    callBridge('subscribeRealtimeChannel', { channelName: channel, onEvent: callback, options, isGlobal: true }),
  publish: (
    channel: string,
    payload: string | Record<string, unknown>,
    options?: { token?: string; contextOverrides?: string[] },
  ): Promise<{ eventId: string | null; eventTimestamp: string | null; errors?: Array<{ message: string }> }> =>
    callBridge('publishRealtimeChannel', { channelName: channel, eventPayload: payload, options }),
  publishGlobal: (
    channel: string,
    payload: string | Record<string, unknown>,
    options?: { token?: string; contextOverrides?: string[] },
  ): Promise<{ eventId: string | null; eventTimestamp: string | null; errors?: Array<{ message: string }> }> =>
    callBridge('publishRealtimeChannel', { channelName: channel, eventPayload: payload, options, isGlobal: true }),
};

// ── Object Store bridge surface ─────────────────────────────────────────
//
// Ported from real @forge/bridge 6.x `out/object-store/*` — same validation
// messages, result shapes, and checksum-mapping flow. Uses this shim's
// invoke() (RPC to the sim backend) + the browser's native fetch() against
// the dev server's /__object-store/<token> pre-signed URLs.

/** Matches @forge/bridge's BridgeAPIError (a bare Error subclass). */
export class BridgeAPIError extends Error {}

const OBJECT_STORE_RESTRICTED_ERROR =
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
    throw new BridgeAPIError(OBJECT_STORE_RESTRICTED_ERROR);
  }
}

function base64ToBlob(base64: string, mimeType?: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType || 'application/octet-stream' });
}

async function getUploadObjectMetadata(blob: Blob): Promise<{ length: number; checksum: string; checksumType: 'SHA256' }> {
  const arrayBuffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const checksum = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
  return { length: blob.size, checksum, checksumType: 'SHA256' };
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
      throw new BridgeAPIError(`Invalid base64 data at index ${index}. The data string must be valid base64 encoded.`);
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
        return { success: false, key, status: 503, error: error instanceof Error ? error.message : 'Upload failed' };
      }
    })();
    return { promise: uploadPromise, index, objectType: object.type, objectSize: object.size };
  });
}

export const objectStore = {
  async upload({ functionKey, objects }: { functionKey: string; objects: Array<Blob | Base64Object> }): Promise<UploadResult[]> {
    await checkRestrictedEnvironment();
    const uploadPromises = await createUploadPromises({ functionKey, objects });
    return Promise.all(uploadPromises.map((item) => item.promise));
  },

  async download({ functionKey, keys }: { functionKey: string; keys: string[] }): Promise<DownloadResult[]> {
    await checkRestrictedEnvironment();
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
          return { success: false, key, status: 503, error: error instanceof Error ? error.message : 'Download failed' };
        }
      }),
    );
  },

  async getMetadata({ functionKey, keys }: { functionKey: string; keys: string[] }): Promise<Array<Record<string, unknown>>> {
    await checkRestrictedEnvironment();
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
  },

  async delete({ functionKey, keys }: { functionKey: string; keys: string[] }): Promise<void> {
    await checkRestrictedEnvironment();
    if (!functionKey || functionKey.length === 0) {
      throw new BridgeAPIError('functionKey is required to delete objects');
    }
    if (!Array.isArray(keys) || keys.length === 0) {
      throw new BridgeAPIError('keys array is required and must not be empty');
    }
    await Promise.all(keys.map(async (key) => { await invoke(functionKey, { key }); }));
  },
};
