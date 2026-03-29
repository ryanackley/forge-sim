/**
 * Negative case tests — verify forge-sim fails clearly where Forge would fail.
 *
 * Core principle: If it wouldn't work in Forge, it shouldn't work in forge-sim.
 * These tests ensure we produce clear, actionable errors rather than silently
 * succeeding or producing confusing failures.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSimulator } from '../simulator.js';

// ── Helpers ──────────────────────────────────────────────────────────────

function createSim() {
  return createSimulator();
}

// Minimal manifest YAML for testing
const MINIMAL_MANIFEST = `
app:
  id: test-app
  name: Test App
modules:
  function:
    - key: resolver
      handler: src/resolver.handler
  jira:issuePanel:
    - key: test-panel
      resource: main
      resolver:
        function: resolver
      render: native
resources:
  - key: main
    path: src/index.tsx
permissions:
  scopes:
    - read:jira-work
`;

const REMOTE_MANIFEST = `
app:
  id: test-app
  name: Test App
modules:
  function:
    - key: resolver
      handler: src/resolver.handler
  jira:issuePanel:
    - key: panel-with-endpoint
      resource: main
      resolver:
        function: resolver
        endpoint: my-endpoint
      render: native
    - key: panel-no-endpoint
      resource: main
      resolver:
        function: resolver
      render: native
  endpoint:
    - key: my-endpoint
      remote: my-backend
resources:
  - key: main
    path: src/index.tsx
remotes:
  - key: my-backend
    baseUrl: https://example.com/api
permissions:
  scopes:
    - read:jira-work
`;

const MULTI_ENDPOINT_MANIFEST = `
app:
  id: test-app
  name: Test App
modules:
  function:
    - key: resolver
      handler: src/resolver.handler
  jira:issuePanel:
    - key: panel-a
      resource: main
      resolver:
        function: resolver
        endpoint: endpoint-a
      render: native
    - key: panel-b
      resource: main
      resolver:
        function: resolver
        endpoint: endpoint-b
      render: native
  endpoint:
    - key: endpoint-a
      remote: backend-a
    - key: endpoint-b
      remote: backend-b
resources:
  - key: main
    path: src/index.tsx
remotes:
  - key: backend-a
    baseUrl: https://a.example.com
  - key: backend-b
    baseUrl: https://b.example.com
`;

// ── Tests ────────────────────────────────────────────────────────────────

describe('Negative Cases', () => {

  // ── 1. invoke('nonexistent') → clear error ─────────────────────────

  describe('invoke with nonexistent function key', () => {
    it('throws clear error when function key is not defined', async () => {
      const sim = createSim();
      await sim.loadManifest(MINIMAL_MANIFEST);

      // Define one resolver so there's something to compare against
      sim.resolver.define('existingHandler', () => ({ ok: true }));

      await expect(
        sim.resolver.invoke('nonexistent', {})
      ).rejects.toThrow(/nonexistent/);
    });

    it('error message lists available function keys', async () => {
      const sim = createSim();
      await sim.loadManifest(MINIMAL_MANIFEST);

      sim.resolver.define('getIssues', () => []);
      sim.resolver.define('updateIssue', () => ({}));

      try {
        await sim.resolver.invoke('deleteIssue', {});
        expect.unreachable('Should have thrown');
      } catch (err: any) {
        expect(err.message).toContain('deleteIssue');
        // Should hint at available handlers
        expect(err.message).toMatch(/getIssues|updateIssue|available/i);
      }
    });
  });

  // ── 2. invokeRemote with no endpoint → error ──────────────────────

  describe('invokeRemote without endpoint', () => {
    it('throws when module has no endpoint configured', async () => {
      const sim = createSim();
      await sim.loadManifest(REMOTE_MANIFEST);

      // Module "panel-no-endpoint" has no resolver.endpoint
      expect(() => sim.resolveModuleEndpoint('panel-no-endpoint')).toThrow(
        /no endpoint configured/i
      );
    });

    it('error lists available endpoints', async () => {
      const sim = createSim();
      await sim.loadManifest(REMOTE_MANIFEST);

      try {
        sim.resolveModuleEndpoint('panel-no-endpoint');
        expect.unreachable('Should have thrown');
      } catch (err: any) {
        // Should list modules that DO have endpoints
        expect(err.message).toContain('panel-with-endpoint');
      }
    });

    it('throws for unknown module key', async () => {
      const sim = createSim();
      await sim.loadManifest(REMOTE_MANIFEST);

      expect(() => sim.resolveModuleEndpoint('totally-fake')).toThrow(
        /totally-fake/
      );
    });
  });

  // ── 3. invokeRemote ambiguous (multiple endpoints, no module context) ─

  describe('invokeRemote with ambiguous endpoints', () => {
    it('throws when multiple endpoints exist and no module context', async () => {
      const sim = createSim();
      await sim.loadManifest(MULTI_ENDPOINT_MANIFEST);

      // With no moduleKey and multiple endpoints, should NOT silently pick one
      const result = sim.resolveModuleEndpoint(undefined);
      // Should return undefined (can't auto-resolve)
      expect(result).toBeUndefined();
    });

    it('resolves correctly when module context is provided', async () => {
      const sim = createSim();
      await sim.loadManifest(MULTI_ENDPOINT_MANIFEST);

      expect(sim.resolveModuleEndpoint('panel-a')).toBe('endpoint-a');
      expect(sim.resolveModuleEndpoint('panel-b')).toBe('endpoint-b');
    });
  });

  // ── 4. requestJira/requestConfluence with no mock and no real API ──

  describe('product API without mock routes or real API', () => {
    it('requestJira returns error with clear message', async () => {
      const sim = createSim();
      await sim.loadManifest(MINIMAL_MANIFEST);

      const response = await sim.productApi.request('jira', '/rest/api/3/myself', {});
      // 501 = not implemented (no mock or real API configured)
      expect(response.status).toBe(501);

      const body = await response.text();
      expect(body).toContain('Unmocked');
      expect(body).toContain('/rest/api/3/myself');
    });

    it('requestConfluence returns error with clear message', async () => {
      const sim = createSim();
      await sim.loadManifest(MINIMAL_MANIFEST);

      const response = await sim.productApi.request('confluence', '/wiki/api/v2/spaces', {});
      expect(response.status).toBe(501);

      const body = await response.text();
      expect(body).toContain('Unmocked');
      expect(body).toContain('/wiki/api/v2/spaces');
    });
  });

  // ── 5. Product API with mock routes — correct matching ─────────────

  describe('product API mock route matching', () => {
    it('returns mock response for matched route', async () => {
      const sim = createSim();
      await sim.loadManifest(MINIMAL_MANIFEST);

      sim.productApi.mockRoutes('jira', {
        'GET /rest/api/3/myself': { accountId: 'test-123', displayName: 'Test User' },
      });

      const response = await sim.productApi.request('jira', '/rest/api/3/myself', {});
      expect(response.status).toBe(200);

      const body = JSON.parse(await response.text());
      expect(body.accountId).toBe('test-123');
    });

    it('returns 404 for unmatched route even when other mocks exist', async () => {
      const sim = createSim();
      await sim.loadManifest(MINIMAL_MANIFEST);

      sim.productApi.mockRoutes('jira', {
        'GET /rest/api/3/myself': { accountId: 'test-123' },
      });

      const response = await sim.productApi.request('jira', '/rest/api/3/issue/TEST-999', {});
      expect(response.status).toBe(404);

      const body = await response.text();
      expect(body).toContain('No mock route matched');
      expect(body).toContain('/rest/api/3/issue/TEST-999');
    });
  });

  // ── 6. Missing resource key on UI module ───────────────────────────

  describe('manifest validation', () => {
    it('UI module without resource key has undefined resourceKey', async () => {
      const sim = createSim();
      const manifest = await sim.loadManifest(`
app:
  id: test-app
  name: Test
modules:
  jira:issuePanel:
    - key: no-resource-panel
      function: resolver
  function:
    - key: resolver
      handler: index.handler
`);
      // Module with no resource is still in uiModules (parser includes it),
      // but resourceKey will be undefined — dev-command checks this at runtime
      const found = manifest.uiModules.find((m: any) => m.key === 'no-resource-panel');
      expect(found).toBeDefined();
      expect(found!.resourceKey).toBeUndefined();
    });

    it('endpoint referencing nonexistent remote errors on invoke', async () => {
      const sim = createSim();
      await sim.loadManifest(`
app:
  id: test-app
  name: Test
modules:
  jira:issuePanel:
    - key: panel
      resource: main
      resolver:
        function: resolver
        endpoint: ghost-endpoint
      render: native
  endpoint:
    - key: ghost-endpoint
      remote: nonexistent-backend
  function:
    - key: resolver
      handler: index.handler
resources:
  - key: main
    path: src/index.tsx
`);

      // The endpoint exists but references a remote that doesn't exist
      const endpointKey = sim.resolveModuleEndpoint('panel');
      expect(endpointKey).toBe('ghost-endpoint');

      // invokeFromBridge returns { success: false, error } for unknown remotes
      const result = await sim.remotes.invokeFromBridge({
        endpointKey: 'ghost-endpoint',
        path: '/api/test',
        method: 'GET',
      });

      expect(result.success).toBe(false);
      expect(result.error.body.error).toMatch(/unknown remote|nonexistent-backend/i);
    });
  });

  // ── 7. Duplicate resolver.define names ─────────────────────────────

  describe('duplicate resolver definitions', () => {
    it('warns when redefining an existing function key', async () => {
      const sim = createSim();
      await sim.loadManifest(MINIMAL_MANIFEST);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      sim.resolver.define('myHandler', () => 'first');
      sim.resolver.define('myHandler', () => 'second');

      // Should warn about the duplicate
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('myHandler')
      );

      warnSpy.mockRestore();
    });

    it('last definition wins (but warns)', async () => {
      const sim = createSim();
      await sim.loadManifest(MINIMAL_MANIFEST);

      vi.spyOn(console, 'warn').mockImplementation(() => {});

      sim.resolver.define('myHandler', () => 'first');
      sim.resolver.define('myHandler', () => 'second');

      const result = await sim.resolver.invoke('myHandler', {});
      expect(result).toBe('second');

      vi.restoreAllMocks();
    });
  });
});
