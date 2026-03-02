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

export const ALL_SAMPLES: Record<string, ForgeDoc> = {
  'Issue Panel': issuePanel,
  'Create Form': formExample,
  'Kitchen Sink': kitchenSink,
};
