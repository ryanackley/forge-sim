/**
 * Console capture — intercepts console.log/warn/error/info/debug
 * during Forge handler execution and routes them to the simulator's log.
 *
 * Forge apps use console.* as their primary logging mechanism.
 * This captures those calls so they appear in forge:logs output.
 */

export interface ConsoleLine {
  timestamp: number;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  args: any[];
  message: string;
}

const CAPTURED_METHODS = ['log', 'warn', 'error', 'info', 'debug'] as const;

let capturing = false;
let capturedLines: ConsoleLine[] = [];
const originals = new Map<string, (...args: any[]) => void>();

/**
 * Start capturing console output. Call before invoking a handler.
 * Nested calls are safe — only the outermost start/stop pair matters.
 */
export function startCapture(): void {
  if (capturing) return;
  capturing = true;

  for (const method of CAPTURED_METHODS) {
    originals.set(method, console[method].bind(console));
    console[method] = (...args: any[]) => {
      const message = args
        .map((a) => (typeof a === 'string' ? a : JSON.stringify(a, null, 2) ?? String(a)))
        .join(' ');
      capturedLines.push({
        timestamp: Date.now(),
        level: method,
        args,
        message,
      });
      // Still output to real console (passthrough)
      originals.get(method)!(...args);
    };
  }
}

/**
 * Stop capturing and return all captured lines since startCapture().
 */
export function stopCapture(): ConsoleLine[] {
  if (!capturing) return [];
  capturing = false;

  for (const method of CAPTURED_METHODS) {
    const orig = originals.get(method);
    if (orig) console[method] = orig;
  }
  originals.clear();

  const lines = capturedLines;
  capturedLines = [];
  return lines;
}

/**
 * Run a function with console capture, returning both the result and captured lines.
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
