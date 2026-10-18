/**
 * The `@forge/bridge` shim (what a source-mode app imports under the Vite
 * alias) must send the SAME frames real @forge/bridge sends, through the
 * same seam: `window.__bridge.callBridge`. It owns no transport of its own
 * any more — the browser bridge host does — so this suite installs a
 * recording `window.__bridge` and asserts the frame each export emits.
 *
 * The other half (frame → host method → RPC params) is pinned in the root
 * package: src/__tests__/bridge-protocol.test.ts and the browser-host tests
 * built on src/__tests__/helpers/browser-bridge-harness.ts.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  invoke,
  view,
  requestJira,
  requestRemote,
  realtime,
  router,
  events,
  showFlag,
  Modal,
} from '../bridge/forge-bridge-shim';

const G = globalThis as any;

type Frame = { cmd: string; data: any };
let frames: Frame[] = [];
let reply: (f: Frame) => any = () => undefined;

beforeEach(() => {
  frames = [];
  reply = () => undefined;
  // The bundle is not loaded under jsdom; stand in for its window.__bridge.
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

describe('shim exports emit real @forge/bridge frames into window.__bridge', () => {
  it('invoke(): { functionKey, payload } (out/invoke/invoke.js)', async () => {
    reply = () => 'ok';
    await expect(invoke('getText', { a: 1 })).resolves.toBe('ok');
    expect(last()).toEqual({ cmd: 'invoke', data: { functionKey: 'getText', payload: { a: 1 } } });
  });

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

  it('requestJira(): fetchProduct frame; response rehydrated as a Response', async () => {
    reply = () => ({ status: 200, statusText: 'OK', body: '{"key":"X-1"}', headers: { 'content-type': 'application/json' } });
    const res = await requestJira('/rest/api/3/issue/X-1', { method: 'GET', headers: { 'x-a': '1' } });
    expect(last()).toEqual({
      cmd: 'fetchProduct',
      data: { product: 'jira', restPath: '/rest/api/3/issue/X-1', fetchRequestInit: { method: 'GET', headers: { 'x-a': '1' }, body: undefined } },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ key: 'X-1' });
  });

  it('requestRemote(): path travels INSIDE fetchRequestInit (out/fetch/fetch.js)', async () => {
    reply = () => ({ status: 200, statusText: 'OK', body: '[]', headers: {} });
    await requestRemote('analytics', { path: '/events', method: 'POST', body: '{}' });
    const f = last();
    expect(f.cmd).toBe('fetchRemote');
    expect(f.data.remoteKey).toBe('analytics');
    expect(f.data.fetchRequestInit).toMatchObject({ path: '/events', method: 'POST', body: '{}' });
    expect(f.data.path).toBeUndefined();
  });

  it('realtime.publish()/publishGlobal(): publishRealtimeChannel frames (out/realtime/realtime.js)', async () => {
    await realtime.publish('chan', { x: 1 }, { contextOverrides: [] });
    expect(last()).toEqual({ cmd: 'publishRealtimeChannel', data: { channelName: 'chan', eventPayload: { x: 1 }, options: { contextOverrides: [] } } });
    await realtime.publishGlobal('chan', 'hi');
    expect(last()).toEqual({ cmd: 'publishRealtimeChannel', data: { channelName: 'chan', eventPayload: 'hi', options: undefined, isGlobal: true } });
  });

  it('realtime.subscribe()/subscribeGlobal(): the callback rides the frame, unserialised', async () => {
    const cb = () => {};
    await realtime.subscribe('room', cb, { replaySeconds: 5 });
    expect(last()).toEqual({ cmd: 'subscribeRealtimeChannel', data: { channelName: 'room', onEvent: cb, options: { replaySeconds: 5 } } });
    await realtime.subscribeGlobal('room', cb);
    expect(last().data).toMatchObject({ channelName: 'room', onEvent: cb, isGlobal: true });
  });

  it('router.navigate()/open(): navigate with type; getUrl() parses the returned absolute url (out/router/router.js)', async () => {
    await router.navigate('/browse/T-1');
    expect(last()).toEqual({ cmd: 'navigate', data: { url: '/browse/T-1', type: 'same-tab' } });
    await router.open({ target: 'issue', issueKey: 'T-1' });
    expect(last()).toEqual({ cmd: 'navigate', data: { target: 'issue', issueKey: 'T-1', type: 'new-tab' } });

    reply = () => 'http://localhost:5173/browse/T-1';
    const url = await router.getUrl({ target: 'issue', issueKey: 'T-1' });
    expect(last()).toEqual({ cmd: 'getUrl', data: { target: 'issue', issueKey: 'T-1' } });
    expect(url).toBeInstanceOf(URL);
    expect(url?.pathname).toBe('/browse/T-1');
  });

  it('events.*: { event, payload } / { event, callback } (out/events/events.js)', async () => {
    const cb = () => {};
    await events.on('e', cb);
    expect(last()).toEqual({ cmd: 'on', data: { event: 'e', callback: cb } });
    await events.emitPublic('e', 7);
    expect(last()).toEqual({ cmd: 'emitPublic', data: { event: 'e', payload: 7 } });
  });

  it('showFlag(): spreads options with a type, close() sends closeFlag with the same id (out/flag/flag.js)', async () => {
    const flag = showFlag({ id: 'f1', title: 'Hi', appearance: 'success' });
    expect(last()).toEqual({ cmd: 'showFlag', data: { id: 'f1', title: 'Hi', appearance: 'success', type: 'success' } });
    await flag.close();
    expect(last()).toEqual({ cmd: 'closeFlag', data: { id: 'f1' } });
  });

  it('showFlag() without an id mints one so close() still targets the right flag', async () => {
    const flag = showFlag({ title: 'anon' });
    const minted = last().data.id;
    expect(typeof minted).toBe('string');
    await flag.close();
    expect(last()).toEqual({ cmd: 'closeFlag', data: { id: minted } });
  });

  it('new Modal(opts).open(): normalised options, same defaults as the real class (out/modal/modal.js)', async () => {
    const onClose = () => {};
    await new Modal({ resource: 'r', onClose }).open();
    expect(last()).toEqual({
      cmd: 'openModal',
      data: { resource: 'r', onClose, size: 'medium', context: {}, closeOnEscape: true, closeOnOverlayClick: true, title: '', icon: '' },
    });
  });

  it('Modal.open() rejects when the host reports failure, like the real class', async () => {
    reply = () => false;
    await expect(new Modal({ resource: 'r' }).open()).rejects.toThrow(/Unable to open modal/);
  });
});
