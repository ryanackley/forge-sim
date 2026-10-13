/**
 * Manual packaging (#40), phase 3: UI Kit / Custom UI resources.
 *
 * A manual-packaged UI resource is PREBUILT output — the app's own
 * @forge/react and @forge/bridge are inlined, so module-resolution
 * interception never fires. The runtime seam is the same one real Forge
 * uses: window.__bridge, which installBridge() already provides. These tests
 * prove the whole existing headless pipeline (reconcile capture, invoke
 * routing, waitForContent) works unchanged on a bundle built with the REAL
 * packages — built here with esbuild at test time, same shape as the Vite
 * output the Packaging docs describe.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve, join } from 'node:path';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'os';
import { createSimulator, type ForgeSimulator } from '../simulator.js';
import { extractEntryScript } from '../deployer.js';
import { detectModuleType } from '../dev-command.js';
import { parseManifestContent } from '../manifest.js';
import { warnOnForgeReactMajorMismatch, VERIFIED_FORGE_REACT_DOC_MAJOR } from '../forge-package-versions.js';
import { vi } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

/** Bundle a JSX source with the REAL @forge/* packages into prebuilt output. */
async function buildBundle(srcFile: string, outFile: string): Promise<void> {
  const esbuild = await import('esbuild');
  await esbuild.build({
    entryPoints: [srcFile],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    jsx: 'automatic',
    outfile: outFile,
    nodePaths: [join(REPO_ROOT, 'node_modules')],
    logLevel: 'silent',
  });
}

const PANEL_SRC = `
import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Text } from '@forge/react';
import { invoke } from '@forge/bridge';

const App = () => {
  const [data, setData] = useState(null);
  useEffect(() => { invoke('getText', { from: 'prebuilt' }).then(setData); }, []);
  return <Text>{data ?? 'Loading...'}</Text>;
};
ForgeReconciler.render(<App />);
`;

const pageSrc = (label: string) => `
import React from 'react';
import ForgeReconciler, { Text } from '@forge/react';
ForgeReconciler.render(<Text>${label}</Text>);
`;

describe('manual packaging: headless render of prebuilt UI Kit bundles', () => {
  let appDir: string;
  let sim: ForgeSimulator;

  beforeAll(async () => {
    appDir = await mkdtemp(join(tmpdir(), 'forge-sim-manual-ui-'));
    await writeFile(join(appDir, 'package.json'), '{ "name": "t", "private": true }', 'utf8');
    await writeFile(
      join(appDir, 'manifest.yml'),
      `
app:
  id: ari:cloud:ecosystem::app/11111111-2222-3333-4444-555555555555
  runtime:
    name: nodejs22.x
modules:
  jira:issuePanel:
    - key: panel
      resource: single
      render: native
      title: Panel
      icon: https://example.com/icon.svg
  confluence:globalPage:
    - key: page-global
      resource: multi/global
      render: native
      title: Global
      route: global
    - key: page-settings
      resource: multi/settings
      render: native
      title: Settings
      route: settings
resources:
  - key: single
    bundler: manual@2026
    path: frontend/single
  - key: multi
    bundler: manual@2026
    path: frontend/multi
    entry:
      global: global.html
      settings: settings.html
`,
      'utf8'
    );

    // Sources live OUTSIDE the resource dirs; only built output goes in —
    // exactly the manual-packaging layout.
    const srcDir = join(appDir, 'frontend', 'src');
    await mkdir(srcDir, { recursive: true });
    await mkdir(join(appDir, 'frontend', 'single'), { recursive: true });
    await mkdir(join(appDir, 'frontend', 'multi'), { recursive: true });

    await writeFile(join(srcDir, 'panel.jsx'), PANEL_SRC, 'utf8');
    await writeFile(join(srcDir, 'global.jsx'), pageSrc('from-global-entry'), 'utf8');
    await writeFile(join(srcDir, 'settings.jsx'), pageSrc('from-settings-entry'), 'utf8');

    await buildBundle(join(srcDir, 'panel.jsx'), join(appDir, 'frontend', 'single', 'index.js'));
    await buildBundle(join(srcDir, 'global.jsx'), join(appDir, 'frontend', 'multi', 'global.js'));
    await buildBundle(join(srcDir, 'settings.jsx'), join(appDir, 'frontend', 'multi', 'settings.js'));

    const html = (js: string) =>
      `<!doctype html><html><head></head><body><script type="module" src="./${js}"></script></body></html>`;
    await writeFile(join(appDir, 'frontend', 'single', 'index.html'), html('index.js'), 'utf8');
    await writeFile(join(appDir, 'frontend', 'multi', 'global.html'), html('global.js'), 'utf8');
    await writeFile(join(appDir, 'frontend', 'multi', 'settings.html'), html('settings.js'), 'utf8');

    sim = createSimulator();
    await sim.deploy(appDir, { throwOnError: false });
    sim.resolver.define('getText', async (req: any) => `resolved:${req.payload.from}`);
  }, 60_000);

  afterAll(async () => {
    sim?.ui.resetAll();
    await rm(appDir, { recursive: true, force: true }).catch(() => undefined);
  });

  it('renders a prebuilt single-entry bundle and round-trips invoke through the sim', async () => {
    const doc = await sim.ui.waitForContent('panel', 'resolved:prebuilt');
    expect(JSON.stringify(doc)).toContain('resolved:prebuilt');
    // The payload self-identifies the bundled reconcile-protocol major. This
    // PINS the constant: a @forge/react bump that changes the emitted value
    // fails here, forcing VERIFIED_FORGE_REACT_DOC_MAJOR to move with it.
    expect(doc.forgeReactMajorVersion).toBe(VERIFIED_FORGE_REACT_DOC_MAJOR);
  });

  it('renders each entry of a multi-entry prebuilt resource via slash refs', async () => {
    const globalDoc = await sim.ui.waitForContent('page-global', 'from-global-entry');
    expect(JSON.stringify(globalDoc)).toContain('from-global-entry');

    const settingsDoc = await sim.ui.waitForContent('page-settings', 'from-settings-entry');
    expect(JSON.stringify(settingsDoc)).toContain('from-settings-entry');
  });
});

describe('manual packaging: detectModuleType (dev server path)', () => {
  let appDir: string;

  beforeAll(async () => {
    appDir = await mkdtemp(join(tmpdir(), 'forge-sim-manual-detect-'));
    await mkdir(join(appDir, 'dist'), { recursive: true });
    await writeFile(
      join(appDir, 'dist', 'index.html'),
      '<!doctype html><html><body><script type="module" src="./app-abc123.js"></script></body></html>',
      'utf8'
    );
    await writeFile(join(appDir, 'dist', 'app-abc123.js'), 'export {};', 'utf8');
    await writeFile(
      join(appDir, 'dist', 'settings.html'),
      '<!doctype html><html><body><script type="module" src="./settings-x.js"></script></body></html>',
      'utf8'
    );
    await writeFile(join(appDir, 'dist', 'settings-x.js'), 'export {};', 'utf8');
  });

  afterAll(async () => {
    await rm(appDir, { recursive: true, force: true }).catch(() => undefined);
  });

  const manifestFor = (modules: string, resources: string) =>
    parseManifestContent(`
app:
  id: ari:cloud:ecosystem::app/11111111-2222-3333-4444-555555555555
  runtime:
    name: nodejs22.x
modules:
${modules}
resources:
${resources}
`);

  it('render: native + manual bundler → uikit mode pointing at the built script', () => {
    const manifest = manifestFor(
      `  jira:issuePanel:
    - key: p
      resource: main
      render: native
      title: P
      icon: https://example.com/i.svg`,
      `  - key: main
    bundler: manual@2026
    path: dist`
    );
    const detected = detectModuleType(appDir, manifest, manifest.uiModules[0]);
    expect(detected?.mode).toBe('uikit');
    expect(detected?.prebuilt).toBe(true);
    expect(detected?.resourcePath).toBe(join(appDir, 'dist', 'app-abc123.js'));
  });

  it('manual bundler without render: native → customui serving the entry html', () => {
    const manifest = manifestFor(
      `  jira:issuePanel:
    - key: p
      resource: main/settings
      title: P
      icon: https://example.com/i.svg`,
      `  - key: main
    bundler: manual@2026
    path: dist
    entry:
      settings: settings.html`
    );
    const detected = detectModuleType(appDir, manifest, manifest.uiModules[0]);
    expect(detected?.mode).toBe('customui');
    expect(detected?.entryHtml).toBe('settings.html');
    expect(detected?.resourcePath).toBe(join(appDir, 'dist'));
  });

  it('entry map + render native picks the per-entry script', () => {
    const manifest = manifestFor(
      `  confluence:globalPage:
    - key: p
      resource: main/settings
      render: native
      title: P
      route: settings`,
      `  - key: main
    bundler: manual@2026
    path: dist
    entry:
      settings: settings.html`
    );
    const detected = detectModuleType(appDir, manifest, manifest.uiModules[0]);
    expect(detected?.mode).toBe('uikit');
    expect(detected?.resourcePath).toBe(join(appDir, 'dist', 'settings-x.js'));
  });
});

describe('extractEntryScript', () => {
  it.each([
    ['<script type="module" src="./index.js"></script>', 'index.js'],
    ['<script src="assets/app-Bx12.js" type="module" crossorigin></script>', 'assets/app-Bx12.js'],
    ["<script type='module' src='./main.js'></script>", 'main.js'],
  ])('extracts %s', (tag, expected) => {
    expect(extractEntryScript(`<html><body>${tag}</body></html>`)).toBe(expected);
  });

  it('returns null when no script reference exists', () => {
    expect(extractEntryScript('<html><body></body></html>')).toBeNull();
  });
});

describe('warnOnForgeReactMajorMismatch', () => {
  it('warns once per mismatched major and never for the verified one', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      warnOnForgeReactMajorMismatch(undefined); // no version info — silent
      warnOnForgeReactMajorMismatch(1);
      warnOnForgeReactMajorMismatch(1); // deduped
      expect(spy.mock.calls.filter((c) => /reconcile protocol v1\b/.test(String(c[0])))).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });
});
