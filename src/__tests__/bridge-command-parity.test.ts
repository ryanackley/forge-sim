/**
 * The bridge seam has one command table (src/bridge-commands.ts) and three
 * hosts answering it. This suite is what keeps them from drifting:
 *
 *  1. The table covers every command the INSTALLED @forge/bridge and
 *     @forge/react can actually send — derived from their source, not from
 *     memory, so a version bump that adds a command fails here.
 *  2. The renderer mirror is byte-identical below its header.
 *  3. The translator survives `.toString()` embedding into the Custom UI
 *     inline script (no module references), and the embedded copy produces
 *     identical RPC calls to the canonical one.
 *  4. Each host handles, or deliberately declines, every command — no
 *     command is answered by one host and silently `undefined` from another.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  BRIDGE_COMMANDS,
  translateBridgeCommand,
  bridgeNotImplementedError,
  type BridgeCallContext,
} from '../bridge-commands.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

// ── 1. Table vs the real packages ──────────────────────────────────────

/** Every `callBridge('x', ...)` literal in a package's shipped JS. */
function commandsEmittedBy(pkgOutDir: string): Set<string> {
  const found = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (!entry.endsWith('.js')) continue;
      const src = readFileSync(full, 'utf8');
      for (const m of src.matchAll(/callBridge\)?\(\s*['"]([A-Za-z][A-Za-z0-9]*)['"]/g)) {
        found.add(m[1]);
      }
    }
  };
  walk(pkgOutDir);
  return found;
}

describe('bridge command table vs the installed @forge packages', () => {
  it('covers every command real @forge/bridge can send', () => {
    const emitted = commandsEmittedBy(join(REPO_ROOT, 'node_modules/@forge/bridge/out'));
    expect(emitted.size).toBeGreaterThan(20); // sanity: we actually scanned it
    const missing = [...emitted].filter((c) => !(c in BRIDGE_COMMANDS)).sort();
    expect(missing, `@forge/bridge sends these but src/bridge-commands.ts does not list them`).toEqual([]);
  });

  it('covers every command @forge/react can send', () => {
    const emitted = commandsEmittedBy(join(REPO_ROOT, 'node_modules/@forge/react/out'));
    const missing = [...emitted].filter((c) => !(c in BRIDGE_COMMANDS)).sort();
    expect(missing).toEqual([]);
  });

  it('lists no command the packages never send (no dead entries)', () => {
    const emitted = new Set([
      ...commandsEmittedBy(join(REPO_ROOT, 'node_modules/@forge/bridge/out')),
      ...commandsEmittedBy(join(REPO_ROOT, 'node_modules/@forge/react/out')),
    ]);
    const dead = Object.keys(BRIDGE_COMMANDS).filter((c) => !emitted.has(c)).sort();
    expect(dead, 'entries in the table that no installed @forge package emits').toEqual([]);
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

  it('documents, per local command, which hosts implement it', () => {
    // Local commands are DOM/state work, so each host implements what its
    // environment supports. This test does not demand uniformity — it records
    // the split, so a change to any host shows up as a diff here rather than
    // as a silent behaviour gap in one surface.
    const shim = casesIn('renderer/src/bridge/forge-bridge-shim.ts', 'async function callBridge(', '\n// ──');
    const inline = casesIn('src/dev-command.ts', 'function callBridge(cmd, data) {', 'window.__bridge = {');
    const headlessSrc = readFileSync(join(REPO_ROOT, 'src/ui/bridge.ts'), 'utf8');
    const handlersStart = headlessSrc.indexOf('const HANDLERS');
    const handlersEnd = headlessSrc.indexOf('\n};', handlersStart);
    expect(handlersStart, 'HANDLERS map not found in src/ui/bridge.ts').toBeGreaterThan(-1);
    const headless = new Set(
      [...headlessSrc.slice(handlersStart, handlersEnd).matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*):/gm)].map((m) => m[1]),
    );
    const coverage = Object.fromEntries(
      LOCAL_COMMANDS.map((c) => [c, [shim.has(c) && 'shim', inline.has(c) && 'inline', headless.has(c) && 'headless'].filter(Boolean).join(',') || 'NONE']),
    );
    expect(coverage).toMatchInlineSnapshot(`
      {
        "changeWindowTitle": "shim,inline,headless",
        "closeFlag": "shim,inline,headless",
        "createHistory": "shim,inline,headless",
        "emit": "shim,inline,headless",
        "emitFrontendCustomMetric": "shim,inline,headless",
        "emitPublic": "shim,inline,headless",
        "emitReadyEvent": "shim,inline,headless",
        "enableTheming": "shim,inline,headless",
        "getFrameId": "shim,inline,headless",
        "getUrl": "shim,inline,headless",
        "initFeatureFlags": "shim,inline,headless",
        "isRovoEnabled": "shim,inline,headless",
        "navigate": "shim,inline,headless",
        "on": "shim,inline,headless",
        "onClose": "shim,headless",
        "onError": "shim,headless",
        "onPublic": "shim,inline,headless",
        "open": "shim,inline,headless",
        "openModal": "shim,headless",
        "reconcile": "shim,inline,headless",
        "refresh": "shim,inline,headless",
        "reload": "shim,inline,headless",
        "showFlag": "shim,inline,headless",
        "subscribeRealtimeChannel": "shim,inline,headless",
        "trackObjectStoreAction": "shim,headless",
      }
    `);
  });
});
