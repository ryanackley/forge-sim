/**
 * Daemon Client — Manages daemon lifecycle and proxies requests.
 *
 * Used by CLI commands to:
 *   1. Check if daemon is running
 *   2. Auto-start if not
 *   3. Send HTTP requests to the daemon
 */

import { resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const STATE_DIR = process.env.FORGE_SIM_STATE_DIR
  ? resolve(process.env.FORGE_SIM_STATE_DIR)
  : resolve(homedir(), '.forge-sim');
const PID_FILE = resolve(STATE_DIR, 'daemon.pid');
const PORT_FILE = resolve(STATE_DIR, 'daemon.port');
const DEV_FILE = resolve(STATE_DIR, 'dev.json');

export interface DaemonInfo {
  port: number;
  pid: number;
  running: boolean;
}

export interface DevServerInfo {
  port: number;
  pid: number;
  appDir: string;
  running: boolean;
}

function cleanupStateFiles(): void {
  try { unlinkSync(PID_FILE); } catch { /* ok */ }
  try { unlinkSync(PORT_FILE); } catch { /* ok */ }
}

// ── Dev-server discovery ────────────────────────────────────────────────
//
// `forge-sim dev` writes ~/.forge-sim/dev.json so session CLI commands
// (invoke, trigger, kvs, sql, ...) can target the running dev server's
// simulator instead of silently talking to a separate daemon instance
// (eval paper cut: `forge-sim trigger` → "No manifest loaded" while a dev
// server with the app deployed was sitting right there).

/** Record a running dev server so the CLI can find it. Called by `forge-sim dev`. */
export function writeDevServerFile(info: { port: number; pid: number; appDir: string }): void {
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(DEV_FILE, JSON.stringify(info));
  } catch { /* discovery is best-effort — dev server works without it */ }
}

/**
 * Remove the dev-server discovery file — but only if it still belongs to
 * `pid`. A newer dev server may have overwritten it; its record must survive
 * this (older) process's shutdown.
 */
export function removeDevServerFile(pid: number = process.pid): void {
  try {
    const info = JSON.parse(readFileSync(DEV_FILE, 'utf-8'));
    if (info?.pid === pid) unlinkSync(DEV_FILE);
  } catch { /* missing or unreadable — nothing to do */ }
}

/** Check if a dev server is running and healthy (mirrors getDaemonStatus). */
export async function getDevServerStatus(): Promise<DevServerInfo | null> {
  if (!existsSync(DEV_FILE)) return null;

  let info: any;
  try {
    info = JSON.parse(readFileSync(DEV_FILE, 'utf-8'));
  } catch {
    return null;
  }
  const pid = Number(info?.pid);
  const port = Number(info?.port);
  const appDir = typeof info?.appDir === 'string' ? info.appDir : '';
  if (!Number.isInteger(pid) || !Number.isInteger(port)) return null;

  // Process alive?
  try {
    process.kill(pid, 0);
  } catch {
    // Dead process (SIGKILL/crash skipped cleanup) — remove the stale file
    // so the CLI doesn't keep probing a ghost (same treatment as eval B5).
    try { unlinkSync(DEV_FILE); } catch { /* ok */ }
    return { port, pid, appDir, running: false };
  }

  // Health check via the tools API (shared createApiHandler under /__tools).
  try {
    const res = await fetch(`http://127.0.0.1:${port}/__tools/api/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) return { port, pid, appDir, running: true };
  } catch {
    return { port, pid, appDir, running: false };
  }

  return { port, pid, appDir, running: false };
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
    // Process is definitely dead (e.g. SIGKILL/crash skipped the daemon's
    // own cleanup) — remove the stale pid/port files so nothing else
    // tries to talk to a dead daemon (eval B5).
    cleanupStateFiles();
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
    cleanupStateFiles();
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

async function httpRequest(
  url: string,
  options: { method?: string; body?: any; timeout?: number } = {}
): Promise<any> {
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

/** Send a request to the daemon. Auto-starts if needed. */
export async function daemonRequest(
  path: string,
  options: { method?: string; body?: any; timeout?: number } = {}
): Promise<any> {
  const port = await ensureDaemon();
  return httpRequest(`http://127.0.0.1:${port}${path}`, options);
}

let announcedDevTarget = false;

/**
 * Send a session request to whichever simulator the user is most likely
 * working against:
 *
 *   1. A running `forge-sim dev` server, if one is up (via ~/.forge-sim/dev.json).
 *      Its tools API exposes the same routes as the daemon under `/__tools`.
 *   2. Otherwise the background daemon (auto-started).
 *
 * Set FORGE_SIM_TARGET=daemon to skip the dev server and force the daemon.
 * Lifecycle commands (deploy, status, stop) should keep using daemonRequest.
 */
export async function simRequest(
  path: string,
  options: { method?: string; body?: any; timeout?: number } = {}
): Promise<any> {
  if (process.env.FORGE_SIM_TARGET !== 'daemon') {
    const dev = await getDevServerStatus();
    if (dev?.running) {
      if (!announcedDevTarget) {
        announcedDevTarget = true;
        console.error(`  ↪ targeting dev server at http://127.0.0.1:${dev.port} (set FORGE_SIM_TARGET=daemon to use the daemon instead)`);
      }
      return httpRequest(`http://127.0.0.1:${dev.port}/__tools${path}`, options);
    }
  }
  return daemonRequest(path, options);
}
