/**
 * Smoke test: deploy a Forge app into the simulator from its manifest.
 * Zero manual wiring — just point at the app directory.
 */
import { ForgeSimulator, setSimulator } from '../dist/index.js';

// 1. Create and register simulator
const sim = new ForgeSimulator();
setSimulator(sim);

// 2. Mock Jira API
sim.mockProductRoutes('jira', {
  '/rest/api/3/issue/TEST-1': { key: 'TEST-1', summary: 'It works!' },
});

// 3. Deploy the app — reads manifest.yml, imports handlers, wires everything
const result = await sim.deploy('./test-app');

console.log('📦 Deployed functions:', result.loadedFunctions);
if (result.errors.length) {
  console.log('⚠️  Errors:', result.errors);
}

// 4. Invoke the resolver (defined by the app via @forge/resolver)
const issueResult = await sim.invoke('getIssue', { issueKey: 'TEST-1' });

console.log('✅ Result:', JSON.stringify(issueResult, null, 2));
console.log('✅ KVS views:', await sim.kvs.get('views:TEST-1'));
console.log('✅ Logs:', sim.getLogs().map(l => `[${l.level}] ${l.message}`).join('\n   '));
console.log('🎉 Forge app deployed and invoked — manifest-driven, zero app changes!');
