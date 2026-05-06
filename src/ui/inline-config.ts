/**
 * Headless inline macro config — field extraction, validation, and
 * the InlineConfigHandle returned by sim.ui.renderInlineConfig().
 *
 * Real Forge constraints (per docs):
 *   - The Config component is restricted to a small subset of UIKit components
 *     (Checkbox group, Date picker, Label, Radio group, Select, Textfield,
 *     Text area, User picker).
 *   - Each form component declares a `name` prop. The platform harvests
 *     name → value pairs at save time — the user does NOT call view.submit().
 *   - Stored values are passed back to the macro view via context.extension.config,
 *     accessible through useConfig().
 *
 * This module mirrors that contract for headless tests.
 */

import type { ForgeDoc } from './bridge.js';

// ── Allowed components ─────────────────────────────────────────────────

/**
 * Components that are allowed inside ForgeReconciler.addConfig(<Config />).
 * Real Forge enforces this — anything outside this list is silently dropped
 * or rejected. We surface it as a parity warning / strict-mode error.
 */
export const INLINE_CONFIG_ALLOWED_TYPES = new Set<string>([
  // Form input components — must have a `name` prop
  'CheckboxGroup',
  'DatePicker',
  'RadioGroup',
  'Select',
  'TextField',     // @forge/react renders this as 'TextField' in the doc
  'Textfield',     // tolerate both casings
  'TextArea',
  'Textarea',
  'UserPicker',
  // Layout / non-input
  'Label',
  // Container types emitted by the reconciler
  'MacroConfig',   // The root wrapper from addConfig
  'Fragment',
  'fragment',
]);

/**
 * Reconciler primitives that are NOT user-authored components — they're
 * emitted internally to represent text content, fragment boundaries, etc.
 * The validator skips these silently so canonical patterns like
 * `<Label>Pet age</Label>` don't trip a false-positive disallowed-component
 * violation on the inner String node.
 */
const RECONCILER_PRIMITIVE_TYPES = new Set<string>([
  'String',  // text-content node, e.g. children of <Label>
]);

/**
 * Components that are FORM FIELDS — each contributes a (name → value) entry
 * to the saved config. Excludes layout-only types like Label.
 */
export const INLINE_CONFIG_FORM_TYPES = new Set<string>([
  'CheckboxGroup',
  'DatePicker',
  'RadioGroup',
  'Select',
  'TextField',
  'Textfield',
  'TextArea',
  'Textarea',
  'UserPicker',
]);

// ── Types ──────────────────────────────────────────────────────────────

export interface InlineConfigField {
  /** The `name` prop on the form component — key into saved config */
  name: string;
  /** Component type as it appears in the ForgeDoc (e.g. 'TextField') */
  type: string;
  /** Default value declared on the component (if any) */
  defaultValue: unknown;
  /** Other props on the component (placeholder, options, isRequired, etc.) */
  props: Record<string, unknown>;
}

export interface InlineConfigViolation {
  /** What kind of issue */
  kind: 'disallowed-component' | 'missing-name';
  /** Component type that triggered the violation */
  type: string;
  /** Human-readable message */
  message: string;
}

export interface InlineConfigValidation {
  valid: boolean;
  violations: InlineConfigViolation[];
}

// ── Field extraction ───────────────────────────────────────────────────

/**
 * Walk a MacroConfig ForgeDoc and extract all named form fields.
 * Layout-only nodes (Label, Fragment, MacroConfig wrapper) are skipped.
 * Form fields without a `name` prop are also skipped (they wouldn't be
 * persisted by real Forge either).
 */
export function extractInlineConfigFields(doc: ForgeDoc | null | undefined): InlineConfigField[] {
  if (!doc) return [];
  const fields: InlineConfigField[] = [];
  walkExtract(doc, fields);
  return fields;
}

function walkExtract(node: ForgeDoc, out: InlineConfigField[]): void {
  if (INLINE_CONFIG_FORM_TYPES.has(node.type)) {
    const props = node.props ?? {};
    const name = typeof props.name === 'string' ? props.name : undefined;
    if (name) {
      const { defaultValue, ...rest } = props as Record<string, unknown>;
      out.push({
        name,
        type: node.type,
        defaultValue,
        props: rest,
      });
    }
  }
  for (const child of node.children ?? []) {
    walkExtract(child, out);
  }
}

// ── Validation ─────────────────────────────────────────────────────────

/**
 * Validate that an inline config tree only uses components from the allowed
 * subset, and that every form field has a `name` prop.
 *
 * Real Forge silently drops disallowed components — we surface this as a
 * parity violation so tests can catch it.
 */
export function validateInlineConfigTree(doc: ForgeDoc | null | undefined): InlineConfigValidation {
  const violations: InlineConfigViolation[] = [];
  if (doc) walkValidate(doc, violations);
  return { valid: violations.length === 0, violations };
}

function walkValidate(node: ForgeDoc, violations: InlineConfigViolation[]): void {
  // Reconciler primitives (e.g. text-content `String` nodes inside <Label>)
  // are not user-authored components — skip them entirely. Without this,
  // the canonical `<Label>Pet age</Label>` pattern from the Forge docs
  // would falsely flag the inner "Pet age" text as a disallowed component.
  if (RECONCILER_PRIMITIVE_TYPES.has(node.type)) return;

  if (!INLINE_CONFIG_ALLOWED_TYPES.has(node.type)) {
    violations.push({
      kind: 'disallowed-component',
      type: node.type,
      message:
        `<${node.type}> is not allowed inside ForgeReconciler.addConfig(). ` +
        `Inline macro config supports only: Checkbox group, Date picker, Label, ` +
        `Radio group, Select, Textfield, Text area, User picker.`,
    });
  } else if (INLINE_CONFIG_FORM_TYPES.has(node.type)) {
    const name = (node.props as any)?.name;
    if (typeof name !== 'string' || name.length === 0) {
      violations.push({
        kind: 'missing-name',
        type: node.type,
        message:
          `<${node.type}> inside addConfig() must declare a string \`name\` prop ` +
          `— values are stored as a key/value map keyed by name.`,
      });
    }
  }
  for (const child of node.children ?? []) {
    walkValidate(child, violations);
  }
}

// ── Default values ─────────────────────────────────────────────────────

/**
 * Build a default values object from the field defaults declared in the
 * config tree. Used when a test calls `cfg.save()` without arguments to
 * mimic the platform's "save current state" behavior.
 */
export function defaultsFromFields(fields: InlineConfigField[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.defaultValue !== undefined) {
      out[field.name] = field.defaultValue;
    }
  }
  return out;
}

// ── Handle ─────────────────────────────────────────────────────────────

/**
 * Returned by sim.ui.renderInlineConfig(). Lets a test inspect the rendered
 * config tree, drive the platform-style save flow, and invalidate the saved
 * state via cancel().
 */
export interface InlineConfigHandle {
  /** The rendered MacroConfig ForgeDoc */
  readonly doc: ForgeDoc;
  /** The macro module key this handle is bound to */
  readonly moduleKey: string;
  /** Extract all named form fields from the config tree */
  getFields(): InlineConfigField[];
  /** Validate the tree against the allowed component subset */
  validate(): InlineConfigValidation;
  /**
   * Persist config values for this macro. Mirrors the platform's "Save"
   * button — values become available to the macro view via useConfig().
   *
   * If no values are passed, defaults declared on the form fields are used
   * (matches Forge's behavior when the user opens config and clicks Save
   * without changing anything).
   */
  save(values?: Record<string, unknown>): Promise<void>;
  /**
   * Discard any in-progress changes. The previously saved config (if any)
   * is preserved. Mirrors the platform's "Cancel" button.
   */
  cancel(): void;
}
