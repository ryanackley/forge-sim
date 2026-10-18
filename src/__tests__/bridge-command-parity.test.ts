/**
 * Legacy browser command table — kept only while the UI Kit renderer shim
 * still runs on src/bridge-commands.ts. The protocol
 * (src/bridge/protocol) is canonical and tested in bridge-protocol.test.ts.
 *
 * What this still guards:
 *  1. the renderer mirror stays byte-identical to src/bridge-commands.ts,
 *  2. the legacy table names EXACTLY the protocol's commands, so the two
 *     cannot drift while both exist,
 *  3. the UI Kit shim has a case for every local command.
 *
 * TODO(bridge-consolidation): delete this file, src/bridge-commands.ts,
 * renderer/src/bridge/bridge-commands.ts and the mirror sync script when the
 * UI Kit dev entry loads dist/bridge.js like Custom UI now does.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  BRIDGE_COMMANDS,
  translateBridgeCommand,
  bridgeNotImplementedError,
  type BridgeCallContext,
} from '../bridge-commands.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

// ── 1. Legacy browser registry == protocol registry ────────────────────

import { BRIDGE_COMMANDS as PROTOCOL_COMMANDS } from '../bridge/protocol/index.js';

describe('legacy browser registry mirrors the protocol registry', () => {
  it('names exactly the same commands', () => {
    expect(Object.keys(BRIDGE_COMMANDS).sort()).toEqual(Object.keys(PROTOCOL_COMMANDS).sort());
  });
  it('agrees on which commands are unsupported', () => {
    const legacy = Object.entries(BRIDGE_COMMANDS).filter(([, v]) => v.disposition === 'unsupported').map(([k]) => k).sort();
    const proto = Object.entries(PROTOCOL_COMMANDS).filter(([, v]) => v.unsupported !== undefined).map(([k]) => k).sort();
    expect(legacy).toEqual(proto);
  });
});

// ── 2. Renderer mirror ─────────────────────────────────────────────────

describe('renderer mirror', () => {
  it('is byte-identical to the canonical file below the header', () => {
    const canonical = readFileSync(join(REPO_ROOT, 'src/bridge-commands.ts'), 'utf8');
    const mirror = readFileSync(join(REPO_ROOT, 'renderer/src/bridge/bridge-commands.ts'), 'utf8');
    const MARKER = '/** What a host is expected to do with a command. */';
    expect(mirror.slice(mirror.indexOf(MARKER))).toBe(canonical.slice(canonical.indexOf(MARKER)));
  });
});

// ── 4. Every command is answered or deliberately declined, per host ─────

/** Case labels in a `switch (cmd)` block, read from a host's source. */
function casesIn(file: string, from: string, to: string): Set<string> {
  const src = readFileSync(join(REPO_ROOT, file), 'utf8');
  const start = src.indexOf(from);
  expect(start, `anchor not found in ${file}: ${from}`).toBeGreaterThan(-1);
  const body = src.slice(start, to ? src.indexOf(to, start) : undefined);
  return new Set([...body.matchAll(/case '([A-Za-z][A-Za-z0-9]*)'/g)].map((m) => m[1]));
}

const RPC_COMMANDS = Object.entries(BRIDGE_COMMANDS)
  .filter(([, s]) => s.disposition === 'rpc').map(([k]) => k);
const LOCAL_COMMANDS = Object.entries(BRIDGE_COMMANDS)
  .filter(([, s]) => s.disposition === 'local').map(([k]) => k);

describe('host coverage', () => {
  it('every rpc command is translated by the shared table', () => {
    for (const cmd of RPC_COMMANDS) {
      expect(translateBridgeCommand(cmd, {}, {}), `${cmd} is declared 'rpc' but translates to null`).not.toBeNull();
    }
  });

  it('no local or unsupported command is translated by the table', () => {
    for (const cmd of [...LOCAL_COMMANDS, ...Object.keys(BRIDGE_COMMANDS).filter((k) => BRIDGE_COMMANDS[k].disposition === 'unsupported')]) {
      if (cmd === 'invoke') continue;
      expect(translateBridgeCommand(cmd, {}, {}), `${cmd} should not produce an RPC call`).toBeNull();
    }
  });

  it('unsupported commands have an actionable message (never a silent no-op)', () => {
    for (const [cmd, spec] of Object.entries(BRIDGE_COMMANDS)) {
      if (spec.disposition !== 'unsupported') continue;
      expect(spec.notImplemented, `${cmd} is 'unsupported' but has no notImplemented reason`).toBeTruthy();
      expect(bridgeNotImplementedError(cmd).message).toContain(cmd);
    }
  });

  it('every local command still has a case in the UI Kit shim', () => {
    // The Custom UI column is gone with the inline script: that surface now
    // runs the shared browser host, where completeness is a type error.
    // The UI Kit shim is the last hand-written switch; it goes in the next
    // slice, and until then this keeps it honest.
    const shim = casesIn('renderer/src/bridge/forge-bridge-shim.ts', 'async function callBridge(', '\n// ──');
    const missing = LOCAL_COMMANDS.filter((c) => !shim.has(c));
    expect(missing).toEqual([]);
  });
});
