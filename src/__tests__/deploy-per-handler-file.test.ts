/**
 * The backend is built the way `forge deploy` builds it: one output per
 * handler file, each with its own copy of every shared module
 * (@forge/bundler out/common.js getEntryPoints + no splitChunks), and the
 * Forge runtime wrapper loads one of those files per invocation. So:
 *
 *   - module state is per handler file: two functions in one file share it,
 *     two files never do
 *   - a throw while evaluating one file fails only that file's functions
 *   - a build error (syntax error, top-level await in CommonJS output)
 *     deploys nothing, is reported per function in `errors[]` naming the
 *     failing file, and honours throwOnError / DeployError
 *   - a surface that asks for `reset: true` is reset only after the build
 *     succeeded, so a failed redeploy leaves the previous version running
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSimulator, type ForgeSimulator } from '../simulator.js';
import { DeployError } from '../deployer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// A manifest needs at least one real module; a web trigger on its own file
// provides it, and every other function stays reachable through sim.invoke().
const manifest = (fns: Record<string, string>) => `
modules:
  function:
    - key: fn-hook
      handler: hook.hook
${Object.entries(fns).map(([k, h]) => `    - key: ${k}\n      handler: ${h}`).join('\n')}
  webtrigger:
    - key: hook
      function: fn-hook
app:
  id: ari:cloud:ecosystem::app/per-handler-file-test
  runtime:
    name: nodejs22.x
permissions:
  scopes: []
`;

const SHARED = `export const state = { n: 0 };\n`;
const A = `
import { state } from './shared';
export const bump = () => ++state.n;
export const readA = () => state.n;
`;
const B = `
import { state } from './shared';
export const readB = () => state.n;
`;
const BAD = `
export const never = () => 'unreachable';
throw new Error('boom while evaluating bad.js');
`;
const BROKEN = `export const x = () => { this is not javascript\n`;
const TLA = `
const v = await Promise.resolve(42);
export const tla = () => v;
`;

let dir: string;
let sim: ForgeSimulator;

async function writeApp(files: Record<string, string>, fns: Record<string, string>) {
  await mkdir(join(dir, 'src'), { recursive: true });
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'per-handler-file-test', type: 'module' }));
  await writeFile(join(dir, 'manifest.yml'), manifest(fns));
  for (const [name, text] of Object.entries(files)) await writeFile(join(dir, 'src', name), text);
}

const HOOK = `export const hook = async () => ({ statusCode: 200 });\n`;
const GOOD_FILES = { 'shared.js': SHARED, 'a.js': A, 'b.js': B, 'hook.js': HOOK };
const GOOD_FNS = { 'fn-bump': 'a.bump', 'fn-read-a': 'a.readA', 'fn-read-b': 'b.readB' };

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'forge-sim-per-file-'));
  sim = createSimulator();
});

afterEach(async () => {
  await sim.stop();
  await rm(dir, { recursive: true, force: true });
});

describe('one output per handler file', () => {
  it('module state is per file: a.js bumps, a.js sees it, b.js never does', async () => {
    await writeApp(GOOD_FILES, GOOD_FNS);
    await sim.deploy(dir, { fireScheduledTriggers: false });
    expect(await sim.invoke('fn-bump')).toBe(1);
    expect(await sim.invoke('fn-bump')).toBe(2);
    expect(await sim.invoke('fn-read-a')).toBe(2);
    expect(await sim.invoke('fn-read-b')).toBe(0);
  });

  it('a throw while evaluating one file fails only that file\'s functions', async () => {
    await writeApp({ ...GOOD_FILES, 'bad.js': BAD }, { ...GOOD_FNS, 'fn-bad': 'bad.never' });
    const result = await sim.deploy(dir, { fireScheduledTriggers: false, throwOnError: false });
    expect(result.errors).toEqual([
      { functionKey: 'fn-bad', error: expect.stringContaining('boom while evaluating bad.js') },
    ]);
    expect(result.loadedFunctions.sort()).toEqual(['fn-bump', 'fn-hook', 'fn-read-a', 'fn-read-b']);
    expect(await sim.invoke('fn-bump')).toBe(1);
  });
});

describe('a build error deploys nothing', () => {
  it.each([
    ['a syntax error', 'broken.js', BROKEN, 'broken.x', /Expected|Unexpected|Syntax/i],
    ['a top-level await', 'tla.js', TLA, 'tla.tla', /Top-level await/],
  ])('%s: errors[] names the failing file per function, nothing loads, DeployError by default', async (_label, file, text, handler, pattern) => {
    await writeApp({ ...GOOD_FILES, [file]: text }, { ...GOOD_FNS, 'fn-x': handler });

    const result = await sim.deploy(dir, { fireScheduledTriggers: false, throwOnError: false });
    expect(result.loadedFunctions).toEqual([]);
    expect(result.errors.map((e) => e.functionKey).sort()).toEqual(['fn-bump', 'fn-hook', 'fn-read-a', 'fn-read-b', 'fn-x']);
    const own = result.errors.find((e) => e.functionKey === 'fn-x')!;
    expect(own.error).toContain(`Build failed in src/${file}`);
    expect(own.error).toMatch(pattern);
    const other = result.errors.find((e) => e.functionKey === 'fn-bump')!;
    expect(other.error).toContain(`Not loaded: the build failed in src/${file}`);
    expect(other.error).toContain('forge deploy uploads nothing when the bundle fails');
    await expect(sim.invoke('fn-bump')).rejects.toThrow(/No resolver defined/);

    // The default contract: a typed DeployError carrying the same result.
    await expect(sim.deploy(dir, { fireScheduledTriggers: false })).rejects.toSatisfy((err: unknown) =>
      err instanceof DeployError && err.result.errors.some((e) => e.functionKey === 'fn-x'));
  });

  it('with reset: true, the reset waits for a successful build, so a failed redeploy keeps the previous version', async () => {
    await writeApp(GOOD_FILES, GOOD_FNS);
    const afterReset = vi.fn();
    await sim.deploy(dir, { fireScheduledTriggers: false, reset: true, afterReset });
    expect(afterReset).toHaveBeenCalledTimes(1);
    expect(await sim.invoke('fn-bump')).toBe(1);
    await sim.kvs.set('kept', 'yes');

    // Break the app and redeploy the way MCP and the daemon do.
    await writeFile(join(dir, 'src', 'a.js'), BROKEN);
    const failed = await sim.deploy(dir, { fireScheduledTriggers: false, throwOnError: false, reset: true, afterReset });
    expect(failed.errors.length).toBeGreaterThan(0);
    expect(afterReset).toHaveBeenCalledTimes(1); // no reset happened
    expect(await sim.invoke('fn-bump')).toBe(2); // the previous version, with its state
    expect(await sim.kvs.get('kept')).toBe('yes');

    // Fix it: now the reset runs and the new version replaces the old.
    await writeFile(join(dir, 'src', 'a.js'), A);
    await sim.deploy(dir, { fireScheduledTriggers: false, reset: true, afterReset });
    expect(afterReset).toHaveBeenCalledTimes(2);
    expect(await sim.kvs.get('kept')).toBeUndefined();
    expect(await sim.invoke('fn-bump')).toBe(1);
  });

  it('MCP forge_deploy and the daemon reset through deploy(), not before it', async () => {
    const mcp = await readFile(join(__dirname, '..', 'mcp-server.ts'), 'utf8');
    expect(mcp).toContain('reset: reset !== false');
    expect(mcp).not.toMatch(/if \(reset !== false\) \{\s*await sim\.reset\(\);/);
    const daemon = await readFile(join(__dirname, '..', 'tools', 'api.ts'), 'utf8');
    expect(daemon).toContain('afterReset: () => { mockFile = reapplyMockFile(); }');
  });
});
