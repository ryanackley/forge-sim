/**
 * The backend seam registry (src/runtime/seam-registry.ts) is the one place
 * that knows what the real `@forge/*` packages ask of `global.__forge_fetch__`
 * and `global.__forge_runtime__`. This suite pins it the way
 * `bridge-protocol.test.ts` pins the bridge command registry:
 *
 *  1. The descriptor table covers exactly the `type:` values the INSTALLED
 *     packages can send, and the two indirect call sites are still indirect.
 *  2. The runtime-field table covers exactly the fields they read.
 *  3. Deliberate deviations carry a reason; the scanned packages are pinned to
 *     VERIFIED_FORGE_VERSIONS so this can't drift against an unverified bump.
 *  4. The import-time reads that constrain the whole design are still
 *     import-time.
 *
 * All four derive from `node_modules`, so a package bump that changes the seam
 * fails here rather than surfacing as an `undefined` inside someone's app.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  FETCH_DESCRIPTORS,
  INDIRECT_DESCRIPTOR_BUILDERS,
  RUNTIME_FIELDS,
  SCANNED_PACKAGES,
  isUnroutedDescriptor,
} from '../runtime/seam-registry.js';
import { VERIFIED_FORGE_VERSIONS } from '../forge-package-versions.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

// ── Derivation ─────────────────────────────────────────────────────────────

/** Every shipped .js in a package's out/, excluding its own test fixtures. */
function sourceFiles(pkg: string): string[] {
  const out: string[] = [];
  const root = join(REPO_ROOT, 'node_modules', pkg, 'out');
  if (!existsSync(root)) return out;
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        // Upstream ships its own unit tests; their mocks are not the contract.
        if (entry === '__test__' || entry === '__tests__') continue;
        walk(full);
        continue;
      }
      if (entry.endsWith('.js')) out.push(full);
    }
  };
  walk(root);
  return out;
}

interface Scan {
  descriptors: Set<string>;
  indirect: Set<string>;
  runtimeFields: Set<string>;
}

/**
 * Read the seam usage out of the installed packages.
 *
 * Descriptor types are matched inside any file that mentions the seam or
 * @forge/api's __fetchProduct helper, rather than only on the `__forge_fetch__(`
 * line itself: the frc/fcc literals live in a builder function several lines
 * from the call (endpoint.js:30-43), and the fpp literals live in the
 * __fetchProduct callers (fetch.js:185-207), not at the seam.
 *
 * Runtime fields are matched only through __getRuntime / __forge_runtime__ to
 * avoid picking up unrelated call-then-property chains — `(0, __1.asUser)()
 * .requestJira` in authorization/index.js is not a runtime read.
 */
function scanPackages(): Scan {
  const descriptors = new Set<string>();
  const indirect = new Set<string>();
  const runtimeFields = new Set<string>();

  for (const pkg of SCANNED_PACKAGES) {
    for (const file of sourceFiles(pkg)) {
      const src = readFileSync(file, 'utf8');
      const touchesFetch = /__forge_fetch__|__fetchProduct/.test(src);
      const touchesRuntime = /__getRuntime|__forge_runtime__/.test(src);
      if (!touchesFetch && !touchesRuntime) continue;

      for (const line of src.split('\n')) {
        if (touchesFetch) {
          for (const m of line.matchAll(/type:\s*'([a-z]+)'/g)) descriptors.add(m[1]);
          // A descriptor built elsewhere: `type: args.type`, or a helper call
          // passed straight to the seam.
          for (const m of line.matchAll(/type:\s*([A-Za-z_$][\w.$]*)\s*[,}]/g)) indirect.add(m[1]);
          for (const m of line.matchAll(/__forge_fetch__\(\s*([A-Za-z_$][\w$]*)\(/g)) {
            indirect.add(`call:${m[1]}`);
          }
        }
        if (touchesRuntime) {
          // `const runtime = __getRuntime()` / `global.__forge_runtime__`, then runtime.x / runtime?.x
          for (const m of line.matchAll(/\bruntime\??\.(\w+)/g)) runtimeFields.add(m[1]);
          // Inline: `__getRuntime)().metrics`, `__getRuntime)()?.tracing`
          for (const m of line.matchAll(/__getRuntime\)?\(\)\??\.(\w+)/g)) runtimeFields.add(m[1]);
          // Destructured straight off the call, or off a `runtime` binding.
          // The (?![?.]) guard matters: `const { appCodeDir } =
          // __getRuntime().container` destructures a NESTED object, and
          // counting its keys as top-level fields is exactly the misread that
          // once put appCodeDir in the registry. With the guard, the inline
          // pattern above still credits that line to `container`.
          for (const m of line.matchAll(
            /const\s*\{([^}]+)\}\s*=\s*(?:\(0,\s*)?[\w.]*__getRuntime\)?\(\)(?![?.])/g,
          )) {
            for (const part of m[1].split(',')) {
              const name = part.split(':')[0].trim();
              if (name) runtimeFields.add(name);
            }
          }
          for (const m of line.matchAll(/const\s*\{([^}]+)\}\s*=\s*runtime\s*;/g)) {
            for (const part of m[1].split(',')) {
              const name = part.split(':')[0].trim();
              if (name) runtimeFields.add(name);
            }
          }
        }
      }
    }
  }
  return { descriptors, indirect, runtimeFields };
}

// ── 1. Descriptors vs the installed packages ───────────────────────────────

describe('__forge_fetch__ descriptors vs installed @forge/*', () => {
  it('scans real packages (guards against a silently empty scan)', () => {
    const { descriptors } = scanPackages();
    expect(descriptors.size).toBeGreaterThanOrEqual(9);
  });

  it('lists every descriptor type the packages can send', () => {
    const { descriptors } = scanPackages();
    expect([...descriptors].filter((t) => !(t in FETCH_DESCRIPTORS)).sort()).toEqual([]);
  });

  it('lists nothing the packages never send', () => {
    const { descriptors } = scanPackages();
    expect(Object.keys(FETCH_DESCRIPTORS).filter((t) => !descriptors.has(t)).sort()).toEqual([]);
  });

  it('the indirect call sites are still indirect', () => {
    const { indirect } = scanPackages();
    expect([...indirect].filter((k) => !(k in INDIRECT_DESCRIPTOR_BUILDERS)).sort()).toEqual([]);
    expect(
      Object.keys(INDIRECT_DESCRIPTOR_BUILDERS).filter((k) => !indirect.has(k)).sort(),
    ).toEqual([]);
  });

  it('every unrouted descriptor carries a reason', () => {
    for (const [type, spec] of Object.entries(FETCH_DESCRIPTORS)) {
      if (spec.unrouted !== undefined) expect(spec.unrouted, type).toMatch(/\S/);
      expect(spec.source, type).toMatch(/\.js:/);
    }
  });
});

// ── 2. Runtime fields vs the installed packages ────────────────────────────

describe('__forge_runtime__ fields vs installed @forge/*', () => {
  it('scans real packages (guards against a silently empty scan)', () => {
    const { runtimeFields } = scanPackages();
    expect(runtimeFields.size).toBeGreaterThanOrEqual(11);
  });

  it('lists every field the packages read', () => {
    const { runtimeFields } = scanPackages();
    expect([...runtimeFields].filter((f) => !(f in RUNTIME_FIELDS)).sort()).toEqual([]);
  });

  it('lists nothing the packages never read', () => {
    const { runtimeFields } = scanPackages();
    expect(Object.keys(RUNTIME_FIELDS).filter((f) => !runtimeFields.has(f)).sort()).toEqual([]);
  });

  it('every omitted field explains why, and every reader is a real package', () => {
    for (const [field, spec] of Object.entries(RUNTIME_FIELDS)) {
      if (spec.plan === 'omit' || spec.plan === 'noop') {
        expect(spec.note, field).toMatch(/\S/);
      }
      expect(spec.readers.length, field).toBeGreaterThan(0);
      for (const reader of spec.readers) expect(SCANNED_PACKAGES, field).toContain(reader);
      expect(spec.source, field).toMatch(/\.js:/);
    }
  });
});

// ── 2b. Runtime fields vs the published type definition ────────────────────

/**
 * The scan and the registry can agree and both be wrong: the registry's first
 * version listed `appCodeDir` as a top-level field because the scanner misread
 * `const { appCodeDir } = __getRuntime().container` — and the consistency
 * checks above happily passed, since both sides shared the misreading. The
 * ForgeRuntime type that @forge/api ships is an INDEPENDENT statement of the
 * contract, so every registry key must be one of its top-level keys.
 */
function forgeRuntimeTopLevelKeys(): Set<string> {
  const dts = readFileSync(
    join(REPO_ROOT, 'node_modules/@forge/api/out/api/runtime.d.ts'),
    'utf8',
  );
  const start = dts.indexOf('export type ForgeRuntime = {');
  expect(start, 'ForgeRuntime type literal not found in runtime.d.ts').toBeGreaterThanOrEqual(0);

  const keys = new Set<string>();
  let depth = 0;
  for (const line of dts.slice(start).split('\n')) {
    // Keys at depth 1 are ForgeRuntime's own; deeper ones belong to nested
    // object literals (container.appCodeDir, lambdaContext.awsRequestId, ...).
    if (depth === 1) {
      const m = /^\s*(\w+)\??\s*:/.exec(line);
      if (m) keys.add(m[1]);
    }
    for (const ch of line) {
      if (ch === '{') depth++;
      if (ch === '}') depth--;
    }
    if (depth <= 0 && keys.size > 0) break; // closed the type literal
  }
  return keys;
}

describe('__forge_runtime__ fields vs the ForgeRuntime type (runtime.d.ts)', () => {
  it('parses the type (guards against a silently broken parser)', () => {
    const declared = forgeRuntimeTopLevelKeys();
    expect(declared.size).toBeGreaterThanOrEqual(13);
    expect([...declared]).toContain('proxy');
    expect([...declared]).toContain('featureFlags');
    // Nested keys must NOT leak in — this is the appCodeDir bug's shape.
    expect([...declared]).not.toContain('appCodeDir');
    expect([...declared]).not.toContain('awsRequestId');
  });

  it('every registry field is a declared top-level ForgeRuntime key', () => {
    const declared = forgeRuntimeTopLevelKeys();
    expect(Object.keys(RUNTIME_FIELDS).filter((f) => !declared.has(f)).sort()).toEqual([]);
  });
});

// ── 3. Pinned to the verified package set ──────────────────────────────────

describe('registry is pinned to verified versions', () => {
  it('every package that owns a descriptor is version-pinned', () => {
    for (const [type, spec] of Object.entries(FETCH_DESCRIPTORS)) {
      expect(Object.keys(VERIFIED_FORGE_VERSIONS), type).toContain(spec.owner);
    }
  });

  it('every package that reads the runtime is version-pinned', () => {
    for (const [field, spec] of Object.entries(RUNTIME_FIELDS)) {
      for (const reader of spec.readers) {
        expect(Object.keys(VERIFIED_FORGE_VERSIONS), field).toContain(reader);
      }
    }
  });
});

// ── 4. The import-time reads that constrain the design ─────────────────────

/**
 * `when: 'import'` is the difference between "a getter backed by the invocation
 * store works" and "whatever is visible at import is frozen for the process".
 * It can't be derived from a grep, so it's asserted against the specific code
 * shapes that make it true. If upstream makes one of these lazy, the premise
 * behind the per-invocation runtime design has changed and we want to know.
 */
describe('import-time reads are still import-time', () => {
  const read = (p: string) => readFileSync(join(REPO_ROOT, 'node_modules', p), 'utf8');

  it('@forge/llm reads tracing eagerly, through a throwing __getRuntime()', () => {
    // llm/out/index.js constructs the API at module scope ...
    expect(read('@forge/llm/out/index.js')).toMatch(/const\s+\w+\s*=\s*new\s+\w+\.LlmApiImpl\(\)/);
    // ... which constructs the client as a class field ...
    expect(read('@forge/llm/out/llm-api.js')).toMatch(/llmClient\s*=\s*new\s+\w+\.LlmClientImpl\(\)/);
    // ... whose own class field reads the runtime.
    expect(read('@forge/llm/out/llm-client.js')).toMatch(
      /tracing\s*=\s*\(0,\s*\w+\.__getRuntime\)\(\)\??\.tracing/,
    );
    // And __getRuntime throws rather than returning undefined, so the import
    // fails outright when the global is absent. This is why the runtime global
    // must always resolve to a baseline object.
    expect(read('@forge/api/out/api/runtime.js')).toMatch(
      /if\s*\(!runtime\)\s*\{?\s*throw new Error\('Forge runtime not found\.'\)/,
    );
    expect(RUNTIME_FIELDS.tracing.when).toBe('import');
  });

  it('@forge/kvs picks its fetch client once, at module scope', () => {
    const src = read('@forge/kvs/out/index.js');
    // The branch is taken when the client is built ...
    expect(src).toMatch(/const\s+storageApi\s*=\s*new\s+\w+\.StorageApi\(getFetchClient\(\)\)/);
    // ... gated on kvs.url + kvs.host ...
    expect(src).toMatch(/runtime\?\.kvs\?\.url\s*&&\s*runtime\?\.kvs\?\.host/);
    // ... and the token/trace values are destructured into the closure there,
    // which is what would freeze one invocation's values into every later call.
    expect(src).toMatch(/const\s*\{\s*proxy,\s*kvs,\s*tracing\s*\}\s*=\s*runtime/);
    expect(RUNTIME_FIELDS.kvs.when).toBe('import');
    expect(RUNTIME_FIELDS.kvs.plan).toBe('omit');
    // proxy is required by the ForgeRuntime type, so it's present-but-inert
    // (noop) rather than omitted; the kvs gate is what keeps it unread.
    expect(RUNTIME_FIELDS.proxy.plan).toBe('noop');
  });

  it('the unrouted set is exactly container services (a Forge developer preview)', () => {
    expect(Object.keys(FETCH_DESCRIPTORS).filter(isUnroutedDescriptor).sort()).toEqual(['fcc']);
  });
});
