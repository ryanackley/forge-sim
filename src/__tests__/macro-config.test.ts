/**
 * Tests for macro config sub-module: manifest parsing,
 * module picker grouping, context enrichment, and the combined page UI.
 */
import { describe, it, expect } from 'vitest';
import { parseManifestContent, type ManifestUIModule } from '../manifest.js';
import {
  generateModulePickerHtml,
  computeModulePageGroups,
  generateModulePageEntry,
  type DetectedModule,
} from '../dev-command.js';
import { buildDefaultContext } from '../context.js';

// ── Manifest Parsing ──────────────────────────────────────────────────

describe('macro manifest parsing', () => {
  it('should keep flat shape when macro has no config', () => {
    const manifest = parseManifestContent(`
modules:
  macro:
    - key: hello
      title: Hello World
      resource: main
      render: native
      resolver:
        function: resolver
  function:
    - key: resolver
      handler: index.handler
resources:
  - key: main
    path: src/frontend/index.tsx
app:
  runtime:
    name: nodejs22.x
`);

    const modules = manifest.uiModules;
    expect(modules).toHaveLength(1);
    expect(modules[0].key).toBe('hello');
    expect(modules[0].type).toBe('macro');
    expect(modules[0].viewMode).toBeUndefined();
    expect(modules[0].resourceKey).toBe('main');
    expect(modules[0].title).toBe('Hello World');
    expect(modules[0].inlineMacroConfig).toBeUndefined();
  });

  it('should split into --view and --config sub-modules when config.resource is set', () => {
    const manifest = parseManifestContent(`
modules:
  macro:
    - key: pet-info
      title: Pet Info
      resource: main
      render: native
      resolver:
        function: resolver
      config:
        resource: config-bundle
        render: native
  function:
    - key: resolver
      handler: index.handler
resources:
  - key: main
    path: src/frontend/index.tsx
  - key: config-bundle
    path: src/frontend/config.tsx
app:
  runtime:
    name: nodejs22.x
`);

    const modules = manifest.uiModules;
    expect(modules).toHaveLength(2);

    const view = modules.find((m) => m.key === 'pet-info--view');
    expect(view).toBeDefined();
    expect(view!.type).toBe('macro');
    expect(view!.viewMode).toBe('view');
    expect(view!.resourceKey).toBe('main');
    expect(view!.title).toBe('Pet Info (View)');
    expect(view!.resolverFunctionKey).toBe('resolver');

    const config = modules.find((m) => m.key === 'pet-info--config');
    expect(config).toBeDefined();
    expect(config!.type).toBe('macro');
    expect(config!.viewMode).toBe('config');
    expect(config!.resourceKey).toBe('config-bundle');
    expect(config!.title).toBe('Pet Info (Config)');
    expect(config!.resolverFunctionKey).toBe('resolver');
  });

  it('should keep flat shape when config: true is used (inline addConfig)', () => {
    const manifest = parseManifestContent(`
modules:
  macro:
    - key: simple
      title: Simple Macro
      resource: main
      render: native
      config: true
resources:
  - key: main
    path: src/frontend/index.tsx
app:
  runtime:
    name: nodejs22.x
`);

    expect(manifest.uiModules).toHaveLength(1);
    expect(manifest.uiModules[0].key).toBe('simple');
    expect(manifest.uiModules[0].inlineMacroConfig).toBe(true);

    // Inline config gets an info-level note describing how forge-sim renders it
    const info = manifest.warnings.find(
      (w) => w.message.includes('"simple"') && w.message.includes('inline config'),
    );
    expect(info).toBeDefined();
    expect(info!.level).toBe('info');
    // Note should describe the View/Config tabs UX (no longer a "not yet supported" message)
    expect(info!.message).toMatch(/View\/Config tabs/);
  });

  it('should warn (info) when config object is set without a resource', () => {
    const manifest = parseManifestContent(`
modules:
  macro:
    - key: opts
      title: Opts Macro
      resource: main
      render: native
      config:
        openOnInsert: true
resources:
  - key: main
    path: src/frontend/index.tsx
app:
  runtime:
    name: nodejs22.x
`);

    expect(manifest.uiModules).toHaveLength(1);
    expect(manifest.uiModules[0].inlineMacroConfig).toBe(true);
    expect(manifest.warnings.some(
      (w) => w.message.includes('"opts"') && w.level === 'info',
    )).toBe(true);
  });

  it('should handle i18n macro title', () => {
    const manifest = parseManifestContent(`
modules:
  macro:
    - key: i18n-macro
      title:
        i18n: macro.title
      resource: main
      render: native
      config:
        resource: config-bundle
        render: native
resources:
  - key: main
    path: src/frontend/index.tsx
  - key: config-bundle
    path: src/frontend/config.tsx
app:
  runtime:
    name: nodejs22.x
`);

    const view = manifest.uiModules.find((m) => m.key === 'i18n-macro--view');
    expect(view).toBeDefined();
    expect(view!.title).toBe('macro.title (View)');
  });

  it('should skip macros without a top-level resource', () => {
    const manifest = parseManifestContent(`
modules:
  macro:
    - key: broken
      title: Broken
      render: native
app:
  runtime:
    name: nodejs22.x
`);

    expect(manifest.uiModules).toHaveLength(0);
  });

  it('should register the resolver function for invocation', () => {
    const manifest = parseManifestContent(`
modules:
  macro:
    - key: with-resolver
      title: With Resolver
      resource: main
      render: native
      resolver:
        function: my-resolver
      config:
        resource: cfg
        render: native
resources:
  - key: main
    path: src/frontend/index.tsx
  - key: cfg
    path: src/frontend/config.tsx
app:
  runtime:
    name: nodejs22.x
`);

    expect(manifest.functions.has('my-resolver')).toBe(true);
  });

  it('should not crash when macros coexist with regular UI modules', () => {
    const manifest = parseManifestContent(`
modules:
  jira:issuePanel:
    - key: panel
      title: Panel
      resource: panel-main
      render: native
  macro:
    - key: my-macro
      title: My Macro
      resource: macro-main
      render: native
      config:
        resource: macro-config
        render: native
resources:
  - key: panel-main
    path: src/frontend/panel.tsx
  - key: macro-main
    path: src/frontend/macro.tsx
  - key: macro-config
    path: src/frontend/config.tsx
app:
  runtime:
    name: nodejs22.x
`);

    const keys = manifest.uiModules.map((m) => m.key).sort();
    expect(keys).toEqual(['my-macro--config', 'my-macro--view', 'panel']);
  });
});

// ── Module Picker ─────────────────────────────────────────────────────

describe('macro module picker', () => {
  function makeMockDetected(
    mod: Partial<ManifestUIModule> & { key: string; type: string },
    mode: 'uikit' | 'customui' = 'uikit',
  ): DetectedModule {
    return {
      module: {
        key: mod.key,
        type: mod.type,
        title: mod.title,
        resourceKey: mod.resourceKey || 'main',
        viewMode: mod.viewMode,
      } as ManifestUIModule,
      resourcePath: '/fake/path',
      mode,
    };
  }

  it('should group view and config into a single clickable row', () => {
    const modules: DetectedModule[] = [
      makeMockDetected({ key: 'pet-info--view', type: 'macro', title: 'Pet Info (View)', viewMode: 'view' }),
      makeMockDetected({ key: 'pet-info--config', type: 'macro', title: 'Pet Info (Config)', viewMode: 'config' }),
    ];

    const html = generateModulePickerHtml(modules);

    expect(html).toContain('pet-info');
    expect(html).toContain('href="/module/pet-info/"');
    expect(html).toContain('Macro');
    expect(html).toContain('view + config');
    expect(html).toContain('1 UI module');
    // The split keys themselves should NOT appear as separate links
    expect(html).not.toContain('href="/module/pet-info--view/"');
    expect(html).not.toContain('href="/module/pet-info--config/"');
  });

  it('should keep flat macros (no config) as their own row', () => {
    const modules: DetectedModule[] = [
      makeMockDetected({ key: 'simple', type: 'macro', title: 'Simple Macro' }),
    ];

    const html = generateModulePickerHtml(modules);
    expect(html).toContain('href="/module/simple/"');
    expect(html).toContain('simple');
    // flat macros use the regular renderer path; no view/config combined badge
    expect(html).not.toContain('view + config');
  });

  it('should show macros alongside other module groups', () => {
    const modules: DetectedModule[] = [
      makeMockDetected({ key: 'panel', type: 'jira:issuePanel', title: 'Panel' }),
      makeMockDetected({ key: 'mac--view', type: 'macro', title: 'Mac (View)', viewMode: 'view' }),
      makeMockDetected({ key: 'mac--config', type: 'macro', title: 'Mac (Config)', viewMode: 'config' }),
    ];

    const html = generateModulePickerHtml(modules);
    expect(html).toContain('panel');
    expect(html).toContain('Macro');
    expect(html).toContain('2 UI modules'); // 1 regular panel + 1 grouped macro
  });
});

// ── Context ───────────────────────────────────────────────────────────

describe('macro context', () => {
  it('should default extension.config to {} for macro modules', () => {
    const ctx = buildDefaultContext('hello', 'macro');
    expect(ctx.extension.config).toEqual({});
  });

  it('should merge passed extraExtension.config over defaults', () => {
    const ctx = buildDefaultContext('hello', 'macro', null, { config: { name: 'Whiskers', age: 3 } });
    expect(ctx.extension.config).toEqual({ name: 'Whiskers', age: 3 });
  });

  it('should not add config to non-macro modules', () => {
    const ctx = buildDefaultContext('panel', 'jira:issuePanel');
    expect(ctx.extension.config).toBeUndefined();
  });
});

// ── Combined Macro Page ───────────────────────────────────────────────
//
// The combined macro page is now a top-level Atlaskit React document
// (ForgeSimModulePage). The dev server no longer emits hand-rolled HTML; it
// (a) groups the `--view`/`--config` split modules back into a single
// ModulePageGroup and (b) generates a Vite entry that mounts
// ForgeSimModulePage with that group's props. These tests assert that
// grouping + entry contract; the parent-page UI itself is covered by the
// renderer's module-page.test.tsx.

describe('macro combined page', () => {
  function macroModule(key: string, title: string): DetectedModule {
    return {
      module: { key, type: 'macro', title, resourceKey: 'main' } as ManifestUIModule,
      resourcePath: '/fake/path',
      mode: 'uikit',
    };
  }

  it('groups view and config into a single macro page group', () => {
    const groups = computeModulePageGroups([
      macroModule('pet-info--view', 'Pet Info (View)'),
      macroModule('pet-info--config', 'Pet Info (Config)'),
    ]);

    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g.baseKey).toBe('pet-info');
    expect(g.surface).toBe('macro');
    expect(g.title).toBe('Pet Info');
    expect(g.modes.map((m) => m.mode)).toEqual(['view', 'config']);
    expect(g.modes.map((m) => m.label)).toEqual(['View', 'Config']);
  });

  it('orders view before config regardless of manifest order', () => {
    const groups = computeModulePageGroups([
      macroModule('m--config', 'M (Config)'),
      macroModule('m--view', 'M (View)'),
    ]);
    expect(groups[0].modes.map((m) => m.mode)).toEqual(['view', 'config']);
  });

  it('supports a view-only macro group (single mode)', () => {
    const groups = computeModulePageGroups([macroModule('view-only--view', 'View Only (View)')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].modes.map((m) => m.mode)).toEqual(['view']);
  });

  it('supports a config-only macro group (single mode)', () => {
    const groups = computeModulePageGroups([macroModule('cfg-only--config', 'Config Only (Config)')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].modes.map((m) => m.mode)).toEqual(['config']);
  });

  it('generates an entry that mounts ForgeSimModulePage without importing the dev app', () => {
    const [group] = computeModulePageGroups([
      macroModule('pet-info--view', 'Pet Info (View)'),
      macroModule('pet-info--config', 'Pet Info (Config)'),
    ]);
    const entry = generateModulePageEntry(group, 5174, []);

    // Mounts the top-level parent page, wired to the WS port.
    expect(entry).toContain('ForgeSimModulePage');
    expect(entry).toContain('ws://localhost:5174');
    // Props are baked into the entry as JSON.
    expect(entry).toContain('"baseKey":"pet-info"');
    expect(entry).toContain('"surface":"macro"');
    // No dev-app code runs in the parent realm — the app runs in the content
    // iframes, so the entry must NOT import the app or the per-mode shell.
    expect(entry).not.toContain('ForgeSimShell');
  });

  it('threads parity warnings into the entry props', () => {
    const [group] = computeModulePageGroups([
      macroModule('m--view', 'M (View)'),
      macroModule('m--config', 'M (Config)'),
    ]);
    const entry = generateModulePageEntry(group, 5174, [
      'Macro "m" uses inline config (config: true).',
    ]);
    expect(entry).toContain('inline config');
  });
});
