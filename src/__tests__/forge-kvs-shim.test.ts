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

describe('@forge/kvs shim — Filter builder parity with real package', () => {
  it('Filter is constructible (was aliased to FilterConditions until 2026-07-04)', () => {
    // Real @forge/kvs exports `FilterBuilder as Filter` — a class. The old
    // shim aliased it to the FilterConditions helpers object, so
    // `new Filter()` worked in Forge and crashed in the sim.
    expect(() => new (shim.Filter as any)()).not.toThrow();
    expect(() => new (real as any).Filter()).not.toThrow();
  });

  it('plain new Filter() matches real: filters() is [] and operator() is "or"', () => {
    const shimF = new (shim.Filter as any)();
    const realF = new (real as any).Filter();
    expect(shimF.filters()).toEqual(realF.filters());
    expect(shimF.operator()).toBe(realF.operator());
    expect(shimF.operator()).toBe('or'); // the real quirk: base builder reports 'or'
  });

  it('and-chain produces identical filters()/operator() to real', () => {
    const build = (F: any, FC: any) =>
      new F()
        .and('status', FC.equalTo('open'))
        .and('total', FC.greaterThan(100));
    const shimF = build(shim.Filter, shim.FilterConditions);
    const realF = build((real as any).Filter, real.FilterConditions);
    expect(shimF.filters()).toEqual(realF.filters());
    expect(shimF.operator()).toBe(realF.operator());
    expect(shimF.operator()).toBe('and');
  });

  it('or-chain produces identical filters()/operator() to real', () => {
    const build = (F: any, FC: any) =>
      new F()
        .or('status', FC.equalTo('cancelled'))
        .or('total', FC.lessThan(10));
    const shimF = build(shim.Filter, shim.FilterConditions);
    const realF = build((real as any).Filter, real.FilterConditions);
    expect(shimF.filters()).toEqual(realF.filters());
    expect(shimF.operator()).toBe(realF.operator());
    expect(shimF.operator()).toBe('or');
  });

  it('combinator locking matches real: and-builder has no .or, or-builder has no .and', () => {
    const shimAnd = new (shim.Filter as any)().and('a', shim.FilterConditions.equalTo(1));
    const realAnd = new (real as any).Filter().and('a', real.FilterConditions.equalTo(1));
    expect(typeof (shimAnd as any).or).toBe(typeof (realAnd as any).or);

    const shimOr = new (shim.Filter as any)().or('a', shim.FilterConditions.equalTo(1));
    const realOr = new (real as any).Filter().or('a', real.FilterConditions.equalTo(1));
    expect(typeof (shimOr as any).and).toBe(typeof (realOr as any).and);
  });
});

describe('@forge/kvs shim — error class parity with real package', () => {
  it('ForgeKvsAPIError constructor signature and fields match real', () => {
    const responseDetails = { status: 400, statusText: 'Bad Request', traceId: 'trace-123' };
    const forgeError = {
      code: 'CONDITION_FAILED',
      message: 'Condition not met',
      context: { key: 'o1' },
      extra: 'body-data',
    };
    const shimErr = new (shim.ForgeKvsAPIError as any)(responseDetails, forgeError);
    const realErr = new (real as any).ForgeKvsAPIError(responseDetails, forgeError);

    expect(shimErr.code).toBe(realErr.code);
    expect(shimErr.message).toBe(realErr.message);
    expect(shimErr.context).toEqual(realErr.context);
    expect(shimErr.responseDetails).toEqual(realErr.responseDetails);
  });

  it('mirrors the real name quirk: ForgeKvsAPIError.name stays "ForgeKvsError"', () => {
    // The shipped constructor never sets this.name, so instances inherit
    // 'ForgeKvsError' from the base class. Apps matching on err.name must
    // see the same string in the sim as in prod.
    const shimErr = new (shim.ForgeKvsAPIError as any)(
      { status: 500, statusText: 'ISE', traceId: null },
      { code: 'X', message: 'boom' },
    );
    const realErr = new (real as any).ForgeKvsAPIError(
      { status: 500, statusText: 'ISE', traceId: null },
      { code: 'X', message: 'boom' },
    );
    expect(realErr.name).toBe('ForgeKvsError'); // prove the real quirk
    expect(shimErr.name).toBe(realErr.name);
  });

  it('instanceof chain matches real: APIError extends ForgeKvsError extends Error', () => {
    const shimErr = new (shim.ForgeKvsAPIError as any)(
      { status: 500, statusText: 'ISE', traceId: null },
      { code: 'X', message: 'boom' },
    );
    expect(shimErr).toBeInstanceOf(shim.ForgeKvsError);
    expect(shimErr).toBeInstanceOf(Error);
  });
});

describe('@forge/kvs shim — kvs object method surface', () => {
  it('shim kvs has exactly the same method names as real kvs', () => {
    // Parity in BOTH directions:
    //   - real has a method we lack → apps break in the sim (loud gap)
    //   - shim has a method real lacks → apps work in the sim but crash
    //     in Forge (the quiet parity lie — this is how getMany/setMany/
    //     deleteMany snuck onto the shim until 2026-07-04)
    // Real kvs is a class instance (methods on the prototype, plus a
    // `storageApi` own prop); shim kvs is a plain object. Collect callable
    // members from both regardless of placement.
    const methodNames = (obj: any): string[] => {
      const names = new Set<string>();
      for (const k of Object.keys(obj)) {
        if (typeof obj[k] === 'function') names.add(k);
      }
      const proto = Object.getPrototypeOf(obj);
      if (proto && proto !== Object.prototype) {
        for (const k of Object.getOwnPropertyNames(proto)) {
          if (k !== 'constructor' && typeof obj[k] === 'function') names.add(k);
        }
      }
      return [...names].sort();
    };
    expect(methodNames(shim.kvs)).toEqual(methodNames(real.kvs));
  });
});
