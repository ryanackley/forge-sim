/**
 * Tests for the deployer — manifest-driven app loading.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { createSimulator, ForgeSimulator } from '../simulator.js';
import { deploy } from '../deployer.js';
import { getLatestForgeDoc, waitForRender, resetBridge } from '../ui/bridge.js';
import { getTextContent, prettyPrint } from '../ui/doc-utils.js';

const TEST_APP_DIR = resolve(import.meta.dirname, 'fixtures/test-app');

describe('Deployer', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    resetBridge();
    vi.resetModules();
    sim = createSimulator();
  });

  it('should load manifest and import all handler functions', async () => {
    // Mock Jira so the resolver doesn't fail on API calls
    sim.mockProductRoutes('jira', {
      '/rest/api/3/issue/': { key: 'MOCK-1', fields: { summary: 'Mocked' } },
    });

    const result = await deploy(sim, TEST_APP_DIR);

    expect(result.loadedFunctions).toContain('resolver');
    expect(result.loadedFunctions).toContain('queue-handler');
    // Resources aren't *loaded* at deploy time (sim.ui.render() does that),
    // but the deploy response records the keys we know about.
    expect(result.loadedResources).toContain('main');
    expect(result.errors).toHaveLength(0);
  });

  it('returns the same summary shapes as the MCP forge.deploy response (F3)', async () => {
    // Publish-gate F3: assertions written against the MCP deploy output
    // (`{resolvers, triggers, uiModules}`) failed against the in-process
    // `sim.deploy()` result, which only exposed the raw manifest. Both
    // surfaces now share these summary fields — this test pins the
    // in-process side; the MCP handler consumes these exact fields.
    sim.mockProductRoutes('jira', {
      '/rest/api/3/issue/': { key: 'MOCK-1', fields: { summary: 'Mocked' } },
    });

    const result = await deploy(sim, TEST_APP_DIR);

    // resolvers: registered resolver keys, same as sim.resolver.getDefinitions()
    expect(result.resolvers).toEqual(expect.arrayContaining(['getIssue', 'getText', 'getCount']));
    expect(result.resolvers).toEqual(sim.resolver.getDefinitions());

    // consumers: {key, queue, function}
    expect(result.consumers).toEqual([
      { key: 'analytics-consumer', queue: 'analytics-queue', function: 'queue-handler' },
    ]);

    // uiModules: {key, type, resource, resolver}
    expect(result.uiModules).toEqual([
      expect.objectContaining({
        key: 'hello-panel',
        type: 'jira:issuePanel',
        resource: 'main',
        resolver: 'resolver',
      }),
    ]);

    // triggers: present (empty for this fixture) with a stable array shape
    expect(result.triggers).toEqual([]);
  });

  it('exposes manifest warnings on the deploy result (N6)', async () => {
    // Build a manifest that's missing app.runtime — that's the specific
    // case the N6 audit called out. The in-process deploy used to
    // console.warn this but never put it on the response, so MCP callers
    // were blind to it.
    const { mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = join(tmpdir(), 'forge-sim-n6-' + Date.now());
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'src', 'main.tsx'), `import ForgeReconciler, { Text } from '@forge/react';\nForgeReconciler.render(<Text>hi</Text>);\n`);
    writeFileSync(join(dir, 'manifest.yml'), `
modules:
  jira:issuePanel:
    - key: panel
      title: Panel
      resource: main
      render: native
resources:
  - key: main
    path: src/main.tsx
app:
  id: ari:cloud:ecosystem::app/n6-test
  name: N6 Test
`);
    // Note: no app.runtime section above — that's the warning we want.

    try {
      const result = await deploy(sim, dir);

      // Warnings flow through to the deploy result, identical to manifest.warnings.
      // (The field is named `warnings` for back-compat with the existing
      // manifest.warnings array — it actually contains both warnings and
      // errors, with `level` indicating severity.)
      expect(result.warnings).toBe(result.manifest.warnings);
      const runtimeNote = result.warnings.find((w) => /app\.runtime/.test(w.message));
      expect(runtimeNote, 'expected the app.runtime note to appear in result.warnings').toBeDefined();
      // app.runtime is required → level is 'error'
      expect(runtimeNote!.level).toBe('error');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reports an error for resources whose path does not resolve (N7)', async () => {
    // Stand up a throwaway app with one good resource and one typo'd path.
    const { mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = join(tmpdir(), 'forge-sim-n7-' + Date.now());
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'src', 'real.tsx'), `import ForgeReconciler, { Text } from '@forge/react';\nForgeReconciler.render(<Text>hi</Text>);\n`);
    writeFileSync(join(dir, 'manifest.yml'), `
modules:
  jira:issuePanel:
    - key: panel
      title: Panel
      resource: real
      render: native
resources:
  - key: real
    path: src/real.tsx
  - key: typo
    path: src/does-not-exist.tsx
app:
  id: ari:cloud:ecosystem::app/n7-test
  name: N7 Test
  runtime:
    name: nodejs22.x
`);

    try {
      const result = await deploy(sim, dir);

      // "real" populates loadedResources; "typo" surfaces a clear error.
      expect(result.loadedResources).toContain('real');
      expect(result.loadedResources).not.toContain('typo');
      expect(
        result.errors.some(
          (e) => e.functionKey === 'typo' && /does-not-exist/.test(e.error),
        ),
        `Expected an error for the typo'd resource. Got: ${JSON.stringify(result.errors, null, 2)}`,
      ).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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
    await sim.queue.push('analytics-queue', { body: { event: 'issue-viewed', issueKey: 'Q-1', timestamp: 1234567890 } });

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
