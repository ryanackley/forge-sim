/**
 * Smoke test: boot the simulator, set it as the global, then dynamically
 * import the Forge app code (which uses @forge/* imports via loader hooks).
 */
import { ForgeSimulator, setSimulator } from '../dist/index.js';

// 1. Create and register simulator
const sim = new ForgeSimulator();
setSimulator(sim);

// 2. Mock Jira
sim.mockProductRoutes('jira', {
  '/rest/api/3/issue/TEST-1': { key: 'TEST-1', summary: 'It works!' },
});

// 3. Register a queue consumer to capture events
const events = [];
sim.registerConsumer('work-queue', async (event) => {
  events.push(event.body);
});

// 4. Import the app (this triggers @forge/* imports → our shims)
await import('./index.js');

// 5. Invoke the resolver
const result = await sim.invoke('getIssue', { issueKey: 'TEST-1' });

console.log('✅ Result:', JSON.stringify(result, null, 2));
console.log('✅ KVS views:', await sim.kvs.get('views:TEST-1'));
console.log('✅ Queue events:', events.length);
console.log('🎉 Forge app ran against simulated runtime — zero code changes!');
