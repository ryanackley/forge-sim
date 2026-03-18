/**
 * E2E tests for UIKit event propagation.
 *
 * Tests the full round-trip:
 *   UIKit app (useState + handler) → @forge/react reconciler → ForgeDoc (__fn__:id)
 *   → WS → browser renderer (Atlaskit) → DOM event → wireEventHandlers → WS uiEvent
 *   → server fnRegistry lookup → call real function → React re-render → new ForgeDoc
 *
 * Each test verifies that user interaction in the browser triggers a state change
 * in the UIKit app code running on the server, and the updated UI renders back.
 */

import { test, expect } from '@playwright/test';
import { startForgeSimDev, type DevServerInstance } from './helpers/forge-sim-harness';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

test.describe('UIKit Events', () => {
  test.describe.configure({ mode: 'serial' });

  let server: DevServerInstance;

  test.beforeAll(async () => {
    server = await startForgeSimDev({
      appDir: resolve(__dirname, 'fixtures/uikit-events'),
      port: 19530,
      wsPort: 19531,
      timeoutMs: 45_000,
    });
  });

  test.afterAll(() => {
    server?.stop();
  });

  // Helper: navigate and wait for the app to render
  async function loadApp(page: import('@playwright/test').Page) {
    await page.goto(`${server.url}/module/events-panel/`);
    await expect(page.getByText('UIKit Events E2E')).toBeVisible({ timeout: 20_000 });
  }

  // ── 1. Button onClick → state update ─────────────────────────────────

  test('Button onClick updates state', async ({ page }) => {
    await loadApp(page);

    await expect(page.getByText('button-count:0')).toBeVisible();

    await page.getByRole('button', { name: 'Increment' }).click();
    await expect(page.getByText('button-count:1')).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: 'Increment' }).click();
    await expect(page.getByText('button-count:2')).toBeVisible({ timeout: 5_000 });
  });

  // ── 2. Form + Textfield → onSubmit ───────────────────────────────────

  test('Form with Textfield submits collected values', async ({ page }) => {
    await loadApp(page);

    await expect(page.getByText('form-submitted:none')).toBeVisible();

    // Find the Username text field and type into it
    const usernameField = page.getByRole('textbox').first();
    await usernameField.fill('ryan123');

    // Submit the form
    await page.getByRole('button', { name: 'Submit Form' }).click();

    // Should contain the submitted username
    await expect(page.getByText(/form-submitted:.*ryan123/)).toBeVisible({ timeout: 10_000 });
  });

  // ── 3. Form + CheckboxGroup → onSubmit (the gnarly one) ──────────────

  test('Form with CheckboxGroup submits selected values', async ({ page }) => {
    await loadApp(page);

    await expect(page.getByText('checkbox-submitted:none')).toBeVisible();

    // Click Apple and Cherry checkboxes
    await page.getByRole('checkbox', { name: 'Apple' }).check();
    await page.getByRole('checkbox', { name: 'Cherry' }).check();

    // Submit
    await page.getByRole('button', { name: 'Submit Checkboxes' }).click();

    // Should contain both selected values
    const resultText = page.getByText(/checkbox-submitted:\{/);
    await expect(resultText).toBeVisible({ timeout: 10_000 });
    const text = await resultText.textContent();
    expect(text).toContain('apple');
    expect(text).toContain('cherry');
    expect(text).not.toContain('banana');
  });

  // ── 4. TextField onChange (live typing) ───────────────────────────────

  test('TextField onChange fires on typing', async ({ page }) => {
    await loadApp(page);

    await expect(page.getByText('typed:')).toBeVisible();

    // Find the live text field (the one NOT in a form — after form fields)
    // Use a more specific selector
    const section = page.locator('text=textfield-live-test').locator('..');
    const textfield = section.getByRole('textbox');
    await textfield.fill('hello world');

    await expect(page.getByText('typed:hello world')).toBeVisible({ timeout: 5_000 });
  });

  // ── 5. Select onChange ───────────────────────────────────────────────

  test('Select onChange updates on selection', async ({ page }) => {
    await loadApp(page);

    await expect(page.getByText('selected:none')).toBeVisible();

    // Atlaskit Select is a custom dropdown — click to open, then click option
    // The select renders as a div with role=combobox
    const selectSection = page.locator('text=select-test').locator('..');
    const selectInput = selectSection.getByRole('combobox');
    await selectInput.click();

    // Click the "Green" option in the dropdown
    await page.getByText('Green', { exact: true }).click();

    await expect(page.getByText('selected:green')).toBeVisible({ timeout: 5_000 });
  });

  // ── 6. Toggle onChange ───────────────────────────────────────────────

  test('Toggle onChange flips state', async ({ page }) => {
    await loadApp(page);

    await expect(page.getByText('toggled:false')).toBeVisible();

    // Atlaskit Toggle has a decorative span that intercepts pointer events
    // Use force:true to bypass the interception check, or click the label
    const toggleSection = page.locator('text=toggle-test').locator('..');
    const toggle = toggleSection.getByRole('checkbox');
    await toggle.click({ force: true });

    await expect(page.getByText('toggled:true')).toBeVisible({ timeout: 5_000 });
  });

  // ── 7. DynamicTable with Button in cell ──────────────────────────────

  test('Button inside DynamicTable cell fires onClick', async ({ page }) => {
    await loadApp(page);

    await expect(page.getByText('table-clicked:none')).toBeVisible();

    // Verify the table rendered with both items
    await expect(page.getByText('Item Alpha')).toBeVisible();
    await expect(page.getByText('Item Beta')).toBeVisible();

    // Click the button inside the first row
    await page.getByRole('button', { name: 'Click Alpha' }).click();
    await expect(page.getByText('table-clicked:alpha')).toBeVisible({ timeout: 5_000 });

    // Click the button in the second row
    await page.getByRole('button', { name: 'Click Beta' }).click();
    await expect(page.getByText('table-clicked:beta')).toBeVisible({ timeout: 5_000 });
  });

  // ── 8. RadioGroup onChange ───────────────────────────────────────────

  test('RadioGroup onChange updates on selection', async ({ page }) => {
    await loadApp(page);

    await expect(page.getByText('radio-picked:none')).toBeVisible();

    await page.getByRole('radio', { name: 'Medium' }).check();
    await expect(page.getByText('radio-picked:medium')).toBeVisible({ timeout: 5_000 });

    await page.getByRole('radio', { name: 'Large' }).check();
    await expect(page.getByText('radio-picked:large')).toBeVisible({ timeout: 5_000 });
  });

  // ── 9. InlineEdit onConfirm ──────────────────────────────────────────

  test('InlineEdit onConfirm updates value', async ({ page }) => {
    await loadApp(page);

    await expect(page.getByText('edited:Click to edit')).toBeVisible();

    // Click the read view to enter edit mode
    await page.getByText('Click to edit').first().click();

    // Find the edit field and type new value
    const editField = page.getByRole('textbox').last();
    await editField.fill('New Value');

    // Confirm by pressing Enter or clicking confirm button
    await editField.press('Enter');

    await expect(page.getByText('edited:New Value')).toBeVisible({ timeout: 5_000 });
  });
});
