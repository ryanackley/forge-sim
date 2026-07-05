/**
 * Stale-daemon self-check unit tests.
 *
 * The integration glue (statSync, monkey-patched server.tool, response
 * threading) lives in mcp-server.ts; this file pins the pure decision
 * logic so the threshold and message format don't drift.
 */
import { describe, it, expect } from 'vitest';
import { isStale, buildStalenessWarning, STALENESS_GRACE_MS, shouldRunStalenessCheck, shouldWarnNow } from '../staleness.js';

describe('isStale', () => {
  it('returns false when current mtime equals loaded mtime', () => {
    expect(isStale(1_000_000, 1_000_000)).toBe(false);
  });

  it('returns false when current mtime is within the grace period', () => {
    // Same wall-second build noise must not be flagged.
    expect(isStale(1_000_000, 1_000_000 + 100)).toBe(false);
    expect(isStale(1_000_000, 1_000_000 + STALENESS_GRACE_MS)).toBe(false);
  });

  it('returns true when current mtime exceeds loaded mtime + grace', () => {
    expect(isStale(1_000_000, 1_000_000 + STALENESS_GRACE_MS + 1)).toBe(true);
    expect(isStale(1_000_000, 2_000_000)).toBe(true);
  });

  it('returns false when current mtime is OLDER than loaded (clock skew / restored backup)', () => {
    // Should never fire on a regression in the other direction.
    expect(isStale(2_000_000, 1_000_000)).toBe(false);
  });

  it('returns false when loadedMtimeMs is null (daemon couldn\'t stat itself)', () => {
    // Defensive default: don't spam warnings we can't ground in fact.
    expect(isStale(null, 1_000_000)).toBe(false);
  });

  it('honors a custom grace period', () => {
    expect(isStale(1_000_000, 1_000_500, 1000)).toBe(false);
    expect(isStale(1_000_000, 1_002_000, 1000)).toBe(true);
  });

  it('default grace is exposed and matches what mcp-server uses', () => {
    expect(STALENESS_GRACE_MS).toBe(2000);
  });
});

describe('buildStalenessWarning', () => {
  const PID = 12345;
  const LOADED = Date.parse('2026-05-15T17:00:00Z');
  const REBUILT = Date.parse('2026-05-15T17:05:30Z');

  it('includes the PID with a clear kill instruction', () => {
    const msg = buildStalenessWarning(PID, LOADED, REBUILT);
    expect(msg).toContain('pid=12345');
    expect(msg).toContain('kill 12345');
  });

  it('shows both timestamps so the operator can confirm the gap', () => {
    const msg = buildStalenessWarning(PID, LOADED, REBUILT);
    expect(msg).toContain('2026-05-15T17:00:00');
    expect(msg).toContain('2026-05-15T17:05:30');
  });

  it('leads with the STALE marker so it\'s impossible to miss', () => {
    const msg = buildStalenessWarning(PID, LOADED, REBUILT);
    // First non-whitespace chunk should be the warning emoji + word.
    expect(msg.trimStart().startsWith('⚠️')).toBe(true);
    expect(msg).toContain('STALE forge-sim MCP daemon');
  });

  it('mentions that the MCP client respawns automatically', () => {
    // We want the agent to know the recovery is free — kill and continue.
    const msg = buildStalenessWarning(PID, LOADED, REBUILT);
    expect(msg).toMatch(/respawn/i);
  });
});

describe('shouldRunStalenessCheck — dev vs published gating', () => {
  // Default behavior: any path containing `/node_modules/` is treated as a
  // published install (silent); anything else is treated as a dev checkout
  // (active). End-users who installed forge-sim from npm don't rebuild the
  // package mid-session, so a "stale daemon" warning would just be noise.

  describe('default behavior (no env override)', () => {
    const env = {};

    it('disables in a normal npm install', () => {
      expect(shouldRunStalenessCheck(
        '/Users/foo/myapp/node_modules/forge-sim/dist/mcp-server.js', env,
      )).toBe(false);
    });

    it('disables in a pnpm content-addressable install', () => {
      // pnpm stores packages under `.pnpm/<name>@<version>/node_modules/<name>/...`
      expect(shouldRunStalenessCheck(
        '/Users/foo/myapp/node_modules/.pnpm/forge-sim@0.1.0/node_modules/forge-sim/dist/mcp-server.js', env,
      )).toBe(false);
    });

    it('disables in an npx execution', () => {
      // npx still lays out the package under node_modules.
      expect(shouldRunStalenessCheck(
        '/Users/foo/.npm/_npx/abc123/node_modules/forge-sim/dist/mcp-server.js', env,
      )).toBe(false);
    });

    it('enables from our development checkout', () => {
      expect(shouldRunStalenessCheck(
        '/Users/nyx/.openclaw/workspace/forge-sim/dist/mcp-server.js', env,
      )).toBe(true);
    });

    it('enables from any non-node_modules checkout location', () => {
      expect(shouldRunStalenessCheck(
        '/some/random/dev/dir/forge-sim/dist/mcp-server.js', env,
      )).toBe(true);
    });

    it('enables when forge-sim itself lives in a path named `node_modules-like` (no false match)', () => {
      // The check looks for `/node_modules/` with separators on both sides,
      // not bare "node_modules" substring matching.
      expect(shouldRunStalenessCheck(
        '/Users/foo/node_modules_workspace/forge-sim/dist/mcp-server.js', env,
      )).toBe(true);
    });
  });

  describe('FORGE_SIM_STALE_CHECK env override', () => {
    const NODE_MODULES_PATH = '/myapp/node_modules/forge-sim/dist/mcp-server.js';
    const DEV_PATH = '/dev/forge-sim/dist/mcp-server.js';

    it('"off" silences even from a dev checkout', () => {
      expect(shouldRunStalenessCheck(DEV_PATH, { FORGE_SIM_STALE_CHECK: 'off' })).toBe(false);
    });

    it('"0" / "false" also silence', () => {
      expect(shouldRunStalenessCheck(DEV_PATH, { FORGE_SIM_STALE_CHECK: '0' })).toBe(false);
      expect(shouldRunStalenessCheck(DEV_PATH, { FORGE_SIM_STALE_CHECK: 'false' })).toBe(false);
    });

    it('"on" forces enabled even from node_modules', () => {
      // Use case: forge-sim contributor running tests against an installed
      // copy. They want the trap-detection active even though path is
      // technically under node_modules.
      expect(shouldRunStalenessCheck(NODE_MODULES_PATH, { FORGE_SIM_STALE_CHECK: 'on' })).toBe(true);
    });

    it('"1" / "true" also force enabled', () => {
      expect(shouldRunStalenessCheck(NODE_MODULES_PATH, { FORGE_SIM_STALE_CHECK: '1' })).toBe(true);
      expect(shouldRunStalenessCheck(NODE_MODULES_PATH, { FORGE_SIM_STALE_CHECK: 'true' })).toBe(true);
    });

    it('env override is case-insensitive', () => {
      expect(shouldRunStalenessCheck(DEV_PATH, { FORGE_SIM_STALE_CHECK: 'OFF' })).toBe(false);
      expect(shouldRunStalenessCheck(NODE_MODULES_PATH, { FORGE_SIM_STALE_CHECK: 'ON' })).toBe(true);
    });

    it('unrecognized env values fall back to default path-based decision', () => {
      expect(shouldRunStalenessCheck(NODE_MODULES_PATH, { FORGE_SIM_STALE_CHECK: 'maybe' })).toBe(false);
      expect(shouldRunStalenessCheck(DEV_PATH, { FORGE_SIM_STALE_CHECK: 'maybe' })).toBe(true);
    });

    it('undefined env value falls back to default', () => {
      expect(shouldRunStalenessCheck(NODE_MODULES_PATH, { FORGE_SIM_STALE_CHECK: undefined })).toBe(false);
      expect(shouldRunStalenessCheck(DEV_PATH, { FORGE_SIM_STALE_CHECK: undefined })).toBe(true);
    });
  });
});

describe('shouldWarnNow — dedup once per rebuild', () => {
  // Three timeline markers used across these tests.
  const LOADED = 1_000_000;                          // daemon started here
  const REBUILT_ONCE = LOADED + 60_000;              // dist rebuilt later (stale)
  const REBUILT_TWICE = REBUILT_ONCE + 60_000;       // dist rebuilt AGAIN (newly stale)

  it('fires on first detection of a given on-disk mtime', () => {
    // lastWarnedMtimeMs is null — haven't warned yet this session
    expect(shouldWarnNow(LOADED, REBUILT_ONCE, null)).toBe(true);
  });

  it('suppresses on subsequent calls at the same on-disk mtime', () => {
    // After the caller advanced lastWarnedMtimeMs to REBUILT_ONCE — no further warnings
    expect(shouldWarnNow(LOADED, REBUILT_ONCE, REBUILT_ONCE)).toBe(false);
  });

  it('re-fires when dist gets rebuilt again (new on-disk mtime)', () => {
    // Operator never restarted the daemon, but dist was rebuilt a second
    // time — the agent should know.
    expect(shouldWarnNow(LOADED, REBUILT_TWICE, REBUILT_ONCE)).toBe(true);
  });

  it('returns false when nothing is stale yet (loaded === current)', () => {
    expect(shouldWarnNow(LOADED, LOADED, null)).toBe(false);
  });

  it('respects the grace period for transient same-second mtime noise', () => {
    expect(shouldWarnNow(LOADED, LOADED + 100, null)).toBe(false);
    expect(shouldWarnNow(LOADED, LOADED + STALENESS_GRACE_MS, null)).toBe(false);
    expect(shouldWarnNow(LOADED, LOADED + STALENESS_GRACE_MS + 1, null)).toBe(true);
  });

  it('returns false when loadedMtimeMs is null (daemon couldn\'t stat itself)', () => {
    expect(shouldWarnNow(null, REBUILT_ONCE, null)).toBe(false);
  });

  it('returns false when currentMtimeMs is null (stat failed)', () => {
    expect(shouldWarnNow(LOADED, null, null)).toBe(false);
  });

  it('honors a custom grace period', () => {
    expect(shouldWarnNow(LOADED, LOADED + 500, null, 1000)).toBe(false);
    expect(shouldWarnNow(LOADED, LOADED + 2000, null, 1000)).toBe(true);
  });

  it('full lifecycle: first stale fires, second suppresses, rebuild re-fires', () => {
    // Simulate how mcp-server.ts threads state across calls:
    let lastWarnedMtimeMs: number | null = null;
    const tick = (cur: number): boolean => {
      const should = shouldWarnNow(LOADED, cur, lastWarnedMtimeMs);
      if (should) lastWarnedMtimeMs = cur;
      return should;
    };

    expect(tick(LOADED)).toBe(false);             // not yet stale
    expect(tick(REBUILT_ONCE)).toBe(true);        // first stale detection → fire
    expect(tick(REBUILT_ONCE)).toBe(false);       // same mtime → suppress
    expect(tick(REBUILT_ONCE)).toBe(false);       // still same mtime → still suppress
    expect(tick(REBUILT_TWICE)).toBe(true);       // dist rebuilt again → fire
    expect(tick(REBUILT_TWICE)).toBe(false);      // same mtime → suppress
  });

  it('lastWarnedMtimeMs older than currentMtimeMs still triggers (rebuild after warn)', () => {
    // The dedup compares for equality, NOT "lastWarned >= current". A
    // rebuild that ALSO happens to land between the last warning and now
    // (currentMtimeMs > lastWarnedMtimeMs) must fire.
    expect(shouldWarnNow(LOADED, REBUILT_TWICE, REBUILT_ONCE)).toBe(true);
  });

  it('lastWarnedMtimeMs identical to the dedup decision is the only suppression case', () => {
    // Cover the off-by-one boundary deliberately: any value not strictly
    // equal to currentMtimeMs lets the warning through.
    expect(shouldWarnNow(LOADED, REBUILT_ONCE, REBUILT_ONCE - 1)).toBe(true);
    expect(shouldWarnNow(LOADED, REBUILT_ONCE, REBUILT_ONCE + 1)).toBe(true);
    expect(shouldWarnNow(LOADED, REBUILT_ONCE, REBUILT_ONCE)).toBe(false);
  });
});
