/**
 * Renderer materialization — installed npm packages copy the renderer to a
 * user-level version-keyed directory (outside node_modules, where Vite's
 * dep optimizer can pre-bundle the Atlaskit graph) and `npm ci` the locked
 * dependency tree there. Git checkouts keep the original in-place install.
 *
 * Covers B1 from the sprint-pulse competitive eval (2026-07-16): the
 * published 0.1.0 browser preview was structurally broken because renderer
 * sources lived under node_modules and the in-place `npm install` ERESOLVEd.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
  readdirSync,
  utimesSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isInstalledPackage, materializeRenderer } from '../renderer-deps.js';

const quietLogger = { log: () => {}, error: () => {} };

let cleanups: string[] = [];
afterEach(() => {
  for (const dir of cleanups) rmSync(dir, { recursive: true, force: true });
  cleanups = [];
});

/**
 * Build a fake INSTALLED forge-sim package: a directory whose path contains
 * a node_modules segment, with package.json (version) and renderer sources
 * (src/, package.json, package-lock.json).
 */
function makeInstalledPackage(opts: { version?: string; lockfile?: boolean } = {}): {
  forgeSimRoot: string;
  scratch: string;
} {
  const scratch = mkdtempSync(join(tmpdir(), 'forge-sim-materialize-'));
  cleanups.push(scratch);
  const forgeSimRoot = join(scratch, 'app', 'node_modules', 'forge-sim');
  const rendererDir = join(forgeSimRoot, 'renderer');
  mkdirSync(join(rendererDir, 'src', 'bridge'), { recursive: true });
  writeFileSync(
    join(forgeSimRoot, 'package.json'),
    JSON.stringify({ name: 'forge-sim', version: opts.version ?? '0.1.1' })
  );
  writeFileSync(
    join(rendererDir, 'package.json'),
    JSON.stringify({ name: 'forge-sim-renderer', dependencies: { '@atlaskit/button': '^1.0.0' } })
  );
  if (opts.lockfile !== false) {
    writeFileSync(
      join(rendererDir, 'package-lock.json'),
      JSON.stringify({ name: 'forge-sim-renderer', lockfileVersion: 3 })
    );
  }
  writeFileSync(join(rendererDir, 'src', 'ForgeSimShell.tsx'), '// shell');
  writeFileSync(join(rendererDir, 'src', 'bridge', 'forge-bridge-shim.ts'), '// shim');
  return { forgeSimRoot, scratch };
}

/** A fake installer that simulates npm ci creating the dep tree. */
function fakeInstall(dir: string): number {
  const depDir = join(dir, 'node_modules', '@atlaskit/button');
  mkdirSync(depDir, { recursive: true });
  writeFileSync(join(depDir, 'package.json'), '{}');
  return 0;
}

function makeBaseDir(): string {
  const base = mkdtempSync(join(tmpdir(), 'forge-sim-renderer-base-'));
  cleanups.push(base);
  return base;
}

describe('isInstalledPackage', () => {
  it('detects a node_modules path segment', () => {
    expect(isInstalledPackage('/home/u/app/node_modules/forge-sim')).toBe(true);
    expect(isInstalledPackage('/home/u/projects/forge-sim')).toBe(false);
  });

  it('does not false-positive on names merely containing node_modules', () => {
    expect(isInstalledPackage('/home/u/my-node_modules-notes/forge-sim')).toBe(false);
  });
});

describe('materializeRenderer — git checkout mode', () => {
  it('returns <root>/renderer and installs in place when deps are missing', () => {
    // A checkout: path has no node_modules segment.
    const root = mkdtempSync(join(tmpdir(), 'forge-sim-checkout-'));
    cleanups.push(root);
    const rendererDir = join(root, 'renderer');
    mkdirSync(rendererDir, { recursive: true });
    writeFileSync(
      join(rendererDir, 'package.json'),
      JSON.stringify({ name: 'r', dependencies: { '@atlaskit/button': '^1.0.0' } })
    );

    let installDir = '';
    const result = materializeRenderer(root, {
      logger: quietLogger,
      install: (dir) => {
        installDir = dir;
        return fakeInstall(dir);
      },
    });
    expect(result).toBe(rendererDir);
    expect(installDir).toBe(rendererDir);
  });

  it('is a no-op for a complete checkout', () => {
    const root = mkdtempSync(join(tmpdir(), 'forge-sim-checkout-'));
    cleanups.push(root);
    const rendererDir = join(root, 'renderer');
    const depDir = join(rendererDir, 'node_modules', '@atlaskit/button');
    mkdirSync(depDir, { recursive: true });
    writeFileSync(
      join(rendererDir, 'package.json'),
      JSON.stringify({ name: 'r', dependencies: { '@atlaskit/button': '^1.0.0' } })
    );
    writeFileSync(join(depDir, 'package.json'), '{}');

    let installCalled = false;
    const result = materializeRenderer(root, {
      logger: quietLogger,
      install: () => {
        installCalled = true;
        return 0;
      },
    });
    expect(result).toBe(rendererDir);
    expect(installCalled).toBe(false);
  });
});

describe('materializeRenderer — installed package mode', () => {
  it('materializes to <baseDir>/<version> with sources, lockfile, and .npmrc', () => {
    const { forgeSimRoot } = makeInstalledPackage({ version: '0.1.1' });
    const baseDir = makeBaseDir();

    let installDir = '';
    const result = materializeRenderer(forgeSimRoot, {
      logger: quietLogger,
      baseDir,
      install: (dir) => {
        installDir = dir;
        // At install time: sources + lockfile + .npmrc must already be there
        expect(existsSync(join(dir, 'src', 'ForgeSimShell.tsx'))).toBe(true);
        expect(existsSync(join(dir, 'package-lock.json'))).toBe(true);
        expect(readFileSync(join(dir, '.npmrc'), 'utf8')).toContain('legacy-peer-deps=true');
        return fakeInstall(dir);
      },
    });

    const target = join(baseDir, '0.1.1');
    expect(result).toBe(target);
    // Install ran in the temp dir, then the dir was renamed into place
    expect(installDir).not.toBe(target);
    expect(installDir.includes('.tmp-')).toBe(true);
    expect(existsSync(join(target, 'src', 'bridge', 'forge-bridge-shim.ts'))).toBe(true);
    expect(existsSync(join(target, 'node_modules', '@atlaskit/button', 'package.json'))).toBe(true);
    // No leftover temp dirs
    expect(readdirSync(baseDir).filter((e) => e.startsWith('.tmp-'))).toEqual([]);
    // The materialized path must NOT be under node_modules (Vite optimizer)
    expect(isInstalledPackage(target)).toBe(false);
  });

  it('warm path: returns immediately without installing when complete', () => {
    const { forgeSimRoot } = makeInstalledPackage({ version: '0.1.1' });
    const baseDir = makeBaseDir();
    materializeRenderer(forgeSimRoot, { logger: quietLogger, baseDir, install: fakeInstall });

    let installCalled = false;
    const result = materializeRenderer(forgeSimRoot, {
      logger: quietLogger,
      baseDir,
      install: () => {
        installCalled = true;
        return 0;
      },
    });
    expect(result).toBe(join(baseDir, '0.1.1'));
    expect(installCalled).toBe(false);
  });

  it('throws loudly with exit code + retry command when npm fails, leaving the temp dir for retry', () => {
    const { forgeSimRoot } = makeInstalledPackage();
    const baseDir = makeBaseDir();

    expect(() =>
      materializeRenderer(forgeSimRoot, { logger: quietLogger, baseDir, install: () => 1 })
    ).toThrow(/npm exited with code 1[\s\S]*network or registry error[\s\S]*npm ci --omit=dev/);

    // Temp dir stays so the user can retry manually per the error message
    expect(readdirSync(baseDir).some((e) => e.startsWith('.tmp-'))).toBe(true);
    // No half-baked target dir
    expect(existsSync(join(baseDir, '0.1.1'))).toBe(false);
  });

  it('throws when install "succeeds" but deps are still missing', () => {
    const { forgeSimRoot } = makeInstalledPackage();
    const baseDir = makeBaseDir();
    expect(() =>
      materializeRenderer(forgeSimRoot, { logger: quietLogger, baseDir, install: () => 0 })
    ).toThrow(/still missing after install: @atlaskit\/button/);
  });

  it('survives losing a concurrent-install race (uses the winner, discards own tmp)', () => {
    const { forgeSimRoot } = makeInstalledPackage({ version: '0.1.1' });
    const baseDir = makeBaseDir();
    const target = join(baseDir, '0.1.1');

    const result = materializeRenderer(forgeSimRoot, {
      logger: quietLogger,
      baseDir,
      install: (dir) => {
        // Simulate another process completing the install first
        const winnerDep = join(target, 'node_modules', '@atlaskit/button');
        mkdirSync(winnerDep, { recursive: true });
        writeFileSync(
          join(target, 'package.json'),
          JSON.stringify({ name: 'forge-sim-renderer', dependencies: { '@atlaskit/button': '^1.0.0' } })
        );
        writeFileSync(join(winnerDep, 'package.json'), '{}');
        return fakeInstall(dir);
      },
    });

    expect(result).toBe(target);
    expect(readdirSync(baseDir).filter((e) => e.startsWith('.tmp-'))).toEqual([]);
  });

  it('prunes old version dirs and stale temp dirs, but spares fresh temp dirs and unrelated entries', () => {
    const { forgeSimRoot } = makeInstalledPackage({ version: '0.1.1' });
    const baseDir = makeBaseDir();
    // Old version dir → pruned
    const oldVersion = join(baseDir, '0.1.0');
    mkdirSync(join(oldVersion, 'node_modules'), { recursive: true });
    // Fresh tmp dir (simulating a live concurrent install) → spared
    const freshTmp = join(baseDir, '.tmp-0.1.1-4242');
    mkdirSync(freshTmp, { recursive: true });
    // Stale tmp dir (>24h old, crashed install) → pruned
    const staleTmp = join(baseDir, '.tmp-0.0.9-1');
    mkdirSync(staleTmp, { recursive: true });
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000);
    utimesSync(staleTmp, old, old);
    // Non-version, non-tmp entry (user file in an overridden dir) → spared
    const unrelated = join(baseDir, 'my-notes');
    mkdirSync(unrelated, { recursive: true });

    materializeRenderer(forgeSimRoot, { logger: quietLogger, baseDir, install: fakeInstall });

    expect(existsSync(oldVersion)).toBe(false);
    expect(existsSync(staleTmp)).toBe(false);
    expect(existsSync(freshTmp)).toBe(true);
    expect(existsSync(unrelated)).toBe(true);
  });

  it('respects the FORGE_SIM_RENDERER_DIR override', () => {
    const { forgeSimRoot } = makeInstalledPackage({ version: '0.1.1' });
    const baseDir = makeBaseDir();

    const prevEnv = process.env.FORGE_SIM_RENDERER_DIR;
    process.env.FORGE_SIM_RENDERER_DIR = baseDir;
    try {
      const result = materializeRenderer(forgeSimRoot, {
        logger: quietLogger,
        install: fakeInstall,
      });
      expect(result).toBe(join(baseDir, '0.1.1'));
      expect(existsSync(join(baseDir, '0.1.1', 'src', 'ForgeSimShell.tsx'))).toBe(true);
    } finally {
      if (prevEnv === undefined) delete process.env.FORGE_SIM_RENDERER_DIR;
      else process.env.FORGE_SIM_RENDERER_DIR = prevEnv;
    }
  });

  it('announces the install destination path', () => {
    const { forgeSimRoot } = makeInstalledPackage({ version: '0.1.1' });
    const baseDir = makeBaseDir();
    const lines: string[] = [];
    materializeRenderer(forgeSimRoot, {
      logger: { log: (msg?: any) => lines.push(String(msg ?? '')), error: () => {} },
      baseDir,
      install: fakeInstall,
    });
    const announced = lines.join('\n');
    expect(announced).toContain('installing the UI renderer to');
    expect(announced).toContain(join(baseDir, '0.1.1'));
  });

  it('throws a corrupted-package error when renderer sources are absent', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'forge-sim-materialize-'));
    cleanups.push(scratch);
    const forgeSimRoot = join(scratch, 'node_modules', 'forge-sim');
    mkdirSync(forgeSimRoot, { recursive: true });
    writeFileSync(join(forgeSimRoot, 'package.json'), JSON.stringify({ version: '0.1.1' }));

    expect(() =>
      materializeRenderer(forgeSimRoot, { logger: quietLogger, baseDir: makeBaseDir(), install: () => 0 })
    ).toThrow(/does not contain renderer sources/);
  });
});
