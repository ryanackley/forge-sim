/**
 * Daemon Client — Manages daemon lifecycle and proxies requests.
 *
 * Used by CLI commands to:
 *   1. Check if daemon is running
 *   2. Auto-start if not
 *   3. Send HTTP requests to the daemon
 */

import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const STATE_DIR = resolve(homedir(), '.forge-sim');
const PID_FILE = resolve(STATE_DIR, 'daemon.pid');
const PORT_FILE = resolve(STATE_DIR, 'daemon.port');

export interface DaemonInfo {
  port: number;
  pid: number;
  running: boolean;
}

/** Check if the daemon is running and healthy. */
export async function getDaemonStatus(): Promise<DaemonInfo | null> {
  if (!existsSync(PID_FILE) || !existsSync(PORT_FILE)) return null;

  const pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim(), 10);
  const port = parseInt(readFileSync(PORT_FILE, 'utf-8').trim(), 10);

  if (isNaN(pid) || isNaN(port)) return null;

  // Check if process is alive
  try {
    process.kill(pid, 0); // Signal 0 = just check existence
  } catch {
    return { port, pid, running: false };
  }

  // Health check
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) return { port, pid, running: true };
  } catch {
    // Process exists but not responding — might be starting up
    return { port, pid, running: false };
  }

  return { port, pid, running: false };
}

/** Start the daemon if it's not already running. Returns the port. */
export async function ensureDaemon(): Promise<number> {
  const status = await getDaemonStatus();
  if (status?.running) return status.port;

  // Clean up stale PID file if process is dead
  if (status && !status.running) {
    try {
      const { unlinkSync } = await import('node:fs');
      unlinkSync(PID_FILE);
      unlinkSync(PORT_FILE);
    } catch { /* ok */ }
  }

  // Spawn the daemon
  const __dir = dirname(fileURLToPath(import.meta.url));
  const daemonScript = join(__dir, 'daemon.js');

  return new Promise<number>((resolve, reject) => {
    const child = spawn(process.execPath, [
      '--import', join(__dir, '..', 'dist', 'loader', 'register.js'),
      daemonScript,
    ], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let output = '';
    let resolved = false;

    child.stdout!.on('data', (chunk) => {
      output += chunk.toString();
      // Daemon writes { port, pid } to stdout on startup
      try {
        const info = JSON.parse(output.trim());
        if (info.port) {
          resolved = true;
          child.stdout!.removeAllListeners();
          child.unref();
          resolve(info.port);
        }
      } catch {
        // Still buffering
      }
    });

    child.on('error', (err) => {
      if (!resolved) reject(new Error(`Failed to start daemon: ${err.message}`));
    });

    child.on('exit', (code) => {
      if (!resolved) reject(new Error(`Daemon exited with code ${code} before starting`));
    });

    // Timeout — daemon should start within 10s
    setTimeout(() => {
      if (!resolved) {
        child.kill();
        reject(new Error('Daemon startup timed out'));
      }
    }, 10_000);

    child.unref();
  });
}

/** Stop the daemon. */
export async function stopDaemon(): Promise<boolean> {
  const status = await getDaemonStatus();
  if (!status) return false;

  try {
    process.kill(status.pid, 'SIGTERM');
    return true;
  } catch {
    return false;
  }
}

/** Send a request to the daemon. Auto-starts if needed. */
export async function daemonRequest(
  path: string,
  options: { method?: string; body?: any; timeout?: number } = {}
): Promise<any> {
  const port = await ensureDaemon();
  const url = `http://127.0.0.1:${port}${path}`;

  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(options.timeout ?? 60_000),
  });

  const data = await res.json() as any;

  if (!res.ok && data.error) {
    throw new Error(data.error);
  }

  return data;
}
