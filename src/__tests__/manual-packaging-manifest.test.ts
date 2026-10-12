/**
 * Manual packaging (#40), phase 1: manifest layer.
 *
 * Covers the manifest-side surface of `app.package` (bundler/path/extraFiles)
 * and multi-entry resources (`bundler: manual@2026`, `entry` maps, and the
 * `resource: <key>/<entry>` slash syntax on modules):
 *
 * - parser: handlersDirectory, resource fields, slash-ref splitting,
 *   bundler: typescript rejection (removed upstream in schema 13.7)
 * - content mode: manual-packaging manifests validate without false
 *   file-existence errors; manifest-shape entry errors still surface
 * - file mode: upstream validator resolves handlers from app.package.path,
 *   and extraFiles globs resolve against the app dir regardless of cwd
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { parseManifestContent } from '../manifest.js';
import {
  PLACEHOLDER_APP_ID,
  validateManifestContent,
  validateManifestFile,
  hasValidationErrors,
} from '../manifest-validation.js';

const HEADER = `
app:
  id: ${PLACEHOLDER_APP_ID}
  runtime:
    name: nodejs22.x
`;

const BASE_MODULES = `
modules:
  webtrigger:
    - key: hook
      function: main
  function:
    - key: main
      handler: index.run
`;

describe('parser: app.package / handlersDirectory', () => {
  it('defaults handlersDirectory to src', () => {
    const parsed = parseManifestContent(HEADER + BASE_MODULES);
    expect(parsed.handlersDirectory).toBe('src');
  });

  it('uses app.package.path under manual packaging', () => {
    const parsed = parseManifestContent(
      HEADER +
        `  package:
    bundler: manual@2026
    path: backend/dist
` +
        BASE_MODULES
    );
    expect(parsed.handlersDirectory).toBe('backend/dist');
  });

  it('falls back to src when manual packaging declares no path (upstream default)', () => {
    const parsed = parseManifestContent(
      HEADER +
        `  package:
    bundler: manual@2026
` +
        BASE_MODULES
    );
    expect(parsed.handlersDirectory).toBe('src');
  });

  it('ignores app.package.path when the bundler is not manual@2026', () => {
    const parsed = parseManifestContent(
      HEADER +
        `  package:
    bundler: webpack
    path: backend/dist
` +
        BASE_MODULES
    );
    expect(parsed.handlersDirectory).toBe('src');
  });

  it('rejects bundler: typescript (removed when manual packaging reached Preview)', () => {
    const parsed = parseManifestContent(
      HEADER +
        `  package:
    bundler: typescript
` +
        BASE_MODULES
    );
    const errors = parsed.warnings.filter((w) => w.level === 'error');
    expect(errors.some((e) => /bundler "typescript" was removed/.test(e.message))).toBe(true);
    // The message must hand the user the replacement snippet.
    expect(errors.some((e) => /manual@2026/.test(e.message))).toBe(true);
  });
});

describe('parser: resources and entry maps', () => {
  const MANIFEST = `${HEADER}
modules:
  confluence:globalPage:
    - key: my-global-page
      resource: app/global
      render: native
      title: Global
  confluence:globalSettings:
    - key: my-settings-page
      resource: app/settings
      render: native
      title: Settings
  jira:issuePanel:
    - key: plain-panel
      resource: single
      render: native
      title: Panel
      icon: https://example.com/icon.svg
resources:
  - key: app
    bundler: manual@2026
    path: frontend/dist
    entry:
      global: global.html
      settings: settings.html
    tunnel:
      port: 3000
  - key: single
    path: src/frontend/index.tsx
`;

  it('keeps bundler, entry, and tunnel on parsed resources', () => {
    const parsed = parseManifestContent(MANIFEST);
    expect(parsed.resources.get('app')).toEqual({
      key: 'app',
      path: 'frontend/dist',
      bundler: 'manual@2026',
      entry: { global: 'global.html', settings: 'settings.html' },
      tunnel: { port: 3000 },
    });
  });

  it('keeps the historical minimal { key, path } shape for plain resources', () => {
    const parsed = parseManifestContent(MANIFEST);
    const single = parsed.resources.get('single');
    expect(single).toEqual({ key: 'single', path: 'src/frontend/index.tsx' });
    expect(Object.keys(single!).sort()).toEqual(['key', 'path']);
  });

  it('splits resource: <key>/<entry> module references into resourceKey + entryKey', () => {
    const parsed = parseManifestContent(MANIFEST);
    const globalPage = parsed.uiModules.find((m) => m.key === 'my-global-page');
    expect(globalPage?.resourceKey).toBe('app');
    expect(globalPage?.entryKey).toBe('global');
    const settings = parsed.uiModules.find((m) => m.key === 'my-settings-page');
    expect(settings?.resourceKey).toBe('app');
    expect(settings?.entryKey).toBe('settings');
  });

  it('leaves bare resource references untouched (no entryKey property)', () => {
    const parsed = parseManifestContent(MANIFEST);
    const panel = parsed.uiModules.find((m) => m.key === 'plain-panel');
    expect(panel?.resourceKey).toBe('single');
    expect('entryKey' in panel!).toBe(false);
  });
});

describe('content mode: manual packaging validates without an app directory', () => {
  it('accepts app.package + manual UI Kit resource with an entry map', async () => {
    const findings = await validateManifestContent(`${HEADER}
  package:
    bundler: manual@2026
    path: out
    extraFiles:
      - data/*.json
modules:
  confluence:globalPage:
    - key: my-global-page
      resource: app/global
      render: native
      title: Global
      route: global-page
  function:
    - key: main
      handler: cucumber/two.handler
resources:
  - key: app
    bundler: manual@2026
    path: frontend/dist
    entry:
      global: global.html
`);
    // File-existence findings (handler files, entry files, extraFiles globs)
    // are meaningless without an app dir and must be filtered; anything left
    // at error level means the schema itself rejected the shape.
    expect(hasValidationErrors(findings)).toBe(false);
  });

  it('still surfaces manifest-shape entry errors (missing entry key)', async () => {
    const findings = await validateManifestContent(`${HEADER}
modules:
  confluence:globalPage:
    - key: my-global-page
      resource: app/missing-entry
      render: native
      title: Global
      route: global-page
resources:
  - key: app
    bundler: manual@2026
    path: frontend/dist
    entry:
      global: global.html
`);
    expect(
      findings.some((f) => /does not define entry 'missing-entry'/.test(f.message))
    ).toBe(true);
  });
});

describe('file mode: handler resolution and extraFiles against the app dir', () => {
  let appDir: string;

  beforeEach(async () => {
    appDir = await mkdtemp(join(tmpdir(), 'forge-sim-manual-pkg-test-'));
  });

  afterEach(async () => {
    await rm(appDir, { recursive: true, force: true }).catch(() => undefined);
  });

  async function writeApp(manifest: string, files: Record<string, string> = {}) {
    await writeFile(join(appDir, 'manifest.yml'), manifest, 'utf8');
    for (const [rel, content] of Object.entries(files)) {
      await mkdir(join(appDir, rel, '..'), { recursive: true });
      await writeFile(join(appDir, rel), content, 'utf8');
    }
  }

  const MANUAL_MANIFEST = `${HEADER}
  package:
    bundler: manual@2026
    path: out
modules:
  webtrigger:
    - key: hook
      function: main
  function:
    - key: main
      handler: cucumber/two.run
`;

  it('resolves handlers from app.package.path, not src/', async () => {
    await writeApp(MANUAL_MANIFEST, {
      'out/cucumber/two.js': 'module.exports.run = () => ({ statusCode: 200 });',
    });
    const findings = await validateManifestFile(join(appDir, 'manifest.yml'));
    expect(hasValidationErrors(findings)).toBe(false);
  });

  it('errors when the handler only exists under src/ (manual packaging ignores src/)', async () => {
    await writeApp(MANUAL_MANIFEST, {
      'src/cucumber/two.js': 'module.exports.run = () => ({ statusCode: 200 });',
    });
    const findings = await validateManifestFile(join(appDir, 'manifest.yml'));
    expect(hasValidationErrors(findings)).toBe(true);
    expect(findings.some((f) => /cannot find associated file/.test(f.message))).toBe(true);
  });

  it('resolves extraFiles globs against the app dir, not process.cwd()', async () => {
    // Regression: upstream's PackageValidator globs relative to cwd. This test
    // runs from the repo root (vitest cwd), while the app lives in a temp dir —
    // without the cwd pin in runValidator the glob below can't match.
    await writeApp(
      `${HEADER}
  package:
    bundler: manual@2026
    path: out
    extraFiles:
      - data/*.json
modules:
  webtrigger:
    - key: hook
      function: main
  function:
    - key: main
      handler: index.run
`,
      {
        'out/index.js': 'module.exports.run = () => ({ statusCode: 200 });',
        'data/seed.json': '{}',
      }
    );
    const findings = await validateManifestFile(join(appDir, 'manifest.yml'));
    expect(findings.filter((f) => /Extra files specification/.test(f.message))).toEqual([]);
    expect(hasValidationErrors(findings)).toBe(false);
  });

  it('reports an extraFiles glob that matches nothing', async () => {
    await writeApp(
      `${HEADER}
  package:
    bundler: manual@2026
    path: out
    extraFiles:
      - data/*.json
modules:
  webtrigger:
    - key: hook
      function: main
  function:
    - key: main
      handler: index.run
`,
      { 'out/index.js': 'module.exports.run = () => ({ statusCode: 200 });' }
    );
    const findings = await validateManifestFile(join(appDir, 'manifest.yml'));
    expect(
      findings.some((f) => /Extra files specification 'data\/\*\.json' does not match any files/.test(f.message))
    ).toBe(true);
  });
});
