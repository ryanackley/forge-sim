/**
 * ForgeSimShell tests for macro inline config tabs.
 *
 * The shell listens for both reconcile streams from the bridge:
 *   - main view tree (ForgeReconciler.render)
 *   - macro config tree (ForgeReconciler.addConfig)
 *
 * When both arrive, the shell renders View/Config tabs above the renderer
 * and switches which doc is mounted based on the active tab. Switching to
 * the Config tab also flips the bridge's activeSubmitTree so the next
 * view.submit() is tagged correctly.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { ForgeSimShell } from '../ForgeSimShell';
import * as bridgeShim from '../bridge/forge-bridge-shim';

// Mock the editors — Atlaskit editor-core requires browser APIs jsdom lacks
vi.mock('../editors/ForgeEditors', () => ({
  ForgeChromelessEditor: () => <div data-testid="chromeless-editor" />,
  ForgeCommentEditor: () => <div data-testid="comment-editor" />,
}));

const G = globalThis as any;

function callBridge(cmd: string, data: any) {
  return G.__bridge.callBridge(cmd, data);
}

function resetShimState() {
  if (!G.__forgeSim) return;
  G.__forgeSim.reconcileListeners.length = 0;
  G.__forgeSim.macroConfigReconcileListeners.length = 0;
  G.__forgeSim.lastForgeDoc = null;
  G.__forgeSim.lastMacroConfigDoc = null;
  G.__forgeSim.activeSubmitTree = 'view';
}

describe('ForgeSimShell — macro inline config tabs', () => {
  beforeEach(() => {
    resetShimState();
  });

  it('does NOT show tabs when only the main view tree is reconciled', async () => {
    render(<ForgeSimShell />);

    await act(async () => {
      callBridge('reconcile', {
        forgeDoc: {
          type: 'Root',
          props: {},
          children: [{ type: 'String', props: { text: 'just the view' }, children: [], key: 's' }],
          key: 'root',
        },
      });
    });

    expect(screen.getByText('just the view')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Config' })).toBeNull();
  });

  it('shows View/Config tabs when MacroConfig tree is reconciled', async () => {
    render(<ForgeSimShell />);

    await act(async () => {
      callBridge('reconcile', {
        forgeDoc: {
          type: 'Root',
          props: {},
          children: [{ type: 'String', props: { text: 'main view' }, children: [], key: 'a' }],
          key: 'root',
        },
      });
      callBridge('reconcile', {
        forgeDoc: {
          type: 'MacroConfig',
          props: {},
          children: [{ type: 'String', props: { text: 'config form' }, children: [], key: 'b' }],
          key: 'cfg',
        },
      });
    });

    expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Config' })).toBeInTheDocument();
    // View tab is active by default → main view content renders, config doesn't
    expect(screen.getByText('main view')).toBeInTheDocument();
    expect(screen.queryByText('config form')).toBeNull();
  });

  it('clicking Config switches the rendered tree and flips activeSubmitTree', async () => {
    render(<ForgeSimShell />);

    await act(async () => {
      callBridge('reconcile', {
        forgeDoc: {
          type: 'Root',
          props: {},
          children: [{ type: 'String', props: { text: 'view-x' }, children: [], key: 'a' }],
          key: 'root',
        },
      });
      callBridge('reconcile', {
        forgeDoc: {
          type: 'MacroConfig',
          props: {},
          children: [{ type: 'String', props: { text: 'config-x' }, children: [], key: 'b' }],
          key: 'cfg',
        },
      });
    });

    // Pre-click: view tree is active
    expect(screen.getByText('view-x')).toBeInTheDocument();
    expect(G.__forgeSim.activeSubmitTree).toBe('view');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Config' }));
    });

    expect(screen.getByText('config-x')).toBeInTheDocument();
    expect(screen.queryByText('view-x')).toBeNull();
    expect(G.__forgeSim.activeSubmitTree).toBe('macroConfig');

    // Switch back
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'View' }));
    });

    expect(screen.getByText('view-x')).toBeInTheDocument();
    expect(G.__forgeSim.activeSubmitTree).toBe('view');
  });
});

describe('ForgeSimShell — inline config Save/Cancel chrome', () => {
  beforeEach(() => {
    resetShimState();
    // Stub the ws-backed view.submit RPC so save() resolves cleanly
    G.__forgeSim.lastSubmitPayload = null;
    G.__forgeSim.callBridgeSpy = null;
  });

  function reconcileBoth(viewChildren: any[], configChildren: any[]) {
    callBridge('reconcile', {
      forgeDoc: { type: 'Root', props: {}, children: viewChildren, key: 'root' },
    });
    callBridge('reconcile', {
      forgeDoc: { type: 'MacroConfig', props: {}, children: configChildren, key: 'cfg' },
    });
  }

  it('renders Save/Cancel buttons only on the Config tab', async () => {
    render(<ForgeSimShell />);
    await act(async () => {
      reconcileBoth(
        [{ type: 'String', props: { text: 'v' }, children: [], key: 'v' }],
        [{ type: 'Textfield', props: { name: 'age', defaultValue: '5' }, children: [], key: 'f' }],
      );
    });

    // On the View tab — no Save/Cancel
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();

    // Switch to Config — Save/Cancel appear inside a form
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Config' }));
    });

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(document.querySelector('[data-forge-sim-config-form]')).not.toBeNull();
  });

  it('Cancel returns to the View tab without submitting', async () => {
    const submitSpy = vi.spyOn(bridgeShim.view, 'submit').mockResolvedValue(undefined);
    try {
      render(<ForgeSimShell />);
      await act(async () => {
        reconcileBoth(
          [{ type: 'String', props: { text: 'v' }, children: [], key: 'v' }],
          [{ type: 'Textfield', props: { name: 'age', defaultValue: '5' }, children: [], key: 'f' }],
        );
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Config' }));
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      });

      expect(submitSpy).not.toHaveBeenCalled();
      // Should be back on the View tab
      expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    } finally {
      submitSpy.mockRestore();
    }
  });

  it('Save harvests defaults from the config tree and submits via macroConfig route', async () => {
    const submitSpy = vi.spyOn(bridgeShim.view, 'submit').mockResolvedValue(undefined);
    try {
      render(<ForgeSimShell />);
      await act(async () => {
        reconcileBoth(
          [{ type: 'String', props: { text: 'v' }, children: [], key: 'v' }],
          [
            // Two declared defaults: name + tier
            { type: 'Textfield', props: { name: 'name', defaultValue: 'Whiskers' }, children: [], key: 'n' },
            { type: 'Select',    props: { name: 'tier', defaultValue: 'gold' },     children: [], key: 't' },
          ],
        );
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Config' }));
      });

      // activeSubmitTree must be 'macroConfig' before Save fires
      expect(G.__forgeSim.activeSubmitTree).toBe('macroConfig');

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      });

      expect(submitSpy).toHaveBeenCalledTimes(1);
      // view.submit() receives the raw values map (no { payload } wrapping
      // when called directly — the bridge wraps it before sending).
      const values = submitSpy.mock.calls[0][0];
      // FormData picks up the Textfield's <input name="name" value="Whiskers">,
      // and Select's defaultValue is filled in by the tree-walk fallback.
      expect(values).toMatchObject({ name: 'Whiskers', tier: 'gold' });

      // Save returns to the View tab
      expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    } finally {
      submitSpy.mockRestore();
    }
  });

  it('logs a parity warning when the config tree contains non-FormData components', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(<ForgeSimShell />);
      await act(async () => {
        reconcileBoth(
          [{ type: 'String', props: { text: 'v' }, children: [], key: 'v' }],
          [
            { type: 'Select',     props: { name: 'tier', defaultValue: 'gold' }, children: [], key: 's' },
            { type: 'DatePicker', props: { name: 'date' },                       children: [], key: 'd' },
          ],
        );
      });

      const matched = warnSpy.mock.calls.some(
        (call) => String(call[0]).includes('inline macro config') && String(call[0]).includes('DatePicker'),
      );
      expect(matched).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
