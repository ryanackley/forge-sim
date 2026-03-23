/**
 * Manifest edge case tests — verify manifest parsing handles malformed,
 * incomplete, and unusual manifests gracefully.
 *
 * These tests ensure developers get clear, actionable errors instead of
 * cryptic crashes when their manifest.yml has issues.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseManifestContent } from '../manifest.js';

// ── 1. Malformed YAML ──────────────────────────────────────────────────

describe('malformed YAML', () => {
  it('throws a parse error for invalid YAML syntax', () => {
    const badYaml = `
app:
  id: test-app
modules:
  function:
    - key: resolver
      handler: index.handler
    bad indentation here
  this is not valid: [
`;
    expect(() => parseManifestContent(badYaml)).toThrow();
  });

  it('throws with line/position info for YAML syntax errors', () => {
    const badYaml = `
app:
  id: test-app
modules:
  function:
    - key: resolver
      handler: index.handler
      extra: [unterminated
`;
    try {
      parseManifestContent(badYaml);
      expect.unreachable('should have thrown');
    } catch (err: any) {
      // The yaml library includes position info in its errors
      expect(err.message).toBeTruthy();
    }
  });

  it('handles completely empty input gracefully', () => {
    const result = parseManifestContent('');
    expect(result.functions.size).toBe(0);
    expect(result.uiModules).toHaveLength(0);
    expect(result.remotes.size).toBe(0);
  });

  it('handles YAML that parses to a scalar (not an object)', () => {
    // "hello" is valid YAML but not a valid manifest
    const result = parseManifestContent('hello');
    expect(result.functions.size).toBe(0);
    expect(result.uiModules).toHaveLength(0);
  });

  it('handles YAML that parses to an array (not an object)', () => {
    const result = parseManifestContent('- item1\n- item2');
    expect(result.functions.size).toBe(0);
  });

  it('handles YAML with only comments', () => {
    const result = parseManifestContent('# This is just a comment\n# Nothing else');
    expect(result.functions.size).toBe(0);
    expect(result.uiModules).toHaveLength(0);
  });
});

// ── 2. Missing app.id ──────────────────────────────────────────────────

describe('missing app.id', () => {
  it('parses manifest without app.id (field is optional in parser)', () => {
    const manifest = `
modules:
  function:
    - key: resolver
      handler: index.handler
`;
    const result = parseManifestContent(manifest);
    expect(result.functions.size).toBe(1);
    // app.id is undefined — consumers (deployer, FIT) should check
    expect(result.raw.app?.id).toBeUndefined();
  });

  it('parses manifest with empty app section', () => {
    const manifest = `
app:
modules:
  function:
    - key: resolver
      handler: index.handler
`;
    const result = parseManifestContent(manifest);
    expect(result.functions.size).toBe(1);
  });

  it('parses manifest with app.id present', () => {
    const manifest = `
app:
  id: ari:cloud:ecosystem::app/my-app
modules:
  function:
    - key: resolver
      handler: index.handler
`;
    const result = parseManifestContent(manifest);
    expect(result.raw.app?.id).toBe('ari:cloud:ecosystem::app/my-app');
  });
});

// ── 3. UIKit 1 style (function without resource) ────────────────────────

describe('UIKit 1 deprecated pattern', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('warns when a UI module uses function: without resource:', () => {
    const manifest = `
app:
  id: test-app
modules:
  jira:issuePanel:
    - key: old-panel
      function: resolver
      title: Old Style Panel
  function:
    - key: resolver
      handler: index.handler
`;
    parseManifestContent(manifest);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('deprecated UIKit 1 pattern')
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('old-panel')
    );
  });

  it('does not warn for UIKit 2 modules with resource:', () => {
    const manifest = `
app:
  id: test-app
modules:
  jira:issuePanel:
    - key: modern-panel
      resource: main
      resolver:
        function: resolver
      title: Modern Panel
  function:
    - key: resolver
      handler: index.handler
resources:
  - key: main
    path: src/frontend/index.tsx
`;
    parseManifestContent(manifest);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('still parses the UIKit 1 module (with undefined resourceKey)', () => {
    const manifest = `
app:
  id: test-app
modules:
  jira:issuePanel:
    - key: old-panel
      function: resolver
      title: Old Style Panel
  function:
    - key: resolver
      handler: index.handler
`;
    const result = parseManifestContent(manifest);
    const panel = result.uiModules.find(m => m.key === 'old-panel');
    expect(panel).toBeDefined();
    expect(panel!.resourceKey).toBeUndefined();
  });
});

// ── 4. Empty modules section ────────────────────────────────────────────

describe('empty modules section', () => {
  it('handles modules: with no children', () => {
    const manifest = `
app:
  id: test-app
modules:
`;
    const result = parseManifestContent(manifest);
    expect(result.functions.size).toBe(0);
    expect(result.uiModules).toHaveLength(0);
    expect(result.consumers).toHaveLength(0);
    expect(result.triggers).toHaveLength(0);
  });

  it('handles completely missing modules key', () => {
    const manifest = `
app:
  id: test-app
`;
    const result = parseManifestContent(manifest);
    expect(result.functions.size).toBe(0);
    expect(result.uiModules).toHaveLength(0);
  });

  it('handles modules with empty arrays', () => {
    const manifest = `
app:
  id: test-app
modules:
  function: []
  jira:issuePanel: []
  consumer: []
  trigger: []
  scheduledTrigger: []
`;
    const result = parseManifestContent(manifest);
    expect(result.functions.size).toBe(0);
    expect(result.uiModules).toHaveLength(0);
    expect(result.consumers).toHaveLength(0);
    expect(result.triggers).toHaveLength(0);
    expect(result.scheduledTriggers).toHaveLength(0);
  });

  it('handles modules where a type is a scalar instead of array', () => {
    const manifest = `
app:
  id: test-app
modules:
  function: not-an-array
`;
    // Should not crash — the for loop over a non-array just skips
    const result = parseManifestContent(manifest);
    expect(result.functions.size).toBe(0);
  });
});

// ── 5. Unknown module types ─────────────────────────────────────────────

describe('unknown module types', () => {
  it('ignores unknown module types without crashing', () => {
    const manifest = `
app:
  id: test-app
modules:
  totally:madeUp:
    - key: mystery
      resource: main
      resolver:
        function: resolver
      title: Mystery Module
  function:
    - key: resolver
      handler: index.handler
resources:
  - key: main
    path: src/frontend/index.tsx
`;
    const result = parseManifestContent(manifest);
    // Unknown type is treated as a UI module (it has resource + resolver)
    const mystery = result.uiModules.find(m => m.key === 'mystery');
    expect(mystery).toBeDefined();
    expect(mystery!.type).toBe('totally:madeUp');
  });

  it('handles mix of known and unknown module types', () => {
    const manifest = `
app:
  id: test-app
modules:
  jira:issuePanel:
    - key: known-panel
      resource: main
      resolver:
        function: resolver
      title: Known Panel
  rovo:agent:
    - key: rovo-thing
      resource: rovo-ui
      title: Rovo Agent
  function:
    - key: resolver
      handler: index.handler
resources:
  - key: main
    path: src/frontend/index.tsx
  - key: rovo-ui
    path: src/rovo/index.tsx
`;
    const result = parseManifestContent(manifest);
    expect(result.functions.size).toBe(1);
    // Both should be parsed as UI modules
    expect(result.uiModules.find(m => m.key === 'known-panel')).toBeDefined();
    expect(result.uiModules.find(m => m.key === 'rovo-thing')).toBeDefined();
  });

  it('skips non-UI unknown types (no resource, no function, no render)', () => {
    const manifest = `
app:
  id: test-app
modules:
  custom:metadata:
    - key: just-data
      title: Not a UI module
      someField: someValue
`;
    const result = parseManifestContent(manifest);
    // Should NOT be in uiModules since it has no resource/function/render
    expect(result.uiModules.find(m => m.key === 'just-data')).toBeUndefined();
  });
});

// ── 6. Endpoint / Remote reference errors ───────────────────────────────

describe('endpoint and remote reference validation', () => {
  it('parses endpoint referencing a valid remote', () => {
    const manifest = `
app:
  id: test-app
modules:
  endpoint:
    - key: my-endpoint
      remote: my-backend
  function:
    - key: resolver
      handler: index.handler
remotes:
  - key: my-backend
    baseUrl: https://api.example.com
`;
    const result = parseManifestContent(manifest);
    expect(result.endpoints.get('my-endpoint')?.remote).toBe('my-backend');
    expect(result.remotes.get('my-backend')?.baseUrl).toBe('https://api.example.com');
  });

  it('parses endpoint referencing a nonexistent remote (parser does not validate cross-refs)', () => {
    const manifest = `
app:
  id: test-app
modules:
  endpoint:
    - key: orphan-endpoint
      remote: does-not-exist
`;
    // Parser should still parse it — validation happens at deploy/runtime
    const result = parseManifestContent(manifest);
    expect(result.endpoints.get('orphan-endpoint')?.remote).toBe('does-not-exist');
    expect(result.remotes.has('does-not-exist')).toBe(false);
  });

  it('skips endpoints without required fields (key or remote)', () => {
    const manifest = `
app:
  id: test-app
modules:
  endpoint:
    - key: no-remote-field
    - remote: no-key-field
      route:
        path: /api
    - key: valid-ep
      remote: valid-remote
remotes:
  - key: valid-remote
    baseUrl: https://example.com
`;
    const result = parseManifestContent(manifest);
    // Only the valid one should be parsed
    expect(result.endpoints.size).toBe(1);
    expect(result.endpoints.has('valid-ep')).toBe(true);
  });

  it('skips remotes without required fields (key or baseUrl)', () => {
    const manifest = `
app:
  id: test-app
remotes:
  - key: no-url
  - baseUrl: https://no-key.example.com
  - key: valid-remote
    baseUrl: https://valid.example.com
`;
    const result = parseManifestContent(manifest);
    expect(result.remotes.size).toBe(1);
    expect(result.remotes.has('valid-remote')).toBe(true);
  });

  it('handles duplicate remote keys (last one wins)', () => {
    const manifest = `
app:
  id: test-app
remotes:
  - key: my-backend
    baseUrl: https://first.example.com
  - key: my-backend
    baseUrl: https://second.example.com
`;
    const result = parseManifestContent(manifest);
    expect(result.remotes.size).toBe(1);
    expect(result.remotes.get('my-backend')?.baseUrl).toBe('https://second.example.com');
  });

  it('handles duplicate endpoint keys (last one wins)', () => {
    const manifest = `
app:
  id: test-app
modules:
  endpoint:
    - key: my-ep
      remote: backend-a
    - key: my-ep
      remote: backend-b
remotes:
  - key: backend-a
    baseUrl: https://a.example.com
  - key: backend-b
    baseUrl: https://b.example.com
`;
    const result = parseManifestContent(manifest);
    expect(result.endpoints.size).toBe(1);
    expect(result.endpoints.get('my-ep')?.remote).toBe('backend-b');
  });

  it('handles remotes with missing optional fields', () => {
    const manifest = `
app:
  id: test-app
remotes:
  - key: minimal
    baseUrl: https://minimal.example.com
`;
    const result = parseManifestContent(manifest);
    const remote = result.remotes.get('minimal')!;
    expect(remote.key).toBe('minimal');
    expect(remote.baseUrl).toBe('https://minimal.example.com');
    expect(remote.operations).toBeUndefined();
    expect(remote.auth).toBeUndefined();
  });
});

// ── 7. Other edge cases ─────────────────────────────────────────────────

describe('other manifest edge cases', () => {
  it('handles resources without a resources section', () => {
    const manifest = `
app:
  id: test-app
modules:
  function:
    - key: resolver
      handler: index.handler
`;
    const result = parseManifestContent(manifest);
    expect(result.resources.size).toBe(0);
  });

  it('handles permissions without scopes', () => {
    const manifest = `
app:
  id: test-app
permissions:
  external:
    fetch:
      backend:
        - https://api.example.com
`;
    const result = parseManifestContent(manifest);
    expect(result.permissions).toEqual([]);
  });

  it('parses permissions.scopes correctly', () => {
    const manifest = `
app:
  id: test-app
permissions:
  scopes:
    - read:jira-work
    - write:jira-work
    - read:confluence-content.all
`;
    const result = parseManifestContent(manifest);
    expect(result.permissions).toEqual([
      'read:jira-work',
      'write:jira-work',
      'read:confluence-content.all',
    ]);
  });

  it('handles a realistic full manifest without issues', () => {
    const manifest = `
app:
  id: ari:cloud:ecosystem::app/realistic-test
  name: Realistic Test App
modules:
  jira:issuePanel:
    - key: main-panel
      resource: main
      resolver:
        function: resolver
      title: Main Panel
      icon: https://example.com/icon.png
  jira:globalPage:
    - key: admin
      resource: admin-ui
      resolver:
        endpoint: backend-ep
      title: Admin Page
      layout: basic
  confluence:globalPage:
    - key: conf-page
      resource: conf-ui
      title: Confluence Page
  function:
    - key: resolver
      handler: src/resolvers/index.handler
    - key: trigger-fn
      handler: src/triggers/index.handler
  consumer:
    - key: email-worker
      queue: email-queue
      function: trigger-fn
  trigger:
    - key: issue-created
      function: trigger-fn
      events:
        - avi:jira:created:issue
  scheduledTrigger:
    - key: daily-sync
      function: trigger-fn
      schedule:
        interval: day
  endpoint:
    - key: backend-ep
      remote: azure-backend
      route:
        path: /api/v2
      auth:
        appSystemToken:
          enabled: true
resources:
  - key: main
    path: src/frontend/index.tsx
  - key: admin-ui
    path: src/admin/index.tsx
  - key: conf-ui
    path: src/confluence/index.tsx
remotes:
  - key: azure-backend
    baseUrl: https://my-functions.azurewebsites.net
    operations:
      - storage
      - compute
    auth:
      appSystemToken:
        enabled: true
providers:
  auth:
    - key: google
      name: Google
      type: oauth2
      clientId: "123456.apps.googleusercontent.com"
      scopes:
        - email
        - profile
permissions:
  scopes:
    - read:jira-work
    - write:jira-work
`;
    const result = parseManifestContent(manifest);

    // Functions
    expect(result.functions.size).toBe(2);
    expect(result.functions.get('resolver')?.handler).toBe('src/resolvers/index.handler');

    // UI Modules
    expect(result.uiModules).toHaveLength(3);
    expect(result.uiModules.find(m => m.key === 'main-panel')?.type).toBe('jira:issuePanel');
    expect(result.uiModules.find(m => m.key === 'admin')?.endpointKey).toBe('backend-ep');
    expect(result.uiModules.find(m => m.key === 'conf-page')?.type).toBe('confluence:globalPage');

    // Consumers
    expect(result.consumers).toHaveLength(1);
    expect(result.consumers[0].queue).toBe('email-queue');

    // Triggers
    expect(result.triggers).toHaveLength(1);
    expect(result.triggers[0].events).toContain('avi:jira:created:issue');

    // Scheduled Triggers
    expect(result.scheduledTriggers).toHaveLength(1);
    expect(result.scheduledTriggers[0].interval).toBe('day');

    // Remotes + Endpoints
    expect(result.remotes.size).toBe(1);
    expect(result.endpoints.size).toBe(1);
    expect(result.endpoints.get('backend-ep')?.remote).toBe('azure-backend');

    // Auth Providers
    expect(result.authProviders.size).toBe(1);
    expect(result.authProviders.get('google')?.type).toBe('oauth2');

    // Resources
    expect(result.resources.size).toBe(3);

    // Permissions
    expect(result.permissions).toEqual(['read:jira-work', 'write:jira-work']);
  });
});

// ── Runtime Validation ──────────────────────────────────────────────────

describe('runtime validation', () => {
  it('should error when app.runtime is missing', () => {
    const result = parseManifestContent(`
app:
  id: test-app
modules:
  function:
    - key: resolver
      handler: index.handler
`);
    const runtimeErrors = result.warnings.filter((w) => w.message.includes('app.runtime'));
    expect(runtimeErrors).toHaveLength(1);
    expect(runtimeErrors[0].level).toBe('error');
    expect(runtimeErrors[0].message).toContain('Missing required field');
  });

  it('should error when app.runtime.name is missing', () => {
    const result = parseManifestContent(`
app:
  id: test-app
  runtime:
    architecture: arm64
modules:
  function:
    - key: resolver
      handler: index.handler
`);
    const runtimeErrors = result.warnings.filter((w) => w.message.includes('runtime.name'));
    expect(runtimeErrors).toHaveLength(1);
    expect(runtimeErrors[0].level).toBe('error');
  });

  it('should accept valid runtime names', () => {
    for (const name of ['nodejs24.x', 'nodejs22.x', 'nodejs20.x']) {
      const result = parseManifestContent(`
app:
  id: test-app
  runtime:
    name: ${name}
modules:
  function:
    - key: resolver
      handler: index.handler
`);
      const runtimeWarnings = result.warnings.filter((w) => w.message.includes('runtime'));
      expect(runtimeWarnings).toHaveLength(0);
    }
  });

  it('should warn on unknown runtime name', () => {
    const result = parseManifestContent(`
app:
  id: test-app
  runtime:
    name: nodejs18.x
modules:
  function:
    - key: resolver
      handler: index.handler
`);
    const runtimeWarnings = result.warnings.filter((w) => w.message.includes('Unknown runtime name'));
    expect(runtimeWarnings).toHaveLength(1);
    expect(runtimeWarnings[0].level).toBe('warning');
  });

  it('should warn on invalid architecture', () => {
    const result = parseManifestContent(`
app:
  id: test-app
  runtime:
    name: nodejs22.x
    architecture: sparc
modules:
  function:
    - key: resolver
      handler: index.handler
`);
    const archWarnings = result.warnings.filter((w) => w.message.includes('architecture'));
    expect(archWarnings).toHaveLength(1);
  });

  it('should warn on memoryMB out of range', () => {
    const result = parseManifestContent(`
app:
  id: test-app
  runtime:
    name: nodejs22.x
    memoryMB: 2048
modules:
  function:
    - key: resolver
      handler: index.handler
`);
    const memWarnings = result.warnings.filter((w) => w.message.includes('memoryMB'));
    expect(memWarnings).toHaveLength(1);
    expect(memWarnings[0].message).toContain('2048');
  });

  it('should accept valid memoryMB within range', () => {
    const result = parseManifestContent(`
app:
  id: test-app
  runtime:
    name: nodejs22.x
    memoryMB: 512
modules:
  function:
    - key: resolver
      handler: index.handler
`);
    const memWarnings = result.warnings.filter((w) => w.message.includes('memoryMB'));
    expect(memWarnings).toHaveLength(0);
  });

  it('should return no warnings for fully valid manifest', () => {
    const result = parseManifestContent(`
app:
  id: test-app
  runtime:
    name: nodejs24.x
    architecture: arm64
    memoryMB: 1024
modules:
  function:
    - key: resolver
      handler: index.handler
`);
    expect(result.warnings).toHaveLength(0);
  });
});
