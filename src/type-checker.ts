/**
 * TypeScript type checking utilities for forge-sim.
 *
 * Used by both:
 * - `forge-sim dev` — spawns `tsc --watch --noEmit` as a child process,
 *   parses streaming output, broadcasts errors to the tools UI
 * - `forge.deploy` MCP tool — synchronous pre-deploy check
 */

import { join, dirname } from 'node:path';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface TypeCheckError {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
}

/**
 * TS error codes that indicate real runtime/deploy-breaking issues.
 * Used by the Vite overlay filter — MCP surfaces ALL errors.
 */
export const CRITICAL_TS_ERROR_CODES = new Set([
  'TS2307', // Cannot find module
  'TS2305', // Module has no exported member
  'TS2304', // Cannot find name
  'TS2322', // Type is not assignable (catches wrong prop types etc.)
  'TS2345', // Argument of type X is not assignable to parameter of type Y
  'TS2339', // Property does not exist on type
  'TS2614', // Module has no default export
  'TS1005', // Expected token (syntax error)
  'TS1003', // Identifier expected (syntax error)
  'TS1128', // Declaration or statement expected (syntax error)
]);

/** Synthetic tsconfig content for JS-only projects.
 *
 * The `module: 'esnext'` + `moduleResolution: 'bundler'` pairing matches how
 * Forge apps are actually built (webpack / esbuild handle resolution) and is
 * the only TS-valid combination that doesn't trigger TS5110 ("Option 'module'
 * must be set to 'Node16' when option 'moduleResolution' is set to 'Node16'").
 * `node16` would force the user to write file extensions on every import,
 * which neither real Forge nor the test apps do.
 */
const SYNTHETIC_TSCONFIG = {
  compilerOptions: {
    allowJs: true,
    checkJs: true,
    noEmit: true,
    strict: false,
    skipLibCheck: true,
    target: 'es2022',
    module: 'esnext',
    moduleResolution: 'bundler',
    jsx: 'react-jsx',
    baseUrl: '..',
  },
  include: ['../src/**/*'],
};

/**
 * Ensure a tsconfig exists for type checking. Returns the path to use.
 *
 * - If the app has its own tsconfig.json, returns that path.
 * - Otherwise, generates a synthetic one in .forge-sim/tsconfig.check.json.
 */
export function ensureTsconfig(appDir: string): string {
  const appTsconfig = join(appDir, 'tsconfig.json');
  if (existsSync(appTsconfig)) {
    return appTsconfig;
  }

  // Generate synthetic tsconfig for JS-only projects
  const forgeSimDir = join(appDir, '.forge-sim');
  mkdirSync(forgeSimDir, { recursive: true });
  const syntheticPath = join(forgeSimDir, 'tsconfig.check.json');
  writeFileSync(syntheticPath, JSON.stringify(SYNTHETIC_TSCONFIG, null, 2), 'utf-8');
  return syntheticPath;
}

/**
 * Resolve the tsc binary. Checks app's node_modules first,
 * then falls back to forge-sim's own bundled typescript.
 */
export function resolveTsc(appDir: string): string | null {
  // 1. App's own tsc (preferred — matches their TS version)
  const appTsc = join(appDir, 'node_modules', '.bin', 'tsc');
  if (existsSync(appTsc)) return appTsc;

  const appTscJs = join(appDir, 'node_modules', 'typescript', 'bin', 'tsc');
  if (existsSync(appTscJs)) return `node ${appTscJs}`;

  // 2. forge-sim's own typescript (bundled as a dependency)
  const forgeSimRoot = join(__dirname, '..');
  const simTsc = join(forgeSimRoot, 'node_modules', '.bin', 'tsc');
  if (existsSync(simTsc)) return simTsc;

  const simTscJs = join(forgeSimRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  if (existsSync(simTscJs)) return `node ${simTscJs}`;

  return null;
}

/**
 * Run synchronous type checking on an app directory.
 * Returns an array of structured errors (empty = no errors).
 *
 * Used by the MCP forge.deploy tool for pre-deploy checking.
 */
export function typeCheck(appDir: string): TypeCheckError[] {
  const tsc = resolveTsc(appDir);
  if (!tsc) {
    console.warn('[forge-sim] ⚠️ TypeScript not found in app node_modules — skipping type check');
    return [];
  }

  const tsconfigPath = ensureTsconfig(appDir);

  try {
    execSync(`${tsc} --noEmit --project "${tsconfigPath}"`, {
      cwd: appDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // No errors — tsc exits 0
    return [];
  } catch (err: any) {
    // tsc exits non-zero when there are errors; stdout contains the diagnostics
    const output = (err.stdout || '') + (err.stderr || '');
    return parseTscOutput(output);
  }
}

/**
 * Parse tsc CLI output into structured error objects.
 *
 * tsc output format: `file(line,col): error TSxxxx: message`
 */
export function parseTscOutput(output: string): TypeCheckError[] {
  const errors: TypeCheckError[] = [];
  const lineRegex = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/gm;

  let match;
  while ((match = lineRegex.exec(output)) !== null) {
    errors.push({
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      code: match[4],
      message: match[5],
    });
  }

  return errors;
}

/**
 * Filter errors to only critical ones that would break deploy/runtime.
 */
export function filterCriticalErrors(errors: TypeCheckError[]): TypeCheckError[] {
  return errors.filter(e => CRITICAL_TS_ERROR_CODES.has(e.code));
}

// ── Watch Mode ─────────────────────────────────────────────────────────

export interface TypeCheckWatcher {
  /** Kill the tsc --watch process */
  close(): void;
  /** Current error list (updated on each tsc cycle) */
  readonly errors: TypeCheckError[];
  /** Whether tsc is currently running a check */
  readonly checking: boolean;
}

export interface TypeCheckWatchOptions {
  appDir: string;
  /** Called when tsc finishes a check cycle with the full error list */
  onErrors: (errors: TypeCheckError[], criticalOnly: TypeCheckError[]) => void;
  /** Called when tsc starts a new check cycle */
  onCheckStart?: () => void;
}

/**
 * Start `tsc --watch --noEmit` as a child process.
 * Parses streaming output and calls onErrors after each cycle.
 *
 * tsc --watch uses ANSI clear-screen sequences (\x1Bc or \x1B[2J)
 * and the "Found X errors" / "Found 0 errors" summary line as cycle delimiters.
 */
export function startTypeCheckWatch(options: TypeCheckWatchOptions): TypeCheckWatcher | null {
  const { appDir, onErrors, onCheckStart } = options;

  const tsc = resolveTsc(appDir);
  if (!tsc) {
    console.log('  ℹ️  TypeScript not found — skipping type checker');
    return null;
  }

  const tsconfigPath = ensureTsconfig(appDir);

  // Parse the tsc command (might be "node /path/to/tsc" or just "/path/to/tsc")
  const parts = tsc.split(' ');
  const cmd = parts[0];
  const baseArgs = parts.slice(1);

  let errors: TypeCheckError[] = [];
  let checking = true;
  let buffer = '';

  const child = spawn(cmd, [...baseArgs, '--watch', '--noEmit', '--project', tsconfigPath, '--pretty', 'false'], {
    cwd: appDir,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0' },
  });

  function processOutput(data: string) {
    buffer += data;

    // tsc --watch delimits cycles with "Found N error(s)" lines
    // Format: "Found 3 errors. Watching for file changes."
    //    or:  "Found 0 errors. Watching for file changes."
    const foundMatch = buffer.match(/Found (\d+) errors?\. Watching for file changes\./);
    if (foundMatch) {
      // Parse all errors from this cycle's buffer
      errors = parseTscOutput(buffer);
      const critical = filterCriticalErrors(errors);
      checking = false;
      onErrors(errors, critical);
      buffer = '';
      return;
    }

    // Detect start of new cycle — tsc outputs "Starting compilation" or
    // "File change detected. Starting incremental compilation..."
    if (buffer.includes('Starting compilation') || buffer.includes('Starting incremental compilation')) {
      checking = true;
      onCheckStart?.();
      // Don't clear buffer — errors will follow
    }
  }

  child.stdout?.on('data', (chunk: Buffer) => processOutput(chunk.toString()));
  child.stderr?.on('data', (chunk: Buffer) => processOutput(chunk.toString()));

  child.on('error', (err) => {
    console.warn(`  ⚠️  Type checker process error: ${err.message}`);
  });

  child.on('exit', (code) => {
    if (code !== null && code !== 0) {
      // tsc --watch shouldn't exit normally unless killed
      // Ignore — we handle errors via output parsing
    }
  });

  return {
    close() {
      child.kill('SIGTERM');
    },
    get errors() { return errors; },
    get checking() { return checking; },
  };
}
