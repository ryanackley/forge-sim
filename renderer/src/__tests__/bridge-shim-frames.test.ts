/**
 * forge-sim's chrome calls a few Forge-shaped helpers (view.getContext /
 * submit / close, requestJira) from the chrome-hooks module. They must send
 * the SAME frames real @forge/bridge sends, through the same seam —
 * `window.__bridge.callBridge` — so the shell behaves like an app would.
 * This suite installs a recording `window.__bridge` and asserts each frame.
 *
 * App code no longer imports this module at all: source-mode and prebuilt
 * apps run the real @forge/bridge. The frame → host → RPC half is pinned in
 * src/__tests__/bridge-protocol.test.ts and the browser-host tests.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { view, requestJira, rpc } from '../bridge/forge-bridge-shim';

const G = globalThis as any;

type Frame = { cmd: string; data: any };
let frames: Frame[] = [];
let reply: (f: Frame) => any = () => undefined;

beforeEach(() => {
  frames = [];
  reply = () => undefined;
  G.__bridge = {
    callBridge: (cmd: string, data?: any) => {
      const f = { cmd, data };
      frames.push(f);
      return Promise.resolve(reply(f));
    },
  };
  (window as any).__bridge = G.__bridge;
});

const last = () => frames[frames.length - 1];

describe('chrome helpers emit real @forge/bridge frames into window.__bridge', () => {
  it('view.getContext(): bare getContext, no frame (out/view/getContext.js)', async () => {
    reply = () => ({ moduleKey: 'm' });
    await expect(view.getContext()).resolves.toEqual({ moduleKey: 'm' });
    expect(last()).toEqual({ cmd: 'getContext', data: undefined });
  });

  it('view.submit()/close(): the BARE payload, not { payload } (out/view/submit.js)', async () => {
    await view.submit({ field: 1 });
    expect(last()).toEqual({ cmd: 'submit', data: { field: 1 } });
    await view.close('bye');
    expect(last()).toEqual({ cmd: 'close', data: 'bye' });
  });

  it('requestJira(): fetchProduct frame; response rehydrated as a Response (out/fetch/fetch.js)', async () => {
    reply = () => ({ status: 200, statusText: 'OK', body: '{"key":"X-1"}', headers: { 'content-type': 'application/json' } });
    const res = await requestJira('/rest/api/3/issue/X-1', { method: 'GET', headers: { 'x-a': '1' } });
    expect(last()).toEqual({
      cmd: 'fetchProduct',
      data: { product: 'jira', restPath: '/rest/api/3/issue/X-1', fetchRequestInit: { method: 'GET', headers: { 'x-a': '1' }, body: undefined } },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ key: 'X-1' });
  });

  it('rpc(): without the bundle, rejects loudly instead of hanging', async () => {
    delete G.__forgeSimBridge;
    await expect(rpc('getActingUserState')).rejects.toThrow(/No dev server in this environment/);
  });
});
