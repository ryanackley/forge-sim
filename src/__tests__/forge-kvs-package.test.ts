/**
 * Behaviors of the REAL `@forge/kvs` that apps depend on.
 *
 * Apps run the real package now — forge-sim serves its I/O at the
 * `__forge_fetch__` seam (`type: 'kvs'`) instead of aliasing the import
 * (bare-seam migration, phase 3a). So there is no shim left to drift, and the
 * old shim-vs-real comparison suite went with it.
 *
 * What still needs pinning is the other direction: these are UNDOCUMENTED
 * behaviors of the shipped package that app code (and our own KVS
 * implementation) relies on. Nothing upstream announces when one changes, so a
 * `@forge/kvs` bump could quietly invalidate any of them. Each is indexed in
 * `shim-contract-quirks.test.ts`, which asserts these exact test titles exist
 * — reword one and that index fails.
 *
 * Version pinned by VERIFIED_FORGE_VERSIONS (`@forge/kvs`).
 */
import { describe, it, expect } from 'vitest';
import * as real from '@forge/kvs';

describe('real @forge/kvs — Filter builder', () => {
  it('Filter is constructible (was aliased to FilterConditions until 2026-07-04)', () => {
    // The package exports `FilterBuilder as Filter` — a class, not a helpers
    // object. Our old shim aliased it to FilterConditions, so `new Filter()`
    // worked in Forge and crashed in the sim.
    expect(() => new (real as any).Filter()).not.toThrow();
  });

  it('plain new Filter() matches real: filters() is [] and operator() is "or"', () => {
    const f = new (real as any).Filter();
    expect(f.filters()).toEqual([]);
    // The quirk: a base builder with no combinator chosen still reports 'or'.
    expect(f.operator()).toBe('or');
  });

  it('and-chain produces identical filters()/operator() to real', () => {
    const f = new (real as any).Filter()
      .and('status', real.FilterConditions.equalTo('open'))
      .and('total', real.FilterConditions.greaterThan(100));
    expect(f.operator()).toBe('and');
    expect(f.filters()).toHaveLength(2);
  });

  it('or-chain produces identical filters()/operator() to real', () => {
    const f = new (real as any).Filter()
      .or('status', real.FilterConditions.equalTo('cancelled'))
      .or('total', real.FilterConditions.lessThan(10));
    expect(f.operator()).toBe('or');
    expect(f.filters()).toHaveLength(2);
  });

  it('combinator locking matches real: and-builder has no .or, or-builder has no .and', () => {
    const andBuilder = new (real as any).Filter().and('a', real.FilterConditions.equalTo(1));
    expect((andBuilder as any).or).toBeUndefined();

    const orBuilder = new (real as any).Filter().or('a', real.FilterConditions.equalTo(1));
    expect((orBuilder as any).and).toBeUndefined();
  });
});

describe('real @forge/kvs — error classes', () => {
  it('ForgeKvsAPIError constructor signature and fields match real', () => {
    const responseDetails = { status: 400, statusText: 'Bad Request', traceId: 'trace-123' };
    const forgeError = {
      code: 'CONDITION_FAILED',
      message: 'Condition not met',
      context: { key: 'o1' },
      extra: 'body-data',
    };
    const err = new (real as any).ForgeKvsAPIError(responseDetails, forgeError);

    expect(err.code).toBe('CONDITION_FAILED');
    expect(err.message).toBe('Condition not met');
    // The real constructor spreads the forge-error's extra fields into context.
    expect(err.context).toEqual({ key: 'o1', extra: 'body-data' });
    expect(err.responseDetails).toEqual(responseDetails);
  });

  it('mirrors the real name quirk: ForgeKvsAPIError.name stays "ForgeKvsError"', () => {
    // The shipped constructor never sets this.name, so instances inherit
    // 'ForgeKvsError' from the base class. Apps matching on err.name see that
    // string in prod, so anything we raise through this class must too.
    const err = new (real as any).ForgeKvsAPIError(
      { status: 500, statusText: 'ISE', traceId: null },
      { code: 'X', message: 'boom' },
    );
    expect(err.name).toBe('ForgeKvsError');
  });

  it('instanceof chain matches real: APIError extends ForgeKvsError extends Error', () => {
    const err = new (real as any).ForgeKvsAPIError(
      { status: 500, statusText: 'ISE', traceId: null },
      { code: 'X', message: 'boom' },
    );
    expect(err).toBeInstanceOf((real as any).ForgeKvsError);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('real @forge/kvs — module surface', () => {
  it('exports the names apps import', () => {
    for (const name of [
      'kvs',
      'WhereConditions',
      'FilterConditions',
      'Filter',
      'MetadataField',
      'Sort',
      'ForgeKvsError',
      'ForgeKvsAPIError',
      'isOverrideAndReturnOptions',
    ]) {
      expect((real as any)[name], `@forge/kvs missing export "${name}"`).toBeDefined();
    }
  });

  it('kvs exposes no getMany/setMany/deleteMany (the parity lie the shim once told)', () => {
    // These never existed upstream; the shim grew them, so apps using them
    // passed in the sim and crashed in Forge. Running the real package makes
    // that class of drift impossible — this pins the specific case.
    for (const name of ['getMany', 'setMany', 'deleteMany']) {
      expect((real.kvs as any)[name], `real kvs unexpectedly has ${name}`).toBeUndefined();
    }
    for (const name of ['get', 'set', 'delete', 'query', 'entity', 'transact', 'batchGet']) {
      expect(typeof (real.kvs as any)[name], `real kvs missing ${name}`).toBe('function');
    }
  });
});
