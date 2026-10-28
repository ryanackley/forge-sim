/**
 * The MCP server's credentials are OPT-IN.
 *
 * `forge_deploy` loads credentials only when the server was started with
 * `--connect` (or FORGE_SIM_CONNECT=1), so a machine with
 * `~/.forge-sim/credentials.json` does not put every MCP session on a real
 * site under the developer's PAT. Offline, it says when credentials exist
 * that --connect would load.
 *
 * mcp-server.ts starts a transport on import, so most of these are
 * source-level pins (same approach as eval7-f5-f6-mcp-server-info.test.ts).
 * The startup paths that EXIT before any server starts (--help, a flag
 * contradiction, a bad FORGE_SIM_CONNECT) are also run for real against the
 * compiled dist, with a temp HOME.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { assertDistFresh } from './helpers/dist-freshness.js';

const SOURCE = readFileSync(resolve(import.meta.dirname, '../mcp-server.ts'), 'utf8');

/** Source with // line comments and block comments removed (string contents kept). */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/^\s*\/\/.*$/, ''))
    .join('\n');
}

/** The `{ ... }` block that starts at the first `{` at or after `from`. */
function blockAt(src: string, from: number): string {
  const open = src.indexOf('{', from);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error('unbalanced block');
}

/** Source of one tool registration, from its name to the next server.tool( call. */
function toolSource(name: string): string {
  const match = new RegExp(`server\\.tool\\(\\s*'${name}'`).exec(SOURCE);
  expect(match, `tool ${name} not found`).not.toBeNull();
  const start = match!.index + match![0].length;
  const next = SOURCE.indexOf('server.tool(', start);
  return SOURCE.slice(start, next === -1 ? undefined : next);
}

describe('forge_deploy loads credentials only when the policy says connect', () => {
  const CODE = code(SOURCE);

  it('every loadAuthFromEnv() call sits inside an `if (CONNECT_POLICY.connect ...) { ... }` block', () => {
    // Two: after a deploy, and in its catch (a failed deploy reloads too).
    const calls = CODE.match(/loadAuthFromEnv\(/g) ?? [];
    expect(calls).toHaveLength(2);

    const gates = [...CODE.matchAll(/if \(CONNECT_POLICY\.connect(?: && [^)]*)?\) \{/g)];
    const gated = gates.map((g) => blockAt(CODE, g.index!));
    expect(gated.filter((b) => b.includes('sim.loadAuthFromEnv('))).toHaveLength(2);
    // Removing the gated blocks removes every call.
    let ungated = CODE;
    for (const block of gated) ungated = ungated.replace(block, '');
    expect(ungated).not.toMatch(/loadAuthFromEnv\(/);
  });

  it('a forge_deploy that throws still reloads under --connect (the unload already ran)', () => {
    const deploy = code(toolSource('forge_deploy'));
    const catchBlock = blockAt(deploy, deploy.lastIndexOf('} catch (err) {') + 1);
    const gate = catchBlock.indexOf('if (CONNECT_POLICY.connect && !reloaded) {');
    expect(gate).toBeGreaterThan(-1);
    expect(blockAt(catchBlock, gate)).toContain('sim.loadAuthFromEnv(');
    // ...and only when the try had not reloaded yet.
    expect(deploy).toMatch(/if \(CONNECT_POLICY\.connect\) \{\s*reloaded = true;/);
  });

  it('forge_deploy first unloads what the previous deploy loaded, before the deploy (which resets after its build)', () => {
    const deploy = code(toolSource('forge_deploy'));
    const unload = deploy.indexOf('sim.unloadAuth();');
    expect(unload).toBeGreaterThan(-1);
    // The reset is deploy()'s, after a successful build — never a bare
    // sim.reset() ahead of the build, which emptied the simulator behind a
    // failed redeploy.
    expect(deploy).not.toContain('sim.reset()');
    expect(deploy).toContain('reset: reset !== false');
    expect(unload).toBeLessThan(deploy.indexOf('sim.deploy('));
    expect(unload).toBeLessThan(deploy.indexOf('sim.loadAuthFromEnv('));
  });

  it('the gate is inside forge_deploy', () => {
    expect(code(toolSource('forge_deploy'))).toContain('if (CONNECT_POLICY.connect) {');
  });

  it('offline, forge_deploy probes for credentials WITHOUT loading them and returns an advisory', () => {
    const deploy = code(toolSource('forge_deploy'));
    expect(deploy).toMatch(/findAvailableCredentials\(/);
    expect(deploy).toMatch(/summary\.auth = \{ atlassian: offlineAdvisory\(/);
  });

  it('the forge_deploy description says credentials are opt-in', () => {
    const desc = toolSource('forge_deploy').split('{')[0];
    expect(desc).toContain('--connect');
    expect(desc).toContain('FORGE_SIM_CONNECT=1');
    expect(desc).toContain('501');
  });
});

describe('startup: --connect / --offline / --help are parsed', () => {
  it('the policy is resolved for the mcp channel from both flags', () => {
    expect(SOURCE).toMatch(/resolveConnectPolicy\('mcp', \{\s*connectFlag: MCP_ARGV\.includes\('--connect'\),\s*offlineFlag: MCP_ARGV\.includes\('--offline'\),/);
  });

  it('--help exits before the stdio guard and before a simulator exists', () => {
    const help = SOURCE.indexOf(`MCP_ARGV.includes('--help')`);
    expect(help).toBeGreaterThan(-1);
    expect(SOURCE.slice(help, help + 200)).toContain('process.exit(0)');
    expect(help).toBeLessThan(SOURCE.indexOf('redirectStdoutConsoleToStderr();'));
    expect(help).toBeLessThan(SOURCE.indexOf('const sim = createSimulator()'));
  });

  it('the usage names every option and the env var', () => {
    const usage = SOURCE.slice(SOURCE.indexOf('const MCP_USAGE'), SOURCE.indexOf(`MCP_ARGV.includes('--help')`));
    for (const opt of ['--connect', '--offline', '--help', '${CONNECT_ENV}=1', '"args": ["--connect"]']) {
      expect(usage).toContain(opt);
    }
  });

  it('the stdio server prints the policy banner on stderr at startup', () => {
    const main = SOURCE.slice(SOURCE.indexOf('async function main()'));
    expect(main).toContain('new StdioServerTransport()');
    expect(main).not.toContain('createServer(');
    expect(main.match(/console\.error\(`\[forge-sim\] \$\{describeConnectPolicy\(CONNECT_POLICY\)\}`\)/g)).toHaveLength(1);
  });
});

describe('forge_auth_status and forge_sim_info report the policy', () => {
  it('forge_auth_status carries the policy, and the hint when offline with credentials available', () => {
    const status = code(toolSource('forge_auth_status'));
    expect(status).toMatch(/output\.policy = \{ \.\.\.CONNECT_POLICY/);
    expect(status).toMatch(/findAvailableCredentials\(/);
    expect(status).toMatch(/output\.atlassian\.available = available/);
    expect(status).toMatch(/output\.atlassian\.hint = offlineAdvisory\(/);
  });

  it('the advisory hint tells the agent how to connect', () => {
    const start = SOURCE.indexOf('function offlineAdvisory(');
    // The body block, not the parameter's object type: skip to `) {`.
    const helper = blockAt(SOURCE, SOURCE.indexOf(') {', start));
    // Policy-aware: after --offline the env var is no help (a flag beats it).
    expect(helper).toContain('connectHint(policy)');
    expect(helper).toContain('return 501');
    expect(helper).toMatch(/policy: policy\.source === 'default' \? 'opt-in' : 'offline'/);
  });

  it('forge_sim_info includes connectPolicy', () => {
    expect(toolSource('forge_sim_info')).toMatch(/connectPolicy: \{\s*\.\.\.CONNECT_POLICY,/);
  });
});

// ── Real runs of the exit-early paths (compiled dist) ───────────────────

const DIST = resolve(import.meta.dirname, '../../dist/mcp-server.js');
const hasDist = existsSync(DIST);

describe.runIf(hasDist)('forge-sim-mcp startup paths that exit before serving (dist, temp HOME)', () => {
  beforeAll(() => assertDistFresh(DIST));
  const home = mkdtempSync(join(tmpdir(), 'forge-sim-mcp-pin-home-'));
  afterAll(() => rmSync(home, { recursive: true, force: true }));

  function run(args: string[], extraEnv: Record<string, string> = {}) {
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, ...extraEnv };
    if (!('FORGE_SIM_CONNECT' in extraEnv)) delete env.FORGE_SIM_CONNECT;
    return spawnSync(process.execPath, [DIST, ...args], {
      env,
      encoding: 'utf8',
      timeout: 20_000,
      input: '', // stdin closed — a server that started anyway would see EOF
    });
  }

  it('--help prints usage on stdout and exits 0', () => {
    const r = run(['--help']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('forge-sim-mcp [--connect|--offline]');
    expect(r.stdout).toContain('FORGE_SIM_CONNECT=1');
    expect(r.stderr).not.toContain('MCP server running');
  });

  it('--connect with --offline exits 2 with the copy-pasteable message', () => {
    const r = run(['--connect', '--offline']);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('--connect and --offline cannot be used together');
    expect(r.stderr).not.toContain('MCP server running');
  });

  it('the old HTTP transport flags are refused, not ignored (stdio is the only transport)', () => {
    for (const args of [['--http'], ['--port=3100'], ['--http', '--connect']]) {
      const r = run(args);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain('forge-sim-mcp has no HTTP transport');
      expect(r.stderr).toContain('"command": "forge-sim-mcp"');
      expect(r.stderr).not.toContain('MCP server running');
    }
  });

  it('an unrecognised FORGE_SIM_CONNECT exits 2 naming the accepted values', () => {
    const r = run([], { FORGE_SIM_CONNECT: 'maybe' });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('FORGE_SIM_CONNECT="maybe" is not a recognised value');
    expect(r.stderr).not.toContain('MCP server running');
  });
});

// ── The real server over stdio (compiled dist, temp HOME, no network) ───
//
// A temp HOME whose credential store names `forge-sim-test.invalid`. Offline
// (the default) the server must not load it but must say it exists; with
// --connect it loads it. connectRealApis makes no request, and nothing here
// invokes app code that would call the site.

describe.runIf(hasDist)('forge-sim-mcp over stdio: offline by default, --connect loads the store (dist, temp HOME)', async () => {
  beforeAll(() => assertDistFresh(DIST));
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
  const { mkdirSync, writeFileSync } = await import('node:fs');

  const SITE = 'forge-sim-test.invalid';
  const home = mkdtempSync(join(tmpdir(), 'forge-sim-mcp-stdio-home-'));
  const appDir = mkdtempSync(join(tmpdir(), 'forge-sim-mcp-stdio-app-'));
  mkdirSync(join(home, '.forge-sim'), { recursive: true });
  writeFileSync(join(home, '.forge-sim', 'credentials.json'), JSON.stringify({
    accounts: [{
      id: 'stored-1', name: 'Stored Dev', email: 'stored@example.com', site: SITE,
      cloudId: 'stored-cloud', accountId: 'stored-account', authType: 'pat',
      accessToken: 'stored-pat', refreshToken: '', expiresAt: 0, scopes: [], default: true,
    }],
    thirdParty: {},
  }));
  mkdirSync(join(appDir, 'src'), { recursive: true });
  writeFileSync(join(appDir, 'manifest.yml'), `
modules:
  webtrigger:
    - key: hook-trigger
      function: hook
  function:
    - key: hook
      handler: index.run
app:
  id: ari:cloud:ecosystem::app/mcp-connect-policy
  runtime:
    name: nodejs22.x
permissions:
  scopes: []
`);
  writeFileSync(join(appDir, 'src', 'index.js'), `export const run = async () => ({ statusCode: 200, body: 'ok' });\n`);

  afterAll(() => {
    rmSync(home, { recursive: true, force: true });
    rmSync(appDir, { recursive: true, force: true });
  });

  /** A clean env: temp HOME, and none of the variables that could connect from elsewhere. */
  function serverEnv(extra: Record<string, string> = {}): Record<string, string> {
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (v === undefined) continue;
      if (/^(FORGE_SIM_|ANTHROPIC_API_KEY$)/.test(k)) continue;
      env[k] = v;
    }
    return { ...env, HOME: home, FORGE_SIM_STALE_CHECK: 'off', ...extra };
  }

  async function withServer<T>(args: string[], env: Record<string, string>, fn: (call: (name: string, a?: Record<string, unknown>) => Promise<string>) => Promise<T>): Promise<T> {
    const transport = new StdioClientTransport({ command: process.execPath, args: [DIST, ...args], env, stderr: 'pipe' });
    const client = new Client({ name: 'connect-policy-test', version: '0.0.0' });
    await client.connect(transport);
    try {
      return await fn(async (name, a = {}) => {
        const res: any = await client.callTool({ name, arguments: a });
        return res.content[res.content.length - 1].text as string;
      });
    } finally {
      await client.close();
    }
  }

  const json = (text: string) => JSON.parse(text.slice(text.indexOf('{')));

  it('default: forge_deploy stays offline and reports the credentials it did not load', async () => {
    await withServer([], serverEnv(), async (call) => {
      const info = json(await call('forge_sim_info'));
      expect(info.connectPolicy).toMatchObject({ channel: 'mcp', connect: false, source: 'default' });

      const deployed = json(await call('forge_deploy', { appDir }));
      expect(deployed.errors).toEqual([]);
      expect(deployed.auth.atlassian).toMatchObject({ connected: false, policy: 'opt-in', credentialsFound: SITE });
      expect(deployed.auth.atlassian.hint).toContain('--connect');

      const status = json(await call('forge_auth_status'));
      expect(status.atlassian).toMatchObject({ connected: false, available: { site: SITE, email: 'stored@example.com', source: 'store' } });
      expect(status.atlassian.hint).toContain('FORGE_SIM_CONNECT=1');
      expect(status.policy).toMatchObject({ channel: 'mcp', connect: false, source: 'default' });
    });
  });

  it('--connect: forge_deploy loads the stored account', async () => {
    await withServer(['--connect'], serverEnv(), async (call) => {
      const deployed = json(await call('forge_deploy', { appDir }));
      expect(deployed.auth.atlassian).toMatchObject({ connected: true, site: SITE });

      const status = json(await call('forge_auth_status'));
      expect(status.atlassian).toMatchObject({ connected: true, site: SITE });
      expect(status.policy).toMatchObject({ connect: true, source: 'flag' });
    });
  });

  it('--connect: a forge_deploy that fails leaves the server connected', async () => {
    await withServer(['--connect'], serverEnv(), async (call) => {
      expect(json(await call('forge_deploy', { appDir })).auth.atlassian).toMatchObject({ connected: true, site: SITE });

      // forge_deploy unloads before deploying; a deploy that throws must
      // reload too, or the app still deployed (reset: false) runs offline.
      const failed = await call('forge_deploy', { appDir: join(appDir, 'missing'), reset: false });
      expect(failed).toMatch(/^❌ Deploy failed: .*manifest\.yml/);
      expect(failed).toContain(`"site":"${SITE}"`);

      const status = json(await call('forge_auth_status'));
      expect(status.atlassian).toMatchObject({ connected: true, site: SITE });
    });
  });

  it('FORGE_SIM_CONNECT=1 in the server env works like --connect; --offline beats it', async () => {
    await withServer([], serverEnv({ FORGE_SIM_CONNECT: '1' }), async (call) => {
      expect(json(await call('forge_sim_info')).connectPolicy).toMatchObject({ connect: true, source: 'env' });
    });
    await withServer(['--offline'], serverEnv({ FORGE_SIM_CONNECT: '1' }), async (call) => {
      const info = json(await call('forge_sim_info'));
      expect(info.connectPolicy).toMatchObject({ connect: false, source: 'flag' });
      const deployed = json(await call('forge_deploy', { appDir }));
      expect(deployed.auth.atlassian).toMatchObject({ connected: false, policy: 'offline', credentialsFound: SITE });
    });
  });
});
