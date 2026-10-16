/**
 * Test harness for starting/stopping forge-sim dev programmatically.
 * Used by Playwright e2e tests.
 *
 * Two properties matter more than they look:
 *
 * - `stop()` is awaitable and does not return until the process group is
 *   gone. The old fire-and-forget SIGTERM (with a SIGKILL on a 2s timer that
 *   died with the worker) let a server from one spec, or one whole
 *   `playwright test` run, outlive its owner. The next spec on the same ports
 *   then failed to bind its WebSocket port and exited, while its readiness
 *   poll — and its first test — were happily served by the zombie. When the
 *   zombie finished shutting down, every remaining test got
 *   ERR_CONNECTION_REFUSED with nothing in the log to say why.
 *
 * - Readiness is tied to OUR process. If the child exits while we're
 *   polling, we fail immediately with its output instead of handing back a
 *   handle to whatever else happens to be listening on the port.
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { createServer, connect } from 'node:net';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FORGE_SIM_ROOT = resolve(__dirname, '..', '..');
const CLI_PATH = resolve(FORGE_SIM_ROOT, 'src', 'cli.ts');

export interface DevServerInstance {
  url: string;
  wsUrl: string;
  /** Stop the server and resolve once the process group has exited. */
  stop: () => Promise<void>;
  /** stdout/stderr output captured for debugging */
  output: string[];
}

export interface StartOptions {
  appDir: string;
  port?: number;
  wsPort?: number;
  proxy?: string;
  timeoutMs?: number;
}

/** How long to give forge-sim's graceful shutdown before escalating to SIGKILL. */
const GRACEFUL_SHUTDOWN_MS = 3_000;
/** After exit, how long to wait for the kernel to release the listening ports. */
const PORT_RELEASE_MS = 3_000;

/** Ask the OS for a free TCP port on loopback. */
export function getFreePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolvePort(port));
    });
  });
}

/** True if something accepts TCP connections on 127.0.0.1:port. */
function isListening(port: number): Promise<boolean> {
  return new Promise((resolveListening) => {
    const sock = connect({ port, host: '127.0.0.1' });
    sock.setTimeout(500);
    sock.once('connect', () => { sock.destroy(); resolveListening(true); });
    sock.once('error', () => resolveListening(false));
    sock.once('timeout', () => { sock.destroy(); resolveListening(false); });
  });
}

async function waitForPortsReleased(ports: number[], timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const busy = await Promise.all(ports.map(isListening));
    if (!busy.some(Boolean)) return;
    await new Promise(r => setTimeout(r, 100));
  }
}

/**
 * Start forge-sim dev against an app directory.
 * Waits until HTTP server is ready, then returns handle.
 */
export async function startForgeSimDev(opts: StartOptions): Promise<DevServerInstance> {
  const { appDir, proxy, timeoutMs = 30_000 } = opts;
  // Ports default to whatever is free right now. Fixed ports were the root of
  // the suite's "random" mid-run ERR_CONNECTION_REFUSED: two forge-sim devs
  // on the same machine (another worktree's e2e run, a developer's own
  // `forge-sim dev`, a parallel CI job) collide, the loser exits on its
  // WebSocket bind, and the loser's tests are silently served by the winner
  // until the winner goes away.
  const port = opts.port ?? (await getFreePort());
  const wsPort = opts.wsPort ?? (await getFreePort());
  for (const [name, p] of [['--port', port], ['--ws-port', wsPort]] as const) {
    if (await isListening(p)) {
      throw new Error(
        `forge-sim e2e: ${name} ${p} is already in use by another process. ` +
          `Another forge-sim dev (or another e2e run) is probably running; omit the port to auto-pick a free one.`,
      );
    }
  }

  const output: string[] = [];

  const args = ['tsx', CLI_PATH, 'dev', '--port', String(port), '--ws-port', String(wsPort), '--no-open'];
  if (proxy) {
    args.push('--proxy', proxy);
  }
  args.push(appDir);

  const proc = spawn('npx', args, {
    cwd: FORGE_SIM_ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
    detached: true,
  });

  // FORGE_SIM_E2E_VERBOSE=1 streams the server's output live, for chasing
  // mid-run failures where the process does not exit.
  const verbose = !!process.env.FORGE_SIM_E2E_VERBOSE;
  const record = (line: string) => {
    output.push(line);
    if (verbose) console.log(`[forge-sim:${port}] ${line}`);
  };
  proc.stdout?.on('data', (data: Buffer) => {
    const line = data.toString().trim();
    if (line) record(line);
  });

  proc.stderr?.on('data', (data: Buffer) => {
    const line = data.toString().trim();
    if (line) record(`[stderr] ${line}`);
  });

  let stopRequested = false;
  let exited = false;
  const exitPromise = new Promise<void>((resolveExit) => {
    proc.on('exit', (code, signal) => {
      exited = true;
      output.push(`[exit] code=${code} signal=${signal}`);
      if (!stopRequested) {
        console.error(
          `forge-sim dev (port ${port}) exited unexpectedly (code=${code} signal=${signal}). Last output:\n` +
            output.slice(-40).join('\n'),
        );
      }
      resolveExit();
    });
  });

  const stop = async (): Promise<void> => {
    stopRequested = true;
    await stopProcess(proc, exited, exitPromise);
    // `proc` is the npx wrapper; the server node process in its group can
    // still be mid-cleanup when npx has exited. Don't hand the ports back
    // to the next spec until they are really free.
    await waitForPortsReleased([port, wsPort], PORT_RELEASE_MS);
  };

  const url = `http://localhost:${port}`;
  const wsUrl = `ws://localhost:${wsPort}`;

  // Wait for HTTP readiness — from THIS process, not from any listener.
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (exited) {
      throw new Error(
        `forge-sim dev (port ${port}) exited during startup. Output:\n${output.join('\n')}`,
      );
    }
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (resp.ok || resp.status === 404) {
        // Server is up (404 is fine — module picker or no route)
        return { url, wsUrl, output, stop };
      }
    } catch {
      // Not ready yet
    }
    await new Promise(r => setTimeout(r, 500));
  }

  // Dump output for debugging
  console.error('forge-sim dev output:', output.join('\n'));
  await stop();
  throw new Error(`forge-sim dev didn't start within ${timeoutMs}ms`);
}

/**
 * SIGTERM the whole process group (npx → tsx → node), wait for a graceful
 * exit, escalate to SIGKILL if it takes too long, and only resolve once the
 * child has actually exited.
 */
async function stopProcess(proc: ChildProcess, alreadyExited: boolean, exitPromise: Promise<void>): Promise<void> {
  if (!proc.pid || alreadyExited) return;
  signalGroup(proc, 'SIGTERM');
  const graceful = await Promise.race([
    exitPromise.then(() => true),
    new Promise<boolean>((r) => setTimeout(() => r(false), GRACEFUL_SHUTDOWN_MS)),
  ]);
  if (!graceful) {
    signalGroup(proc, 'SIGKILL');
    await exitPromise;
  }
}

function signalGroup(proc: ChildProcess, signal: NodeJS.Signals): void {
  try {
    process.kill(-proc.pid!, signal);
  } catch {
    try { proc.kill(signal); } catch {}
  }
}
