# forge-sim

Simulated Forge runtime for AI-driven development and testing of Atlassian Forge apps.

## What This Does

Provides an in-memory simulation of the Forge platform so you can develop, test, and iterate on Forge apps **without deploying**. Deploy a Forge app with one call — manifest-driven, zero app modifications.

## Features

- **Full @forge/* shim layer** — App code imports `@forge/api`, `@forge/kvs`, `@forge/events`, `@forge/resolver` and gets our sim. Zero changes needed.
- **Manifest-driven deploy** — Point at an app directory, everything gets wired up automatically
- **UIKit rendering** — `@forge/react` apps render through a simulated bridge connected to the backend
- **Concurrent queue processing** — Expose real race conditions in consumer code
- **Concurrency keys** — Named semaphores across queues (per Forge spec)
- **Mockable product APIs** — Route-based mocks for Jira, Confluence, Bitbucket

## Quick Start

```typescript
import { ForgeSimulator, setSimulator } from 'forge-sim';

const sim = new ForgeSimulator();
setSimulator(sim);

// Mock the Jira API
sim.mockProductRoutes('jira', {
  '/rest/api/3/issue/PROJ-1': { key: 'PROJ-1', summary: 'My Issue' },
});

// Deploy your app — reads manifest.yml, imports handlers, wires up UI
const result = await sim.deploy('./my-forge-app');

// Invoke resolvers
const data = await sim.invoke('getIssue', { issueKey: 'PROJ-1' });

// Inspect state
console.log(await sim.kvs.get('views:PROJ-1'));
console.log(sim.getLogs());
```

Run with loader hooks for standalone execution:
```bash
node --import forge-sim/dist/loader/register.js your-app.js
```

## Race Condition Detection

```typescript
const sim = new ForgeSimulator({
  queueMode: 'concurrent',    // process events in parallel
  storageLatency: true,        // simulate async KVS to expose interleaving
});

// This BREAKS — naive get→set loses updates under concurrency:
sim.registerConsumer('work', async () => {
  const val = await kvs.get('counter');
  await kvs.set('counter', val + 1);  // race!
});

// This WORKS — transact is atomic:
sim.registerConsumer('work', async () => {
  await kvs.transact('counter', (val) => (val ?? 0) + 1);
});
```

## What's Simulated

| Feature | Status |
|---|---|
| Key-Value Storage (`@forge/kvs`) | ✅ Full (get/set/delete/query/batch/transact/secrets) |
| Resolvers (`@forge/resolver`) | ✅ Full |
| Async Events / Queues (`@forge/events`) | ✅ Full (concurrent mode, concurrency keys) |
| Product APIs (Jira/Confluence/Bitbucket) | ✅ Mockable |
| UIKit 2 Rendering (`@forge/react`) | ✅ Bridge connected to sim |
| Manifest Parsing + Auto-Deploy | ✅ Full |
| Event Triggers | ✅ Basic |
| MCP Server Interface | 🔜 Next |
| Forge SQL | 🔜 Planned |

## Development

```bash
npm install
npm test          # 53 tests
npm run build     # TypeScript compile
```

## License

Private — not yet published.
