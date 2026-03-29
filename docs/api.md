# Programmatic API

Use forge-sim directly in your code for tests, scripts, or custom tooling.

## Basic Usage

```typescript
import { createSimulator } from 'forge-sim';

const sim = createSimulator();  // Auto-wires global shim state

// Deploy your app
const result = await sim.deploy('./my-forge-app');

// Invoke resolvers
const data = await sim.invoke('getIssue', { issueKey: 'PROJ-1' });

// Inspect state
const value = await sim.kvs.get('my-key');
const logs = sim.getLogs();
```

**Run with loader hooks** to intercept `@forge/*` imports:

```bash
node --import forge-sim/dist/loader/register.js your-script.js
```

## API Reference

### Deploy & Reset

```typescript
// Deploy from app directory (reads manifest.yml, loads handlers)
const result = await sim.deploy('./my-forge-app');
// result.manifest, result.loadedFunctions, result.errors

// Reset all state
sim.reset();
```

### Resolvers

```typescript
// Invoke a resolver by function key
const result = await sim.invoke('getIssue', { issueKey: 'PROJ-1' });

// List registered resolvers
const defs = sim.resolver.getDefinitions();
```

### Key-Value Storage

```typescript
// Basic CRUD
await sim.kvs.set('key', { any: 'value' });
const val = await sim.kvs.get('key');
await sim.kvs.delete('key');

// Query with filters
const result = await sim.kvs.query()
  .where('key', { beginsWith: 'board:' })
  .limit(10)
  .getMany();

// Transactions (atomic multi-key writes)
await sim.kvs.transact()
  .set('key1', value1)
  .set('key2', value2)
  .delete('key3')
  .execute();

// Dump all KVS data
const dump = sim.kvs.dump();
```

### Forge SQL

```typescript
// Optionally pre-start MySQL (otherwise starts automatically on first query)
await sim.sql.start();

// Query
const rows = await sim.sql.query('SELECT * FROM users WHERE active = ?', [true]);

// The SQL shim provides a fetch-compatible interface
const fetchFn = sim.sql.createFetchFunction();
```

### Queues

```typescript
// Push to a queue
const result = await sim.queue.push('my-queue', { body: { action: 'process' } });

// Inspect queue state
const eventLog = sim.queue.getEventLog();
const job = sim.queue.getJob(result.jobId);
```

### Triggers

```typescript
// Fire a product event trigger
const results = await sim.fireTrigger('avi:jira:created:issue', {
  issue: { key: 'PROJ-1' },
});

// Fire a scheduled trigger
const result = await sim.fireScheduledTrigger('run-migrations');
```

### Product API Mocking

```typescript
// Mock specific routes
sim.mockProductRoutes('jira', {
  '/rest/api/3/issue/PROJ-1': { key: 'PROJ-1', summary: 'My Issue' },
  'POST /rest/api/3/issue': { id: '10001', key: 'PROJ-2' },
});

// Connect to real APIs (mocked routes still take priority)
await sim.connectRealApis({
  site: 'mysite.atlassian.net',
  email: 'user@example.com',
  apiToken: 'ATATT3x...',
});
```

### UI

```typescript
// Render a UI module with context
const doc = await sim.ui.render('issue-panel', {
  context: { issueKey: 'PROJ-42' },
});

// Wait for async content (resolvers, useEffect, etc.)
const rendered = await sim.ui.waitForContent('issue-panel', 'PROJ-42');

// Get current ForgeDoc tree
const currentDoc = sim.ui.getForgeDoc();        // default module
const specific = sim.ui.getForgeDoc('my-panel'); // specific module

// Pretty-print the UI
console.log(sim.ui.prettyPrint(rendered));

// Get all text content as a flat string (great for assertions)
const text = sim.ui.getTextContent(rendered);
expect(text).toContain('PROJ-42');

// Find components in the tree
const buttons = sim.ui.findByType(doc, 'Button');
const saveBtn = sim.ui.findByTypeAndText(doc, 'Button', 'Save');
const primary = sim.ui.findByProps(doc, { appearance: 'primary' });

// Interact with a component (fires real React event handlers)
sim.ui.interact(saveBtn, 'onClick');
sim.ui.interact(selectNode, 'onChange', 'option-a');

// High-level: find + interact + get updated doc in one call
const { result, updatedDoc } = await sim.ui.interactWith('Button', {
  matchText: 'Load Comments',
});

// Render multiple modules independently (isolated ForgeDoc trees)
await sim.ui.render('issue-summary', { context: { issueKey: 'PROJ-1' } });
await sim.ui.render('admin-settings');
const modules = sim.ui.getRenderedModules(); // ['issue-summary', 'admin-settings']

// Refresh a module (re-renders with same context)
await sim.ui.refresh('issue-summary');
```

### Logs

```typescript
const logs = sim.getLogs();          // Simulator logs
const console = sim.getConsoleLogs(); // Captured console.* from app code
sim.clearLogs();
```

## Function Contracts

forge-sim enforces the correct calling convention for each Forge function type:

| Type | Signature | Return Contract |
|------|-----------|-----------------|
| **Resolver** (UI bridge) | `({ payload, context }) => result` | Any JSON |
| **Event Trigger** | `(event, context) => result` | Any |
| **Scheduled Trigger** | `({ context }) => { statusCode }` | Must return `{ statusCode }` or 424 |
| **Consumer** (async events) | `(event, context) => result` | `InvocationError` = retry |
| **Web Trigger** | `(request, context) => { statusCode, body?, headers? }` | HTTP-like response |
