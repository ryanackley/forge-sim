# UIKit Renderer

Real-time visual preview of Forge UIKit apps using genuine Atlaskit components. Your app renders exactly as it would in Jira/Confluence — without deploying.

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

The reconciler runs in Node.js. The ForgeDoc (intermediate UI tree) can be inspected via CLI (`forge-sim ui`) or MCP tools (`forge.ui_state`). Optionally, a browser can connect via WebSocket to visualize the rendered components.

### Browser Mode (CDT-debuggable)

```
Browser
├── @forge/react runs HERE (debuggable in Chrome DevTools)
├── Event handlers, useState, useEffect — all client-side
├── @forge/bridge shim → WebSocket → forge-sim backend

forge-sim (Node)
├── Resolvers, KVS, SQL, Product APIs
└── Handles invoke() and requestProduct() calls
```

App code runs in the browser. You can set breakpoints in event handlers, use React DevTools, and inspect state changes in real-time. `invoke()` calls route over WebSocket to forge-sim's backend.

This is what `forge-sim dev` uses.

## @forge/bridge Shim

For browser mode, forge-sim provides a Vite plugin that aliases `@forge/bridge` to a WebSocket-backed shim:

```typescript
// vite.config.ts (in your Forge app)
import { forgeSimPlugin } from 'forge-sim/renderer/bridge/vite-plugin-forge-sim';

export default defineConfig({
  plugins: [react(), forgeSimPlugin()],
});
```

The shim intercepts all `@forge/bridge` calls:
- `invoke()` → WebSocket RPC to forge-sim backend
- `requestJira()` / `requestConfluence()` → forwarded to product API proxy
- `getContext()` → returns simulated context (accountId, cloudId, siteUrl, etc.)
- `view.submit()` / `view.close()` → logged

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
- `props` — component props (functions are serialized with `__id__` for the event bridge)
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
