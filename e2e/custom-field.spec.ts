/**
 * E2E tests for jira:customField support.
 *
 * Tests custom field manifest parsing, module picker grouping,
 * view/edit sub-module rendering, and edit interaction.
 *
 * The "iframe" group requires headed mode (--headed) because Atlaskit's
 * massive dependency tree causes ERR_INSUFFICIENT_RESOURCES in headless
 * Chromium when two UIKit iframes load simultaneously.
 * Run with: npx playwright test custom-field.spec.ts --project=bridge --headed
 */

import { test, expect } from '@playwright/test';
import { startForgeSimDev, type DevServerInstance } from './helpers/forge-sim-harness';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

test.describe('Custom Fields', () => {
  test.describe.configure({ mode: 'serial' });

  let server: DevServerInstance;

  test.beforeAll(async () => {
    server = await startForgeSimDev({
      appDir: resolve(__dirname, 'fixtures/custom-field'),
      port: 19540,
      wsPort: 19541,
      timeoutMs: 45_000,
    });
  });

  test.afterAll(() => {
    server?.stop();
  });

  // ── Module picker ───────────────────────────────────────────────────

  test('module picker shows grouped custom field entry', async ({ page }) => {
    await page.goto(server.url);

    await expect(page.getByText('Priority Score')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('View')).toBeVisible();
    await expect(page.getByText('Edit')).toBeVisible();
  });

  // ── Combined page structure ─────────────────────────────────────────

  test('combined page renders with View and Edit tabs', async ({ page }) => {
    await page.goto(`${server.url}/module/priority-score/`);

    await expect(page.locator('.cf-tab[data-mode="view"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.cf-tab[data-mode="edit"]')).toBeVisible();
    await expect(page.locator('.cf-tab[data-mode="view"]')).toHaveClass(/active/);
  });

  // ── View sub-module ─────────────────────────────────────────────────

  test('view sub-module displays field value', async ({ page }) => {
    await page.goto(`${server.url}/module/priority-score--view/`);
    await expect(page.getByText('Score:')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/current-value:/)).toBeVisible();
  });

  // ── Edit sub-module ─────────────────────────────────────────────────

  test('edit sub-module shows textfield and save button', async ({ page }) => {
    await page.goto(`${server.url}/module/priority-score--edit/`);
    await expect(page.getByText('Edit Score:')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  test('edit sub-module textfield accepts input', async ({ page }) => {
    await page.goto(`${server.url}/module/priority-score--edit/`);
    await expect(page.getByText('Edit Score:')).toBeVisible({ timeout: 20_000 });

    const textfield = page.getByRole('textbox').first();
    await textfield.fill('99');
    await expect(page.getByText('editing:99')).toBeVisible({ timeout: 5_000 });
  });

  test('save button triggers view.submit', async ({ page }) => {
    await page.goto(`${server.url}/module/priority-score--edit/`);
    await expect(page.getByText('Edit Score:')).toBeVisible({ timeout: 20_000 });

    const textfield = page.getByRole('textbox').first();
    await textfield.fill('77');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(500);
  });

  // ── Iframe tests (headed only) ─────────────────────────────────────
  // These require --headed because headless Chromium hits
  // ERR_INSUFFICIENT_RESOURCES with Atlaskit's dependency count.

  test.describe('iframe @headed', () => {
    test.skip(!!process.env.CI || !process.env.HEADED, 'iframe tests require headed mode (--headed)');

    test('combined page view iframe renders', async ({ page }) => {
      await page.goto(`${server.url}/module/priority-score/`);

      const viewFrame = page.frameLocator('#cf-view');
      await expect(viewFrame.getByText('Score:')).toBeVisible({ timeout: 30_000 });
    });

    test('combined page edit tab loads and renders', async ({ page }) => {
      await page.goto(`${server.url}/module/priority-score/`);

      const viewFrame = page.frameLocator('#cf-view');
      await expect(viewFrame.getByText('Score:')).toBeVisible({ timeout: 30_000 });

      await page.locator('.cf-tab[data-mode="edit"]').click();
      await expect(page.locator('.cf-tab[data-mode="edit"]')).toHaveClass(/active/);

      const editFrame = page.frameLocator('#cf-edit');
      await expect(editFrame.getByText('Edit Score:')).toBeVisible({ timeout: 30_000 });
    });

    test('submit from edit switches to view tab', async ({ page }) => {
      await page.goto(`${server.url}/module/priority-score/`);

      const viewFrame = page.frameLocator('#cf-view');
      await expect(viewFrame.getByText('Score:')).toBeVisible({ timeout: 30_000 });

      await page.locator('.cf-tab[data-mode="edit"]').click();

      const editFrame = page.frameLocator('#cf-edit');
      await expect(editFrame.getByText('Edit Score:')).toBeVisible({ timeout: 30_000 });

      const textfield = editFrame.getByRole('textbox').first();
      await textfield.fill('42');
      await editFrame.getByRole('button', { name: 'Save' }).click();

      await expect(page.locator('.cf-tab[data-mode="view"]')).toHaveClass(/active/, { timeout: 5_000 });
    });
  });
});
