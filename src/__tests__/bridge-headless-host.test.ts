/**
 * Headless BridgeHost surface behaviours, driven by the REAL @forge/bridge
 * (createRequire bypasses the vitest alias — lesson #5). The browser-host
 * twin is bridge-features.test.ts; this pins the answers that are specific to
 * having no window and no site:
 *
 * - router.getUrl   resolves against the simulated site (out/router/router.js
 *                   runs `new URL()` on the answer and throws on null)
 * - view.createHistory  in-memory, history-v4 listener contract, fresh per call
 * - events           same-frame delivery, public and private
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import { createSimulator, type ForgeSimulator } from '../simulator.js';

const require = createRequire(import.meta.url);

let sim: ForgeSimulator;
let bridge: typeof import('@forge/bridge');

beforeAll(() => {
  sim = createSimulator(); // installs globalThis.__bridge before the package evaluates
  bridge = require('@forge/bridge');
});

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  sim.ui.reset();
});

describe('router.getUrl (headless)', () => {
  it('resolves a NavigationLocation to an absolute URL on the simulated site', async () => {
    const url = await bridge.router.getUrl({ target: bridge.NavigationTarget.Issue, issueKey: 'PROJ-7' } as any);
    expect(url).toBeInstanceOf(URL);
    expect(url.origin).toBe(new URL(sim.getDefaultContext().siteUrl).origin);
    expect(url.pathname).toBe('/browse/PROJ-7');
  });

  it.each([
    [{ target: 'contentView', contentId: '123' }, '/wiki/pages/123'],
    [{ target: 'spaceView', spaceKey: 'DEV' }, '/wiki/spaces/DEV'],
    [{ target: 'dashboard', dashboardId: '10001' }, '/jira/dashboards/10001'],
    [{ target: 'module', moduleKey: 'my-panel' }, '/module/my-panel/'],
  ])('maps %j like the browser host', async (location, pathname) => {
    expect((await bridge.router.getUrl(location as any)).pathname).toBe(pathname);
  });

  it('rejects an unknown target with the real package\'s own error', async () => {
    // Host answers null → out/router/router.js: 'Failed to get URL'.
    await expect(bridge.router.getUrl({ target: 'nowhere' } as any)).rejects.toThrow(/Failed to get URL/);
  });

  it('rejects a location with no target before any bridge call', async () => {
    await expect(bridge.router.getUrl({} as any)).rejects.toThrow(/target is required/);
    expect(sim.ui.getBridgeCalls()).toEqual([]);
  });
});

describe('view.createHistory (headless)', () => {
  it('returns an in-memory history with the v4 listener signature', async () => {
    const history: any = await bridge.view.createHistory();
    expect(history.location.pathname).toBe('/');
    const seen: Array<[string, string]> = [];
    history.listen((location: any, action: string) => seen.push([location.pathname, action]));
    history.push('/settings');
    history.goBack();
    expect(seen).toEqual([['/settings', 'PUSH'], ['/', 'POP']]);
    expect(history.location.pathname).toBe('/');
  });

  it('is fresh per call — one Router mount cannot see another\'s stack', async () => {
    const a: any = await bridge.view.createHistory();
    a.push('/a');
    const b: any = await bridge.view.createHistory();
    expect(b.location.pathname).toBe('/');
    expect(a.location.pathname).toBe('/a');
  });
});

describe('events (headless, same frame)', () => {
  it('delivers private and public emits to their own subscribers only', async () => {
    const priv = vi.fn();
    const pub = vi.fn();
    const s1 = await bridge.events.on('ping', priv);
    const s2 = await bridge.events.onPublic('ping', pub);
    await bridge.events.emit('ping', 1);
    await bridge.events.emitPublic('ping', 2);
    expect(priv).toHaveBeenCalledWith(1);
    expect(priv).not.toHaveBeenCalledWith(2);
    expect(pub).toHaveBeenCalledWith(2);
    expect(pub).not.toHaveBeenCalledWith(1);
    s1.unsubscribe();
    s2.unsubscribe();
    await bridge.events.emit('ping', 3);
    expect(priv).toHaveBeenCalledTimes(1);
  });
});
