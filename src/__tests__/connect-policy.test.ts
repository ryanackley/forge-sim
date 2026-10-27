/**
 * One connect policy for every channel.
 *
 * `forge-sim dev` connects by default (`--offline` to skip); the MCP server
 * and the CLI daemon are opt-in (`--connect`). FORGE_SIM_CONNECT forces either
 * way, and a flag beats the env. Contradictions and unknown env values throw
 * instead of guessing — a wrong guess toward "connect" sends real traffic.
 *
 * HERMETIC: findAvailableCredentials reads the credential store, whose global
 * path comes from os.homedir() when credentials.ts loads, so HOME points at a
 * temp dir before any import.
 */
import { describe, it, expect, afterAll, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  resolveConnectPolicy,
  describeConnectPolicy,
  findAvailableCredentials,
  connectHint,
  CONNECT_ENV,
  CONNECT_DEFAULTS,
  type ConnectChannel,
} from '../auth/connect-policy.js';

const hermetic = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-sim-connect-policy-home-'));
  const prevHome = process.env.HOME;
  process.env.HOME = home;
  return { home, prevHome };
});

afterAll(() => {
  if (hermetic.prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = hermetic.prevHome;
  rmSync(hermetic.home, { recursive: true, force: true });
});

const CHANNELS: ConnectChannel[] = ['dev', 'mcp', 'cli'];

describe('resolveConnectPolicy — channel × flags × env', () => {
  it('defaults: only dev connects', () => {
    expect(CONNECT_DEFAULTS).toEqual({ dev: true, mcp: false, cli: false });
    for (const channel of CHANNELS) {
      expect(resolveConnectPolicy(channel, { env: {} })).toEqual({
        channel,
        connect: channel === 'dev',
        source: 'default',
      });
    }
  });

  type Row = {
    name: string;
    connectFlag?: boolean;
    offlineFlag?: boolean;
    envValue?: string;
    expect: (channel: ConnectChannel) => { connect: boolean; source: 'flag' | 'env' | 'default' };
  };

  const rows: Row[] = [
    { name: 'no flag, no env', expect: (c) => ({ connect: CONNECT_DEFAULTS[c], source: 'default' }) },
    { name: '--connect', connectFlag: true, expect: () => ({ connect: true, source: 'flag' }) },
    { name: '--offline', offlineFlag: true, expect: () => ({ connect: false, source: 'flag' }) },
    { name: 'env 1', envValue: '1', expect: () => ({ connect: true, source: 'env' }) },
    { name: 'env true', envValue: 'true', expect: () => ({ connect: true, source: 'env' }) },
    { name: 'env YES (case-insensitive)', envValue: 'YES', expect: () => ({ connect: true, source: 'env' }) },
    { name: 'env " on " (trimmed)', envValue: ' on ', expect: () => ({ connect: true, source: 'env' }) },
    { name: 'env 0', envValue: '0', expect: () => ({ connect: false, source: 'env' }) },
    { name: 'env false', envValue: 'false', expect: () => ({ connect: false, source: 'env' }) },
    { name: 'env no', envValue: 'no', expect: () => ({ connect: false, source: 'env' }) },
    { name: 'env off', envValue: 'off', expect: () => ({ connect: false, source: 'env' }) },
    { name: 'env empty = unset', envValue: '', expect: (c) => ({ connect: CONNECT_DEFAULTS[c], source: 'default' }) },
    { name: '--offline beats env 1', offlineFlag: true, envValue: '1', expect: () => ({ connect: false, source: 'flag' }) },
    { name: '--connect beats env 0', connectFlag: true, envValue: '0', expect: () => ({ connect: true, source: 'flag' }) },
    { name: '--offline beats an invalid env value', offlineFlag: true, envValue: 'maybe', expect: () => ({ connect: false, source: 'flag' }) },
  ];

  for (const row of rows) {
    for (const channel of CHANNELS) {
      it(`${channel}: ${row.name}`, () => {
        const env: NodeJS.ProcessEnv = row.envValue === undefined ? {} : { [CONNECT_ENV]: row.envValue };
        const policy = resolveConnectPolicy(channel, {
          connectFlag: row.connectFlag,
          offlineFlag: row.offlineFlag,
          env,
        });
        expect(policy).toEqual({ channel, ...row.expect(channel) });
      });
    }
  }

  it('reads process.env when no env is passed', () => {
    const prev = process.env[CONNECT_ENV];
    try {
      process.env[CONNECT_ENV] = '1';
      expect(resolveConnectPolicy('mcp')).toEqual({ channel: 'mcp', connect: true, source: 'env' });
      delete process.env[CONNECT_ENV];
      expect(resolveConnectPolicy('mcp')).toEqual({ channel: 'mcp', connect: false, source: 'default' });
    } finally {
      if (prev === undefined) delete process.env[CONNECT_ENV];
      else process.env[CONNECT_ENV] = prev;
    }
  });
});

describe('resolveConnectPolicy — refuses to guess', () => {
  it('--connect with --offline throws a copy-pasteable message', () => {
    for (const channel of CHANNELS) {
      expect(() => resolveConnectPolicy(channel, { connectFlag: true, offlineFlag: true, env: {} }))
        .toThrow(/--connect and --offline cannot be used together/);
    }
    expect(() => resolveConnectPolicy('mcp', { connectFlag: true, offlineFlag: true, env: {} }))
      .toThrow(/forge-sim-mcp --connect/);
  });

  it('an unrecognised FORGE_SIM_CONNECT value throws, naming the accepted values', () => {
    let message = '';
    try {
      resolveConnectPolicy('dev', { env: { [CONNECT_ENV]: 'maybe' } });
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toContain('FORGE_SIM_CONNECT="maybe" is not a recognised value');
    expect(message).toContain('FORGE_SIM_CONNECT=1');
    expect(message).toContain('FORGE_SIM_CONNECT=0');
    expect(message).toMatch(/true, yes, on/);
    expect(message).toMatch(/false, no, off/);
  });
});

describe('describeConnectPolicy — one line per state', () => {
  it('says offline (opt-in) and how to connect for an MCP default', () => {
    const line = describeConnectPolicy(resolveConnectPolicy('mcp', { env: {} }));
    expect(line).toMatch(/^credentials: offline \(opt-in\)/);
    expect(line).toContain('--connect');
    expect(line).toContain('FORGE_SIM_CONNECT=1');
    expect(line).not.toContain('\n');
  });

  it('says what connecting means for MCP --connect', () => {
    const line = describeConnectPolicy(resolveConnectPolicy('mcp', { connectFlag: true, env: {} }));
    expect(line).toMatch(/^credentials: --connect — forge_deploy loads stored credentials/);
    expect(line).toContain('unmocked product API calls reach the real site');
  });

  it('dev default mentions --offline; dev --offline says nothing is loaded', () => {
    expect(describeConnectPolicy(resolveConnectPolicy('dev', { env: {} }))).toContain('--offline to skip');
    expect(describeConnectPolicy(resolveConnectPolicy('dev', { offlineFlag: true, env: {} })))
      .toMatch(/^credentials: --offline — stored credentials are not loaded/);
  });

  it('env-driven states name the env var', () => {
    expect(describeConnectPolicy(resolveConnectPolicy('cli', { env: { [CONNECT_ENV]: '1' } }))).toContain('FORGE_SIM_CONNECT on');
    expect(describeConnectPolicy(resolveConnectPolicy('dev', { env: { [CONNECT_ENV]: '0' } }))).toContain('FORGE_SIM_CONNECT off');
  });

  it('connectHint tells each channel how to turn it on', () => {
    // Not a whole args array: under npx (the plugin's .mcp.json) the flag goes after the binary.
    expect(connectHint({ channel: 'mcp', source: 'default' })).toContain(`add it to the server's "args" in .mcp.json`);
    expect(connectHint({ channel: 'mcp', source: 'default' })).not.toContain('["--connect"]');
    expect(connectHint({ channel: 'mcp', source: 'default' })).toContain('FORGE_SIM_CONNECT=1');
    expect(connectHint({ channel: 'cli', source: 'default' })).toContain('forge-sim deploy --connect');
    expect(connectHint({ channel: 'dev', source: 'flag' })).toContain('without --offline');
  });

  // A flag beats the env, so after --offline "set FORGE_SIM_CONNECT=1" is a
  // hint that does nothing — no channel's hint or banner may suggest it.
  it.each(['mcp', 'cli', 'dev'] as const)('%s after --offline: the hint never suggests the env var', (channel) => {
    const policy = resolveConnectPolicy(channel, { offlineFlag: true, env: { [CONNECT_ENV]: '1' } });
    expect(policy.connect).toBe(false);
    const hint = connectHint(policy);
    expect(hint).not.toContain('FORGE_SIM_CONNECT=1');
    expect(hint).toMatch(/--offline/);
    expect(describeConnectPolicy(policy)).not.toContain('FORGE_SIM_CONNECT=1');
  });

  it.each(['mcp', 'cli', 'dev'] as const)('%s with FORGE_SIM_CONNECT=0: the hint offers --connect, which beats it', (channel) => {
    const policy = resolveConnectPolicy(channel, { env: { [CONNECT_ENV]: '0' } });
    expect(policy).toMatchObject({ connect: false, source: 'env' });
    const hint = connectHint(policy);
    expect(hint).toContain('--connect');
    expect(hint).toMatch(/beats FORGE_SIM_CONNECT=0/);
    // And following the hint really connects.
    expect(resolveConnectPolicy(channel, { connectFlag: true, env: { [CONNECT_ENV]: '0' } }).connect).toBe(true);
  });

  it('dev: forge-sim dev --connect is named as the override', () => {
    expect(connectHint({ channel: 'dev', source: 'env' })).toContain('forge-sim dev with --connect');
  });
});

describe('findAvailableCredentials — probes without connecting', () => {
  const account = {
    id: 'a1', name: 'A', email: 'a@example.com', site: 'forge-sim-test.invalid',
    cloudId: 'c', accountId: 'acc', authType: 'pat', accessToken: 't',
    refreshToken: '', expiresAt: 0, scopes: [], default: true,
  };

  it('runs against a temp HOME, never the real one', () => {
    expect(homedir()).toBe(hermetic.home);
  });

  it('null when nothing is stored and the env trio is incomplete', async () => {
    expect(await findAvailableCredentials(null, { FORGE_SIM_SITE: 'x.invalid' })).toBeNull();
  });

  it('reports the env trio first', async () => {
    expect(await findAvailableCredentials(null, {
      FORGE_SIM_SITE: 'env.invalid', FORGE_SIM_EMAIL: 'e@example.com', FORGE_SIM_PAT: 'p',
    })).toEqual({ site: 'env.invalid', email: 'e@example.com', source: 'env' });
  });

  it('reports the global store default account, and a per-app store shadows it', async () => {
    mkdirSync(join(hermetic.home, '.forge-sim'), { recursive: true });
    writeFileSync(
      join(hermetic.home, '.forge-sim', 'credentials.json'),
      JSON.stringify({ accounts: [account], thirdParty: {} }),
    );
    const appDir = mkdtempSync(join(tmpdir(), 'forge-sim-connect-policy-app-'));
    try {
      expect(await findAvailableCredentials(appDir, {})).toEqual({
        site: 'forge-sim-test.invalid', email: 'a@example.com', source: 'store',
      });
      mkdirSync(join(appDir, '.forge-sim'), { recursive: true });
      writeFileSync(join(appDir, '.forge-sim', 'credentials.json'), JSON.stringify({ accounts: [], thirdParty: {} }));
      expect(await findAvailableCredentials(appDir, {})).toBeNull();
    } finally {
      rmSync(appDir, { recursive: true, force: true });
      rmSync(join(hermetic.home, '.forge-sim'), { recursive: true, force: true });
    }
  });
});
