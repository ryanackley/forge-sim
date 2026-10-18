/**
 * E2E tests for forge-sim bridge features.
 *
 * Tests each bridge feature (invoke, requestJira, requestConfluence, getContext)
 * across both UI paradigms (Custom UI and UIKit).
 *
 * Custom UI: browser-side JS calls window.__bridge.callBridge()
 * UIKit: server-side code uses @forge/api, results render via ForgeDoc
 */

import { test, expect } from '@playwright/test';
import { startForgeSimDev, type DevServerInstance } from './helpers/forge-sim-harness';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Custom UI Bridge Tests ──────────────────────────────────────────────

test.describe('Custom UI Bridge', () => {
  test.describe.configure({ mode: 'serial' });

  let server: DevServerInstance;

  test.beforeAll(async () => {
    server = await startForgeSimDev({
      appDir: resolve(__dirname, 'fixtures/customui-bridge'),
      timeoutMs: 30_000,
    });
  });

  test.afterAll(async () => {
    await server?.stop();
  });

  test('invoke calls resolver and returns result', async ({ page }) => {
    await page.goto(`${server.url}/module/test-panel/`);
    // Wait for bridge to connect
    await page.waitForFunction(() => (window as any).__bridge?.callBridge, { timeout: 10_000 });

    await page.click('#btn-invoke');
    await expect(page.locator('#invoke-result')).toContainText('echoed', { timeout: 10_000 });

    const text = await page.locator('#invoke-result').textContent();
    const result = JSON.parse(text!);
    expect(result.payload?.message ?? result.message).toBe('hello from custom ui');
  });

  test('requestJira returns product API response', async ({ page }) => {
    await page.goto(`${server.url}/module/test-panel/`);
    await page.waitForFunction(() => (window as any).__bridge?.callBridge, { timeout: 10_000 });

    await page.click('#btn-jira');
    await expect(page.locator('#jira-result')).not.toBeEmpty({ timeout: 10_000 });

    const text = await page.locator('#jira-result').textContent();
    // Should get a response (even if 404 mock — the bridge round-trip worked)
    expect(text).toBeTruthy();
    expect(text).not.toContain('ERROR');
    const result = JSON.parse(text!);
    // fetchProduct returns { status, statusText, body, headers }
    expect(result).toHaveProperty('status');
  });

  test('requestConfluence returns product API response', async ({ page }) => {
    await page.goto(`${server.url}/module/test-panel/`);
    await page.waitForFunction(() => (window as any).__bridge?.callBridge, { timeout: 10_000 });

    await page.click('#btn-confluence');
    await expect(page.locator('#confluence-result')).not.toBeEmpty({ timeout: 10_000 });

    const text = await page.locator('#confluence-result').textContent();
    expect(text).toBeTruthy();
    expect(text).not.toContain('ERROR');
    const result = JSON.parse(text!);
    expect(result).toHaveProperty('status');
  });

  test('getContext returns module context', async ({ page }) => {
    await page.goto(`${server.url}/module/test-panel/`);
    await page.waitForFunction(() => (window as any).__bridge?.callBridge, { timeout: 10_000 });

    await page.click('#btn-context');
    await expect(page.locator('#context-result')).not.toBeEmpty({ timeout: 10_000 });

    const text = await page.locator('#context-result').textContent();
    expect(text).not.toContain('ERROR');
    const ctx = JSON.parse(text!);
    // Context should have moduleKey matching our module
    expect(ctx.moduleKey ?? ctx.extension?.type).toBeTruthy();
  });

  // ── Modal (bridge consolidation) ─────────────────────────────────────
  // Custom UI never had an openModal case: it hit the default arm and
  // resolved undefined. The shared browser host draws a real modal, so the
  // whole round trip — overlay, child frame, submit back to the opener —
  // is now exercised here.

  test('Modal.open draws an overlay and loads the target module in a frame', async ({ page }) => {
    await page.goto(`${server.url}/module/test-panel/`);
    await page.getByRole('button', { name: 'Open Modal' }).click();

    const overlay = page.locator('[data-testid="forge-sim-modal-overlay"]');
    await expect(overlay).toBeVisible({ timeout: 10_000 });
    await expect(overlay).toContainText('Edit Thing');

    const frame = page.frameLocator('[data-testid="forge-sim-modal-iframe"]');
    await expect(frame.getByTestId('modal-heading')).toBeVisible({ timeout: 10_000 });
    // The opener's ?context= rides into the child frame and decodes there.
    await expect(frame.getByTestId('modal-context')).toHaveText('ctx-issue:MODAL-1');
  });

  test('view.submit() inside the modal resolves the opener with the payload', async ({ page }) => {
    await page.goto(`${server.url}/module/test-panel/`);
    await page.getByRole('button', { name: 'Open Modal' }).click();

    const frame = page.frameLocator('[data-testid="forge-sim-modal-iframe"]');
    await expect(frame.getByTestId('modal-heading')).toBeVisible({ timeout: 10_000 });
    await frame.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByTestId('modal-result')).toHaveText('closed:{"saved":"from-modal"}', { timeout: 10_000 });
    await expect(page.locator('[data-testid="forge-sim-modal-overlay"]')).toHaveCount(0);
  });

  test('Escape dismisses the modal and resolves the opener', async ({ page }) => {
    await page.goto(`${server.url}/module/test-panel/`);
    await page.getByRole('button', { name: 'Open Modal' }).click();
    await expect(page.locator('[data-testid="forge-sim-modal-overlay"]')).toBeVisible({ timeout: 10_000 });

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('modal-result')).toHaveText('closed:null', { timeout: 10_000 });
    await expect(page.locator('[data-testid="forge-sim-modal-overlay"]')).toHaveCount(0);
  });
});

// ── UIKit Bridge Tests ──────────────────────────────────────────────────

test.describe('UIKit Bridge', () => {
  test.describe.configure({ mode: 'serial' });

  let server: DevServerInstance;

  test.beforeAll(async () => {
    server = await startForgeSimDev({
      appDir: resolve(__dirname, 'fixtures/uikit-bridge'),
      timeoutMs: 30_000,
    });
  });

  test.afterAll(async () => {
    await server?.stop();
  });

  test('requestJira result renders on page load', async ({ page }) => {
    await page.goto(`${server.url}/module/test-panel/`);
    // UIKit: useEffect calls invoke('getJiraData') → resolver calls requestJira → result renders
    // The resolver wraps the response, so we look for the JSON result
    await expect(page.getByText(/jira-result:jira:\{/)).toBeVisible({ timeout: 15_000 });
    const text = await page.getByText(/jira-result:jira:/).textContent();
    // Should contain the resolver's response with status
    expect(text).toContain('"status"');
  });

  test('useTranslation resolves through the real package: page-relative __LOCALES__ fetches served from src/__LOCALES__', async ({ page }) => {
    await page.goto(`${server.url}/module/test-panel/`);
    await expect(page.getByText('i18n:Hello from locales')).toBeVisible({ timeout: 15_000 });

    // The real file shapes, straight off the dev server.
    const info = await page.request.get(`${server.url}/module/test-panel/__LOCALES__/i18n-info.json`);
    expect(info.status()).toBe(200);
    expect(await info.json()).toEqual({ config: { locales: ['en-US'], fallback: { default: 'en-US' } } });
    // A missing locale is a 404 so the package raises ITS error, as in production.
    const missing = await page.request.get(`${server.url}/module/test-panel/__LOCALES__/xx-XX.json`);
    expect(missing.status()).toBe(404);
  });

  test('requestConfluence via button click updates UI', async ({ page }) => {
    await page.goto(`${server.url}/module/test-panel/`);
    // Wait for initial render
    await expect(page.getByText('conf-result:waiting...')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Test Confluence' }).click();

    // Should update from 'waiting...' to resolver result
    await expect(page.getByText(/conf-result:confluence:\{/)).toBeVisible({ timeout: 15_000 });
  });

  test('invoke calls echo resolver and renders result', async ({ page }) => {
    await page.goto(`${server.url}/module/test-panel/`);
    await expect(page.getByText('echo-result:waiting...')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Test Echo' }).click();

    // Should render the echo response with our message
    await expect(page.getByText(/echo-result:echo:\{/)).toBeVisible({ timeout: 15_000 });
    const text = await page.getByText(/echo-result:echo:/).textContent();
    expect(text).toContain('hello from uikit');
  });
});
