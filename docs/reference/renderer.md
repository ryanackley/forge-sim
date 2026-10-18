# UIKit Renderer

Real-time visual preview of Forge UIKit apps using genuine Atlaskit components. Your app renders closely to how it would in Jira/Confluence. There will be differences based on a variety of factors. It should be close enough for testing. 

## Architecture

Two modes, one backend:

### Server Mode (AI/MCP-driven)

```
Node (forge-sim)
├── @forge/react reconciler → produces ForgeDoc
├── Resolvers, KVS, SQL, Product APIs
├── MCP tools for programmatic control
└── WebSocket → Renderer (optional browser visualization)
```

The reconciler runs in Node.js. The ForgeDoc (intermediate UI tree) can be inspected via CLI (`forge-sim ui`) or MCP tools (`forge_ui_state`). Optionally, a browser can connect via WebSocket to visualize the rendered components.

### Browser Mode (CDT-debuggable)

```
Browser
├── @forge/react runs HERE (debuggable in Chrome DevTools)
├── Event handlers, useState, useEffect — all client-side
├── window.__bridge ← /__forge/bridge.js (forge-sim's browser bridge host)

forge-sim (Node)
├── Resolvers, KVS, SQL, Product APIs
└── Answers the bridge host's WebSocket RPCs
```

App code runs in the browser. You can set breakpoints in event handlers, use React DevTools, and inspect state changes in real-time. Bridge calls (`invoke()`, `requestJira()`, `view.getContext()`, …) go through `window.__bridge`, the same seam real Forge provides, and the bridge host relays them to forge-sim over WebSocket.

This is what `forge-sim dev` uses.

## The browser bridge

Every page `forge-sim dev` serves — UI Kit, Custom UI, and pages proxied with `--proxy` — loads one script ahead of all app code: `/__forge/bridge.js`, built from `src/bridge/hosts/browser` into `dist/bridge.js`. It installs `window.__bridge` (what `@forge/bridge` and `@forge/react` talk to) and implements every bridge command: resolver and product calls over WebSocket RPC; flags, modals, history, navigation and cross-module events in the DOM. The protocol it speaks lives in `src/bridge/protocol` and is shared with the headless host used by tests and the MCP server, so a command cannot work on one surface and silently return `undefined` on another.

There is no `@forge/bridge` alias. Source-mode UI Kit apps, prebuilt bundles and Custom UI all run the **real** `@forge/bridge`, which looks up `window.__bridge` at call time — the same thing it does inside real Forge. `renderer/src/bridge/forge-bridge-shim.ts` is forge-sim's own chrome hooks (reconcile stream, dev-server RPC for the gear menu) and is not an app-facing module.

Translations follow the real package too: its i18n does a page-relative `fetch('./__LOCALES__/i18n-info.json')` and `fetch('./__LOCALES__/<locale>.json')` rather than a bridge call, so the dev server answers `<page>/__LOCALES__/<file>` from the simulator's i18n store (the same store headless tests fill with `sim.i18n.setTranslations`). A missing locale is a 404, so the package raises its own error exactly as in production.

If a Forge app's **own** Vite dev server must serve the page, a plugin injects the same bundle from a running `forge-sim dev`:

```typescript no-check
// vite.config.ts (in your Forge app)
import { forgeSimPlugin } from 'forge-sim/renderer/bridge/vite-plugin-forge-sim';

export default defineConfig({
  plugins: [react(), forgeSimPlugin({ forgeSimUrl: 'http://localhost:5173', wsPort: 5174 })],
});
```

Prefer `forge-sim dev --proxy <url>`, which performs the same injection server-side with no app config.

## Component Coverage

Every UIKit 2 component is mapped to its real Atlaskit equivalent:

| Category | Components |
|----------|-----------|
| **Layout** | Box, Stack, Inline, Pressable, Text, Heading, Frame |
| **Inline Text** | Em, Strong, Strike |
| **Buttons** | Button, ButtonGroup, LinkButton, LoadingButton |
| **Form** | Form, FormHeader, FormFooter, FormSection, TextField, TextArea, Select, Checkbox, CheckboxGroup, Radio, RadioGroup, Toggle, Range, DatePicker, TimePicker, Calendar, InlineEdit |
| **Form Helpers** | Label, ErrorMessage, HelperMessage, ValidMessage, RequiredAsterisk |
| **Display** | Badge, Lozenge, Spinner, ProgressBar, ProgressTracker, SectionMessage, SectionMessageAction, EmptyState, Code, CodeBlock, Tooltip, Tag, TagGroup, Link, Image, Icon, Flag, InlineDialog, Popup, Comment |
| **User** | User, UserGroup |
| **Table** | Table, Head, Row, Cell, DynamicTable |
| **Tabs** | Tabs, Tab, TabList, TabPanel |
| **Modal** | Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter, ModalTransition |
| **List** | List, ListItem |
| **Tiles** | Tile, AtlassianTile, AtlassianIcon |
| **File** | FileCard, FilePicker |
| **Editors** | ChromelessEditor, CommentEditor (`@atlaskit/editor-core`), AdfRenderer (`@atlaskit/renderer`) |
| **Charts** | BarChart, StackBarChart, HorizontalBarChart, HorizontalStackBarChart, LineChart, PieChart, DonutChart |
| **Custom Field** | CustomFieldEdit |

## ForgeDoc

The ForgeDoc is forge-sim's intermediate representation of the UI tree. It's produced by the `@forge/react` reconciler and consumed by the renderer.

```
App JSX → @forge/react reconciler → ForgeDoc → ForgeDocRenderer → Atlaskit components
```

Each ForgeDoc node has:
- `type` — component name (e.g., `"Button"`, `"Text"`, `"Stack"`)
- `props` — component props (functions are serialized with `__id__` for the event bridge; see below)
- `children` — child nodes
- `key` — React key

The pretty-printer (`sim.ui.prettyPrint()`) produces a readable tree:

```
<Root>
  <Stack space="space.200">
    <Text>
      <String text="Hello World" />
    </Text>
    <Button appearance="primary">
      <String text="Click Me" />
    </Button>
  </Stack>
</Root>
```

### Function serialization (`__id__`)

ForgeDoc is pure JSON; it has to be, because it travels over the WebSocket between Node and the browser (or sits in `sim.ui.getForgeDoc()` for headless inspection). React handlers like `onClick={() => doThing()}` aren't JSON-serializable, so the reconciler replaces every function prop with a `{ __fn__: '<id>' }` token and stashes the real callback in a Node-side registry keyed by `__id__`.

When the renderer (browser) or `sim.ui.interact()` (tests) fires an event, the bridge sends `{ __fn__: '<id>', args }` back to Node, the registry looks the function up, and it runs in the original closure where it was created, so `useState` setters, captured variables, and refs all behave normally.

Practical consequences:
- Two renders with the same JSX produce **different** `__id__` values (functions are reconstructed each render). Don't snapshot or assert on `__fn__` IDs.
- `sim.ui.interact(node, 'onClick', ...args)` works because the node's `onClick` prop is still a serialized `__fn__` token; `interact` is the thing that resolves it.
- If a function prop is **missing** from the ForgeDoc when you expected it (e.g. `onClick` is `undefined`), the most common cause is that you forgot to pass it as a prop in your JSX, not a serialization bug.

### Server-mode `useEffect` and async state

The Node-side reconciler awaits the initial render only. If your component does the very common pattern:

```jsx
const App = () => {
  const [data, setData] = useState(null);
  useEffect(() => { invoke('getData').then(setData); }, []);
  return data ? <Text>{data}</Text> : <Text>Loading…</Text>;
};
```

then `sim.ui.render('my-module')` resolves with the **loading** tree, because the effect hasn't run-and-resolved-and-re-rendered yet. The MCP `forge_ui_render` tool has the same behavior: it only awaits the first reconcile.

Two ways to settle:

```ts
// In-process tests — substring match on the rendered tree
await sim.ui.render('my-module');
const doc = await sim.ui.waitForContent('my-module', 'Hello world');
```

```ts no-check
// MCP — same idea, scoped to the module
await mcp.forge_ui_wait_for({ moduleKey: 'my-module', text: 'Hello world' });
```

This applies to **server mode** only (the Node-side reconciler used by tests and MCP). In **browser mode** (`forge-sim dev`), effects run in the browser exactly like real Forge, so no wait helpers are needed.
