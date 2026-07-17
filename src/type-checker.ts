/**
 * TypeScript type checking utilities for forge-sim.
 *
 * Used by both:
 * - `forge-sim dev` — spawns `tsc --watch --noEmit` as a child process,
 *   parses streaming output, broadcasts errors to the tools UI
 * - `forge.deploy` MCP tool — synchronous pre-deploy check
 */

import { join, dirname } from 'node:path';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
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

/**
 * TS diagnostics that are *advisory* in plain-JS files.
 *
 * These arise from strict property-access / iteration analysis against
 * library generics (e.g. `InvokeResponse<InvokeResponse>` from
 * @forge/bridge, `any[] | UpdateQueryResponse` unions from @forge/sql).
 * In a .js/.jsx file the only "fix" is adding JSDoc type annotations —
 * something a plain-JS app never opted into. Real typos still surface as
 * TS2551 ("Property 'x' does not exist ... Did you mean 'y'?"), a separate
 * code that stays reported. Assignability errors (TS2322/TS2345) also stay:
 * those are actionable by changing the value being passed.
 *
 * Only applied when the app has NO tsconfig.json of its own (i.e. we're
 * type-checking with the synthetic checkJs config). Apps with a tsconfig
 * opted into type checking and get everything.
 */
export const JS_ADVISORY_CODES = new Set([
  'TS2339', // Property does not exist on type
  'TS2488', // Type must have a '[Symbol.iterator]()' method
  'TS2349', // This expression is not callable
]);

const JS_FILE_RE = /\.(js|jsx|mjs|cjs)$/i;

/**
 * Drop advisory diagnostics from plain-JS files when the app never opted
 * into type checking (no tsconfig.json of its own). Returns the kept
 * errors plus how many were suppressed (for a one-line info log).
 */
export function filterJsAdvisoryErrors(
  errors: TypeCheckError[],
  hasOwnTsconfig: boolean
): { errors: TypeCheckError[]; suppressed: number } {
  if (hasOwnTsconfig) return { errors, suppressed: 0 };
  const kept = errors.filter(
    e => !(JS_ADVISORY_CODES.has(e.code) && JS_FILE_RE.test(e.file))
  );
  return { errors: kept, suppressed: errors.length - kept.length };
}

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
    // No `baseUrl`: it was removed in TypeScript 7, and since we drive the
    // *app's* installed TypeScript, emitting it produced a phantom TS5102
    // ("Option 'baseUrl' has been removed") on every deploy for TS7 apps
    // (eval 3 finding #2). Nothing needed it — there are no `paths` mappings
    // and Forge apps use relative + node_modules imports only.
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
 * Minimum TypeScript major version we can drive.
 *
 * The synthetic tsconfig uses `moduleResolution: 'bundler'` (TS 5.0+) and
 * `jsx: 'react-jsx'` (TS 4.1+), and modern @types packages use syntax that
 * older parsers report as TS1005 spam. npm regularly hoists ancient
 * *transitive* typescript versions (e.g. 3.9.x via the Atlaskit tree inside
 * @forge/react) to the app's top-level node_modules — those must never win
 * over forge-sim's bundled TypeScript.
 */
const MIN_TS_MAJOR = 5;

/** Read the major version of typescript installed under `baseDir`, or null. */
function installedTsMajor(baseDir: string): number | null {
  try {
    const pkg = JSON.parse(
      readFileSync(join(baseDir, 'node_modules', 'typescript', 'package.json'), 'utf-8')
    );
    const major = parseInt(String(pkg.version).split('.')[0], 10);
    return Number.isFinite(major) ? major : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the tsc binary. Prefers the app's node_modules tsc when it's
 * modern enough (>= TS 5), otherwise falls back to forge-sim's own
 * bundled typescript.
 */
export function resolveTsc(appDir: string): string | null {
  // 1. App's own tsc (preferred — matches their TS version), but only if
  //    it's new enough to parse our synthetic tsconfig + modern @types.
  const appTsMajor = installedTsMajor(appDir);
  if (appTsMajor === null || appTsMajor >= MIN_TS_MAJOR) {
    const appTsc = join(appDir, 'node_modules', '.bin', 'tsc');
    if (existsSync(appTsc)) return appTsc;

    const appTscJs = join(appDir, 'node_modules', 'typescript', 'bin', 'tsc');
    if (existsSync(appTscJs)) return `node ${appTscJs}`;
  } else {
    console.log(
      `  ℹ️  App has typescript@${appTsMajor}.x in node_modules (likely a hoisted ` +
      `transitive dependency) — too old for type checking, using forge-sim's TypeScript instead`
    );
  }

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

  const hasOwnTsconfig = existsSync(join(appDir, 'tsconfig.json'));
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
    const { errors, suppressed } = filterJsAdvisoryErrors(parseTscOutput(output), hasOwnTsconfig);
    if (suppressed > 0) {
      console.log(
        `  ℹ️  ${suppressed} type-strictness diagnostic(s) in plain-JS files suppressed ` +
        `(only fixable with JSDoc annotations) — add a tsconfig.json to opt in`
      );
    }
    return errors;
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
 *
 * Errors inside node_modules are never critical: the app developer can't fix
 * a dependency's .d.ts, and we run with skipLibCheck anyway (which skips
 * semantic checks but NOT syntax errors — an old tsc parsing a modern @types
 * package produces TS1005 spam that would otherwise flood this filter).
 */
export function filterCriticalErrors(errors: TypeCheckError[]): TypeCheckError[] {
  return errors.filter(
    e => CRITICAL_TS_ERROR_CODES.has(e.code) && !/(^|[\\/])node_modules[\\/]/.test(e.file)
  );
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

  const hasOwnTsconfig = existsSync(join(appDir, 'tsconfig.json'));
  const tsconfigPath = ensureTsconfig(appDir);

  // Parse the tsc command (might be "node /path/to/tsc" or just "/path/to/tsc")
  const parts = tsc.split(' ');
  const cmd = parts[0];
  const baseArgs = parts.slice(1);

  let errors: TypeCheckError[] = [];
  let checking = true;
  let buffer = '';
  let loggedSuppression = false;

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
      const filtered = filterJsAdvisoryErrors(parseTscOutput(buffer), hasOwnTsconfig);
      errors = filtered.errors;
      if (filtered.suppressed > 0 && !loggedSuppression) {
        loggedSuppression = true;
        console.log(
          `  ℹ️  ${filtered.suppressed} type-strictness diagnostic(s) in plain-JS files suppressed ` +
          `(only fixable with JSDoc annotations) — add a tsconfig.json to opt in`
        );
      }
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
