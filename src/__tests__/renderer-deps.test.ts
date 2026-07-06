/**
 * Lazy renderer-deps installation — `forge-sim dev` installs the Atlaskit
 * packages into renderer/node_modules on first run, since npm strips nested
 * node_modules from published tarballs.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { missingRendererDeps, ensureRendererDeps } from '../renderer-deps.js';

const REAL_FORGE_SIM_ROOT = join(__dirname, '..', '..');

/** Build a fake forge-sim root with a renderer/package.json. */
function makeFakeRoot(deps: Record<string, string>, installed: string[] = []): string {
  const root = mkdtempSync(join(tmpdir(), 'forge-sim-renderer-deps-'));
  const rendererDir = join(root, 'renderer');
  mkdirSync(rendererDir, { recursive: true });
  writeFileSync(
    join(rendererDir, 'package.json'),
    JSON.stringify({ name: 'forge-sim-renderer', dependencies: deps })
  );
  for (const dep of installed) {
    const depDir = join(rendererDir, 'node_modules', dep);
    mkdirSync(depDir, { recursive: true });
    writeFileSync(join(depDir, 'package.json'), JSON.stringify({ name: dep }));
  }
  return root;
}

const quietLogger = { log: () => {}, error: () => {} };

describe('missingRendererDeps', () => {
  let roots: string[] = [];
  afterEach(() => {
    for (const r of roots) rmSync(r, { recursive: true, force: true });
    roots = [];
  });

  it('lists dependencies with no node_modules at all', () => {
    const root = makeFakeRoot({ '@atlaskit/button': '^1.0.0', react: '^18.0.0' });
    roots.push(root);
    expect(missingRendererDeps(root).sort()).toEqual(['@atlaskit/button', 'react']);
  });

  it('detects a partial install', () => {
    const root = makeFakeRoot(
      { '@atlaskit/button': '^1.0.0', '@atlaskit/badge': '^1.0.0' },
      ['@atlaskit/badge']
    );
    roots.push(root);
    expect(missingRendererDeps(root)).toEqual(['@atlaskit/button']);
  });

  it('returns [] when everything is installed', () => {
    const root = makeFakeRoot({ '@atlaskit/button': '^1.0.0' }, ['@atlaskit/button']);
    roots.push(root);
    expect(missingRendererDeps(root)).toEqual([]);
  });

  it('returns [] when renderer/package.json is absent', () => {
    const root = mkdtempSync(join(tmpdir(), 'forge-sim-renderer-deps-'));
    roots.push(root);
    expect(missingRendererDeps(root)).toEqual([]);
  });

  it('sees the real repo checkout as fully installed (no-op on every dev run)', () => {
    // Guards the common path: a repo checkout (and any post-install run)
    // must never trigger a reinstall.
    expect(missingRendererDeps(REAL_FORGE_SIM_ROOT)).toEqual([]);
  });
});

describe('ensureRendererDeps', () => {
  let roots: string[] = [];
  afterEach(() => {
    for (const r of roots) rmSync(r, { recursive: true, force: true });
    roots = [];
  });

  it('is a no-op when deps are present', () => {
    const root = makeFakeRoot({ '@atlaskit/button': '^1.0.0' }, ['@atlaskit/button']);
    roots.push(root);
    let installCalled = false;
    const result = ensureRendererDeps(root, {
      logger: quietLogger,
      install: () => { installCalled = true; return 0; },
    });
    expect(result.installed).toBe(false);
    expect(installCalled).toBe(false);
  });

  it('runs the installer in the renderer dir when deps are missing', () => {
    const root = makeFakeRoot({ '@atlaskit/button': '^1.0.0' });
    roots.push(root);
    let installDir = '';
    const result = ensureRendererDeps(root, {
      logger: quietLogger,
      install: (dir) => {
        installDir = dir;
        // simulate npm creating the package
        const depDir = join(dir, 'node_modules', '@atlaskit/button');
        mkdirSync(depDir, { recursive: true });
        writeFileSync(join(depDir, 'package.json'), '{}');
        return 0;
      },
    });
    expect(installDir).toBe(join(root, 'renderer'));
    expect(result.installed).toBe(true);
    expect(result.missing).toEqual(['@atlaskit/button']);
  });

  it('throws with manual-install guidance when npm exits non-zero', () => {
    const root = makeFakeRoot({ '@atlaskit/button': '^1.0.0' });
    roots.push(root);
    expect(() =>
      ensureRendererDeps(root, { logger: quietLogger, install: () => 1 })
    ).toThrow(/npm exited with code 1[\s\S]*npm install --prefix/);
  });

  it('throws when the install "succeeds" but deps are still missing', () => {
    const root = makeFakeRoot({ '@atlaskit/button': '^1.0.0' });
    roots.push(root);
    expect(() =>
      ensureRendererDeps(root, { logger: quietLogger, install: () => 0 })
    ).toThrow(/Still missing: @atlaskit\/button/);
  });
});
