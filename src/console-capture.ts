/**
 * Console capture — intercepts console.log/warn/error/info/debug
 * during Forge handler execution and routes them to the simulator's log.
 *
 * Forge apps use console.* as their primary logging mechanism.
 * This captures those calls so they appear in forge:logs output.
 *
 * ## Reentrancy
 *
 * `startCapture()` / `stopCapture()` are stack-based: each `start` pushes a
 * new buffer, each `stop` pops and returns the top buffer. Console output
 * is captured into ONLY the topmost buffer at the time of the log call.
 *
 * Why: handlers commonly call other handlers (resolver → appEvents.publish →
 * trigger handler), so capture scopes nest. Each scope captures its own
 * direct logs (the lines emitted *between* sub-calls). Sub-calls capture
 * their own scope on the inner buffer. Console patching happens once at
 * the bottom of the stack and is restored when the stack drains.
 *
 * Net effect on the simulator's combined log: each console line appears
 * exactly once, attributed to whichever scope was active when it ran.
 */

export interface ConsoleLine {
  timestamp: number;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  args: any[];
  message: string;
}

const CAPTURED_METHODS = ['log', 'warn', 'error', 'info', 'debug'] as const;

const bufferStack: ConsoleLine[][] = [];
const originals = new Map<string, (...args: any[]) => void>();

function patchConsole(): void {
  for (const method of CAPTURED_METHODS) {
    // Store the raw reference (no .bind) so the restored function has the
    // same identity as before patching. Console methods in modern Node don't
    // require `this`; calling without bind is safe.
    const orig = console[method];
    originals.set(method, orig);
    console[method] = (...args: any[]) => {
      const message = args
        .map((a) => (typeof a === 'string' ? a : JSON.stringify(a, null, 2) ?? String(a)))
        .join(' ');
      const top = bufferStack[bufferStack.length - 1];
      if (top) {
        top.push({
          timestamp: Date.now(),
          level: method,
          args,
          message,
        });
      }
      // Passthrough to the real console
      orig(...args);
    };
  }
}

function unpatchConsole(): void {
  for (const method of CAPTURED_METHODS) {
    const orig = originals.get(method);
    if (orig) console[method] = orig;
  }
  originals.clear();
}

/**
 * Start capturing console output. Call before invoking a handler.
 *
 * Reentrant: each call pushes a new buffer onto the stack. Logs go to the
 * topmost buffer only. Console is patched on the first start; restored when
 * the last buffer is popped.
 */
export function startCapture(): void {
  if (bufferStack.length === 0) {
    patchConsole();
  }
  bufferStack.push([]);
}

/**
 * Stop capturing and return the lines captured by the topmost buffer
 * (i.e. the most recent matching `startCapture()`).
 *
 * Returns `[]` if there is no active capture.
 */
export function stopCapture(): ConsoleLine[] {
  const lines = bufferStack.pop();
  if (lines === undefined) return [];
  if (bufferStack.length === 0) {
    unpatchConsole();
  }
  return lines;
}

/**
 * Run a function with console capture, returning both the result and the
 * console lines emitted directly during this scope (lines from nested
 * `withCapture` calls are NOT included — they belong to the inner scope).
 */
export async function withCapture<T>(fn: () => Promise<T>): Promise<{ result: T; console: ConsoleLine[] }> {
  startCapture();
  try {
    const result = await fn();
    return { result, console: stopCapture() };
  } catch (err) {
    const captured = stopCapture();
    // Attach captured console to the error for debugging
    if (err instanceof Error) {
      (err as any).capturedConsole = captured;
    }
    throw err;
  }
}

/**
 * Test-only escape hatch: drain the stack and unpatch console. Use this in
 * test teardown if a test threw before reaching `stopCapture()`. Real code
 * should always pair start/stop via `withCapture`.
 *
 * @internal
 */
export function __resetCaptureForTests(): void {
  bufferStack.length = 0;
  unpatchConsole();
}
