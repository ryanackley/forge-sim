/**
 * Daemon client exit behavior (eval-5 F5 regression).
 *
 * A cold `forge-sim deploy` spawns the daemon with piped stdio. The stdout/
 * stderr pipe sockets are separate libuv handles — `child.unref()` alone
 * does NOT release them, so the CLI used to print its deploy summary and
 * then hang forever waiting on the daemon's pipes. The fix unrefs the pipe
 * handles once the daemon reports its port.
 *
 * This test runs the real CLI against a real cold-spawned daemon, isolated
 * via a temp HOME so it can never collide with a developer's daemon state
 * in ~/.forge-sim. If the client hangs, the spawn times out and the test
 * fails loudly instead of wedging the suite.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const projectRoot = resolve(__dirname, '..', '..');
const cliPath = join(projectRoot, 'dist', 'cli.js');
const fixtureApp = join(projectRoot, 'src', '__tests__', 'fixtures', 'ctx-echo');

// The whole point is exercising the compiled spawn path — skip cleanly if
// dist hasn't been built (CI always builds first).
const hasDist = existsSync(cliPath);

describe.runIf(hasDist)('daemon client exits after cold spawn (eval-5 F5)', () => {
  let fakeHome: string;

  beforeAll(() => {
    fakeHome = mkdtempSync(join(tmpdir(), 'forge-sim-f5-'));
  });

  afterAll(() => {
    // Kill the daemon the test spawned (its pid file lives under fakeHome).
    try {
      const pid = parseInt(readFileSync(join(fakeHome, '.forge-sim', 'daemon.pid'), 'utf-8').trim(), 10);
      if (!isNaN(pid)) process.kill(pid, 'SIGTERM');
    } catch { /* already gone */ }
    // The SIGTERM'd daemon may still be flushing files into fakeHome while
    // we delete it — retry through the transient ENOTEMPTY window.
    rmSync(fakeHome, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });

  it('cold deploy exits promptly instead of hanging on daemon stdio pipes', async () => {
    const result = await new Promise<{ code: number | null; stdout: string; timedOut: boolean }>((res) => {
      const child = spawn(process.execPath, [cliPath, 'deploy', fixtureApp], {
        env: { ...process.env, HOME: fakeHome },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      child.stdout.on('data', (c) => { stdout += c.toString(); });
      child.stderr.on('data', (c) => { stdout += c.toString(); });

      // Generous budget for cold daemon spawn + deploy; the pre-fix bug
      // hung *forever*, so any timeout distinguishes pass from fail.
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        res({ code: null, stdout, timedOut: true });
      }, 30_000);

      child.on('exit', (code) => {
        clearTimeout(timer);
        res({ code, stdout, timedOut: false });
      });
    });

    expect(result.timedOut, `CLI hung after deploy. Output:\n${result.stdout}`).toBe(false);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Deployed');
  }, 40_000);

  it('daemon survives the client exiting (EPIPE-immune logging)', async () => {
    // The daemon spawned by the previous test lost its stdio reader when
    // the CLI exited. If its stderr logging raised EPIPE it would have
    // crashed — verify it's still alive and healthy.
    const port = parseInt(readFileSync(join(fakeHome, '.forge-sim', 'daemon.port'), 'utf-8').trim(), 10);
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(3000) });
    expect(res.ok).toBe(true);
  });
});
