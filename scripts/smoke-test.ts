/**
 * Smoke test — exercises the full MCP tool flow in a single process.
 * Run: node --import ./dist/loader/register.js scripts/smoke-test.js
 */

import { ForgeSimulator, setSimulator } from '../src/simulator.js';
import { getLatestForgeDoc, resetBridge } from '../src/ui/bridge.js';
import { prettyPrint } from '../src/ui/doc-utils.js';
import { resolve } from 'node:path';

const TEST_APP = resolve(import.meta.dirname, '..', 'test-app');

async function main() {
  console.log('🔧 Creating simulator...');
  const sim = new ForgeSimulator();
  setSimulator(sim);

  // Mock Jira API
  sim.mockProductRoutes('jira', {
    'GET /rest/api/3/issue/TEST-1': {
      id: '10001',
      key: 'TEST-1',
      fields: { summary: 'Smoke Test Issue', status: { name: 'Done' } },
    },
  });

  // 1. Deploy
  console.log('\n📦 Deploying test app...');
  const deployResult = await sim.deploy(TEST_APP);
  console.log(`   Functions: ${deployResult.loadedFunctions.join(', ')}`);
  console.log(`   Resources: ${deployResult.loadedResources.join(', ')}`);
  console.log(`   Errors: ${deployResult.errors.length}`);
  if (deployResult.errors.length > 0) {
    for (const err of deployResult.errors) {
      console.log(`   ❌ ${err.functionKey}: ${err.error}`);
    }
  }

  // 2. Invoke resolver
  console.log('\n🔍 Invoking getIssue resolver...');
  const result = await sim.invoke('getIssue', { issueKey: 'TEST-1' });
  console.log('   Result:', JSON.stringify(result, null, 2));

  // 3. Check console logs
  const consoleLogs = sim.getConsoleLogs();
  if (consoleLogs.length > 0) {
    console.log(`\n📋 Captured ${consoleLogs.length} console line(s):`);
    for (const line of consoleLogs) {
      console.log(`   [${line.level}] ${line.message}`);
    }
  }

  // 4. Check UI state
  console.log('\n🎨 UI State:');
  // Give React a tick to render
  await new Promise(r => setTimeout(r, 100));
  const doc = getLatestForgeDoc();
  if (doc) {
    console.log(prettyPrint(doc));
  } else {
    console.log('   (no UI rendered)');
  }

  // 5. KVS state
  console.log('\n💾 KVS State:');
  const dump = sim.kvs.dump();
  for (const [k, v] of Object.entries(dump)) {
    console.log(`   ${k} = ${JSON.stringify(v)}`);
  }

  // 6. Simulator logs
  const logs = sim.getLogs();
  console.log(`\n📊 Simulator logs: ${logs.length} entries`);
  for (const log of logs.slice(-10)) {
    console.log(`   [${log.level}] ${log.message}`);
  }

  // 7. Push to queue
  console.log('\n📤 Pushing to work-queue...');
  const qResult = await sim.queue.push('work-queue', [
    { body: { task: 'process-issue', issueKey: 'TEST-1' } },
  ]);
  console.log(`   Job ID: ${qResult.jobId}`);
  const job = sim.queue.getJob(qResult.jobId);
  console.log(`   Stats: ${JSON.stringify(job?.stats)}`);

  // 8. Final KVS check (queue consumer may have written)
  console.log('\n💾 KVS State (after queue):');
  const dump2 = sim.kvs.dump();
  for (const [k, v] of Object.entries(dump2)) {
    console.log(`   ${k} = ${JSON.stringify(v)}`);
  }

  console.log('\n✅ Smoke test complete!');
}

main().catch((err) => {
  console.error('❌ Smoke test failed:', err);
  process.exit(1);
});
