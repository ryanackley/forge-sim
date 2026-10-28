/**
 * The shared Tools API (`createApiHandler`) loads stored credentials only when
 * its channel's policy says so:
 *
 * - DAEMON (`forge-sim deploy`): opt-in. `/api/deploy` connects only when the
 *   body says `connect: true` — the CLI resolves --connect / --offline /
 *   FORGE_SIM_CONNECT on its side and sends the answer.
 * - DEV (`connectByDefault: true`, i.e. not --offline): `/api/deploy` and
 *   `/api/reset` reconnect, so a Tools-UI reset never silently drops the
 *   connection dev booted with.
 * - A deploy/reset that does not connect first unloads what an earlier
 *   connect loaded (`sim.unloadAuth()`): `--no-reset` or `--offline`
 *   included, it keeps no Atlassian account, provider token, provider secret
 *   or Anthropic config key from an earlier `--connect`, and the response
 *   reports what it unloaded. One that connects reloads from scratch, so the
 *   connection matches the store.
 * - DEV re-applies `.forge-sim/mocks.json` after a reset, before
 *   reconnecting (`reapplyMockFile`): the reset wipes the file's routes, and
 *   a reconnect without them would send those calls to the real site.
 *
 * HERMETIC: HOME points at a temp dir before any import (the credential
 * store's global path is computed when credentials.ts loads); its
 * credentials.json names `forge-sim-test.invalid`. `connectRealApis` makes no
 * network call, and globalThis.fetch is stubbed to throw so any real HTTP
 * would fail the test. The client talks to the handler over loopback with
 * node:http, not fetch.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { createServer, request, type Server } from 'node:http';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSimulator, type ForgeSimulator } from '../simulator.js';
import { createApiHandler, type CreateApiHandlerOptions } from '../tools/api.js';

const hermetic = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-sim-tools-connect-home-'));
  const prevHome = process.env.HOME;
  process.env.HOME = home;
  return { home, prevHome };
});

const SITE = 'forge-sim-test.invalid';

const MANIFEST = `
modules:
  webtrigger:
    - key: hook-trigger
      function: hook
  function:
    - key: hook
      handler: index.run
app:
  id: ari:cloud:ecosystem::app/tools-api-connect
  runtime:
    name: nodejs22.x
permissions:
  scopes: []
`;

const realHttp = vi.fn(async (input: unknown) => {
  throw new Error(`real HTTP attempted in a hermetic test: ${String(input)}`);
});

const STORE = {
  accounts: [{
    id: 'stored-1', name: 'Stored Dev', email: 'stored@example.com', site: SITE,
    cloudId: 'stored-cloud', accountId: 'stored-account', authType: 'pat',
    accessToken: 'stored-pat', refreshToken: '', expiresAt: 0, scopes: [], default: true,
  }],
  // A stored provider token — loaded by a connect, and what an offline
  // deploy afterwards must unload.
  thirdParty: { 'stored-1': { google: { provider: 'google', accessToken: 'stored-google-token' } } } as Record<string, Record<string, unknown>>,
};

/** (Re)write the temp HOME's credential store. */
function writeStore(store: typeof STORE): void {
  mkdirSync(join(hermetic.home, '.forge-sim'), { recursive: true });
  writeFileSync(join(hermetic.home, '.forge-sim', 'credentials.json'), JSON.stringify(store));
}

/** Env vars that would let loadAuthFromEnv connect from somewhere other than the temp store. */
const AUTH_ENV = /^(FORGE_SIM_(SITE|EMAIL|PAT|CLOUD_ID|ACCOUNT_ID|CONNECT|PROVIDER_.*_TOKEN)|ANTHROPIC_API_KEY)$/;
let savedEnv: Record<string, string>;
let appDir: string;

beforeAll(() => {
  savedEnv = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (AUTH_ENV.test(k) && v !== undefined) {
      savedEnv[k] = v;
      delete process.env[k];
    }
  }
  vi.stubGlobal('fetch', realHttp);

  writeStore(STORE);
  // The `forge-sim auth --llm` config key.
  writeFileSync(join(hermetic.home, '.forge-sim', 'config.json'), JSON.stringify({ anthropicApiKey: 'stored-llm-key' }));

  appDir = mkdtempSync(join(tmpdir(), 'forge-sim-tools-connect-app-'));
  mkdirSync(join(appDir, 'src'), { recursive: true });
  writeFileSync(join(appDir, 'manifest.yml'), MANIFEST);
  writeFileSync(join(appDir, 'src', 'index.js'), `export const run = async () => ({ statusCode: 200, body: 'ok' });\n`);
  // A provider client secret (<app>/.forge-sim/providers.json).
  mkdirSync(join(appDir, '.forge-sim'), { recursive: true });
  writeFileSync(join(appDir, '.forge-sim', 'providers.json'), JSON.stringify({ google: { clientSecret: 'stored-secret' } }));
});

afterAll(() => {
  vi.unstubAllGlobals();
  for (const [k, v] of Object.entries(savedEnv)) process.env[k] = v;
  if (hermetic.prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = hermetic.prevHome;
  rmSync(appDir, { recursive: true, force: true });
  rmSync(hermetic.home, { recursive: true, force: true });
});

/** Record, at each sim.deploy() call, whether the sim was connected and which google token it held. */
function recordConnectionAtDeploy(sim: ForgeSimulator): Array<{ realMode: boolean; google: string | undefined }> {
  const seen: Array<{ realMode: boolean; google: string | undefined }> = [];
  const deploy = sim.deploy.bind(sim);
  vi.spyOn(sim, 'deploy').mockImplementation((...args: Parameters<ForgeSimulator['deploy']>) => {
    seen.push({ realMode: sim.productApi.isRealMode, google: sim.externalAuth.getToken('google')?.accessToken });
    return deploy(...args);
  });
  return seen;
}

/**
 * Make the next sim.deploy() reject, as a deploy does when it throws past
 * `throwOnError: false` (a missing manifest.yml, say). Later deploys run for real.
 */
function failNextDeploy(sim: ForgeSimulator): void {
  vi.spyOn(sim, 'deploy').mockRejectedValueOnce(new Error('boom: deploy threw'));
}

async function start(sim: ForgeSimulator, options?: CreateApiHandlerOptions) {
  const handler = options ? createApiHandler(sim, null, options) : createApiHandler(sim);
  const server = createServer((req, res) => {
    void handler(req, res, new URL(req.url ?? '/', 'http://localhost'));
  });
  await new Promise<void>((res) => server.listen(0, '127.0.0.1', () => res()));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('bind failed');
  return { server, port: address.port };
}

function post(port: number, path: string, body: unknown): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = request(
      { host: '127.0.0.1', port, path, method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } },
      (res) => {
        let text = '';
        res.on('data', (c) => (text += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: text ? JSON.parse(text) : null }));
      },
    );
    req.on('error', reject);
    req.end(payload);
  });
}

describe('tools API connect policy', () => {
  let sim: ForgeSimulator;
  let server: Server;
  let port: number;

  beforeEach(() => {
    realHttp.mockClear();
    sim = createSimulator();
  });

  afterEach(async () => {
    await new Promise<void>((res) => server.close(() => res()));
    await sim.stop();
    expect(realHttp).not.toHaveBeenCalled();
  });

  it('runs against a temp HOME, never the real one', async () => {
    ({ server, port } = await start(sim));
    expect(homedir()).toBe(hermetic.home);
  });

  describe('daemon (opt-in)', () => {
    it('/api/deploy without `connect` stays offline and reports no auth', async () => {
      ({ server, port } = await start(sim));
      const res = await post(port, '/api/deploy', { appDir });
      expect(res.status).toBe(200);
      expect(res.body.errors, JSON.stringify(res.body.errors)).toEqual([]);
      expect(res.body.auth).toBeUndefined();
      expect(sim.productApi.isRealMode).toBe(false);
    });

    it('/api/deploy with `connect: true` loads the stored account', async () => {
      ({ server, port } = await start(sim));
      const res = await post(port, '/api/deploy', { appDir, connect: true });
      expect(res.status).toBe(200);
      expect(sim.productApi.isRealMode).toBe(true);
      expect(res.body.auth.atlassian).toMatchObject({ connected: true, site: SITE });
    });

    it('`connect: true` loads everything a connect means: account, provider token, secret, LLM key', async () => {
      ({ server, port } = await start(sim));
      const res = await post(port, '/api/deploy', { appDir, connect: true });
      expect(res.body.auth).toMatchObject({ providers: ['google'], providerSecrets: 1, llm: { configured: true, source: 'config' } });
      expect(sim.externalAuth.getToken('google')?.accessToken).toBe('stored-google-token');
      expect(sim.externalAuth.hasSecret('google')).toBe(true);
      expect(sim.llm.getApiKey()).toBe('stored-llm-key');
    });

    // Each `forge-sim deploy` decides for itself — the CLI always sends a
    // boolean. `--no-reset` (and `--offline --no-reset`) must not carry an
    // earlier --connect's connection.
    it.each([
      // The CLI sends connect:false for both `--no-reset` and `--offline --no-reset`.
      ['--no-reset (with or without --offline)', { reset: false, connect: false }],
      ['a resetting deploy', { connect: false }],
      ['a body without `connect` (non-CLI client)', {}],
    ])('after --connect, %s is fully offline and says what it unloaded', async (_label, body) => {
      ({ server, port } = await start(sim));
      await post(port, '/api/deploy', { appDir, connect: true });
      expect(sim.productApi.isRealMode).toBe(true);

      // The unload comes BEFORE deploy (deploy-time triggers run inside it),
      // not just before the response — `--no-reset` included, where no
      // reset() drops the account first.
      const atDeploy = recordConnectionAtDeploy(sim);
      const res = await post(port, '/api/deploy', { appDir, ...body });
      expect(atDeploy).toEqual([{ realMode: false, google: undefined }]);
      expect(res.status).toBe(200);
      expect(res.body.auth).toBeUndefined();
      expect(sim.productApi.isRealMode).toBe(false);
      // Not just the Atlassian account: provider tokens, secrets and the LLM
      // config key a connect loaded go too, and the response reports them.
      expect(sim.externalAuth.getToken('google')).toBeUndefined();
      expect(sim.externalAuth.hasSecret('google')).toBe(false);
      expect(sim.llm.getApiKey()).toBeNull();
      expect(res.body.disconnected).toEqual({ atlassian: SITE, providers: ['google'], providerSecrets: 1, llm: true });
    });

    it('an offline deploy leaves alone a token set some other way (not by a connect)', async () => {
      ({ server, port } = await start(sim));
      await post(port, '/api/deploy', { appDir, connect: true });
      // e.g. a test's own setToken() replacing the loaded token
      const fromFlow = { provider: 'google', accessToken: 'set-directly' };
      sim.externalAuth.setToken('google', fromFlow);
      const res = await post(port, '/api/deploy', { appDir });
      expect(sim.externalAuth.getToken('google')).toBe(fromFlow);
      expect(res.body.disconnected.providers).toEqual([]);
    });

    it('a second offline deploy reports nothing (nothing left to unload)', async () => {
      ({ server, port } = await start(sim));
      await post(port, '/api/deploy', { appDir, connect: true });
      await post(port, '/api/deploy', { appDir });
      const res = await post(port, '/api/deploy', { appDir });
      expect(res.body.disconnected).toBeUndefined();
    });

    it('/api/reset does not connect', async () => {
      ({ server, port } = await start(sim));
      await post(port, '/api/deploy', { appDir });
      const res = await post(port, '/api/reset', {});
      expect(res.body.success).toBe(true);
      expect(res.body.auth).toBeUndefined();
      expect(res.body.disconnected).toBeUndefined();
      expect(sim.productApi.isRealMode).toBe(false);
    });

    it('/api/reset after --connect unloads provider tokens and the LLM key too, and says so', async () => {
      ({ server, port } = await start(sim));
      await post(port, '/api/deploy', { appDir, connect: true });
      const res = await post(port, '/api/reset', {});
      expect(sim.productApi.isRealMode).toBe(false);
      expect(sim.externalAuth.getToken('google')).toBeUndefined();
      expect(sim.llm.getApiKey()).toBeNull();
      expect(res.body.disconnected).toMatchObject({ atlassian: SITE, providers: ['google'], llm: true });
    });

    it('a connecting deploy deploys offline, then reloads from the store (a token removed from it is gone)', async () => {
      ({ server, port } = await start(sim));
      await post(port, '/api/deploy', { appDir, connect: true });
      expect(sim.externalAuth.getToken('google')).toBeDefined();

      // `forge-sim auth --remove-provider google` between two deploys.
      writeStore({ ...STORE, thirdParty: {} });
      try {
        const atDeploy = recordConnectionAtDeploy(sim);
        const res = await post(port, '/api/deploy', { appDir, reset: false, connect: true });
        // Even with --no-reset, nothing from the earlier connect is loaded
        // while deploy-time triggers run.
        expect(atDeploy).toEqual([{ realMode: false, google: undefined }]);
        expect(sim.productApi.isRealMode).toBe(true);
        expect(sim.externalAuth.getToken('google')).toBeUndefined();
        expect(res.body.auth.providers).toEqual([]);
        expect(res.body.disconnected).toBeUndefined();
      } finally {
        writeStore(STORE);
      }
    });

    it('an ANTHROPIC_API_KEY in the env is reported as loaded, never as unloaded (it keeps working)', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-env-not-real';
      try {
        ({ server, port } = await start(sim));
        const connected = await post(port, '/api/deploy', { appDir, connect: true });
        expect(connected.body.auth.llm).toEqual({ configured: true, source: 'env' });
        const offline = await post(port, '/api/deploy', { appDir });
        expect(offline.body.disconnected.llm).toBe(false);
        expect(sim.llm.getApiKey()).toBe('sk-env-not-real');
      } finally {
        delete process.env.ANTHROPIC_API_KEY;
      }
    });

    // The unload runs before sim.deploy(), so the failure path has to finish
    // the job: reconnect when asked, and report what was dropped when not.
    it.each([
      ['a resetting deploy', {}],
      ['--no-reset', { reset: false }],
    ])('a connecting deploy that throws (%s) is a 500 and still ends connected', async (_label, body) => {
      ({ server, port } = await start(sim));
      await post(port, '/api/deploy', { appDir, connect: true });
      failNextDeploy(sim);
      const res = await post(port, '/api/deploy', { appDir, connect: true, ...body });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('boom: deploy threw');
      expect(res.body.auth.atlassian).toMatchObject({ connected: true, site: SITE });
      expect(res.body.disconnected).toBeUndefined();
      expect(sim.productApi.isRealMode).toBe(true);
      expect(sim.externalAuth.getToken('google')?.accessToken).toBe('stored-google-token');
    });

    it('an offline deploy that throws after --connect is a 500 that still says what it unloaded', async () => {
      ({ server, port } = await start(sim));
      await post(port, '/api/deploy', { appDir, connect: true });
      failNextDeploy(sim);
      const res = await post(port, '/api/deploy', { appDir, reset: false, connect: false });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('boom: deploy threw');
      expect(res.body.auth).toBeUndefined();
      expect(res.body.disconnected).toEqual({ atlassian: SITE, providers: ['google'], providerSecrets: 1, llm: true });
      expect(sim.productApi.isRealMode).toBe(false);
      expect(sim.externalAuth.getToken('google')).toBeUndefined();
    });

    it('a non-boolean `connect` is rejected rather than guessed', async () => {
      ({ server, port } = await start(sim));
      const res = await post(port, '/api/deploy', { appDir, connect: 'yes' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/"connect" must be a boolean/);
      expect(sim.productApi.isRealMode).toBe(false);
    });
  });

  describe('dev (connectByDefault)', () => {
    it('/api/deploy connects, and /api/reset reconnects instead of going offline', async () => {
      ({ server, port } = await start(sim, { connectByDefault: true, appDir }));
      const deployed = await post(port, '/api/deploy', { appDir });
      expect(sim.productApi.isRealMode).toBe(true);
      expect(deployed.body.auth.atlassian).toMatchObject({ connected: true, site: SITE });

      const reset = await post(port, '/api/reset', {});
      expect(reset.body.success).toBe(true);
      expect(sim.productApi.isRealMode).toBe(true);
      expect(sim.productApi.connectedAccount?.site).toBe(SITE);
      expect(reset.body.auth.atlassian).toMatchObject({ connected: true, site: SITE });
    });

    it('an explicit `connect: false` in the body still wins', async () => {
      ({ server, port } = await start(sim, { connectByDefault: true, appDir }));
      const res = await post(port, '/api/deploy', { appDir, connect: false });
      expect(sim.productApi.isRealMode).toBe(false);
      expect(res.body.auth).toBeUndefined();
    });

    it('a deploy that throws is a 500 and still ends connected (dev does not go offline on a broken deploy)', async () => {
      ({ server, port } = await start(sim, { connectByDefault: true, appDir }));
      await post(port, '/api/deploy', { appDir });
      failNextDeploy(sim);
      const res = await post(port, '/api/deploy', { appDir });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('boom: deploy threw');
      expect(res.body.auth.atlassian).toMatchObject({ connected: true, site: SITE });
      expect(sim.productApi.isRealMode).toBe(true);
      expect(sim.externalAuth.getToken('google')?.accessToken).toBe('stored-google-token');
    });

    it('dev --offline (connectByDefault: false) never connects on deploy or reset', async () => {
      ({ server, port } = await start(sim, { connectByDefault: false, appDir }));
      await post(port, '/api/deploy', { appDir });
      expect(sim.productApi.isRealMode).toBe(false);
      const reset = await post(port, '/api/reset', {});
      expect(reset.body.auth).toBeUndefined();
      expect(sim.productApi.isRealMode).toBe(false);
      expect(sim.externalAuth.getToken('google')).toBeUndefined();
    });

    it('a dev reconnect reflects the store, not what an earlier connect left behind', async () => {
      ({ server, port } = await start(sim, { connectByDefault: true, appDir }));
      await post(port, '/api/deploy', { appDir });
      expect(sim.externalAuth.getToken('google')).toBeDefined();
      const reset = await post(port, '/api/reset', {});
      // Unloaded then reloaded: still connected, nothing reported as dropped.
      expect(reset.body.auth.providers).toEqual(['google']);
      expect(reset.body.disconnected).toBeUndefined();
    });
  });

  describe('dev: .forge-sim/mocks.json survives a Tools-API reset (reapplyMockFile)', () => {
    let mockAppDir: string;

    beforeAll(() => {
      mockAppDir = mkdtempSync(join(tmpdir(), 'forge-sim-tools-connect-mocks-'));
      mkdirSync(join(mockAppDir, 'src'), { recursive: true });
      mkdirSync(join(mockAppDir, '.forge-sim'), { recursive: true });
      writeFileSync(join(mockAppDir, 'manifest.yml'), MANIFEST);
      writeFileSync(join(mockAppDir, 'src', 'index.js'), `export const run = async () => ({ statusCode: 200, body: 'ok' });\n`);
      writeFileSync(join(mockAppDir, '.forge-sim', 'mocks.json'), JSON.stringify({
        jira: {
          'POST /rest/api/3/issue': { id: '10001', key: 'MOCK-1' },
          'GET /rest/api/3/issue/GONE-1': { __forgeSimMockResponse: true, status: 404, body: { errorMessages: ['gone'] } },
        },
      }));
    });

    afterAll(() => {
      rmSync(mockAppDir, { recursive: true, force: true });
    });

    /** The routes the file declares answer from the mock (afterEach asserts no real HTTP). */
    async function expectFileMocksAnswer() {
      const created = await sim.productApi.request('jira', '/rest/api/3/issue', { method: 'POST', body: '{}' });
      expect(created.status).toBe(200);
      expect(await created.json()).toEqual({ id: '10001', key: 'MOCK-1' });
      const gone = await sim.productApi.request('jira', '/rest/api/3/issue/GONE-1');
      expect(gone.status).toBe(404);
    }

    it('connected dev: /api/reset re-applies the file BEFORE reconnecting — a mocked write never reaches the site', async () => {
      ({ server, port } = await start(sim, { connectByDefault: true, appDir: mockAppDir, reapplyMockFile: true }));
      // Dev boot applies the file (dev-command.ts step 4a.5), then deploys and connects.
      sim.mockProductRoutes('jira', { 'POST /rest/api/3/issue': { id: '10001', key: 'MOCK-1' } });
      await post(port, '/api/deploy', { appDir: mockAppDir });
      expect(sim.productApi.isRealMode).toBe(true);

      // The order matters to a request in flight while /api/reset awaits
      // the reconnect: the file's routes must already be back by then.
      const routesAtReconnect: string[][] = [];
      const load = sim.loadAuthFromEnv.bind(sim);
      vi.spyOn(sim, 'loadAuthFromEnv').mockImplementation(() => {
        routesAtReconnect.push(sim.productApi.getMockRoutes('jira'));
        return load();
      });
      const reset = await post(port, '/api/reset', {});
      expect(routesAtReconnect).toEqual([['POST /rest/api/3/issue', 'GET /rest/api/3/issue/GONE-1']]);
      expect(reset.body.auth.atlassian).toMatchObject({ connected: true, site: SITE });
      expect(reset.body.mockFile).toEqual({ applied: { products: { jira: 2 }, graphqlOperations: 0 } });
      expect(sim.productApi.isRealMode).toBe(true);
      await expectFileMocksAnswer();
    });

    it('connected dev: a resetting /api/deploy re-applies the file too', async () => {
      ({ server, port } = await start(sim, { connectByDefault: true, appDir: mockAppDir, reapplyMockFile: true }));
      const res = await post(port, '/api/deploy', { appDir: mockAppDir });
      expect(res.body.mockFile.applied.products).toEqual({ jira: 2 });
      expect(sim.productApi.isRealMode).toBe(true);
      await expectFileMocksAnswer();
    });

    it('connected dev: a resetting /api/deploy that throws resets nothing, so the file\'s mocks and the connection stand', async () => {
      ({ server, port } = await start(sim, { connectByDefault: true, appDir: mockAppDir, reapplyMockFile: true }));
      await post(port, '/api/deploy', { appDir: mockAppDir });
      failNextDeploy(sim);
      const res = await post(port, '/api/deploy', { appDir: mockAppDir });
      expect(res.status).toBe(500);
      // The reset belongs to deploy() and waits for a successful build: a
      // failed deploy leaves the previous one running, mocks included, so
      // there was nothing to re-apply and the response does not claim one.
      expect(res.body.mockFile).toBeUndefined();
      expect(sim.productApi.isRealMode).toBe(true);
      await expectFileMocksAnswer();
    });

    it('offline dev re-applies the file as well (same mock set either way)', async () => {
      ({ server, port } = await start(sim, { connectByDefault: false, appDir: mockAppDir, reapplyMockFile: true }));
      await post(port, '/api/reset', {});
      expect(sim.productApi.isRealMode).toBe(false);
      await expectFileMocksAnswer();
    });

    it('a handler that reconnects re-applies the file even when nobody passed reapplyMockFile', async () => {
      ({ server, port } = await start(sim, { connectByDefault: true, appDir: mockAppDir }));
      await post(port, '/api/deploy', { appDir: mockAppDir });
      const reset = await post(port, '/api/reset', {});
      expect(reset.body.mockFile.applied.products).toEqual({ jira: 2 });
      expect(sim.productApi.isRealMode).toBe(true);
      await expectFileMocksAnswer();
    });

    it('the daemon (no reapplyMockFile) leaves mocks.json alone, as before', async () => {
      ({ server, port } = await start(sim));
      const res = await post(port, '/api/reset', {});
      expect(res.body.mockFile).toBeUndefined();
      expect(sim.productApi.getMockRoutes('jira')).toEqual([]);
    });

    it('a broken mocks.json is reported in the response, not thrown', async () => {
      const brokenDir = mkdtempSync(join(tmpdir(), 'forge-sim-tools-connect-broken-'));
      try {
        mkdirSync(join(brokenDir, '.forge-sim'), { recursive: true });
        writeFileSync(join(brokenDir, '.forge-sim', 'mocks.json'), '{ not json');
        ({ server, port } = await start(sim, { connectByDefault: false, appDir: brokenDir, reapplyMockFile: true }));
        const res = await post(port, '/api/reset', {});
        expect(res.body.success).toBe(true);
        expect(res.body.mockFile.error).toMatch(/mocks\.json is not valid JSON/);
      } finally {
        rmSync(brokenDir, { recursive: true, force: true });
      }
    });
  });
});

describe('provider OAuth start: the missing-secret message fits the channel', () => {
  const PROVIDER_MANIFEST = `
modules:
  function:
    - key: fn
      handler: index.run
app:
  id: ari:cloud:ecosystem::app/tools-api-connect-provider
  runtime:
    name: nodejs22.x
permissions:
  scopes: []
  external:
    fetch:
      backend:
        - remote: google-apis
providers:
  auth:
    - key: google
      name: Google
      type: oauth2
      clientId: cid
      scopes:
        - openid
      remotes:
        - google-apis
      bearerMethod: authorization-header
      actions:
        authorization:
          remote: google-account
          path: /o/oauth2/v2/auth
        exchange:
          remote: google-oauth
          path: /token
        retrieveProfile:
          remote: google-apis
          path: /userinfo/v2/me
          resolvers:
            id: id
            displayName: email
remotes:
  - key: google-apis
    baseUrl: https://api.forge-sim-test.invalid
  - key: google-account
    baseUrl: https://accounts.forge-sim-test.invalid
  - key: google-oauth
    baseUrl: https://oauth.forge-sim-test.invalid
`;
  let providerAppDir: string;
  let sim: ForgeSimulator;
  let server: Server;
  let port: number;

  beforeAll(() => {
    providerAppDir = mkdtempSync(join(tmpdir(), 'forge-sim-tools-connect-provider-'));
    mkdirSync(join(providerAppDir, 'src'), { recursive: true });
    writeFileSync(join(providerAppDir, 'manifest.yml'), PROVIDER_MANIFEST);
    writeFileSync(join(providerAppDir, 'src', 'index.js'), `export const run = async () => 'ok';\n`);
  });

  afterAll(() => {
    rmSync(providerAppDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    sim = createSimulator();
  });

  afterEach(async () => {
    await new Promise<void>((res) => server.close(() => res()));
    await sim.stop();
    expect(realHttp).not.toHaveBeenCalled();
  });

  async function startFlow(options: CreateApiHandlerOptions) {
    ({ server, port } = await start(sim, options));
    await post(port, '/api/deploy', { appDir: providerAppDir });
    return post(port, '/api/providers/google/start', {});
  }

  it('offline (dev --offline / daemon): "restart dev" alone would not help — names --offline', async () => {
    const res = await startFlow({ connectByDefault: false, appDir: providerAppDir });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('forge-sim auth --provider google --secret');
    expect(res.body.error).toContain('without --offline');
    expect(res.body.error).toContain('forge-sim deploy --connect');
  });

  it('connected dev: set the secret, then a Tools-UI reset reloads it', async () => {
    const res = await startFlow({ connectByDefault: true, appDir: providerAppDir });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/--secret` then reset from the Tools UI \(or restart dev\)\.$/);
  });

  // A refresh or an OAuth exchange replaces the token OBJECT, so unloadAuth()
  // tracks provenance, not identity: a stored token refreshed while connected
  // (withProvider refreshes on use) must not survive an offline deploy and
  // keep sending its bearer token to the provider.
  describe('a provider token derived from a loaded credential is unloaded with it', () => {
    let derivedAppDir: string;
    /** The provider's token endpoint answers; its optional profile lookup 404s; anything else throws. */
    const oauth = vi.fn(async (input: unknown, init?: { body?: unknown }) => {
      const url = String(input);
      if (url === 'https://oauth.forge-sim-test.invalid/token') {
        const grant = new URLSearchParams(String(init?.body)).get('grant_type');
        const accessToken = grant === 'refresh_token' ? 'refreshed-token' : 'exchanged-token';
        return new Response(JSON.stringify({ access_token: accessToken, expires_in: 3600 }), {
          status: 200, headers: { 'content-type': 'application/json' },
        });
      }
      if (url === 'https://api.forge-sim-test.invalid/userinfo/v2/me') return new Response('{}', { status: 404 });
      throw new Error(`unexpected HTTP in a hermetic test: ${url}`);
    });

    beforeAll(() => {
      derivedAppDir = mkdtempSync(join(tmpdir(), 'forge-sim-tools-connect-derived-'));
      mkdirSync(join(derivedAppDir, 'src'), { recursive: true });
      mkdirSync(join(derivedAppDir, '.forge-sim'), { recursive: true });
      writeFileSync(join(derivedAppDir, 'manifest.yml'), PROVIDER_MANIFEST);
      writeFileSync(join(derivedAppDir, 'src', 'index.js'), `export const run = async () => 'ok';\n`);
      // App-local store (read before the temp HOME's): an expired, refreshable google token.
      writeFileSync(join(derivedAppDir, '.forge-sim', 'credentials.json'), JSON.stringify({
        accounts: STORE.accounts,
        thirdParty: { 'stored-1': { google: {
          provider: 'google', accessToken: 'stored-expired', refreshToken: 'stored-refresh',
          expiresAt: Date.now() - 1000, scopes: ['openid'],
        } } },
      }));
      writeFileSync(join(derivedAppDir, '.forge-sim', 'providers.json'), JSON.stringify({ google: { clientSecret: 'stored-secret' } }));
    });

    afterAll(() => {
      rmSync(derivedAppDir, { recursive: true, force: true });
    });

    afterEach(() => {
      vi.stubGlobal('fetch', realHttp);
    });

    /** `forge-sim deploy --connect`, then the manifest providers (wired by hand: deploy() does not load them), then the token endpoint stub. */
    async function connect() {
      ({ server, port } = await start(sim));
      const res = await post(port, '/api/deploy', { appDir: derivedAppDir, connect: true });
      expect(res.body.auth.providers).toEqual(['google']);
      vi.stubGlobal('fetch', oauth);
    }

    it('a stored token refreshed while connected is gone after an offline deploy', async () => {
      await connect();
      // What seam-fetch's withProvider path calls before every provider fetch.
      expect((await sim.externalAuth.ensureValidToken('google'))?.accessToken).toBe('refreshed-token');
      // Refreshed again (a second expiry): still derived from the loaded token.
      sim.externalAuth.getToken('google')!.expiresAt = Date.now() - 1000;
      expect((await sim.externalAuth.ensureValidToken('google'))?.accessToken).toBe('refreshed-token');
      vi.stubGlobal('fetch', realHttp);

      const res = await post(port, '/api/deploy', { appDir: derivedAppDir });
      expect(sim.externalAuth.getToken('google')).toBeUndefined();
      expect(res.body.disconnected.providers).toEqual(['google']);
    });

    it('a token an OAuth flow exchanged with the loaded client secret is gone after a reset', async () => {
      await connect();
      const exchanged = await sim.externalAuth.exchangeCode('google', 'code-1', 'http://localhost/__tools/oauth/callback');
      expect(exchanged?.accessToken).toBe('exchanged-token');
      vi.stubGlobal('fetch', realHttp);

      const res = await post(port, '/api/reset', {});
      expect(sim.externalAuth.getToken('google')).toBeUndefined();
      expect(res.body.disconnected.providers).toEqual(['google']);
    });

    it('a token exchanged with a client secret set some other way is kept', async () => {
      await connect();
      sim.externalAuth.setSecret('google', 'test-own-secret');
      const exchanged = await sim.externalAuth.exchangeCode('google', 'code-2', 'http://localhost/__tools/oauth/callback');
      vi.stubGlobal('fetch', realHttp);

      const res = await post(port, '/api/deploy', { appDir: derivedAppDir });
      expect(sim.externalAuth.getToken('google')).toBe(exchanged);
      expect(sim.externalAuth.getSecret('google')).toBe('test-own-secret');
      expect(res.body.disconnected).toMatchObject({ atlassian: SITE, providers: [], providerSecrets: 0 });
    });
  });
});
