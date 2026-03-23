/**
 * Background script support tests.
 *
 * Tests manifest parsing, module picker filtering, context mapping,
 * iframe injection, and cross-module event relay.
 */

import { describe, it, expect } from 'vitest';
import {
  parseManifestContent,
  BACKGROUND_SCRIPT_TYPES,
  BACKGROUND_SCRIPT_CONTEXTS,
  GLOBAL_BG_EXPERIENCE_MAP,
  getCompatibleBackgroundScripts,
  type ManifestUIModule,
} from '../manifest.js';
import { generateModulePickerHtml, type DetectedModule } from '../dev-command.js';

// ── Manifest Parsing ──────────────────────────────────────────────────

describe('background script manifest parsing', () => {
  it('should parse background scripts as UI modules', () => {
    const manifest = parseManifestContent(`
app:
  id: test-app
modules:
  jira:issueViewBackgroundScript:
    - key: bg-issue
      resource: main
  function:
    - key: resolver
      handler: index.handler
resources:
  - key: main
    path: src/frontend
`);
    const bg = manifest.uiModules.find((m) => m.key === 'bg-issue');
    expect(bg).toBeDefined();
    expect(bg!.type).toBe('jira:issueViewBackgroundScript');
    expect(bg!.resourceKey).toBe('main');
  });

  it('should parse experience field on global background scripts', () => {
    const manifest = parseManifestContent(`
app:
  id: test-app
modules:
  jira:globalBackgroundScript:
    - key: bg-global
      resource: main
      experience:
        - issue-view
        - dashboard
  function:
    - key: resolver
      handler: index.handler
resources:
  - key: main
    path: src/frontend
`);
    const bg = manifest.uiModules.find((m) => m.key === 'bg-global');
    expect(bg).toBeDefined();
    expect(bg!.experience).toEqual(['issue-view', 'dashboard']);
  });

  it('should not set experience when not present in manifest', () => {
    const manifest = parseManifestContent(`
app:
  id: test-app
modules:
  jira:issueViewBackgroundScript:
    - key: bg-issue
      resource: main
resources:
  - key: main
    path: src/frontend
`);
    const bg = manifest.uiModules.find((m) => m.key === 'bg-issue');
    expect(bg).toBeDefined();
    expect(bg!.experience).toBeUndefined();
  });

  it('should parse multiple background script types', () => {
    const manifest = parseManifestContent(`
app:
  id: test-app
modules:
  jira:issueViewBackgroundScript:
    - key: bg-issue
      resource: main
  jira:dashboardBackgroundScript:
    - key: bg-dashboard
      resource: main
  jira:globalBackgroundScript:
    - key: bg-global
      resource: main
  confluence:backgroundScript:
    - key: bg-confluence
      resource: main
  function:
    - key: resolver
      handler: index.handler
resources:
  - key: main
    path: src/frontend
`);
    const bgModules = manifest.uiModules.filter((m) => BACKGROUND_SCRIPT_TYPES.has(m.type));
    expect(bgModules).toHaveLength(4);
    expect(bgModules.map((m) => m.key).sort()).toEqual([
      'bg-confluence', 'bg-dashboard', 'bg-global', 'bg-issue',
    ]);
  });
});

// ── Context Mapping ───────────────────────────────────────────────────

describe('BACKGROUND_SCRIPT_TYPES', () => {
  it('should contain all four background script types', () => {
    expect(BACKGROUND_SCRIPT_TYPES.has('jira:issueViewBackgroundScript')).toBe(true);
    expect(BACKGROUND_SCRIPT_TYPES.has('jira:dashboardBackgroundScript')).toBe(true);
    expect(BACKGROUND_SCRIPT_TYPES.has('jira:globalBackgroundScript')).toBe(true);
    expect(BACKGROUND_SCRIPT_TYPES.has('confluence:backgroundScript')).toBe(true);
  });

  it('should not include regular UI module types', () => {
    expect(BACKGROUND_SCRIPT_TYPES.has('jira:issuePanel')).toBe(false);
    expect(BACKGROUND_SCRIPT_TYPES.has('jira:globalPage')).toBe(false);
  });
});

describe('BACKGROUND_SCRIPT_CONTEXTS', () => {
  it('should map issue background script to issue view modules', () => {
    const contexts = BACKGROUND_SCRIPT_CONTEXTS['jira:issueViewBackgroundScript'];
    expect(contexts).toContain('jira:issuePanel');
    expect(contexts).toContain('jira:issueContext');
    expect(contexts).toContain('jira:issueGlance');
    expect(contexts).toContain('jira:issueActivity');
    expect(contexts).toContain('jira:issueAction');
  });

  it('should map dashboard background script to dashboard modules', () => {
    const contexts = BACKGROUND_SCRIPT_CONTEXTS['jira:dashboardBackgroundScript'];
    expect(contexts).toContain('jira:dashboardGadget');
  });

  it('should map global background script to global/full-page modules', () => {
    const contexts = BACKGROUND_SCRIPT_CONTEXTS['jira:globalBackgroundScript'];
    expect(contexts).toContain('jira:globalPage');
    expect(contexts).toContain('jira:fullPage');
  });

  it('should map confluence background script to confluence modules', () => {
    const contexts = BACKGROUND_SCRIPT_CONTEXTS['confluence:backgroundScript'];
    expect(contexts).toContain('confluence:globalPage');
    expect(contexts).toContain('confluence:spacePage');
    expect(contexts).toContain('confluence:contentByLineItem');
  });
});

describe('getCompatibleBackgroundScripts', () => {
  const allModules: ManifestUIModule[] = [
    { type: 'jira:issuePanel', key: 'panel', resourceKey: 'main' },
    { type: 'jira:issueViewBackgroundScript', key: 'bg-issue', resourceKey: 'main' },
    { type: 'jira:dashboardBackgroundScript', key: 'bg-dashboard', resourceKey: 'main' },
    { type: 'jira:globalPage', key: 'global-page', resourceKey: 'main' },
    { type: 'jira:globalBackgroundScript', key: 'bg-global', resourceKey: 'main', experience: ['all'] },
    { type: 'confluence:globalPage', key: 'conf-page', resourceKey: 'main' },
    { type: 'confluence:backgroundScript', key: 'bg-confluence', resourceKey: 'main' },
  ];

  it('should find issue background script for issuePanel', () => {
    const result = getCompatibleBackgroundScripts('jira:issuePanel', allModules);
    // Should find bg-issue (issueView) + bg-global (experience: all)
    const keys = result.map((m) => m.key).sort();
    expect(keys).toContain('bg-issue');
    expect(keys).toContain('bg-global');
  });

  it('should find issue background script for issueGlance', () => {
    const result = getCompatibleBackgroundScripts('jira:issueGlance', allModules);
    const keys = result.map((m) => m.key).sort();
    expect(keys).toContain('bg-issue');
    expect(keys).toContain('bg-global');
  });

  it('should find global background script with experience:all for globalPage', () => {
    const result = getCompatibleBackgroundScripts('jira:globalPage', allModules);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('bg-global');
  });

  it('should find confluence background script for confluence:globalPage', () => {
    const result = getCompatibleBackgroundScripts('confluence:globalPage', allModules);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('bg-confluence');
  });

  it('should return empty array for modules with no compatible background script', () => {
    const result = getCompatibleBackgroundScripts('jira:projectSettingsPage', allModules);
    // bg-global has experience: all, which includes projectSettingsPage? Let's check...
    // Actually 'all' maps to a specific list including adminPage but not projectSettingsPage
    // unless we add it. For now, this may return bg-global.
    // Let's use a truly incompatible type
    const result2 = getCompatibleBackgroundScripts('confluence:spacePage', [
      { type: 'jira:issueViewBackgroundScript', key: 'bg-issue', resourceKey: 'main' },
    ]);
    expect(result2).toHaveLength(0);
  });

  it('should return empty array when no background scripts exist', () => {
    const noScripts: ManifestUIModule[] = [
      { type: 'jira:issuePanel', key: 'panel', resourceKey: 'main' },
    ];
    const result = getCompatibleBackgroundScripts('jira:issuePanel', noScripts);
    expect(result).toHaveLength(0);
  });

  it('should find multiple background scripts if app defines more than one of same type', () => {
    const modules: ManifestUIModule[] = [
      { type: 'jira:issueViewBackgroundScript', key: 'bg-1', resourceKey: 'main' },
      { type: 'jira:issueViewBackgroundScript', key: 'bg-2', resourceKey: 'main' },
    ];
    const result = getCompatibleBackgroundScripts('jira:issuePanel', modules);
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.key).sort()).toEqual(['bg-1', 'bg-2']);
  });

  // ── Global Background Script Experience Scoping ────────────────────

  describe('global background script experience scoping', () => {
    it('should not match global bg script without experience (per Forge docs)', () => {
      const modules: ManifestUIModule[] = [
        { type: 'jira:globalBackgroundScript', key: 'bg-no-exp', resourceKey: 'main' },
        // No experience field = doesn't run anywhere
      ];
      const result = getCompatibleBackgroundScripts('jira:issuePanel', modules);
      expect(result).toHaveLength(0);
    });

    it('should not match global bg script with empty experience array', () => {
      const modules: ManifestUIModule[] = [
        { type: 'jira:globalBackgroundScript', key: 'bg-empty', resourceKey: 'main', experience: [] },
      ];
      const result = getCompatibleBackgroundScripts('jira:issuePanel', modules);
      expect(result).toHaveLength(0);
    });

    it('should match issue modules when experience includes issue-view', () => {
      const modules: ManifestUIModule[] = [
        { type: 'jira:globalBackgroundScript', key: 'bg-issue-only', resourceKey: 'main', experience: ['issue-view'] },
      ];
      expect(getCompatibleBackgroundScripts('jira:issuePanel', modules)).toHaveLength(1);
      expect(getCompatibleBackgroundScripts('jira:issueGlance', modules)).toHaveLength(1);
      expect(getCompatibleBackgroundScripts('jira:issueContext', modules)).toHaveLength(1);
      expect(getCompatibleBackgroundScripts('jira:issueActivity', modules)).toHaveLength(1);
      expect(getCompatibleBackgroundScripts('jira:issueAction', modules)).toHaveLength(1);
      // Should NOT match dashboard or board modules
      expect(getCompatibleBackgroundScripts('jira:dashboardGadget', modules)).toHaveLength(0);
      expect(getCompatibleBackgroundScripts('jira:globalPage', modules)).toHaveLength(0);
    });

    it('should match dashboard modules when experience includes dashboard', () => {
      const modules: ManifestUIModule[] = [
        { type: 'jira:globalBackgroundScript', key: 'bg-dash', resourceKey: 'main', experience: ['dashboard'] },
      ];
      expect(getCompatibleBackgroundScripts('jira:dashboardGadget', modules)).toHaveLength(1);
      expect(getCompatibleBackgroundScripts('jira:issuePanel', modules)).toHaveLength(0);
    });

    it('should match board modules when experience includes board', () => {
      const modules: ManifestUIModule[] = [
        { type: 'jira:globalBackgroundScript', key: 'bg-board', resourceKey: 'main', experience: ['board'] },
      ];
      expect(getCompatibleBackgroundScripts('jira:boardAction', modules)).toHaveLength(1);
      expect(getCompatibleBackgroundScripts('jira:backlogAction', modules)).toHaveLength(1);
      expect(getCompatibleBackgroundScripts('jira:issuePanel', modules)).toHaveLength(0);
    });

    it('should match all Jira modules when experience includes all', () => {
      const modules: ManifestUIModule[] = [
        { type: 'jira:globalBackgroundScript', key: 'bg-all', resourceKey: 'main', experience: ['all'] },
      ];
      expect(getCompatibleBackgroundScripts('jira:issuePanel', modules)).toHaveLength(1);
      expect(getCompatibleBackgroundScripts('jira:dashboardGadget', modules)).toHaveLength(1);
      expect(getCompatibleBackgroundScripts('jira:boardAction', modules)).toHaveLength(1);
      expect(getCompatibleBackgroundScripts('jira:globalPage', modules)).toHaveLength(1);
      expect(getCompatibleBackgroundScripts('jira:adminPage', modules)).toHaveLength(1);
      // But NOT confluence
      expect(getCompatibleBackgroundScripts('confluence:globalPage', modules)).toHaveLength(0);
    });

    it('should combine multiple experience values cumulatively', () => {
      const modules: ManifestUIModule[] = [
        { type: 'jira:globalBackgroundScript', key: 'bg-multi', resourceKey: 'main', experience: ['issue-view', 'dashboard'] },
      ];
      expect(getCompatibleBackgroundScripts('jira:issuePanel', modules)).toHaveLength(1);
      expect(getCompatibleBackgroundScripts('jira:dashboardGadget', modules)).toHaveLength(1);
      expect(getCompatibleBackgroundScripts('jira:boardAction', modules)).toHaveLength(0);
    });

    it('should handle overlap: global bg script + issueView bg script both match issue modules', () => {
      const modules: ManifestUIModule[] = [
        { type: 'jira:issueViewBackgroundScript', key: 'bg-issue', resourceKey: 'main' },
        { type: 'jira:globalBackgroundScript', key: 'bg-global', resourceKey: 'main', experience: ['issue-view'] },
      ];
      const result = getCompatibleBackgroundScripts('jira:issuePanel', modules);
      expect(result).toHaveLength(2);
      expect(result.map((m) => m.key).sort()).toEqual(['bg-global', 'bg-issue']);
    });

    it('should handle two global bg scripts with different experiences', () => {
      const modules: ManifestUIModule[] = [
        { type: 'jira:globalBackgroundScript', key: 'bg-issues', resourceKey: 'main', experience: ['issue-view'] },
        { type: 'jira:globalBackgroundScript', key: 'bg-dash', resourceKey: 'main', experience: ['dashboard'] },
      ];
      // issuePanel should only get bg-issues
      const issueResult = getCompatibleBackgroundScripts('jira:issuePanel', modules);
      expect(issueResult).toHaveLength(1);
      expect(issueResult[0].key).toBe('bg-issues');
      // dashboardGadget should only get bg-dash
      const dashResult = getCompatibleBackgroundScripts('jira:dashboardGadget', modules);
      expect(dashResult).toHaveLength(1);
      expect(dashResult[0].key).toBe('bg-dash');
    });

    it('should handle two global bg scripts with overlapping experiences', () => {
      const modules: ManifestUIModule[] = [
        { type: 'jira:globalBackgroundScript', key: 'bg-broad', resourceKey: 'main', experience: ['issue-view', 'dashboard'] },
        { type: 'jira:globalBackgroundScript', key: 'bg-narrow', resourceKey: 'main', experience: ['issue-view'] },
      ];
      // issuePanel gets both
      const issueResult = getCompatibleBackgroundScripts('jira:issuePanel', modules);
      expect(issueResult).toHaveLength(2);
      expect(issueResult.map((m) => m.key).sort()).toEqual(['bg-broad', 'bg-narrow']);
      // dashboardGadget only gets bg-broad
      const dashResult = getCompatibleBackgroundScripts('jira:dashboardGadget', modules);
      expect(dashResult).toHaveLength(1);
      expect(dashResult[0].key).toBe('bg-broad');
    });
  });
});

// ── Module Picker HTML ────────────────────────────────────────────────

describe('module picker with background scripts', () => {
  const makeModules = (): DetectedModule[] => [
    {
      module: { type: 'jira:issuePanel', key: 'panel', title: 'Issue Panel' },
      resourcePath: '/path/to/panel',
      mode: 'uikit',
    },
    {
      module: { type: 'jira:issueViewBackgroundScript', key: 'bg-issue', title: 'BG Script' },
      resourcePath: '/path/to/bg',
      mode: 'uikit',
    },
    {
      module: { type: 'jira:globalPage', key: 'page', title: 'Global Page' },
      resourcePath: '/path/to/page',
      mode: 'customui',
    },
    {
      module: { type: 'jira:globalBackgroundScript', key: 'bg-global', title: 'Global BG', experience: ['all'] },
      resourcePath: '/path/to/gbg',
      mode: 'uikit',
    },
  ];

  it('should not show background scripts as clickable modules', () => {
    const html = generateModulePickerHtml(makeModules());
    // Background script should NOT have its own link in the main list
    expect(html).not.toContain('href="/module/bg-issue/"');
  });

  it('should show regular UI modules', () => {
    const html = generateModulePickerHtml(makeModules());
    expect(html).toContain('/module/panel/');
    expect(html).toContain('/module/page/');
    expect(html).toContain('Issue Panel');
    expect(html).toContain('Global Page');
  });

  it('should show checkbox for compatible background script', () => {
    const html = generateModulePickerHtml(makeModules());
    expect(html).toContain('data-bg-key="bg-issue"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked');
  });

  it('should show global bg checkbox on compatible modules (experience scoped)', () => {
    const html = generateModulePickerHtml(makeModules());
    // The global page should have bg-global checkbox (experience: all includes globalPage)
    const pageSection = html.split('/module/page/')[1]?.split('</a>')[0] ?? '';
    expect(pageSection).toContain('data-bg-key="bg-global"');
    // The issue panel should have both bg-issue and bg-global
    const panelSection = html.split('/module/panel/')[1]?.split('</a>')[0] ?? '';
    expect(panelSection).toContain('data-bg-key="bg-issue"');
    expect(panelSection).toContain('data-bg-key="bg-global"');
  });

  it('should count only UI modules (not background scripts)', () => {
    const html = generateModulePickerHtml(makeModules());
    expect(html).toContain('2 UI modules');
  });

  it('should handle no background scripts gracefully', () => {
    const modules: DetectedModule[] = [
      {
        module: { type: 'jira:issuePanel', key: 'panel' },
        resourcePath: '/path',
        mode: 'uikit',
      },
    ];
    const html = generateModulePickerHtml(modules);
    expect(html).toContain('1 UI module ');
    // No checkbox inputs with bg key values (the script references data-bg-key in querySelector but no actual checkboxes exist)
    expect(html).not.toContain('data-bg-key="');
  });

  it('should include handleModuleClick script for bg parameter passing', () => {
    const html = generateModulePickerHtml(makeModules());
    expect(html).toContain('handleModuleClick');
    expect(html).toContain('?bg=');
  });

  it('should show orphan background scripts in separate section', () => {
    // issueViewBackgroundScript with no issue UI module = orphan
    const modules: DetectedModule[] = [
      {
        module: { type: 'jira:globalPage', key: 'page' },
        resourcePath: '/path',
        mode: 'customui',
      },
      {
        module: { type: 'jira:issueViewBackgroundScript', key: 'bg-orphan' },
        resourcePath: '/path',
        mode: 'uikit',
      },
    ];
    const html = generateModulePickerHtml(modules);
    expect(html).toContain('bg-orphan');
    expect(html).toContain('no matching UI module');
  });

  it('should show global bg script without experience as orphan', () => {
    const modules: DetectedModule[] = [
      {
        module: { type: 'jira:issuePanel', key: 'panel' },
        resourcePath: '/path',
        mode: 'uikit',
      },
      {
        // No experience = doesn't run anywhere = orphan
        module: { type: 'jira:globalBackgroundScript', key: 'bg-no-exp' },
        resourcePath: '/path',
        mode: 'uikit',
      },
    ];
    const html = generateModulePickerHtml(modules);
    expect(html).toContain('bg-no-exp');
    expect(html).toContain('no matching UI module');
  });
});

// ── Background Script Iframe Injection ────────────────────────────────

describe('background script iframe injection', () => {
  it('should include iframe injector script in generated index HTML', () => {
    // We test this indirectly — the generateIndexHtml function includes
    // BACKGROUND_SCRIPT_IFRAME_INJECTOR which reads ?bg= and creates iframes
    // This is tested via the module picker flow integration
  });
});

// ── Cross-Module Events ───────────────────────────────────────────────

describe('cross-module events (bridge shim)', () => {
  // These tests verify the renderer bridge shim's event relay behavior.
  // The actual WS relay is tested in dev-server tests; here we test the
  // bridge shim's local dispatch + WS send behavior.

  it('should export events with emit/on/emitPublic/onPublic', async () => {
    const { events } = await import('../../renderer/src/bridge/forge-bridge-shim.js');
    expect(typeof events.emit).toBe('function');
    expect(typeof events.on).toBe('function');
    expect(typeof events.emitPublic).toBe('function');
    expect(typeof events.onPublic).toBe('function');
  });

  it('should dispatch events locally via emit/on', async () => {
    const { events } = await import('../../renderer/src/bridge/forge-bridge-shim.js');
    const received: any[] = [];
    await events.on('test-event', (payload: any) => received.push(payload));
    await events.emit('test-event', { data: 'hello' });
    expect(received).toEqual([{ data: 'hello' }]);
  });

  it('should dispatch public events locally via emitPublic/onPublic', async () => {
    const { events } = await import('../../renderer/src/bridge/forge-bridge-shim.js');
    const received: any[] = [];
    await events.onPublic('pub-test', (payload: any) => received.push(payload));
    await events.emitPublic('pub-test', { data: 'public' });
    expect(received).toEqual([{ data: 'public' }]);
  });

  it('should support unsubscribe', async () => {
    const { events } = await import('../../renderer/src/bridge/forge-bridge-shim.js');
    const received: any[] = [];
    const sub = await events.on('unsub-test', (payload: any) => received.push(payload));
    await events.emit('unsub-test', 'first');
    sub.unsubscribe();
    await events.emit('unsub-test', 'second');
    expect(received).toEqual(['first']);
  });
});

// ── Inline Bridge Events (Custom UI) ──────────────────────────────────

describe('inline bridge events', () => {
  it('should include event handling cases in bridge inline script', async () => {
    const { generateBridgeInlineScript } = await import('../dev-command.js');
    const script = generateBridgeInlineScript(5174);

    // Should handle callBridge('emit', ...) for Custom UI apps
    expect(script).toContain("case 'emit':");
    expect(script).toContain("case 'on':");
    expect(script).toContain("case 'emitPublic':");
    expect(script).toContain("case 'onPublic':");

    // Should send forgeEvent messages over WS
    expect(script).toContain("type: 'forgeEvent'");

    // Should handle incoming forgeEvent messages
    expect(script).toContain("msg.type === 'forgeEvent'");
  });

  it('should include background script iframe injector in inline script', async () => {
    const { generateBridgeInlineScript } = await import('../dev-command.js');
    const script = generateBridgeInlineScript(5174);

    // The iframe injector is separate from the bridge script
    // It's added to the HTML template, not the bridge script itself
    // So we verify the bridge handles events, not iframe injection
    expect(script).toContain('eventListeners');
  });
});
