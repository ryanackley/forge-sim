/**
 * Bridge command table — browser mirror.
 *
 * ⚠️ GENERATED MIRROR of `src/bridge-commands.ts`. Everything below the
 * header is copied verbatim from that file. Do NOT hand-edit this file:
 * change the canonical module, then run
 * `node scripts/sync-bridge-commands-mirror.mjs`.
 *
 * This duplicate exists only to cross a build boundary. The renderer is a
 * separate build whose tsconfig is `"include": ["src"]` (meaning
 * `renderer/src`), so it cannot import from the parent `src/`.
 *
 * `src/__tests__/bridge-command-parity.test.ts` imports BOTH files and
 * asserts identical output over a matrix of frames, so divergence fails CI
 * instead of silently giving dev-mode and headless different bridge
 * behaviour.
 */

/** What a host is expected to do with a command. */
export type BridgeDisposition =
  /** Translated to a dev-server RPC by `translateBridgeCommand` (browser hosts). */
  | 'rpc'
  /** Answered inside the host — DOM, local listeners, reconcile capture. */
  | 'local'
  /** Real Forge supports it; forge-sim does not yet. Must throw, never no-op. */
  | 'unsupported';

export interface BridgeCommandSpec {
  /** How hosts answer it. */
  disposition: BridgeDisposition;
  /** The `@forge/bridge` module that emits it (`out/<source>`), or `@forge/react`. */
  source: string;
  /** One line on what the app is asking for. */
  summary: string;
  /** For `unsupported`: what the thrown error should tell the user. */
  notImplemented?: string;
}

/**
 * Every command the seam can receive. Derived from the real packages:
 *   grep -rhoE "callBridge\)?\('[A-Za-z]+'" node_modules/@forge/{bridge,react}/out
 * Keep it in step when a `@forge/bridge` bump adds one — the contract suite
 * (#10) pins the version, and `bridge-command-parity.test.ts` re-derives this
 * list from the installed package so a new command fails CI.
 */
export const BRIDGE_COMMANDS: Record<string, BridgeCommandSpec> = {
  // ── Reconciler (from @forge/react, not @forge/bridge) ────────────────
  reconcile: { disposition: 'local', source: '@forge/react', summary: 'ForgeDoc tree for the host to render' },
  onError: { disposition: 'local', source: '@forge/react', summary: 'App-level error report' },

  // ── Resolver + HTTP ──────────────────────────────────────────────────
  invoke: { disposition: 'rpc', source: 'invoke/invoke.js', summary: 'Call a resolver; with invokeType, an endpoint (invokeRemote/invokeService)' },
  fetchProduct: { disposition: 'rpc', source: 'fetch/fetch.js', summary: 'requestJira / requestConfluence / requestBitbucket' },
  fetchRemote: { disposition: 'rpc', source: 'fetch/fetch.js', summary: 'requestRemote — path travels inside fetchRequestInit' },

  // ── View ─────────────────────────────────────────────────────────────
  getContext: { disposition: 'rpc', source: 'view/getContext.js', summary: 'Product context for this placement' },
  submit: { disposition: 'rpc', source: 'view/submit.js', summary: 'view.submit() — custom field / config save' },
  close: { disposition: 'rpc', source: 'view/close.js', summary: 'view.close()' },
  onClose: { disposition: 'local', source: 'view/onClose.js', summary: 'Register a close callback' },
  refresh: { disposition: 'local', source: 'view/refresh.js', summary: 'view.refresh() — re-render the module' },
  open: { disposition: 'local', source: 'view/open.js', summary: 'view.open()' },
  createHistory: { disposition: 'local', source: 'view/createHistory.js', summary: 'Browser-history object for Custom UI routing' },
  enableTheming: { disposition: 'local', source: 'view/theme.js', summary: 'Opt into host theme tokens' },
  changeWindowTitle: { disposition: 'local', source: 'view/changeWindowTitle.js', summary: 'Set the document title' },
  emitReadyEvent: { disposition: 'local', source: 'view/emitReadyEvent.js', summary: 'App signals it finished first paint' },
  getFrameDispatch: { disposition: 'unsupported', source: 'view/getFrameDispatch.js', summary: 'Internal frame dispatch handle', notImplemented: 'view.getFrameDispatch() is a Forge-internal frame API with no simulated equivalent' },

  // ── Router ───────────────────────────────────────────────────────────
  navigate: { disposition: 'local', source: 'router/router.js', summary: 'router.navigate() — host-level navigation' },
  reload: { disposition: 'local', source: 'router/router.js', summary: 'router.reload()' },
  getUrl: { disposition: 'local', source: 'router/router.js', summary: 'router.getUrl() — the iframe placement URL' },

  // ── Flags ────────────────────────────────────────────────────────────
  showFlag: { disposition: 'local', source: 'flag/flag.js', summary: 'showFlag() — host notification' },
  closeFlag: { disposition: 'local', source: 'flag/flag.js', summary: 'Flag.close()' },

  // ── Modal ────────────────────────────────────────────────────────────
  openModal: { disposition: 'local', source: 'modal/modal.js', summary: 'Modal.open() — host-drawn modal around a module' },

  // ── Cross-module events ──────────────────────────────────────────────
  emit: { disposition: 'local', source: 'events/events.js', summary: 'events.emit() — app-private channel' },
  on: { disposition: 'local', source: 'events/events.js', summary: 'events.on() — app-private subscription' },
  emitPublic: { disposition: 'local', source: 'events/events.js', summary: 'events.emitPublic() — cross-app channel' },
  onPublic: { disposition: 'local', source: 'events/events.js', summary: 'events.onPublic() — cross-app subscription' },

  // ── Realtime (preview) ───────────────────────────────────────────────
  publishRealtimeChannel: { disposition: 'rpc', source: 'realtime/realtime.js', summary: 'realtime.publish() / publishGlobal()' },
  subscribeRealtimeChannel: { disposition: 'local', source: 'realtime/realtime.js', summary: 'realtime.subscribe() / subscribeGlobal() — callback stays in the frame' },

  // ── Object Store ─────────────────────────────────────────────────────
  trackObjectStoreAction: { disposition: 'local', source: 'object-store/*.js', summary: 'Fire-and-forget analytics before every objectStore call' },

  // ── Internal / platform telemetry ────────────────────────────────────
  getFrameId: { disposition: 'local', source: 'internal/index.js', summary: 'Opaque id for this frame' },
  emitFrontendCustomMetric: { disposition: 'local', source: 'frontendCustomMetrics/frontendCustomMetrics.js', summary: 'App performance metric — inert locally' },
  initFeatureFlags: { disposition: 'local', source: 'featureFlags/initFeatureFlags.js', summary: 'Feature-flag client bootstrap' },

  // ── Rovo / Teamwork Graph ────────────────────────────────────────────
  isRovoEnabled: { disposition: 'local', source: 'rovo/isEnabled.js', summary: 'Whether Rovo is available on the site' },
  openRovo: { disposition: 'unsupported', source: 'rovo/open.js', summary: 'Open the Rovo chat panel', notImplemented: 'Rovo chat is a host surface forge-sim does not render' },
  requestTeamworkGraph: { disposition: 'unsupported', source: 'requestTeamworkGraph/index.js', summary: 'Teamwork Graph query', notImplemented: 'Teamwork Graph has no simulated backend' },
  fetchUserRecommendations: { disposition: 'unsupported', source: 'fetch/index.js', summary: 'User recommendations service', notImplemented: 'the user-recommendations service has no simulated backend' },
};

/** A dev-server RPC call produced from a bridge frame. */
export interface BridgeRpcCall {
  method: string;
  params: Record<string, any>;
}

/** Placement data the host knows and the app never sends in the frame. */
export interface BridgeCallContext {
  /** Module key for the current placement (from the page URL in dev). */
  moduleKey?: string;
  /** Placement overrides from the page query string, if any. */
  contextOptions?: any;
  /** For `submit`: which reconcile tree the payload came from. */
  submitTree?: string;
}

/**
 * Translate a real `@forge/bridge` frame into a dev-server RPC call.
 *
 * Returns `null` for any command that is not `disposition: 'rpc'` — the
 * caller then runs its own local handler (or throws for `unsupported`).
 *
 * MUST STAY SELF-CONTAINED — see the file header. No imports, no references
 * to anything outside this function body.
 */
export function translateBridgeCommand(
  cmd: string,
  data: any,
  ctx: BridgeCallContext,
): BridgeRpcCall | null {
  switch (cmd) {
    case 'invoke': {
      // Endpoint invocations ride the SAME command, distinguished only by
      // `invokeType: 'ui-remote-fetch' | 'ui-container-fetch'`
      // (out/invoke-endpoint/invoke-endpoint.js). They carry no functionKey,
      // so treating them as a resolver call hangs the app's promise.
      const invokeType = data && data.invokeType;
      if (typeof invokeType === 'string' && /^ui-(remote|container)-fetch$/.test(invokeType)) {
        if (invokeType === 'ui-container-fetch') {
          throw new Error(
            'invokeService is not yet implemented in forge-sim (Container services are ' +
              'an Atlassian developer preview, tracked as roadmap watch item #19).',
          );
        }
        return {
          method: 'invokeRemote',
          params: {
            path: data.path,
            method: data.method,
            headers: data.headers,
            body: data.body,
            moduleKey: ctx.moduleKey,
          },
        };
      }
      return {
        method: 'invoke',
        params: {
          functionKey: data && data.functionKey,
          payload: data && data.payload,
          moduleKey: ctx.moduleKey,
          contextOptions: ctx.contextOptions,
        },
      };
    }

    case 'fetchProduct':
      return {
        method: 'fetchProduct',
        params: {
          product: data && data.product,
          restPath: data && data.restPath,
          fetchRequestInit: data && data.fetchRequestInit,
        },
      };

    case 'fetchRemote':
      // The path lives inside fetchRequestInit (out/fetch/fetch.js). A
      // top-level `path` is accepted too — forge-sim's own shim used to send
      // that shape, and the dev-server RPC still honours both.
      return {
        method: 'fetchRemote',
        params: {
          remoteKey: data && data.remoteKey,
          path: data && data.path,
          fetchRequestInit: data && data.fetchRequestInit,
        },
      };

    case 'getContext':
      // Sent with no frame at all (out/view/getContext.js) — everything the
      // dev server needs comes from the host's own placement knowledge.
      return {
        method: 'getContext',
        params: { moduleKey: ctx.moduleKey, contextOptions: ctx.contextOptions },
      };

    case 'submit':
      // Real frame is the bare payload (out/view/submit.js), not { payload }.
      return {
        method: 'viewSubmit',
        params: {
          payload: data && data.payload !== undefined ? data.payload : data,
          moduleKey: ctx.moduleKey,
          submitTree: ctx.submitTree,
        },
      };

    case 'close':
      return {
        method: 'viewClose',
        params: { payload: data && data.payload !== undefined ? data.payload : data },
      };

    case 'publishRealtimeChannel': {
      // { channelName, eventPayload, options, isGlobal? } — out/realtime/realtime.js.
      // Scoped publishes carry the frame's own placement so publish and
      // subscribe derive the same channel identity; global ones must not.
      const isGlobal = !!(data && data.isGlobal);
      const params: Record<string, any> = {
        channel: data && data.channelName,
        payload: data && data.eventPayload,
        global: isGlobal,
        options: data && data.options,
      };
      if (!isGlobal) {
        params.moduleKey = ctx.moduleKey;
        params.contextOptions = ctx.contextOptions;
      }
      return { method: 'realtimePublish', params };
    }

    default:
      return null;
  }
}

/**
 * The error an `unsupported` command must raise. Silence is the one thing a
 * host must not do: returning `undefined` makes the app fail somewhere
 * unrelated, which is exactly how the #40 bridge bugs hid.
 */
export function bridgeNotImplementedError(cmd: string): Error {
  const spec = BRIDGE_COMMANDS[cmd];
  const why = spec && spec.notImplemented ? spec.notImplemented : 'it is not implemented in forge-sim';
  return new Error(`[forge-sim] Bridge command "${cmd}" is not supported: ${why}.`);
}
