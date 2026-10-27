/**
 * `forge-sim dev` is the one channel that connects by default: it is where a
 * person explores an app in a browser and will not mock every call, and it
 * announces the connection on the console. `--offline` (or
 * FORGE_SIM_CONNECT=0) turns it off.
 *
 * Step 4c of devCommand is `loadDevAuth()`; these pin both branches without
 * booting a dev server. The default branch goes through
 * `sim.loadAuthFromEnv()` — the same loader MCP and the daemon use — so dev
 * honours FORGE_SIM_SITE/EMAIL/PAT as well as the credential store.
 *
 * HERMETIC: HOME is a temp dir before any import (the credential store's
 * global path is computed when credentials.ts loads). No network:
 * connectRealApis makes no request.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createSimulator, type ForgeSimulator } from '../simulator.js';
import { loadDevAuth } from '../dev-command.js';
import { assertDistFresh } from './helpers/dist-freshness.js';

const hermetic = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-sim-dev-connect-home-'));
  const prevHome = process.env.HOME;
  process.env.HOME = home;
  return { home, prevHome };
});

const SITE = 'forge-sim-test.invalid';
const AUTH_ENV = /^(FORGE_SIM_(SITE|EMAIL|PAT|CLOUD_ID|ACCOUNT_ID|CONNECT|PROVIDER_.*_TOKEN)|ANTHROPIC_API_KEY)$/;
let savedEnv: Record<string, string>;

function writeStore(): void {
  mkdirSync(join(hermetic.home, '.forge-sim'), { recursive: true });
  writeFileSync(join(hermetic.home, '.forge-sim', 'credentials.json'), JSON.stringify({
    accounts: [{
      id: 'stored-1', name: 'Stored Dev', email: 'stored@example.com', site: SITE,
      cloudId: 'stored-cloud', accountId: 'stored-account', authType: 'pat',
      accessToken: 'stored-pat', refreshToken: '', expiresAt: 0, scopes: [], default: true,
    }],
    thirdParty: { 'stored-1': { google: { provider: 'google', accessToken: 'g' } } },
  }));
}

beforeAll(() => {
  savedEnv = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (AUTH_ENV.test(k) && v !== undefined) {
      savedEnv[k] = v;
      delete process.env[k];
    }
  }
});

afterAll(() => {
  for (const k of Object.keys(process.env)) if (AUTH_ENV.test(k)) delete process.env[k];
  for (const [k, v] of Object.entries(savedEnv)) process.env[k] = v;
  if (hermetic.prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = hermetic.prevHome;
  rmSync(hermetic.home, { recursive: true, force: true });
});

describe('loadDevAuth — step 4c of forge-sim dev', () => {
  let sim: ForgeSimulator;
  let appDir: string;
  let lines: string[];

  beforeEach(() => {
    appDir = mkdtempSync(join(tmpdir(), 'forge-sim-dev-connect-app-'));
    sim = createSimulator();
    lines = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    for (const k of Object.keys(process.env)) if (AUTH_ENV.test(k)) delete process.env[k];
    rmSync(join(hermetic.home, '.forge-sim'), { recursive: true, force: true });
    rmSync(appDir, { recursive: true, force: true });
    await sim.stop();
  });

  it('runs against a temp HOME, never the real one', () => {
    expect(homedir()).toBe(hermetic.home);
  });

  it('--offline never calls loadAuthFromEnv, even with stored credentials', async () => {
    writeStore();
    const spy = vi.spyOn(sim, 'loadAuthFromEnv');

    const result = await loadDevAuth(sim, { appDir, offline: true });

    expect(result).toBeNull();
    expect(spy).not.toHaveBeenCalled();
    expect(sim.productApi.isRealMode).toBe(false);
    expect(sim.externalAuth.getToken('google')).toBeUndefined();
    expect(lines.join('\n')).toContain('🔒 Offline (--offline / FORGE_SIM_CONNECT=0): stored credentials not loaded');
    expect(lines.join('\n')).toContain('mocks and the seeded user roster still work');
  });

  it('by default it loads stored credentials through loadAuthFromEnv and announces the site', async () => {
    writeStore();
    const spy = vi.spyOn(sim, 'loadAuthFromEnv');

    const result = await loadDevAuth(sim, { appDir, offline: false });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(result?.atlassian).toMatchObject({ connected: true, site: SITE });
    expect(sim.productApi.isRealMode).toBe(true);
    const out = lines.join('\n');
    expect(out).toContain(`🔐 Real Atlassian APIs ACTIVE: ${SITE} (stored@example.com)`);
    expect(out).toContain('Unmocked product API requests from resolvers hit this site for real.');
    expect(out).toContain(`Mock routes take priority; run 'forge-sim auth' to manage accounts.`);
    expect(out).toContain('🔑 Loaded 3p token: google');
  });

  it('by default with nothing stored it says so and stays offline', async () => {
    const result = await loadDevAuth(sim, { appDir, offline: false });

    expect(result?.atlassian.connected).toBe(false);
    expect(sim.productApi.isRealMode).toBe(false);
    const out = lines.join('\n');
    expect(out).toContain('📡 No Atlassian accounts — using mock APIs');
    expect(out).toContain(`Run 'forge-sim auth' to connect to a real site`);
  });

  it('honours FORGE_SIM_SITE/EMAIL/PAT like the other channels, not only the store', async () => {
    process.env.FORGE_SIM_SITE = 'env-site.invalid';
    process.env.FORGE_SIM_EMAIL = 'env@example.com';
    process.env.FORGE_SIM_PAT = 'env-pat';

    await loadDevAuth(sim, { appDir, offline: false });

    expect(sim.productApi.connectedAccount?.site).toBe('env-site.invalid');
    expect(lines.join('\n')).toContain('🔐 Real Atlassian APIs ACTIVE: env-site.invalid (env@example.com)');
  });

  it('works when the deploy failed before setting the app dir', async () => {
    writeStore();
    expect(sim.getAppDir()).toBeNull();
    await loadDevAuth(sim, { appDir, offline: false });
    expect(sim.getAppDir()).toBe(appDir);
    expect(sim.productApi.isRealMode).toBe(true);
  });

  it('prints the provider-secret count and the LLM key line from the load result', async () => {
    mkdirSync(join(appDir, '.forge-sim'), { recursive: true });
    writeFileSync(join(appDir, '.forge-sim', 'providers.json'), JSON.stringify({ google: { clientSecret: 's' } }));
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-not-real';

    await loadDevAuth(sim, { appDir, offline: false });

    const out = lines.join('\n');
    expect(out).toContain('🔐 Loaded 1 provider secret');
    expect(out).toContain('🤖 Loaded Anthropic API key (env)');
  });
});

// ── CLI flag handling (compiled dist; exits before anything starts) ─────

const CLI = resolve(import.meta.dirname, '../../dist/cli.js');
const hasDist = existsSync(CLI);

describe.runIf(hasDist)('forge-sim dev / deploy refuse contradictory connect settings (dist, temp HOME)', () => {
  beforeAll(() => assertDistFresh(CLI));

  function run(args: string[], extraEnv: Record<string, string> = {}) {
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: hermetic.home, ...extraEnv };
    if (!('FORGE_SIM_CONNECT' in extraEnv)) delete env.FORGE_SIM_CONNECT;
    return spawnSync(process.execPath, [CLI, ...args], { env, encoding: 'utf8', timeout: 20_000 });
  }

  it('dev --connect --offline exits 1 before starting', () => {
    const r = run(['dev', '--connect', '--offline', '--no-open', tmpdir()]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('--connect and --offline cannot be used together');
    expect(r.stdout).not.toContain('forge-sim dev\n');
  });

  it('dev with an unrecognised FORGE_SIM_CONNECT exits 1 before starting', () => {
    const r = run(['dev', '--no-open', tmpdir()], { FORGE_SIM_CONNECT: 'sometimes' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('FORGE_SIM_CONNECT="sometimes" is not a recognised value');
  });

  it('deploy --connect --offline exits 1 before contacting a daemon', () => {
    const r = run(['deploy', tmpdir(), '--connect', '--offline']);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('--connect and --offline cannot be used together');
    expect(existsSync(join(hermetic.home, '.forge-sim', 'daemon.pid'))).toBe(false);
  });

  it('--help documents --offline, --connect and FORGE_SIM_CONNECT', () => {
    const r = run(['--help']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('--offline');
    expect(r.stdout).toContain('--connect');
    expect(r.stdout).toContain('FORGE_SIM_CONNECT=1');
    // Both flags under Dev Options too — dev accepts --connect (it beats
    // FORGE_SIM_CONNECT=0), so its own options list documents it.
    const devOptions = r.stdout.slice(r.stdout.indexOf('Dev Options:'), r.stdout.indexOf('Deploy Options:'));
    expect(devOptions).toContain('--offline');
    expect(devOptions).toContain('--connect');
  });
});

// ── The wiring between the pieces: each piece is tested alone above;
//    these pin that the CLI flag actually reaches them ───────────────────

describe.runIf(hasDist)('forge-sim deploy sends its connect decision to the daemon (dist, stub daemon, temp HOME)', () => {
  let stub: Server;
  let requests: Array<{ path: string; body: any }>;
  /** What the stub answers /api/deploy and /api/reset with (beyond the basics). */
  let deployExtra: Record<string, unknown>;
  let resetExtra: Record<string, unknown>;
  /** When set, /api/deploy answers this status with only `deployExtra` (a failed deploy). */
  let deployFailStatus: number | undefined;
  let appDir: string;

  beforeAll(async () => {
    assertDistFresh(CLI);
    appDir = mkdtempSync(join(tmpdir(), 'forge-sim-dev-connect-cli-app-'));
    stub = createServer((req, res) => {
      let text = '';
      req.on('data', (c) => (text += c));
      req.on('end', () => {
        const path = req.url ?? '/';
        res.setHeader('content-type', 'application/json');
        if (path === '/api/health') return res.end(JSON.stringify({ status: 'ok' }));
        requests.push({ path, body: text ? JSON.parse(text) : null });
        if (path === '/api/deploy') {
          if (deployFailStatus) {
            res.statusCode = deployFailStatus;
            return res.end(JSON.stringify(deployExtra));
          }
          return res.end(JSON.stringify({ success: true, app: { id: 'stub' }, errors: [], warnings: [], ...deployExtra }));
        }
        if (path === '/api/reset') {
          return res.end(JSON.stringify({ success: true, message: 'Simulator reset.', ...resetExtra }));
        }
        res.statusCode = 404;
        res.end('{}');
      });
    });
    await new Promise<void>((r) => stub.listen(0, '127.0.0.1', () => r()));
    const port = (stub.address() as { port: number }).port;
    // The CLI finds "its" daemon from these files; this process is alive, so
    // the pid check passes and /api/health answers — no real daemon spawns.
    mkdirSync(join(hermetic.home, '.forge-sim'), { recursive: true });
    writeFileSync(join(hermetic.home, '.forge-sim', 'daemon.pid'), String(process.pid));
    writeFileSync(join(hermetic.home, '.forge-sim', 'daemon.port'), String(port));
  });

  afterAll(async () => {
    await new Promise<void>((r) => stub.close(() => r()));
    rmSync(join(hermetic.home, '.forge-sim'), { recursive: true, force: true });
    rmSync(appDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    requests = [];
    deployExtra = {};
    resetExtra = {};
    deployFailStatus = undefined;
  });

  /** Async: the stub daemon lives in THIS process's event loop. */
  function runCli(args: string[], extraEnv: Record<string, string> = {}) {
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: hermetic.home, ...extraEnv };
    for (const k of Object.keys(env)) if (AUTH_ENV.test(k) && !(k in extraEnv)) delete env[k];
    return new Promise<{ status: number | null; stdout: string; stderr: string }>((resolveRun) => {
      const child = spawn(process.execPath, [CLI, ...args], { env });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (c) => (stdout += c));
      child.stderr.on('data', (c) => (stderr += c));
      const timer = setTimeout(() => child.kill('SIGKILL'), 20_000);
      child.on('close', (status) => {
        clearTimeout(timer);
        resolveRun({ status, stdout, stderr });
      });
    });
  }

  it('the stub daemon is the one in use (pid file names this process)', () => {
    expect(readFileSync(join(hermetic.home, '.forge-sim', 'daemon.pid'), 'utf8')).toBe(String(process.pid));
  });

  it.each([
    ['deploy (default)', [], {}, false],
    ['deploy --connect', ['--connect'], {}, true],
    ['deploy --offline', ['--offline'], {}, false],
    ['FORGE_SIM_CONNECT=1 deploy', [], { FORGE_SIM_CONNECT: '1' }, true],
    ['FORGE_SIM_CONNECT=1 deploy --offline', ['--offline'], { FORGE_SIM_CONNECT: '1' }, false],
    ['deploy --no-reset --connect', ['--no-reset', '--connect'], {}, true],
    // The --no-reset shapes, where no reset() drops an earlier --connect's
    // connection: the handler unloads on connect:false, so the CLI must send
    // it for these.
    ['deploy --no-reset', ['--no-reset'], {}, false],
    ['deploy --offline --no-reset', ['--offline', '--no-reset'], {}, false],
  ] as const)('%s → body.connect === %s', async (_label, flags, env, expected) => {
    const r = await runCli(['deploy', appDir, ...flags], env);
    expect(r.status, r.stderr).toBe(0);
    const deploys = requests.filter((q) => q.path === '/api/deploy');
    expect(deploys).toHaveLength(1);
    expect(deploys[0].body.connect).toBe(expected);
    expect(deploys[0].body.appDir).toBe(appDir);
    expect(deploys[0].body.reset).toBe(!flags.includes('--no-reset' as never));
  });

  it('a flag before the app dir is not taken for the app dir', async () => {
    const r = await runCli(['deploy', '--connect', appDir]);
    expect(r.status, r.stderr).toBe(0);
    expect(requests[0].body).toMatchObject({ appDir, connect: true });
  });

  it('prints the ACTIVE banner when the daemon reports a connection', async () => {
    deployExtra = { auth: { atlassian: { connected: true, site: SITE }, providers: [] } };
    const r = await runCli(['deploy', appDir, '--connect']);
    expect(r.stdout).toContain(`🔐 Real Atlassian APIs ACTIVE: ${SITE}`);
  });

  it('prints what a connect loaded besides the site: a provider token alone is not "no credentials"', async () => {
    deployExtra = { auth: { atlassian: { connected: false }, providers: ['google'], providerSecrets: 1, llm: { configured: true, source: 'config' } } };
    const r = await runCli(['deploy', appDir, '--connect']);
    expect(r.stdout).toContain('🔑 Loaded 3p token: google');
    expect(r.stdout).toContain('🔐 Loaded 1 provider secret');
    expect(r.stdout).toContain('🤖 Loaded Anthropic API key (config)');
    expect(r.stdout).not.toContain('ACTIVE');
    expect(r.stdout).not.toContain('no credentials found');
  });

  it('warns only when a connect loaded nothing at all, naming both ways it was requested', async () => {
    deployExtra = { auth: { atlassian: { connected: false }, providers: [] } };
    const r = await runCli(['deploy', appDir], { FORGE_SIM_CONNECT: '1' });
    expect(r.stdout).toContain('⚠️  Connect requested (--connect / FORGE_SIM_CONNECT=1) but no credentials found (run forge-sim auth)');
  });

  it('prints what an offline deploy unloaded from an earlier --connect', async () => {
    deployExtra = { disconnected: { atlassian: SITE, providers: ['google'], providerSecrets: 1, llm: true } };
    const r = await runCli(['deploy', appDir]);
    expect(r.stdout).toContain(
      `🔒 Offline: unloaded the connection to ${SITE}, provider token (google), 1 provider secret, the Anthropic key from an earlier --connect deploy.`,
    );
  });

  it('a deploy that fails still prints what it unloaded (the daemon unloads before deploying)', async () => {
    deployFailStatus = 500;
    deployExtra = { error: 'boom: deploy threw', disconnected: { atlassian: SITE, providers: [], providerSecrets: 0, llm: false } };
    const r = await runCli(['deploy', appDir]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('❌ boom: deploy threw');
    expect(r.stdout).toContain(`🔒 Offline: unloaded the connection to ${SITE} from an earlier --connect deploy.`);
  });

  it('forge-sim reset prints what it unloaded', async () => {
    resetExtra = { disconnected: { providers: ['google'], providerSecrets: 0, llm: false } };
    const r = await runCli(['reset']);
    expect(r.status, r.stderr).toBe(0);
    // The way back is a deploy: `forge-sim reset` takes no --connect.
    expect(r.stdout).toContain('🔒 Offline: unloaded provider token (google) from an earlier --connect deploy. Run forge-sim deploy --connect to connect again.');
  });
});

describe('dev wiring: the --offline decision reaches every place that loads credentials (source pins)', () => {
  const DEV = readFileSync(resolve(import.meta.dirname, '../dev-command.ts'), 'utf8');
  const CLI_SRC = readFileSync(resolve(import.meta.dirname, '../cli.ts'), 'utf8');

  it('cli.ts resolves the dev policy and hands devCommand `offline: !devConnect`', () => {
    expect(CLI_SRC).toMatch(/devConnect = resolveConnectPolicy\('dev', \{ connectFlag, offlineFlag \}\)\.connect/);
    expect(CLI_SRC).toMatch(/offline: !devConnect,/);
  });

  it('cli.ts deploy resolves the cli policy and sends `connect` in the /api/deploy body', () => {
    expect(CLI_SRC).toMatch(/resolveConnectPolicy\('cli', \{/);
    expect(CLI_SRC).toMatch(/body: \{ appDir, reset: !noReset, connect \}/);
  });

  it('devCommand passes `offline` to loadDevAuth (step 4c)', () => {
    expect(DEV).toMatch(/await loadDevAuth\(sim, \{ appDir, offline \}\);/);
  });

  it('BOTH Tools-API attach points (proxy mode and Vite) reconnect unless --offline and re-apply mocks.json', () => {
    const sites = [...DEV.matchAll(/connectByDefault: !offline,\s*\n(?:\s*\/\/[^\n]*\n)*\s*reapplyMockFile: true,/g)];
    expect(sites).toHaveLength(2);
    expect(DEV).toMatch(/createApiHandler\(sim, manifest, \{[\s\S]*?connectByDefault: !offline,/);
    expect(DEV).toMatch(/attachToolsToVite\(\{[\s\S]*?connectByDefault: !offline,/);
  });
});
