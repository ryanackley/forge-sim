/**
 * Browser-side bridge table checks, kept while the two browser hosts still
 * run on src/bridge-commands.ts. The protocol (src/bridge/protocol) is now
 * canonical and tested in bridge-protocol.test.ts; until the browser host is
 * rebuilt on it, this suite:
 *
 *  1. keeps the renderer mirror byte-identical to src/bridge-commands.ts,
 *  2. proves translateBridgeCommand survives `.toString()` embedding into the
 *     Custom UI inline script (no module references) and that script parses,
 *  3. asserts the legacy browser registry names EXACTLY the protocol's
 *     commands, so the two cannot drift while both exist.
 *
 * TODO(bridge-consolidation): delete this file, src/bridge-commands.ts and
 * renderer/src/bridge/bridge-commands.ts when the browser host is served
 * from dist/bridge.js.
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

// ── 3. The `.toString()` embedding used by the Custom UI inline script ──

const FRAMES: Array<{ cmd: string; data: any; ctx: BridgeCallContext }> = [
  { cmd: 'invoke', data: { functionKey: 'getText', payload: { a: 1 } }, ctx: { moduleKey: 'panel', contextOptions: { x: 1 } } },
  { cmd: 'invoke', data: { invokeType: 'ui-remote-fetch', path: '/items', method: 'GET', headers: [['a', 'b']] }, ctx: { moduleKey: 'panel' } },
  { cmd: 'fetchProduct', data: { product: 'jira', restPath: '/rest/api/3/myself', fetchRequestInit: { method: 'GET' } }, ctx: {} },
  { cmd: 'fetchRemote', data: { remoteKey: 'r', fetchRequestInit: { path: '/e', method: 'POST' } }, ctx: {} },
  { cmd: 'getContext', data: undefined, ctx: { moduleKey: 'panel', contextOptions: { y: 2 } } },
  { cmd: 'submit', data: { field: 1 }, ctx: { moduleKey: 'cf', submitTree: 'macroConfig' } },
  { cmd: 'close', data: { ok: true }, ctx: {} },
  { cmd: 'publishRealtimeChannel', data: { channelName: 'c', eventPayload: { n: 1 }, options: { token: 't' } }, ctx: { moduleKey: 'panel', contextOptions: { z: 3 } } },
  { cmd: 'publishRealtimeChannel', data: { channelName: 'c', eventPayload: 'hi', isGlobal: true }, ctx: { moduleKey: 'panel' } },
  { cmd: 'showFlag', data: { id: 'f' }, ctx: {} },   // local → null
  { cmd: 'nonsense', data: {}, ctx: {} },            // unknown → null
];

describe('translateBridgeCommand is embeddable in the Custom UI inline script', () => {
  /** Rebuild the function from its source alone, as the inline script does. */
  const embedded = new Function(`return (${translateBridgeCommand.toString()});`)() as typeof translateBridgeCommand;

  it('produces identical RPC calls to the canonical function', () => {
    for (const { cmd, data, ctx } of FRAMES) {
      expect(embedded(cmd, data, ctx), `frame: ${cmd}`).toEqual(translateBridgeCommand(cmd, data, ctx));
    }
  });

  it('throws the same way for invokeService (ui-container-fetch)', () => {
    const frame = () => embedded('invoke', { invokeType: 'ui-container-fetch' }, {});
    expect(frame).toThrow(/invokeService is not yet implemented/);
    expect(() => translateBridgeCommand('invoke', { invokeType: 'ui-container-fetch' }, {})).toThrow(/invokeService is not yet implemented/);
  });

  it('is actually embedded in the generated inline script, and that script parses', async () => {
    const { generateBridgeInlineScript } = await import('../dev-command.js');
    const script = generateBridgeInlineScript(5174);
    expect(script).toContain('translateBridgeCommand');
    expect(script).toContain('BRIDGE_DISPOSITIONS');
    // The browser would throw on a syntax error; catch it here instead.
    expect(() => new Function(script)).not.toThrow();
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

  it('documents, per local command, which BROWSER host implements it', () => {
    // Headless is no longer in this table: it implements the typed BridgeHost
    // interface, so a missing method is a compile error, not a snapshot diff.
    const shim = casesIn('renderer/src/bridge/forge-bridge-shim.ts', 'async function callBridge(', '\n// ──');
    const inline = casesIn('src/dev-command.ts', 'function callBridge(cmd, data) {', 'window.__bridge = {');
    const coverage = Object.fromEntries(
      LOCAL_COMMANDS.map((c) => [c, [shim.has(c) && 'shim', inline.has(c) && 'inline'].filter(Boolean).join(',') || 'NONE']),
    );
    expect(coverage).toMatchInlineSnapshot(`
      {
        "changeWindowTitle": "shim,inline",
        "closeFlag": "shim,inline",
        "createHistory": "shim,inline",
        "emit": "shim,inline",
        "emitFrontendCustomMetric": "shim,inline",
        "emitPublic": "shim,inline",
        "emitReadyEvent": "shim,inline",
        "enableTheming": "shim,inline",
        "getFrameId": "shim,inline",
        "getUrl": "shim,inline",
        "initFeatureFlags": "shim,inline",
        "isRovoEnabled": "shim,inline",
        "navigate": "shim,inline",
        "on": "shim,inline",
        "onClose": "shim",
        "onError": "shim",
        "onPublic": "shim,inline",
        "open": "shim,inline",
        "openModal": "shim",
        "reconcile": "shim,inline",
        "refresh": "shim,inline",
        "reload": "shim,inline",
        "showFlag": "shim,inline",
        "subscribeRealtimeChannel": "shim,inline",
        "trackObjectStoreAction": "shim",
      }
    `);
  });
});
