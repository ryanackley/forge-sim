/**
 * Test harness for starting/stopping forge-sim dev programmatically.
 * Used by Playwright e2e tests.
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FORGE_SIM_ROOT = resolve(__dirname, '..', '..');
const CLI_PATH = resolve(FORGE_SIM_ROOT, 'src', 'cli.ts');

export interface DevServerInstance {
  url: string;
  wsUrl: string;
  stop: () => void;
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

/**
 * Start forge-sim dev against an app directory.
 * Waits until HTTP server is ready, then returns handle.
 */
export async function startForgeSimDev(opts: StartOptions): Promise<DevServerInstance> {
  const {
    appDir,
    port = 19500,
    wsPort = 19501,
    proxy,
    timeoutMs = 30_000,
  } = opts;

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

  proc.stdout?.on('data', (data: Buffer) => {
    const line = data.toString().trim();
    if (line) output.push(line);
  });

  proc.stderr?.on('data', (data: Buffer) => {
    const line = data.toString().trim();
    if (line) output.push(`[stderr] ${line}`);
  });

  const url = `http://localhost:${port}`;
  const wsUrl = `ws://localhost:${wsPort}`;

  // Wait for HTTP readiness
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (resp.ok || resp.status === 404) {
        // Server is up (404 is fine — module picker or no route)
        return {
          url,
          wsUrl,
          output,
          stop: () => stopProcess(proc),
        };
      }
    } catch {
      // Not ready yet
    }
    await new Promise(r => setTimeout(r, 500));
  }

  // Dump output for debugging
  console.error('forge-sim dev output:', output.join('\n'));
  stopProcess(proc);
  throw new Error(`forge-sim dev didn't start within ${timeoutMs}ms`);
}

function stopProcess(proc: ChildProcess): void {
  if (!proc.pid) return;
  try {
    // Kill entire process group
    process.kill(-proc.pid, 'SIGTERM');
  } catch {
    try { proc.kill('SIGTERM'); } catch {}
  }
  // Force kill after 2s
  setTimeout(() => {
    try { process.kill(-proc.pid!, 'SIGKILL'); } catch {}
  }, 2000);
}
