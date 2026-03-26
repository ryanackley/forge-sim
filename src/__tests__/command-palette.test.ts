/**
 * Tests for jira:command (command palette) manifest parsing.
 */
import { describe, it, expect } from 'vitest';
import { parseManifestContent } from '../manifest.js';
import { generateModulePickerHtml, detectModuleType, type DetectedModule } from '../dev-command.js';

describe('jira:command manifest parsing', () => {
  it('should parse command with target.resource as UI module', () => {
    const manifest = parseManifestContent(`
modules:
  jira:command:
    - key: quick-create
      title: Quick Create
      icon: https://example.com/icon.svg
      target:
        resource: main
        render: native
      resolver:
        function: resolver
      shortcut: mod+shift+c
      keywords:
        - create
        - new
  function:
    - key: resolver
      handler: index.handler
resources:
  - key: main
    path: src/index.tsx
app:
  id: ari:cloud:ecosystem::app/test
  runtime:
    name: nodejs22.x
`);

    // Should appear as a UI module
    expect(manifest.uiModules).toHaveLength(1);
    expect(manifest.uiModules[0].key).toBe('quick-create');
    expect(manifest.uiModules[0].type).toBe('jira:command');
    expect(manifest.uiModules[0].title).toBe('Quick Create');
    expect(manifest.uiModules[0].resourceKey).toBe('main');
    expect(manifest.uiModules[0].resolverFunctionKey).toBe('resolver');

    // No page targets
    expect(manifest.commandPageTargets).toHaveLength(0);
  });

  it('should parse command with target.page as page target (not UI module)', () => {
    const manifest = parseManifestContent(`
modules:
  jira:command:
    - key: open-settings
      title: Open Settings
      target:
        page: settings-page
      shortcut: mod+,
  jira:globalPage:
    - key: settings-page
      title: App Settings
      resource: main
      render: native
      resolver:
        function: resolver
  function:
    - key: resolver
      handler: index.handler
resources:
  - key: main
    path: src/index.tsx
app:
  id: ari:cloud:ecosystem::app/test
  runtime:
    name: nodejs22.x
`);

    // globalPage should be a UI module, command should NOT
    expect(manifest.uiModules).toHaveLength(1);
    expect(manifest.uiModules[0].key).toBe('settings-page');
    expect(manifest.uiModules[0].type).toBe('jira:globalPage');

    // Command should be tracked as a page target
    expect(manifest.commandPageTargets).toHaveLength(1);
    expect(manifest.commandPageTargets[0].key).toBe('open-settings');
    expect(manifest.commandPageTargets[0].title).toBe('Open Settings');
    expect(manifest.commandPageTargets[0].targetPage).toBe('settings-page');
    expect(manifest.commandPageTargets[0].shortcut).toBe('mod+,');
  });

  it('should handle mixed commands (some with resource, some with page)', () => {
    const manifest = parseManifestContent(`
modules:
  jira:command:
    - key: cmd-with-ui
      title: Command With UI
      target:
        resource: cmd-ui
        render: native
    - key: cmd-opens-page
      title: Open Dashboard
      target:
        page: dashboard
  jira:globalPage:
    - key: dashboard
      title: Dashboard
      resource: main
      render: native
  function:
    - key: resolver
      handler: index.handler
resources:
  - key: main
    path: src/index.tsx
  - key: cmd-ui
    path: src/cmd.tsx
app:
  id: ari:cloud:ecosystem::app/test
  runtime:
    name: nodejs22.x
`);

    // Two UI modules: the command's own resource + the globalPage
    expect(manifest.uiModules).toHaveLength(2);
    const keys = manifest.uiModules.map(m => m.key);
    expect(keys).toContain('cmd-with-ui');
    expect(keys).toContain('dashboard');

    // One page target
    expect(manifest.commandPageTargets).toHaveLength(1);
    expect(manifest.commandPageTargets[0].key).toBe('cmd-opens-page');
    expect(manifest.commandPageTargets[0].targetPage).toBe('dashboard');
  });

  it('should register resolver function from command module', () => {
    const manifest = parseManifestContent(`
modules:
  jira:command:
    - key: search-cmd
      title: Search
      target:
        resource: search-ui
        render: native
      resolver:
        function: search-resolver
  function:
    - key: search-resolver
      handler: src/search.handler
resources:
  - key: search-ui
    path: src/search.tsx
app:
  id: ari:cloud:ecosystem::app/test
  runtime:
    name: nodejs22.x
`);

    expect(manifest.functions.has('search-resolver')).toBe(true);
  });

  it('should skip commands with no target', () => {
    const manifest = parseManifestContent(`
modules:
  jira:command:
    - key: broken-cmd
      title: Broken
  function:
    - key: resolver
      handler: index.handler
resources:
  - key: main
    path: src/index.tsx
app:
  id: ari:cloud:ecosystem::app/test
  runtime:
    name: nodejs22.x
`);

    expect(manifest.uiModules).toHaveLength(0);
    expect(manifest.commandPageTargets).toHaveLength(0);
  });

  it('should handle i18n title format', () => {
    const manifest = parseManifestContent(`
modules:
  jira:command:
    - key: i18n-cmd
      title:
        i18n: command.title
      target:
        resource: main
        render: native
resources:
  - key: main
    path: src/index.tsx
app:
  id: ari:cloud:ecosystem::app/test
  runtime:
    name: nodejs22.x
`);

    expect(manifest.uiModules).toHaveLength(1);
    expect(manifest.uiModules[0].title).toBe('command.title');
  });
});

describe('jira:command in module picker', () => {
  it('shows command with own resource in module picker', () => {
    const modules: DetectedModule[] = [{
      module: {
        type: 'jira:command',
        key: 'quick-create',
        title: 'Quick Create',
        resourceKey: 'main',
      },
      mode: 'uikit' as const,
      resourcePath: '/app/src/index.tsx',
    }];

    const html = generateModulePickerHtml(modules);
    expect(html).toContain('quick-create');
    expect(html).toContain('Quick Create');
  });
});
