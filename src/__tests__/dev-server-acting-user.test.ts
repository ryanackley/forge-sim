/**
 * "Acting as" user switcher — dev-server RPCs + /myself override.
 *
 * The browser dev server flips the acting user from the ⚙️ gear menu. It's
 * mode-aware (Ryan's "go all in" call):
 *
 *   OFFLINE (no cloud)   → a seeded roster, forge-sim's no-cloud differentiator
 *   CONNECTED (real site)→ a live search over real users off the instance, and
 *                          the pick MUST beat the real /myself (which always
 *                          returns the authenticated PAT owner, so the acting
 *                          name could never flip otherwise)
 *
 * `setCurrentUser` is THE primary write. One action, two effects (rich → thin):
 *
 *   setActingUser(user) → productApi.setCurrentUser(user)
 *        ├─ resolveModuleContext stamps ctx.accountId  (the thin resolver shape)
 *        └─ the current-user REST route serves the picked identity
 *
 * Current-user route precedence:
 *   app's own /myself mock  >  acting-user override  >  real API / seeded miss
 *
 * These tests pin the product-API override (offline + connected), the mode-aware
 * RPCs (getActingUserState / searchUsers / setActingUser), and the WebSocket
 * resolver-context path.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { createSimulator, ForgeSimulator } from '../simulator.js';
import { createDevServer } from '../dev-server.js';
import type { DevServer } from '../dev-server.js';
import { SimulatedProductApi } from '../product-api.js';
import {
  getSeededUserByAccountId,
  getSeededUsers,
  DEFAULT_SEEDED_ACCOUNT_ID,
} from '../seeded-users.js';
import type { AtlassianAccount } from '../auth/credentials.js';
import { WebSocket } from 'ws';

const FIXTURE_DIR = new URL('./fixtures/ctx-echo', import.meta.url).pathname;

/**
 * A minimal `fetch` stand-in for connected-mode tests. The real product-API
 * handler reads global `fetch` at call time and only touches `.status`,
 * `.statusText`, `.ok`, `.headers.entries()`, and `.text()`. A URL substring
 * that matches a route key returns that body 200; anything else 404s.
 */
function makeFetchStub(routes: Record<string, unknown>) {
  return async (url: string | URL): Promise<any> => {
    const u = url.toString();
    const key = Object.keys(routes).find((k) => u.includes(k));
    const found = key !== undefined;
    const body = found ? routes[key] : { error: 'unstubbed', url: u };
    return {
      status: found ? 200 : 404,
      statusText: found ? 'OK' : 'Not Found',
      ok: found,
      headers: new Map<string, string>([['content-type', 'application/json']]),
      text: async () => JSON.stringify(body),
    };
  };
}

const REAL_ACCOUNT: AtlassianAccount = {
  id: 'owner-1',
  name: 'PAT Owner',
  email: 'owner@site.example',
  site: 'benryantest.atlassian.net',
  cloudId: 'ec76317d-244d-4c91-9f9c-46c96f5fe123',
  accountId: 'real-pat-owner',
  authType: 'pat',
  accessToken: 'fake-token',
  refreshToken: '',
  expiresAt: 0,
  scopes: [],
};

// ── Product-API /myself fallback tiers, OFFLINE (no dev server) ─────────

describe('SimulatedProductApi /myself current-user fallback (offline)', () => {
  it('(a) currentUser unset → /myself is the unmocked miss (baseline unchanged)', async () => {
    const api = new SimulatedProductApi();
    const res = await api.request('jira', '/rest/api/3/myself');
    // Raw createSimulator() must still fail an unmocked /myself — the seeded
    // fallback is inert until something calls setCurrentUser.
    expect(res.ok).toBe(false);
  });

  it('(b) setCurrentUser(Diego) + no app mock → /myself returns Diego', async () => {
    const api = new SimulatedProductApi();
    api.setCurrentUser(getSeededUserByAccountId('sim-user-003')!);
    const res = await api.request('jira', '/rest/api/3/myself');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.accountId).toBe('sim-user-003');
    expect(body.displayName).toBe('Diego Santos');
    expect(body.emailAddress).toBe('diego@example.com');
    expect(body.active).toBe(true);
  });

  it('(c) an app author /myself mock wins; the fallback is skipped', async () => {
    const api = new SimulatedProductApi();
    api.setCurrentUser(getSeededUserByAccountId('sim-user-003')!);
    api.mockRoutes('jira', {
      'GET /rest/api/3/myself': { accountId: 'app-mock-id', displayName: 'App Mock' },
    });
    const res = await api.request('jira', '/rest/api/3/myself');
    expect(res.ok).toBe(true);
    const body = await res.json();
    // The mock returned 2xx, so it wins — the seeded fallback never fires.
    expect(body.accountId).toBe('app-mock-id');
    expect(body.displayName).toBe('App Mock');
  });

  it('(d) switching users flips the /myself identity; back to lead restores it', async () => {
    const api = new SimulatedProductApi();
    api.setCurrentUser(getSeededUserByAccountId('sim-user-003')!);
    let body = await (await api.request('jira', '/rest/api/3/myself')).json();
    expect(body.accountId).toBe('sim-user-003');

    api.setCurrentUser(getSeededUserByAccountId(DEFAULT_SEEDED_ACCOUNT_ID)!);
    body = await (await api.request('jira', '/rest/api/3/myself')).json();
    expect(body.accountId).toBe(DEFAULT_SEEDED_ACCOUNT_ID);
    expect(body.displayName).toBe('Ryan Ackley');
  });

  it('serves the Confluence current-user route for both path forms', async () => {
    const api = new SimulatedProductApi();
    api.setCurrentUser(getSeededUserByAccountId('sim-user-004')!);

    for (const path of ['/wiki/rest/api/user/current', '/rest/api/user/current']) {
      const res = await api.request('confluence', path);
      expect(res.ok).toBe(true);
      const body = await res.json();
      expect(body.accountId).toBe('sim-user-004');
      expect(body.publicName).toBe('Priya Nair');
      expect(body.email).toBe('priya@example.com');
      expect(body.type).toBe('known');
    }
  });

  it('honors the 2xx gate: a non-GET myself is not intercepted', async () => {
    const api = new SimulatedProductApi();
    api.setCurrentUser(getSeededUserByAccountId('sim-user-002')!);
    const res = await api.request('jira', '/rest/api/3/myself', { method: 'POST' });
    // POST /myself is not a current-user read — override stays out of it.
    expect(res.ok).toBe(false);
  });

  it('clear() resets the seeded current user', async () => {
    const api = new SimulatedProductApi();
    api.setCurrentUser(getSeededUserByAccountId('sim-user-002')!);
    expect(api.getCurrentUser()?.accountId).toBe('sim-user-002');
    api.clear();
    expect(api.getCurrentUser()).toBeNull();
    const res = await api.request('jira', '/rest/api/3/myself');
    expect(res.ok).toBe(false);
  });
});

// ── Product-API /myself override, CONNECTED (real API stubbed) ──────────

describe('SimulatedProductApi /myself — connected-mode precedence flip', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        // The live site always returns the authenticated PAT owner.
        '/rest/api/3/myself': {
          accountId: 'real-pat-owner',
          displayName: 'PAT Owner',
          emailAddress: 'owner@site.example',
          active: true,
        },
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('no acting user → the real /myself (authenticated PAT owner) is returned', async () => {
    const api = new SimulatedProductApi();
    api.connectRealApis(REAL_ACCOUNT);
    const body = await (await api.request('jira', '/rest/api/3/myself')).json();
    // currentUser null → override inert → real API answer flows through.
    expect(body.accountId).toBe('real-pat-owner');
  });

  it('acting user beats the real /myself 2xx (the whole point of connected mode)', async () => {
    const api = new SimulatedProductApi();
    api.connectRealApis(REAL_ACCOUNT);
    // A real user picked off the site — no email came back from the picker.
    api.setCurrentUser({ accountId: 'picked-123', displayName: 'Priya Nair' });
    const body = await (await api.request('jira', '/rest/api/3/myself')).json();
    expect(body.accountId).toBe('picked-123');
    expect(body.displayName).toBe('Priya Nair');
    // Never invent an email for a real pick that didn't supply one.
    expect(body.emailAddress).toBeUndefined();
  });

  it("an app's own /myself mock still wins over the acting user in real mode", async () => {
    const api = new SimulatedProductApi();
    api.connectRealApis(REAL_ACCOUNT);
    api.mockRoutes('jira', {
      'GET /rest/api/3/myself': { accountId: 'app-mock-id', displayName: 'App Mock' },
    });
    api.setCurrentUser({ accountId: 'picked-123', displayName: 'Priya Nair' });
    const body = await (await api.request('jira', '/rest/api/3/myself')).json();
    // App mock returned 2xx and hasMockRoute distinguishes it → mock wins.
    expect(body.accountId).toBe('app-mock-id');
  });
});

// ── Dev-server RPCs + resolver-context path, OFFLINE (WebSocket) ────────

describe('Dev-server acting-user RPCs (offline)', () => {
  const TEST_PORT = 15186;
  let sim: ForgeSimulator;
  let server: DevServer;
  let ws: WebSocket;

  function rpc(method: string, params: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = `test-${Date.now()}-${Math.random()}`;
      const timeout = setTimeout(() => reject(new Error(`RPC timeout: ${method}`)), 5000);
      const handler = (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.requestId === requestId) {
            ws.off('message', handler);
            clearTimeout(timeout);
            if (msg.error) reject(new Error(msg.error));
            else resolve(msg.result);
          }
        } catch {}
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({ type: 'rpc', requestId, method, params }));
    });
  }

  beforeAll(async () => {
    sim = createSimulator();
    await sim.deploy(FIXTURE_DIR);
    server = await createDevServer({ port: TEST_PORT, simulator: sim });
  });

  beforeEach(async () => {
    // Clean baseline: back to the lead before every test (setActingUser mutates
    // shared sim state across tests).
    sim.productApi.setCurrentUser(getSeededUserByAccountId(DEFAULT_SEEDED_ACCOUNT_ID)!);
    ws = new WebSocket(`ws://localhost:${server.port}`);
    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', reject);
    });
  });

  afterEach(() => {
    if (ws.readyState === WebSocket.OPEN) ws.close();
  });

  afterAll(async () => {
    server.close();
    await sim.stop();
  });

  it('getActingUserState reports offline mode, the roster, and the current user', async () => {
    const res = await rpc('getActingUserState');
    expect(res.mode).toBe('offline');
    expect(res.site).toBeNull();
    expect(res.users).toHaveLength(getSeededUsers().length);
    expect(res.users.map((u: any) => u.accountId)).toContain('sim-user-003');
    expect(res.current.accountId).toBe(DEFAULT_SEEDED_ACCOUNT_ID);
  });

  it('searchUsers filters the seeded roster by name / role / email', async () => {
    const byName = await rpc('searchUsers', { query: 'diego' });
    expect(byName.mode).toBe('offline');
    expect(byName.users.map((u: any) => u.accountId)).toEqual(['sim-user-003']);

    const byRole = await rpc('searchUsers', { query: 'designer' });
    expect(byRole.users.map((u: any) => u.accountId)).toEqual(['sim-user-004']);

    const byEmail = await rpc('searchUsers', { query: 'sam@example.com' });
    expect(byEmail.users.map((u: any) => u.accountId)).toEqual(['sim-user-005']);

    // Empty query → the whole roster (useful as the dropdown's default options).
    const all = await rpc('searchUsers', { query: '' });
    expect(all.users).toHaveLength(getSeededUsers().length);

    // No match → empty, not an error.
    const none = await rpc('searchUsers', { query: 'nobody-here' });
    expect(none.users).toEqual([]);
  });

  it('setActingUser then getContext returns the overridden accountId', async () => {
    await rpc('setActingUser', { accountId: 'sim-user-003' });
    const ctx = await rpc('getContext', { moduleKey: 'ctx-echo' });
    expect(ctx.accountId).toBe('sim-user-003');
    // getActingUserState now reports the new current user too.
    const state = await rpc('getActingUserState');
    expect(state.current.accountId).toBe('sim-user-003');
  });

  it('setActingUser threads the accountId into the resolver req.context', async () => {
    await rpc('setActingUser', { accountId: 'sim-user-003' });
    const result = await rpc('invoke', {
      functionKey: 'echoContext',
      payload: {},
      moduleKey: 'ctx-echo',
    });
    // The resolver echoes ctx.accountId — the switch reached req.context.
    expect(result.accountId).toBe('sim-user-003');
  });

  it('getContext and invoke agree on the acting accountId (frontend/resolver parity)', async () => {
    await rpc('setActingUser', { accountId: 'sim-user-005' });
    const ctx = await rpc('getContext', { moduleKey: 'ctx-echo' });
    const result = await rpc('invoke', {
      functionKey: 'echoContext',
      payload: {},
      moduleKey: 'ctx-echo',
    });
    expect(ctx.accountId).toBe('sim-user-005');
    expect(result.accountId).toBe('sim-user-005');
  });

  it('an explicit contextOptions.accountId wins over the acting user', async () => {
    await rpc('setActingUser', { accountId: 'sim-user-003' });
    // Precedence: explicit per-invoke/URL accountId > currentUser.accountId.
    const ctx = await rpc('getContext', {
      moduleKey: 'ctx-echo',
      contextOptions: { accountId: 'explicit-override' },
    });
    expect(ctx.accountId).toBe('explicit-override');
  });

  it('switching back to the lead restores the default accountId', async () => {
    await rpc('setActingUser', { accountId: 'sim-user-003' });
    await rpc('setActingUser', { accountId: DEFAULT_SEEDED_ACCOUNT_ID });
    const ctx = await rpc('getContext', { moduleKey: 'ctx-echo' });
    expect(ctx.accountId).toBe(DEFAULT_SEEDED_ACCOUNT_ID);
  });

  it('clearing the override (no accountId) reverts to the seeded lead', async () => {
    await rpc('setActingUser', { accountId: 'sim-user-003' });
    await rpc('setActingUser', {});
    const state = await rpc('getActingUserState');
    expect(state.current.accountId).toBe(DEFAULT_SEEDED_ACCOUNT_ID);
  });

  it('rejects an unknown accountId loudly', async () => {
    await expect(rpc('setActingUser', { accountId: 'not-a-real-id' })).rejects.toThrow(
      /Unknown seeded user accountId/,
    );
  });

  it('after a switch, the dev-server /myself request returns the new user', async () => {
    await rpc('setActingUser', { accountId: 'sim-user-003' });
    const res = await sim.productApi.request('jira', '/rest/api/3/myself');
    const body = await res.json();
    expect(body.accountId).toBe('sim-user-003');
    expect(body.displayName).toBe('Diego Santos');
  });
});

// ── Dev-server RPCs, CONNECTED (real API stubbed) ───────────────────────

describe('Dev-server acting-user RPCs (connected)', () => {
  const TEST_PORT = 15187;
  let sim: ForgeSimulator;
  let server: DevServer;
  let ws: WebSocket;

  function rpc(method: string, params: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = `test-${Date.now()}-${Math.random()}`;
      const timeout = setTimeout(() => reject(new Error(`RPC timeout: ${method}`)), 5000);
      const handler = (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.requestId === requestId) {
            ws.off('message', handler);
            clearTimeout(timeout);
            if (msg.error) reject(new Error(msg.error));
            else resolve(msg.result);
          }
        } catch {}
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({ type: 'rpc', requestId, method, params }));
    });
  }

  beforeAll(async () => {
    // The user picker returns two real people off the "site".
    vi.stubGlobal(
      'fetch',
      makeFetchStub({
        '/rest/api/3/user/picker': {
          users: [
            { accountId: 'real-aaa', displayName: 'Ada Lovelace', avatarUrl: 'https://x/ada.png' },
            { accountId: 'real-bbb', displayName: 'Alan Turing' },
          ],
        },
      }),
    );
    sim = createSimulator();
    await sim.deploy(FIXTURE_DIR);
    sim.productApi.connectRealApis(REAL_ACCOUNT);
    server = await createDevServer({ port: TEST_PORT, simulator: sim });
  });

  beforeEach(async () => {
    // No pick yet → the authenticated PAT owner is the default identity.
    sim.productApi.setCurrentUser(null);
    ws = new WebSocket(`ws://localhost:${server.port}`);
    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', reject);
    });
  });

  afterEach(() => {
    if (ws.readyState === WebSocket.OPEN) ws.close();
  });

  afterAll(async () => {
    server.close();
    await sim.stop();
    vi.unstubAllGlobals();
  });

  it('getActingUserState reports connected mode, the site, and the PAT owner as current', async () => {
    const res = await rpc('getActingUserState');
    expect(res.mode).toBe('connected');
    expect(res.site).toBe(REAL_ACCOUNT.site);
    // Empty roster — you search live in connected mode.
    expect(res.users).toEqual([]);
    // Default identity derives from the connected account (no network call).
    expect(res.current.accountId).toBe(REAL_ACCOUNT.accountId);
    expect(res.current.displayName).toBe(REAL_ACCOUNT.name);
  });

  it('searchUsers proxies the real Jira user picker', async () => {
    const res = await rpc('searchUsers', { query: 'a' });
    expect(res.mode).toBe('connected');
    expect(res.users.map((u: any) => u.accountId)).toEqual(['real-aaa', 'real-bbb']);
    // Avatar carries through when the picker supplies one.
    expect(res.users[0].avatarUrl).toBe('https://x/ada.png');
  });

  it('setActingUser with a picked real user threads the accountId into context', async () => {
    await rpc('setActingUser', {
      user: { accountId: 'real-aaa', displayName: 'Ada Lovelace', avatarUrl: 'https://x/ada.png' },
    });
    const ctx = await rpc('getContext', { moduleKey: 'ctx-echo' });
    expect(ctx.accountId).toBe('real-aaa');

    const state = await rpc('getActingUserState');
    expect(state.current.accountId).toBe('real-aaa');
    expect(state.current.displayName).toBe('Ada Lovelace');
  });

  it('setActingUser (connected) requires a full user object, not a bare accountId', async () => {
    await expect(rpc('setActingUser', { accountId: 'real-aaa' })).rejects.toThrow(
      /requires a full user object/,
    );
  });

  it('clearing the override reverts to the PAT owner (currentUser null)', async () => {
    await rpc('setActingUser', {
      user: { accountId: 'real-aaa', displayName: 'Ada Lovelace' },
    });
    await rpc('setActingUser', {});
    const ctx = await rpc('getContext', { moduleKey: 'ctx-echo' });
    expect(ctx.accountId).toBe(REAL_ACCOUNT.accountId);
  });
});
