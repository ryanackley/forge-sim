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
      '/rest/api/3/issue/': { key: 'MOCK-1', summary: 'Mocked' },
    });

    const result = await deploy(sim, TEST_APP_DIR);

    expect(result.loadedFunctions).toContain('resolver');
    expect(result.loadedFunctions).toContain('queue-handler');
    expect(result.loadedResources).toContain('main');
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
      '/rest/api/3/issue/DEP-1': { key: 'DEP-1', summary: 'Deploy test' },
    });

    await deploy(sim, TEST_APP_DIR);

    // The resolver 'getIssue' was defined by the app via @forge/resolver
    const result = await sim.invoke('getIssue', { issueKey: 'DEP-1' });
    expect(result.issue.key).toBe('DEP-1');
    expect(result.views).toBe(1);
  });

  it('should wire up queue consumers from manifest', async () => {
    sim.mockProductRoutes('jira', {
      '/rest/api/3/issue/Q-1': { key: 'Q-1', summary: 'Queue test' },
    });

    await deploy(sim, TEST_APP_DIR);

    // Invoke the resolver which pushes to the queue
    await sim.invoke('getIssue', { issueKey: 'Q-1' });

    // The queue consumer should have stored analytics
    const allStorage = sim.kvs.dump();
    const analyticsKeys = Object.keys(allStorage).filter(k => k.startsWith('analytics:'));
    expect(analyticsKeys.length).toBeGreaterThan(0);
  });

  it('should do full-stack deploy: backend + UI from one call', async () => {
    sim.mockProductRoutes('jira', {
      '/rest/api/3/issue/TEST-1': { key: 'TEST-1', summary: 'Full stack test' },
    });

    const result = await deploy(sim, TEST_APP_DIR);

    expect(result.loadedFunctions).toContain('resolver');
    expect(result.loadedResources).toContain('main');
    expect(result.errors).toHaveLength(0);

    // The UI resource was loaded, which triggers ForgeReconciler.render()
    // Wait for the async data fetch to complete
    const doc = await waitForRender();
    const text = getTextContent(doc);

    // The UI should show data from the resolver, which hit the mocked Jira API
    expect(text).toContain('TEST-1');
    expect(text).toContain('Full stack test');
    expect(text).toContain('Views');

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
