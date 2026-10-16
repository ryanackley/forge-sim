/**
 * E2E for manual packaging (#40) in a real browser via `forge-sim dev`.
 *
 * The headless suite (src/__tests__/manual-packaging-ui.test.ts) proves
 * prebuilt bundles render through the in-process bridge. What only a browser
 * can prove is the dev server's half: the generated shell executes every
 * <script type="module"> of the entry HTML in document order, sibling assets
 * resolve under /module/<key>/, head tags (stylesheets) carry over, the
 * served bridge round-trips invoke / requestJira / invokeRemote /
 * requestRemote with the REAL @forge/bridge inlined in the bundle, and a
 * rebuild on disk is picked up without a restart.
 *
 * Fixture: e2e/fixtures/manual-packaging-ui — a manual-packaged app (plain
 * CJS backend in out/ with @forge/resolver kept external, the supported
 * shape) whose frontend resources are built here with esbuild from
 * frontend/src/, exactly like a user running their build before `dev`.
 * Product/remote responses come from the fixture's .forge-sim/mocks.json.
 */

import { test, expect, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startForgeSimDev, type DevServerInstance } from './helpers/forge-sim-harness';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const APP_DIR = resolve(__dirname, 'fixtures/manual-packaging-ui');
const SRC = join(APP_DIR, 'frontend', 'src');
const OUT = join(APP_DIR, 'frontend');

const GLOBAL_SRC_ORIGINAL = `import React from 'react';
import ForgeReconciler, { Text } from '@forge/react';
// shared.js is a separate <script type="module"> listed BEFORE this one in
// global.html; a browser runs them in document order, so it must be visible.
ForgeReconciler.render(<Text>{'from-global-entry shared:' + (window.__sharedLoaded ?? 'missing')}</Text>);
`;

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

async function buildAll(): Promise<void> {
  await Promise.all([
    buildBundle(join(SRC, 'panel.jsx'), join(OUT, 'single', 'index.js')),
    buildBundle(join(SRC, 'remote.jsx'), join(OUT, 'remote', 'index.js')),
    buildBundle(join(SRC, 'global.jsx'), join(OUT, 'multi', 'global.js')),
    buildBundle(join(SRC, 'settings.jsx'), join(OUT, 'multi', 'settings.js')),
  ]);
}

test.describe('Manual packaging: prebuilt UI Kit resources through forge-sim dev', () => {
  test.describe.configure({ mode: 'serial' });

  let server: DevServerInstance;

  test.beforeAll(async () => {
    await writeFile(join(SRC, 'global.jsx'), GLOBAL_SRC_ORIGINAL, 'utf8');
    await buildAll();
    server = await startForgeSimDev({ appDir: APP_DIR, timeoutMs: 45_000 });
  });

  test.afterAll(async () => {
    await server?.stop();
    // Leave the source as committed even if the rebuild test failed midway.
    await writeFile(join(SRC, 'global.jsx'), GLOBAL_SRC_ORIGINAL, 'utf8');
  });

  async function open(page: Page, moduleKey: string) {
    await page.goto(`${server.url}/module/${moduleKey}/`);
  }

  test('single-entry bundle: invoke reaches the manual-packaged backend, requestJira hits mocks.json', async ({ page }) => {
    await open(page, 'panel');
    await expect(page.getByText('invoke:from-manual-backend:prebuilt')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('jira:MOCK-1')).toBeVisible({ timeout: 10_000 });
  });

  test("real @forge/bridge's invokeRemote and requestRemote resolve through the served bridge", async ({ page }) => {
    await open(page, 'remote-panel');
    await expect(page.getByText('remote-invoke:[{"id":1}]')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('remote-fetch:[{"event":"page_view"}]')).toBeVisible({ timeout: 10_000 });
  });

  test('multi-entry resource: each entry renders its own bundle, scripts run in document order', async ({ page }) => {
    await open(page, 'page-global');
    await expect(page.getByText('from-global-entry shared:shared-ok')).toBeVisible({ timeout: 20_000 });

    await open(page, 'page-settings');
    await expect(page.getByText('from-settings-entry')).toBeVisible({ timeout: 20_000 });
  });

  test('stylesheet from the entry HTML is carried into the shell and loads from the resource dir', async ({ page }) => {
    await open(page, 'page-global');
    await expect(page.getByText('from-global-entry shared:shared-ok')).toBeVisible({ timeout: 20_000 });

    const marker = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--e2e-manual-packaging-marker').trim()
    );
    expect(marker).toBe('rgb(12, 34, 56)');

    const sheet = await page.evaluate(() => {
      const s = [...document.styleSheets].find((x) => x.href?.endsWith('/styles.css'));
      return s ? { href: new URL(s.href!).pathname, rules: s.cssRules.length } : null;
    });
    expect(sheet?.href).toBe('/module/page-global/styles.css');
    expect(sheet?.rules).toBeGreaterThan(0);
  });

  test('a rebuild on disk is picked up without restarting the dev server', async ({ page }) => {
    await open(page, 'page-global');
    await expect(page.getByText('from-global-entry shared:shared-ok')).toBeVisible({ timeout: 20_000 });

    const src = await readFile(join(SRC, 'global.jsx'), 'utf8');
    await writeFile(join(SRC, 'global.jsx'), src.replace('from-global-entry', 'from-global-entry-v2'), 'utf8');
    await buildBundle(join(SRC, 'global.jsx'), join(OUT, 'multi', 'global.js'));

    // Vite invalidates the changed bundle within a debounce window; each
    // attempt reloads and then gives the app a moment to render before
    // deciding (an instant isVisible() right after reload is always false).
    await expect
      .poll(
        async () => {
          await page.reload();
          return page
            .getByText('from-global-entry-v2 shared:shared-ok')
            .waitFor({ timeout: 4_000 })
            .then(() => true, () => false);
        },
        { timeout: 30_000, intervals: [500] },
      )
      .toBe(true);
  });
});
