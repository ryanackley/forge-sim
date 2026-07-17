/**
 * forge-sim Daemon — Standalone HTTP server for AI agents and CLI.
 *
 * Runs as a background process, auto-started by CLI commands.
 * Provides the same REST API as the __tools panel (via shared createApiHandler)
 * plus StreamableHTTP for native MCP clients.
 *
 * Lifecycle:
 *   - Auto-starts on first CLI command
 *   - Binds to 127.0.0.1 on a random available port
 *   - Writes PID + port to ~/.forge-sim/daemon.{pid,port}
 *   - Auto-exits after idle timeout (default: 30 min)
 *   - `forge-sim stop` kills it explicitly
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { resolve, dirname } from 'node:path';
import { mkdirSync, writeFileSync, unlinkSync, existsSync, readFileSync, appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { createSimulator } from './simulator.js';
import { createApiHandler } from './tools/api.js';

// ── Config ──────────────────────────────────────────────────────────────

const STATE_DIR = process.env.FORGE_SIM_STATE_DIR
  ? resolve(process.env.FORGE_SIM_STATE_DIR)
  : resolve(homedir(), '.forge-sim');
const PID_FILE = resolve(STATE_DIR, 'daemon.pid');
const PORT_FILE = resolve(STATE_DIR, 'daemon.port');
const LOG_FILE = resolve(STATE_DIR, 'daemon.log');
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// ── Simulator ───────────────────────────────────────────────────────────

const sim = createSimulator();

// ── Idle Timeout ────────────────────────────────────────────────────────

let lastActivity = Date.now();
let idleTimer: ReturnType<typeof setInterval>;

function touch(): void {
  lastActivity = Date.now();
}

function startIdleTimer(): void {
  idleTimer = setInterval(() => {
    if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) {
      log('Idle timeout reached, shutting down');
      shutdown();
    }
  }, 60_000); // Check every minute
}

// ── Logging ─────────────────────────────────────────────────────────────

function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stderr.write(line);
  try {
    appendFileSync(LOG_FILE, line);
  } catch { /* best effort */ }
}

// ── State Dir ───────────────────────────────────────────────────────────

function ensureStateDir(): void {
  mkdirSync(STATE_DIR, { recursive: true });
}

function writePidFile(port: number): void {
  ensureStateDir();
  writeFileSync(PID_FILE, String(process.pid), 'utf-8');
  writeFileSync(PORT_FILE, String(port), 'utf-8');
}

function cleanupPidFile(): void {
  try { unlinkSync(PID_FILE); } catch { /* ok */ }
  try { unlinkSync(PORT_FILE); } catch { /* ok */ }
}

// ── HTTP Server ─────────────────────────────────────────────────────────

const apiHandler = createApiHandler(sim);

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  touch();

  const url = new URL(req.url ?? '/', `http://localhost`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // All routes go through the shared API handler.
  // The API handler expects paths like /api/health, /api/deploy, etc.
  // In daemon mode, requests come in as /api/... directly (no /__tools prefix).
  if (url.pathname.startsWith('/api/')) {
    try {
      await apiHandler(req, res, url);
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Root — simple status page
  if (url.pathname === '/' && req.method === 'GET') {
    const manifest = sim.getManifest();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'forge-sim daemon',
      pid: process.pid,
      uptime: process.uptime(),
      deployed: !!manifest,
      appName: manifest?.raw?.app?.name ?? null,
      idleSeconds: Math.round((Date.now() - lastActivity) / 1000),
      idleTimeoutMinutes: IDLE_TIMEOUT_MS / 60_000,
    }, null, 2));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found. API routes are under /api/.' }));
});

// ── Shutdown ────────────────────────────────────────────────────────────

function shutdown(): void {
  log('Shutting down...');
  clearInterval(idleTimer);
  cleanupPidFile();

  // Clean up SQL (MySQL process) if running
  sim.sql?.stop?.().catch(() => {});

  server.close(() => {
    log('Server closed');
    process.exit(0);
  });

  // Force exit after 5s if graceful close hangs
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
// Cover non-signal exits too (uncaught exceptions, explicit process.exit,
// idle-timeout self-shutdown) so ~/.forge-sim/daemon.{pid,port} don't go
// stale — a stale port file made `forge-sim trigger` hit a dead daemon
// with a confusing ECONNREFUSED (eval B5). SIGKILL still can't be caught;
// getDaemonStatus() handles that case by validating the PID.
process.on('exit', cleanupPidFile);

// ── Start ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const requestedPort = parseInt(args.find(a => a.startsWith('--port='))?.split('=')[1] ?? '0');

  ensureStateDir();

  // Listen on 127.0.0.1 only (not 0.0.0.0)
  server.listen(requestedPort, '127.0.0.1', () => {
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : requestedPort;

    writePidFile(port);
    startIdleTimer();

    log(`Daemon started on http://127.0.0.1:${port} (PID ${process.pid})`);
    // Also write to stdout for the CLI to capture the port
    process.stdout.write(JSON.stringify({ port, pid: process.pid }) + '\n');
  });
}

main().catch((err) => {
  log(`Fatal error: ${err.message}`);
  cleanupPidFile();
  process.exit(1);
});
