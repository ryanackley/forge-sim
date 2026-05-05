/**
 * Tests for macro config sub-module: manifest parsing,
 * module picker grouping, context enrichment, and the combined page UI.
 */
import { describe, it, expect } from 'vitest';
import { parseManifestContent, type ManifestUIModule } from '../manifest.js';
import {
  generateModulePickerHtml,
  generateMacroPageHtml,
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

  it('should warn (info) when config: true is used (inline addConfig)', () => {
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

    const info = manifest.warnings.find(
      (w) => w.message.includes('"simple"') && w.message.includes('inline config'),
    );
    expect(info).toBeDefined();
    expect(info!.level).toBe('info');
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

describe('macro combined page', () => {
  it('should generate page with View and Config tabs', () => {
    const html = generateMacroPageHtml('pet-info', 'Pet Info', true, true, 5174);

    expect(html).toContain('data-mode="view"');
    expect(html).toContain('data-mode="config"');
    expect(html).toContain('src="/module/pet-info--view/"');
    expect(html).toContain('data-src="/module/pet-info--config/"');
    expect(html).toContain('id="cf-config"');
    expect(html).toContain('display:none');
    expect(html).toContain('macroConfigUpdate');
    expect(html).toContain('ws://localhost:5174');
    expect(html).toContain('Macro');
    expect(html).toContain('Back to modules');
  });

  it('should generate view-only page without tab toggle', () => {
    const html = generateMacroPageHtml('view-only', 'View Only', true, false, 5174);

    expect(html).toContain('src="/module/view-only--view/"');
    expect(html).not.toContain('src="/module/view-only--config/"');
    expect(html).not.toContain('data-src="/module/view-only--config/"');
    expect(html).not.toContain('onclick="switchTab');
  });

  it('should generate config-only page without tab toggle', () => {
    const html = generateMacroPageHtml('cfg-only', 'Config Only', false, true, 5174);

    expect(html).not.toContain('src="/module/cfg-only--view/"');
    expect(html).toContain('src="/module/cfg-only--config/"');
    expect(html).not.toContain('onclick="switchTab');
  });

  it('should include switchTab function when both tabs present', () => {
    const html = generateMacroPageHtml('m', 'M', true, true, 5174);
    expect(html).toContain('function switchTab');
    expect(html).toContain('triggerSubmit');
  });

  it('should show parity note banner when warnings provided', () => {
    const html = generateMacroPageHtml('m', 'M', true, true, 5174, [
      'Macro "m" uses inline config (config: true).',
    ]);
    expect(html).toContain('Parity Note');
    expect(html).toContain('inline config');
  });

  it('should not show banner when no warnings', () => {
    const html = generateMacroPageHtml('m', 'M', true, true, 5174, []);
    expect(html).not.toContain('Parity Note');
  });

  it('should wire the Save button to postMessage the config iframe', () => {
    const html = generateMacroPageHtml('m', 'M', true, true, 5174);
    expect(html).toContain('forge-sim-trigger-submit');
    expect(html).toContain('configFrame.contentWindow.postMessage');
  });
});
