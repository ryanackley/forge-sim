/**
 * Visual regression tests for UIKit 2 component rendering.
 *
 * Uses the kitchen-sink app (e2e/fixtures/kitchen-sink) which renders every
 * UIKit 2 component on a single page. forge-sim dev serves it, then
 * Playwright screenshots each section and compares against baselines.
 *
 * Baselines are stored in e2e/kitchen-sink-visual.e2e.ts-snapshots/.
 * To update baselines: npm run test:e2e -- --update-snapshots
 *
 * Sections:
 *   1. Typography          8. Navigation
 *   2. Buttons             9. Overlays
 *   3. Form Controls      10. Charts
 *   4. Display            11. Users
 *   5. Feedback           12. Editors
 *   6. Layout             13. ADF Renderer
 *   7. Data               14. Product Context
 */

import { test, expect } from '@playwright/test';
import { type ChildProcess, spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KITCHEN_SINK_DIR = resolve(__dirname, 'fixtures/kitchen-sink');
const DEV_PORT = 19500;
const WS_PORT = 19501;
const DEV_URL = `http://localhost:${DEV_PORT}`;

// How long to wait for forge-sim dev to be ready
const STARTUP_TIMEOUT = 30_000;

let devProcess: ChildProcess;

/**
 * Start forge-sim dev for the kitchen-sink app.
 * Waits until the Vite dev server is serving content.
 */
async function startDevServer(): Promise<void> {
  const forgeSim = resolve(__dirname, '..', 'src', 'cli.ts');

  devProcess = spawn(
    'npx', ['tsx', forgeSim, 'dev', '--port', String(DEV_PORT), '--ws-port', String(WS_PORT), '--no-open'],
    {
      cwd: KITCHEN_SINK_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
      detached: true,
    }
  );

  // Log stderr for debugging
  devProcess.stderr?.on('data', (data: Buffer) => {
    const line = data.toString().trim();
    if (line) console.log(`[forge-sim] ${line}`);
  });

  devProcess.stdout?.on('data', (data: Buffer) => {
    const line = data.toString().trim();
    if (line) console.log(`[forge-sim] ${line}`);
  });

  // Wait for the server to be ready by polling
  const start = Date.now();
  while (Date.now() - start < STARTUP_TIMEOUT) {
    try {
      const resp = await fetch(DEV_URL, { signal: AbortSignal.timeout(2000) });
      if (resp.ok) return;
    } catch {
      // Not ready yet
    }
    await new Promise(r => setTimeout(r, 500));
  }

  throw new Error(`forge-sim dev didn't start within ${STARTUP_TIMEOUT}ms`);
}

function stopDevServer(): void {
  if (devProcess?.pid) {
    // Kill the entire process group (npx → tsx → node) not just the parent
    try {
      process.kill(-devProcess.pid, 'SIGTERM');
    } catch {
      // process group kill failed — try direct
      try { devProcess.kill('SIGTERM'); } catch {}
    }
    setTimeout(() => {
      try { process.kill(-devProcess.pid!, 'SIGKILL'); } catch {}
    }, 2000);
  }
}

// ── Test Setup ──────────────────────────────────────────────────────────

test.describe('Kitchen Sink Visual Regression', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    await startDevServer();
  });

  test.afterAll(() => {
    stopDevServer();
  });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    // Navigate directly to the kitchen-sink module (not the module picker)
    await page.goto(`${DEV_URL}/module/kitchen-sink/`);
    // Wait for the app to fully render — look for a section heading
    await page.waitForSelector('text=1. Typography', { timeout: 15000 });
    // Extra settle time for fonts, charts, async components
    await page.waitForTimeout(1500);
  });

  // ── Full page baseline ────────────────────────────────────────────

  test('full page render', async ({ page }) => {
    // Mask dynamic content: random picsum image, calendar (shows today's date)
    const masks = [
      page.locator('img[src*="picsum"]'),
      page.locator('[class*="calendar"], [aria-label*="calendar"]').first(),
    ];

    await expect(page).toHaveScreenshot('full-page.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
      mask: masks,
    });
  });

  // ── Section screenshots ───────────────────────────────────────────

  const sections = [
    { name: 'typography', heading: '1. Typography' },
    { name: 'buttons', heading: '2. Buttons' },
    { name: 'form-controls', heading: '3. Form Controls' },
    { name: 'display', heading: '4. Display' },
    { name: 'feedback', heading: '5. Feedback' },
    { name: 'layout', heading: '6. Layout' },
    { name: 'data', heading: '7. Data' },
    { name: 'navigation', heading: '8. Navigation' },
    { name: 'overlays', heading: '9. Overlays' },
    { name: 'charts', heading: '10. Charts' },
    { name: 'users', heading: '11. Users' },
    { name: 'editors', heading: '12. Editors' },
    { name: 'adf-renderer', heading: '13. ADF Renderer' },
    { name: 'product-context', heading: '14. Product Context' },
  ];

  for (const section of sections) {
    test(`section: ${section.name}`, async ({ page }) => {
      // Scroll the section heading into view and take a viewport screenshot.
      // This captures the section content visible from that scroll position.
      // Use text= locator since Atlaskit Heading may not render as native h2.
      const heading = page.getByText(section.heading, { exact: true }).first();
      await heading.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300); // settle after scroll

      // Mask known dynamic content (random image, calendar date, product context JSON)
      const masks = [
        page.locator('img[src*="picsum"]'),
        page.locator('[class*="calendar"], [aria-label*="calendar"]').first(),
      ];

      await expect(page).toHaveScreenshot(`section-${section.name}.png`, {
        maxDiffPixelRatio: 0.02,
        mask: masks,
      });
    });
  }

  // ── Interactive state screenshots ─────────────────────────────────

  test('modal open state', async ({ page }) => {
    // Scroll to overlays section and click "Open Modal"
    const openBtn = page.locator('button:has-text("Open Modal")');
    await openBtn.scrollIntoViewIfNeeded();
    await openBtn.click();

    // Wait for modal to appear
    await page.waitForSelector('text=Sample Modal', { timeout: 5000 });
    await page.waitForTimeout(500); // animation settle

    // Screenshot the modal overlay
    await expect(page).toHaveScreenshot('modal-open.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('tab switching', async ({ page }) => {
    // Navigate to tabs section
    const detailsTab = page.locator('div[role="tab"]:has-text("Details")');
    await detailsTab.scrollIntoViewIfNeeded();
    await detailsTab.click();
    await page.waitForTimeout(300);

    // Screenshot the tab panel content
    const tabContent = page.locator('text=Project ID: KS-2024-001');
    await tabContent.scrollIntoViewIfNeeded();
    await expect(tabContent.locator('xpath=ancestor::div[contains(@role, "tabpanel")]').first())
      .toHaveScreenshot('tab-details.png', { maxDiffPixelRatio: 0.01 });
  });
});
