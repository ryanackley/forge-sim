/**
 * Sample ForgeDoc trees for testing the renderer.
 * These mirror what @forge/react's reconciler actually produces.
 */

import type { ForgeDoc } from './types';

/** Simple issue panel — text, badge, button */
export const issuePanel: ForgeDoc = {
  type: 'App',
  props: {},
  key: 'root',
  children: [
    {
      type: 'Stack',
      props: { space: 'space.200' },
      key: 'stack-1',
      children: [
        {
          type: 'Heading',
          props: { size: 'medium' },
          key: 'heading-1',
          children: [
            { type: 'String', props: { text: 'Issue Details' }, key: 's-1', children: [] },
          ],
        },
        {
          type: 'Inline',
          props: { space: 'space.100', alignBlock: 'center' },
          key: 'inline-1',
          children: [
            {
              type: 'Text',
              props: {},
              key: 'text-status',
              children: [
                { type: 'String', props: { text: 'Status: ' }, key: 's-2', children: [] },
              ],
            },
            {
              type: 'Lozenge',
              props: { appearance: 'inprogress', isBold: true },
              key: 'loz-1',
              children: [
                { type: 'String', props: { text: 'In Progress' }, key: 's-3', children: [] },
              ],
            },
            {
              type: 'Badge',
              props: { appearance: 'primary' },
              key: 'badge-1',
              children: [
                { type: 'String', props: { text: '3' }, key: 's-4', children: [] },
              ],
            },
          ],
        },
        {
          type: 'SectionMessage',
          props: { appearance: 'information', title: 'Quick Summary' },
          key: 'section-1',
          children: [
            {
              type: 'Text',
              props: {},
              key: 'text-summary',
              children: [
                {
                  type: 'String',
                  props: { text: 'This issue tracks the UIKit renderer proof of concept for forge-sim.' },
                  key: 's-5',
                  children: [],
                },
              ],
            },
          ],
        },
        {
          type: 'Inline',
          props: { space: 'space.100' },
          key: 'btn-row',
          children: [
            {
              type: 'Button',
              props: { appearance: 'primary', onClick: Object.assign(() => alert('Refresh clicked!'), { __id__: 'btn-refresh' }) },
              key: 'btn-1',
              children: [
                { type: 'String', props: { text: 'Refresh' }, key: 's-6', children: [] },
              ],
            },
            {
              type: 'Button',
              props: { appearance: 'subtle', onClick: Object.assign(() => alert('Settings clicked!'), { __id__: 'btn-settings' }) },
              key: 'btn-2',
              children: [
                { type: 'String', props: { text: 'Settings' }, key: 's-7', children: [] },
              ],
            },
          ],
        },
      ],
    },
  ],
};

/** Form example — text fields, select, toggle, checkbox */
export const formExample: ForgeDoc = {
  type: 'App',
  props: {},
  key: 'root',
  children: [
    {
      type: 'Stack',
      props: { space: 'space.200' },
      key: 'form-stack',
      children: [
        {
          type: 'Heading',
          props: { size: 'large' },
          key: 'form-heading',
          children: [
            { type: 'String', props: { text: 'Create Issue' }, key: 'fs-1', children: [] },
          ],
        },
        {
          type: 'Stack',
          props: { space: 'space.150' },
          key: 'fields-stack',
          children: [
            {
              type: 'Text',
              props: {},
              key: 'label-summary',
              children: [
                { type: 'String', props: { text: 'Summary' }, key: 'fs-2', children: [] },
              ],
            },
            {
              type: 'TextField',
              props: { name: 'summary', placeholder: 'Enter issue summary...' },
              key: 'field-summary',
              children: [],
            },
            {
              type: 'Text',
              props: {},
              key: 'label-desc',
              children: [
                { type: 'String', props: { text: 'Description' }, key: 'fs-3', children: [] },
              ],
            },
            {
              type: 'TextArea',
              props: { name: 'description', placeholder: 'Describe the issue...' },
              key: 'field-desc',
              children: [],
            },
            {
              type: 'Text',
              props: {},
              key: 'label-priority',
              children: [
                { type: 'String', props: { text: 'Priority' }, key: 'fs-4', children: [] },
              ],
            },
            {
              type: 'Select',
              props: {
                options: [
                  { label: 'Highest', value: 'highest' },
                  { label: 'High', value: 'high' },
                  { label: 'Medium', value: 'medium' },
                  { label: 'Low', value: 'low' },
                  { label: 'Lowest', value: 'lowest' },
                ],
                placeholder: 'Select priority...',
              },
              key: 'field-priority',
              children: [],
            },
            {
              type: 'Inline',
              props: { space: 'space.200', alignBlock: 'center' },
              key: 'toggles',
              children: [
                {
                  type: 'Checkbox',
                  props: { name: 'assignToMe', label: 'Assign to me' },
                  key: 'cb-assign',
                  children: [],
                },
                {
                  type: 'Toggle',
                  props: { id: 'notify', isChecked: true },
                  key: 'toggle-notify',
                  children: [],
                },
                {
                  type: 'Text',
                  props: {},
                  key: 'toggle-label',
                  children: [
                    { type: 'String', props: { text: 'Send notifications' }, key: 'fs-5', children: [] },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'Inline',
          props: { space: 'space.100' },
          key: 'form-buttons',
          children: [
            {
              type: 'Button',
              props: { appearance: 'primary', onClick: Object.assign(() => alert('Create!'), { __id__: 'btn-create' }) },
              key: 'btn-create',
              children: [
                { type: 'String', props: { text: 'Create Issue' }, key: 'fs-6', children: [] },
              ],
            },
            {
              type: 'Button',
              props: { appearance: 'subtle', onClick: Object.assign(() => alert('Cancel'), { __id__: 'btn-cancel' }) },
              key: 'btn-cancel',
              children: [
                { type: 'String', props: { text: 'Cancel' }, key: 'fs-7', children: [] },
              ],
            },
          ],
        },
      ],
    },
  ],
};

/** Kitchen sink — tabs with various components */
export const kitchenSink: ForgeDoc = {
  type: 'App',
  props: {},
  key: 'root',
  children: [
    {
      type: 'Stack',
      props: { space: 'space.200' },
      key: 'ks-stack',
      children: [
        {
          type: 'Heading',
          props: { size: 'large' },
          key: 'ks-heading',
          children: [
            { type: 'String', props: { text: 'Component Kitchen Sink' }, key: 'ks-1', children: [] },
          ],
        },
        {
          type: 'Inline',
          props: { space: 'space.100' },
          key: 'ks-badges',
          children: [
            { type: 'Badge', props: { appearance: 'default' }, key: 'b1', children: [{ type: 'String', props: { text: '5' }, key: 'b1s', children: [] }] },
            { type: 'Badge', props: { appearance: 'primary' }, key: 'b2', children: [{ type: 'String', props: { text: '12' }, key: 'b2s', children: [] }] },
            { type: 'Badge', props: { appearance: 'important' }, key: 'b3', children: [{ type: 'String', props: { text: '99+' }, key: 'b3s', children: [] }] },
            { type: 'Badge', props: { appearance: 'added' }, key: 'b4', children: [{ type: 'String', props: { text: '3' }, key: 'b4s', children: [] }] },
          ],
        },
        {
          type: 'Inline',
          props: { space: 'space.100' },
          key: 'ks-lozenges',
          children: [
            { type: 'Lozenge', props: { appearance: 'success' }, key: 'l1', children: [{ type: 'String', props: { text: 'Done' }, key: 'l1s', children: [] }] },
            { type: 'Lozenge', props: { appearance: 'inprogress', isBold: true }, key: 'l2', children: [{ type: 'String', props: { text: 'In Progress' }, key: 'l2s', children: [] }] },
            { type: 'Lozenge', props: { appearance: 'new' }, key: 'l3', children: [{ type: 'String', props: { text: 'New' }, key: 'l3s', children: [] }] },
            { type: 'Lozenge', props: { appearance: 'removed' }, key: 'l4', children: [{ type: 'String', props: { text: 'Removed' }, key: 'l4s', children: [] }] },
            { type: 'Lozenge', props: { appearance: 'moved' }, key: 'l5', children: [{ type: 'String', props: { text: 'Moved' }, key: 'l5s', children: [] }] },
          ],
        },
        {
          type: 'TagGroup',
          props: {},
          key: 'ks-tags',
          children: [
            { type: 'Tag', props: { text: 'frontend', color: 'blue' }, key: 't1', children: [] },
            { type: 'Tag', props: { text: 'backend', color: 'green' }, key: 't2', children: [] },
            { type: 'Tag', props: { text: 'urgent', color: 'red' }, key: 't3', children: [] },
          ],
        },
        {
          type: 'Code',
          props: {},
          key: 'ks-code',
          children: [
            { type: 'String', props: { text: 'const sim = new ForgeSimulator()' }, key: 'c1', children: [] },
          ],
        },
        {
          type: 'CodeBlock',
          props: { text: 'import { ForgeSimulator } from "forge-sim";\n\nconst sim = new ForgeSimulator();\nawait sim.deploy("./my-app");\nconst doc = sim.getUI();', language: 'typescript' },
          key: 'ks-codeblock',
          children: [],
        },
        {
          type: 'ProgressBar',
          props: { value: 0.65 },
          key: 'ks-progress',
          children: [],
        },
        {
          type: 'Spinner',
          props: { size: 'large' },
          key: 'ks-spinner',
          children: [],
        },
      ],
    },
  ],
};

/** Charts demo — bar, line, pie, donut */
export const chartsDemo: ForgeDoc = {
  type: 'App',
  props: {},
  key: 'root',
  children: [
    {
      type: 'Stack',
      props: { space: 'space.300' },
      key: 'charts-stack',
      children: [
        {
          type: 'Heading',
          props: { size: 'large' },
          key: 'charts-heading',
          children: [
            { type: 'String', props: { text: 'Charts Gallery' }, key: 'ch-1', children: [] },
          ],
        },
        {
          type: 'BarChart',
          props: {
            title: 'Sprint Velocity',
            subtitle: 'Story points completed per sprint',
            data: [
              { sprint: 'Sprint 1', points: 21 },
              { sprint: 'Sprint 2', points: 34 },
              { sprint: 'Sprint 3', points: 28 },
              { sprint: 'Sprint 4', points: 42 },
              { sprint: 'Sprint 5', points: 38 },
            ],
            xAccessor: 'sprint',
            yAccessor: 'points',
            height: 300,
          },
          key: 'bar-chart',
          children: [],
        },
        {
          type: 'LineChart',
          props: {
            title: 'Bug Trend',
            subtitle: 'Open bugs over time',
            data: [
              { week: 'W1', bugs: 12 },
              { week: 'W2', bugs: 8 },
              { week: 'W3', bugs: 15 },
              { week: 'W4', bugs: 11 },
              { week: 'W5', bugs: 6 },
              { week: 'W6', bugs: 3 },
            ],
            xAccessor: 'week',
            yAccessor: 'bugs',
            height: 300,
          },
          key: 'line-chart',
          children: [],
        },
        {
          type: 'Inline',
          props: { space: 'space.200' },
          key: 'pie-row',
          children: [
            {
              type: 'PieChart',
              props: {
                title: 'Issue Types',
                data: [
                  { type: 'Bug', count: 23 },
                  { type: 'Story', count: 45 },
                  { type: 'Task', count: 18 },
                  { type: 'Epic', count: 7 },
                ],
                colorAccessor: 'type',
                valueAccessor: 'count',
                labelAccessor: 'type',
                height: 300,
                width: 380,
              },
              key: 'pie-chart',
              children: [],
            },
            {
              type: 'DonutChart',
              props: {
                title: 'Sprint Progress',
                data: [
                  { status: 'Done', points: 28 },
                  { status: 'In Progress', points: 12 },
                  { status: 'To Do', points: 8 },
                ],
                colorAccessor: 'status',
                valueAccessor: 'points',
                labelAccessor: 'status',
                height: 300,
                width: 380,
              },
              key: 'donut-chart',
              children: [],
            },
          ],
        },
      ],
    },
  ],
};

/** Table + data display demo */
export const tableDemo: ForgeDoc = {
  type: 'App',
  props: {},
  key: 'root',
  children: [
    {
      type: 'Stack',
      props: { space: 'space.200' },
      key: 'table-stack',
      children: [
        {
          type: 'Heading',
          props: { size: 'large' },
          key: 'table-heading',
          children: [
            { type: 'String', props: { text: 'Issue Tracker' }, key: 'th-1', children: [] },
          ],
        },
        {
          type: 'Inline',
          props: { space: 'space.100', alignBlock: 'center' },
          key: 'table-header-row',
          children: [
            {
              type: 'ProgressTracker',
              props: {
                items: [
                  { id: '1', label: 'Backlog', percentageComplete: 100, status: 'visited' },
                  { id: '2', label: 'In Progress', percentageComplete: 60, status: 'current' },
                  { id: '3', label: 'Review', percentageComplete: 0, status: 'unvisited' },
                  { id: '4', label: 'Done', percentageComplete: 0, status: 'unvisited' },
                ],
                label: 'Sprint progress',
              },
              key: 'progress-tracker',
              children: [],
            },
          ],
        },
        {
          type: 'Table',
          props: {},
          key: 'issue-table',
          children: [
            {
              type: 'Head',
              props: {},
              key: 'thead',
              children: [
                { type: 'Cell', props: {}, key: 'th-key', children: [{ type: 'String', props: { text: 'Key' }, key: 'th-k-s', children: [] }] },
                { type: 'Cell', props: {}, key: 'th-summary', children: [{ type: 'String', props: { text: 'Summary' }, key: 'th-s-s', children: [] }] },
                { type: 'Cell', props: {}, key: 'th-status', children: [{ type: 'String', props: { text: 'Status' }, key: 'th-st-s', children: [] }] },
                { type: 'Cell', props: {}, key: 'th-priority', children: [{ type: 'String', props: { text: 'Priority' }, key: 'th-p-s', children: [] }] },
              ],
            },
            {
              type: 'Row', props: {}, key: 'row-1',
              children: [
                { type: 'Cell', props: {}, key: 'r1c1', children: [{ type: 'Link', props: { href: '#' }, key: 'r1-link', children: [{ type: 'String', props: { text: 'PROJ-101' }, key: 'r1c1s', children: [] }] }] },
                { type: 'Cell', props: {}, key: 'r1c2', children: [{ type: 'String', props: { text: 'Fix login redirect loop' }, key: 'r1c2s', children: [] }] },
                { type: 'Cell', props: {}, key: 'r1c3', children: [{ type: 'Lozenge', props: { appearance: 'inprogress', isBold: true }, key: 'r1-loz', children: [{ type: 'String', props: { text: 'In Progress' }, key: 'r1c3s', children: [] }] }] },
                { type: 'Cell', props: {}, key: 'r1c4', children: [{ type: 'Lozenge', props: { appearance: 'removed' }, key: 'r1-pri', children: [{ type: 'String', props: { text: 'Critical' }, key: 'r1c4s', children: [] }] }] },
              ],
            },
            {
              type: 'Row', props: {}, key: 'row-2',
              children: [
                { type: 'Cell', props: {}, key: 'r2c1', children: [{ type: 'Link', props: { href: '#' }, key: 'r2-link', children: [{ type: 'String', props: { text: 'PROJ-102' }, key: 'r2c1s', children: [] }] }] },
                { type: 'Cell', props: {}, key: 'r2c2', children: [{ type: 'String', props: { text: 'Add dark mode support' }, key: 'r2c2s', children: [] }] },
                { type: 'Cell', props: {}, key: 'r2c3', children: [{ type: 'Lozenge', props: { appearance: 'new' }, key: 'r2-loz', children: [{ type: 'String', props: { text: 'To Do' }, key: 'r2c3s', children: [] }] }] },
                { type: 'Cell', props: {}, key: 'r2c4', children: [{ type: 'Lozenge', props: { appearance: 'moved' }, key: 'r2-pri', children: [{ type: 'String', props: { text: 'Medium' }, key: 'r2c4s', children: [] }] }] },
              ],
            },
            {
              type: 'Row', props: {}, key: 'row-3',
              children: [
                { type: 'Cell', props: {}, key: 'r3c1', children: [{ type: 'Link', props: { href: '#' }, key: 'r3-link', children: [{ type: 'String', props: { text: 'PROJ-103' }, key: 'r3c1s', children: [] }] }] },
                { type: 'Cell', props: {}, key: 'r3c2', children: [{ type: 'String', props: { text: 'Upgrade React to v19' }, key: 'r3c2s', children: [] }] },
                { type: 'Cell', props: {}, key: 'r3c3', children: [{ type: 'Lozenge', props: { appearance: 'success', isBold: true }, key: 'r3-loz', children: [{ type: 'String', props: { text: 'Done' }, key: 'r3c3s', children: [] }] }] },
                { type: 'Cell', props: {}, key: 'r3c4', children: [{ type: 'Lozenge', props: { appearance: 'default' }, key: 'r3-pri', children: [{ type: 'String', props: { text: 'Low' }, key: 'r3c4s', children: [] }] }] },
              ],
            },
          ],
        },
        {
          type: 'Stack',
          props: { space: 'space.150' },
          key: 'file-section',
          children: [
            {
              type: 'Heading',
              props: { size: 'small' },
              key: 'file-heading',
              children: [
                { type: 'String', props: { text: 'Attachments' }, key: 'fh-1', children: [] },
              ],
            },
            {
              type: 'FileCard',
              props: { fileName: 'screenshot.png', fileSize: 245000, fileType: 'image/png', onDownload: Object.assign(() => alert('Download!'), { __id__: 'dl-1' }) },
              key: 'file-1',
              children: [],
            },
            {
              type: 'FileCard',
              props: { fileName: 'report.pdf', fileSize: 1230000, fileType: 'application/pdf', onDownload: Object.assign(() => alert('Download!'), { __id__: 'dl-2' }), onDelete: Object.assign(() => alert('Delete!'), { __id__: 'del-2' }) },
              key: 'file-2',
              children: [],
            },
            {
              type: 'FileCard',
              props: { fileName: 'broken-upload.zip', fileSize: 500000, fileType: 'application/zip', error: 'Upload failed: connection timeout' },
              key: 'file-3',
              children: [],
            },
            {
              type: 'FilePicker',
              props: { label: 'Add attachments', description: 'PNG, JPG, PDF up to 10MB' },
              key: 'file-picker',
              children: [],
            },
          ],
        },
      ],
    },
  ],
};

/** Tooltip isolation test */
export const tooltipTest: ForgeDoc = {
  type: 'App',
  props: {},
  key: 'root',
  children: [
    {
      type: 'Stack',
      props: { space: 'space.300' },
      key: 'stack-1',
      children: [
        {
          type: 'Heading',
          props: { size: 'medium' },
          key: 'heading-1',
          children: [
            { type: 'String', props: { text: 'Tooltip Test' }, key: 's-h1', children: [] },
          ],
        },
        {
          type: 'Tooltip',
          props: { content: 'Hello from tooltip!' },
          key: 'tooltip-1',
          children: [
            {
              type: 'Button',
              props: { appearance: 'primary' },
              key: 'tooltip-btn-1',
              children: [
                { type: 'String', props: { text: 'Hover me — basic tooltip' }, key: 's-tb1', children: [] },
              ],
            },
          ],
        },
        {
          type: 'Tooltip',
          props: { content: 'Positioned on the right', position: 'right' },
          key: 'tooltip-2',
          children: [
            {
              type: 'Button',
              props: { appearance: 'subtle' },
              key: 'tooltip-btn-2',
              children: [
                { type: 'String', props: { text: 'Hover me — right position' }, key: 's-tb2', children: [] },
              ],
            },
          ],
        },
        {
          type: 'Inline',
          props: { space: 'space.100' },
          key: 'inline-tooltips',
          children: [
            {
              type: 'Tooltip',
              props: { content: 'First button' },
              key: 'tooltip-3',
              children: [
                {
                  type: 'Button',
                  props: { appearance: 'default' },
                  key: 'tooltip-btn-3',
                  children: [
                    { type: 'String', props: { text: 'Button A' }, key: 's-tb3', children: [] },
                  ],
                },
              ],
            },
            {
              type: 'Tooltip',
              props: { content: 'Second button' },
              key: 'tooltip-4',
              children: [
                {
                  type: 'Button',
                  props: { appearance: 'default' },
                  key: 'tooltip-btn-4',
                  children: [
                    { type: 'String', props: { text: 'Button B' }, key: 's-tb4', children: [] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

export const ALL_SAMPLES: Record<string, ForgeDoc> = {
  'Issue Panel': issuePanel,
  'Create Form': formExample,
  'Kitchen Sink': kitchenSink,
  'Charts': chartsDemo,
  'Table & Files': tableDemo,
  'Tooltip Test': tooltipTest,
};
