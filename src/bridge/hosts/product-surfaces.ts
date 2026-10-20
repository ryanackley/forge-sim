/**
 * Product-bridge surfaces — the inert half of `BridgeHost`, shared by both
 * hosts.
 *
 * `@forge/jira-bridge`, `@forge/confluence-bridge` and
 * `@forge/dashboards-bridge` drive HOST PRODUCT chrome: a Jira issue modal,
 * the Jira issue form that UI modifications rewrite, the Confluence editor,
 * the dashboard widget save cycle. forge-sim renders none of those — and
 * neither does `forge-sim dev`, which serves the app's own iframe and no
 * product around it. So the answer is the same in both environments, and
 * lives here once rather than twice.
 *
 * The behaviour is what the deleted `src/shims/forge-*-bridge.ts` stubs did:
 * log that the app asked, then resolve with the smallest answer the REAL
 * package accepts. What changed is only WHERE it happens — a bridge command
 * instead of an import-time alias — so bundled apps, which never resolve a
 * bare specifier, now get it too.
 *
 * Every answer here is measured against the real packages, because they all
 * validate what comes back (file references inline). Returning `undefined`
 * or a half-shaped object does not degrade gracefully: it throws a
 * BridgeAPIError from inside the package, one frame away from the app code
 * that would explain it.
 *
 * No DOM and no Node APIs beyond `console`/`setTimeout`: this file is pulled
 * into the browser bundle (tsconfig.bridge-browser.json) as well as the root
 * build.
 */

/** How long a simulated host modal "stays open" before its onClose fires. */
const MODAL_CLOSE_DELAY_MS = 100;

function log(message: string): void {
  console.log(`[forge-sim] ${message}`);
}

/** Call a callback the app handed us, without letting its throw escape into the package. */
function safely(fn: unknown, arg?: unknown): void {
  if (typeof fn !== 'function') return;
  try {
    (fn as (a?: unknown) => unknown)(arg);
  } catch (err) {
    console.error('[forge-sim] product-bridge callback threw:', err);
  }
}

export interface ProductModalOptions {
  context?: Record<string, unknown>;
  onClose?: unknown;
}

/**
 * The twelve product-bridge host methods. Spread into each host's object so
 * both answer identically.
 */
export function createProductBridgeSurfaces() {
  return {
    // ── Jira: issue modals ───────────────────────────────────────────────
    // out/modal/issue-view.js, out/modal/issue-create.js: the package awaits
    // this and throws BridgeAPIError when the answer is exactly `false`, so
    // `true` is the "modal opened" answer. There is no Jira to draw it in,
    // so the modal closes immediately instead — the stub behaviour, kept
    // because an app that awaits its onClose should not hang.
    async openIssueViewModal(options: ProductModalOptions): Promise<boolean> {
      const issueKey = options.context?.issueKey;
      log(`ViewIssueModal.open(issueKey=${String(issueKey)}) — simulated (no Jira host; closing immediately)`);
      setTimeout(() => safely(options.onClose), MODAL_CLOSE_DELAY_MS);
      return true;
    },
    async openIssueCreateModal(options: ProductModalOptions): Promise<boolean> {
      log('CreateIssueModal.open() — simulated (no Jira host; closing immediately with no issues created)');
      // The real onClose receives the issues that were created; none were.
      setTimeout(() => safely(options.onClose, { payload: [] }), MODAL_CLOSE_DELAY_MS);
      return true;
    },

    // ── Jira: issue view ─────────────────────────────────────────────────
    // out/issue-utils/refresh.js — same `=== false` throw contract.
    async refreshIssueView(): Promise<boolean> {
      log('refreshIssueView() — no-op in simulator (no Jira issue view to refresh)');
      return true;
    },

    // ── Jira: workflow rules ─────────────────────────────────────────────
    // out/workflow/onConfigure.js. The host invokes the callback when an admin
    // configures the rule; nothing here ever does, so it registers and waits.
    async setWorkflowRuleConfigurationCallback(_onConfigure: unknown): Promise<boolean> {
      log('workflowRules.onConfigure() — registered (no-op, host-driven)');
      return true;
    },

    // ── Jira: custom field ───────────────────────────────────────────────
    // out/custom-field/getFieldData.js destructures
    // `actions: { onFieldDataChange, onBridgeError }` and calls the first with
    // the app's callback, so both must exist. The host pushes field data; with
    // no host, the registration simply never fires.
    async getCustomFieldInternalAPI(): Promise<unknown> {
      log('customFieldApi.getFieldData() — registered (no-op, host pushes field data)');
      return {
        actions: {
          onFieldDataChange: (_cb: unknown) => () => {},
          onBridgeError: (_err: unknown) => {},
        },
      };
    },

    // ── Jira: UI modifications ───────────────────────────────────────────
    // out/ui-modifications/getInternalAPI.js VALIDATES the whole shape and
    // throws unless getOnInitData, submit, registerFields, subscribeToChanges,
    // data.uiModifications and data.onInitChangeId are all present — hence the
    // full object rather than a bare stub.
    //
    // Parity note: unlike the other surfaces here this is not purely inert.
    // out/ui-modifications/onInit.js runs the app's registerFields and onInit
    // callbacks as soon as this resolves — there is no "registered, waiting"
    // state to simulate. So onInit DOES run, against an empty form (ApiBuilder
    // tolerates `{}`/`[]`: getFields() → [], getFieldById() → undefined), and
    // the changes it submits are dropped. onChange is host-driven and never
    // fires. The alternative — never resolving — would hang the app's await.
    async getUiModificationsInternalAPI(): Promise<unknown> {
      log('uiModificationsApi — no Jira form host: onInit runs against an empty form, onChange never fires');
      return {
        actions: {
          getOnInitData: async () => ({ currentFormState: {}, currentScreenTabsState: [] }),
          submit: async (_changes: unknown) => {},
          registerFields: async (_fields: unknown) => {},
          subscribeToChanges: async (_cb: unknown) => {
            log('uiModificationsApi.onChange() — registered (no-op, host-driven)');
          },
          onBridgeError: (_err: unknown) => {},
        },
        data: { uiModifications: [], onInitChangeId: 'forge-sim-init' },
      };
    },

    // ── Confluence: editor + macro content ───────────────────────────────
    // out/content/getEditorContent.js and getMacroContent.js throw when the
    // answer is FALSY, so the empty document has to be `{ data: '' }`, not
    // undefined.
    async getEditorContent(): Promise<{ data: string }> {
      log('getEditorContent() — returning empty (no Confluence editor in simulator)');
      return { data: '' };
    },
    async getMacroContent(): Promise<{ data: string }> {
      log('getMacroContent() — returning empty (no Confluence editor in simulator)');
      return { data: '' };
    },
    async updateMacro(_content: unknown): Promise<boolean> {
      log('updateMacro() — no-op in simulator');
      return true;
    },
    // Height is validated client-side first (out/content/setMacroViewportHeight.js
    // rejects anything that is not a positive integer), so whatever arrives here
    // is already well-formed.
    async setMacroViewportHeight(height: unknown): Promise<boolean> {
      log(`setMacroViewportHeight(${String(height)}) — no-op in simulator`);
      return true;
    },

    // ── Dashboards: widget edit + view ───────────────────────────────────
    // out/widgets/**/utils/get-*-bridge.js fetch an API object and call
    // methods on it directly, so the logging lives on the returned methods —
    // that is where the app's per-call intent shows up.
    async getWidgetEditApi(): Promise<unknown> {
      return {
        onSave: (_cb: unknown) => log('widgetEdit.onSave() — registered (no-op, host-driven)'),
        onProductSave: (_cb: unknown) => log('widgetEdit.onProductSave() — registered (no-op, host-driven)'),
        onSaveError: (_cb: unknown) => log('widgetEdit.onSaveError() — registered (no-op, host-driven)'),
        updateConfig: (_config: unknown) => log('widgetEdit.updateConfig() — no-op in simulator'),
      };
    },
    async getWidgetApi(): Promise<unknown> {
      return {
        setPreviewConfig: (_config: unknown) => log('widget.setPreviewConfig() — no-op in simulator'),
      };
    },
  };
}
