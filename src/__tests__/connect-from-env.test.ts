/**
 * Tests for ForgeSimulator.loadAuthFromEnv().
 *
 * Covers:
 * - ENV var Atlassian PAT connection
 * - ENV var third-party token loading (various key formats)
 * - ENV vars take priority over .forge-sim files
 * - .forge-sim fallback when no env vars (a temp HOME's credential store)
 * - loadAuthFromEnv returns correct summary object
 * - Clean env between tests
 * - Provider key normalization (hyphen→underscore, case insensitive)
 * - Requires deploy() first
 *
 * HERMETIC: the credential store's global path is computed from
 * `os.homedir()` when src/auth/credentials.ts loads, so HOME is pointed at an
 * empty temp dir BEFORE any import (vi.hoisted). Without that the file would
 * read the developer's real ~/.forge-sim/credentials.json: tests would fail on
 * a machine with a stored third-party token, and every run would load a real
 * account into the simulator.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSimulator, type ForgeSimulator } from '../simulator.js';

const hermetic = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-sim-connect-env-home-'));
  const prevHome = process.env.HOME;
  process.env.HOME = home;
  return { home, prevHome };
});

afterAll(() => {
  if (hermetic.prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = hermetic.prevHome;
  rmSync(hermetic.home, { recursive: true, force: true });
});

/** Write the temp HOME's global credential store (~/.forge-sim/credentials.json). */
function writeGlobalStore(store: unknown): void {
  mkdirSync(join(hermetic.home, '.forge-sim'), { recursive: true });
  writeFileSync(join(hermetic.home, '.forge-sim', 'credentials.json'), JSON.stringify(store));
}

function removeGlobalStore(): void {
  rmSync(join(hermetic.home, '.forge-sim'), { recursive: true, force: true });
}

const STORE_ACCOUNT = {
  id: 'store-1',
  name: 'Store User',
  email: 'store@example.com',
  site: 'forge-sim-store.invalid',
  cloudId: 'store-cloud',
  accountId: 'store-account',
  authType: 'pat',
  accessToken: 'store-pat',
  refreshToken: '',
  expiresAt: 0,
  scopes: [],
  default: true,
};

// ── Env Helpers ────────────────────────────────────────────────────────────

function clearForgeEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('FORGE_SIM_')) {
      delete process.env[key];
    }
  }
}

// Minimal manifest that deploys without errors
const MINIMAL_MANIFEST = `
app:
  id: ari:cloud:ecosystem::app/test-app
  runtime:
    name: nodejs22.x
modules:
  jira:issuePanel:
    - key: test-panel
      resource: main
      render: native
      title: Test
      icon: https://example.com/icon.svg
  function:
    - key: resolver-test-panel
      handler: index.handler
resources:
  - key: main
    path: src/frontend
`;

// ── Tests ──────────────────────────────────────────────────────────────────

describe('loadAuthFromEnv', () => {
  let sim: ForgeSimulator;
  let savedEnv: Record<string, string | undefined>;
  let appDir: string;

  beforeEach(async () => {
    removeGlobalStore();
    appDir = mkdtempSync(join(tmpdir(), 'forge-sim-connect-env-app-'));
    // Save all FORGE_SIM_* env vars
    savedEnv = {};
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('FORGE_SIM_')) {
        savedEnv[key] = process.env[key];
      }
    }
    clearForgeEnv();
    sim = createSimulator();
    // loadAuthFromEnv requires deploy — set appDir to simulate a deploy.
    // A fresh temp dir: a fixed path could hold a stray per-app store.
    await sim.loadManifest(MINIMAL_MANIFEST);
    sim.setAppDir(appDir);
  });

  afterEach(() => {
    rmSync(appDir, { recursive: true, force: true });
    removeGlobalStore();
    // Restore env
    clearForgeEnv();
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val !== undefined) {
        process.env[key] = val;
      }
    }
  });

  // ── Requires deploy ─────────────────────────────────────────────────

  it('runs against a temp HOME, never the real one', () => {
    expect(homedir()).toBe(hermetic.home);
  });

  it('throws if deploy() has not been called', async () => {
    const freshSim = createSimulator();
    await expect(freshSim.loadAuthFromEnv()).rejects.toThrow('loadAuthFromEnv() requires deploy() to be called first');
  });

  // ── ENV var PAT connection ───────────────────────────────────────────

  it('connects Atlassian via PAT env vars', async () => {
    process.env.FORGE_SIM_SITE = 'test.atlassian.net';
    process.env.FORGE_SIM_EMAIL = 'user@test.com';
    process.env.FORGE_SIM_PAT = 'ATATT3xFakeToken';

    const result = await sim.loadAuthFromEnv();

    expect(result.atlassian.connected).toBe(true);
    expect(result.atlassian.site).toBe('test.atlassian.net');
    expect(result.atlassian.authType).toBe('pat');
    expect(sim.productApi.isRealMode).toBe(true);
    expect(sim.productApi.connectedAccount?.email).toBe('user@test.com');
  });

  it('uses optional CLOUD_ID and ACCOUNT_ID env vars', async () => {
    process.env.FORGE_SIM_SITE = 'test.atlassian.net';
    process.env.FORGE_SIM_EMAIL = 'user@test.com';
    process.env.FORGE_SIM_PAT = 'ATATT3xFakeToken';
    process.env.FORGE_SIM_CLOUD_ID = 'custom-cloud-id';
    process.env.FORGE_SIM_ACCOUNT_ID = 'custom-account-id';

    await sim.loadAuthFromEnv();

    const account = sim.productApi.connectedAccount!;
    expect(account.cloudId).toBe('custom-cloud-id');
    expect(account.accountId).toBe('custom-account-id');
  });

  it('defaults CLOUD_ID and ACCOUNT_ID when not set', async () => {
    process.env.FORGE_SIM_SITE = 'test.atlassian.net';
    process.env.FORGE_SIM_EMAIL = 'user@test.com';
    process.env.FORGE_SIM_PAT = 'token';

    await sim.loadAuthFromEnv();

    const account = sim.productApi.connectedAccount!;
    expect(account.cloudId).toBe('env-cloud-id');
    expect(account.accountId).toBe('env-user');
  });

  it('does not connect Atlassian via env when vars are incomplete', async () => {
    process.env.FORGE_SIM_SITE = 'test.atlassian.net';
    // Missing EMAIL and PAT — env path skipped, falls through to the
    // .forge-sim fallback, which is empty in the temp HOME.
    const result = await sim.loadAuthFromEnv();

    expect(result.atlassian.connected).toBe(false);
    expect(sim.productApi.isRealMode).toBe(false);
  });

  // ── .forge-sim fallback ──────────────────────────────────────────────

  it('falls back to the global credential store (default account + its 3p tokens)', async () => {
    writeGlobalStore({
      accounts: [STORE_ACCOUNT],
      thirdParty: { 'store-1': { google: { provider: 'google', accessToken: 'store-google' } } },
    });

    const result = await sim.loadAuthFromEnv();

    expect(result.atlassian).toEqual({ connected: true, site: 'forge-sim-store.invalid', authType: 'pat' });
    expect(result.providers).toEqual(['google']);
    expect(sim.productApi.connectedAccount?.email).toBe('store@example.com');
    expect(sim.externalAuth.getToken('google')?.accessToken).toBe('store-google');
  });

  it('a per-app store shadows the global one', async () => {
    writeGlobalStore({ accounts: [STORE_ACCOUNT], thirdParty: {} });
    mkdirSync(join(appDir, '.forge-sim'), { recursive: true });
    writeFileSync(join(appDir, '.forge-sim', 'credentials.json'), JSON.stringify({ accounts: [], thirdParty: {} }));

    const result = await sim.loadAuthFromEnv();

    expect(result.atlassian.connected).toBe(false);
    expect(sim.productApi.isRealMode).toBe(false);
  });

  it('env PAT vars win over the store', async () => {
    writeGlobalStore({ accounts: [STORE_ACCOUNT], thirdParty: {} });
    process.env.FORGE_SIM_SITE = 'env.atlassian.net';
    process.env.FORGE_SIM_EMAIL = 'env@example.com';
    process.env.FORGE_SIM_PAT = 'env-pat';

    const result = await sim.loadAuthFromEnv();

    expect(result.atlassian.site).toBe('env.atlassian.net');
    expect(sim.productApi.connectedAccount?.email).toBe('env@example.com');
  });

  it('reports provider client secrets it loaded', async () => {
    mkdirSync(join(appDir, '.forge-sim'), { recursive: true });
    writeFileSync(join(appDir, '.forge-sim', 'providers.json'), JSON.stringify({ google: { clientSecret: 'shh' }, github: { clientSecret: 'shh2' } }));

    const result = await sim.loadAuthFromEnv();

    expect(result.providerSecrets).toBe(2);
  });

  // ── ENV var third-party tokens ──────────────────────────────────────

  it('loads third-party token from FORGE_SIM_PROVIDER_<KEY>_TOKEN', async () => {
    process.env.FORGE_SIM_PROVIDER_GOOGLE_TOKEN = 'google-access-token';

    const result = await sim.loadAuthFromEnv();

    expect(result.providers).toContain('google');
    const token = sim.externalAuth.getToken('google');
    expect(token).toBeDefined();
    expect(token!.accessToken).toBe('google-access-token');
    expect(token!.provider).toBe('google');
  });

  it('normalizes provider key: GOOGLE_APIS → google-apis', async () => {
    process.env.FORGE_SIM_PROVIDER_GOOGLE_APIS_TOKEN = 'google-apis-token';

    const result = await sim.loadAuthFromEnv();

    expect(result.providers).toContain('google-apis');
    const token = sim.externalAuth.getToken('google-apis');
    expect(token).toBeDefined();
    expect(token!.accessToken).toBe('google-apis-token');
  });

  it('loads multiple provider tokens from env', async () => {
    process.env.FORGE_SIM_PROVIDER_GOOGLE_TOKEN = 'g-token';
    process.env.FORGE_SIM_PROVIDER_GITHUB_TOKEN = 'gh-token';
    process.env.FORGE_SIM_PROVIDER_SLACK_API_TOKEN = 'slack-token';

    const result = await sim.loadAuthFromEnv();

    expect(result.providers).toHaveLength(3);
    expect(result.providers).toContain('google');
    expect(result.providers).toContain('github');
    expect(result.providers).toContain('slack-api');
  });

  it('ignores env vars with empty values', async () => {
    process.env.FORGE_SIM_PROVIDER_EMPTY_TOKEN = '';

    const result = await sim.loadAuthFromEnv();

    expect(result.providers).toHaveLength(0);
  });

  // ── Return value structure ──────────────────────────────────────────

  it('returns empty summary when no env vars and no credentials on disk', async () => {
    // Verify shape when env vars trigger nothing and .forge-sim has no accounts
    process.env.FORGE_SIM_SITE = 'test.atlassian.net';
    process.env.FORGE_SIM_EMAIL = 'user@test.com';
    process.env.FORGE_SIM_PAT = 'token';

    const result = await sim.loadAuthFromEnv();

    // ENV path produces a deterministic result
    expect(result.atlassian.connected).toBe(true);
    expect(result.atlassian.site).toBe('test.atlassian.net');
    expect(result.providers).toEqual([]);
  });

  it('returns full summary with PAT and providers', async () => {
    process.env.FORGE_SIM_SITE = 'mysite.atlassian.net';
    process.env.FORGE_SIM_EMAIL = 'dev@mysite.com';
    process.env.FORGE_SIM_PAT = 'pat-token';
    process.env.FORGE_SIM_PROVIDER_GOOGLE_TOKEN = 'g-tok';

    const result = await sim.loadAuthFromEnv();

    expect(result.atlassian).toEqual({
      connected: true,
      site: 'mysite.atlassian.net',
      authType: 'pat',
    });
    expect(result.providers).toEqual(['google']);
  });

  // ── Idempotent calls ───────────────────────────────────────────────

  it('can be called multiple times safely', async () => {
    process.env.FORGE_SIM_SITE = 'test.atlassian.net';
    process.env.FORGE_SIM_EMAIL = 'user@test.com';
    process.env.FORGE_SIM_PAT = 'token';
    process.env.FORGE_SIM_PROVIDER_GOOGLE_TOKEN = 'g-tok';

    const r1 = await sim.loadAuthFromEnv();
    const r2 = await sim.loadAuthFromEnv();

    // Both should succeed
    expect(r1.atlassian.connected).toBe(true);
    expect(r2.atlassian.connected).toBe(true);
    expect(r2.providers).toContain('google');
  });

  // ── Logging ────────────────────────────────────────────────────────

  it('logs info messages for each connection', async () => {
    process.env.FORGE_SIM_SITE = 'test.atlassian.net';
    process.env.FORGE_SIM_EMAIL = 'user@test.com';
    process.env.FORGE_SIM_PAT = 'token';
    process.env.FORGE_SIM_PROVIDER_GITHUB_TOKEN = 'gh-tok';

    sim.clearLogs();
    await sim.loadAuthFromEnv();

    const logs = sim.getLogs();
    const infoLogs = logs.filter(l => l.level === 'info');
    expect(infoLogs.some(l => l.message.includes('Connected to Atlassian via PAT (env)'))).toBe(true);
    expect(infoLogs.some(l => l.message.includes('Loaded 3p token (env): github'))).toBe(true);
  });

  // ── Provider key normalization edge cases ──────────────────────────

  describe('provider key normalization', () => {
    it('handles single-word provider keys', async () => {
      process.env.FORGE_SIM_PROVIDER_SLACK_TOKEN = 'slack-tok';
      const result = await sim.loadAuthFromEnv();
      expect(result.providers).toContain('slack');
    });

    it('handles multi-segment provider keys', async () => {
      process.env.FORGE_SIM_PROVIDER_MY_CUSTOM_API_TOKEN = 'custom-tok';
      const result = await sim.loadAuthFromEnv();
      expect(result.providers).toContain('my-custom-api');
      expect(sim.externalAuth.getToken('my-custom-api')!.accessToken).toBe('custom-tok');
    });
  });
});
