/**
 * Contract parity, layer 1: export surface (#10).
 *
 * For every package in SHIM_NAMES, compare the shim's runtime exports against
 * the real Atlassian package installed in node_modules:
 *
 *   - MISSING: a public export of the real package that the shim lacks. An app
 *     using it works in Forge and crashes in forge-sim — the core parity bug.
 *   - EXTRA: a shim export the real package doesn't have. Worse in a way: code
 *     relying on it passes in forge-sim and explodes on real deploy (the
 *     Textfield/TextField trap — see forge-react-shim-parity.test.ts, which
 *     keeps the react-specific casing checks).
 *
 * Driven off SHIM_NAMES so a newly added shim is covered automatically; the
 * helper throws if it has no registered upstream reference.
 *
 * Known deviations live in KNOWN_MISSING / SIM_ONLY_EXPORTS below. Every entry
 * needs a reason. Entries tagged TODO(#10) are parity debt surfaced when this
 * suite first ran — burn them down (implement or throw a clear
 * "not implemented in forge-sim" error per the no-silent-stubs convention),
 * don't let the list grow.
 */
import { describe, it, expect } from 'vitest';
import { SHIM_NAMES } from '../shims/shim-registry.js';
import { loadRealForgePackage, realForgeSpecifiers } from './helpers/real-forge-packages.js';

// Interop/internal keys that are not part of the public contract.
//   __esModule  — CJS interop marker
//   default     — synthesized default varies by interop layer; named exports
//                 are the contract that matters
//   __*         — Atlassian-internal (e.g. @forge/api's __getRuntime,
//                 __fetchProduct); apps importing those are off-contract
const isContractKey = (key: string) => key !== 'default' && !key.startsWith('__');

/**
 * Real exports the shim intentionally does not provide (yet). Key: specifier,
 * value: symbol → reason.
 */
const KNOWN_MISSING: Record<string, Record<string, string>> = {
  '@forge/react': {
    replaceUnsupportedDocumentNodes:
      'TODO(#10): new upstream ADF utility; add a passthrough to the real package',
  },
  '@forge/bridge': {
    FeatureFlags:
      'TODO(#10): real export is PascalCase FeatureFlags; shim ships lowercase featureFlags — casing-trap fix needed on the shim',
    checkPermissions: 'TODO(#10): not implemented; should throw a clear not-implemented error',
    createPermissionUtils: 'TODO(#10): not implemented; should throw a clear not-implemented error',
    fetchUserRecommendations: 'TODO(#10): not implemented; should throw a clear not-implemented error',
    frontendCustomMetrics: 'TODO(#10): not implemented; should throw a clear not-implemented error',
    makeInvoke: 'TODO(#10): factory behind invoke(); shim exports only the bound invoke',
    requestTeamworkGraph: 'Planned for 0.3 Teamwork Graph shim (#47); until then it must throw not-implemented, not be absent',
    rovo: 'Planned alongside rovo:mcp / rovo:skill modules (#46, #44) in 0.2',
  },
  '@forge/llm': {
    ForgeLlmError: 'TODO(#10): upstream error base class; export so instanceof checks work in forge-sim',
    PromptValidationError: 'TODO(#10): upstream validation error; export so instanceof checks work in forge-sim',
  },
};

/**
 * Shim exports that don't exist upstream, on purpose. Same shape as
 * KNOWN_MISSING. Anything not listed here fails the EXTRA check.
 */
const SIM_ONLY_EXPORTS: Record<string, Record<string, string>> = {
  '@forge/api': {
    storage:
      'Legacy @forge/api storage API — removed upstream in 8.x but older apps (and @forge/api <8 pins) still use it; keep until we version-gate shims',
    WhereConditions: 'Query helper for the legacy storage API (see storage)',
    FilterConditions: 'Query helper for the legacy storage API (see storage)',
    SortOrder: 'Query helper for the legacy storage API (see storage)',
    startsWith: 'Query helper for the legacy storage API (see storage)',
    createTranslationFunction:
      'TODO(#10): sim exports i18n helpers top-level; real @forge/api only exposes them via the i18n namespace — candidate removal',
    getTranslations: 'TODO(#10): see createTranslationFunction',
    resetTranslationsCache: 'TODO(#10): see createTranslationFunction',
  },
  '@forge/events': {
    Response: 'TODO(#10): internal base of QueueResponse/InvocationError leaked as an export — candidate removal',
    extractAppIdUuid: 'TODO(#10): sim-internal helper exported from the shim — move it out of the shim surface',
  },
  '@forge/react': {
    Global:
      'TODO(#10): re-exported as realModule.Global, which no longer exists on the main entry (moved to @forge/react/global subpath) — currently exports undefined; fix or remove',
  },
  '@forge/bridge': {
    featureFlags:
      'TODO(#10): lowercase variant of real FeatureFlags — casing trap; rename to match upstream (see KNOWN_MISSING)',
    BridgeAPIError:
      'Matches the error class real @forge/bridge throws; upstream does not export it but apps catch it by behavior, and the sim exporting it aids tests',
    createMemoryHistory: 'Sim-internal router history factory used by view.createHistory()',
    onViewEvent: 'Sim-only test hook for observing view events',
    resetViewEvents: 'Sim-only test hook (see onViewEvent)',
  },
  '@forge/object-store': {
    fos: 'TODO(#10): convenience named export of the default fos singleton; real package has default-only — candidate removal',
  },
};

describe('shim export-surface contract (#10)', () => {
  it('every shim has a registered real-package reference', () => {
    const covered = new Set(realForgeSpecifiers());
    const unreferenced = SHIM_NAMES.filter(name => !covered.has(name));
    expect(
      unreferenced,
      `shims with no upstream reference registered in real-forge-packages.ts: ${unreferenced.join(', ')}`,
    ).toEqual([]);
  });

  describe.each([...SHIM_NAMES])('%s', specifier => {
    it('exports every public symbol the real package does', async () => {
      const real = loadRealForgePackage(specifier);
      const shim = await import(specifier);
      const allowed = KNOWN_MISSING[specifier] ?? {};

      const missing = Object.keys(real)
        .filter(isContractKey)
        .filter(key => !(key in shim) && !(key in allowed))
        .sort();

      expect(
        missing,
        `shim for ${specifier} is missing real exports: ${missing.join(', ')}. ` +
          `Implement them (a clear not-implemented throw is acceptable) or add ` +
          `to KNOWN_MISSING with a reason.`,
      ).toEqual([]);
    });

    it('exports nothing the real package lacks', async () => {
      const real = loadRealForgePackage(specifier);
      const shim = await import(specifier);
      const allowed = SIM_ONLY_EXPORTS[specifier] ?? {};

      const extra = Object.keys(shim)
        .filter(isContractKey)
        .filter(key => !(key in real) && !(key in allowed))
        .sort();

      expect(
        extra,
        `shim for ${specifier} exports symbols real ${specifier} does not: ${extra.join(', ')}. ` +
          `Code using them passes in forge-sim but fails on real deploy. Remove ` +
          `them or add to SIM_ONLY_EXPORTS with a reason.`,
      ).toEqual([]);
    });
  });

  it('allowlists only reference real specifiers and live symbols', async () => {
    // Keeps the allowlists from rotting: an entry for a symbol that upstream
    // removed (or that the shim now implements) must be deleted.
    for (const [specifier, symbols] of Object.entries(KNOWN_MISSING)) {
      const real = loadRealForgePackage(specifier);
      const shim = await import(specifier);
      for (const key of Object.keys(symbols)) {
        expect(key in real, `${specifier} KNOWN_MISSING '${key}' no longer exists upstream — remove it`).toBe(true);
        expect(key in shim, `${specifier} KNOWN_MISSING '${key}' is now implemented by the shim — remove it`).toBe(false);
      }
    }
    for (const [specifier, symbols] of Object.entries(SIM_ONLY_EXPORTS)) {
      const real = loadRealForgePackage(specifier);
      const shim = await import(specifier);
      for (const key of Object.keys(symbols)) {
        expect(key in shim, `${specifier} SIM_ONLY_EXPORTS '${key}' is no longer exported by the shim — remove it`).toBe(true);
        expect(key in real, `${specifier} SIM_ONLY_EXPORTS '${key}' now exists upstream — remove it (and check the shapes match)`).toBe(false);
      }
    }
  });
});
