/**
 * Environment variables — RT-033/034/035.
 *
 * Real Forge semantics being verified:
 *   - Variables are exposed as plain process.env.KEY.
 *   - Changes take effect ONLY at redeploy (Forge's documented footgun).
 *   - Encrypted vars are masked in list surfaces but the app reads CLEARTEXT.
 *   - `forge tunnel` forwards host FORGE_USER_VAR_MY_KEY as MY_KEY.
 *
 * Sim-specific semantics:
 *   - .forge-sim/variables.json re-read at every deploy (dev-mode file source)
 *   - sim.setVariables() is ephemeral (never persisted) and SURVIVES reset
 *   - process.env is snapshotted at inject and restored on reset/redeploy
 *   - precedence: host FORGE_USER_VAR_ < variables.json < setVariables
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSimulator, ForgeSimulator } from '../simulator.js';
import { VariablesManager } from '../variables.js';

// Unique key prefix so parallel test files can't collide on process.env.
const K = (name: string) => `FS_VARS_TEST_${name}`;

const MANIFEST = `app:
  id: ari:cloud:ecosystem::app/env-vars-test
  name: Env Vars Test
  runtime:
    name: nodejs22.x

modules:
  function:
    - key: read-env
      handler: index.handler
`;

// Top-level capture proves injection happens BEFORE module evaluation.
const HANDLER = `import Resolver from '@forge/resolver';
const atModuleLoad = process.env.${K('MY_KEY')};
const resolver = new Resolver();
resolver.define('readEnv', () => ({
  atModuleLoad,
  atInvoke: process.env.${K('MY_KEY')},
  secret: process.env.${K('SECRET')},
}));
export const handler = resolver.getDefinitions();
`;

async function makeApp(vars?: Record<string, unknown> | string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'forge-sim-vars-'));
  await mkdir(join(dir, 'src'), { recursive: true });
  await writeFile(join(dir, 'manifest.yml'), MANIFEST);
  await writeFile(join(dir, 'src', 'index.js'), HANDLER);
  if (vars !== undefined) await writeVars(dir, vars);
  return dir;
}

async function writeVars(dir: string, vars: Record<string, unknown> | string): Promise<void> {
  await mkdir(join(dir, '.forge-sim'), { recursive: true });
  const content = typeof vars === 'string' ? vars : JSON.stringify(vars);
  await writeFile(join(dir, '.forge-sim', 'variables.json'), content);
}

describe('environment variables', () => {
  let sim: ForgeSimulator;
  const tempDirs: string[] = [];
  const envKeys = [K('MY_KEY'), K('SECRET'), K('PRIOR'), `FORGE_USER_VAR_${K('MY_KEY')}`];

  const app = async (vars?: Record<string, unknown> | string) => {
    const dir = await makeApp(vars);
    tempDirs.push(dir);
    return dir;
  };

  beforeEach(() => {
    sim = createSimulator();
  });

  afterEach(async () => {
    // Restore whatever the sim injected, then hard-scrub our test keys.
    sim.variables.clearAll();
    for (const key of envKeys) delete process.env[key];
    await Promise.all(tempDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
  });

  // ── VariablesManager unit ─────────────────────────────────────────────

  describe('VariablesManager', () => {
    it('lists variables sorted, with source tags and encrypted masking', () => {
      const mgr = new VariablesManager();
      mgr.setVariables({
        [K('B')]: 'plain',
        [K('A')]: { value: 's3cret', encrypt: true },
      });
      const entries = mgr.list();
      expect(entries).toEqual([
        { key: K('A'), value: '••••••••', encrypt: true, source: 'ephemeral' },
        { key: K('B'), value: 'plain', encrypt: false, source: 'ephemeral' },
      ]);
    });

    it('unsetVariable reports whether the key existed', () => {
      const mgr = new VariablesManager();
      mgr.setVariables({ [K('A')]: 'x' });
      expect(mgr.unsetVariable(K('A'))).toBe(true);
      expect(mgr.unsetVariable(K('A'))).toBe(false);
      expect(mgr.list()).toEqual([]);
    });

    it('rejects values that are neither string nor { value }', () => {
      const mgr = new VariablesManager();
      expect(() => mgr.setVariables({ [K('BAD')]: { nope: true } as any })).toThrow(/Invalid variable/);
    });
  });

  // ── Deploy-time injection ─────────────────────────────────────────────

  it('injects variables.json into process.env BEFORE handler module evaluation', async () => {
    const dir = await app({ [K('MY_KEY')]: 'from-file' });
    await sim.deploy(dir);

    expect(process.env[K('MY_KEY')]).toBe('from-file');
    const result = await sim.invoke('readEnv', {});
    // Top-level capture — proves injection preceded module load.
    expect(result).toMatchObject({ atModuleLoad: 'from-file', atInvoke: 'from-file' });
  });

  it('setVariables() before deploy is injected and beats variables.json (precedence)', async () => {
    const dir = await app({ [K('MY_KEY')]: 'from-file' });
    sim.setVariables({ [K('MY_KEY')]: 'from-ephemeral' });
    await sim.deploy(dir);

    expect(process.env[K('MY_KEY')]).toBe('from-ephemeral');
  });

  it('honors host FORGE_USER_VAR_ prefix (tunnel parity), overridden by variables.json', async () => {
    process.env[`FORGE_USER_VAR_${K('MY_KEY')}`] = 'from-host';
    const dir = await app();
    await sim.deploy(dir);
    expect(process.env[K('MY_KEY')]).toBe('from-host');

    // File beats host.
    const dir2 = await app({ [K('MY_KEY')]: 'from-file' });
    await sim.deploy(dir2);
    expect(process.env[K('MY_KEY')]).toBe('from-file');
  });

  it('re-reads variables.json at redeploy; removed keys are restored', async () => {
    process.env[K('PRIOR')] = 'pre-existing';
    const dir = await app({ [K('MY_KEY')]: 'v1', [K('PRIOR')]: 'overridden' });
    await sim.deploy(dir);
    expect(process.env[K('MY_KEY')]).toBe('v1');
    expect(process.env[K('PRIOR')]).toBe('overridden');

    // Edit the file: change one key, drop the other → redeploy.
    await writeVars(dir, { [K('MY_KEY')]: 'v2' });
    await sim.deploy(dir);
    expect(process.env[K('MY_KEY')]).toBe('v2');
    // Dropped key restored to its pre-injection value.
    expect(process.env[K('PRIOR')]).toBe('pre-existing');
  });

  it('setVariables() after deploy is redeploy-gated, exactly like real Forge', async () => {
    const dir = await app({ [K('MY_KEY')]: 'v1' });
    await sim.deploy(dir);

    sim.setVariables({ [K('MY_KEY')]: 'v2' });
    // Not yet — Forge's documented footgun.
    expect(process.env[K('MY_KEY')]).toBe('v1');
    const warning = sim.getLogs().find((l) => l.level === 'warn' && /redeploy/.test(l.message));
    expect(warning).toBeDefined();

    await sim.deploy(dir);
    expect(process.env[K('MY_KEY')]).toBe('v2');
  });

  it('reset() restores process.env (pre-existing values back, absent keys deleted)', async () => {
    process.env[K('PRIOR')] = 'pre-existing';
    const dir = await app({ [K('MY_KEY')]: 'v1', [K('PRIOR')]: 'overridden' });
    await sim.deploy(dir);

    await sim.reset();
    expect(process.env[K('MY_KEY')]).toBeUndefined();
    expect(process.env[K('PRIOR')]).toBe('pre-existing');
  });

  it('ephemeral variables SURVIVE reset (environment-scoped, like real Forge)', async () => {
    sim.setVariables({ [K('MY_KEY')]: 'sticky' });
    await sim.reset();

    const dir = await app();
    await sim.deploy(dir);
    expect(process.env[K('MY_KEY')]).toBe('sticky');
    expect(sim.listVariables()).toEqual([
      { key: K('MY_KEY'), value: 'sticky', encrypt: false, source: 'ephemeral' },
    ]);
  });

  it('encrypt:true masks in list but the app reads CLEARTEXT (real Forge behavior)', async () => {
    const dir = await app({ [K('SECRET')]: { value: 'hunter2', encrypt: true } });
    await sim.deploy(dir);

    const result = (await sim.invoke('readEnv', {})) as any;
    expect(result.secret).toBe('hunter2'); // cleartext in the app
    const entry = sim.listVariables().find((e) => e.key === K('SECRET'));
    expect(entry).toEqual({ key: K('SECRET'), value: '••••••••', encrypt: true, source: 'file' });
  });

  it('coerces number/boolean JSON values to strings (process.env is string-only)', async () => {
    const dir = await app({ [K('MY_KEY')]: 42 });
    await sim.deploy(dir);
    expect(process.env[K('MY_KEY')]).toBe('42');
  });

  it('invalid variables.json warns but does not fail the deploy', async () => {
    const dir = await app('{ not json !!!');
    const result = await sim.deploy(dir);

    expect(result.errors).toEqual([]);
    expect(result.loadedFunctions).toContain('read-env');
    expect(process.env[K('MY_KEY')]).toBeUndefined();
    const warning = sim.getLogs().find((l) => l.level === 'warn' && /not valid JSON/.test(l.message));
    expect(warning).toBeDefined();
  });
});
