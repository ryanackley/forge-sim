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
import { generateUIKitEntry, buildViteConfig } from '../dev-command.js';

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
  it('seeds optimizeDeps.entries with module entry files', async () => {
    const config = await buildViteConfig({
      appDir: '/app',
      tempDir: '/app/.forge-sim/tmp',
      modules: [],
      wsPort: 5174,
      port: 5173,
      forgeSimRoot: new URL('../..', import.meta.url).pathname,
    });

    // Without explicit entries, Vite only scans <root>/index.html and misses
    // every per-module entry — pushing @atlaskit discovery to request time.
    expect(config.optimizeDeps.entries).toEqual(
      expect.arrayContaining(['entry.tsx', '*/entry.tsx'])
    );
    // Core react deps stay pre-bundled
    expect(config.optimizeDeps.include).toEqual(
      expect.arrayContaining(['react', 'react-dom/client'])
    );
  });
});
