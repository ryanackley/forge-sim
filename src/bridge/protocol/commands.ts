/**
 * The bridge command registry — every command the seam can receive.
 *
 * Derived from the installed packages, not from memory:
 *   grep -rhoE "callBridge\)?\('[A-Za-z]+'" node_modules/@forge/{bridge,react}/out
 * `src/__tests__/bridge-protocol.test.ts` re-derives this list from the
 * installed `@forge/bridge` and `@forge/react` on every run, so a package
 * bump that adds a command fails CI here rather than surfacing as an
 * `undefined` inside some app.
 *
 * The dispatcher routes every listed command to a `BridgeHost` method, except
 * those marked `unsupported`, which throw with the stated reason. There is
 * deliberately no "handled locally vs over RPC" tag any more — that was a
 * property of one host, not of the protocol.
 */

export interface BridgeCommandSpec {
  /** The `@forge/bridge` module that emits it (`out/<source>`), or `@forge/react`. */
  source: string;
  /** One line on what the app is asking for. */
  summary: string;
  /**
   * Present when real Forge supports the command and forge-sim does not.
   * The dispatcher throws `bridgeNotImplementedError` with this reason —
   * never a silent no-op.
   */
  unsupported?: string;
}

export const BRIDGE_COMMANDS: Readonly<Record<string, BridgeCommandSpec>> = {
  // ── Reconciler (from @forge/react, not @forge/bridge) ────────────────
  reconcile: { source: '@forge/react', summary: 'ForgeDoc tree for the host to render' },
  onError: { source: '@forge/react', summary: 'App-level error report' },

  // ── Resolver + HTTP ──────────────────────────────────────────────────
  invoke: { source: 'invoke/invoke.js', summary: 'Call a resolver; with invokeType, an endpoint (invokeRemote/invokeService)' },
  fetchProduct: { source: 'fetch/fetch.js', summary: 'requestJira / requestConfluence / requestBitbucket' },
  fetchRemote: { source: 'fetch/fetch.js', summary: 'requestRemote — path travels inside fetchRequestInit' },

  // ── View ─────────────────────────────────────────────────────────────
  getContext: { source: 'view/getContext.js', summary: 'Product context for this placement' },
  submit: { source: 'view/submit.js', summary: 'view.submit() — custom field / config save' },
  close: { source: 'view/close.js', summary: 'view.close()' },
  onClose: { source: 'view/onClose.js', summary: 'Register a close callback' },
  refresh: { source: 'view/refresh.js', summary: 'view.refresh() — re-render the module' },
  open: { source: 'view/open.js', summary: 'view.open()' },
  createHistory: { source: 'view/createHistory.js', summary: 'Browser-history object for Custom UI routing' },
  enableTheming: { source: 'view/theme.js', summary: 'Opt into host theme tokens' },
  changeWindowTitle: { source: 'view/changeWindowTitle.js', summary: 'Set the document title' },
  emitReadyEvent: { source: 'view/emitReadyEvent.js', summary: 'App signals it finished first paint' },
  getFrameDispatch: { source: 'view/getFrameDispatch.js', summary: 'Internal frame dispatch handle', unsupported: 'view.getFrameDispatch() is a Forge-internal frame API with no simulated equivalent' },

  // ── Router ───────────────────────────────────────────────────────────
  navigate: { source: 'router/router.js', summary: 'router.navigate() — host-level navigation' },
  reload: { source: 'router/router.js', summary: 'router.reload()' },
  getUrl: { source: 'router/router.js', summary: 'router.getUrl() — the iframe placement URL' },

  // ── Flags ────────────────────────────────────────────────────────────
  showFlag: { source: 'flag/flag.js', summary: 'showFlag() — host notification' },
  closeFlag: { source: 'flag/flag.js', summary: 'Flag.close()' },

  // ── Modal ────────────────────────────────────────────────────────────
  openModal: { source: 'modal/modal.js', summary: 'Modal.open() — host-drawn modal around a module' },

  // ── Cross-module events ──────────────────────────────────────────────
  emit: { source: 'events/events.js', summary: 'events.emit() — app-private channel' },
  on: { source: 'events/events.js', summary: 'events.on() — app-private subscription' },
  emitPublic: { source: 'events/events.js', summary: 'events.emitPublic() — cross-app channel' },
  onPublic: { source: 'events/events.js', summary: 'events.onPublic() — cross-app subscription' },

  // ── Realtime (preview) ───────────────────────────────────────────────
  publishRealtimeChannel: { source: 'realtime/realtime.js', summary: 'realtime.publish() / publishGlobal()' },
  subscribeRealtimeChannel: { source: 'realtime/realtime.js', summary: 'realtime.subscribe() / subscribeGlobal() — callback stays in the frame' },

  // ── Object Store ─────────────────────────────────────────────────────
  trackObjectStoreAction: { source: 'object-store/*.js', summary: 'Fire-and-forget analytics before every objectStore call' },

  // ── Internal / platform telemetry ────────────────────────────────────
  getFrameId: { source: 'internal/index.js', summary: 'Opaque id for this frame' },
  emitFrontendCustomMetric: { source: 'frontendCustomMetrics/frontendCustomMetrics.js', summary: 'App performance metric — inert locally' },
  initFeatureFlags: { source: 'featureFlags/initFeatureFlags.js', summary: 'Feature-flag client bootstrap' },

  // ── Rovo / Teamwork Graph ────────────────────────────────────────────
  isRovoEnabled: { source: 'rovo/isEnabled.js', summary: 'Whether Rovo is available on the site' },
  openRovo: { source: 'rovo/open.js', summary: 'Open the Rovo chat panel', unsupported: 'Rovo chat is a host surface forge-sim does not render' },
  requestTeamworkGraph: { source: 'requestTeamworkGraph/index.js', summary: 'Teamwork Graph query', unsupported: 'Teamwork Graph has no simulated backend' },
  fetchUserRecommendations: { source: 'fetch/index.js', summary: 'User recommendations service', unsupported: 'the user-recommendations service has no simulated backend' },
};
/** True when the registry knows the command and no host is expected to answer it. */
export function isUnsupportedBridgeCommand(cmd: string): boolean {
  const spec = BRIDGE_COMMANDS[cmd];
  return !!spec && typeof spec.unsupported === 'string';
}

/**
 * The error an unsupported command must raise. Silence is the one thing the
 * seam must never produce: `undefined` makes the app fail somewhere
 * unrelated, which is exactly how the #40 bridge bugs hid.
 */
export function bridgeNotImplementedError(cmd: string): Error {
  const spec = BRIDGE_COMMANDS[cmd];
  const why = spec && spec.unsupported ? spec.unsupported : 'it is not implemented in forge-sim';
  return new Error(`[forge-sim] Bridge command "${cmd}" is not supported: ${why}.`);
}

/** The error for a command the registry has never heard of. */
export function unknownBridgeCommandError(cmd: string): Error {
  return new Error(
    `[forge-sim] Unknown bridge command "${cmd}". If a newer @forge/bridge added it, ` +
      'add it to src/bridge/protocol/commands.ts and implement it on BridgeHost.',
  );
}
