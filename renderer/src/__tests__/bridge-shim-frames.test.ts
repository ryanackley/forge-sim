/**
 * Bridge consolidation, phase 1: the shim's app-facing exports must go
 * through callBridge — the one seam real Forge provides — and emit the
 * same frame shapes real @forge/bridge does, so source-mode apps exercise
 * the identical command table as bundled apps running the real package.
 *
 * The WebSocket is stubbed to capture the RPC the callBridge case produces
 * and to answer it, so each test asserts the full translation:
 *   export → callBridge(<real command>, <real frame>) → rpc(<method>, <params>)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  invoke,
  view,
  requestJira,
  requestRemote,
  realtime,
} from '../bridge/forge-bridge-shim';

const G = globalThis as any;

type Frame = { method: string; params: any };

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static sent: Frame[] = [];
  static reply: (frame: Frame) => any = () => ({});
  readyState = FakeWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(_url: string) {
    queueMicrotask(() => this.onopen?.());
  }
  addEventListener() {}
  send(raw: string) {
    const msg = JSON.parse(raw);
    const frame = { method: msg.method, params: msg.params };
    FakeWebSocket.sent.push(frame);
    const result = FakeWebSocket.reply(frame);
    queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ requestId: msg.requestId, result }) }));
  }
  close() {}
}

const realWebSocket = G.WebSocket;

beforeEach(() => {
  G.WebSocket = FakeWebSocket;
  FakeWebSocket.sent = [];
  FakeWebSocket.reply = () => ({});
  // Force a fresh (fake) connection per test.
  G.__forgeSim.ws = null;
  G.__forgeSim.wsReady = false;
  G.__forgeSim.pendingRequests.clear();
  window.history.replaceState({}, '', '/module/test-panel/');
});

afterEach(() => {
  G.WebSocket = realWebSocket;
});

const callBridge = (cmd: string, data?: any) => G.__bridge.callBridge(cmd, data);
const lastFrame = () => FakeWebSocket.sent[FakeWebSocket.sent.length - 1];

describe('bridge shim — exports route through callBridge with real @forge/bridge frames', () => {
  it('invoke(): { functionKey, payload } → rpc invoke with module key attached by the bridge', async () => {
    FakeWebSocket.reply = () => 'ok';
    await expect(invoke('getText', { a: 1 })).resolves.toBe('ok');
    expect(lastFrame()).toMatchObject({
      method: 'invoke',
      params: { functionKey: 'getText', payload: { a: 1 }, moduleKey: 'test-panel' },
    });
    // The real package's frame produces the identical RPC.
    FakeWebSocket.sent = [];
    await callBridge('invoke', { functionKey: 'getText', payload: { a: 1 } });
    expect(lastFrame()).toMatchObject({ method: 'invoke', params: { functionKey: 'getText', moduleKey: 'test-panel' } });
  });

  it('view.getContext(): bare getContext command → rpc getContext with module key', async () => {
    FakeWebSocket.reply = () => ({ moduleKey: 'test-panel' });
    await expect(view.getContext()).resolves.toEqual({ moduleKey: 'test-panel' });
    expect(lastFrame()).toMatchObject({ method: 'getContext', params: { moduleKey: 'test-panel' } });
  });

  it('requestJira(): fetchProduct frame → rpc fetchProduct; response rehydrated as a Response', async () => {
    FakeWebSocket.reply = () => ({ status: 200, statusText: 'OK', body: '{"key":"X-1"}', headers: { 'content-type': 'application/json' } });
    const res = await requestJira('/rest/api/3/issue/X-1', { method: 'GET', headers: { 'x-a': '1' } });
    expect(lastFrame()).toMatchObject({
      method: 'fetchProduct',
      params: { product: 'jira', restPath: '/rest/api/3/issue/X-1', fetchRequestInit: { method: 'GET', headers: { 'x-a': '1' } } },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ key: 'X-1' });
  });

  it('requestRemote(): path travels INSIDE fetchRequestInit, as the real package sends it', async () => {
    FakeWebSocket.reply = () => ({ status: 200, statusText: 'OK', body: '[]', headers: {} });
    await requestRemote('analytics', { path: '/events', method: 'POST', body: '{}' });
    const f = lastFrame();
    expect(f.method).toBe('fetchRemote');
    expect(f.params.remoteKey).toBe('analytics');
    expect(f.params.fetchRequestInit).toMatchObject({ path: '/events', method: 'POST', body: '{}' });
    expect(f.params.path).toBeUndefined();

    // And the real package's frame (the one e2e/manual-packaging.spec.ts
    // proved in Chromium) lands on the same RPC.
    FakeWebSocket.sent = [];
    await callBridge('fetchRemote', { remoteKey: 'analytics', fetchRequestInit: { path: '/events', method: 'GET' } });
    expect(lastFrame()).toMatchObject({ method: 'fetchRemote', params: { remoteKey: 'analytics', fetchRequestInit: { path: '/events' } } });
  });

  it('realtime.publish(): publishRealtimeChannel frame → rpc realtimePublish scoped to the module', async () => {
    FakeWebSocket.reply = () => ({ eventId: 'e1', eventTimestamp: 't' });
    await expect(realtime.publish('chan', { x: 1 }, { contextOverrides: [] })).resolves.toEqual({ eventId: 'e1', eventTimestamp: 't' });
    expect(lastFrame()).toMatchObject({
      method: 'realtimePublish',
      params: { channel: 'chan', payload: { x: 1 }, global: false, moduleKey: 'test-panel', options: { contextOverrides: [] } },
    });
  });

  it('realtime.publishGlobal(): isGlobal frame → rpc realtimePublish global, no module scoping', async () => {
    await realtime.publishGlobal('chan', 'hi');
    const f = lastFrame();
    expect(f).toMatchObject({ method: 'realtimePublish', params: { channel: 'chan', payload: 'hi', global: true } });
    expect(f.params.moduleKey).toBeUndefined();
  });

  it("the real package's publishRealtimeChannel frame is accepted directly", async () => {
    await callBridge('publishRealtimeChannel', { channelName: 'c', eventPayload: { n: 2 }, options: undefined });
    expect(lastFrame()).toMatchObject({ method: 'realtimePublish', params: { channel: 'c', payload: { n: 2 }, global: false, moduleKey: 'test-panel' } });
  });
});
