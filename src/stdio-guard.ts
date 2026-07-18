/**
 * Stdio hygiene for the MCP server (eval-7 F4).
 *
 * Over the stdio transport, stdout IS the JSON-RPC framing channel — any
 * stray `console.log` (deploy ⏰ banners, app handler output, 📡 auth
 * notices) corrupts the stream and shows up client-side as `[non-json]`
 * noise. This rebinds the stdout-writing console methods (log/info/debug)
 * to stderr for the process's lifetime. warn/error already write to
 * stderr in Node, so they're untouched.
 *
 * Deliberately bound to a dedicated stderr Console instance rather than
 * delegating to `console.error`: console-capture patches console methods
 * at capture time with real-console passthrough, so a log→error delegation
 * would double-capture every line (once as 'log', again as 'error' via the
 * passthrough). A separate Console instance sidesteps the patch entirely —
 * install this guard BEFORE any capture and the capture machinery simply
 * stores/restores the rebound functions like any other "original".
 *
 * Extracted into its own module so tests can pin the behavior without
 * importing mcp-server.ts (which starts a transport on import).
 */

/**
 * Rebind console.log/info/debug to stderr. Returns a restore function
 * (used by tests; the MCP server never restores).
 */
export function redirectStdoutConsoleToStderr(): () => void {
  const originals = {
    log: console.log,
    info: console.info,
    debug: console.debug,
  };
  const stderrConsole = new console.Console(process.stderr, process.stderr);
  console.log = stderrConsole.log.bind(stderrConsole);
  console.info = stderrConsole.info.bind(stderrConsole);
  console.debug = stderrConsole.debug.bind(stderrConsole);
  return () => {
    console.log = originals.log;
    console.info = originals.info;
    console.debug = originals.debug;
  };
}
