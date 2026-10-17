/**
 * The bridge protocol (src/bridge/protocol) is the one place that knows what
 * real @forge/bridge sends through window.__bridge.callBridge and what each
 * command becomes on a BridgeHost. This suite pins that in three ways:
 *
 *  1. The registry covers exactly the commands the INSTALLED @forge/bridge
 *     and @forge/react can send — derived from their source, so a bump that
 *     adds a command fails here.
 *  2. The dispatcher routes EVERY supported registry entry to a typed host
 *     method with the frame normalized, and throws (never resolves undefined)
 *     for unsupported and unknown commands.
 *  3. The protocol subtree compiles with no DOM and no Node types.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  BRIDGE_COMMANDS,
  createBridgeDispatcher,
  isUnsupportedBridgeCommand,
  normalizeBridgeHeaders,
  parseInvokeType,
  unwrapViewPayload,
  type BridgeHost,
} from '../bridge/protocol/index.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

// ── 1. Registry vs the real packages ───────────────────────────────────

function commandsEmittedBy(pkgOutDir: string): Set<string> {
  const found = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (!entry.endsWith('.js')) continue;
      for (const m of readFileSync(full, 'utf8').matchAll(/callBridge\)?\(\s*['"]([A-Za-z][A-Za-z0-9]*)['"]/g)) {
        found.add(m[1]);
      }
    }
  };
  walk(pkgOutDir);
  return found;
}

const emittedByPackages = () => new Set([
  ...commandsEmittedBy(join(REPO_ROOT, 'node_modules/@forge/bridge/out')),
  ...commandsEmittedBy(join(REPO_ROOT, 'node_modules/@forge/react/out')),
]);

describe('registry vs installed @forge/bridge + @forge/react', () => {
  it('lists every command the packages can send', () => {
    const emitted = emittedByPackages();
    expect(emitted.size).toBeGreaterThan(20);
    expect([...emitted].filter((c) => !(c in BRIDGE_COMMANDS)).sort()).toEqual([]);
  });

  it('lists nothing the packages never send', () => {
    const emitted = emittedByPackages();
    expect(Object.keys(BRIDGE_COMMANDS).filter((c) => !emitted.has(c)).sort()).toEqual([]);
  });

  it('every unsupported entry carries a reason', () => {
    for (const [cmd, spec] of Object.entries(BRIDGE_COMMANDS)) {
      if (spec.unsupported !== undefined) expect(spec.unsupported, cmd).toMatch(/\S/);
    }
  });
});

// ── 2. Dispatcher → host ───────────────────────────────────────────────

type Call = { method: keyof BridgeHost; args: unknown[] };

/** A host that records every call and returns a recognizable value. */
function recordingHost(): { host: BridgeHost; calls: Call[] } {
  const calls: Call[] = [];
  const host = new Proxy({} as BridgeHost, {
    get: (_t, method: string) => (...args: unknown[]) => {
      calls.push({ method: method as keyof BridgeHost, args });
      return Promise.resolve(`<${method}>`);
    },
  });
  return { host, calls };
}

const ctxFrames: Record<string, { data: unknown; expect: Call }> = {
  reconcile: { data: { forgeDoc: { type: 'Root' } }, expect: { method: 'reconcile', args: [{ type: 'Root' }, 'view'] } },
  onError: { data: { error: 'boom' }, expect: { method: 'onError', args: ['boom'] } },
  invoke: { data: { functionKey: 'f', payload: { a: 1 } }, expect: { method: 'invoke', args: ['f', { a: 1 }] } },
  fetchProduct: {
    data: { product: 'jira', restPath: '/x', fetchRequestInit: { method: 'POST', headers: [['a', 'b']], body: '{}' } },
    expect: { method: 'fetchProduct', args: ['jira', '/x', { method: 'POST', headers: { a: 'b' }, body: '{}' }] },
  },
  fetchRemote: {
    data: { remoteKey: 'r', fetchRequestInit: { path: '/e', method: 'GET' } },
    expect: { method: 'fetchRemote', args: ['r', '/e', { method: 'GET', headers: undefined, body: undefined }] },
  },
  getContext: { data: undefined, expect: { method: 'getContext', args: [] } },
  submit: { data: { field: 1 }, expect: { method: 'submit', args: [{ field: 1 }] } },
  close: { data: { ok: true }, expect: { method: 'close', args: [{ ok: true }] } },
  refresh: { data: { r: 1 }, expect: { method: 'refresh', args: [{ r: 1 }] } },
  open: { data: undefined, expect: { method: 'open', args: [] } },
  onClose: { data: 'cb', expect: { method: 'onClose', args: ['cb'] } },
  createHistory: { data: undefined, expect: { method: 'createHistory', args: [] } },
  enableTheming: { data: undefined, expect: { method: 'enableTheming', args: [] } },
  changeWindowTitle: { data: 'Title', expect: { method: 'changeWindowTitle', args: ['Title'] } },
  emitReadyEvent: { data: undefined, expect: { method: 'emitReadyEvent', args: [] } },
  navigate: { data: { url: '/x', type: 'new-tab' }, expect: { method: 'navigate', args: ['/x', 'new-tab'] } },
  getUrl: { data: { target: 'issue', issueKey: 'T-1' }, expect: { method: 'getUrl', args: [{ target: 'issue', issueKey: 'T-1' }] } },
  reload: { data: undefined, expect: { method: 'reload', args: [] } },
  showFlag: { data: { id: 'f', title: 'T' }, expect: { method: 'showFlag', args: [{ id: 'f', title: 'T' }] } },
  closeFlag: { data: { id: 'f' }, expect: { method: 'closeFlag', args: ['f'] } },
  openModal: { data: { resource: 'm' }, expect: { method: 'openModal', args: [{ resource: 'm' }] } },
  emit: { data: { event: 'e', payload: 1 }, expect: { method: 'emitEvent', args: ['e', 1, false] } },
  emitPublic: { data: { event: 'e', payload: 1 }, expect: { method: 'emitEvent', args: ['e', 1, true] } },
  on: { data: { event: 'e', callback: 'cb' }, expect: { method: 'onEvent', args: ['e', 'cb', false] } },
  onPublic: { data: { event: 'e', callback: 'cb' }, expect: { method: 'onEvent', args: ['e', 'cb', true] } },
  publishRealtimeChannel: {
    data: { channelName: 'c', eventPayload: { n: 1 }, options: { token: 't' }, isGlobal: true },
    expect: { method: 'publishRealtime', args: ['c', { n: 1 }, { token: 't' }, true] },
  },
  subscribeRealtimeChannel: {
    data: { channelName: 'c', onEvent: 'cb', options: undefined },
    expect: { method: 'subscribeRealtime', args: ['c', 'cb', undefined, false] },
  },
  trackObjectStoreAction: { data: { a: 1 }, expect: { method: 'trackObjectStoreAction', args: [{ a: 1 }] } },
  getFrameId: { data: undefined, expect: { method: 'getFrameId', args: [] } },
  initFeatureFlags: { data: { user: 'u', config: 'c' }, expect: { method: 'initFeatureFlags', args: ['u', 'c'] } },
  isRovoEnabled: { data: undefined, expect: { method: 'isRovoEnabled', args: [] } },
  emitFrontendCustomMetric: { data: { customMetricName: 'm', value: 2 }, expect: { method: 'emitFrontendCustomMetric', args: ['m', 2] } },
};

describe('dispatcher routes every supported command to a typed host call', () => {
  const supported = Object.keys(BRIDGE_COMMANDS).filter((c) => !isUnsupportedBridgeCommand(c));

  it('the frame table above covers every supported registry entry (and nothing else)', () => {
    expect(Object.keys(ctxFrames).sort()).toEqual(supported.sort());
  });

  for (const cmd of supported) {
    it(`${cmd}`, async () => {
      const { host, calls } = recordingHost();
      const { callBridge } = createBridgeDispatcher(host);
      const result = await callBridge(cmd, ctxFrames[cmd].data);
      expect(calls).toEqual([ctxFrames[cmd].expect]);
      expect(result).toBe(`<${ctxFrames[cmd].expect.method}>`);
    });
  }

  it('reconcile tags the MacroConfig tree', async () => {
    const { host, calls } = recordingHost();
    await createBridgeDispatcher(host).callBridge('reconcile', { forgeDoc: { type: 'MacroConfig' } });
    expect(calls[0]).toEqual({ method: 'reconcile', args: [{ type: 'MacroConfig' }, 'macroConfig'] });
  });

  it('reconcile with no forgeDoc is a no-op, not a host call', async () => {
    const { host, calls } = recordingHost();
    await createBridgeDispatcher(host).callBridge('reconcile', {});
    expect(calls).toEqual([]);
  });

  it('invoke with invokeType ui-remote-fetch becomes invokeRemote with normalized headers', async () => {
    const { host, calls } = recordingHost();
    await createBridgeDispatcher(host).callBridge('invoke', {
      invokeType: 'ui-remote-fetch', path: '/items', method: 'GET', headers: [['x', '1']], body: undefined,
    });
    expect(calls).toEqual([{ method: 'invokeRemote', args: ['/items', { method: 'GET', headers: { x: '1' }, body: undefined }] }]);
  });

  it('invoke with invokeType ui-container-fetch rejects as not implemented', async () => {
    const { host } = recordingHost();
    await expect(createBridgeDispatcher(host).callBridge('invoke', { invokeType: 'ui-container-fetch' }))
      .rejects.toThrow(/invokeService is not yet implemented/);
  });

  it('fetchRemote accepts a top-level path for older callers', async () => {
    const { host, calls } = recordingHost();
    await createBridgeDispatcher(host).callBridge('fetchRemote', { remoteKey: 'r', path: '/top', fetchRequestInit: { method: 'GET' } });
    expect(calls[0].args[1]).toBe('/top');
  });

  it('submit/close unwrap a lone { payload } but pass a real object through', async () => {
    const { host, calls } = recordingHost();
    const { callBridge } = createBridgeDispatcher(host);
    await callBridge('submit', { payload: { a: 1 } });
    await callBridge('submit', { payload: { a: 1 }, other: 2 });
    expect(calls.map((c) => c.args[0])).toEqual([{ a: 1 }, { payload: { a: 1 }, other: 2 }]);
  });

  it('navigate without a type defaults to same-tab, and a NavigationLocation is passed whole', async () => {
    const { host, calls } = recordingHost();
    await createBridgeDispatcher(host).callBridge('navigate', { target: 'issue', issueKey: 'T-1' });
    expect(calls[0]).toEqual({ method: 'navigate', args: [{ target: 'issue', issueKey: 'T-1' }, 'same-tab'] });
  });
});

describe('dispatcher never resolves undefined for something it cannot do', () => {
  it('unsupported registry entries reject with the stated reason', async () => {
    const { host, calls } = recordingHost();
    const { callBridge } = createBridgeDispatcher(host);
    for (const [cmd, spec] of Object.entries(BRIDGE_COMMANDS)) {
      if (spec.unsupported === undefined) continue;
      await expect(callBridge(cmd), cmd).rejects.toThrow(spec.unsupported);
    }
    expect(calls).toEqual([]);
  });

  it('an unknown command rejects and names the registry file', async () => {
    const { host } = recordingHost();
    await expect(createBridgeDispatcher(host).callBridge('definitelyNotACommand'))
      .rejects.toThrow(/Unknown bridge command "definitelyNotACommand".*bridge\/protocol\/commands\.ts/);
  });

  it('always returns a Promise, even when routing throws synchronously', () => {
    const { host } = recordingHost();
    const p = createBridgeDispatcher(host).callBridge('nope');
    expect(p).toBeInstanceOf(Promise);
    return expect(p).rejects.toThrow();
  });

  it('onCall observes every call, including rejected ones', async () => {
    const seen: string[] = [];
    const { host } = recordingHost();
    const { callBridge } = createBridgeDispatcher(host, { onCall: (cmd) => seen.push(cmd) });
    await callBridge('getContext');
    await callBridge('nope').catch(() => {});
    expect(seen).toEqual(['getContext', 'nope']);
  });
});

// ── Normalizers ────────────────────────────────────────────────────────

describe('normalizers', () => {
  it('normalizeBridgeHeaders: pairs → record, record passthrough, junk → undefined', () => {
    expect(normalizeBridgeHeaders([['a', 'b'], ['c', 1]])).toEqual({ a: 'b', c: '1' });
    expect(normalizeBridgeHeaders({ a: 'b' })).toEqual({ a: 'b' });
    expect(normalizeBridgeHeaders(undefined)).toBeUndefined();
    expect(normalizeBridgeHeaders('x')).toBeUndefined();
  });
  it('parseInvokeType', () => {
    expect(parseInvokeType('ui-remote-fetch')).toBe('remote');
    expect(parseInvokeType('ui-container-fetch')).toBe('container');
    expect(parseInvokeType('ui-future-fetch')).toBeNull();
    expect(parseInvokeType(undefined)).toBeNull();
  });
  it('unwrapViewPayload', () => {
    expect(unwrapViewPayload({ payload: 1 })).toBe(1);
    expect(unwrapViewPayload({ payload: 1, x: 2 })).toEqual({ payload: 1, x: 2 });
    expect(unwrapViewPayload('s')).toBe('s');
    expect(unwrapViewPayload(undefined)).toBeUndefined();
  });
});

// ── 3. The subtree really is environment-neutral ───────────────────────

describe('protocol type gate', () => {
  it('src/bridge/protocol compiles with no DOM and no Node types', () => {
    const r = spawnSync('npx', ['tsc', '-p', 'tsconfig.bridge-protocol.json'], { cwd: REPO_ROOT, encoding: 'utf8' });
    expect(r.status, r.stdout + r.stderr).toBe(0);
  }, 120_000);
});
