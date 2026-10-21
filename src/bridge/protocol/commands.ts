/**
 * The bridge command registry — every command the seam can receive.
 *
 * Derived from the installed packages, not from memory:
 *   grep -rhoE "[cC]allBridge[)([:space:]]+\('[A-Za-z]+'" node_modules/@forge/<pkg>/out
 * `src/__tests__/bridge-protocol.test.ts` re-derives this list on every run
 * from the five packages that can reach the seam — `@forge/bridge`,
 * `@forge/react`, and the three product bridges — so a package bump that
 * adds a command fails CI here rather than surfacing as an `undefined`
 * inside some app. (Note the capital-C alternative: the product bridges call
 * `getCallBridge()('cmd')` inline, with no lowercase local to match — and
 * the leading underscore: the permissions commands are `__permission__*`.)
 *
 * The dispatcher routes every listed command to a `BridgeHost` method, except
 * those marked `unsupported`, which throw with the stated reason. There is
 * deliberately no "handled locally vs over RPC" tag any more — that was a
 * property of one host, not of the protocol.
 */

export interface BridgeCommandSpec {
  /**
   * Where it comes from: the `@forge/bridge` module (`out/<source>`), or
   * `@forge/react`, or `<package> <module>` for a product bridge.
   */
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
  // @forge/confluence-bridge's updateBylineProperties() rides this same
  // command with event 'FORGE_CONTENT_PROPERTY_UPDATED'
  // (confluence-bridge out/content/updateBylineProperties.js) — no separate
  // command, so it needs no separate entry.
  emit: { source: 'events/events.js', summary: 'events.emit() — app-private channel; also Confluence byline updates' },
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

  // ── Runtime permission administration ────────────────────────────────
  // permissions.egress.* / permissions.remote.* (out/permissions/permissions.js:7-22)
  // manage an installation's runtime egress and remote rules. Nothing in the
  // sim models those rules, so every one rejects with a reason — the posture
  // the old shim had, now at the seam so bundled apps get it too.
  __permission__egressGet: { source: 'permissions/permissions.js', summary: 'permissions.egress.get()', unsupported: 'runtime egress permission management is not simulated' },
  __permission__egressSet: { source: 'permissions/permissions.js', summary: 'permissions.egress.set()', unsupported: 'runtime egress permission management is not simulated' },
  __permission__egressDeleteDomain: { source: 'permissions/permissions.js', summary: 'permissions.egress.deleteDomain()', unsupported: 'runtime egress permission management is not simulated' },
  __permission__egressDeleteGroup: { source: 'permissions/permissions.js', summary: 'permissions.egress.deleteGroup()', unsupported: 'runtime egress permission management is not simulated' },
  __permission__remoteGet: { source: 'permissions/permissions.js', summary: 'permissions.remote.get()', unsupported: 'runtime remote permission management is not simulated' },
  __permission__remoteSet: { source: 'permissions/permissions.js', summary: 'permissions.remote.set()', unsupported: 'runtime remote permission management is not simulated' },

  // ── Rovo / Teamwork Graph ────────────────────────────────────────────
  isRovoEnabled: { source: 'rovo/isEnabled.js', summary: 'Whether Rovo is available on the site' },
  openRovo: { source: 'rovo/open.js', summary: 'Open the Rovo chat panel', unsupported: 'Rovo chat is a host surface forge-sim does not render' },
  requestTeamworkGraph: { source: 'requestTeamworkGraph/index.js', summary: 'Teamwork Graph query', unsupported: 'Teamwork Graph has no simulated backend' },
  fetchUserRecommendations: { source: 'fetch/index.js', summary: 'User recommendations service', unsupported: 'the user-recommendations service has no simulated backend' },

  // ── Product bridges ──────────────────────────────────────────────────
  // @forge/{jira,confluence,dashboards}-bridge drive HOST PRODUCT chrome.
  // forge-sim renders no product around the app, so every one of these is
  // answered inertly — by BOTH hosts, from the shared implementation in
  // `src/bridge/hosts/product-surfaces.ts`. They are supported, not
  // `unsupported:`: the app's call is a legitimate thing to do and the real
  // packages validate what comes back, so each needs a real (if empty)
  // answer rather than a throw.
  openIssueViewModal: { source: '@forge/jira-bridge modal/issue-view.js', summary: 'ViewIssueModal.open() — host-drawn Jira issue modal' },
  openIssueCreateModal: { source: '@forge/jira-bridge modal/issue-create.js', summary: 'CreateIssueModal.open() — host-drawn Jira create-issue modal' },
  refreshIssueView: { source: '@forge/jira-bridge issue-utils/refresh.js', summary: 'refreshIssueView() — ask Jira to reload the issue view' },
  setWorkflowRuleConfigurationCallback: { source: '@forge/jira-bridge workflow/onConfigure.js', summary: 'workflowRules.onConfigure() — register the workflow-rule config callback' },
  getCustomFieldInternalAPI: { source: '@forge/jira-bridge custom-field/getCustomFieldInternalAPI.js', summary: 'Internal custom-field API backing customFieldApi.getFieldData()' },
  getUiModificationsInternalAPI: { source: '@forge/jira-bridge ui-modifications/getInternalAPI.js', summary: 'Internal API backing uiModificationsApi.onInit()/onChange()' },
  getEditorContent: { source: '@forge/confluence-bridge content/getEditorContent.js', summary: 'Current Confluence editor content' },
  getMacroContent: { source: '@forge/confluence-bridge content/getMacroContent.js', summary: 'Current Confluence macro body' },
  updateMacro: { source: '@forge/confluence-bridge content/updateMacro.js', summary: 'Write a macro body back to the Confluence editor' },
  setMacroViewportHeight: { source: '@forge/confluence-bridge content/setMacroViewportHeight.js', summary: 'Resize the macro viewport in the Confluence editor' },
  getWidgetEditApi: { source: '@forge/dashboards-bridge widgets/edit/utils/get-widget-edit-bridge.js', summary: 'Internal API backing widgetEdit.onSave()/onProductSave()/onSaveError()/updateConfig()' },
  getWidgetApi: { source: '@forge/dashboards-bridge widgets/view/utils/get-widget-bridge.js', summary: 'Internal API backing widget.setPreviewConfig()' },
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
