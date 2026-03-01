# forge-sim

Simulated Forge runtime for AI-driven development and testing of Atlassian Forge apps.

## What This Does

Provides an in-memory simulation of the Forge platform so you can develop, test, and iterate on Forge apps **without deploying**. Designed to be driven by AI coding assistants via MCP tools (coming soon).

## What's Simulated

| Forge Feature | Status | Module |
|---|---|---|
| Key-Value Storage (`@forge/kvs`) | ✅ Full | `SimulatedKVS` |
| Secrets (`kvs.setSecret/getSecret`) | ✅ Full | `SimulatedKVS` |
| KVS Query (beginsWith, pagination, sort) | ✅ Full | `KVSQueryBuilder` |
| KVS Batch (getMany/setMany/deleteMany) | ✅ Full | `SimulatedKVS` |
| KVS Transactions | ✅ Basic | `SimulatedKVS` |
| Resolvers (`@forge/resolver`) | ✅ Full | `SimulatedResolver` |
| Async Events / Queues (`@forge/events`) | ✅ Full | `SimulatedQueue` |
| Product APIs (requestJira, etc.) | ✅ Mockable | `SimulatedProductApi` |
| Manifest Parsing | ✅ Full | `parseManifest` |
| Event Triggers | ✅ Basic | `ForgeSimulator.fireTrigger` |
| UIKit 2 Rendering | 🔜 Next | (from uikit-test) |
| Forge SQL | 🔜 Planned | |
| MCP Server Interface | 🔜 Planned | |
| Scheduled Triggers | 🔜 Planned | |

## Quick Start

```typescript
import { ForgeSimulator } from 'forge-sim';

const sim = new ForgeSimulator({
  initialStorage: { 'config:theme': 'dark' },
});

// Define resolvers (like your Forge app would)
sim.resolver.define('getTheme', async (req) => {
  return await sim.kvs.get('config:theme');
});

sim.resolver.define('setTheme', async (req) => {
  await sim.kvs.set('config:theme', req.payload.theme);
  return { success: true };
});

// Invoke them (simulates bridge invoke calls)
const theme = await sim.invoke('getTheme');
console.log(theme); // 'dark'

await sim.invoke('setTheme', { theme: 'light' });
```

## Mock Product APIs

```typescript
sim.mockProductRoutes('jira', {
  '/rest/api/3/issue/PROJ-1': {
    key: 'PROJ-1',
    fields: { summary: 'My Issue' },
  },
});

sim.resolver.define('getIssue', async (req) => {
  const api = sim.createApiClient('asUser');
  const res = await api.requestJira(`/rest/api/3/issue/${req.payload.key}`);
  return res.json();
});
```

## Async Events / Queues

```typescript
sim.registerConsumer('work-queue', async (event) => {
  console.log('Processing:', event.body);
  await sim.kvs.set(`result:${event.body.id}`, { done: true });
});

sim.resolver.define('submitWork', async (req) => {
  const q = sim.createQueue({ key: 'work-queue' });
  await q.push({ body: { id: req.payload.id } });
  return { queued: true };
});
```

## Testing Pyramid Vision

1. **Level 1 (this):** Full simulation with mocked APIs — fast, safe, AI-driveable
2. **Level 2 (planned):** Simulation with real Atlassian API calls
3. **Level 3 (planned):** Actual Forge deployment validation

## Development

```bash
npm install
npm test
```
