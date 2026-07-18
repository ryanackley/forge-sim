/**
 * Eval-6 F6 + F11 — CLI web trigger path and trigger --data parsing.
 *
 * F6: the daemon 404'd on every webtrigger path — `/__trigger/<key>` only
 * exists on the dev Vite server, so CLI-only users had NO way to exercise
 * a webhook. Fix: a shared `/api/webtrigger` route in createApiHandler
 * (serves both the daemon and the dev tools API) + a `forge-sim webtrigger`
 * CLI command.
 *
 * F11: `forge-sim trigger <event> --data '{...}'` parsed the literal string
 * "--data" as the JSON payload → "Invalid JSON data" with no echo of what
 * was received. Fix: proper flag parsing + echoing the offending input.
 * The same hardening covers `invoke --payload`, whose old fallback did an
 * UNWRAPPED JSON.parse and crashed with a raw stack trace.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createSimulator, ForgeSimulator } from '../simulator.js';
import { createApiHandler } from '../tools/api.js';

const FIXTURE = join(import.meta.dirname, 'fixtures/webtrigger-app');

// ── Part A: shared /api/webtrigger route (daemon-mode handler) ──────────
//
// The daemon calls createApiHandler(sim) with NO manifest argument — the
// manifest resolves lazily via sim.getManifest() after deploy. Mirror that
// exactly so these tests pin daemon semantics, not just dev-tools semantics.

async function startServer(sim: ForgeSimulator) {
  const handler = createApiHandler(sim);
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    void handler(req, res, url);
  });
  await new Promise<void>((res) => server.listen(0, '127.0.0.1', () => res()));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('bind failed');
  return { server, url: `http://127.0.0.1:${address.port}` };
}

describe('F6 — /api/webtrigger route (shared daemon/dev-tools handler)', () => {
  let sim: ForgeSimulator;
  let url: string;
  let server: ReturnType<typeof createServer>;

  beforeAll(async () => {
    sim = createSimulator();
    await sim.deploy(FIXTURE);
    ({ server, url } = await startServer(sim));
  });

  afterAll(async () => {
    await new Promise<void>((res, rej) => server.close((e) => (e ? rej(e) : res())));
  });

  async function fire(body: any) {
    const res = await fetch(`${url}/api/webtrigger`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  }

  it('fires a web trigger with the full Forge request shape and returns the response', async () => {
    const { status, body } = await fire({
      key: 'github-webhook',
      method: 'POST',
      userPath: '/hooks/push',
      headers: { 'Content-Type': 'application/json' },
      queryParameters: { ref: ['main', 'dev'] },
      body: { action: 'opened' },
    });

    expect(status).toBe(200);
    expect(body.statusCode).toBe(200);
    const echo = JSON.parse(body.body);
    expect(echo.method).toBe('POST');
    expect(echo.query).toEqual({ ref: ['main', 'dev'] });
    expect(echo.contentType).toContain('application/json');
    expect(echo.echo).toEqual({ action: 'opened' });
  });

  it('handler errors come back INSIDE the response as 5xx, not as an HTTP error', async () => {
    // A real webhook caller would receive a 500 response from the trigger
    // URL — the API wrapper itself succeeds (HTTP 200).
    const { status, body } = await fire({ key: 'github-webhook', userPath: '/boom' });
    expect(status).toBe(200);
    expect(body.statusCode).toBe(500);
  });

  it('unknown trigger key is a setup error → HTTP 404', async () => {
    const { status, body } = await fire({ key: 'nope' });
    expect(status).toBe(404);
    expect(body.error).toContain('No web trigger');
    expect(body.error).toContain('github-webhook'); // lists available keys
  });

  it('missing key → HTTP 400', async () => {
    const { status, body } = await fire({});
    expect(status).toBe(400);
    expect(body.error).toBe('Missing key');
  });

  it('no manifest deployed is a setup error → HTTP 404', async () => {
    const emptySim = createSimulator();
    const { server: s2, url: u2 } = await startServer(emptySim);
    try {
      const res = await fetch(`${u2}/api/webtrigger`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: 'github-webhook' }),
      });
      const body = await res.json();
      expect(res.status).toBe(404);
      expect(body.error).toContain('No manifest');
    } finally {
      await new Promise<void>((res, rej) => s2.close((e) => (e ? rej(e) : res())));
    }
  });
});

// ── Part B: CLI argument parsing (F11 + webtrigger usage) ───────────────
//
// These exercise the compiled CLI. Every case here fails validation BEFORE
// any daemon contact, so no daemon should ever spawn — but each run gets an
// isolated HOME as insurance so a regression can't touch ~/.forge-sim.

const projectRoot = resolve(import.meta.dirname, '..', '..');
const cliPath = join(projectRoot, 'dist', 'cli.js');
const hasDist = existsSync(cliPath);

describe.runIf(hasDist)('F11 — CLI JSON flag parsing (compiled dist)', () => {
  let fakeHome: string;

  beforeAll(() => {
    fakeHome = mkdtempSync(join(tmpdir(), 'forge-sim-f11-'));
  });

  afterAll(() => {
    // Insurance: if a regression let a command reach ensureDaemon(), kill it.
    try {
      const pid = parseInt(readFileSync(join(fakeHome, '.forge-sim', 'daemon.pid'), 'utf-8').trim(), 10);
      if (!isNaN(pid)) process.kill(pid, 'SIGTERM');
    } catch { /* no daemon spawned — the expected case */ }
    rmSync(fakeHome, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });

  function runCli(args: string[]) {
    return new Promise<{ code: number | null; stdout: string; stderr: string }>((res) => {
      const child = spawn(process.execPath, [cliPath, ...args], {
        env: { ...process.env, HOME: fakeHome },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (c) => { stdout += c.toString(); });
      child.stderr.on('data', (c) => { stderr += c.toString(); });
      const timer = setTimeout(() => child.kill('SIGKILL'), 15_000);
      child.on('exit', (code) => {
        clearTimeout(timer);
        res({ code, stdout, stderr });
      });
    });
  }

  it('trigger --data with bad JSON echoes the received input (F11 repro)', async () => {
    // Pre-fix: the literal string "--data" was parsed as the payload, so the
    // error blamed input the user never wrote and echoed nothing.
    const { code, stderr } = await runCli(['trigger', 'avi:jira:created:issue', '--data', '{bad json']);
    expect(code).toBe(1);
    expect(stderr).toContain('Invalid JSON data');
    expect(stderr).toContain('Received: {bad json');
  });

  it('invoke --payload with bad JSON errors cleanly instead of a raw stack', async () => {
    const { code, stderr } = await runCli(['invoke', 'my-fn', '--payload', '{nope']);
    expect(code).toBe(1);
    expect(stderr).toContain('Invalid JSON payload');
    expect(stderr).toContain('Received: {nope');
    expect(stderr).not.toContain('at JSON.parse'); // no raw stack trace
  });

  it('webtrigger with no key prints usage and exits 1', async () => {
    const { code, stderr } = await runCli(['webtrigger']);
    expect(code).toBe(1);
    expect(stderr).toContain('Usage: forge-sim webtrigger <key>');
    expect(stderr).toContain('--method');
    expect(stderr).toContain('--header');
  });

  it('webtrigger rejects a malformed --header before contacting the daemon', async () => {
    const { code, stderr } = await runCli(['webtrigger', 'github-webhook', '--header', 'no-colon-here']);
    expect(code).toBe(1);
    expect(stderr).toContain('Invalid --header');
    expect(stderr).toContain('Name: value');
  });

  it('webtrigger rejects a malformed --query before contacting the daemon', async () => {
    const { code, stderr } = await runCli(['webtrigger', 'github-webhook', '--query', 'no-equals']);
    expect(code).toBe(1);
    expect(stderr).toContain('Invalid --query');
  });
});
