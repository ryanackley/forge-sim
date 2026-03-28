/**
 * Custom UI E2E tests — deploy a Custom UI app through the full pipeline
 * and verify resolvers, storage, and product API mocking work.
 *
 * Custom UI apps render in the browser (iframe) and communicate with the
 * backend via @forge/bridge. The backend resolvers use the same
 * { payload, context } pattern as UIKit resolvers.
 *
 * Unlike UIKit, Custom UI resources are static HTML/JS — they don't use
 * @forge/react or ForgeReconciler. The deployer should:
 *   1. Load resolver functions from the manifest
 *   2. Skip the resource (it's HTML, not a JS module)
 *   3. Wire up resolvers so invoke() works
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { ForgeSimulator } from '../simulator.js';

const CUSTOM_UI_DIR = resolve(import.meta.dirname, 'fixtures/custom-ui-test');

describe('Custom UI E2E', () => {
  let sim: ForgeSimulator;

  beforeAll(async () => {
    sim = new ForgeSimulator();
    // setSimulator auto-called by constructor

    const result = await sim.deploy(CUSTOM_UI_DIR);

    // Should load the resolver function (but not the HTML resource)
    expect(result.loadedFunctions).toContain('resolver');
    // Resource errors are expected — the deployer tries to import HTML as JS
    // and that fails, which is fine. The resource is served by Vite at runtime.
  });

  // ── Manifest Detection ─────────────────────────────────────────────

  describe('Manifest & detection', () => {
    it('parses manifest with Custom UI resource', () => {
      const manifest = sim.getManifest();
      expect(manifest).not.toBeNull();
      expect(manifest!.raw.app.name).toBe('Custom UI Test App');
      expect(manifest!.uiModules).toHaveLength(1);
      expect(manifest!.uiModules[0].key).toBe('custom-panel');
      expect(manifest!.uiModules[0].resourceKey).toBe('customFrontend');
    });

    it('resource points to a directory with index.html', () => {
      const manifest = sim.getManifest()!;
      const resource = manifest.resources.get('customFrontend');
      expect(resource).toBeDefined();
      expect(resource!.path).toBe('static/frontend');

      // Verify the actual directory has index.html (Custom UI indicator)
      const resourceDir = resolve(CUSTOM_UI_DIR, resource!.path);
      expect(existsSync(resolve(resourceDir, 'index.html'))).toBe(true);
    });
  });

  // ── Resolver Invocation (simulates @forge/bridge.invoke()) ─────────

  describe('Resolver invocation', () => {
    it('getData returns default value when key is not in storage', async () => {
      const result = await sim.invoke('getData', { key: 'nonexistent' });

      expect(result.value).toBe('default-value');
      expect(result.account).toBe('sim-user-001');
      expect(result.key).toBe('nonexistent');
    });

    it('setData + getData round-trip through KVS', async () => {
      await sim.invoke('setData', { key: 'greeting', value: 'hello world' });

      const result = await sim.invoke('getData', { key: 'greeting' });
      expect(result.value).toBe('hello world');
    });

    it('context changes are reflected in resolver calls', async () => {
      sim.resolver.setContext({ accountId: 'user-alice' });
      const result = await sim.invoke('getData', { key: 'test' });
      expect(result.account).toBe('user-alice');

      sim.resolver.setContext({ accountId: 'user-bob' });
      const result2 = await sim.invoke('getData', { key: 'test' });
      expect(result2.account).toBe('user-bob');
    });
  });

  // ── Product API (simulates @forge/bridge.requestJira()) ────────────

  describe('Product API mocking', () => {
    it('getJiraIssue calls mocked Jira API', async () => {
      sim.mockProductRoutes('jira', {
        'GET /rest/api/3/issue/': (path: string) => {
          const key = path.split('/').pop();
          return {
            key,
            summary: `Mock issue: ${key}`,
            status: { name: 'In Progress' },
          };
        },
      });

      const result = await sim.invoke('getJiraIssue', { issueKey: 'TEST-42' });

      expect(result.issue.key).toBe('TEST-42');
      expect(result.issue.summary).toBe('Mock issue: TEST-42');
      expect(result.issue.status.name).toBe('In Progress');
    });
  });

  // ── KVS State (simulates storage operations from resolvers) ────────

  describe('Storage state', () => {
    it('storage persists across multiple invoke calls', async () => {
      // Set multiple keys
      await sim.invoke('setData', { key: 'a', value: 1 });
      await sim.invoke('setData', { key: 'b', value: 2 });
      await sim.invoke('setData', { key: 'c', value: 3 });

      // Read them back
      const a = await sim.invoke('getData', { key: 'a' });
      const b = await sim.invoke('getData', { key: 'b' });
      const c = await sim.invoke('getData', { key: 'c' });

      expect(a.value).toBe(1);
      expect(b.value).toBe(2);
      expect(c.value).toBe(3);
    });

    it('storage is directly accessible via sim.kvs', async () => {
      await sim.invoke('setData', { key: 'direct', value: 'check' });

      // Verify we can see the same value through the KVS directly
      const raw = await sim.kvs.get('data:direct');
      expect(raw).toBe('check');
    });
  });

  // ── Full Custom UI flow ────────────────────────────────────────────

  describe('Full Custom UI flow', () => {
    it('simulates a complete Custom UI session', async () => {
      sim.resolver.setContext({ accountId: 'real-user-123' });

      // 1. Frontend loads → calls getContext (handled by dev-server, not tested here)

      // 2. Frontend calls invoke('getData') to load initial state
      const initial = await sim.invoke('getData', { key: 'session-test' });
      expect(initial.value).toBe('default-value');

      // 3. User interacts → frontend calls invoke('setData')
      await sim.invoke('setData', { key: 'session-test', value: 'user input' });

      // 4. Frontend refreshes → calls invoke('getData') again
      const updated = await sim.invoke('getData', { key: 'session-test' });
      expect(updated.value).toBe('user input');
      expect(updated.account).toBe('real-user-123');

      // 5. Frontend calls requestJira for issue data
      sim.mockProductRoutes('jira', {
        'GET /rest/api/3/issue/': () => ({
          key: 'PROJ-1',
          summary: 'Test issue',
          fields: { assignee: { accountId: 'real-user-123' } },
        }),
      });

      const issue = await sim.invoke('getJiraIssue', { issueKey: 'PROJ-1' });
      expect(issue.issue.summary).toBe('Test issue');
      expect(issue.requestedBy).toBe('real-user-123');
    });
  });
});
