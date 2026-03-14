/**
 * Form field grouping — scans FormSection children for the pattern:
 *   Label → [RequiredAsterisk] → FieldComponent → [messages...]
 * and groups them into Atlaskit Field wrapper descriptors.
 *
 * Pure logic, no React/Atlaskit dependencies — testable standalone.
 */

import type { ForgeDoc } from './types';

// ── Types ────────────────────────────────────────────────────────────────

export interface FieldGroup {
  kind: 'field';
  labelText: string;
  name: string;
  isRequired: boolean;
  fieldDoc: ForgeDoc;
  messages: ForgeDoc[];
}

export interface CheckboxGroupItem {
  kind: 'checkbox-group';
  labelText: string;
  isRequired: boolean;
  name: string;
  options: Array<{ value: string; label: string; isDisabled?: boolean }>;
  checkboxGroupDoc: ForgeDoc;
  messages: ForgeDoc[];
}

export interface RangeFieldItem {
  kind: 'range-field';
  labelText: string;
  name: string;
  rangeDoc: ForgeDoc;
  messages: ForgeDoc[];
}

export interface PassthroughItem {
  kind: 'passthrough';
  doc: ForgeDoc;
}

export type GroupedFormItem = FieldGroup | CheckboxGroupItem | RangeFieldItem | PassthroughItem;

// ── Constants ────────────────────────────────────────────────────────────

const FIELD_TYPES = new Set([
  'TextField', 'Textfield', 'TextArea', 'Select', 'DatePicker',
  'TimePicker', 'Checkbox', 'RadioGroup', 'Toggle',
]);

const MESSAGE_TYPES = new Set([
  'HelperMessage', 'ErrorMessage', 'ValidMessage',
]);

// ── Helpers ──────────────────────────────────────────────────────────────

/** Extract the text content from a Label node's children (typically a String node). */
export function extractLabelText(labelDoc: ForgeDoc): string {
  for (const child of labelDoc.children ?? []) {
    if (child.type === 'String' && child.props?.text) {
      return child.props.text;
    }
  }
  return '';
}

// ── Grouping ─────────────────────────────────────────────────────────────

/**
 * Scan a FormSection's children and group Label→Field sequences into
 * FieldGroup descriptors. Non-matching children pass through unchanged.
 */
export function groupFormSectionChildren(children: ForgeDoc[]): GroupedFormItem[] {
  const result: GroupedFormItem[] = [];
  let i = 0;

  while (i < children.length) {
    const child = children[i];

    if (child.type === 'Label') {
      let isRequired = false;
      let j = i + 1;

      // Check for RequiredAsterisk as a child of the Label node (standard pattern)
      if (child.children?.some((c) => c.type === 'RequiredAsterisk')) {
        isRequired = true;
      }

      // Also check for RequiredAsterisk as a sibling after Label (fallback pattern)
      if (j < children.length && children[j].type === 'RequiredAsterisk') {
        isRequired = true;
        j++;
      }

      // CheckboxGroup branch — uses Fieldset + CheckboxField, not Field
      if (j < children.length && children[j].type === 'CheckboxGroup') {
        const cgDoc = children[j];
        const name = cgDoc.props?.name ?? `checkbox-${i}`;
        const options: Array<{ value: string; label: string; isDisabled?: boolean }> =
          cgDoc.props?.options ?? [];
        const labelText = extractLabelText(child);
        j++;

        // Collect trailing message nodes
        const messages: ForgeDoc[] = [];
        while (j < children.length && MESSAGE_TYPES.has(children[j].type)) {
          messages.push(children[j]);
          j++;
        }

        result.push({
          kind: 'checkbox-group',
          labelText,
          isRequired,
          name,
          options,
          checkboxGroupDoc: cgDoc,
          messages,
        });
        i = j;
        continue;
      }

      // Range branch — uses RangeField (typed for numbers), not generic Field
      if (j < children.length && children[j].type === 'Range') {
        const rangeDoc = children[j];
        const name = rangeDoc.props?.name ?? `range-${i}`;
        const labelText = extractLabelText(child);
        j++;

        // Collect trailing message nodes
        const messages: ForgeDoc[] = [];
        while (j < children.length && MESSAGE_TYPES.has(children[j].type)) {
          messages.push(children[j]);
          j++;
        }

        result.push({ kind: 'range-field', labelText, name, rangeDoc, messages });
        i = j;
        continue;
      }

      // Must be followed by a recognized field component
      if (j < children.length && FIELD_TYPES.has(children[j].type)) {
        const fieldDoc = children[j];
        const name = child.props?.htmlFor ?? fieldDoc.props?.name ?? `field-${i}`;
        const labelText = extractLabelText(child);
        j++;

        // Collect trailing message nodes
        const messages: ForgeDoc[] = [];
        while (j < children.length && MESSAGE_TYPES.has(children[j].type)) {
          messages.push(children[j]);
          j++;
        }

        result.push({ kind: 'field', labelText, name, isRequired, fieldDoc, messages });
        i = j;
        continue;
      }
    }

    // Not part of a Label→Field group — pass through
    result.push({ kind: 'passthrough', doc: child });
    i++;
  }

  return result;
}
