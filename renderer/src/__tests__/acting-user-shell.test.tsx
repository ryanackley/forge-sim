/**
 * ForgeSimShell — "Acting as" gear switcher (mode-aware).
 *
 * The renderer never imports the seeded roster from forge-sim's src (separate
 * Vite package). It fetches switcher state over the `getActingUserState` RPC
 * and searches over `searchUsers`. These tests mock that RPC channel and
 * assert the two visible contracts:
 *   - offline mode lists an "Acting as" searchable picker seeded with the
 *     current user, and (connected) shows the live-search site hint
 *   - the headless / MCP path (no dev server → the RPC rejects) hides the
 *     whole section while the rest of the gear menu still renders
 *
 * We drive the RPC by spying on the shim's `rpc` export — the same
 * interception point macro-inline-config-shell.test.tsx uses for `view.submit`.
 * The AsyncSelect only fetches option lists on async menu-open, so these stay
 * deliberately light: they assert the section chrome + current value, not the
 * dropdown contents (searchUsers is covered by the dev-server tests).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { ForgeSimShell } from '../ForgeSimShell';
import * as bridgeShim from '../bridge/forge-bridge-shim';

// Atlaskit editor-core needs browser APIs jsdom lacks — stub as the other
// shell tests do.
vi.mock('../editors/ForgeEditors', () => ({
  ForgeChromelessEditor: () => <div data-testid="chromeless-editor" />,
  ForgeCommentEditor: () => <div data-testid="comment-editor" />,
}));

const ROSTER = [
  { accountId: 'sim-user-001', displayName: 'Ryan Ackley', emailAddress: 'ryan@example.com', role: 'Lead' },
  { accountId: 'sim-user-002', displayName: 'Nyx Sable', emailAddress: 'nyx@example.com', role: 'Engineer' },
  { accountId: 'sim-user-003', displayName: 'Diego Santos', emailAddress: 'diego@example.com', role: 'Engineer' },
  { accountId: 'sim-user-004', displayName: 'Priya Nair', emailAddress: 'priya@example.com', role: 'Designer' },
  { accountId: 'sim-user-005', displayName: 'Sam Whitfield', emailAddress: 'sam@example.com', role: 'PM' },
];

/**
 * Mock the shim `rpc` export. `state` is what `getActingUserState` resolves to
 * (pass `null` / undefined to simulate the headless path where the RPC
 * rejects). All other RPCs (getContext via fetchModuleType, searchUsers)
 * resolve benignly so nothing hangs on a non-existent websocket.
 */
function mockRpc(state: any, opts: { reject?: boolean } = {}) {
  return vi.spyOn(bridgeShim, 'rpc').mockImplementation(async (method: string) => {
    if (method === 'getActingUserState') {
      if (opts.reject) throw new Error('no dev server');
      return state;
    }
    if (method === 'searchUsers') return { users: state?.users ?? [] };
    // getContext, setActingUser, anything else → benign.
    return {};
  });
}

const G = globalThis as any;

// The shell only renders its chrome (gear included) once a ForgeDoc arrives on
// the reconcile stream — until then it shows "Loading Forge app...". Drive a
// minimal view tree through the bridge to get past that gate, exactly as the
// macro-inline-config-shell test does.
function reconcileMinimalDoc() {
  G.__bridge.callBridge('reconcile', {
    forgeDoc: {
      type: 'Root',
      props: {},
      children: [{ type: 'String', props: { text: 'app view' }, children: [], key: 's' }],
      key: 'root',
    },
  });
}

function resetShimState() {
  if (!G.__forgeSim) return;
  G.__forgeSim.reconcileListeners.length = 0;
  G.__forgeSim.macroConfigReconcileListeners.length = 0;
  G.__forgeSim.lastForgeDoc = null;
  G.__forgeSim.lastMacroConfigDoc = null;
  G.__forgeSim.activeSubmitTree = 'view';
}

async function openGear() {
  const gear = await screen.findByLabelText('forge-sim settings');
  await act(async () => {
    fireEvent.click(gear);
  });
}

describe('ForgeSimShell — Acting as switcher', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetShimState();
    try {
      window.localStorage.clear();
    } catch {
      /* ignore */
    }
  });

  it('offline: shows the Acting-as picker seeded with the current user', async () => {
    mockRpc({
      mode: 'offline',
      current: ROSTER[0], // Ryan Ackley
      users: ROSTER,
      site: null,
    });

    await act(async () => {
      render(<ForgeSimShell />);
    });
    await act(async () => {
      reconcileMinimalDoc();
    });
    await openGear();

    // Section header + a searchable combobox (the AsyncSelect) are present.
    expect(screen.getByText('Acting as')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();

    // The current user is rendered as the select's value (via formatOptionLabel).
    expect(screen.getAllByText('Ryan Ackley').length).toBeGreaterThan(0);

    // Offline mode has no "live users from <site>" hint.
    expect(screen.queryByText(/Live users from/)).toBeNull();
  });

  it('connected: shows the live-search site hint', async () => {
    mockRpc({
      mode: 'connected',
      current: { accountId: 'real-pat-owner', displayName: 'PAT Owner' },
      users: [],
      site: 'benryantest.atlassian.net',
    });

    await act(async () => {
      render(<ForgeSimShell />);
    });
    await act(async () => {
      reconcileMinimalDoc();
    });
    await openGear();

    expect(screen.getByText('Acting as')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    // The connected mode surfaces where the live users come from.
    expect(screen.getByText(/Live users from benryantest\.atlassian\.net/)).toBeInTheDocument();
  });

  it('hides the Acting-as section on the headless / MCP path (no dev server)', async () => {
    mockRpc(null, { reject: true });

    await act(async () => {
      render(<ForgeSimShell />);
    });
    await act(async () => {
      reconcileMinimalDoc();
    });
    await openGear();

    // The getActingUserState RPC rejected → switcher stays null → the whole
    // section is a graceful no-op, but the rest of the gear menu still renders.
    expect(screen.queryByText('Acting as')).toBeNull();
    expect(screen.getByText('Color mode')).toBeInTheDocument();
  });
});
