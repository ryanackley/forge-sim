/**
 * F3 — Resolver bundle cache busts entry point but NOT transitive imports.
 *
 * Repro: a resolver entry-point that imports a handler from a sub-file.
 * The deployer cache-busts the entry with `?t=Date.now()` so Node treats
 * each redeploy as a new module — but the entry's own `import` of the
 * sub-file resolves to a URL with no query string, so Node serves the
 * cached version. The new handler source never runs.
 *
 * Skill run #6 hit this when modifying a `throw new Error(...)` inside
 * a transitive handler file. After fixing, `forge_reset()` followed by
 * `forge_deploy()` must surface the new code. This test pins that.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { writeFile, readFile } from 'node:fs/promises';
import { createSimulator, type ForgeSimulator } from '../simulator.js';

const FIXTURE = join(import.meta.dirname, 'fixtures/resolver-cache-f3');
const GREET_FILE = join(FIXTURE, 'src/handlers/greet.js');

const DEEP_FIXTURE = join(import.meta.dirname, 'fixtures/resolver-cache-f3-deep');
const FORMAT_FILE = join(DEEP_FIXTURE, 'src/handlers/util/format.ts');
const PING_FILE = join(DEEP_FIXTURE, 'src/handlers/ping.ts');

const V1 = `// Transitive resolver handler — the test rewrites this file mid-flight
// to verify that forge_reset() + forge_deploy() picks up the new code.
export function greet(req) {
  return { message: 'hello v1' };
}
`;

const V2 = `// Transitive resolver handler — the test rewrites this file mid-flight
// to verify that forge_reset() + forge_deploy() picks up the new code.
export function greet(req) {
  return { message: 'hello v2', edited: true };
}
`;

describe('F3 — resolver bundle cache (transitive imports)', () => {
  let sim: ForgeSimulator;
  let originalSource: string;

  beforeAll(async () => {
    sim = createSimulator();
    originalSource = await readFile(GREET_FILE, 'utf-8');
  });

  afterAll(async () => {
    // Always restore the fixture to v1 so subsequent runs start clean.
    await writeFile(GREET_FILE, originalSource, 'utf-8');
    await sim.stop();
  });

  it('returns the edited handler text after reset + redeploy', async () => {
    // Start clean.
    await writeFile(GREET_FILE, V1, 'utf-8');

    await sim.deploy(FIXTURE);
    const v1Result = await sim.resolver.invoke('greet');
    expect(v1Result).toEqual({ message: 'hello v1' });

    // Edit the transitive handler source.
    await writeFile(GREET_FILE, V2, 'utf-8');

    // Reset and redeploy — the agent's exact MCP move when iterating.
    await sim.reset();
    await sim.deploy(FIXTURE);
    const v2Result = await sim.resolver.invoke('greet');

    // Without the F3 fix, v2Result === { message: 'hello v1' } because
    // greet.js was served from Node's module cache during the redeploy.
    expect(v2Result).toEqual({ message: 'hello v2', edited: true });
  });

  it('redeploy without reset also picks up edits (forge_deploy alone)', async () => {
    // The agent might not always call reset() between iterations. A bare
    // forge_deploy() must also surface fresh handler source.
    await writeFile(GREET_FILE, V1, 'utf-8');
    await sim.deploy(FIXTURE);
    expect(await sim.resolver.invoke('greet')).toEqual({ message: 'hello v1' });

    await writeFile(GREET_FILE, V2, 'utf-8');
    // No reset() this time — just redeploy.
    await sim.deploy(FIXTURE);
    expect(await sim.resolver.invoke('greet')).toEqual({ message: 'hello v2', edited: true });
  });

  it('survives three back-to-back edit/deploy cycles', async () => {
    // Real iterate loops are more than two cycles. Make sure caching state
    // doesn't drift after several rounds.
    const variants = [
      { src: V1, expected: { message: 'hello v1' } },
      { src: V2, expected: { message: 'hello v2', edited: true } },
      {
        src: V1.replace('hello v1', 'hello v3'),
        expected: { message: 'hello v3' },
      },
      { src: V2, expected: { message: 'hello v2', edited: true } },
    ];
    for (const v of variants) {
      await writeFile(GREET_FILE, v.src, 'utf-8');
      await sim.reset();
      await sim.deploy(FIXTURE);
      expect(await sim.resolver.invoke('greet')).toEqual(v.expected);
    }
  });
});

describe('F3 — resolver bundle cache (deep transitive + TypeScript)', () => {
  let sim: ForgeSimulator;
  let originalPing: string;
  let originalFormat: string;

  beforeAll(async () => {
    sim = createSimulator();
    originalPing = await readFile(PING_FILE, 'utf-8');
    originalFormat = await readFile(FORMAT_FILE, 'utf-8');
  });

  afterAll(async () => {
    await writeFile(PING_FILE, originalPing, 'utf-8');
    await writeFile(FORMAT_FILE, originalFormat, 'utf-8');
    await sim.stop();
  });

  it('picks up edits to a depth-3 .ts helper through a .ts entry', async () => {
    // Reset to v1 source on disk.
    await writeFile(PING_FILE, originalPing, 'utf-8');
    await writeFile(FORMAT_FILE, originalFormat, 'utf-8');

    await sim.deploy(DEEP_FIXTURE);
    expect(await sim.resolver.invoke('ping')).toEqual({ message: '[v1] hello' });

    // Edit the deepest file only — esbuild must follow it through index.ts
    // → handlers/ping.ts → handlers/util/format.ts and surface the change.
    await writeFile(
      FORMAT_FILE,
      'export function format(s: string): string {\n  return `[v2-deep] ${s}`;\n}\n',
      'utf-8'
    );
    await sim.reset();
    await sim.deploy(DEEP_FIXTURE);
    expect(await sim.resolver.invoke('ping')).toEqual({ message: '[v2-deep] hello' });

    // Now edit the middle file (ping.ts) too — verifies edits at multiple
    // depths in the same cycle are all picked up.
    await writeFile(
      PING_FILE,
      "import { format } from './util/format.js';\n\nexport function ping() {\n  return { message: format('GOODBYE'), edited: true };\n}\n",
      'utf-8'
    );
    await sim.reset();
    await sim.deploy(DEEP_FIXTURE);
    expect(await sim.resolver.invoke('ping')).toEqual({
      message: '[v2-deep] GOODBYE',
      edited: true,
    });
  });
});
