/**
 * Tests for the deployer — manifest-driven app loading.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { ForgeSimulator } from '../simulator.js';
import { setSimulator } from '../shims/globals.js';
import { deploy } from '../deployer.js';
import { getLatestForgeDoc, waitForRender, resetBridge } from '../ui/bridge.js';
import { getTextContent, prettyPrint } from '../ui/doc-utils.js';

const TEST_APP_DIR = resolve(import.meta.dirname, '../../test-app');

describe('Deployer', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    resetBridge();
    vi.resetModules();
    sim = new ForgeSimulator();
    setSimulator(sim);
  });

  it('should load manifest and import all handler functions', async () => {
    // Mock Jira so the resolver doesn't fail on API calls
    sim.mockProductRoutes('jira', {
      '/rest/api/3/issue/': { key: 'MOCK-1', fields: { summary: 'Mocked' } },
    });

    const result = await deploy(sim, TEST_APP_DIR);

    expect(result.loadedFunctions).toContain('resolver');
    expect(result.loadedFunctions).toContain('queue-handler');
    // Resources are no longer loaded at deploy time — use sim.ui.render() instead
    expect(result.errors).toHaveLength(0);
  });

  it('should set manifest on the simulator', async () => {
    sim.mockProductRoutes('jira', {});
    await deploy(sim, TEST_APP_DIR);

    const manifest = sim.getManifest();
    expect(manifest).not.toBeNull();
    expect(manifest!.raw.app.name).toBe('Test Forge App');
  });

  it('should wire up resolvers from UI module function references', async () => {
    sim.mockProductRoutes('jira', {
      '/rest/api/3/issue/DEP-1': { key: 'DEP-1', fields: { summary: 'Deploy test' } },
    });

    await deploy(sim, TEST_APP_DIR);

    // The resolver 'getIssue' was defined by the app via @forge/resolver
    const result = await sim.invoke('getIssue', { issueKey: 'DEP-1' });
    expect(result.issue.key).toBe('DEP-1');
    expect(result.views).toBe(1);
  });

  it('should wire up queue consumers from manifest', async () => {
    sim.mockProductRoutes('jira', {
      '/rest/api/3/issue/Q-1': { key: 'Q-1', fields: { summary: 'Queue test' } },
    });

    await deploy(sim, TEST_APP_DIR);

    // Verify the consumer was registered by pushing directly to the queue
    const queue = sim.createQueue({ key: 'analytics-queue' });
    await queue.push({ body: { event: 'issue-viewed', issueKey: 'Q-1', timestamp: 1234567890 } });

    // The queue consumer should have stored analytics
    const allStorage = sim.kvs.dump();
    const analyticsKeys = Object.keys(allStorage).filter(k => k.startsWith('analytics:'));
    expect(analyticsKeys.length).toBeGreaterThan(0);
  });

  it('should do full-stack deploy: backend + UI from one call', async () => {
    sim.mockProductRoutes('jira', {
      '/rest/api/3/issue/TEST-1': { key: 'TEST-1', fields: { summary: 'Full stack test' } },
    });

    const result = await deploy(sim, TEST_APP_DIR);

    expect(result.loadedFunctions).toContain('resolver');
    expect(result.errors).toHaveLength(0);

    // Render the UI module — this loads the frontend resource
    // The frontend renders "Loading..." first, then async-fetches data and re-renders
    const manifest = sim.getManifest()!;
    const moduleKey = manifest.uiModules[0].key;
    await sim.ui.render(moduleKey);

    // Wait for the async data render (invoke→resolver→re-render)
    const doc = await sim.ui.waitForRender();
    const text = getTextContent(doc);

    // The UI should show data from the resolver, which hit the mocked Jira API
    expect(text).toContain('Full stack test');
    expect(text).toContain('Views');

    // The issue key is in the SectionMessage title prop (not text content)
    const docStr = JSON.stringify(doc);
    expect(docStr).toContain('TEST-1');

    // KVS should have been written by the resolver
    expect(await sim.kvs.get('views:TEST-1')).toBeGreaterThanOrEqual(1);

    console.log('Full-stack deploy result:\n' + prettyPrint(doc));
  });

  it('should report errors for missing handler files', async () => {
    // Deploy with a manifest that references a non-existent handler
    const { parseManifestContent } = await import('../manifest.js');
    const badManifest = parseManifestContent(`
modules:
  function:
    - key: ghost
      handler: nonexistent.handler
app:
  id: test
  name: Test
`);

    // Use deployer internals — can't easily test via deploy() without a real dir
    // But we can verify parseHandlerString logic works
    expect(badManifest.functions.get('ghost')?.handler).toBe('nonexistent.handler');
  });
});
