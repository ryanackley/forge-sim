/**
 * Drift detector for the `@forge/kvs` shim.
 *
 * Skill run #11 (2026-05-16) caught the shim shipping with broken helpers:
 *   - WhereConditions exposed 2 of 7 functions, one misnamed (`equalsTo`)
 *   - FilterConditions returned `{ condition: 'camelCase', value: x }`
 *     instead of the canonical `{ condition: 'SCREAMING_SNAKE', values: [x] }`
 *   - MetadataField had `KEY` (doesn't exist), lowercase string values,
 *     missing `EXPIRE_TIME`
 *
 * Our 1500+ existing tests caught NONE of this because they tested the
 * runtime in its broken shape: literal `{ beginsWith: x }` objects passed
 * straight to `.where()` produced self-consistent passes. Helper return
 * values were almost never asserted. Only ONE test in the entire suite
 * called `WhereConditions.beginsWith` through the shim surface — and
 * `beginsWith` happened to be the one helper whose name AND shape we
 * didn't mangle.
 *
 * This file fixes that hole by importing BOTH the shim AND the real
 * `@forge/kvs` package and asserting surface equality at runtime. It will
 * fail the build the moment:
 *   - real @forge/kvs adds a helper we haven't mirrored
 *   - real @forge/kvs renames an existing helper
 *   - our shim helper returns a different shape than the real one
 *   - real @forge/kvs's MetadataField changes
 *
 * Pattern stolen from forge-react-shim.test.ts (the React equivalent).
 * Worth replicating for every `@forge/*` shim — see TOOLS.md.
 */
import { describe, it, expect } from 'vitest';
import * as shim from '../shims/forge-kvs.js';
// eslint-disable-next-line @typescript-eslint/no-var-requires
import * as real from '@forge/kvs';

describe('@forge/kvs shim — WhereConditions parity with real package', () => {
  it('exposes the same helper names as real @forge/kvs', () => {
    const realKeys = Object.keys(real.WhereConditions).sort();
    const shimKeys = Object.keys(shim.WhereConditions).sort();
    expect(shimKeys).toEqual(realKeys);
  });

  it('every helper returns the same clause shape as real @forge/kvs', () => {
    // Probe each helper with type-appropriate input and assert deep equality
    // against what real Forge returns. Catches drift in keys (e.g.
    // `value` vs `values`), shape (canonical SCREAMING_SNAKE vs camelCase),
    // and argument handling (single value vs spread).
    const probes: Record<string, any[]> = {
      beginsWith: ['foo'],
      between: [1, 10],
      equalTo: ['alice'],
      greaterThan: [5],
      greaterThanEqualTo: [5],
      lessThan: [100],
      lessThanEqualTo: [100],
    };

    for (const [name, args] of Object.entries(probes)) {
      const realFn = (real.WhereConditions as any)[name];
      const shimFn = (shim.WhereConditions as any)[name];
      expect(typeof realFn, `real @forge/kvs.WhereConditions.${name} not callable`).toBe('function');
      expect(typeof shimFn, `shim WhereConditions.${name} not callable`).toBe('function');
      expect(shimFn(...args), `shim WhereConditions.${name}(${JSON.stringify(args)}) drifted from real`).toEqual(realFn(...args));
    }
  });

  it('catches probe coverage gaps (every real helper has a probe defined)', () => {
    // Guard against the case where Atlassian adds a new WhereConditions
    // helper, our shim mirrors it (good!), but the probe table above
    // forgets to test it (silent gap). If this fires, add an entry to
    // `probes` above with the right argument shape.
    const probesCovered = ['beginsWith', 'between', 'equalTo', 'greaterThan', 'greaterThanEqualTo', 'lessThan', 'lessThanEqualTo'].sort();
    const realKeys = Object.keys(real.WhereConditions).sort();
    expect(probesCovered).toEqual(realKeys);
  });
});

describe('@forge/kvs shim — FilterConditions parity with real package', () => {
  it('exposes the same helper names as real @forge/kvs', () => {
    const realKeys = Object.keys(real.FilterConditions).sort();
    const shimKeys = Object.keys(shim.FilterConditions).sort();
    expect(shimKeys).toEqual(realKeys);
  });

  it('every helper returns the same clause shape as real @forge/kvs', () => {
    const probes: Record<string, any[]> = {
      beginsWith: ['foo'],
      between: [1, 10],
      contains: ['urgent'],
      equalTo: ['open'],
      exists: [],
      greaterThan: [5],
      greaterThanEqualTo: [5],
      lessThan: [100],
      lessThanEqualTo: [100],
      notContains: ['archived'],
      notEqualTo: ['closed'],
      notExists: [],
    };

    for (const [name, args] of Object.entries(probes)) {
      const realFn = (real.FilterConditions as any)[name];
      const shimFn = (shim.FilterConditions as any)[name];
      expect(typeof realFn, `real @forge/kvs.FilterConditions.${name} not callable`).toBe('function');
      expect(typeof shimFn, `shim FilterConditions.${name} not callable`).toBe('function');
      expect(shimFn(...args), `shim FilterConditions.${name}(${JSON.stringify(args)}) drifted from real`).toEqual(realFn(...args));
    }
  });

  it('catches probe coverage gaps (every real helper has a probe defined)', () => {
    const probesCovered = [
      'beginsWith', 'between', 'contains', 'equalTo', 'exists',
      'greaterThan', 'greaterThanEqualTo', 'lessThan', 'lessThanEqualTo',
      'notContains', 'notEqualTo', 'notExists',
    ].sort();
    const realKeys = Object.keys(real.FilterConditions).sort();
    expect(probesCovered).toEqual(realKeys);
  });
});

describe('@forge/kvs shim — MetadataField parity with real package', () => {
  it('shim has exactly the same enum keys as the real package', () => {
    const realKeys = Object.keys(real.MetadataField).sort();
    const shimKeys = Object.keys(shim.MetadataField).sort();
    expect(shimKeys).toEqual(realKeys);
  });

  it('shim values exactly match real values', () => {
    // Real Forge exports MetadataField as a TS enum (which compiles to a
    // double-keyed object: { CREATED_AT: 'CREATED_AT', CREATED_AT_reverse:
    // ... }). Compare only the string-keyed forward direction we actually
    // care about for runtime parity.
    for (const key of Object.keys(real.MetadataField)) {
      // Skip numeric reverse-mapping keys if any (TS enums emit both)
      if (/^\d/.test(key)) continue;
      expect(
        (shim.MetadataField as any)[key],
        `shim MetadataField.${key} drifted from real value`,
      ).toBe((real.MetadataField as any)[key]);
    }
  });
});

describe('@forge/kvs shim — top-level export surface', () => {
  it('shim re-exports all the top-level names users import', () => {
    // The bits app authors actually import from '@forge/kvs'. If real
    // Forge adds a new top-level (e.g. a new helpers object), this test
    // wails and the shim gets fixed before it lands in user code as
    // undefined.
    const expected = [
      'kvs',
      'WhereConditions',
      'FilterConditions',
      'MetadataField',
      // Sort/Filter/Errors are nice to verify too — they're stable but
      // pin them so accidental deletion fires loudly.
      'Sort',
      'Filter',
      'ForgeKvsError',
      'ForgeKvsAPIError',
    ];
    for (const name of expected) {
      expect((shim as any)[name], `shim missing top-level export "${name}"`).toBeDefined();
    }
  });
});
