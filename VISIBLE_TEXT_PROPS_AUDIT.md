# Visible-Text Props Audit — UIKit 2

For each Forge UI Kit component: which props (other than `children`) render visible text on initial mount?

## Methodology

- Source: forge-mcp `search-forge-docs` queries against the official Forge UI Kit docs at `https://developer.atlassian.com/platform/forge/ui-kit/components/`.
- Each component's prop table was inspected; quotes from the docs are reproduced verbatim where ambiguity matters.
- "Visible on initial mount" means text that renders into the DOM the moment the component appears in its default state, with no user interaction required.
- **Excluded**: `aria-label`, `aria-describedby`, `placeholder` (only visible when input is empty AND focused away from), `alt` on Image (fallback only), Tooltip `content` (hover-only), Popup `content` (closed by default), HTML `title` attribute (hover), `labelFor`, internal IDs/names/keys, numeric `value` props (e.g. ProgressBar, Range), and screen-reader-only labels explicitly documented as such.
- A handful of group/composite components (CheckboxGroup, RadioGroup, Select, ProgressTracker, DynamicTable) accept an `options`/`items`/`rows` array whose entries contain visible labels. These are flagged separately below — they are not simple top-level string props but the rendered chips/rows DO show text from those nested fields, so a complete walker needs to handle them.

## Components WITH visible-text props (include in allowlist)

### Tag
- `text` — "Text to be displayed in the tag." (required, always visible).
- Source: Tag docs prop table.

### TagGroup
- No direct text prop; renders `<Tag>` children. (Listed here only because TagGroup is the wrapper — it has no visible-text props of its own.)
- Effectively: **no visible-text props of its own** (text comes from child Tags' `text` prop).

### FormHeader
- `title` — "Title of the form. This is a header." (string, always visible).
- `description` — "Description or subtitle of the form." (string, always visible).
- Source: Form docs ("Form header" section).

### FormSection
- `title` — "Title of the form section." (string, always visible).
- `description` — "Description of the contents of the section." (string, always visible).
- Source: Form docs ("Form section" section).

### EmptyState
- `header` — "Title that briefly describes the page to the user." (string, required, always visible).
- `description` — "The main block of text that holds additional supporting information." (string, always visible).
- Source: Empty state docs prop table.

### SectionMessage
- `title` — "The heading of the section message." (string, always visible when set).
- Source: Section message docs prop table.

### CodeBlock
- `text` — "The code to be formatted." (string, the entire code body shown in the block).
- Source: Code Block docs prop table (part 4/5).

### Tab (inside Tabs/TabList)
- `children` is the only documented prop and is always a string ("The children of Tab.") — but per spec, `children` is excluded because the reconciler wraps it in `<String>`. **No non-children visible-text props.**
- Note: Tab has no `label`, `text`, or other prop; the tab label comes purely from `children`.

### Modal
- `title` — "The title of the modal. ... For non-fullscreen modals, providing this prop will render a default header with the title and a close button..." (string, visible — drives a built-in header when set).
- Source: Modal docs prop table (part 4/11).

### DynamicTable
- `caption` — "Caption for the table styled as a heading." (string, always visible above the table when set).
- Source: DynamicTable docs (part 3/10).
- Note: `head`, `rows`, `emptyView` also contain visible text but as nested cell content / arbitrary nodes — they go through the existing children/cell tree, not flat string props.

### Inline (layout)
- `separator` — "Renders a separator string between each child." (string, visible between children).
- Source: Inline docs prop table.
- Note: This is unusual for a layout component but is real visible DOM text.

### Checkbox
- `label` — "The label to be displayed to the right of the checkbox. The label is part of the clickable element to select the checkbox." (string, always visible).
- Source: Checkbox docs prop table.

### Radio
- `label` — "The label value for the input." (string, visible — the docs' examples consistently render it as the visible label, e.g. `<Radio label="Default radio" />`).
- Source: Radio docs prop table + examples.

### InlineEdit
- `label` — "Label above the input field that communicates what value should be entered." (visible per docs description and every code example: `<InlineEdit label="Team name" ... />`).
- Source: Inline edit docs prop table (part 3/9). (Note: docs' "Type" column says `boolean` for `label`, which contradicts every code example using a string. The description and usage are unambiguous about it being visible text — likely a documentation typo.)

### UserPicker
- `label` — "The label text to display." (required, visible).
- `description` — "The text description of the user picker field." (visible helper text — see example: `description="The selected user will be assigned to this task"`).
- Source: User Picker docs prop table.

### FilePicker (EAP)
- `label` — "Label displayed above the file picker." (visible).
- `description` — "Additional helper text shown below the file picker to guide users." (visible).
- Source: File picker docs prop table.

### FileCard (EAP)
- `fileName` — "The name of the file to display." (required, always visible).
- `error` — "Error message to display below the file name if there is an error." (visible when set).
- Source: FileCard docs prop table (part 2/3).

### Comment
- `edited` — "A CommentEdited element which displays next to the time. Indicates whether the comment has been edited." (string, visible).
- `restrictedTo` — "Text for the 'restricted to' label. This will display in the top items, before the main content." (string, visible).
- `savingText` — "Text to show when in 'optimistic saving' mode." (string, visible when `isSaving`).
- `type` — "The type of comment. This will be rendered in a lozenge at the top of the comment, before the main content." (string, visible).
- `errorIconLabel` — "Text to show in the error icon label." (string; ambiguous — likely visible in error state but described as a label; treat as **uncertain**).
- `author` — object `{ text: string, onClick? }` — `author.text` is the visible author name shown next to the avatar.
- `time` — object `{ text: string, onClick? }` — `time.text` is the visible timestamp.
- `actions` — array of `{ text: string, onClick? }` — each `action.text` is the visible label for an action button row below the content.
- `errorActions` — array of `{ text: string, onClick? }` — same shape, visible when in error state.
- Source: Comment docs prop table (parts 3/8–7/8) and example usage.
- Note: `author`/`time`/`actions` are nested-object props, not flat strings. A walker reading only top-level string props will miss them.

## Composite / nested-data props worth special-casing

These aren't simple string props but produce visible text on initial render. Your walker may need targeted handling:

### CheckboxGroup
- `options: Array<{ label: string; value: string; ... }>` — each `option.label` is rendered as the visible checkbox label.
- Source: Checkbox group docs prop table.

### RadioGroup
- `options: Array<{ label: string; value: string; ... }>` — each `option.label` is the visible radio label.
- Source: Radio group docs prop table.

### Select
- `options: (Option | Group)[]` where `Option = { label: string, value: string }` — option labels render in the menu and in the selected display. The placeholder is excluded (per spec).
- Source: Select docs prop table.

### ProgressTracker
- `items: Array<{ id; label; percentageComplete; status; ... }>` — each `item.label` is the visible step label.
- Source: Progress tracker docs prop table.

### DynamicTable
- `head` — `HeadType` containing column cells with rendered content (visible column headers).
- `rows` — `RowType[]` containing cells with rendered content (visible cell text).
- `emptyView` — `React.ReactNode | string` shown when no rows; visible when rows is empty.
- These all go through child trees of the rendered table; existing tree-walking covers cells if they reach `<String>` nodes, but standalone string `emptyView` may bypass that.

## Components with NO visible-text props (skip)

Each of these uses `children` for any visible text and has no other prop that produces visible DOM text on initial mount.

### Atoms / display
- **Text** — uses `children` only for visible text.
- **Heading** — uses `children` only.
- **Code** — `children` only.
- **Em / Strong / Strike** — not separate components in UIKit 2 docs; rendered via `<Text as="em|strong|strike">`. No props produce visible text other than `children`.
- **Badge** — `children` only (numeric value); `appearance`, `max` are not visible text on their own (but `max` modifies the rendered numeric output — still derived from `children`).
- **Lozenge** — `children` only.
- **Link** — `children` is the visible link text; `href` is the URL (typically not visible).
- **Image** — `alt` excluded (fallback only); `src`, `size`, `width`, `height` are not visible text.
- **Spinner** — `label` is explicitly "Text to be used as `aria-label`" — screen-reader only.
- **ProgressBar** — `ariaLabel` is screen-reader only; `value` is numeric, not text.
- **Icon** — `label` is "Text used to describe what the icon is in context. A label is needed when there is no pairing visible text next to the icon." — accessibility annotation, not rendered visible text.
- **AtlassianIcon** — same as Icon; `label` is a screen-reader / accessibility name.
- **Tile (Preview)** — `label` is "the accessible name for the tile" per the Accessibility section; not visible.
- **AtlassianTile (Preview)** — `label` same as Tile (accessibility); not visible.

### Buttons / interactive
- **Button** — `children` only; `iconBefore`/`iconAfter` are icon glyphs.
- **LinkButton** — `children` only.
- **LoadingButton** — `children` only.
- **Pressable** — `children` only.
- **ButtonGroup** — `label` and `titleId` are explicitly aria-label/aria-labelledby (screen-reader only); `children` carries text via Button children.

### Layout / primitives
- **Stack** — layout only; no text props.
- **Box** — layout/styling only; no text props.
- **Frame** — `resource` is a manifest key, not visible text; `height`/`width` are dimensions.
- **Global** — not a documented UIKit 2 component (no docs found).

### Forms — labels & messages
- **Label** — `children` only.
- **RequiredAsterisk** — no documented props (renders an asterisk).
- **HelperMessage / ErrorMessage / ValidMessage** — `children` only.

### Forms — inputs
All form inputs below have NO visible-text props per spec (placeholder excluded; aria-* excluded; label comes from a separate `<Label>` component):
- **Textfield** — `placeholder` excluded; `name`, `value`, `defaultValue` etc. are not "props that render visible text on initial mount" in the prop sense (`value` does render but is data, not a label).
- **TextArea** — same as Textfield.
- **DatePicker** — `placeholder` excluded; `dateFormat` controls format string but doesn't render label text.
- **TimePicker** — same.
- **Calendar (Preview)** — no static label/title prop.
- **Toggle** — `label` is documented as "Text to be used as `aria-label` of toggle component." — screen-reader only.
- **Range** — no label prop (uses external `<Label>`).

### Tabs
- **Tabs** — children only (TabList / TabPanel).
- **TabList** — children only.
- **TabPanel** — children only.
- **Tab** — `children` only (no `label`, `text`, etc.).

### Modal
- **ModalBody** — children only.
- **ModalHeader** — children only.
- **ModalTitle** — children only.
- **ModalFooter** — children only.
- **ModalTransition** — animation wrapper; no text props.
- (Note: Modal itself is in the "with text props" section above for `title`. Modal also has `label` which is screen-reader only and excluded.)

### Data display / other
- **List** — `type` controls ordered/unordered; no visible-text props.
- **ListItem** — `children` only (no other documented props).
- **User** — `accountId` is an ID; `hideDisplayName` is boolean. The displayed name comes from product data, not from a prop.
- **UserGroup** — children only.
- **SectionMessageAction** — `children` is the link text; `href`/`onClick` are not visible text.
- **AdfRenderer** — `document` is the ADF tree; visible text comes from inside the tree, not from a flat string prop. (The renderer itself isn't producing visible text from a `text`-style prop.)
- **Tooltip** — `content` excluded (hover-only).
- **Popup** — `content` is render-prop, only visible when `isOpen=true`; closed by default. Excluded.
- **CommentEditor / ChromelessEditor** — `defaultValue` is editor content (a JSON ADF doc), but it renders as editable input text inside the editor, not as a static visible label/title prop.

### Charts (no visible-text props worth including)
- **BarChart, StackBarChart, HorizontalBarChart, HorizontalStackBarChart, LineChart, DonutChart, PieChart** — these accept `data` arrays. Axis labels and series names come from the data structure (typically arrays of objects with `label`/`name` keys); they're not flat string props on the chart itself. If your walker needs to extract chart axis/series labels, that's a separate special case — the docs don't expose top-level title/subtitle string props on these chart components.

## Uncertain / needs review

- **Comment.errorIconLabel** — Documented as "Text to show in the error icon label." Could be either a visible text label next to an error icon OR a screen-reader label for an icon. Given the naming convention used elsewhere (Spinner.label, Icon.label = aria), this is most likely an accessibility/aria label for an error icon in `errorActions` mode. Treat as screen-reader only unless verified visually. **Recommendation: exclude.**
- **InlineEdit.label** — Docs' Type column says `boolean`, but description says "Label above the input field that communicates what value should be entered" and every code example passes a string (e.g. `label="Team name"`). Almost certainly a docs typo; treat as visible string. **Recommendation: include.**
- **Tile.label / AtlassianTile.label / AtlassianIcon.label** — Docs explicitly call these the "accessible name" / "aria label". On Tile the docs say "If the tile is decorative, this can be set to an empty string" and reference WCAG. **Treat as screen-reader only; exclude.** However, AtlassianTile/AtlassianIcon docs note `label` "Defaults to a human-readable version of the icon type (for example, 'Story' for a story icon)" — if the design system actually displays this default name beside the tile/icon (the design-system page calls the component an "object tile" with a visible name), it COULD be visible. The Forge docs don't say so explicitly. **Recommendation: exclude until verified visually**, but worth checking against a live render.
- **DynamicTable's `Label` (capital L)** — Note the casing; docs say "Used to provide a better description of the table for users with assistive technologies. Rather than a screen reader speaking 'Table'..." — explicitly aria. **Exclude.**

## Notes / surprises

1. **Inline.separator** is the most surprising visible-text prop — a layout primitive that injects a string between children. Easy to miss because layout components usually have no text props at all.

2. **UIKit 2 has no `Em` / `Strong` / `Strike` components.** Your shim re-exports them but the docs only describe `<Text as="em|strong|strike">`. They behave as Text variants; `children` is the only text prop.

3. **Modal has both `title` (visible) and `label` (screen-reader)** — easy to confuse. `title` actually drives a built-in header chrome when set; `label` is purely aria.

4. **Comment is unusually rich.** Multiple nested-object props (`author.text`, `time.text`, `actions[].text`, `errorActions[].text`) all render visible text but are non-trivial to walk. A pure top-level string-prop walker will miss all of these.

5. **Toggle.label is misleading.** The docs explicitly call it "Text to be used as `aria-label` of toggle component. Use this when there is no visible label for the toggle." So it's screen-reader only — different from Checkbox/Radio where `label` IS visible.

6. **Spinner.label, Icon.label, AtlassianIcon.label, Tile.label, AtlassianTile.label, ProgressTracker.label, ProgressBar.ariaLabel, ButtonGroup.label, DynamicTable.Label, Modal.label, Popup.label/titleId** — all documented as aria/accessibility names. Consistent naming convention worth noting: `label` on icon-like or display-only components tends to be aria; `label` on form inputs (Checkbox, Radio, UserPicker, FilePicker, InlineEdit) tends to be visible.

7. **Select / CheckboxGroup / RadioGroup all carry visible labels via `options[].label`** — this is the most common nested-data pattern. ProgressTracker uses `items[].label`. DynamicTable uses cell content in `head`/`rows`. These probably warrant a unified "extract `.label` from elements of array props named `options` or `items`" rule.

8. **CodeBlock.text holds the entire code body.** Worth handling — the code is visible content, even if it's not a "label".

9. **Many UIKit 1 components are gone in UIKit 2** (consistent with your background notes): no Table/Head/Row/Cell, no InlineDialog, no Flag. The shim might re-export those but the docs site does not document them.

## Final counts

- **Components with visible-text props (top-level string props worth allowlisting): 16**
  Tag, FormHeader, FormSection, EmptyState, SectionMessage, CodeBlock, Modal, DynamicTable (caption), Inline (separator), Checkbox, Radio, InlineEdit, UserPicker, FilePicker, FileCard, Comment.

- **Components with composite/nested-data visible text (need walker special-casing): 5**
  CheckboxGroup (options[].label), RadioGroup (options[].label), Select (options[].label), ProgressTracker (items[].label), DynamicTable (head/rows/emptyView).

- **Components with NO visible-text props (skip): 49+**
  Text, Heading, Code, Em, Strong, Strike, TagGroup, Badge, Lozenge, Tile, AtlassianTile, AtlassianIcon, Icon, Image, Spinner, ProgressBar, Link, Button, LinkButton, LoadingButton, Pressable, ButtonGroup, Stack, Box, Frame, Global, Form, FormFooter, Label, ErrorMessage, HelperMessage, ValidMessage, RequiredAsterisk, Textfield, TextArea, DatePicker, TimePicker, Calendar, Range, Toggle, Tabs, Tab, TabList, TabPanel, ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition, List, ListItem, User, UserGroup, SectionMessageAction, AdfRenderer, Tooltip, Popup, CommentEditor, ChromelessEditor, plus 7 chart components.

- **Uncertain: 4**
  Comment.errorIconLabel (likely aria), InlineEdit.label (docs typo — almost certainly visible), AtlassianTile.label / AtlassianIcon.label (default to a human-readable type name but docs frame as accessibility name).

## Surprises in the docs

- **Inline.separator** — a layout primitive with a real visible-text prop. Atypical; easy to miss.
- **Modal has both `title` (visible header) and `label` (aria-only)** — different roles for similar names.
- **InlineEdit.label is documented with `Type: boolean`** while every code example passes a string. Strongly suggests a docs typo.
- **Comment** is a hidden complexity hot-spot: 8+ visible-text props/sub-fields, several inside object literals (`author.text`, `time.text`, `actions[].text`).
- **`label` semantics flip between component categories**: on icon/display components it's aria-only; on form inputs it's visible. There's no syntactic signal — you have to read each component's docs.
- **AtlassianTile/AtlassianIcon `label`** defaults to a human-readable type name (e.g. "Story"), which suggests it MAY render visibly somewhere despite being framed as an accessibility prop. The Forge docs don't confirm visibility — worth a manual render check before deciding.
