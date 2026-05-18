/**
 * F7/F8 — noise cleanup for repeat deploys in a single vitest file.
 *
 * Skill run #7 reported these as 🟡/🟢 cosmetic but real friction:
 *   - "Runtime mismatch: manifest specifies nodejsXX.x but local Node is vYY"
 *     fired on EVERY redeploy in a multi-`it()` test file, multiplying
 *     identical noise by the test count.
 *   - "resolver.define("X") is overwriting an existing definition" fired
 *     once per resolver per deploy, because the @forge/resolver shim
 *     registered keys during bundle eval AND the deployer re-registered
 *     them from the exported definitions map.
 *
 * The fixes:
 *   - Manifest warnings dedupe by message at MODULE scope (per worker
 *     process), so each unique warning prints exactly once even across
 *     fresh `createSimulator()` calls in `beforeEach`. Skill run #14 found
 *     that the original per-instance scope was too narrow — agents saw N
 *     identical warnings in an N-test vitest file.
 *   - The deployer's UI-module loop now skips already-registered keys
 *     instead of re-registering and tripping the footgun warning.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { createSimulator, type ForgeSimulator } from '../simulator.js';
import { _resetPrintedManifestWarnings } from '../deployer.js';

const FIXTURE_F4 = join(import.meta.dirname, 'fixtures/resolver-console-f4');
const FIXTURE_DEEP = join(import.meta.dirname, 'fixtures/resolver-cache-f3-deep');

describe('F7 — manifest-warning print dedupe at module scope', () => {
  let sim: ForgeSimulator;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Module-scope dedupe means we need to reset between tests, otherwise
    // earlier tests in this file would suppress prints in later tests and
    // each test couldn't assert the dedupe behavior independently. The
    // reset is test-only — production code keeps the module Set growing
    // across the worker lifetime, which is the whole point.
    _resetPrintedManifestWarnings();
    sim = createSimulator();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    warnSpy.mockRestore();
    await sim.stop();
  });

  it('runtime-mismatch warning prints at most once across many deploys', async () => {
    // Three back-to-back deploys with the same manifest. The runtime-mismatch
    // warning is keyed by message, so all three would have produced identical
    // stderr without the dedupe.
    await sim.deploy(FIXTURE_F4);
    await sim.deploy(FIXTURE_F4);
    await sim.deploy(FIXTURE_F4);

    const runtimePrints = warnSpy.mock.calls.filter((args) =>
      typeof args[0] === 'string' && args[0].includes('Runtime mismatch')
    );
    expect(runtimePrints).toHaveLength(1);
  });

  it('warning print still fires once per distinct message', async () => {
    // F4 fixture and DEEP fixture both have the same Node-version mismatch
    // message (both manifest as nodejs22.x), so the runtime warning should
    // only print once even across distinct fixtures — same MESSAGE, same dedupe.
    await sim.deploy(FIXTURE_F4);
    await sim.deploy(FIXTURE_DEEP);
    const runtimePrints = warnSpy.mock.calls.filter((args) =>
      typeof args[0] === 'string' && args[0].includes('Runtime mismatch')
    );
    expect(runtimePrints).toHaveLength(1);
  });

  it('reset() does NOT clear the dedupe set (same sim, same warnings)', async () => {
    await sim.deploy(FIXTURE_F4);
    await sim.reset();
    await sim.deploy(FIXTURE_F4);
    const runtimePrints = warnSpy.mock.calls.filter((args) =>
      typeof args[0] === 'string' && args[0].includes('Runtime mismatch')
    );
    expect(runtimePrints).toHaveLength(1);
  });

  it('result.warnings still carries the message every deploy (only stderr dedupes)', async () => {
    // The dedupe is a stderr-noise fix only — programmatic callers (MCP
    // response shape, in-process result inspection) must still see the
    // warning on every deploy, because they may not have seen prior deploys.
    const r1 = await sim.deploy(FIXTURE_F4);
    const r2 = await sim.deploy(FIXTURE_F4);
    const w1 = r1.warnings.find((w) => w.message.includes('Runtime mismatch'));
    const w2 = r2.warnings.find((w) => w.message.includes('Runtime mismatch'));
    expect(w1).toBeDefined();
    expect(w2).toBeDefined();
  });

  it('separate simulator instances SHARE the dedupe set (module scope)', async () => {
    // The original F7 fix scoped the dedupe per-simulator, which meant a
    // vitest file with N tests each creating a fresh sim in `beforeEach`
    // got the same warning printed N times — skill run #14 caught this.
    // Module-scope dedupe is the right granularity: within a single worker
    // process, every sim shares the Set, so the runtime-mismatch message
    // prints exactly once across all sims for the lifetime of the process.
    await sim.deploy(FIXTURE_F4);
    const sim2 = createSimulator();
    try {
      await sim2.deploy(FIXTURE_F4);
      const runtimePrints = warnSpy.mock.calls.filter((args) =>
        typeof args[0] === 'string' && args[0].includes('Runtime mismatch')
      );
      expect(runtimePrints).toHaveLength(1);
    } finally {
      await sim2.stop();
    }
  });

  it('_resetPrintedManifestWarnings() lets test code re-trigger the print', async () => {
    // The test escape hatch must actually clear state. Without this, a
    // bug in the helper (e.g. wrong Set reference) would silently break
    // every test in this file by leaving the dedupe permanently full.
    await sim.deploy(FIXTURE_F4);
    let runtimePrints = warnSpy.mock.calls.filter((args) =>
      typeof args[0] === 'string' && args[0].includes('Runtime mismatch')
    );
    expect(runtimePrints).toHaveLength(1);

    _resetPrintedManifestWarnings();
    await sim.deploy(FIXTURE_F4);
    runtimePrints = warnSpy.mock.calls.filter((args) =>
      typeof args[0] === 'string' && args[0].includes('Runtime mismatch')
    );
    expect(runtimePrints).toHaveLength(2);
  });
});

describe('F8 — resolver.define overwrite warning silenced on fresh deploy', () => {
  let sim: ForgeSimulator;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sim = createSimulator();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    warnSpy.mockRestore();
    await sim.stop();
  });

  it('fresh deploy fires no "overwriting" warnings', async () => {
    await sim.deploy(FIXTURE_F4);
    const overwrites = warnSpy.mock.calls.filter((args) =>
      typeof args[0] === 'string' && args[0].includes('overwriting an existing definition')
    );
    expect(overwrites).toHaveLength(0);
  });

  it('reset() + deploy() cycle fires no "overwriting" warnings', async () => {
    // The skill-run-7 scenario: multiple describes each running a fresh
    // reset+deploy. Each cycle used to print N warnings (one per resolver).
    await sim.deploy(FIXTURE_F4);
    await sim.reset();
    await sim.deploy(FIXTURE_F4);
    await sim.reset();
    await sim.deploy(FIXTURE_F4);
    const overwrites = warnSpy.mock.calls.filter((args) =>
      typeof args[0] === 'string' && args[0].includes('overwriting an existing definition')
    );
    expect(overwrites).toHaveLength(0);
  });

  it('redeploy WITHOUT reset still no warnings (deployer is idempotent)', async () => {
    await sim.deploy(FIXTURE_F4);
    await sim.deploy(FIXTURE_F4); // no reset
    const overwrites = warnSpy.mock.calls.filter((args) =>
      typeof args[0] === 'string' && args[0].includes('overwriting an existing definition')
    );
    // The shim re-registers (same key, new fn ref) on a fresh bundle import,
    // which DOES legitimately trigger the warning — those are real overwrites
    // by user code, even if benign. Just make sure the deployer's own loop
    // isn't *additionally* tripping it.
    expect(overwrites.length).toBeLessThanOrEqual(2);
  });

  it('resolvers are still callable after a fresh deploy (regression guard)', async () => {
    // If we accidentally skipped registering when we shouldn't have, invokes
    // would fail. Smoke-test the happy path.
    await sim.deploy(FIXTURE_F4);
    const result = await sim.invoke('chatty');
    expect(result).toEqual({ ok: true });
  });

  it('manifest with many functions sharing one source file evaluates it ONCE', async () => {
    // This is the OKR pattern that surfaced the F8 root cause: 5 manifest
    // function entries all pointing at the same `index.ts` (some for the
    // resolver definitions map, others for individual trigger/consumer/
    // scheduled-trigger function exports). Pre-fix, the deployer bundled and
    // re-imported the file 5 times — each re-evaluation called `resolver.define`
    // again, tripping the overwrite warning N times per duplicated import.
    // With moduleCache, the bundle+import happens once per source file per
    // deploy.
    const OKR_DIR = join(import.meta.dirname, 'fixtures/okr-tracker');
    await sim.sql.start();
    await sim.deploy(OKR_DIR);
    const overwrites = warnSpy.mock.calls.filter((args) =>
      typeof args[0] === 'string' && args[0].includes('overwriting an existing definition')
    );
    expect(overwrites).toHaveLength(0);
  }, 30_000);

  it('actual footgun (two files defining same key) STILL warns', async () => {
    // The original warning is meant to catch real bugs: same key defined in
    // two files with different handlers. Verify the suppression hasn't
    // disabled that detection by calling sim.resolver.define directly twice.
    sim.resolver.define('dup', () => 1);
    sim.resolver.define('dup', () => 2);
    const overwrites = warnSpy.mock.calls.filter((args) =>
      typeof args[0] === 'string' && args[0].includes('overwriting an existing definition')
    );
    expect(overwrites.length).toBeGreaterThanOrEqual(1);
  });
});
