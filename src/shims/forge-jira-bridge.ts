/**
 * @forge/jira-bridge shim — product-specific bridge APIs for Jira.
 *
 * These APIs interact with the Jira host UI (modals, workflow rules,
 * UI modifications, custom fields). In forge-sim there is no host product,
 * so everything is a no-op stub that logs and resolves without error.
 *
 * If real functionality is needed in the future (e.g. opening a simulated
 * issue-create modal), these stubs are the extension points.
 */

// ── Modals ──────────────────────────────────────────────────────────────

export interface ViewIssueModalOptions {
  context: { issueKey: string };
  onClose?: () => void;
}

export class ViewIssueModal {
  onClose: NonNullable<ViewIssueModalOptions['onClose']>;
  context: { issueKey: string };

  constructor(opts: ViewIssueModalOptions) {
    this.context = opts.context;
    this.onClose = opts.onClose ?? (() => {});
  }

  async open(): Promise<void> {
    console.log(`[forge-sim] ViewIssueModal.open(issueKey=${this.context.issueKey}) — simulated`);
    setTimeout(() => this.onClose?.(), 100);
  }
}

export interface CreateIssueModalOptions {
  context?: Record<string, any>;
  onClose?: (args: { payload: { issueId: string }[] }) => void;
}

export class CreateIssueModal {
  onClose: NonNullable<CreateIssueModalOptions['onClose']>;
  context: Record<string, any>;

  constructor(opts?: CreateIssueModalOptions) {
    this.context = opts?.context ?? {};
    this.onClose = opts?.onClose ?? (() => {});
  }

  async open(): Promise<void> {
    console.log('[forge-sim] CreateIssueModal.open() — simulated');
    setTimeout(() => this.onClose?.({ payload: [] }), 100);
  }
}

// ── Workflow Rules ──────────────────────────────────────────────────────

export const workflowRules = {
  async onConfigure(_fn: () => Promise<string> | string): Promise<void> {
    console.log('[forge-sim] workflowRules.onConfigure() — registered (no-op, host-driven)');
  },
};

// ── UI Modifications ────────────────────────────────────────────────────

export const uiModificationsApi = {
  async onInit(
    _onInitCallback: (props: { api: any; uiModifications: any[] }) => Promise<void> | void,
    _registerFieldsCallback: (props: { uiModifications: any[] }) => string[],
  ): Promise<void> {
    console.log('[forge-sim] uiModificationsApi.onInit() — registered (no-op, host-driven)');
  },

  async onChange(
    _onChangeCallback: (props: { api: any; change: any; uiModifications: any[] }) => Promise<void> | void,
    _registerFieldsCallback: (props: { uiModifications: any[]; change: any }) => string[],
  ): Promise<void> {
    console.log('[forge-sim] uiModificationsApi.onChange() — registered (no-op, host-driven)');
  },

  async onError(_errorCallback: (error: any) => void): Promise<void> {
    console.log('[forge-sim] uiModificationsApi.onError() — registered (no-op, host-driven)');
  },
};

// ── Custom Field ────────────────────────────────────────────────────────

export interface FieldData {
  fieldValue: unknown;
}

export const customFieldApi = {
  async getFieldData(_callback: (fieldData: FieldData) => void): Promise<void> {
    console.log('[forge-sim] customFieldApi.getFieldData() — registered (no-op, host pushes data)');
  },
};

// ── Constants ───────────────────────────────────────────────────────────

export const REQUEST_TYPE_CF_TYPE = 'com.atlassian.servicedesk:vp-origin';
