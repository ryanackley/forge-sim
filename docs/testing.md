# Testing Forge Apps with forge-sim

forge-sim lets you write fast, deterministic tests for your Forge app — resolvers, triggers, queues, KVS, SQL, product APIs, all of it. No cloud deploy, no Atlassian site required.

## Table of Contents

- [Bundler Configuration](#bundler-configuration)
  - [Vitest](#vitest)
  - [Webpack / Jest](#webpack--jest)
  - [Plain Node (no bundler)](#plain-node-no-bundler)
  - [Why is this needed?](#why-is-this-needed)
- [Getting Started](#getting-started)
  - [Install](#install)
  - [Your First Test](#your-first-test)
- [Core Concepts](#core-concepts)
  - [createSimulator()](#createsimulator)
  - [getSimulator()](#getsimulator)
  - [sim.deploy()](#simdeploy)
  - [sim.invoke()](#siminvoke)
- [Testing Patterns](#testing-patterns)
  - [Resolver Tests](#resolver-tests)
  - [SQL Tests](#sql-tests)
  - [KVS Tests](#kvs-tests)
  - [Trigger Tests](#trigger-tests)
  - [Queue / Consumer Tests](#queue--consumer-tests)
  - [Product API Mocking](#product-api-mocking)
  - [UIKit 2 Rendering](#uikit-2-rendering)
- [Tips](#tips)

---

## Bundler Configuration

**This section goes first because your tests won't work without it.**

Forge apps import packages like `@forge/api`, `@forge/resolver`, `@forge/kvs`, etc. In production, these are provided by the Forge runtime. In tests, forge-sim provides shim modules that redirect those imports to the simulator. Your test runner needs to know about these shims.

### Vitest

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// Point to forge-sim's compiled shims
const SHIMS = resolve(require.resolve('forge-sim'), '..', 'shims');

export default defineConfig({
  resolve: {
    alias: {
      '@forge/resolver':           resolve(SHIMS, 'forge-resolver.js'),
      '@forge/api':                resolve(SHIMS, 'forge-api.js'),
      '@forge/kvs':                resolve(SHIMS, 'forge-kvs.js'),
      '@forge/events':             resolve(SHIMS, 'forge-events.js'),
      '@forge/react':              resolve(SHIMS, 'forge-react.js'),
      '@forge/bridge':             resolve(SHIMS, 'forge-bridge.js'),
      '@forge/jira-bridge':        resolve(SHIMS, 'forge-jira-bridge.js'),
      '@forge/confluence-bridge':  resolve(SHIMS, 'forge-confluence-bridge.js'),
      '@forge/dashboards-bridge':  resolve(SHIMS, 'forge-dashboards-bridge.js'),
    },
  },
  test: {
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
```

> **Note:** You only need aliases for the `@forge/*` packages your app actually imports. The full list is shown above for reference.

### Webpack / Jest

```js
// jest.config.js (or webpack.config.js resolve.alias)
const path = require('path');
const SHIMS = path.resolve(require.resolve('forge-sim'), '..', 'shims');

module.exports = {
  // Jest
  moduleNameMapper: {
    '^@forge/resolver$':          path.resolve(SHIMS, 'forge-resolver.js'),
    '^@forge/api$':               path.resolve(SHIMS, 'forge-api.js'),
    '^@forge/kvs$':               path.resolve(SHIMS, 'forge-kvs.js'),
    '^@forge/events$':            path.resolve(SHIMS, 'forge-events.js'),
    '^@forge/react$':             path.resolve(SHIMS, 'forge-react.js'),
    '^@forge/bridge$':            path.resolve(SHIMS, 'forge-bridge.js'),
    '^@forge/jira-bridge$':       path.resolve(SHIMS, 'forge-jira-bridge.js'),
    '^@forge/confluence-bridge$': path.resolve(SHIMS, 'forge-confluence-bridge.js'),
    '^@forge/dashboards-bridge$': path.resolve(SHIMS, 'forge-dashboards-bridge.js'),
  },

  // Webpack (resolve.alias section)
  // resolve: {
  //   alias: {
  //     '@forge/resolver': path.resolve(SHIMS, 'forge-resolver.js'),
  //     '@forge/api':      path.resolve(SHIMS, 'forge-api.js'),
  //     // ... same pattern
  //   },
  // },
};
```

### Plain Node (no bundler)

If you're running tests with plain Node (no Vitest, no Jest, no bundler), `sim.deploy()` automatically registers loader hooks via `module.register()`. No configuration needed:

```bash
node my-test-script.js   # Just works — deploy() handles shim registration
```

### Why is this needed?

forge-sim uses [Node.js module loader hooks](https://nodejs.org/api/module.html#customization-hooks) to intercept `@forge/*` imports and redirect them to simulator shims. This works perfectly in plain Node.

However, **bundler-based test runners** (Vitest, Jest, webpack) use their own module resolution pipelines and bypass Node's loader hooks entirely. The alias/mapper config tells the bundler where to find the shim modules.

> **`@forge/sql` note:** There is no shim for `@forge/sql`. The real `@forge/sql` package communicates with the simulator through a runtime hook (`global.__forge_fetch__`), which forge-sim installs automatically when you call `createSimulator()`. No alias needed for SQL.

---

## Getting Started

### Install

```bash
npm install --save-dev forge-sim vitest
```

If forge-sim isn't published to npm yet, link it locally:

```bash
npm link ../path/to/forge-sim
```

### Your First Test

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createSimulator, type ForgeSimulator } from 'forge-sim';
import { resolve } from 'node:path';

describe('My Forge App', () => {
  let sim: ForgeSimulator;

  beforeAll(async () => {
    sim = createSimulator();
    await sim.deploy(resolve(import.meta.dirname, '..'));
  });

  afterAll(async () => {
    await sim.stop();
  });

  it('creates a thing', async () => {
    const result = await sim.invoke('createItem', { title: 'Hello' });
    expect(result.success).toBe(true);
  });
});
```

That's it. `deploy()` reads your `manifest.yml`, imports your handlers, runs any scheduled triggers (like migrations), and wires everything up.

---

## Core Concepts

### createSimulator()

Creates a fresh simulator instance. Call once per test suite (or per test if you need isolation).

```ts
import { createSimulator } from 'forge-sim';

// Defaults — clean slate
const sim = createSimulator();

// With pre-seeded storage
const sim = createSimulator({
  initialStorage: {
    'config:theme': { mode: 'dark' },
  },
});

// With mock context (accountId, cloudId, etc.)
const sim = createSimulator({
  context: {
    accountId: 'user-123',
    cloudId: 'cloud-abc',
  },
});
```

The constructor automatically calls `setSimulator()`, so all `@forge/*` shims connect to this instance immediately.

### getSimulator()

Retrieves the active simulator instance from anywhere. Useful in shared test utilities:

```ts
import { getSimulator } from 'forge-sim';

// In a test helper
function seedTestData() {
  const sim = getSimulator();
  return sim.kvs.set('testKey', { value: 42 });
}
```

### sim.deploy()

Loads your manifest, imports handler modules, fires scheduled triggers, and returns a summary:

```ts
const result = await sim.deploy('./my-forge-app');

result.loadedFunctions;  // ['myResolver', 'migrationFn', 'onIssueFn']
result.loadedResources;  // ['main', 'admin-page']
result.errors;           // [{ functionKey, error }] — empty if all good
```

**If your app uses Forge SQL**, start the embedded MySQL before deploying (migrations often run on deploy):

```ts
await sim.sql.start();
await sim.deploy('./my-app');
```

### sim.invoke()

Calls a resolver function — the same way the Forge UI bridge does:

```ts
const result = await sim.invoke('getItems', { page: 1 });
// result is whatever your resolver returns
```

The first argument is the function key defined in your resolver (via `resolver.define('getItems', ...)`), not the manifest function key.

---

## Testing Patterns

### Resolver Tests

Test your resolver handlers through `sim.invoke()`:

```ts
it('creates and retrieves an item', async () => {
  const created = await sim.invoke('createItem', {
    title: 'Test Item',
    priority: 'high',
  });
  expect(created.success).toBe(true);
  expect(created.id).toBeDefined();

  const fetched = await sim.invoke('getItem', { id: created.id });
  expect(fetched.title).toBe('Test Item');
});

it('returns error for missing item', async () => {
  const result = await sim.invoke('getItem', { id: 'nonexistent' });
  expect(result.error).toBe('Not found');
});
```

### SQL Tests

If your app uses `@forge/sql`, start the embedded database first:

```ts
let sim: ForgeSimulator;

beforeAll(async () => {
  sim = createSimulator();
  await sim.sql.start();           // Starts embedded MySQL
  await sim.deploy('./my-app');    // Runs migrations if your app has them
});

afterAll(async () => {
  await sim.stop();                // Stops MySQL + cleans up
});

it('queries data correctly', async () => {
  await sim.invoke('createRecord', { name: 'Alice', score: 95 });
  await sim.invoke('createRecord', { name: 'Bob', score: 87 });

  const result = await sim.invoke('getTopScorers', { limit: 10 });
  expect(result.records).toHaveLength(2);
  expect(result.records[0].name).toBe('Alice');
});

// You can also query SQL directly for assertions
it('schema has the right tables', async () => {
  const tables = await sim.sql.query('SHOW TABLES');
  const names = tables.map(r => Object.values(r)[0]);
  expect(names).toContain('users');
  expect(names).toContain('scores');
});
```

### KVS Tests

Read and write KVS directly for setup/assertions:

```ts
it('stores user preferences', async () => {
  await sim.invoke('savePreferences', {
    theme: 'dark',
    language: 'en',
  });

  // Assert directly against KVS
  const stored = await sim.kvs.get('prefs:user-123');
  expect(stored.theme).toBe('dark');
});

it('uses pre-seeded config', async () => {
  // Seed before invoking
  await sim.kvs.set('config:feature-flags', {
    newDashboard: true,
    betaSearch: false,
  });

  const result = await sim.invoke('getFeatureFlags');
  expect(result.newDashboard).toBe(true);
});
```

### Trigger Tests

Fire trigger events and assert on side effects:

```ts
it('handles issue created event', async () => {
  const results = await sim.fireTrigger('avi:jira:issue:created', {
    issue: {
      key: 'TEST-1',
      fields: { summary: 'Bug report', issuetype: { name: 'Bug' } },
    },
  });

  // fireTrigger returns an array — one result per matching handler
  expect(results).toHaveLength(1);

  // Check side effects (e.g., trigger stored something)
  const log = await sim.kvs.get('audit:TEST-1');
  expect(log).toBeDefined();
});
```

### Queue / Consumer Tests

Push to queues directly and verify consumer processing:

```ts
it('consumer processes queue jobs', async () => {
  // Push directly to a queue defined in your manifest
  await sim.queue.push('emailQueue', {
    body: { to: 'user@example.com', subject: 'Hello' },
  });

  // In forge-sim, consumers fire synchronously after push
  // Assert on whatever the consumer does (KVS write, SQL insert, etc.)
  const sent = await sim.kvs.get('email:sent:latest');
  expect(sent.to).toBe('user@example.com');
});
```

### Product API Mocking

Mock Jira, Confluence, or Bitbucket API responses:

```ts
beforeAll(() => {
  sim.mockProductRoutes('jira', {
    'GET /rest/api/3/myself': {
      accountId: 'user-123',
      displayName: 'Test User',
    },
    'POST /rest/api/3/search/jql': {
      total: 5,
      issues: [
        { key: 'TEST-1', fields: { summary: 'Issue 1' } },
      ],
    },
  });
});

it('fetches current user from Jira', async () => {
  const result = await sim.invoke('getCurrentUser');
  expect(result.displayName).toBe('Test User');
});
```

Update mocks mid-test to simulate changing conditions:

```ts
it('handles empty search results', async () => {
  sim.mockProductRoutes('jira', {
    'POST /rest/api/3/search/jql': { total: 0, issues: [] },
  });

  const result = await sim.invoke('searchIssues', { jql: 'project = EMPTY' });
  expect(result.issues).toHaveLength(0);
});
```

### UIKit 2 Rendering

forge-sim includes a headless UIKit renderer. Your app's JSX runs through the same `@forge/react` reconciler that Forge uses, producing a **ForgeDoc** — a JSON tree representing the rendered UI. You can inspect it, query it, simulate interactions, and assert on it. No browser needed.

#### Render and inspect

```ts
it('renders the issue panel', async () => {
  // Render a UI module from your manifest (by module key)
  await sim.ui.render('issue-panel', {
    context: { issueKey: 'PROJ-42' },
  });

  // Wait for async data to load (e.g., useEffect → invoke → re-render)
  const doc = await sim.ui.waitForContent('issue-panel', 'PROJ-42');

  // Extract all text from the rendered tree
  const text = sim.ui.getTextContent(doc);
  expect(text).toContain('PROJ-42');
  expect(text).toContain('Fix the bug');
});
```

#### Query the ForgeDoc tree

The ForgeDoc is a simple tree of `{ type, props, children }` nodes. Use the built-in query helpers:

```ts
it('renders a button and a badge', async () => {
  await sim.ui.render('my-panel');
  const doc = sim.ui.getForgeDoc('my-panel')!;

  // Find all components by type
  const buttons = sim.ui.findByType(doc, 'Button');
  expect(buttons).toHaveLength(2);

  // Find a specific button by its text content
  const saveBtn = sim.ui.findByTypeAndText(doc, 'Button', 'Save');
  expect(saveBtn.props.appearance).toBe('primary');

  // Find by type — works for any UIKit component
  const badges = sim.ui.findByType(doc, 'Badge');
  expect(badges[0].props.appearance).toBe('added');
});
```

#### Simulate interactions

Click buttons, change form values, and assert on the re-rendered UI:

```ts
it('toggles theme on button click', async () => {
  await sim.ui.render('settings-page');
  const doc = await sim.ui.waitForContent('settings-page', 'Theme: light');

  // Find the toggle button and click it
  const toggleBtn = sim.ui.findByTypeAndText(doc, 'Button', 'Toggle');
  sim.ui.interact(toggleBtn, 'onClick');

  // Wait for re-render after state change
  const updated = await sim.ui.waitForContent('settings-page', 'Theme: dark');
  expect(sim.ui.getTextContent(updated)).toContain('Theme: dark');
});

// Or use the shorthand: find + interact + get updated doc in one call
it('shorthand: interactWith', async () => {
  await sim.ui.render('settings-page');
  await sim.ui.waitForContent('settings-page', 'Theme: light');

  const { updatedDoc } = await sim.ui.interactWith('Button', {
    matchText: 'Toggle',
    event: 'onClick',
  });

  expect(sim.ui.getTextContent(updatedDoc!)).toContain('Theme: dark');
});
```

#### Multiple modules, isolated trees

Each module gets its own ForgeDoc tree. Render multiple modules and assert independently:

```ts
it('renders two panels without cross-contamination', async () => {
  await sim.ui.render('issue-panel', { context: { issueKey: 'TEST-1' } });
  await sim.ui.render('admin-panel');

  await sim.ui.waitForContent('issue-panel', 'TEST-1');
  await sim.ui.waitForContent('admin-panel', 'Admin');

  const issueDoc = sim.ui.getForgeDoc('issue-panel')!;
  const adminDoc = sim.ui.getForgeDoc('admin-panel')!;

  // Content is isolated
  expect(sim.ui.getTextContent(issueDoc)).not.toContain('Admin');
  expect(sim.ui.getTextContent(adminDoc)).not.toContain('TEST-1');

  // But they share KVS
  await sim.kvs.set('shared-key', 'hello');
  const val = await sim.kvs.get('shared-key');
  expect(val).toBe('hello');
});
```

#### Debug with prettyPrint

When a test fails and you need to see the UI tree:

```ts
it('debug example', async () => {
  await sim.ui.render('my-panel');
  const doc = await sim.ui.waitForContent('my-panel', 'Ready');

  // Prints a readable tree to console
  console.log(sim.ui.prettyPrint(doc));
  // <Root>
  //   <Stack space="space.200">
  //     <Text>
  //       <String text="Ready" />
  //     </Text>
  //     <Button appearance="primary">
  //       <String text="Save" />
  //     </Button>
  //   </Stack>
  // </Root>
});
```

#### sim.ui API summary

| Method | Description |
|--------|-------------|
| `render(moduleKey, options?)` | Render a UIKit module. Options: `{ context: { issueKey?, contentId?, spaceKey? } }` |
| `getForgeDoc(moduleKey?)` | Get the current ForgeDoc tree. Omit key for most recent render. |
| `waitForRender()` | Wait for the next render from any module. |
| `waitForContent(moduleKey, text)` | Wait until rendered text includes the given string. |
| `findByType(doc, type)` | Find all nodes of a component type (e.g., `'Button'`, `'Text'`). |
| `findByTypeAndText(doc, type, text?)` | Find a node by type and optional text content. |
| `getTextContent(doc)` | Extract all text from a ForgeDoc subtree. |
| `interact(node, event, ...args)` | Simulate an event (e.g., `'onClick'`) on a ForgeDoc node. |
| `interactWith(type, options?)` | Find + interact + return updated doc in one call. |
| `prettyPrint(doc)` | Pretty-print the tree for debugging. |
| `refresh(moduleKey)` | Re-render a module with its last context. |
| `getRenderedModules()` | List all module keys that have been rendered. |
| `reset()` | Clear the most recent render. |
| `resetAll()` | Clear all rendered modules. |

---

## Tips

**One simulator per `describe` block.** Create in `beforeAll`, stop in `afterAll`. This keeps tests isolated while sharing the deploy overhead.

**Use `sim.sql.start()` only when needed.** It launches an embedded MySQL process. If your app doesn't use `@forge/sql`, skip it — tests will be faster.

**Mock product APIs before deploy.** If your app's scheduled triggers hit Jira/Confluence on startup, set up mocks first:

```ts
beforeAll(async () => {
  sim = createSimulator();
  sim.mockProductRoutes('jira', { /* ... */ });
  await sim.sql.start();
  await sim.deploy('./my-app');  // Safe — API calls during deploy hit mocks
});
```

**Assert on internals.** Unlike production Forge, you have direct access to KVS, SQL, and queues. Use them for assertions instead of only testing through resolvers:

```ts
// Instead of just checking the resolver response...
const result = await sim.invoke('deleteItem', { id: '123' });
expect(result.success).toBe(true);

// ...also verify the actual state
const item = await sim.kvs.get('item:123');
expect(item).toBeUndefined();
```

**`sim.stop()` cleans up everything.** It stops the MySQL process, clears state, and resets the global simulator reference. Always call it in `afterAll`.
