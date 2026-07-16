/**
 * Stale-daemon detection for the MCP server.
 *
 * The MCP server is a long-lived process — it loads `dist/*.js` ONCE at
 * startup. If `forge-sim` is rebuilt (during dev) or upgraded via
 * `npm install` (in published-package usage), the daemon keeps the OLD
 * compiled code in memory. Tool calls then fail with errors that don't
 * match the current source — methods added in the new dist are
 * "not a function" on the in-memory simulator instance, properties on
 * shared globals drift, etc.
 *
 * This trap has bit at least three times in skill runs across two days
 * (logged in workspace MEMORY.md). The fix: the MCP server self-checks
 * its own dist/mcp-server.js mtime on every tool response. If the file
 * on disk has been rebuilt since the daemon started, every response
 * carries a loud warning telling the operator/agent to restart the
 * daemon. The MCP client respawns automatically on the next tool call.
 *
 * This module is the pure logic — file I/O and tool-handler wiring lives
 * in `mcp-server.ts`.
 */

/** Grace period to ignore filesystem clock skew on systems where stat's
 *  mtime resolution is coarse, or where touch-during-build hits the same
 *  wall-second as a few subsequent calls. 2 seconds is well below human-
 *  perceptible build time and above any plausible same-build noise. */
export const STALENESS_GRACE_MS = 2000;

/**
 * Decide whether the stale-daemon self-check should run at all.
 *
 * The check is a developer-experience tool: it catches the trap where we
 * rebuild forge-sim while the MCP daemon is running and end up serving
 * stale code. End-users who installed forge-sim from npm don't rebuild
 * the package mid-session, and a "stale daemon" warning in their tool
 * output would just be noise.
 *
 * Heuristic: if our own dist/mcp-server.js path contains "/node_modules/",
 * we were installed as a dependency — silent mode. Otherwise we're running
 * from a checkout (dev mode) — check enabled. `import.meta.url`-derived
 * paths resolve symlinks, so `npm link`-ed installs correctly read as the
 * dev checkout location.
 *
 * Override:
 *   FORGE_SIM_STALE_CHECK=off  forces silent mode
 *   FORGE_SIM_STALE_CHECK=on   forces active mode (useful when running
 *                              from node_modules during your own forge-sim
 *                              development workflow)
 */
export function shouldRunStalenessCheck(
  mcpServerPath: string,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const override = env.FORGE_SIM_STALE_CHECK?.toLowerCase();
  if (override === 'off' || override === '0' || override === 'false') return false;
  if (override === 'on' || override === '1' || override === 'true') return true;
  // Default: only active when running from a non-node_modules location.
  // The leading separator on both sides avoids matching paths whose own name
  // happens to start with "node_modules" (unlikely but explicit).
  return !mcpServerPath.includes('/node_modules/');
}

/**
 * Decide whether the daemon's loaded dist is stale relative to current disk.
 *
 * @param loadedMtimeMs  mtime of dist/mcp-server.js when the daemon imported it,
 *                       or null if the daemon couldn't stat itself at startup
 *                       (e.g. running from a packaged binary).
 * @param currentMtimeMs current mtime of dist/mcp-server.js on disk.
 * @param graceMs        ignore mtime differences below this threshold.
 */
export function isStale(
  loadedMtimeMs: number | null,
  currentMtimeMs: number,
  graceMs: number = STALENESS_GRACE_MS,
): boolean {
  if (loadedMtimeMs === null) return false;
  return currentMtimeMs > loadedMtimeMs + graceMs;
}

/**
 * Decide whether to actually emit the staleness warning on THIS tool response.
 *
 * The naive "warn if stale" approach fires on every single response while
 * dist is newer than the daemon's loaded mtime — which means after a single
 * rebuild, every subsequent MCP call carries the warning until the operator
 * restarts the daemon. Skill run #12 reported ~150 chars of noise per tool
 * call (~6KB across 39 calls). The agent learns nothing new after the first
 * one; the loud repeat is just pollution.
 *
 * This function dedupes: warn on first detection of a given on-disk mtime,
 * then suppress at that same mtime. Re-fires if dist gets rebuilt again
 * (currentMtimeMs advances), because that's a new event the agent should
 * know about. The PID + restart instructions land once per rebuild — loud
 * enough to act on, quiet enough to not drown out tool output.
 *
 * @param loadedMtimeMs      mtime of dist/mcp-server.js when the daemon
 *                           imported it at startup.
 * @param currentMtimeMs     current mtime of dist/mcp-server.js on disk.
 * @param lastWarnedMtimeMs  the mtime we last emitted a warning about (or
 *                           null if we haven't warned yet this session).
 * @param graceMs            ignore mtime differences below this threshold.
 *
 * Returns true if the caller should emit the warning now AND update its
 * lastWarnedMtimeMs to currentMtimeMs. Returns false to suppress.
 */
export function shouldWarnNow(
  loadedMtimeMs: number | null,
  currentMtimeMs: number | null,
  lastWarnedMtimeMs: number | null,
  graceMs: number = STALENESS_GRACE_MS,
): boolean {
  if (loadedMtimeMs === null || currentMtimeMs === null) return false;
  if (!isStale(loadedMtimeMs, currentMtimeMs, graceMs)) return false;
  // Already warned about this exact on-disk mtime — suppress until disk
  // changes again (or the daemon restarts and re-enters with a fresh
  // lastWarnedMtimeMs === null).
  return lastWarnedMtimeMs !== currentMtimeMs;
}

/**
 * Delay between sending the final (stale) tool response and exiting the
 * process for auto-restart. The MCP SDK writes the JSON-RPC response to
 * stdout right after the handler resolves; this window lets the pipe flush
 * before we die. Generous relative to any plausible flush time, invisible
 * relative to human/agent iteration speed.
 */
export const AUTO_RESTART_EXIT_DELAY_MS = 500;

/**
 * Decide whether a stale daemon should exit so the MCP client respawns it
 * with fresh code (publish-gate F2).
 *
 * Manual recovery ("run `kill <pid>` yourself") worked but made stale-daemon
 * first contact a two-step dance: read the warning, kill, retry. Auto-restart
 * collapses it to zero steps — the daemon answers the in-flight call (with a
 * loud notice), then exits; the client transparently respawns a fresh daemon
 * on the next call.
 *
 * Default ON whenever the staleness check itself is enabled. Override:
 *   FORGE_SIM_STALE_AUTORESTART=off  warn-only mode (the pre-F2 behavior —
 *                                    useful if you want to keep in-memory
 *                                    sim state alive across rebuilds)
 */
export function shouldAutoRestartOnStale(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const override = env.FORGE_SIM_STALE_AUTORESTART?.toLowerCase();
  if (override === 'off' || override === '0' || override === 'false') return false;
  return true;
}

/**
 * Build the notice prepended to the FINAL response of a stale daemon that is
 * about to auto-restart. Self-contained: replaces (not supplements) the
 * manual-kill warning, because "run kill <pid>" is wrong advice when the
 * process is already exiting on its own.
 *
 * Must tell the agent three things:
 *   1. THIS response came from the old code — treat with suspicion.
 *   2. The next tool call runs on fresh code automatically.
 *   3. In-memory state died with the daemon — re-deploy before invoking.
 */
export function buildAutoRestartNotice(
  pid: number,
  loadedMtimeMs: number,
  currentMtimeMs: number,
): string {
  const loadedAt = new Date(loadedMtimeMs).toISOString();
  const rebuiltAt = new Date(currentMtimeMs).toISOString();
  return (
    `♻️  STALE forge-sim MCP daemon (pid=${pid}) — auto-restarting. ` +
    `This process loaded dist/mcp-server.js at ${loadedAt}, but the file on disk was rebuilt at ${rebuiltAt}. ` +
    `THIS response was produced by the OLD code and may not match the current build. ` +
    `The daemon exits right after this response; your MCP client respawns it with fresh code on the next tool call. ` +
    `In-memory simulator state is gone — call forge.deploy again before invoking. ` +
    `Set FORGE_SIM_STALE_AUTORESTART=off to disable auto-restart (warn-only mode).`
  );
}

/**
 * Build the warning string the daemon prepends to tool responses when stale.
 * Includes the PID so the operator can `kill <pid>` directly; the MCP client
 * respawns the daemon on the next tool call.
 */
export function buildStalenessWarning(
  pid: number,
  loadedMtimeMs: number,
  currentMtimeMs: number,
): string {
  const loadedAt = new Date(loadedMtimeMs).toISOString();
  const rebuiltAt = new Date(currentMtimeMs).toISOString();
  return (
    `⚠️  STALE forge-sim MCP daemon (pid=${pid}). ` +
    `This process loaded dist/mcp-server.js at ${loadedAt}, ` +
    `but the file on disk has been rebuilt at ${rebuiltAt}. ` +
    `Tool responses below may not match the current dist/. ` +
    `Restart the daemon: \`kill ${pid}\` — your MCP client will respawn it automatically with the new code.`
  );
}
