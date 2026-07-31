/**
 * Manifest validation via Atlassian's official @forge/manifest package.
 *
 * Runs the same FullValidationProcessor that `forge lint` / `forge deploy` use,
 * so forge-sim rejects manifests that real Forge would reject.
 *
 * Two entry points:
 * - validateManifestFile(path): full validation including file-existence checks
 *   (handler files, resource paths). Used by deploy(appDir).
 * - validateManifestContent(content): validation of an inline YAML string.
 *   File-existence errors are filtered out (there is no app directory to check
 *   against). Schema/shape errors still apply. Used by sim.loadManifest(yaml).
 */

import { createHash } from 'crypto';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { validate } from '@forge/manifest';
import type { ManifestWarning } from './manifest.js';

/** Placeholder app ARI that satisfies the schema when no registered app id is available. */
export const PLACEHOLDER_APP_ID =
  'ari:cloud:ecosystem::app/00000000-0000-0000-0000-000000000000';

/**
 * Error-message patterns that reference files on disk. These are meaningless
 * when validating an inline YAML string (no app directory exists), so string
 * mode filters them out.
 */
const FILE_EXISTENCE_PATTERNS: RegExp[] = [
  /cannot find associated file/i,
  /missing resource '.*' is being referenced/i,
];

/** Remediation hints appended to specific validator errors. */
const REMEDIATION_HINTS: Array<{ pattern: RegExp; hint: string }> = [
  {
    pattern: /app\/id must match pattern|app must have required property 'id'/i,
    hint:
      `Hint: run 'forge register' (Forge CLI, requires network + an Atlassian developer account) to get a real app id, ` +
      `or use the placeholder '${PLACEHOLDER_APP_ID}' for local simulation.`,
  },
  {
    pattern: /app must have required property 'runtime'/i,
    hint: `Hint: add "runtime: { name: nodejs22.x }" under the "app:" section.`,
  },
  {
    pattern: /must have required property 'icon'/i,
    hint: `Hint: add an "icon:" property with any https URL (e.g. https://example.com/icon.svg); forge-sim does not fetch it.`,
  },
  {
    pattern: /must have required property 'resource'|must have required property 'render'/i,
    hint: `Hint: UI Kit modules need "resource: <key>" + "render: native"; a bare "function:" on a UI module is the deprecated UI Kit 1 style.`,
  },
  {
    pattern: /must have at least 1 module/i,
    hint: `Hint: "function:" entries alone don't count as modules; declare at least one real module (e.g. webtrigger, jira:issuePanel, macro).`,
  },
];

interface RawValidationError {
  message: string;
  reference?: string;
  level: 'error' | 'warning';
  line?: number;
  column?: number;
}

/**
 * @forge/manifest's validate() reads process-global state (cwd-relative file
 * resolution happens against the manifest path, but ajv compilation and some
 * processors share module state). Serialize calls to be safe.
 */
let validateChain: Promise<unknown> = Promise.resolve();

function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const next = validateChain.then(fn, fn);
  validateChain = next.catch(() => undefined);
  return next;
}

function formatWarning(err: RawValidationError): ManifestWarning {
  const loc =
    err.line !== undefined
      ? `manifest.yml:${err.line}${err.column !== undefined ? `:${err.column}` : ''} `
      : '';
  const ref = err.reference ? ` [${err.reference}]` : '';
  let message = `${loc}${err.message}${ref}`;

  for (const { pattern, hint } of REMEDIATION_HINTS) {
    if (pattern.test(err.message)) {
      message += `\n  ${hint}`;
      break;
    }
  }

  return {
    level: err.level === 'error' ? 'error' : 'warning',
    message,
  };
}

async function runValidator(manifestPath: string): Promise<RawValidationError[]> {
  return serialized(async () => {
    const result = await validate(false, manifestPath);
    return (result.errors ?? []) as RawValidationError[];
  });
}

/**
 * Validate a manifest.yml on disk with the official Forge validator.
 * Includes file-existence checks (handler files under src/, resource paths).
 *
 * Not memoized: file-existence results depend on filesystem state, and the
 * common MCP iteration loop is "deploy fails -> create missing file -> deploy
 * again", which must see fresh results.
 */
export async function validateManifestFile(manifestPath: string): Promise<ManifestWarning[]> {
  const errors = await runValidator(manifestPath);
  return errors.map(formatWarning);
}

/** Content-hash memoization for string mode (schema results are deterministic). */
const contentCache = new Map<string, ManifestWarning[]>();
const CONTENT_CACHE_MAX = 200;

/**
 * Validate inline manifest YAML content (no app directory). File-existence
 * errors are filtered out; schema and shape errors still apply.
 */
export async function validateManifestContent(content: string): Promise<ManifestWarning[]> {
  const hash = createHash('sha256').update(content).digest('hex');
  const cached = contentCache.get(hash);
  if (cached) return cached;

  const dir = await mkdtemp(join(tmpdir(), 'forge-sim-manifest-'));
  let errors: RawValidationError[];
  try {
    const manifestPath = join(dir, 'manifest.yml');
    await writeFile(manifestPath, content, 'utf8');
    errors = await runValidator(manifestPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }

  const warnings = errors
    .filter((e) => !FILE_EXISTENCE_PATTERNS.some((p) => p.test(e.message)))
    .map(formatWarning);

  if (contentCache.size >= CONTENT_CACHE_MAX) {
    const oldest = contentCache.keys().next().value;
    if (oldest !== undefined) contentCache.delete(oldest);
  }
  contentCache.set(hash, warnings);
  return warnings;
}

/** True if any warning is error-level (deploy/load must hard-fail). */
export function hasValidationErrors(warnings: ManifestWarning[]): boolean {
  return warnings.some((w) => w.level === 'error');
}

/**
 * Process-lifetime dedupe for printed manifest warnings.
 *
 * Module scope is the right granularity: each vitest worker / dev-server
 * process gets its own Set, and within a process a unique warning message
 * prints exactly once — vitest test files commonly create a fresh sim in
 * `beforeEach`, and without this the same warning prints N times in an
 * N-test file (F7). The warnings arrays still carry every warning for
 * programmatic callers (MCP responses, in-process inspection).
 */
const printedManifestWarnings = new Set<string>();

/**
 * Test-only escape hatch for resetting the module-scope dedupe Set.
 * Used by `warning-noise.test.ts` so each F7 case starts from a clean slate.
 * Underscore prefix signals "do not call from production code."
 */
export function _resetPrintedManifestWarnings(): void {
  printedManifestWarnings.clear();
}

/** Print manifest warnings to the console, deduped per process. */
export function printManifestWarnings(warnings: ManifestWarning[]): void {
  for (const w of warnings) {
    if (printedManifestWarnings.has(w.message)) continue;
    printedManifestWarnings.add(w.message);
    const prefix = w.level === 'error' ? '❌' : '⚠️';
    console.warn(`[forge-sim] ${prefix} ${w.message}`);
  }
}
