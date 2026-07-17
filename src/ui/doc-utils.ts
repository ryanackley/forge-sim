/**
 * ForgeDoc tree utilities — find, extract, interact with rendered UI components.
 */

import type { ForgeDoc } from './bridge.js';

/** Find all nodes matching a component type. */
export function findByType(doc: ForgeDoc, type: string): ForgeDoc[] {
  const results: ForgeDoc[] = [];
  function walk(node: ForgeDoc) {
    if (node.type === type) results.push(node);
    for (const child of node.children ?? []) walk(child);
  }
  walk(doc);
  return results;
}

/** Find the first node matching a component type, or null. */
export function findFirstByType(doc: ForgeDoc, type: string): ForgeDoc | null {
  if (doc.type === type) return doc;
  for (const child of doc.children ?? []) {
    const found = findFirstByType(child, type);
    if (found) return found;
  }
  return null;
}

/** Find nodes whose props match all given key/value pairs. */
export function findByProps(doc: ForgeDoc, props: Record<string, any>): ForgeDoc[] {
  const results: ForgeDoc[] = [];
  function walk(node: ForgeDoc) {
    const matches = Object.entries(props).every(([key, value]) => node.props[key] === value);
    if (matches) results.push(node);
    for (const child of node.children ?? []) walk(child);
  }
  walk(doc);
  return results;
}

/**
 * Curated allowlist of visible-text props per ForgeDoc component type.
 *
 * Most UIKit components emit text as `<String>` child nodes (because their
 * `children` prop accepts ReactNode and the reconciler wraps strings). For
 * those, the existing `<String>` walker in `getTextContent` is enough.
 *
 * The components in this map are different — they accept text via NAMED PROPS
 * (e.g. `<Tag text="Priority" />`, `<FormHeader title="..." description="..." />`).
 * The reconciler does NOT wrap those into `<String>` children, so a pure
 * tree-walker would silently miss them. This allowlist tells `getTextContent`
 * which prop values to treat as visible text.
 *
 * Inclusion rule: a prop is here only if it produces text VISIBLE TO A SIGHTED
 * USER on initial mount. Excluded categories:
 *   - aria-* attributes and screen-reader-only labels (Spinner.label,
 *     Icon.label, Toggle.label, Modal.label, ButtonGroup.label, etc.)
 *   - placeholders (only visible when input is empty)
 *   - hover-only content (Tooltip.content, HTML title attribute)
 *   - alt text (Image.alt — fallback only)
 *   - props containing data the renderer doesn't surface as text
 *
 * This is a CONVENIENCE LAYER, not an exhaustive renderer. For composite
 * data — Select.options[].label, RadioGroup.options[].label, Comment.author.text
 * (object form), DynamicTable cells, etc. — drop down to `findByType` and
 * access props directly. Examples:
 *
 *   // Finding text in Select options:
 *   const select = findFirstByType(doc, 'Select')!;
 *   expect(select.props.options.map(o => o.label)).toContain('Bug Report');
 *
 *   // Asserting on the currently-selected Select value:
 *   expect(select.props.value).toBe('bug');
 *
 *   // Comment author when passed as an object:
 *   const comment = findFirstByType(doc, 'Comment')!;
 *   expect(comment.props.author.text).toBe('Pat Lee');
 *
 * Audited against forge-mcp UI Kit docs and cross-checked against the
 * forge-sim renderer's component-map (see VISIBLE_TEXT_PROPS_AUDIT.md).
 */
export const VISIBLE_TEXT_PROPS: Record<string, readonly string[]> = {
  Tag: ['text'],
  Badge: ['text'],
  FormHeader: ['title', 'description'],
  FormSection: ['title', 'description'],
  EmptyState: ['header', 'description'],
  SectionMessage: ['title'],
  CodeBlock: ['text'],
  Modal: ['title'],
  DynamicTable: ['caption'],
  Inline: ['separator'],
  Checkbox: ['label'],
  Radio: ['label'],
  InlineEdit: ['label'],
  UserPicker: ['label', 'description'],
  FilePicker: ['label', 'description'],
  FileCard: ['fileName', 'error'],
  // Comment.author / Comment.time are documented as `{ text, onClick }` objects,
  // but our renderer treats them as plain strings (renders {props.author}). Both
  // shapes covered: string form via this list, object form via findByType.
  // Comment props per @atlaskit/forge-react-types CommentProps.codegen.d.ts:
  //   - edited, restrictedTo, savingText, type → string
  //   - author, time → { text: string, onClick? } (object) — string also accepted
  //     by the renderer for ergonomic backward-compat
  //   - actions, errorActions → Array<{ text: string, onClick? }>
  // The walker's extractText() handles all three shapes (string, object-with-text,
  // array-of-objects-with-text).
  Comment: ['edited', 'restrictedTo', 'savingText', 'type', 'author', 'time', 'actions', 'errorActions'],
  User: ['name'],
  Tile: ['label'],
  AtlassianTile: ['label'],
  // Charts — the renderer's ChartWrapper renders title/subtitle above each chart.
  BarChart: ['title', 'subtitle'],
  StackBarChart: ['title', 'subtitle'],
  HorizontalBarChart: ['title', 'subtitle'],
  HorizontalStackBarChart: ['title', 'subtitle'],
  LineChart: ['title', 'subtitle'],
  DonutChart: ['title', 'subtitle'],
  PieChart: ['title', 'subtitle'],
};

/**
 * Extract all visible text from a subtree.
 *
 * Walks the tree and collects:
 *   1. `<String>` node `text` props (most UIKit text — Heading, Button, Text,
 *      Label, etc. — flow through here because `children` is wrapped).
 *   2. Visible-text props from the `VISIBLE_TEXT_PROPS` allowlist (for
 *      components that take text via named props, like `Tag.text`).
 *
 * Returns text concatenated without separators — matches the natural
 * adjacent-text-node behavior of the browser DOM and preserves any spacing
 * the user baked into their `<String>` text. (Tests rely on this for
 * patterns like `<Text>Theme: </Text><Text>{value}</Text>` collapsing to
 * "Theme: light".) Adjacency false positives are theoretically possible
 * (`title="Hello" description="World"` → "HelloWorld") but tests use
 * substring matching, not exact equality, so they're not a real concern.
 *
 * **This is a convenience method.** It handles the common case of "find this
 * substring on the page" but is not exhaustive — composite data (Select
 * options, nested objects, DynamicTable cells) requires `findByType` + raw
 * prop access. See `VISIBLE_TEXT_PROPS` for the curated component list and
 * escape-hatch examples.
 */
/**
 * Extract visible text from a prop value, handling three shapes:
 *   1. string                                → ["the value"]
 *   2. { text: string, ... }                 → ["the value"]      ← Comment.author/time
 *   3. Array<string | { text: string, ... }> → ["a", "b", ...]    ← Comment.actions
 *
 * Returns [] for any other shape (numbers, functions, undefined, objects
 * without a `text` field, etc.).
 */
function extractText(value: unknown): string[] {
  if (typeof value === 'string') {
    return value.length > 0 ? [value] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(extractText);
  }
  if (typeof value === 'object' && value !== null) {
    const obj = value as { text?: unknown };
    if (typeof obj.text === 'string' && obj.text.length > 0) return [obj.text];
  }
  return [];
}

export function getTextContent(doc: ForgeDoc): string {
  const texts: string[] = [];
  function walk(node: ForgeDoc) {
    if (node.type === 'String' && node.props.text != null) {
      texts.push(String(node.props.text));
    }
    const propNames = VISIBLE_TEXT_PROPS[node.type];
    if (propNames) {
      for (const propName of propNames) {
        texts.push(...extractText(node.props[propName]));
      }
    }
    for (const child of node.children ?? []) walk(child);
  }
  walk(doc);
  return texts.join('');
}

/**
 * Map of form-field component types → the native input `type` they correspond
 * to. When `simulateEvent` fires `onChange` on one of these and the caller
 * passed an event-shaped first arg without `target.type`, we inject the right
 * type so react-hook-form's `register()`-bound onChange takes its native-input
 * code path. Without `target.type`, RHF falls into a path that expects a real
 * DOM ref — which doesn't exist in headless mode — and stores the entire event
 * object as the field value (P2).
 *
 * Headless tests have no react-dom, no SyntheticEvent system, and no real
 * <input> for RHF's ref to attach to. This synthesizes the minimal shape RHF
 * needs to find its way through.
 *
 * NOTE: Select is intentionally absent. Real Forge `<Select>` is backed by
 * react-select, which fires `onChange(option)` with an `AKOption | AKOption[]`
 * object — NOT a synthetic event. Auto-injecting `target.type='select-one'`
 * here would create a parity violation: in sim, RHF would extract
 * `target.value` and store the raw string; in real Forge, RHF receives the
 * option object and stores the whole `{label, value}` (since react-select
 * doesn't go through the event path). `fillField` handles Select via the
 * option-object path explicitly so behavior matches production. (F2)
 *
 * UserPicker is also absent for similar reasons — its `onChange` shape is
 * domain-specific (`UserPickerValue`), not a synthetic event.
 */
const FIELD_NATIVE_TYPES: Record<string, string> = {
  Textfield: 'text',
  TextArea: 'textarea',
  Checkbox: 'checkbox',
  CheckboxGroup: 'checkbox',
  Radio: 'radio',
  RadioGroup: 'radio',
  Toggle: 'checkbox',
  DatePicker: 'date',
  TimePicker: 'time',
  Range: 'range',
};

/** True if `arg` looks like a synthetic-event object (has `target`). */
function isEventLike(arg: unknown): arg is { target: Record<string, unknown> } {
  return (
    typeof arg === 'object' &&
    arg !== null &&
    'target' in arg &&
    typeof (arg as { target: unknown }).target === 'object' &&
    (arg as { target: unknown }).target !== null
  );
}

/**
 * Simulate an event (e.g. onClick, onChange) on a node.
 *
 * For form fields with onChange, auto-injects `target.type` (matching the
 * native input equivalent) and `target.name` (from the field's `name` prop)
 * if the caller passed an event-shaped first arg without them. This is what
 * makes `useForm` + `register()` work in headless mode — see the comment on
 * FIELD_NATIVE_TYPES above.
 *
 * Backwards-compatible: callers that already supply `target.type` / `target.name`
 * keep their values, callers that pass raw values (not event-shaped) are
 * untouched, and any non-onChange event is forwarded verbatim.
 *
 * Throws if the node has no handler for `eventName` — a silent no-op here
 * hides real bugs (interacting with a stale doc, typo'd event name, or a
 * component that never wired the handler). The error lists the function
 * props that DO exist on the node.
 */
export function simulateEvent(node: ForgeDoc, eventName: string, ...args: any[]): any {
  const handler = node.props[eventName];
  if (typeof handler !== 'function') {
    const fnProps = Object.keys(node.props).filter(
      (k) => typeof node.props[k] === 'function'
    );
    throw new Error(
      `simulateEvent: <${node.type}> has no "${eventName}" handler — firing it would be ` +
      `a silent no-op. Function props on this node: ${fnProps.join(', ') || '(none)'}. ` +
      `If your source defines the handler, you may be holding a stale ForgeDoc — ` +
      `re-fetch it after \`await sim.ui.waitForContent(...)\`, or use ` +
      `sim.ui.fillField()/interactWith(), which always walk the live tree.`
    );
  }

  // Auto-inject target.type/target.name on onChange for known form fields.
  if (eventName === 'onChange' && args.length > 0 && isEventLike(args[0])) {
    const nativeType = FIELD_NATIVE_TYPES[node.type];
    if (nativeType !== undefined) {
      const original = args[0];
      const target = original.target as Record<string, unknown>;
      // Only inject what's missing — don't clobber caller-provided values.
      const augmentedTarget: Record<string, unknown> = { ...target };
      if (augmentedTarget.type === undefined) augmentedTarget.type = nativeType;
      if (augmentedTarget.name === undefined && node.props.name !== undefined) {
        augmentedTarget.name = node.props.name;
      }
      args = [{ ...original, target: augmentedTarget }, ...args.slice(1)];
    }
  }

  return handler(...args);
}

/** List all unique component types in a tree. */
export function listComponentTypes(doc: ForgeDoc): string[] {
  const types = new Set<string>();
  function walk(node: ForgeDoc) {
    if (node.type !== 'String') types.add(node.type);
    for (const child of node.children ?? []) walk(child);
  }
  walk(doc);
  return [...types];
}

/** Find a component by type and optional text content. */
export function findByTypeAndText(
  doc: ForgeDoc,
  type: string,
  matchText?: string,
  nthMatch?: number
): ForgeDoc {
  const candidates = findByType(doc, type);
  if (candidates.length === 0) {
    const available = listComponentTypes(doc).join(', ');
    throw new Error(`No ${type} found. Available components: ${available}`);
  }

  let matches = candidates;
  if (matchText) {
    matches = candidates.filter((node) => getTextContent(node).includes(matchText));
    if (matches.length === 0) {
      const texts = candidates.map((n) => getTextContent(n) || '(no text)');
      throw new Error(
        `No ${type} containing "${matchText}". Found ${type} nodes with text: ${texts.join(', ')}`
      );
    }
  }

  const idx = (nthMatch ?? 1) - 1;
  if (idx >= matches.length) {
    throw new Error(`Requested match #${nthMatch} but only ${matches.length} ${type} node(s) found.`);
  }
  return matches[idx];
}

/**
 * React `useId` tokens look like `:rootr0:` / `:r1:` — the counter increments
 * on every mount, so ids differ between renders of the same UI. That's
 * correct ForgeDoc content (real @forge/react emits it), but it makes
 * prettyPrint output non-deterministic — noisy for snapshot tests. We
 * normalize the counter to `#` in id-ish props for display only; the
 * underlying doc is untouched.
 */
const USE_ID_TOKEN = /:([a-zA-Z$]*r)[0-9a-z]+:/g;

function isIdProp(key: string): boolean {
  return key === 'id' || key === 'labelFor' || key.endsWith('Id') || key.startsWith('aria-');
}

/** Pretty-print a ForgeDoc tree. */
export function prettyPrint(doc: ForgeDoc, indent = 0): string {
  const pad = '  '.repeat(indent);
  const propsStr = Object.entries(doc.props)
    .filter(([k, v]) => {
      if (typeof v === 'function' || typeof v === 'object' || v === undefined) return false;
      // `children` also arrives as a prop when it's a plain string, but the
      // reconciler already materializes it as a `<String>` child node — print
      // it once (as the child), not twice.
      if (k === 'children' && doc.children.length > 0) return false;
      return true;
    })
    .map(([k, v]) => {
      const display = typeof v === 'string' && isIdProp(k) ? v.replace(USE_ID_TOKEN, ':$1#:') : v;
      return `${k}=${JSON.stringify(display)}`;
    })
    .join(' ');

  let line = `${pad}<${doc.type}`;
  if (propsStr) line += ` ${propsStr}`;

  if (doc.children.length === 0) return line + ' />';

  line += '>';
  const childLines = doc.children.map((c) => prettyPrint(c, indent + 1));
  return [line, ...childLines, `${pad}</${doc.type}>`].join('\n');
}
