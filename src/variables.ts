/**
 * Environment variables — RT-033/034/035.
 *
 * Real Forge:
 *   - `forge variables set [--encrypt] KEY value` stores per-environment vars.
 *   - Vars are exposed to app code as plain `process.env.KEY`.
 *   - Encrypted vars are encrypted AT REST only — the app still reads
 *     CLEARTEXT from process.env (per Forge docs). `--encrypt` only masks
 *     the value in `forge variables list`.
 *   - **Changes do NOT take effect until the app is redeployed.** This is
 *     Forge's #1 env-var footgun (the docs have a troubleshooting section
 *     on it) — forge-sim reproduces it exactly by injecting at deploy time.
 *   - `forge tunnel` forwards host vars prefixed `FORGE_USER_VAR_MY_KEY`
 *     into the app as `MY_KEY`.
 *
 * Sim sources, in ascending precedence:
 *   1. Host env `FORGE_USER_VAR_<KEY>`   (tunnel parity)
 *   2. `<appDir>/.forge-sim/variables.json`  (dev-mode file, re-read each deploy)
 *   3. `sim.setVariables({...})` / MCP `forge_variables_set`  (ephemeral,
 *      never persisted to disk, survives reset — real Forge vars are
 *      environment-scoped, not deployment-scoped)
 *
 * variables.json value shapes:
 *   { "MY_KEY": "value" }
 *   { "SECRET": { "value": "s3cret", "encrypt": true } }
 *
 * Injection lifecycle:
 *   - `inject(appDir)` runs at every deploy, BEFORE handler modules are
 *     loaded (top-level handler code reads process.env at evaluation time).
 *   - Prior process.env values for injected keys are snapshotted and
 *     restored before each re-injection and on `reset()`, so vars never
 *     leak across sim instances / app dirs within one test run.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface ForgeVariable {
  value: string;
  encrypt: boolean;
}

export type VariableInput = string | { value: string; encrypt?: boolean };

export interface VariableListEntry {
  key: string;
  /** Masked as '••••••••' when encrypt is true (list surfaces only — process.env always gets cleartext, matching Forge). */
  value: string;
  encrypt: boolean;
  source: 'host' | 'file' | 'ephemeral';
}

export const FORGE_USER_VAR_PREFIX = 'FORGE_USER_VAR_';
export const VARIABLES_FILE = 'variables.json';
const MASK = '••••••••';

type Logger = (level: string, message: string, detail?: any) => void;

export class VariablesManager {
  /** Set via setVariables() — never persisted, survives reset (env-scoped like real Forge). */
  private ephemeral = new Map<string, ForgeVariable>();
  /** Loaded from .forge-sim/variables.json at each deploy. */
  private fileVars = new Map<string, ForgeVariable>();
  /** process.env values that existed before injection (undefined = key was absent). */
  private snapshot = new Map<string, string | undefined>();
  /** Whether at least one deploy-time injection has happened. */
  private injected = false;
  private log: Logger;

  constructor(log?: Logger) {
    this.log = log ?? (() => {});
  }

  // ── Imperative API (test + MCP surfaces) ─────────────────────────────

  /**
   * Set ephemeral variables. NOT written to disk. Like real Forge,
   * values set after a deploy don't reach process.env until the next
   * deploy — we warn when that's the case.
   */
  setVariables(vars: Record<string, VariableInput>): void {
    for (const [key, input] of Object.entries(vars)) {
      this.ephemeral.set(key, normalizeVariable(key, input));
    }
    if (this.injected) {
      const keys = Object.keys(vars).join(', ');
      this.log(
        'warn',
        `[forge-sim] Variables set (${keys}) — like real Forge, changes won't take effect until you redeploy.`
      );
    }
  }

  /** Remove an ephemeral variable. Takes effect at the next deploy (Forge parity). */
  unsetVariable(key: string): boolean {
    const existed = this.ephemeral.delete(key);
    if (existed && this.injected) {
      this.log(
        'warn',
        `[forge-sim] Variable "${key}" unset — like real Forge, the change won't take effect until you redeploy.`
      );
    }
    return existed;
  }

  /**
   * Merged view of all variable sources (host < file < ephemeral).
   * Encrypted values are masked — this is a display surface, mirroring
   * `forge variables list`.
   */
  list(): VariableListEntry[] {
    const merged = new Map<string, VariableListEntry>();
    for (const [key, value] of hostUserVars()) {
      merged.set(key, { key, value, encrypt: false, source: 'host' });
    }
    for (const [key, v] of this.fileVars) {
      merged.set(key, { key, value: v.value, encrypt: v.encrypt, source: 'file' });
    }
    for (const [key, v] of this.ephemeral) {
      merged.set(key, { key, value: v.value, encrypt: v.encrypt, source: 'ephemeral' });
    }
    return [...merged.values()]
      .map((e) => (e.encrypt ? { ...e, value: MASK } : e))
      .sort((a, b) => a.key.localeCompare(b.key));
  }

  // ── Deploy-time injection ────────────────────────────────────────────

  /**
   * Inject variables into process.env. Called by the deployer at every
   * deploy, before handler modules are loaded. Re-reads variables.json
   * so file edits take effect on redeploy — exactly Forge's semantics.
   */
  async inject(appDir: string): Promise<void> {
    // Undo the previous injection first so keys removed from the file (or
    // a different appDir's vars) don't linger.
    this.restoreEnv();

    this.fileVars = await loadVariablesFile(appDir, this.log);

    const effective = new Map<string, string>();
    for (const [key, value] of hostUserVars()) effective.set(key, value);
    for (const [key, v] of this.fileVars) effective.set(key, v.value);
    for (const [key, v] of this.ephemeral) effective.set(key, v.value);

    for (const [key, value] of effective) {
      this.snapshot.set(key, process.env[key]);
      // Cleartext even for encrypt:true — real Forge decrypts before the
      // app sees it; encryption is at-rest + list-masking only.
      process.env[key] = value;
    }

    this.injected = true;
    if (effective.size > 0) {
      this.log('info', `[forge-sim] Injected ${effective.size} environment variable(s) into process.env`, {
        keys: [...effective.keys()],
      });
    }
  }

  /** Restore process.env to its pre-injection state. */
  private restoreEnv(): void {
    for (const [key, prior] of this.snapshot) {
      if (prior === undefined) delete process.env[key];
      else process.env[key] = prior;
    }
    this.snapshot.clear();
  }

  /**
   * Reset hook. Restores process.env; file vars are dropped (re-read at
   * next deploy); EPHEMERAL VARS SURVIVE — real Forge variables are
   * environment-scoped, not deployment-scoped, and MCP `forge_deploy`
   * defaults to reset:true which would otherwise clobber pre-deploy
   * `forge_variables_set` calls.
   */
  reset(): void {
    this.restoreEnv();
    this.fileVars.clear();
    this.injected = false;
  }

  /** Full teardown for tests — also drops ephemeral vars. */
  clearAll(): void {
    this.reset();
    this.ephemeral.clear();
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

function normalizeVariable(key: string, input: VariableInput): ForgeVariable {
  if (typeof input === 'string') return { value: input, encrypt: false };
  if (input !== null && typeof input === 'object' && 'value' in input) {
    if (typeof input.value !== 'string') {
      // process.env is string-only; coerce primitives the way Node would.
      return { value: String(input.value), encrypt: input.encrypt === true };
    }
    return { value: input.value, encrypt: input.encrypt === true };
  }
  throw new Error(
    `[forge-sim] Invalid variable "${key}" — expected a string or { value, encrypt? }, got ${JSON.stringify(input)}`
  );
}

/** Host env vars prefixed FORGE_USER_VAR_ → stripped key (forge tunnel parity). */
function hostUserVars(): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(FORGE_USER_VAR_PREFIX) && value !== undefined) {
      const stripped = key.slice(FORGE_USER_VAR_PREFIX.length);
      if (stripped.length > 0) out.set(stripped, value);
    }
  }
  return out;
}

async function loadVariablesFile(appDir: string, log: Logger): Promise<Map<string, ForgeVariable>> {
  const filePath = join(appDir, '.forge-sim', VARIABLES_FILE);
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch {
    return new Map(); // No file — perfectly normal.
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    log('warn', `[forge-sim] ⚠️ ${filePath} is not valid JSON — ignoring it`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return new Map();
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    log('warn', `[forge-sim] ⚠️ ${filePath} must be a JSON object of { KEY: value } — ignoring it`);
    return new Map();
  }

  const out = new Map<string, ForgeVariable>();
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    try {
      if (typeof value === 'number' || typeof value === 'boolean') {
        out.set(key, { value: String(value), encrypt: false });
      } else {
        out.set(key, normalizeVariable(key, value as VariableInput));
      }
    } catch (err) {
      log('warn', `[forge-sim] ⚠️ Skipping invalid variable "${key}" in ${VARIABLES_FILE}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return out;
}
