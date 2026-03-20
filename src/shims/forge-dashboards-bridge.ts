/**
 * @forge/dashboards-bridge shim — product-specific bridge APIs for Jira Dashboards.
 *
 * These APIs handle dashboard widget lifecycle (save/error callbacks,
 * config updates, preview). In forge-sim there is no dashboard host,
 * so everything is a no-op stub.
 *
 * Potential future enhancement: widgetEdit.updateConfig and widget.setPreviewConfig
 * could store state accessible via MCP tools.
 */

// ── Types ───────────────────────────────────────────────────────────────

export type WidgetConfig = Record<string, unknown>;

export type Layout = {
  width: number;
  height: number;
  rowSpan?: 'xsmall' | 'small' | 'medium' | 'large';
  columnSpan?: 3 | 4 | 6 | 8 | 12;
};

export type WidgetContext = {
  widgetId?: string;
  dashboardId: string;
};

export type OnSave = (
  config: WidgetConfig,
  widgetContext: Omit<WidgetContext, 'widgetId'> & { widgetId: string },
  context: Record<string, unknown>,
) => Promise<void>;

export type OnProductSave = (
  config: WidgetConfig,
  widgetContext: WidgetContext,
  context: Record<string, unknown>,
) => Promise<WidgetConfig | null | undefined>;

export type OnSaveError = (
  error: Error,
  widgetContext: WidgetContext,
  context: Record<string, unknown>,
) => void;

// ── Widget Edit ─────────────────────────────────────────────────────────

export const widgetEdit = {
  async onSave(_cb: OnSave): Promise<void> {
    console.log('[forge-sim] widgetEdit.onSave() — registered (no-op, host-driven)');
  },

  async onProductSave(_cb: OnProductSave): Promise<void> {
    console.log('[forge-sim] widgetEdit.onProductSave() — registered (no-op, host-driven)');
  },

  async onSaveError(_cb: OnSaveError): Promise<void> {
    console.log('[forge-sim] widgetEdit.onSaveError() — registered (no-op, host-driven)');
  },

  async updateConfig(_config: WidgetConfig): Promise<void> {
    console.log('[forge-sim] widgetEdit.updateConfig() — no-op in simulator');
  },
};

// ── Widget View ─────────────────────────────────────────────────────────

export const widget = {
  async setPreviewConfig(_previewConfig: WidgetConfig): Promise<void> {
    console.log('[forge-sim] widget.setPreviewConfig() — no-op in simulator');
  },
};
