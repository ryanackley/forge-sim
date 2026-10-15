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
import { extractEntryScript, extractEntryScripts } from '../deployer.js';
import { detectModuleType, refreshPrebuiltModules, generateUIKitEntry, extractHeadCarryover, generateIndexHtml } from '../dev-command.js';
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

  it('refreshPrebuiltModules re-resolves a renamed hashed bundle (adversarial #3)', async () => {
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
    const detected = detectModuleType(appDir, manifest, manifest.uiModules[0])!;
    expect(detected.resourcePath).toBe(join(appDir, 'dist', 'app-abc123.js'));

    // Simulate `vite build`: new hash, old asset deleted, HTML rewritten.
    await writeFile(join(appDir, 'dist', 'app-def456.js'), 'export {};', 'utf8');
    await writeFile(
      join(appDir, 'dist', 'index.html'),
      '<!doctype html><html><body><script type="module" src="./app-def456.js"></script></body></html>',
      'utf8'
    );
    await rm(join(appDir, 'dist', 'app-abc123.js'));

    const changed = refreshPrebuiltModules(appDir, manifest, [detected]);
    expect(changed).toHaveLength(1);
    expect(detected.resourcePath).toBe(join(appDir, 'dist', 'app-def456.js'));

    // Unchanged on a second pass — no spurious regeneration.
    expect(refreshPrebuiltModules(appDir, manifest, [detected])).toHaveLength(0);

    // Restore fixture state for sibling tests.
    await writeFile(join(appDir, 'dist', 'app-abc123.js'), 'export {};', 'utf8');
    await writeFile(
      join(appDir, 'dist', 'index.html'),
      '<!doctype html><html><body><script type="module" src="./app-abc123.js"></script></body></html>',
      'utf8'
    );
  });

  it('captures asset dir + head carry-over for prebuilt modules (adversarial C)', async () => {
    await mkdir(join(appDir, 'dist-styled'), { recursive: true });
    await writeFile(
      join(appDir, 'dist-styled', 'index.html'),
      '<!doctype html><html><head><link rel="stylesheet" href="./styles-abc.css"></head>' +
      '<body><script type="module" src="./app.js"></script></body></html>',
      'utf8'
    );
    await writeFile(join(appDir, 'dist-styled', 'app.js'), 'export {};', 'utf8');
    await writeFile(join(appDir, 'dist-styled', 'styles-abc.css'), 'body{}', 'utf8');

    const manifest = manifestFor(
      `  jira:issuePanel:
    - key: p
      resource: main
      render: native
      title: P
      icon: https://example.com/i.svg`,
      `  - key: main
    bundler: manual@2026
    path: dist-styled`
    );
    const detected = detectModuleType(appDir, manifest, manifest.uiModules[0])!;
    expect(detected.prebuiltAssetDir).toBe(join(appDir, 'dist-styled'));
    expect(detected.prebuiltHeadTags).toEqual(['<link rel="stylesheet" href="./styles-abc.css">']);

    // CSS-only hash rename (scripts untouched) must register as a change, or
    // the regenerated shell keeps linking the deleted stylesheet.
    await writeFile(join(appDir, 'dist-styled', 'styles-def.css'), 'body{}', 'utf8');
    await writeFile(
      join(appDir, 'dist-styled', 'index.html'),
      '<!doctype html><html><head><link rel="stylesheet" href="./styles-def.css"></head>' +
      '<body><script type="module" src="./app.js"></script></body></html>',
      'utf8'
    );
    const changed = refreshPrebuiltModules(appDir, manifest, [detected]);
    expect(changed).toHaveLength(1);
    expect(detected.prebuiltHeadTags).toEqual(['<link rel="stylesheet" href="./styles-def.css">']);
    // Idempotent on a second pass.
    expect(refreshPrebuiltModules(appDir, manifest, [detected])).toHaveLength(0);
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

  it('prefers the type="module" script over leading plain scripts (adversarial #2)', () => {
    const html = `<html><head>
      <script src="./analytics.js"></script>
    </head><body>
      <script type="module" src="./app.js"></script>
    </body></html>`;
    expect(extractEntryScript(html)).toBe('app.js');
  });

  it('normalizes an absolute src and warns about real-Forge 404s (adversarial #5)', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const src = extractEntryScript(
        '<html><body><script type="module" src="/assets/home-Abc1.js"></script></body></html>',
        'resource "warn-abs-test" (index.html)'
      );
      expect(src).toBe('assets/home-Abc1.js');
      expect(
        spy.mock.calls.some((c) => /ABSOLUTE/.test(String(c[0])) && /base: '\.\/'/.test(String(c[0])))
      ).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it('falls back to a plain script with a warning when no module script exists', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const src = extractEntryScript(
        '<html><body><script src="./legacy.js"></script></body></html>',
        'resource "warn-fallback-test" (index.html)'
      );
      expect(src).toBe('legacy.js');
      expect(spy.mock.calls.some((c) => /no <script type="module">/.test(String(c[0])))).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('extractEntryScripts (adversarial B: Parcel shapes)', () => {
  it('parses UNQUOTED attribute values (Parcel production optimizer)', () => {
    const html = '<!doctype html><html><body><script src=index.abc123.js type=module></script></body></html>';
    expect(extractEntryScripts(html)).toEqual(['index.abc123.js']);
    expect(extractEntryScript(html)).toBe('index.abc123.js');
  });

  it('returns ALL module scripts in document order (shared bundle before entry)', () => {
    const html = `<html><head>
      <script src="./analytics.js"></script>
      <script type="module" src="./shared.abc.js"></script>
    </head><body>
      <script type="module" src="./entry.def.js"></script>
    </body></html>`;
    expect(extractEntryScripts(html)).toEqual(['shared.abc.js', 'entry.def.js']);
    // The singular helper yields the ENTRY — the last module script.
    expect(extractEntryScript(html)).toBe('entry.def.js');
  });

  it('mixed quoting styles across tags all parse', () => {
    const html = `<script type=module src=a.js></script>
      <script type='module' src='b.js'></script>
      <script type="module" src="./c.js"></script>`;
    expect(extractEntryScripts(html)).toEqual(['a.js', 'b.js', 'c.js']);
  });

  it('returns [] when no script has a src', () => {
    expect(extractEntryScripts('<html><script>inline()</script></html>')).toEqual([]);
  });
});

describe('extractHeadCarryover (adversarial C: stylesheet/importmap carry-over)', () => {
  it('collects stylesheet links — any attribute order, quoted or not', () => {
    const html = `<html><head>
      <link rel="stylesheet" href="./styles-abc.css">
      <link href=theme.css rel=stylesheet>
      <link href="/icon.png" rel="icon">
    </head><body><script type="module" src="./index.js"></script></body></html>`;
    expect(extractHeadCarryover(html)).toEqual([
      '<link rel="stylesheet" href="./styles-abc.css">',
      '<link href=theme.css rel=stylesheet>',
    ]);
  });

  it('collects importmap blocks with their JSON body, in document order', () => {
    const html = `<head>
      <script type="importmap">{ "imports": { "lodash": "./vendor/lodash.js" } }</script>
      <link rel="stylesheet" href="a.css">
    </head>`;
    const tags = extractHeadCarryover(html);
    expect(tags).toHaveLength(2);
    expect(tags[0]).toContain('importmap');
    expect(tags[0]).toContain('vendor/lodash.js');
    expect(tags[1]).toContain('a.css');
  });

  it('returns [] when the entry HTML has no carry-over tags', () => {
    expect(extractHeadCarryover('<html><body><script type="module" src="x.js"></script></body></html>'))
      .toEqual([]);
  });

  it('generateIndexHtml injects carry-over into the shell head', () => {
    const html = generateIndexHtml('T', ['<link rel="stylesheet" href="./s.css">']);
    expect(html).toContain('<link rel="stylesheet" href="./s.css">');
    expect(html.indexOf('s.css')).toBeLessThan(html.indexOf('<body>'));
    // The shell still loads the generated entry.
    expect(html).toContain('./entry.tsx');
  });
});

describe('generateUIKitEntry with multiple prebuilt scripts', () => {
  it('imports every script in document order', () => {
    const entry = generateUIKitEntry(['../../dist/shared.js', '../../dist/entry.js'], 5174, false);
    const shared = entry.indexOf("await import('../../dist/shared.js');");
    const main = entry.indexOf("await import('../../dist/entry.js');");
    expect(shared).toBeGreaterThan(-1);
    expect(main).toBeGreaterThan(shared);
  });
});

describe('headless DOM-at-load handling (adversarial #1)', () => {
  // Vite's modulepreload polyfill body, verbatim shape from vite/dist (the
  // default `vite build` injects this into the shared chunk). With the
  // document stub answering supports('modulepreload') → true it returns on
  // its first branch; if the stub regresses, the body falls through to
  // MutationObserver — undefined in Node — and the render throws.
  const VITE_POLYFILL = `
(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link);
  }
  new MutationObserver(() => {}).observe(document, { childList: true, subtree: true });
  function processPreload() {}
})();`;

  let appDir: string;

  beforeAll(async () => {
    appDir = await mkdtemp(join(tmpdir(), 'forge-sim-polyfill-'));
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
      resource: main
      render: native
      title: P
      icon: https://example.com/i.svg
resources:
  - key: main
    bundler: manual@2026
    path: dist
`,
      'utf8'
    );
    const srcDir = join(appDir, 'src');
    await mkdir(srcDir, { recursive: true });
    await mkdir(join(appDir, 'dist'), { recursive: true });
    await writeFile(join(srcDir, 'app.jsx'), pageSrc('polyfilled-app'), 'utf8');
    const out = join(appDir, 'dist', 'index.js');
    await buildBundle(join(srcDir, 'app.jsx'), out);
    // Prepend the polyfill exactly where Vite puts it: top of the bundle.
    const { readFile: rf } = await import('node:fs/promises');
    const bundled = await rf(out, 'utf8');
    await writeFile(out, VITE_POLYFILL + '\n' + bundled, 'utf8');
    await writeFile(
      join(appDir, 'dist', 'index.html'),
      '<!doctype html><html><body><script type="module" src="./index.js"></script></body></html>',
      'utf8'
    );
  }, 60_000);

  afterAll(async () => {
    await rm(appDir, { recursive: true, force: true }).catch(() => undefined);
  });

  it("renders a bundle carrying Vite's modulepreload polyfill (document stub short-circuits it)", async () => {
    const sim = createSimulator();
    await sim.deploy(appDir, { throwOnError: false });
    const doc = await sim.ui.waitForContent('panel', 'polyfilled-app');
    expect(JSON.stringify(doc)).toContain('polyfilled-app');
    sim.ui.resetAll();
  });

  it('translates other browser-global ReferenceErrors into an actionable message', async () => {
    // Own app dir: vite-node caches modules by PATH (ignoring the ?t query),
    // so reusing the previous test's dist/index.js would re-serve the cached
    // polyfilled module instead of this file.
    const alertDir = await mkdtemp(join(tmpdir(), 'forge-sim-alert-'));
    try {
      await writeFile(join(alertDir, 'package.json'), '{ "name": "t", "private": true }', 'utf8');
      await writeFile(
        join(alertDir, 'manifest.yml'),
        `
app:
  id: ari:cloud:ecosystem::app/11111111-2222-3333-4444-555555555555
  runtime:
    name: nodejs22.x
modules:
  jira:issuePanel:
    - key: panel
      resource: main
      render: native
      title: P
      icon: https://example.com/i.svg
resources:
  - key: main
    bundler: manual@2026
    path: dist
`,
        'utf8'
      );
      await mkdir(join(alertDir, 'dist'), { recursive: true });
      // alert() is not defined in Node and not stubbed — stands in for any
      // DOM-at-load access beyond the document stub.
      await writeFile(join(alertDir, 'dist', 'index.js'), `alert('boom');`, 'utf8');
      await writeFile(
        join(alertDir, 'dist', 'index.html'),
        '<!doctype html><html><body><script type="module" src="./index.js"></script></body></html>',
        'utf8'
      );
      const sim = createSimulator();
      await sim.deploy(alertDir, { throwOnError: false });
      await expect(sim.ui.render('panel')).rejects.toThrow(
        /accessed the browser global "alert" while loading/
      );
      sim.ui.resetAll();
    } finally {
      await rm(alertDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });
});

describe('headless prebuilt bundles — adversarial A/B integration', () => {
  const manifestYml = `
app:
  id: ari:cloud:ecosystem::app/11111111-2222-3333-4444-555555555555
  runtime:
    name: nodejs22.x
modules:
  jira:issuePanel:
    - key: panel
      resource: main
      render: native
      title: P
      icon: https://example.com/i.svg
resources:
  - key: main
    bundler: manual@2026
    path: dist
`;

  const makeAppDir = async (prefix: string): Promise<string> => {
    const dir = await mkdtemp(join(tmpdir(), prefix));
    await writeFile(join(dir, 'package.json'), '{ "name": "t", "private": true }', 'utf8');
    await writeFile(join(dir, 'manifest.yml'), manifestYml, 'utf8');
    await mkdir(join(dir, 'dist'), { recursive: true });
    await mkdir(join(dir, 'src'), { recursive: true });
    return dir;
  };

  // webpack 5's `publicPath: 'auto'` runtime, verbatim shape: reads
  // document.currentScript (gated on tagName) at MODULE EVAL and throws the
  // opaque "Automatic publicPath is not supported in this browser" when the
  // stub lacks it — which every Forge webpack build hits, since
  // @forge/bridge's dynamic iframe-resizer import forces chunk runtime.
  const WEBPACK_PUBLICPATH_PREAMBLE = `
var scriptUrl;
if (typeof document !== "undefined") {
  if (document.currentScript && document.currentScript.tagName && document.currentScript.tagName.toUpperCase() === "SCRIPT")
    scriptUrl = document.currentScript.src;
  if (!scriptUrl) {
    var scripts = document.getElementsByTagName("script");
    if (scripts.length) {
      var i = scripts.length - 1;
      while (i > -1 && (!scriptUrl || !/^http(s?):/.test(scriptUrl))) scriptUrl = scripts[i--].src;
    }
  }
}
if (!scriptUrl) throw new Error("Automatic publicPath is not supported in this browser");
scriptUrl = scriptUrl.replace(/^blob:/, "").replace(/#.*$/, "").replace(/\\?.*$/, "").replace(/\\/[^\\/]+$/, "/");
globalThis.__forgeSimTestPublicPath = scriptUrl;
`;

  it("survives webpack's publicPath:'auto' runtime via the stub's currentScript (adversarial A)", async () => {
    const appDir = await makeAppDir('forge-sim-webpack-pp-');
    try {
      await writeFile(join(appDir, 'src', 'app.jsx'), pageSrc('webpack-publicpath-app'), 'utf8');
      const out = join(appDir, 'dist', 'index.js');
      await buildBundle(join(appDir, 'src', 'app.jsx'), out);
      const { readFile: rf } = await import('node:fs/promises');
      await writeFile(out, WEBPACK_PUBLICPATH_PREAMBLE + '\n' + (await rf(out, 'utf8')), 'utf8');
      await writeFile(
        join(appDir, 'dist', 'index.html'),
        '<!doctype html><html><body><script type="module" src="./index.js"></script></body></html>',
        'utf8'
      );

      const sim = createSimulator();
      await sim.deploy(appDir, { throwOnError: false });
      const doc = await sim.ui.waitForContent('panel', 'webpack-publicpath-app');
      expect(JSON.stringify(doc)).toContain('webpack-publicpath-app');
      // publicPath derived from currentScript.src — the bundle's own dir.
      expect((globalThis as any).__forgeSimTestPublicPath).toMatch(/\/dist\/$/);
      // Browser parity at rest: null outside script evaluation.
      expect((globalThis as any).document.currentScript).toBeNull();
      sim.ui.resetAll();
    } finally {
      delete (globalThis as any).__forgeSimTestPublicPath;
      await rm(appDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }, 60_000);

  it('imports every module script in document order — Parcel shared-before-entry, unquoted attrs (adversarial B)', async () => {
    const appDir = await makeAppDir('forge-sim-parcel-multi-');
    try {
      // Shared bundle registers state the entry depends on — nothing renders
      // unless it executed FIRST, so a single-script pick fails loudly here.
      await writeFile(
        join(appDir, 'dist', 'shared.js'),
        "globalThis.__forgeSimTestShared = 'shared-ran';\nexport {};",
        'utf8'
      );
      await writeFile(
        join(appDir, 'src', 'app.jsx'),
        `
import React from 'react';
import ForgeReconciler, { Text } from '@forge/react';
ForgeReconciler.render(<Text>{String(globalThis.__forgeSimTestShared ?? 'shared-missing')}</Text>);
`,
        'utf8'
      );
      await buildBundle(join(appDir, 'src', 'app.jsx'), join(appDir, 'dist', 'entry.js'));
      // Parcel optimizer shape: unquoted attributes, shared listed first.
      await writeFile(
        join(appDir, 'dist', 'index.html'),
        '<!doctype html><html><body><script src=shared.js type=module></script><script type=module src=entry.js></script></body></html>',
        'utf8'
      );

      const sim = createSimulator();
      await sim.deploy(appDir, { throwOnError: false });
      const doc = await sim.ui.waitForContent('panel', 'shared-ran');
      expect(JSON.stringify(doc)).toContain('shared-ran');
      sim.ui.resetAll();
    } finally {
      delete (globalThis as any).__forgeSimTestShared;
      await rm(appDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }, 60_000);
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
