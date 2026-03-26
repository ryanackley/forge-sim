/**
 * Tests for Rovo action manifest parsing, function registration,
 * input schema extraction, and config UI detection.
 */
import { describe, it, expect } from 'vitest';
import { parseManifestContent } from '../manifest.js';
import { generateModulePickerHtml, type DetectedModule } from '../dev-command.js';

const BASE_MANIFEST = `
app:
  id: ari:cloud:ecosystem::app/test
  runtime:
    name: nodejs22.x
function:
  - key: get-timesheet
    handler: src/timesheet.handler
  - key: log-time
    handler: src/logTime.handler
  - key: config-resolver
    handler: src/config.handler
resources:
  - key: config-ui
    path: src/config.tsx
`;

describe('Rovo action manifest parsing', () => {
  it('parses action with function and inputs', () => {
    const manifest = parseManifestContent(`
${BASE_MANIFEST}
modules:
  action:
    - key: fetch-timesheet
      name: Fetch Timesheet
      function: get-timesheet
      actionVerb: GET
      description: Retrieve a user's timesheet based on a date
      inputs:
        timesheetDate:
          title: Timesheet Date
          type: string
          required: true
          description: The date for the timesheet
        userId:
          title: User ID
          type: string
          required: false
          description: Optional user override
`);

    expect(manifest.actions).toHaveLength(1);
    const action = manifest.actions[0];
    expect(action.key).toBe('fetch-timesheet');
    expect(action.name).toBe('Fetch Timesheet');
    expect(action.functionKey).toBe('get-timesheet');
    expect(action.actionVerb).toBe('GET');
    expect(action.description).toContain('timesheet');

    // Inputs
    expect(Object.keys(action.inputs)).toHaveLength(2);
    expect(action.inputs.timesheetDate.title).toBe('Timesheet Date');
    expect(action.inputs.timesheetDate.type).toBe('string');
    expect(action.inputs.timesheetDate.required).toBe(true);
    expect(action.inputs.userId.required).toBe(false);

    // Function registered with action type
    expect(manifest.functions.has('get-timesheet')).toBe(true);
    expect(manifest.functions.get('get-timesheet')!.type).toBe('action');
  });

  it('parses action with config resource as UI module', () => {
    const manifest = parseManifestContent(`
${BASE_MANIFEST}
modules:
  action:
    - key: log-time-action
      name: Log Time
      function: log-time
      actionVerb: CREATE
      description: Log time against an issue
      inputs:
        issueKey:
          title: Issue Key
          type: string
          required: true
      config:
        resource: config-ui
        render: native
      resolver:
        function: config-resolver
`);

    // Action tracked
    expect(manifest.actions).toHaveLength(1);
    expect(manifest.actions[0].configResourceKey).toBe('config-ui');

    // Config UI module created
    expect(manifest.uiModules).toHaveLength(1);
    expect(manifest.uiModules[0].key).toBe('log-time-action');
    expect(manifest.uiModules[0].type).toBe('action');
    expect(manifest.uiModules[0].resourceKey).toBe('config-ui');
    expect(manifest.uiModules[0].resolverFunctionKey).toBe('config-resolver');
  });

  it('parses action without config resource (no UI module)', () => {
    const manifest = parseManifestContent(`
${BASE_MANIFEST}
modules:
  action:
    - key: simple-action
      name: Simple
      function: get-timesheet
      actionVerb: GET
      description: Does something simple
      inputs:
        query:
          title: Query
          type: string
          required: true
`);

    expect(manifest.actions).toHaveLength(1);
    expect(manifest.uiModules).toHaveLength(0); // No config UI
  });

  it('handles multiple actions', () => {
    const manifest = parseManifestContent(`
${BASE_MANIFEST}
modules:
  action:
    - key: action-a
      name: Action A
      function: get-timesheet
      actionVerb: GET
      description: First action
      inputs:
        x:
          title: X
          type: string
          required: true
    - key: action-b
      name: Action B
      function: log-time
      actionVerb: CREATE
      description: Second action
      inputs:
        y:
          title: Y
          type: integer
          required: true
`);

    expect(manifest.actions).toHaveLength(2);
    expect(manifest.actions[0].key).toBe('action-a');
    expect(manifest.actions[1].key).toBe('action-b');
    expect(manifest.actions[1].inputs.y.type).toBe('integer');
  });

  it('skips actions with no function', () => {
    const manifest = parseManifestContent(`
${BASE_MANIFEST}
modules:
  action:
    - key: broken
      name: Broken
      description: Missing function
      actionVerb: GET
      inputs: {}
`);

    expect(manifest.actions).toHaveLength(0);
  });

  it('handles action with no inputs', () => {
    const manifest = parseManifestContent(`
${BASE_MANIFEST}
modules:
  action:
    - key: no-inputs
      name: No Inputs
      function: get-timesheet
      actionVerb: TRIGGER
      description: Action with no inputs
`);

    expect(manifest.actions).toHaveLength(1);
    expect(Object.keys(manifest.actions[0].inputs)).toHaveLength(0);
  });

  it('handles actionType (older schema variant)', () => {
    const manifest = parseManifestContent(`
${BASE_MANIFEST}
modules:
  action:
    - key: typed-action
      name: Typed Action
      function: get-timesheet
      actionType: atlassian:issue:create:comment
      description: Creates a comment
      inputs:
        issueId:
          title: Issue ID
          type: string
          required: true
        comment:
          title: Comment
          type: string
          required: true
`);

    expect(manifest.actions).toHaveLength(1);
    expect(manifest.actions[0].key).toBe('typed-action');
    // actionType doesn't map to actionVerb
    expect(manifest.actions[0].actionVerb).toBeUndefined();
  });
});

describe('action in module picker', () => {
  it('shows action config UI in picker', () => {
    const modules: DetectedModule[] = [{
      module: {
        type: 'action',
        key: 'my-action',
        title: 'My Action (Config)',
        resourceKey: 'config-ui',
      },
      mode: 'uikit' as const,
      resourcePath: '/app/src/config.tsx',
    }];

    const html = generateModulePickerHtml(modules);
    expect(html).toContain('my-action');
  });
});
