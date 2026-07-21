/**
 * Cold-start regression tests for `forge-sim dev`.
 *
 * bg-test-app regression (2026-07-14): on the first-ever load of a UIKit
 * module page, Vite discovered the entire @atlaskit dependency tree at
 * request time (the dep scanner only crawls <root>/index.html by default,
 * and module entries live in per-module subdirectories). The resulting
 * mid-flight re-optimization 504'd the in-flight dynamic import of
 * ForgeSimShell — "Failed to fetch dynamically imported module" — and the
 * boot() catch painted a permanent death screen. A manual refresh (warm dep
 * cache) always worked, making it a classic first-load-only race, amplified
 * by background-script iframes booting concurrently with the main frame.
 *
 * Two defenses, both pinned here:
 *  1. optimizeDeps.entries seeds the dep scanner with the real module
 *     entries so discovery happens at server startup, before any request.
 *  2. The generated boot() script retries exactly once (sessionStorage
 *     guard) when a dynamic import fails with a fetch TypeError, instead of
 *     dying on a transient race.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { generateUIKitEntry, buildViteConfig, generateRootIndexHtml } from '../dev-command.js';

describe('generateUIKitEntry — boot resilience', () => {
  const entry = generateUIKitEntry('/app/src/frontend/index.jsx', 5174, false);

  it('imports bridge → app code → shell in order', () => {
    const bridgeIdx = entry.indexOf("import('forge-sim/renderer/bridge')");
    const appIdx = entry.indexOf("import('/app/src/frontend/index.jsx')");
    const shellIdx = entry.indexOf("import('forge-sim/renderer/ForgeSimShell')");
    expect(bridgeIdx).toBeGreaterThan(-1);
    expect(appIdx).toBeGreaterThan(bridgeIdx);
    expect(shellIdx).toBeGreaterThan(appIdx);
  });

  it('reloads once on dynamic-import fetch failure (Vite dep re-optimization race)', () => {
    // Chrome, Firefox, and Safari phrase the module-fetch TypeError differently
    expect(entry).toContain('Failed to fetch dynamically imported module');
    expect(entry).toContain('error loading dynamically imported module');
    expect(entry).toContain('Importing a module script failed');
    expect(entry).toContain('location.reload()');
  });

  it('guards the reload with sessionStorage so real failures still surface', () => {
    expect(entry).toContain("sessionStorage.getItem('forge-sim-boot-retried')");
    expect(entry).toContain("sessionStorage.setItem('forge-sim-boot-retried', '1')");
    // Death screen still exists for non-transient errors
    expect(entry).toContain('forge-sim failed to start');
  });

  it('clears the retry guard after a successful boot', () => {
    const successPath = entry.slice(0, entry.indexOf('boot().catch'));
    expect(successPath).toContain("sessionStorage.removeItem('forge-sim-boot-retried')");
  });
});

describe('buildViteConfig — dep scanner seeding', () => {
  const baseOpts = {
    appDir: '/app',
    tempDir: '/app/.forge-sim/tmp',
    wsPort: 5174,
    port: 5173,
    forgeSimRoot: new URL('../..', import.meta.url).pathname,
  };
  const uikitModule = {
    module: { type: 'jira:issuePanel', key: 'panel', title: 'Panel' },
    resourcePath: '/app/src/frontend/index.tsx',
    mode: 'uikit',
  } as any;
  const customUiModule = {
    module: { type: 'jira:dashboardGadget', key: 'gadget', title: 'Gadget' },
    resourcePath: '/app/static/gadget/build',
    mode: 'customui',
  } as any;

  it('seeds optimizeDeps.entries + react includes when UIKit modules exist', async () => {
    const config = await buildViteConfig({ ...baseOpts, modules: [uikitModule, customUiModule] });

    // Without explicit entries, Vite only scans <root>/index.html and misses
    // every per-module entry — pushing @atlaskit discovery to request time.
    expect(config.optimizeDeps.entries).toEqual(
      expect.arrayContaining(['entry.tsx', '*/entry.tsx'])
    );
    // Core react deps stay pre-bundled
    expect(config.optimizeDeps.include).toEqual(
      expect.arrayContaining(['react', 'react-dom/client'])
    );
    // ForgeSimShell-exclusive deps must be force-pre-bundled too. The shell is
    // served from outside the Vite root (@fs escape), so the entries scan does
    // not reliably discover its imports. @atlaskit/avatar (acting-user switcher,
    // 0.1.13) is shell-exclusive and was discovered at request time, 504'ing
    // the in-flight ForgeSimShell import until a manual refresh.
    expect(config.optimizeDeps.include).toEqual(
      expect.arrayContaining(['@atlaskit/avatar', '@atlaskit/select', '@atlaskit/app-provider'])
    );
  });

  it('skips react pre-bundling for Custom-UI-only apps', async () => {
    // Custom UI resources are prebuilt bundles with react compiled in — the
    // app root often has no react installed at all. Unconditional includes
    // made Vite spam "Failed to resolve dependency: react" (report-gen,
    // 2026-07-16) for packages no page would ever import.
    const config = await buildViteConfig({ ...baseOpts, modules: [customUiModule] });

    expect(config.optimizeDeps.include).toEqual([]);
    expect(config.optimizeDeps.entries).toEqual([]);
  });
});

describe('renderer manifest — no undeclared shell deps', () => {
  // 0.1.13 regression: ForgeSimShell imported @atlaskit/avatar for the
  // acting-user switcher, but renderer/package.json only declared
  // @atlaskit/avatar-group. It resolved on git checkouts via transitive
  // hoisting, but on published installs (materialized via `npm ci`) and under
  // strict layouts (pnpm) that hoist is not guaranteed. Every @atlaskit/*
  // ForgeSimShell imports directly must be a declared dependency.
  it('declares every @atlaskit package ForgeSimShell imports directly', () => {
    const shellSrc = readFileSync(
      new URL('../../renderer/src/ForgeSimShell.tsx', import.meta.url),
      'utf8',
    );
    const pkg = JSON.parse(
      readFileSync(new URL('../../renderer/package.json', import.meta.url), 'utf8'),
    );
    const declared = new Set(Object.keys(pkg.dependencies ?? {}));
    const imported = new Set<string>();
    const re = /from ['"](@atlaskit\/[^'"/]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(shellSrc)) !== null) imported.add(m[1]);

    const missing = [...imported].filter((p) => !declared.has(p));
    expect(missing).toEqual([]);
  });
});

describe('generateRootIndexHtml — SPA fallback page', () => {
  // forgebuilder regression (2026-07-14): the root index.html used to be a
  // full module page referencing ./entry.tsx — a file never generated at
  // root. Vite's SPA fallback served it for unknown extension-less URLs,
  // spamming "Failed to load url /entry.tsx" on every client-side route.
  const html = generateRootIndexHtml('My App');

  it('does not reference entry.tsx (never generated at root)', () => {
    expect(html).not.toContain('entry.tsx');
    expect(html).not.toContain('<script');
  });

  it('redirects humans to the module picker at /', () => {
    expect(html).toContain('http-equiv="refresh"');
    expect(html).toContain('url=/');
    expect(html).toContain('href="/"');
  });

  it('includes the app name in the title', () => {
    expect(html).toContain('<title>My App — forge-sim</title>');
  });
});
