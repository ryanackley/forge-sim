/**
 * Tests for jira:workflowCondition, jira:workflowValidator, jira:workflowPostFunction
 * manifest parsing, module grouping, and function registration.
 */
import { describe, it, expect } from 'vitest';
import { parseManifestContent } from '../manifest.js';
import {
  generateModulePickerHtml,
  computeModulePageGroups,
  generateModulePageEntry,
  type DetectedModule,
} from '../dev-command.js';
import type { ManifestUIModule } from '../manifest.js';

const BASE_MANIFEST = `
app:
  id: ari:cloud:ecosystem::app/test
  runtime:
    name: nodejs22.x
resources:
  - key: create-ui
    path: src/create.tsx
  - key: edit-ui
    path: src/edit.tsx
  - key: view-ui
    path: src/view.tsx
function:
  - key: resolver
    handler: src/resolvers.handler
  - key: post-fn
    handler: src/postFunction.handler
  - key: validator-fn
    handler: src/validator.handler
`;

describe('jira:workflowCondition', () => {
  it('parses condition with create/edit/view resources as sub-modules', () => {
    const manifest = parseManifestContent(`
${BASE_MANIFEST}
modules:
  jira:workflowCondition:
    - key: my-condition
      name: My Condition
      expression: "issue.status.name == 'Open'"
      resolver:
        function: resolver
      create:
        resource: create-ui
        render: native
      edit:
        resource: edit-ui
        render: native
      view:
        resource: view-ui
        render: native
`);

    expect(manifest.uiModules).toHaveLength(3);
    const keys = manifest.uiModules.map(m => m.key);
    expect(keys).toContain('my-condition--create');
    expect(keys).toContain('my-condition--edit');
    expect(keys).toContain('my-condition--view');

    const createMod = manifest.uiModules.find(m => m.key === 'my-condition--create')!;
    expect(createMod.type).toBe('jira:workflowCondition');
    expect(createMod.viewMode).toBe('create');
    expect(createMod.resourceKey).toBe('create-ui');
    expect(createMod.resolverFunctionKey).toBe('resolver');
  });

  it('parses condition with only expression (no resources)', () => {
    const manifest = parseManifestContent(`
${BASE_MANIFEST}
modules:
  jira:workflowCondition:
    - key: simple-condition
      name: Simple
      expression: "issue.assignee != null"
`);

    // No UI modules — expression-only
    expect(manifest.uiModules).toHaveLength(0);
  });

  it('parses condition with partial resources', () => {
    const manifest = parseManifestContent(`
${BASE_MANIFEST}
modules:
  jira:workflowCondition:
    - key: partial-condition
      name: Partial
      expression: "true"
      edit:
        resource: edit-ui
        render: native
`);

    expect(manifest.uiModules).toHaveLength(1);
    expect(manifest.uiModules[0].key).toBe('partial-condition--edit');
    expect(manifest.uiModules[0].viewMode).toBe('edit');
  });
});

describe('jira:workflowValidator', () => {
  it('parses validator with function and config UIs', () => {
    const manifest = parseManifestContent(`
${BASE_MANIFEST}
modules:
  jira:workflowValidator:
    - key: my-validator
      name: My Validator
      function: validator-fn
      errorMessage: "Validation failed"
      create:
        resource: create-ui
        render: native
      edit:
        resource: edit-ui
        render: native
`);

    expect(manifest.uiModules).toHaveLength(2);
    expect(manifest.uiModules.map(m => m.key)).toContain('my-validator--create');
    expect(manifest.uiModules.map(m => m.key)).toContain('my-validator--edit');

    // Function should be registered with workflow type
    expect(manifest.functions.has('validator-fn')).toBe(true);
    expect(manifest.functions.get('validator-fn')!.type).toBe('workflow');
  });

  it('parses expression-based validator (no function)', () => {
    const manifest = parseManifestContent(`
${BASE_MANIFEST}
modules:
  jira:workflowValidator:
    - key: expr-validator
      name: Expression Validator
      expression: "issue.fields.summary.length > 5"
      errorMessage: "Summary too short"
`);

    expect(manifest.uiModules).toHaveLength(0);
  });
});

describe('jira:workflowPostFunction', () => {
  it('parses post-function with function and config UIs', () => {
    const manifest = parseManifestContent(`
${BASE_MANIFEST}
modules:
  jira:workflowPostFunction:
    - key: my-post-fn
      name: My Post Function
      function: post-fn
      resolver:
        function: resolver
      create:
        resource: create-ui
        render: native
      edit:
        resource: edit-ui
        render: native
      view:
        resource: view-ui
        render: native
`);

    expect(manifest.uiModules).toHaveLength(3);
    const keys = manifest.uiModules.map(m => m.key);
    expect(keys).toContain('my-post-fn--create');
    expect(keys).toContain('my-post-fn--edit');
    expect(keys).toContain('my-post-fn--view');

    // Direct function registered with workflow type
    expect(manifest.functions.has('post-fn')).toBe(true);
    expect(manifest.functions.get('post-fn')!.type).toBe('workflow');

    // Resolver function also registered
    expect(manifest.functions.has('resolver')).toBe(true);
  });

  it('parses post-function with only function (no UI)', () => {
    const manifest = parseManifestContent(`
${BASE_MANIFEST}
modules:
  jira:workflowPostFunction:
    - key: headless-fn
      name: Headless
      function: post-fn
`);

    expect(manifest.uiModules).toHaveLength(0);
    expect(manifest.functions.has('post-fn')).toBe(true);
    expect(manifest.functions.get('post-fn')!.type).toBe('workflow');
  });
});

describe('workflow module picker', () => {
  it('shows grouped workflow modules in picker', () => {
    const modules: DetectedModule[] = [
      {
        module: { type: 'jira:workflowCondition', key: 'my-cond--create', title: 'My Condition (Create)', resourceKey: 'create-ui', viewMode: 'create' as const },
        mode: 'uikit' as const,
        resourcePath: '/app/src/create.tsx',
      },
      {
        module: { type: 'jira:workflowCondition', key: 'my-cond--edit', title: 'My Condition (Edit)', resourceKey: 'edit-ui', viewMode: 'edit' as const },
        mode: 'uikit' as const,
        resourcePath: '/app/src/edit.tsx',
      },
    ];

    const html = generateModulePickerHtml(modules);
    expect(html).toContain('my-cond');
    expect(html).toContain('Workflow Condition');
    expect(html).toContain('Create / Edit');
    // Should NOT show individual sub-modules
    expect(html).not.toContain('my-cond--create');
    expect(html).not.toContain('my-cond--edit');
  });
});

// The combined workflow page is now a top-level Atlaskit React document
// (ForgeSimModulePage). The dev server groups the `--create`/`--edit`/`--view`
// split modules into one ModulePageGroup and generates a Vite entry that
// mounts ForgeSimModulePage. These tests assert that grouping + entry
// contract; the parent-page UI is covered by module-page.test.tsx.

describe('workflow combined page group', () => {
  function wfModule(type: string, key: string, title: string): DetectedModule {
    return {
      module: { type, key, title, resourceKey: 'main' } as ManifestUIModule,
      mode: 'uikit',
      resourcePath: '/fake/path',
    };
  }

  it('groups create/edit/view into a single workflow page group', () => {
    const groups = computeModulePageGroups([
      wfModule('jira:workflowCondition', 'my-cond--create', 'My Condition (Create)'),
      wfModule('jira:workflowCondition', 'my-cond--edit', 'My Condition (Edit)'),
      wfModule('jira:workflowCondition', 'my-cond--view', 'My Condition (View)'),
    ]);

    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g.baseKey).toBe('my-cond');
    expect(g.surface).toBe('workflow');
    expect(g.title).toBe('My Condition');
    expect(g.badgeLabel).toBe('Workflow Condition');
    expect(g.modes.map((m) => m.mode)).toEqual(['create', 'edit', 'view']);
    expect(g.modes.map((m) => m.label)).toEqual(['Create', 'Edit', 'View']);
  });

  it('orders create → edit → view regardless of manifest order', () => {
    const groups = computeModulePageGroups([
      wfModule('jira:workflowCondition', 'c--view', 'C (View)'),
      wfModule('jira:workflowCondition', 'c--create', 'C (Create)'),
      wfModule('jira:workflowCondition', 'c--edit', 'C (Edit)'),
    ]);
    expect(groups[0].modes.map((m) => m.mode)).toEqual(['create', 'edit', 'view']);
  });

  it('derives the badge label from the workflow module type', () => {
    const groups = computeModulePageGroups([
      wfModule('jira:workflowPostFunction', 'my-fn--create', 'My Post Function (Create)'),
      wfModule('jira:workflowPostFunction', 'my-fn--edit', 'My Post Function (Edit)'),
    ]);
    expect(groups[0].badgeLabel).toBe('Workflow PostFunction');
    expect(groups[0].modes.map((m) => m.mode)).toEqual(['create', 'edit']);
  });

  it('supports a single-mode workflow group', () => {
    const groups = computeModulePageGroups([
      wfModule('jira:workflowCondition', 'my-cond--edit', 'Cond (Edit)'),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].modes.map((m) => m.mode)).toEqual(['edit']);
  });

  it('generates an entry that mounts ForgeSimModulePage with the workflow badge label', () => {
    const [group] = computeModulePageGroups([
      wfModule('jira:workflowCondition', 'my-cond--create', 'My Condition (Create)'),
      wfModule('jira:workflowCondition', 'my-cond--edit', 'My Condition (Edit)'),
      wfModule('jira:workflowCondition', 'my-cond--view', 'My Condition (View)'),
    ]);
    const entry = generateModulePageEntry(group, 5174, []);

    expect(entry).toContain('ForgeSimModulePage');
    expect(entry).toContain('ws://localhost:5174');
    expect(entry).toContain('"baseKey":"my-cond"');
    expect(entry).toContain('"surface":"workflow"');
    expect(entry).toContain('Workflow Condition');
    // The parent realm never runs the dev app.
    expect(entry).not.toContain('ForgeSimShell');
  });
});
