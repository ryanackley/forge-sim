/**
 * @forge/confluence-bridge shim — product-specific bridge APIs for Confluence.
 *
 * These APIs interact with the Confluence host UI (editor content, macros,
 * byline properties). In forge-sim there is no host product, so everything
 * returns sensible defaults and logs.
 *
 * Potential future enhancement: if forge-sim ever serves Confluence macro
 * modules, getMacroContent/updateMacro could read/write simulated state.
 */

// ── Types ───────────────────────────────────────────────────────────────

export interface ContentData {
  data: string;
}

export interface BylineProperties {
  propertyKey: string;
  valueUpdate: {
    title?: string;
    icon?: string;
    tooltip?: string;
  };
}

// ── Content APIs ────────────────────────────────────────────────────────

export async function getEditorContent(): Promise<ContentData> {
  console.log('[forge-sim] getEditorContent() — returning empty (no Confluence editor in simulator)');
  return { data: '' };
}

export async function getMacroContent(): Promise<ContentData> {
  console.log('[forge-sim] getMacroContent() — returning empty (no Confluence editor in simulator)');
  return { data: '' };
}

export async function updateMacro(_macroContent: ContentData): Promise<boolean> {
  console.log('[forge-sim] updateMacro() — no-op in simulator');
  return true;
}

export async function setMacroViewportHeight(height: string): Promise<boolean> {
  console.log(`[forge-sim] setMacroViewportHeight(${height}) — no-op in simulator`);
  return true;
}

export async function updateBylineProperties(_payload: BylineProperties): Promise<void> {
  console.log('[forge-sim] updateBylineProperties() — no-op in simulator');
}
