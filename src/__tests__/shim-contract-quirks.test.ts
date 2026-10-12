/**
 * Contract parity, layer 3: the quirk index (#10).
 *
 * Layers 1 and 2 compare the shims to the real packages mechanically — export
 * names and type shapes. Neither can see a BEHAVIORAL quirk: a real package
 * that returns something surprising, inherits a misleading `name`, or clamps
 * an argument. Those were each found by hand (reading `node_modules/@forge/
 * <pkg>/out/**` or an adversarial eval), and each already has a pinning test.
 *
 * What was missing is discoverability. The pins live in three unrelated files,
 * and the only thread connecting them was prose inside the layer-2 allowlists
 * ("covered by eval11-findings tests"). Prose can't rot-proof itself: rename
 * the test and the comment silently lies.
 *
 * So this file is the index, and the tests below make it self-enforcing — a
 * referenced file that disappears, or a test title that gets reworded, fails
 * here. That is the whole point; a stale index is worse than none, because it
 * tells you a quirk is covered when it isn't.
 *
 * These are UNDOCUMENTED platform behaviors. None of them appear in
 * Atlassian's developer docs — they're what the shipped package actually does.
 * That makes them the highest-risk category for parity drift: nothing upstream
 * announces when one changes, so a `@forge/*` bump can quietly invalidate any
 * entry here. The version each was confirmed against is tracked per-package in
 * VERIFIED_FORGE_VERSIONS (layer 4), and `every quirk names a version-pinned
 * package` below keeps the two layers wired together.
 *
 * Longer term these want verifying against a real deployed Forge app rather
 * than against the npm package — that would turn "the package does this" into
 * "the platform does this", which is the actual parity claim. Each entry's
 * `quirk` field is written to be checkable that way: a concrete, observable
 * behavior, not a description of our implementation.
 *
 * ADDING A QUIRK: add an entry here in the same commit as its pinning test.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERIFIED_FORGE_VERSIONS } from '../forge-package-versions.js';

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));

interface QuirkPin {
  /** Test file holding the pin, relative to src/__tests__/. */
  file: string;
  /** Exact `it(...)` title. Asserted to exist, so rewording fails loudly. */
  test: string;
}

interface Quirk {
  /** Stable slug. Cite this in commits and comments instead of a line number. */
  id: string;
  /** The real package whose behavior this describes. */
  package: string;
  /** Symbol the quirk attaches to. */
  symbol: string;
  /** What the real package observably does. Written to be checkable against a real deploy. */
  quirk: string;
  /** What breaks if the shim doesn't reproduce it — the parity cost. */
  breaks: string;
  /** Where it's pinned. At least one. */
  pinnedBy: QuirkPin[];
}

/**
 * Every hand-verified, undocumented behavior the shims deliberately reproduce.
 *
 * Ordering is by package, then by how badly it bit us.
 */
export const QUIRKS: Quirk[] = [
  {
    id: 'events-invocation-error-returns-plain-object',
    package: '@forge/events',
    symbol: 'InvocationError',
    quirk:
      'The constructor returns `this.toJSON()`, so `new InvocationError()` evaluates to a PLAIN ' +
      'object `{_retry, retryOptions}` — not an InvocationError instance. `new InvocationError() ' +
      'instanceof InvocationError` is false.',
    breaks:
      'A shim that returns a real instance passes any `instanceof` check the app makes and ' +
      'serializes differently over the queue wire, so retry payloads diverge from production.',
    pinnedBy: [
      {
        file: 'eval11-findings.test.ts',
        test: 'new InvocationError() yields the serialized {_retry, retryOptions} form with defaults',
      },
    ],
  },
  {
    id: 'events-invocation-error-clamps-retry-after',
    package: '@forge/events',
    symbol: 'InvocationError',
    quirk: 'A `retryAfter` of 0 or less is silently clamped to 1 rather than rejected or honored.',
    breaks:
      'An app passing retryAfter: 0 expecting an immediate retry gets a 1-minute delay in Forge. ' +
      'A sim that retries immediately hides a real production delay.',
    pinnedBy: [
      {
        file: 'eval11-findings.test.ts',
        test: 'new InvocationError(options) carries the options through and clamps retryAfter <= 0 to 1',
      },
    ],
  },
  {
    id: 'events-invocation-error-code-values',
    package: '@forge/events',
    symbol: 'InvocationErrorCode',
    quirk:
      'The enum values are all `FUNCTION_*` (FUNCTION_OUT_OF_MEMORY, FUNCTION_TIME_OUT, ' +
      'FUNCTION_PLATFORM_UNKNOWN_ERROR, FUNCTION_PLATFORM_RATE_LIMITED, ' +
      'FUNCTION_UPSTREAM_RATE_LIMITED, FUNCTION_RETRY_REQUEST) — there is no UNKNOWN, TIMEOUT or ' +
      'RUNTIME_ERROR member.',
    breaks:
      'The shim previously invented exactly those three names. An app switching on ' +
      'InvocationErrorCode.TIMEOUT compiled and ran in the sim, then matched nothing in Forge.',
    pinnedBy: [
      { file: 'eval11-findings.test.ts', test: 'InvocationErrorCode has exactly the real enum values' },
    ],
  },
  {
    id: 'events-queue-response-retry-flag',
    package: '@forge/events',
    symbol: 'QueueResponse',
    quirk:
      'QueueResponse extends an internal `Response` base that the package does NOT export, and ' +
      '`retry()` mutates a `_retry` boolean on it rather than returning a new value.',
    breaks:
      'The unexported base means `instanceof Response` is unavailable to apps and to us — the pin ' +
      'asserts through the prototype chain instead. A shim exporting Response would be an EXTRA ' +
      'that layer 1 rejects.',
    pinnedBy: [
      { file: 'eval11-findings.test.ts', test: 'QueueResponse extends Response and retry() flips the _retry flag' },
    ],
  },
  {
    id: 'kvs-api-error-name-is-base-class-name',
    package: '@forge/kvs',
    symbol: 'ForgeKvsAPIError',
    quirk:
      'The shipped constructor never assigns `this.name`, so instances inherit "ForgeKvsError" ' +
      'from the base class. `new ForgeKvsAPIError(...).name` is "ForgeKvsError", not ' +
      '"ForgeKvsAPIError".',
    breaks:
      'Apps commonly branch on `err.name`. A shim that sets the obvious name takes a different ' +
      'branch in the sim than in production.',
    pinnedBy: [
      { file: 'forge-kvs-shim.test.ts', test: 'mirrors the real name quirk: ForgeKvsAPIError.name stays "ForgeKvsError"' },
    ],
  },
  {
    id: 'kvs-filter-base-builder-reports-or',
    package: '@forge/kvs',
    symbol: 'Filter',
    quirk:
      'A freshly constructed `new Filter()` reports `operator()` as "or" (not "and", and not ' +
      'undefined) while `filters()` is still empty.',
    breaks:
      'Anything inferring the default combinator from a fresh builder picks the wrong one, ' +
      'silently changing query semantics for an empty-then-populated filter.',
    pinnedBy: [
      { file: 'forge-kvs-shim.test.ts', test: 'plain new Filter() matches real: filters() is [] and operator() is "or"' },
    ],
  },
  {
    id: 'kvs-filter-is-a-constructible-class',
    package: '@forge/kvs',
    symbol: 'Filter',
    quirk: 'Real `@forge/kvs` exports `FilterBuilder as Filter` — a constructible class, not a helpers object.',
    breaks:
      'The shim aliased Filter to the FilterConditions helpers object until 2026-07-04, so ' +
      '`new Filter()` worked in Forge and threw in the sim — the canonical "works in Forge, ' +
      'fails here" bug this whole suite exists to prevent.',
    pinnedBy: [
      { file: 'forge-kvs-shim.test.ts', test: 'Filter is constructible (was aliased to FilterConditions until 2026-07-04)' },
    ],
  },
  {
    id: 'kvs-filter-combinator-locking',
    package: '@forge/kvs',
    symbol: 'Filter',
    quirk:
      'Calling `.and()` returns a builder with no `.or` method and vice versa — the combinator ' +
      'locks after the first call, enforced by the returned object\'s shape rather than a throw.',
    breaks:
      'A shim exposing both methods on both builders lets an app write a mixed and/or chain that ' +
      'type-checks and runs locally, then fails to compile or behaves differently against the real package.',
    pinnedBy: [
      { file: 'forge-kvs-shim.test.ts', test: 'combinator locking matches real: and-builder has no .or, or-builder has no .and' },
    ],
  },
  {
    id: 'api-route-returns-object-not-string',
    package: '@forge/api',
    symbol: 'route',
    quirk:
      'The `route` tagged template returns an OBJECT `{ value: "<path>" }`, not a string, and ' +
      'embeds nested Route and URLSearchParams arguments verbatim via their string form.',
    breaks:
      'A shim returning a bare string makes `route(...)` concatenate and compare differently; ' +
      'code doing `route\\`...\\` === "/x"` or passing it where an object is expected diverges.',
    pinnedBy: [
      { file: 'shims.test.ts', test: 'route() returns a Route OBJECT with the built path in .value, like real @forge/api' },
      { file: 'shims.test.ts', test: 'route() embeds Route and URLSearchParams params verbatim (real behavior)' },
    ],
  },
  {
    id: 'api-i18n-helpers-not-top-level',
    package: '@forge/api',
    symbol: 'i18n',
    quirk:
      'The i18n helpers are reachable only through the `i18n` namespace export; they are NOT ' +
      'exported at the top level of `@forge/api`.',
    breaks:
      'A shim exporting them top-level lets `import { getTranslations } from "@forge/api"` resolve ' +
      'in the sim and fail on real deploy.',
    pinnedBy: [
      { file: 'shims.test.ts', test: 'i18n helpers are NOT exported top-level (real @forge/api only has the i18n namespace)' },
    ],
  },
];

describe('shim behavioral-quirk index (#10)', () => {
  it('has a unique id per quirk', () => {
    const ids = QUIRKS.map(q => q.id);
    expect(ids, 'quirk ids must be unique — they are cited in commits and comments').toEqual([
      ...new Set(ids),
    ]);
  });

  it('every quirk names a version-pinned package', () => {
    // Wires layer 3 to layer 4: a quirk is only meaningful relative to the
    // version it was confirmed against. If a package leaves
    // VERIFIED_FORGE_VERSIONS, its quirks need re-confirming, not orphaning.
    const unpinned = QUIRKS.filter(q => !(q.package in VERIFIED_FORGE_VERSIONS)).map(
      q => `${q.id} → ${q.package}`,
    );
    expect(
      unpinned,
      `quirks referencing a package with no verified version: ${unpinned.join(', ')}. ` +
        `Add the package to VERIFIED_FORGE_VERSIONS or drop the quirk.`,
    ).toEqual([]);
  });

  it('every quirk is actually pinned by a test that exists', () => {
    // The anti-rot guard, and the reason this file earns its keep: a renamed
    // or deleted pinning test fails HERE rather than leaving the index quietly
    // claiming coverage that evaporated.
    const broken: string[] = [];
    for (const quirk of QUIRKS) {
      expect(quirk.pinnedBy.length, `${quirk.id} must cite at least one pinning test`).toBeGreaterThan(0);

      for (const pin of quirk.pinnedBy) {
        const path = join(TESTS_DIR, pin.file);
        if (!existsSync(path)) {
          broken.push(`${quirk.id}: file ${pin.file} does not exist`);
          continue;
        }
        if (!readFileSync(path, 'utf8').includes(pin.test)) {
          broken.push(`${quirk.id}: ${pin.file} has no test titled "${pin.test}"`);
        }
      }
    }
    expect(
      broken,
      `quirk index is stale:\n  ${broken.join('\n  ')}\n` +
        `Update the entry in shim-contract-quirks.test.ts to match the renamed/moved test, ` +
        `or remove the quirk if it is no longer real.`,
    ).toEqual([]);
  });

  it('describes each quirk and its parity cost in prose', () => {
    // These fields are the documentation half — they're what makes the index
    // readable by someone who has never seen the shim, and what a future
    // against-real-Forge harness would check. Enforce they aren't stubs.
    for (const quirk of QUIRKS) {
      expect(quirk.quirk.length, `${quirk.id}: 'quirk' must describe the real behavior`).toBeGreaterThan(40);
      expect(quirk.breaks.length, `${quirk.id}: 'breaks' must state the parity cost`).toBeGreaterThan(40);
      expect(quirk.symbol, `${quirk.id}: 'symbol' is required`).toBeTruthy();
    }
  });
});
