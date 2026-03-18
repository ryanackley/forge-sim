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
      port: 19510,
      wsPort: 19511,
      timeoutMs: 30_000,
    });
  });

  test.afterAll(() => {
    server?.stop();
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
});

// ── UIKit Bridge Tests ──────────────────────────────────────────────────

test.describe('UIKit Bridge', () => {
  test.describe.configure({ mode: 'serial' });

  let server: DevServerInstance;

  test.beforeAll(async () => {
    server = await startForgeSimDev({
      appDir: resolve(__dirname, 'fixtures/uikit-bridge'),
      port: 19520,
      wsPort: 19521,
      timeoutMs: 30_000,
    });
  });

  test.afterAll(() => {
    server?.stop();
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

  test('requestConfluence via button click updates UI', async ({ page }) => {
    await page.goto(`${server.url}/module/test-panel/`);
    // Wait for initial render
    await expect(page.getByText('conf-result:waiting...')).toBeVisible({ timeout: 15_000 });

    // UIKit Button 'text' prop may not render as visible text in the Atlaskit button
    // (ForgeDoc reconciler issue — text prop vs children). Use nth button selector.
    const buttons = page.getByRole('button');
    await buttons.first().click();

    // Should update from 'waiting...' to resolver result
    await expect(page.getByText(/conf-result:confluence:\{/)).toBeVisible({ timeout: 15_000 });
  });

  test('invoke calls echo resolver and renders result', async ({ page }) => {
    await page.goto(`${server.url}/module/test-panel/`);
    await expect(page.getByText('echo-result:waiting...')).toBeVisible({ timeout: 15_000 });

    // Second button triggers echo
    const buttons = page.getByRole('button');
    await buttons.nth(1).click();

    // Should render the echo response with our message
    await expect(page.getByText(/echo-result:echo:\{/)).toBeVisible({ timeout: 15_000 });
    const text = await page.getByText(/echo-result:echo:/).textContent();
    expect(text).toContain('hello from uikit');
  });
});
