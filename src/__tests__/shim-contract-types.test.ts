/**
 * Contract parity, layer 2: type shapes (#10).
 *
 * The export-surface suite (shim-contract-surface.test.ts) catches missing or
 * extra symbols, but not a changed signature — Atlassian can add a parameter,
 * change a return type, or widen an options object and the surface diff stays
 * green. This suite compiles one assignability probe per shimmed package:
 *
 *   import * as shim from '../src/shims/forge-api.js';
 *   import type * as RealNS from '../node_modules/@forge/api/out/index.js';
 *   const contract: typeof RealNS = shim;
 *
 * Any shim export whose type is not assignable to the real package's .d.ts
 * produces a TS diagnostic naming the exact symbol. Shims that type values as
 * `any` pass trivially (any is assignable to everything) — the suite tightens
 * automatically as shims adopt real types; the hard gate is renamed symbols
 * and incompatible shapes.
 *
 * Probes import the shim source and the real .d.ts entry by FILE PATH, not by
 * package name, so neither the vitest aliases nor Node resolution quirks (the
 * *-bridge packages ship no `main`) get a vote.
 *
 * Deliberate deviations are excluded per-symbol via Omit<> from TYPE_DEVIATIONS
 * below. Every entry needs a reason. Unlike the surface suite there is no
 * automatic rot-check (a type deviation that upstream later fixes still
 * compiles), so revisit the list when bumping the @forge devDependencies.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { SHIM_NAMES, shimFileBase } from '../shims/shim-registry.js';
import { loadRealForgePackage } from './helpers/real-forge-packages.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * The real package's compiled entry (TS resolves the sibling .d.ts). Mirrors
 * REAL_ENTRY in helpers/real-forge-packages.ts but points at type roots;
 * the coverage test below keeps it in lockstep with SHIM_NAMES.
 */
const REAL_TYPES_ENTRY: Record<string, string> = {
  '@forge/api': 'node_modules/@forge/api/out/index.js',
  '@forge/kvs': 'node_modules/@forge/kvs/out/index.js',
  '@forge/events': 'node_modules/@forge/events/out/index.js',
  '@forge/resolver': 'node_modules/@forge/resolver/out/index.js',
  '@forge/react': 'node_modules/@forge/react/out/index.js',
  '@forge/react/router': 'node_modules/@forge/react/out/router/index.js',
  '@forge/bridge': 'node_modules/@forge/bridge/out/index.js',
  '@forge/bridge/realtime': 'node_modules/@forge/bridge/out/realtime/index.js',
  '@forge/jira-bridge': 'node_modules/@forge/jira-bridge/out/index.js',
  '@forge/confluence-bridge': 'node_modules/@forge/confluence-bridge/out/index.js',
  '@forge/dashboards-bridge': 'node_modules/@forge/dashboards-bridge/out/index.js',
  '@forge/llm': 'node_modules/@forge/llm/out/index.js',
  '@forge/realtime': 'node_modules/@forge/realtime/out/index.js',
  '@forge/object-store': 'node_modules/@forge/object-store/out/index.js',
};

/**
 * Symbols excluded from the assignability probe, with reasons. These are NOT
 * "the types don't match yet" parking spots — each is either a deliberate
 * behavioral deviation or an upstream typing artifact we can't express.
 */
const REALTIME_ERRORS_REASON =
  "Upstream's own typings disagree with their docs: @forge/bridge/realtime " +
  'declares errors?: string[] and @forge/realtime infers errors: any, but the ' +
  'Forge realtime docs show { message } objects — which the doc-parity suite ' +
  '(#11, v0.1.19) matched at runtime. Wire format is still Atlassian preview; ' +
  'revisit at realtime GA.';

const TYPE_DEVIATIONS: Record<string, Record<string, string>> = {
  '@forge/events': {
    Queue:
      'Real Queue has private fields (queueParams, apiClient), making the class ' +
      'nominally typed — no structural shim can satisfy it. Public surface ' +
      '(push/getJob/cancel/getStats) is mirrored and covered by queue tests.',
    JobProgress:
      'Same nominal-typing problem as Queue (private queueParams/apiClient/id).',
    QueueResponse:
      'Real QueueResponse extends an unexported Response base with a protected ' +
      '_retry field — nominal. Runtime behavior (retry() flipping the flag) is ' +
      'pinned as quirk events-queue-response-retry-flag; see the index in ' +
      'shim-contract-quirks.test.ts.',
    InvocationError:
      'Same nominal-typing problem as QueueResponse (protected _retry on the ' +
      'unexported Response base).',
    InvocationErrorCode:
      'Real is a TS enum (enum member types are nominal); the shim ships a ' +
      'frozen object with the identical runtime values, pinned as quirk ' +
      'events-invocation-error-code-values; see the index in ' +
      'shim-contract-quirks.test.ts.',
  },
  '@forge/llm': {
    stream:
      'Real stream() returns the StreamResponse class, which has private fields ' +
      '(iterator, wrapper) and so is nominally typed. The sim returns a ' +
      'structurally identical AsyncIterable<LlmResponse> with close().',
  },
  '@forge/object-store': {
    objectStore:
      'Real ObjectStoreClient has private members (sendRequest, requestJson), ' +
      'making it nominally typed. The public methods are mirrored and covered ' +
      'by object-store tests.',
  },
  '@forge/kvs': {
    MetadataField:
      'Real is a TS enum (enum member types are nominal); the shim ships a ' +
      'frozen object with the identical runtime values.',
    Sort: 'Same as MetadataField: real is a TS enum, shim ships the identical runtime values.',
    kvs:
      'Real kvs is a KvsImpl instance with a private storageApi field — ' +
      'nominal typing no structural shim can satisfy. The full kvs/entity ' +
      'surface is covered by forge-kvs-shim and entity-store tests.',
    Filter:
      'Real FilterBuilder extends BaseFilter, which has a protected items ' +
      'field — nominal typing no structural shim can satisfy. The builder ' +
      'surface (and/or/filters/operator) is mirrored and covered by ' +
      'entity-store tests.',
  },
  '@forge/realtime': {
    publish: REALTIME_ERRORS_REASON,
    publishGlobal: REALTIME_ERRORS_REASON,
    signRealtimeToken:
      "Upstream's inferred union ({ token: null; expiresAt: null; errors: any } " +
      '| { token: any; expiresAt: any; errors?: undefined }) cannot be ' +
      'satisfied by an honest TokenResult type; runtime shape matches the ' +
      'Forge docs per the doc-parity suite (#11). Revisit at realtime GA.',
  },
  '@forge/bridge/realtime': {
    realtime: REALTIME_ERRORS_REASON,
  },
  '@forge/bridge': {
    realtime: REALTIME_ERRORS_REASON,
    FeatureFlags:
      'Real FeatureFlags has private fields (initialized, evaluator) — nominal ' +
      'typing no structural shim can satisfy. The public surface (initialize/' +
      'checkFlag/shutdown/isInitialized) is mirrored and covered by ' +
      'bridge-features tests.',
  },
};

// ---------------------------------------------------------------------------
// Probe construction
// ---------------------------------------------------------------------------

interface Probe {
  specifier: string;
  path: string;
  text: string;
}

function buildProbes(): Probe[] {
  return [...SHIM_NAMES].map(specifier => {
    const realEntry = REAL_TYPES_ENTRY[specifier];
    // Always excluded, mirroring the surface suite's isContractKey:
    //   - 'default': the real packages are CJS, so TS synthesizes a required
    //     `default` (= the whole module.exports) under Node16 ESM resolution.
    //     Whether a shim should offer a default export is a runtime-interop
    //     question (cf. the @forge/sql CJS facade in the loader).
    //   - '__*': Atlassian-internal exports (e.g. @forge/api's __getRuntime);
    //     apps importing those are off-contract. Enumerated from the real
    //     module at runtime so new internals don't re-enter the contract.
    const internals = Object.keys(loadRealForgePackage(specifier)).filter(k => k.startsWith('__'));
    const deviations = ['default', ...internals, ...Object.keys(TYPE_DEVIATIONS[specifier] ?? {})];
    const contractType = `Omit<Real, ${deviations.map(d => JSON.stringify(d)).join(' | ')}>`;
    const slug = shimFileBase(specifier);
    // Probe files live (virtually) in a repo-root subdirectory so plain
    // relative specifiers reach both src/ and node_modules/.
    const text = [
      `import * as shim from '../src/shims/${slug}.js';`,
      `import type * as RealNS from '../${realEntry}';`,
      `type Real = typeof RealNS;`,
      `const contract: ${contractType} = shim;`,
      `void contract;`,
      `export {};`,
    ].join('\n');
    return { specifier, path: `${REPO_ROOT}/__shim_contracts__/${slug}.mts`, text };
  });
}

// Mirrors the root tsconfig (strict, Node16) minus emit concerns. No `paths`:
// probes must resolve everything by real file path.
const COMPILER_OPTIONS: ts.CompilerOptions = {
  strict: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.Node16,
  moduleResolution: ts.ModuleResolutionKind.Node16,
  esModuleInterop: true,
  jsx: ts.JsxEmit.ReactJSX,
  noEmit: true,
  skipLibCheck: true,
  types: ['node'],
};

function createProgram(probes: Probe[]): ts.Program {
  const byPath = new Map(probes.map(p => [p.path, p]));
  const host = ts.createCompilerHost(COMPILER_OPTIONS);
  const realGetSourceFile = host.getSourceFile.bind(host);
  const realReadFile = host.readFile.bind(host);
  const realFileExists = host.fileExists.bind(host);

  host.getSourceFile = (fileName, languageVersion, ...rest) => {
    const probe = byPath.get(fileName);
    if (probe) return ts.createSourceFile(fileName, probe.text, languageVersion, true);
    return realGetSourceFile(fileName, languageVersion, ...rest);
  };
  host.readFile = fileName => byPath.get(fileName)?.text ?? realReadFile(fileName);
  host.fileExists = fileName => byPath.has(fileName) || realFileExists(fileName);

  return ts.createProgram(probes.map(p => p.path), COMPILER_OPTIONS, host);
}

function diagnosticsFor(program: ts.Program, probe: Probe): string[] {
  const sf = program.getSourceFile(probe.path);
  if (!sf) return [`internal: probe source file missing for ${probe.specifier}`];
  const diags = [...program.getSyntacticDiagnostics(sf), ...program.getSemanticDiagnostics(sf)];
  return diags.map(d => `TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const probes = buildProbes();

describe('shim type-shape contract (#10)', () => {
  let program: ts.Program;

  beforeAll(() => {
    program = createProgram(probes);
  }, 120_000);

  it('every shim has a registered real-typings entry', () => {
    const missing = SHIM_NAMES.filter(name => !REAL_TYPES_ENTRY[name]);
    expect(
      missing,
      `shims with no typings entry in REAL_TYPES_ENTRY: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it.each(probes.map(p => [p.specifier, p] as const))(
    '%s shim is assignable to the real package typings',
    (_specifier, probe) => {
      const errors = diagnosticsFor(program, probe);
      expect(
        errors,
        `shim for ${probe.specifier} does not satisfy the real typings:\n${errors.join('\n')}\n` +
          `Fix the shim signature, or add a per-symbol entry to TYPE_DEVIATIONS with a reason.`,
      ).toEqual([]);
    },
  );
});
