/**
 * Stale-daemon self-check unit tests.
 *
 * The integration glue (statSync, monkey-patched server.tool, response
 * threading) lives in mcp-server.ts; this file pins the pure decision
 * logic so the threshold and message format don't drift.
 */
import { describe, it, expect } from 'vitest';
import { isStale, buildStalenessWarning, STALENESS_GRACE_MS, shouldRunStalenessCheck } from '../staleness.js';

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
