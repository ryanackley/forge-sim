/**
 * Manifest parsing edge cases.
 *
 * Tests that forge-sim handles malformed, incomplete, or unusual manifests
 * with clear errors or graceful degradation — not silent failures.
 */

import { describe, it, expect, vi } from 'vitest';
import { parseManifestContent } from '../manifest.js';

describe('Manifest Edge Cases', () => {

  // ── 1. Malformed YAML → clear parse error ─────────────────────────

  describe('malformed YAML', () => {
    it('throws on invalid YAML syntax', () => {
      const badYaml = `
app:
  id: test
  name: Test
modules:
  function:
    - key: resolver
    handler: broken.handler  # wrong indentation
`;
      expect(() => parseManifestContent(badYaml)).toThrow();
    });

    it('throws on completely invalid content', () => {
      expect(() => parseManifestContent('{{{{not yaml at all!!!!')).toThrow();
    });

    it('handles empty string gracefully', () => {
      // Empty YAML parses as null/undefined — should not crash
      const result = parseManifestContent('');
      // Should return a manifest with empty collections
      expect(result.functions.size).toBe(0);
      expect(result.uiModules.length).toBe(0);
    });
  });

  // ── 2. Missing app.id ─────────────────────────────────────────────

  describe('missing app.id', () => {
    it('parses manifest without app.id (no crash)', () => {
      const manifest = parseManifestContent(`
modules:
  function:
    - key: resolver
      handler: index.handler
`);
      // Should still parse functions
      expect(manifest.functions.size).toBe(1);
      // raw.app should be undefined
      expect(manifest.raw.app?.id).toBeUndefined();
    });

    it('parses manifest with empty app block', () => {
      const manifest = parseManifestContent(`
app:
  name: No ID App
modules:
  function:
    - key: resolver
      handler: index.handler
`);
      expect(manifest.raw.app?.id).toBeUndefined();
      expect(manifest.functions.size).toBe(1);
    });
  });

  // ── 3. UIKit 1 style: function without resource ───────────────────

  describe('UIKit 1 style modules (function without resource)', () => {
    it('warns about modules using deprecated function-only style', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const manifest = parseManifestContent(`
app:
  id: test-app
modules:
  jira:issuePanel:
    - key: old-style-panel
      function: resolver
      title: Old Panel
  function:
    - key: resolver
      handler: index.handler
`);

      // Module should still be parsed (backwards compat)
      const found = manifest.uiModules.find(m => m.key === 'old-style-panel');
      expect(found).toBeDefined();
      // But it has no resource key
      expect(found!.resourceKey).toBeUndefined();

      // Should have warned about the deprecated pattern
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/old-style-panel.*resource|UIKit 1|deprecated/i)
      );

      warnSpy.mockRestore();
    });
  });

  // ── 4. Empty modules section ──────────────────────────────────────

  describe('empty modules', () => {
    it('handles empty modules object', () => {
      const manifest = parseManifestContent(`
app:
  id: test-app
modules: {}
`);
      expect(manifest.functions.size).toBe(0);
      expect(manifest.uiModules.length).toBe(0);
      expect(manifest.consumers.length).toBe(0);
      expect(manifest.triggers.length).toBe(0);
    });

    it('handles missing modules key entirely', () => {
      const manifest = parseManifestContent(`
app:
  id: test-app
  name: No Modules
`);
      expect(manifest.functions.size).toBe(0);
      expect(manifest.uiModules.length).toBe(0);
    });

    it('handles empty function array', () => {
      const manifest = parseManifestContent(`
app:
  id: test-app
modules:
  function: []
`);
      expect(manifest.functions.size).toBe(0);
    });

    it('handles null modules', () => {
      const manifest = parseManifestContent(`
app:
  id: test-app
modules: null
`);
      expect(manifest.functions.size).toBe(0);
    });
  });

  // ── 5. Unknown module types ───────────────────────────────────────

  describe('unknown module types', () => {
    it('logs but does not crash on unknown module types', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const manifest = parseManifestContent(`
app:
  id: test-app
modules:
  jira:someFutureModuleType:
    - key: future-panel
      resource: main
      render: native
  function:
    - key: resolver
      handler: index.handler
resources:
  - key: main
    path: src/index.tsx
`);

      // Unknown module type should still be parsed as a UI module
      // (we don't hardcode all Forge module types — new ones appear regularly)
      const found = manifest.uiModules.find(m => m.key === 'future-panel');
      expect(found).toBeDefined();
      expect(found!.type).toBe('jira:someFutureModuleType');

      warnSpy.mockRestore();
    });

    it('skips non-UI module types', () => {
      const manifest = parseManifestContent(`
app:
  id: test-app
modules:
  function:
    - key: resolver
      handler: index.handler
  consumer:
    - key: my-consumer
      queue: my-queue
      function: resolver
  trigger:
    - key: my-trigger
      function: resolver
      events:
        - avi:forge:event
`);

      // None of these should appear as UI modules
      expect(manifest.uiModules.length).toBe(0);
      expect(manifest.consumers.length).toBe(1);
      expect(manifest.triggers.length).toBe(1);
    });
  });

  // ── 6. Circular / duplicate key handling ──────────────────────────

  describe('duplicate keys', () => {
    it('last function definition wins for duplicate keys', () => {
      const manifest = parseManifestContent(`
app:
  id: test-app
modules:
  function:
    - key: resolver
      handler: first.handler
    - key: resolver
      handler: second.handler
`);
      // Map.set overwrites — last one wins
      const fn = manifest.functions.get('resolver');
      expect(fn?.handler).toBe('second.handler');
    });

    it('duplicate UI module keys both appear in uiModules array', () => {
      const manifest = parseManifestContent(`
app:
  id: test-app
modules:
  jira:issuePanel:
    - key: panel
      resource: main
      render: native
  confluence:globalPage:
    - key: panel
      resource: main
      render: native
resources:
  - key: main
    path: src/index.tsx
`);

      // Both should be in the array (different module types can share keys)
      const panels = manifest.uiModules.filter(m => m.key === 'panel');
      expect(panels.length).toBe(2);
      expect(panels.map(p => p.type).sort()).toEqual(['confluence:globalPage', 'jira:issuePanel']);
    });
  });

  // ── 7. Resources edge cases ───────────────────────────────────────

  describe('resources', () => {
    it('handles missing resources section', () => {
      const manifest = parseManifestContent(`
app:
  id: test-app
modules:
  function:
    - key: resolver
      handler: index.handler
`);
      expect(manifest.resources.size).toBe(0);
    });

    it('parses multiple resources', () => {
      const manifest = parseManifestContent(`
app:
  id: test-app
resources:
  - key: main
    path: src/frontend.tsx
  - key: admin
    path: src/admin.tsx
modules:
  function:
    - key: resolver
      handler: index.handler
`);
      expect(manifest.resources.size).toBe(2);
      expect(manifest.resources.get('main')?.path).toBe('src/frontend.tsx');
      expect(manifest.resources.get('admin')?.path).toBe('src/admin.tsx');
    });
  });

  // ── 8. Permissions edge cases ─────────────────────────────────────

  describe('permissions', () => {
    it('handles missing permissions', () => {
      const manifest = parseManifestContent(`
app:
  id: test-app
modules:
  function:
    - key: resolver
      handler: index.handler
`);
      expect(manifest.permissions).toEqual([]);
    });

    it('parses scopes correctly', () => {
      const manifest = parseManifestContent(`
app:
  id: test-app
permissions:
  scopes:
    - read:jira-work
    - write:jira-work
    - read:confluence-space.summary
modules:
  function:
    - key: resolver
      handler: index.handler
`);
      expect(manifest.permissions).toHaveLength(3);
      expect(manifest.permissions).toContain('read:jira-work');
      expect(manifest.permissions).toContain('write:jira-work');
    });
  });

  // ── 9. Complex real-world manifest ────────────────────────────────

  describe('real-world manifest patterns', () => {
    it('parses a full manifest with all features', () => {
      const manifest = parseManifestContent(`
app:
  id: ari:cloud:ecosystem::app/full-test
  name: Full Test App
modules:
  jira:issuePanel:
    - key: main-panel
      resource: main
      resolver:
        function: resolver
        endpoint: my-endpoint
      render: native
      title: Main Panel
  jira:globalPage:
    - key: admin-page
      resource: admin
      resolver:
        function: admin-resolver
      render: native
      title: Admin
  function:
    - key: resolver
      handler: src/resolvers/main.handler
    - key: admin-resolver
      handler: src/resolvers/admin.handler
    - key: trigger-fn
      handler: src/triggers.handler
  consumer:
    - key: email-consumer
      queue: email-queue
      function: trigger-fn
  trigger:
    - key: issue-trigger
      function: trigger-fn
      events:
        - avi:jira:created:issue
  scheduledTrigger:
    - key: nightly
      function: trigger-fn
      schedule:
        interval: hour
  endpoint:
    - key: my-endpoint
      remote: azure-backend
      route:
        path: /api
resources:
  - key: main
    path: src/frontend/main.tsx
  - key: admin
    path: src/frontend/admin.tsx
remotes:
  - key: azure-backend
    baseUrl: https://my-app.azurewebsites.net
permissions:
  scopes:
    - read:jira-work
    - write:jira-work
`);

      expect(manifest.functions.size).toBe(3);
      expect(manifest.resources.size).toBe(2);
      expect(manifest.uiModules.length).toBe(2);
      expect(manifest.consumers.length).toBe(1);
      expect(manifest.triggers.length).toBe(1);
      expect(manifest.scheduledTriggers.length).toBe(1);
      expect(manifest.endpoints.size).toBe(1);
      expect(manifest.remotes.size).toBe(1);
      expect(manifest.permissions).toHaveLength(2);

      // Verify UI module details
      const mainPanel = manifest.uiModules.find(m => m.key === 'main-panel')!;
      expect(mainPanel.type).toBe('jira:issuePanel');
      expect(mainPanel.resolverFunctionKey).toBe('resolver');
      expect(mainPanel.endpointKey).toBe('my-endpoint');
      expect(mainPanel.resourceKey).toBe('main');

      // Verify endpoint
      const ep = manifest.endpoints.get('my-endpoint')!;
      expect(ep.remote).toBe('azure-backend');
      expect(ep.route?.path).toBe('/api');

      // Verify consumer
      expect(manifest.consumers[0].queue).toBe('email-queue');
      expect(manifest.consumers[0].functionKey).toBe('trigger-fn');
    });
  });
});
