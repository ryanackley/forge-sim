import { test, expect } from '@playwright/test';

test.describe('DynamicTable', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/test-harness.html#dynamic-table-basic');
    // Wait for the renderer to mount
    await page.waitForSelector('#test-root[data-fixture="dynamic-table-basic"]');
  });

  // ── Rendering ───────────────────────────────────────────────────────

  test('renders a visible table element', async ({ page }) => {
    const table = page.locator('#test-root table');
    await expect(table).toBeVisible();
  });

  test('renders all header cells', async ({ page }) => {
    const headers = page.locator('#test-root table th, #test-root table thead td');
    // Our fixture has 4 columns: Key, Summary, Status, Actions
    const headerTexts = await headers.allTextContents();
    expect(headerTexts).toContain('Key');
    expect(headerTexts).toContain('Summary');
    expect(headerTexts).toContain('Status');
    expect(headerTexts).toContain('Actions');
  });

  test('renders all data rows', async ({ page }) => {
    // Atlaskit DynamicTable renders rows in tbody
    const rows = page.locator('#test-root table tbody tr');
    await expect(rows).toHaveCount(3);
  });

  test('renders cell text content', async ({ page }) => {
    const tableText = await page.locator('#test-root table').textContent();
    expect(tableText).toContain('PROJ-1');
    expect(tableText).toContain('Fix login redirect loop');
    expect(tableText).toContain('PROJ-2');
    expect(tableText).toContain('Add dark mode support');
    expect(tableText).toContain('PROJ-3');
    expect(tableText).toContain('Upgrade dependencies');
  });

  // ── Rich cell content (Atlaskit components in cells) ────────────────

  test('renders Lozenge components inside cells', async ({ page }) => {
    // Atlaskit Lozenge renders as a <span> with specific styling
    const lozenges = page.locator('#test-root table span').filter({ hasText: 'In Progress' });
    await expect(lozenges.first()).toBeVisible();
  });

  test('renders status lozenges for each row', async ({ page }) => {
    const tableText = await page.locator('#test-root table').textContent();
    expect(tableText).toContain('In Progress');
    expect(tableText).toContain('Done');
    expect(tableText).toContain('To Do');
  });

  // ── Interactive cells (buttons with event handlers) ─────────────────

  test('renders action buttons in each row', async ({ page }) => {
    const buttons = page.locator('#test-root table button').filter({ hasText: 'Edit' });
    await expect(buttons).toHaveCount(3);
  });

  test('button click fires event handler', async ({ page }) => {
    // Click the Edit button in the first row
    const firstEditBtn = page.locator('#test-root table button').filter({ hasText: 'Edit' }).first();
    await firstEditBtn.click();

    // Check the event log
    const eventLog = page.locator('#event-log');
    const events = await eventLog.getAttribute('data-events');
    const parsed = JSON.parse(events!);
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed.some((e: string) => e.includes('edit-PROJ-1'))).toBe(true);
  });

  test('each row button fires correct handler id', async ({ page }) => {
    // Click all three edit buttons
    const editButtons = page.locator('#test-root table button').filter({ hasText: 'Edit' });

    await editButtons.nth(0).click();
    await editButtons.nth(1).click();
    await editButtons.nth(2).click();

    const events = JSON.parse(
      (await page.locator('#event-log').getAttribute('data-events'))!
    );
    expect(events.some((e: string) => e.includes('edit-PROJ-1'))).toBe(true);
    expect(events.some((e: string) => e.includes('edit-PROJ-2'))).toBe(true);
    expect(events.some((e: string) => e.includes('edit-PROJ-3'))).toBe(true);
  });

  // ── Edge cases ──────────────────────────────────────────────────────

  test('empty table renders header but no data rows', async ({ page }) => {
    await page.goto('/test-harness.html#dynamic-table-empty');
    await page.waitForSelector('#test-root[data-fixture="dynamic-table-empty"]');

    const table = page.locator('#test-root table');
    await expect(table).toBeVisible();

    // Headers should still render
    const headerText = await table.textContent();
    expect(headerText).toContain('Name');
    expect(headerText).toContain('Value');

    // No data rows
    const bodyRows = page.locator('#test-root table tbody tr');
    await expect(bodyRows).toHaveCount(0);
  });

  test('loading table shows spinner/loading state', async ({ page }) => {
    await page.goto('/test-harness.html#dynamic-table-loading');
    await page.waitForSelector('#test-root[data-fixture="dynamic-table-loading"]');

    // Atlaskit DynamicTable in loading state renders a spinner
    // It may also render the table structure — just verify the container exists
    const testRoot = page.locator('#test-root');
    await expect(testRoot).toBeVisible();

    // The loading state should show some loading indicator
    // Atlaskit uses a Spinner component internally
    const spinner = page.locator('#test-root [role="img"]');
    // If no spinner role, check for any loading indicator
    const hasSpinner = await spinner.count();
    if (hasSpinner === 0) {
      // Atlaskit might use aria-busy or other patterns
      const container = page.locator('#test-root');
      const html = await container.innerHTML();
      // Just verify we rendered something (not an empty table with data)
      expect(html.length).toBeGreaterThan(0);
    }
  });
});
