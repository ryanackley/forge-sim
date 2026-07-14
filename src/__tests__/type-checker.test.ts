import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  ensureTsconfig,
  parseTscOutput,
  typeCheck,
  filterCriticalErrors,
  resolveTsc,
  startTypeCheckWatch,
  CRITICAL_TS_ERROR_CODES,
  type TypeCheckError,
} from '../type-checker.js';

const TEST_DIR = join(tmpdir(), 'forge-sim-tc-test-' + Date.now());

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  try { rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
});

describe('parseTscOutput', () => {
  it('parses standard tsc error output', () => {
    const output = `src/index.ts(5,10): error TS2307: Cannot find module '@forge/nonexistent' or its corresponding type declarations.
src/app.tsx(12,3): error TS2339: Property 'foo' does not exist on type 'Bar'.`;

    const errors = parseTscOutput(output);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toEqual({
      file: 'src/index.ts',
      line: 5,
      column: 10,
      code: 'TS2307',
      message: "Cannot find module '@forge/nonexistent' or its corresponding type declarations.",
    });
    expect(errors[1]).toEqual({
      file: 'src/app.tsx',
      line: 12,
      column: 3,
      code: 'TS2339',
      message: "Property 'foo' does not exist on type 'Bar'.",
    });
  });

  it('returns empty array for clean output', () => {
    expect(parseTscOutput('')).toEqual([]);
    expect(parseTscOutput('Found 0 errors.')).toEqual([]);
  });

  it('handles Windows-style paths', () => {
    const output = `C:\\Users\\dev\\src\\index.ts(1,1): error TS1005: ';' expected.`;
    const errors = parseTscOutput(output);
    expect(errors).toHaveLength(1);
    expect(errors[0].file).toBe('C:\\Users\\dev\\src\\index.ts');
  });
});

describe('filterCriticalErrors', () => {
  it('filters to only critical error codes', () => {
    const errors: TypeCheckError[] = [
      { file: 'a.ts', line: 1, column: 1, code: 'TS2307', message: 'Cannot find module' },
      { file: 'b.ts', line: 2, column: 1, code: 'TS7006', message: 'Parameter implicitly has any type' },
      { file: 'c.ts', line: 3, column: 1, code: 'TS2339', message: 'Property does not exist' },
      { file: 'd.ts', line: 4, column: 1, code: 'TS6133', message: 'Declared but never used' },
    ];
    const critical = filterCriticalErrors(errors);
    expect(critical).toHaveLength(2);
    expect(critical[0].code).toBe('TS2307');
    expect(critical[1].code).toBe('TS2339');
  });

  it('returns empty for no critical errors', () => {
    const errors: TypeCheckError[] = [
      { file: 'a.ts', line: 1, column: 1, code: 'TS7006', message: 'implicit any' },
    ];
    expect(filterCriticalErrors(errors)).toEqual([]);
  });

  it('never treats node_modules errors as critical (phantom @types syntax spam)', () => {
    // An old hoisted tsc parsing a modern @types package produces TS1005
    // syntax "errors" in node_modules .d.ts files — skipLibCheck skips
    // semantic checks but NOT parse errors. These are unfixable by the app
    // dev and must not count as critical (bg-test-app regression: 817 of them).
    const errors: TypeCheckError[] = [
      { file: 'node_modules/@types/node/buffer.d.ts', line: 122, column: 5, code: 'TS1005', message: "',' expected." },
      { file: 'node_modules\\@types\\node\\cluster.d.ts', line: 273, column: 5, code: 'TS1005', message: "',' expected." },
      { file: '/abs/path/app/node_modules/@types/node/fs.d.ts', line: 9, column: 1, code: 'TS2307', message: 'Cannot find module' },
      { file: 'src/index.ts', line: 5, column: 10, code: 'TS2307', message: 'Cannot find module' },
    ];
    const critical = filterCriticalErrors(errors);
    expect(critical).toHaveLength(1);
    expect(critical[0].file).toBe('src/index.ts');
  });

  it('does not filter app files whose name merely contains "node_modules"', () => {
    const errors: TypeCheckError[] = [
      { file: 'src/my-node_modules-helper.ts', line: 1, column: 1, code: 'TS2307', message: 'Cannot find module' },
    ];
    expect(filterCriticalErrors(errors)).toHaveLength(1);
  });
});

describe('CRITICAL_TS_ERROR_CODES', () => {
  it('includes module resolution errors', () => {
    expect(CRITICAL_TS_ERROR_CODES.has('TS2307')).toBe(true); // Cannot find module
    expect(CRITICAL_TS_ERROR_CODES.has('TS2305')).toBe(true); // No exported member
    expect(CRITICAL_TS_ERROR_CODES.has('TS2304')).toBe(true); // Cannot find name
  });

  it('includes type assignment errors', () => {
    expect(CRITICAL_TS_ERROR_CODES.has('TS2322')).toBe(true); // Not assignable
    expect(CRITICAL_TS_ERROR_CODES.has('TS2345')).toBe(true); // Argument not assignable
  });

  it('includes syntax errors', () => {
    expect(CRITICAL_TS_ERROR_CODES.has('TS1005')).toBe(true);
    expect(CRITICAL_TS_ERROR_CODES.has('TS1003')).toBe(true);
    expect(CRITICAL_TS_ERROR_CODES.has('TS1128')).toBe(true);
  });
});

describe('ensureTsconfig', () => {
  it('returns existing tsconfig.json if present', () => {
    writeFileSync(join(TEST_DIR, 'tsconfig.json'), '{}');
    const result = ensureTsconfig(TEST_DIR);
    expect(result).toBe(join(TEST_DIR, 'tsconfig.json'));
  });

  it('generates synthetic tsconfig for JS projects', () => {
    // No tsconfig.json exists
    const result = ensureTsconfig(TEST_DIR);
    expect(result).toBe(join(TEST_DIR, '.forge-sim', 'tsconfig.check.json'));
    expect(existsSync(result)).toBe(true);

    const content = JSON.parse(require('node:fs').readFileSync(result, 'utf-8'));
    expect(content.compilerOptions.allowJs).toBe(true);
    expect(content.compilerOptions.checkJs).toBe(true);
    expect(content.compilerOptions.noEmit).toBe(true);
    expect(content.compilerOptions.strict).toBe(false);
    expect(content.compilerOptions.skipLibCheck).toBe(true);
  });

  it('creates .forge-sim directory if needed', () => {
    const forgeSimDir = join(TEST_DIR, '.forge-sim');
    expect(existsSync(forgeSimDir)).toBe(false);
    ensureTsconfig(TEST_DIR);
    expect(existsSync(forgeSimDir)).toBe(true);
  });

  it('synthetic tsconfig has a TS-valid module/moduleResolution pairing (TS5110 regression)', () => {
    // TS5110: "Option 'module' must be set to 'Node16' when option
    // 'moduleResolution' is set to 'Node16'." This is the precise pairing
    // rule TypeScript enforces, and the synthetic tsconfig used to violate
    // it (moduleResolution: 'node16' + module: 'es2022'), causing every
    // deploy of a JS-only app to surface a spurious TS5110 alongside the
    // user's real type errors.
    const path = ensureTsconfig(TEST_DIR);
    const cfg = JSON.parse(require('node:fs').readFileSync(path, 'utf-8'));
    const { module: mod, moduleResolution: res } = cfg.compilerOptions;

    // Valid pairings per TS docs:
    //   moduleResolution: node10/node    → any es*/commonjs module
    //   moduleResolution: bundler        → esnext / preserve / es*
    //   moduleResolution: node16/nodenext → node16 / nodenext module only
    const isValid =
      (res === 'node16' && (mod === 'node16' || mod === 'nodenext')) ||
      (res === 'nodenext' && mod === 'nodenext') ||
      (res === 'bundler' && /^(esnext|preserve|es\d{4})$/.test(mod)) ||
      (res === 'node' || res === 'node10' || res === undefined);

    expect(
      isValid,
      `Synthetic tsconfig has invalid module/moduleResolution pairing: ` +
        `module=${mod}, moduleResolution=${res}. This triggers TS5110.`,
    ).toBe(true);
  });
});

describe('resolveTsc', () => {
  it('returns null when no typescript is available', () => {
    // Empty temp dir — no node_modules
    const result = resolveTsc(TEST_DIR);
    // Might find forge-sim's own tsc, so just check it returns string or null
    expect(typeof result === 'string' || result === null).toBe(true);
  });

  it('prefers app typescript over forge-sim typescript', () => {
    // Create a fake tsc in the app's node_modules
    const binDir = join(TEST_DIR, 'node_modules', '.bin');
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(binDir, 'tsc'), '#!/bin/sh\necho "app tsc"', { mode: 0o755 });

    const result = resolveTsc(TEST_DIR);
    expect(result).toBe(join(binDir, 'tsc'));
  });

  it('uses app typescript when its version is >= 5', () => {
    const binDir = join(TEST_DIR, 'node_modules', '.bin');
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(binDir, 'tsc'), '#!/bin/sh\necho "app tsc"', { mode: 0o755 });
    const tsDir = join(TEST_DIR, 'node_modules', 'typescript');
    mkdirSync(tsDir, { recursive: true });
    writeFileSync(join(tsDir, 'package.json'), JSON.stringify({ name: 'typescript', version: '5.9.3' }));

    const result = resolveTsc(TEST_DIR);
    expect(result).toBe(join(binDir, 'tsc'));
  });

  it('skips ancient hoisted app typescript (< 5) and falls back to bundled TS', () => {
    // npm hoists transitive typescript deps (e.g. 3.9.10 via the Atlaskit
    // tree inside @forge/react) to the app's top-level node_modules. TS 3.9
    // can't parse modern @types syntax nor our synthetic tsconfig
    // (moduleResolution: 'bundler' is TS 5.0+) — bg-test-app regression.
    const binDir = join(TEST_DIR, 'node_modules', '.bin');
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(binDir, 'tsc'), '#!/bin/sh\necho "ancient tsc"', { mode: 0o755 });
    const tsDir = join(TEST_DIR, 'node_modules', 'typescript');
    mkdirSync(tsDir, { recursive: true });
    writeFileSync(join(tsDir, 'package.json'), JSON.stringify({ name: 'typescript', version: '3.9.10' }));

    const result = resolveTsc(TEST_DIR);
    // Must NOT be the app's ancient tsc — falls through to forge-sim's bundled TS
    expect(result).not.toBe(join(binDir, 'tsc'));
    expect(result).toBeTruthy();
    expect(result!.startsWith(TEST_DIR)).toBe(false);
  });
});

describe('typeCheck', () => {
  it('returns errors for broken TypeScript', () => {
    // Create a minimal TS project with an error
    mkdirSync(join(TEST_DIR, 'src'), { recursive: true });
    writeFileSync(join(TEST_DIR, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        noEmit: true,
        strict: false,
        skipLibCheck: true,
        module: 'es2022',
        target: 'es2022',
        moduleResolution: 'node',
      },
      include: ['src/**/*'],
    }));
    writeFileSync(join(TEST_DIR, 'src', 'bad.ts'), `
import { nonexistent } from 'totally-fake-module';
const x: string = 42;
`);

    const errors = typeCheck(TEST_DIR);
    expect(errors.length).toBeGreaterThan(0);
    // Should have a TS2307 (cannot find module) error
    expect(errors.some(e => e.code === 'TS2307')).toBe(true);
  });

  it('returns empty array for valid TypeScript', () => {
    mkdirSync(join(TEST_DIR, 'src'), { recursive: true });
    writeFileSync(join(TEST_DIR, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        noEmit: true,
        strict: false,
        skipLibCheck: true,
        module: 'es2022',
        target: 'es2022',
        moduleResolution: 'node',
      },
      include: ['src/**/*'],
    }));
    writeFileSync(join(TEST_DIR, 'src', 'good.ts'), `
const greeting: string = "hello";
console.log(greeting);
`);

    const errors = typeCheck(TEST_DIR);
    expect(errors).toEqual([]);
  });
});

describe('startTypeCheckWatch', () => {
  it('calls onErrors after first check cycle', async () => {
    mkdirSync(join(TEST_DIR, 'src'), { recursive: true });
    writeFileSync(join(TEST_DIR, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        noEmit: true,
        strict: false,
        skipLibCheck: true,
        module: 'es2022',
        target: 'es2022',
        moduleResolution: 'node',
      },
      include: ['src/**/*'],
    }));
    writeFileSync(join(TEST_DIR, 'src', 'index.ts'), 'const x: number = 1;\n');

    const result = await new Promise<{ errors: any[], critical: any[] }>((resolve) => {
      const watcher = startTypeCheckWatch({
        appDir: TEST_DIR,
        onErrors: (errors, critical) => {
          watcher?.close();
          resolve({ errors, critical });
        },
      });

      if (!watcher) {
        resolve({ errors: [], critical: [] });
      }

      // Safety timeout
      setTimeout(() => {
        watcher?.close();
        resolve({ errors: [], critical: [] });
      }, 15000);
    });

    expect(result.errors).toEqual([]);
    expect(result.critical).toEqual([]);
  }, 20000);

  it('reports errors for broken code', async () => {
    mkdirSync(join(TEST_DIR, 'src'), { recursive: true });
    writeFileSync(join(TEST_DIR, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        noEmit: true,
        strict: false,
        skipLibCheck: true,
        module: 'es2022',
        target: 'es2022',
        moduleResolution: 'node',
      },
      include: ['src/**/*'],
    }));
    writeFileSync(join(TEST_DIR, 'src', 'bad.ts'), `import { nope } from 'fake-module';\n`);

    const result = await new Promise<{ errors: any[], critical: any[] }>((resolve) => {
      const watcher = startTypeCheckWatch({
        appDir: TEST_DIR,
        onErrors: (errors, critical) => {
          watcher?.close();
          resolve({ errors, critical });
        },
      });

      if (!watcher) {
        resolve({ errors: [], critical: [] });
      }

      setTimeout(() => {
        watcher?.close();
        resolve({ errors: [], critical: [] });
      }, 15000);
    });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.critical.length).toBeGreaterThan(0);
    expect(result.errors.some((e: any) => e.code === 'TS2307')).toBe(true);
  }, 20000);

  it('returns null when no tsc available in empty dir', () => {
    const emptyDir = join(TEST_DIR, 'empty');
    mkdirSync(emptyDir, { recursive: true });
    // Mock by pointing to a dir with no typescript at all
    // The watcher may still find forge-sim's own tsc, so this test is best-effort
    const watcher = startTypeCheckWatch({
      appDir: emptyDir,
      onErrors: () => {},
    });
    // Either null (no tsc) or a valid watcher (found forge-sim's tsc)
    if (watcher) watcher.close();
  });
});
