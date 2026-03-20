/**
 * Tests for product-specific bridge shims:
 * - @forge/jira-bridge
 * - @forge/confluence-bridge
 * - @forge/dashboards-bridge
 *
 * These are all no-op stubs in forge-sim (no host product to talk to),
 * so the tests verify they export the right shapes and don't throw.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── @forge/jira-bridge ─────────────────────────────────────────────────

import {
  ViewIssueModal,
  CreateIssueModal,
  workflowRules,
  uiModificationsApi,
  customFieldApi,
  REQUEST_TYPE_CF_TYPE,
} from '../shims/forge-jira-bridge.js';

describe('@forge/jira-bridge', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('ViewIssueModal', () => {
    it('constructs with issueKey and opens without error', async () => {
      const onClose = vi.fn();
      const modal = new ViewIssueModal({ context: { issueKey: 'TEST-123' }, onClose });

      expect(modal.context.issueKey).toBe('TEST-123');
      expect(modal.onClose).toBe(onClose);
      await expect(modal.open()).resolves.toBeUndefined();
    });

    it('defaults onClose to a no-op', () => {
      const modal = new ViewIssueModal({ context: { issueKey: 'TEST-1' } });
      expect(typeof modal.onClose).toBe('function');
      modal.onClose(); // should not throw
    });
  });

  describe('CreateIssueModal', () => {
    it('constructs with options and opens without error', async () => {
      const onClose = vi.fn();
      const modal = new CreateIssueModal({
        context: { projectId: '10000', summary: 'Test' },
        onClose,
      });

      expect(modal.context.projectId).toBe('10000');
      expect(modal.onClose).toBe(onClose);
      await expect(modal.open()).resolves.toBeUndefined();
    });

    it('constructs with no arguments', async () => {
      const modal = new CreateIssueModal();
      expect(modal.context).toEqual({});
      await expect(modal.open()).resolves.toBeUndefined();
    });
  });

  describe('workflowRules', () => {
    it('onConfigure accepts a callback without error', async () => {
      const fn = vi.fn(() => 'config-key');
      await expect(workflowRules.onConfigure(fn)).resolves.toBeUndefined();
      // Callback is registered but never invoked (host-driven)
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('uiModificationsApi', () => {
    it('onInit accepts callbacks without error', async () => {
      const initCb = vi.fn();
      const registerCb = vi.fn(() => ['summary']);
      await expect(uiModificationsApi.onInit(initCb, registerCb)).resolves.toBeUndefined();
      expect(initCb).not.toHaveBeenCalled();
      expect(registerCb).not.toHaveBeenCalled();
    });

    it('onChange accepts callbacks without error', async () => {
      const changeCb = vi.fn();
      const registerCb = vi.fn(() => ['priority']);
      await expect(uiModificationsApi.onChange(changeCb, registerCb)).resolves.toBeUndefined();
      expect(changeCb).not.toHaveBeenCalled();
      expect(registerCb).not.toHaveBeenCalled();
    });

    it('onError accepts a callback without error', async () => {
      const errorCb = vi.fn();
      await expect(uiModificationsApi.onError(errorCb)).resolves.toBeUndefined();
      expect(errorCb).not.toHaveBeenCalled();
    });
  });

  describe('customFieldApi', () => {
    it('getFieldData accepts a callback without error', async () => {
      const cb = vi.fn();
      await expect(customFieldApi.getFieldData(cb)).resolves.toBeUndefined();
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('constants', () => {
    it('exports REQUEST_TYPE_CF_TYPE', () => {
      expect(REQUEST_TYPE_CF_TYPE).toBe('com.atlassian.servicedesk:vp-origin');
    });
  });
});

// ─── @forge/confluence-bridge ───────────────────────────────────────────

import {
  getEditorContent,
  getMacroContent,
  updateMacro,
  setMacroViewportHeight,
  updateBylineProperties,
} from '../shims/forge-confluence-bridge.js';

describe('@forge/confluence-bridge', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('getEditorContent returns empty ContentData', async () => {
    const result = await getEditorContent();
    expect(result).toEqual({ data: '' });
  });

  it('getMacroContent returns empty ContentData', async () => {
    const result = await getMacroContent();
    expect(result).toEqual({ data: '' });
  });

  it('updateMacro returns true', async () => {
    const result = await updateMacro({ data: '<p>hello</p>' });
    expect(result).toBe(true);
  });

  it('setMacroViewportHeight returns true', async () => {
    const result = await setMacroViewportHeight('500');
    expect(result).toBe(true);
  });

  it('updateBylineProperties resolves', async () => {
    await expect(
      updateBylineProperties({
        propertyKey: 'my-app',
        valueUpdate: { title: 'Status', icon: '🔥', tooltip: 'On fire' },
      }),
    ).resolves.toBeUndefined();
  });
});

// ─── @forge/dashboards-bridge ───────────────────────────────────────────

import { widgetEdit, widget } from '../shims/forge-dashboards-bridge.js';

describe('@forge/dashboards-bridge', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('widgetEdit', () => {
    it('onSave accepts a callback without error', async () => {
      const cb = vi.fn();
      await expect(widgetEdit.onSave(cb)).resolves.toBeUndefined();
      expect(cb).not.toHaveBeenCalled();
    });

    it('onProductSave accepts a callback without error', async () => {
      const cb = vi.fn();
      await expect(widgetEdit.onProductSave(cb)).resolves.toBeUndefined();
      expect(cb).not.toHaveBeenCalled();
    });

    it('onSaveError accepts a callback without error', async () => {
      const cb = vi.fn();
      await expect(widgetEdit.onSaveError(cb)).resolves.toBeUndefined();
      expect(cb).not.toHaveBeenCalled();
    });

    it('updateConfig resolves', async () => {
      await expect(widgetEdit.updateConfig({ theme: 'dark' })).resolves.toBeUndefined();
    });
  });

  describe('widget', () => {
    it('setPreviewConfig resolves', async () => {
      await expect(widget.setPreviewConfig({ refreshRate: 30 })).resolves.toBeUndefined();
    });
  });
});
