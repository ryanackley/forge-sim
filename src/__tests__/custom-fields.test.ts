/**
 * Tests for jira:customField and jira:customFieldType manifest parsing,
 * module picker grouping, and context enrichment.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseManifestContent,
  type ManifestUIModule,
} from '../manifest.js';
import { generateModulePickerHtml, detectModuleType, type DetectedModule } from '../dev-command.js';
import { buildDefaultContext } from '../context.js';

// ── Manifest Parsing ──────────────────────────────────────────────────

describe('jira:customField manifest parsing', () => {
  it('should extract view and edit sub-modules from custom field', () => {
    const manifest = parseManifestContent(`
modules:
  jira:customField:
    - key: story-points
      name: Story Points
      description: Track story points
      type: number
      resolver:
        function: resolver
      view:
        resource: sp-view
        render: native
      edit:
        resource: sp-edit
        render: native
  function:
    - key: resolver
      handler: index.handler
resources:
  - key: sp-view
    path: src/view.tsx
  - key: sp-edit
    path: src/edit.tsx
app:
  runtime:
    name: nodejs22.x
`);

    const modules = manifest.uiModules;
    expect(modules).toHaveLength(2);

    // View sub-module
    const view = modules.find((m) => m.key === 'story-points--view');
    expect(view).toBeDefined();
    expect(view!.type).toBe('jira:customField');
    expect(view!.viewMode).toBe('view');
    expect(view!.resourceKey).toBe('sp-view');
    expect(view!.fieldType).toBe('number');
    expect(view!.title).toBe('Story Points (View)');
    expect(view!.resolverFunctionKey).toBe('resolver');

    // Edit sub-module
    const edit = modules.find((m) => m.key === 'story-points--edit');
    expect(edit).toBeDefined();
    expect(edit!.type).toBe('jira:customField');
    expect(edit!.viewMode).toBe('edit');
    expect(edit!.resourceKey).toBe('sp-edit');
    expect(edit!.fieldType).toBe('number');
    expect(edit!.title).toBe('Story Points (Edit)');
  });

  it('should handle view-only custom field (no edit)', () => {
    const manifest = parseManifestContent(`
modules:
  jira:customField:
    - key: computed-score
      name: Computed Score
      description: Auto-computed field
      type: number
      readOnly: true
      resolver:
        function: resolver
      view:
        resource: score-view
        render: native
  function:
    - key: resolver
      handler: index.handler
resources:
  - key: score-view
    path: src/view.tsx
app:
  runtime:
    name: nodejs22.x
`);

    const modules = manifest.uiModules;
    expect(modules).toHaveLength(1);

    const view = modules[0];
    expect(view.key).toBe('computed-score--view');
    expect(view.viewMode).toBe('view');
    expect(view.readOnly).toBe(true);
    // No edit sub-module
    expect(modules.find((m) => m.key === 'computed-score--edit')).toBeUndefined();
  });

  it('should extract value function key', () => {
    const manifest = parseManifestContent(`
modules:
  jira:customField:
    - key: auto-field
      name: Auto Field
      description: Field with value function
      type: string
      resolver:
        function: resolver
      view:
        resource: auto-view
        render: native
        value:
          function: compute-value
      value:
        function: compute-value-alt
  function:
    - key: resolver
      handler: index.handler
    - key: compute-value
      handler: value.handler
    - key: compute-value-alt
      handler: value-alt.handler
resources:
  - key: auto-view
    path: src/view.tsx
app:
  runtime:
    name: nodejs22.x
`);

    const view = manifest.uiModules.find((m) => m.key === 'auto-field--view');
    expect(view).toBeDefined();
    // top-level value.function takes priority, fallback to view.value.function
    expect(view!.valueFunctionKey).toBe('compute-value-alt');
  });

  it('should handle jira:customFieldType the same way', () => {
    const manifest = parseManifestContent(`
modules:
  jira:customFieldType:
    - key: my-field-type
      name: Custom Type
      description: A reusable field type
      type: string
      resolver:
        function: resolver
      view:
        resource: type-view
        render: native
      edit:
        resource: type-edit
        render: native
  function:
    - key: resolver
      handler: index.handler
resources:
  - key: type-view
    path: src/view.tsx
  - key: type-edit
    path: src/edit.tsx
app:
  runtime:
    name: nodejs22.x
`);

    const modules = manifest.uiModules;
    expect(modules).toHaveLength(2);
    expect(modules.find((m) => m.key === 'my-field-type--view')).toBeDefined();
    expect(modules.find((m) => m.key === 'my-field-type--edit')).toBeDefined();
    expect(modules[0].type).toBe('jira:customFieldType');
  });

  it('should handle custom field with i18n name', () => {
    const manifest = parseManifestContent(`
modules:
  jira:customField:
    - key: i18n-field
      name:
        i18n: field.name
      description: A field
      type: string
      resolver:
        function: resolver
      view:
        resource: field-view
        render: native
  function:
    - key: resolver
      handler: index.handler
resources:
  - key: field-view
    path: src/view.tsx
app:
  runtime:
    name: nodejs22.x
`);

    const view = manifest.uiModules.find((m) => m.key === 'i18n-field--view');
    expect(view).toBeDefined();
    expect(view!.title).toBe('field.name (View)');
  });

  it('should skip custom field entries without a key', () => {
    const manifest = parseManifestContent(`
modules:
  jira:customField:
    - name: No Key Field
      description: Missing key
      type: string
      view:
        resource: nk-view
resources:
  - key: nk-view
    path: src/view.tsx
app:
  runtime:
    name: nodejs22.x
`);

    expect(manifest.uiModules).toHaveLength(0);
  });

  it('should handle custom field with top-level resource (legacy)', () => {
    const manifest = parseManifestContent(`
modules:
  jira:customField:
    - key: legacy-field
      name: Legacy Field
      description: Uses top-level resource
      type: string
      resource: main
      resolver:
        function: resolver
  function:
    - key: resolver
      handler: index.handler
resources:
  - key: main
    path: src/index.tsx
app:
  runtime:
    name: nodejs22.x
`);

    // Top-level resource falls through to view sub-module
    const view = manifest.uiModules.find((m) => m.key === 'legacy-field--view');
    expect(view).toBeDefined();
    expect(view!.resourceKey).toBe('main');
    expect(view!.viewMode).toBe('view');
  });

  it('should handle multiple custom fields in one manifest', () => {
    const manifest = parseManifestContent(`
modules:
  jira:customField:
    - key: field-a
      name: Field A
      description: First field
      type: number
      resolver:
        function: resolver
      view:
        resource: a-view
        render: native
      edit:
        resource: a-edit
        render: native
    - key: field-b
      name: Field B
      description: Second field
      type: string
      resolver:
        function: resolver
      view:
        resource: b-view
        render: native
  function:
    - key: resolver
      handler: index.handler
resources:
  - key: a-view
    path: src/a-view.tsx
  - key: a-edit
    path: src/a-edit.tsx
  - key: b-view
    path: src/b-view.tsx
app:
  runtime:
    name: nodejs22.x
`);

    expect(manifest.uiModules).toHaveLength(3); // a-view, a-edit, b-view
    expect(manifest.uiModules.find((m) => m.key === 'field-a--view')).toBeDefined();
    expect(manifest.uiModules.find((m) => m.key === 'field-a--edit')).toBeDefined();
    expect(manifest.uiModules.find((m) => m.key === 'field-b--view')).toBeDefined();
  });

  it('should coexist with regular UI modules', () => {
    const manifest = parseManifestContent(`
modules:
  jira:issuePanel:
    - key: my-panel
      title: My Panel
      resource: main
      resolver:
        function: resolver
      render: native
  jira:customField:
    - key: my-field
      name: My Field
      description: A field
      type: number
      resolver:
        function: resolver
      view:
        resource: field-view
        render: native
  function:
    - key: resolver
      handler: index.handler
resources:
  - key: main
    path: src/index.tsx
  - key: field-view
    path: src/field-view.tsx
app:
  runtime:
    name: nodejs22.x
`);

    expect(manifest.uiModules).toHaveLength(2); // panel + field-view
    expect(manifest.uiModules.find((m) => m.key === 'my-panel')).toBeDefined();
    expect(manifest.uiModules.find((m) => m.key === 'my-field--view')).toBeDefined();
  });
});

// ── Module Picker ─────────────────────────────────────────────────────

describe('custom field module picker', () => {
  function makeMockDetected(mod: Partial<ManifestUIModule> & { key: string; type: string }, mode: 'uikit' | 'customui' = 'uikit'): DetectedModule {
    return {
      module: {
        key: mod.key,
        type: mod.type,
        title: mod.title,
        resourceKey: mod.resourceKey || 'main',
        viewMode: mod.viewMode,
        fieldType: mod.fieldType,
        readOnly: mod.readOnly,
      } as ManifestUIModule,
      resourcePath: '/fake/path',
      mode,
    };
  }

  it('should group view and edit into a single row with toggle', () => {
    const modules: DetectedModule[] = [
      makeMockDetected({ key: 'points--view', type: 'jira:customField', title: 'Points (View)', viewMode: 'view', fieldType: 'number' }),
      makeMockDetected({ key: 'points--edit', type: 'jira:customField', title: 'Points (Edit)', viewMode: 'edit', fieldType: 'number' }),
    ];

    const html = generateModulePickerHtml(modules);

    // Should have "points" as the base key displayed
    expect(html).toContain('points');
    // Should have both View and Edit buttons
    expect(html).toContain('data-cf-mode="view"');
    expect(html).toContain('data-cf-mode="edit"');
    // Should have Custom Field badge
    expect(html).toContain('Custom Field');
    // Should have the field type badge
    expect(html).toContain('number');
    // Should show 1 module (grouped), not 2
    expect(html).toContain('1 UI module');
  });

  it('should show single button for view-only field', () => {
    const modules: DetectedModule[] = [
      makeMockDetected({ key: 'score--view', type: 'jira:customField', title: 'Score (View)', viewMode: 'view', fieldType: 'number' }),
    ];

    const html = generateModulePickerHtml(modules);
    expect(html).toContain('data-cf-key="score--view"');
    // No edit button
    expect(html).not.toContain('data-cf-mode="edit"');
  });

  it('should show regular modules alongside custom field modules', () => {
    const modules: DetectedModule[] = [
      makeMockDetected({ key: 'my-panel', type: 'jira:issuePanel', title: 'My Panel' }),
      makeMockDetected({ key: 'field--view', type: 'jira:customField', title: 'Field (View)', viewMode: 'view', fieldType: 'string' }),
      makeMockDetected({ key: 'field--edit', type: 'jira:customField', title: 'Field (Edit)', viewMode: 'edit', fieldType: 'string' }),
    ];

    const html = generateModulePickerHtml(modules);
    expect(html).toContain('my-panel');
    expect(html).toContain('Custom Field');
    expect(html).toContain('2 UI modules'); // 1 regular + 1 grouped custom field
  });

  it('should include handleCfClick function', () => {
    const modules: DetectedModule[] = [
      makeMockDetected({ key: 'f--view', type: 'jira:customField', title: 'F (View)', viewMode: 'view' }),
    ];

    const html = generateModulePickerHtml(modules);
    expect(html).toContain('handleCfClick');
  });
});

// ── Context ───────────────────────────────────────────────────────────

describe('custom field context', () => {
  it('should include fieldValue for number type', () => {
    const ctx = buildDefaultContext('points--view', 'jira:customField', null, { fieldType: 'number' });
    expect(ctx.extension.fieldValue).toBe(42);
    expect(ctx.extension.fieldType).toBe('number');
  });

  it('should include fieldValue for string type', () => {
    const ctx = buildDefaultContext('name--edit', 'jira:customField', null, { fieldType: 'string' });
    expect(ctx.extension.fieldValue).toBe('Sample value');
    expect(ctx.extension.fieldType).toBe('string');
  });

  it('should include fieldValue for user type', () => {
    const ctx = buildDefaultContext('assignee--view', 'jira:customField', null, { fieldType: 'user' });
    expect(ctx.extension.fieldValue).toHaveProperty('accountId');
    expect(ctx.extension.fieldValue).toHaveProperty('displayName');
  });

  it('should include fieldValue for date type', () => {
    const ctx = buildDefaultContext('due--view', 'jira:customField', null, { fieldType: 'date' });
    expect(ctx.extension.fieldValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should include fieldValue for datetime type', () => {
    const ctx = buildDefaultContext('created--view', 'jira:customField', null, { fieldType: 'datetime' });
    expect(ctx.extension.fieldValue).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should include fieldValue for object type', () => {
    const ctx = buildDefaultContext('data--view', 'jira:customField', null, { fieldType: 'object' });
    expect(typeof ctx.extension.fieldValue).toBe('object');
  });

  it('should default to string type when not specified', () => {
    const ctx = buildDefaultContext('field--view', 'jira:customField');
    expect(ctx.extension.fieldValue).toBe('Sample value');
    expect(ctx.extension.fieldType).toBe('string');
  });

  it('should not add fieldValue for non-custom-field modules', () => {
    const ctx = buildDefaultContext('my-panel', 'jira:issuePanel');
    expect(ctx.extension.fieldValue).toBeUndefined();
    expect(ctx.extension.fieldType).toBeUndefined();
  });

  it('should work for customFieldType too', () => {
    const ctx = buildDefaultContext('type--view', 'jira:customFieldType', null, { fieldType: 'number' });
    expect(ctx.extension.fieldValue).toBe(42);
  });
});
