/**
 * ForgeDoc fixtures for Playwright e2e tests.
 *
 * These mirror real @forge/react reconciler output — specifically the
 * ContentWrapper/Row/Cell decomposition that components like DynamicTable
 * produce. If you're adding a new component test, add its fixture here.
 */

import type { ForgeDoc } from './types';

// ── DynamicTable ────────────────────────────────────────────────────────
// Mimics what @forge/react's DynamicTable produces after reconciliation:
//   DynamicTable → ContentWrapper(head) → Cell nodes
//                → ContentWrapper(rows) → Row → Cell nodes

export const dynamicTableBasic: ForgeDoc = {
  type: 'App',
  props: {},
  key: 'root',
  children: [
    {
      type: 'DynamicTable',
      props: { rowsPerPage: 10 },
      key: 'dt-1',
      children: [
        {
          // Head cells wrapped in ContentWrapper (Forge's reconciliation pattern)
          type: 'ContentWrapper',
          props: { name: 'head' },
          key: 'dt-head',
          children: [
            {
              type: 'Cell',
              props: { cellKey: 'key' },
              key: 'hc-key',
              children: [
                { type: 'String', props: { text: 'Key' }, key: 'hc-key-s', children: [] },
              ],
            },
            {
              type: 'Cell',
              props: { cellKey: 'summary' },
              key: 'hc-summary',
              children: [
                { type: 'String', props: { text: 'Summary' }, key: 'hc-summary-s', children: [] },
              ],
            },
            {
              type: 'Cell',
              props: { cellKey: 'status' },
              key: 'hc-status',
              children: [
                { type: 'String', props: { text: 'Status' }, key: 'hc-status-s', children: [] },
              ],
            },
            {
              type: 'Cell',
              props: { cellKey: 'actions' },
              key: 'hc-actions',
              children: [
                { type: 'String', props: { text: 'Actions' }, key: 'hc-actions-s', children: [] },
              ],
            },
          ],
        },
        {
          // Rows wrapped in ContentWrapper
          type: 'ContentWrapper',
          props: { name: 'rows' },
          key: 'dt-rows',
          children: [
            {
              type: 'Row',
              props: { rowKey: 'PROJ-1' },
              key: 'row-1',
              children: [
                {
                  type: 'Cell',
                  props: { cellKey: 'key' },
                  key: 'r1c-key',
                  children: [
                    { type: 'Text', props: {}, key: 'r1c-key-t', children: [
                      { type: 'String', props: { text: 'PROJ-1' }, key: 'r1c-key-s', children: [] },
                    ]},
                  ],
                },
                {
                  type: 'Cell',
                  props: { cellKey: 'summary' },
                  key: 'r1c-summary',
                  children: [
                    { type: 'Text', props: {}, key: 'r1c-sum-t', children: [
                      { type: 'String', props: { text: 'Fix login redirect loop' }, key: 'r1c-sum-s', children: [] },
                    ]},
                  ],
                },
                {
                  type: 'Cell',
                  props: { cellKey: 'status' },
                  key: 'r1c-status',
                  children: [
                    {
                      type: 'Lozenge',
                      props: { appearance: 'inprogress', isBold: true },
                      key: 'r1c-loz',
                      children: [
                        { type: 'String', props: { text: 'In Progress' }, key: 'r1c-loz-s', children: [] },
                      ],
                    },
                  ],
                },
                {
                  type: 'Cell',
                  props: { cellKey: 'actions' },
                  key: 'r1c-actions',
                  children: [
                    {
                      type: 'Button',
                      props: { appearance: 'subtle', onClick: '__fn__:edit-PROJ-1' },
                      key: 'r1-btn-edit',
                      children: [
                        { type: 'String', props: { text: 'Edit' }, key: 'r1-btn-edit-s', children: [] },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: 'Row',
              props: { rowKey: 'PROJ-2' },
              key: 'row-2',
              children: [
                {
                  type: 'Cell',
                  props: { cellKey: 'key' },
                  key: 'r2c-key',
                  children: [
                    { type: 'Text', props: {}, key: 'r2c-key-t', children: [
                      { type: 'String', props: { text: 'PROJ-2' }, key: 'r2c-key-s', children: [] },
                    ]},
                  ],
                },
                {
                  type: 'Cell',
                  props: { cellKey: 'summary' },
                  key: 'r2c-summary',
                  children: [
                    { type: 'Text', props: {}, key: 'r2c-sum-t', children: [
                      { type: 'String', props: { text: 'Add dark mode support' }, key: 'r2c-sum-s', children: [] },
                    ]},
                  ],
                },
                {
                  type: 'Cell',
                  props: { cellKey: 'status' },
                  key: 'r2c-status',
                  children: [
                    {
                      type: 'Lozenge',
                      props: { appearance: 'success', isBold: true },
                      key: 'r2c-loz',
                      children: [
                        { type: 'String', props: { text: 'Done' }, key: 'r2c-loz-s', children: [] },
                      ],
                    },
                  ],
                },
                {
                  type: 'Cell',
                  props: { cellKey: 'actions' },
                  key: 'r2c-actions',
                  children: [
                    {
                      type: 'Button',
                      props: { appearance: 'subtle', onClick: '__fn__:edit-PROJ-2' },
                      key: 'r2-btn-edit',
                      children: [
                        { type: 'String', props: { text: 'Edit' }, key: 'r2-btn-edit-s', children: [] },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: 'Row',
              props: { rowKey: 'PROJ-3' },
              key: 'row-3',
              children: [
                {
                  type: 'Cell',
                  props: { cellKey: 'key' },
                  key: 'r3c-key',
                  children: [
                    { type: 'Text', props: {}, key: 'r3c-key-t', children: [
                      { type: 'String', props: { text: 'PROJ-3' }, key: 'r3c-key-s', children: [] },
                    ]},
                  ],
                },
                {
                  type: 'Cell',
                  props: { cellKey: 'summary' },
                  key: 'r3c-summary',
                  children: [
                    { type: 'Text', props: {}, key: 'r3c-sum-t', children: [
                      { type: 'String', props: { text: 'Upgrade dependencies' }, key: 'r3c-sum-s', children: [] },
                    ]},
                  ],
                },
                {
                  type: 'Cell',
                  props: { cellKey: 'status' },
                  key: 'r3c-status',
                  children: [
                    {
                      type: 'Lozenge',
                      props: { appearance: 'new' },
                      key: 'r3c-loz',
                      children: [
                        { type: 'String', props: { text: 'To Do' }, key: 'r3c-loz-s', children: [] },
                      ],
                    },
                  ],
                },
                {
                  type: 'Cell',
                  props: { cellKey: 'actions' },
                  key: 'r3c-actions',
                  children: [
                    {
                      type: 'Button',
                      props: { appearance: 'subtle', onClick: '__fn__:edit-PROJ-3' },
                      key: 'r3-btn-edit',
                      children: [
                        { type: 'String', props: { text: 'Edit' }, key: 'r3-btn-edit-s', children: [] },
                      ],
                    },
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

// ── Empty DynamicTable ──────────────────────────────────────────────────

export const dynamicTableEmpty: ForgeDoc = {
  type: 'App',
  props: {},
  key: 'root',
  children: [
    {
      type: 'DynamicTable',
      props: { isLoading: false },
      key: 'dt-empty',
      children: [
        {
          type: 'ContentWrapper',
          props: { name: 'head' },
          key: 'dt-empty-head',
          children: [
            {
              type: 'Cell',
              props: { cellKey: 'name' },
              key: 'ehc-name',
              children: [
                { type: 'String', props: { text: 'Name' }, key: 'ehc-name-s', children: [] },
              ],
            },
            {
              type: 'Cell',
              props: { cellKey: 'value' },
              key: 'ehc-value',
              children: [
                { type: 'String', props: { text: 'Value' }, key: 'ehc-value-s', children: [] },
              ],
            },
          ],
        },
        {
          type: 'ContentWrapper',
          props: { name: 'rows' },
          key: 'dt-empty-rows',
          children: [],
        },
      ],
    },
  ],
};

// ── Loading DynamicTable ────────────────────────────────────────────────

export const dynamicTableLoading: ForgeDoc = {
  type: 'App',
  props: {},
  key: 'root',
  children: [
    {
      type: 'DynamicTable',
      props: { isLoading: true },
      key: 'dt-loading',
      children: [
        {
          type: 'ContentWrapper',
          props: { name: 'head' },
          key: 'dt-loading-head',
          children: [
            {
              type: 'Cell',
              props: { cellKey: 'col1' },
              key: 'lhc-1',
              children: [
                { type: 'String', props: { text: 'Column 1' }, key: 'lhc-1-s', children: [] },
              ],
            },
          ],
        },
        {
          type: 'ContentWrapper',
          props: { name: 'rows' },
          key: 'dt-loading-rows',
          children: [],
        },
      ],
    },
  ],
};

// ── Fixture registry ────────────────────────────────────────────────────

export const TEST_FIXTURES: Record<string, ForgeDoc> = {
  'dynamic-table-basic': dynamicTableBasic,
  'dynamic-table-empty': dynamicTableEmpty,
  'dynamic-table-loading': dynamicTableLoading,
};
