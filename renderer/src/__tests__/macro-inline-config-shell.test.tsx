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
