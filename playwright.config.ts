import { defineConfig } from '@playwright/test';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load e2e secrets from .env.e2e (not committed to git)
try {
  const { config: dotenvConfig } = await import('dotenv');
  dotenvConfig({ path: resolve(__dirname, '.env.e2e') });
} catch {
  // dotenv is optional — tests work without .env.e2e
}

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000, // visual tests need time for forge-sim dev startup
  retries: 0,
  workers: 1, // e2e tests share ports/state — run sequentially

  expect: {
    toHaveScreenshot: {
      // Allow small anti-aliasing / font rendering differences across runs
      maxDiffPixelRatio: 0.01,
      // Animations can cause pixel jitter
      animations: 'disabled',
    },
  },

  use: {
    headless: true,
    baseURL: 'http://localhost:19421',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Consistent viewport for visual baselines
    viewport: { width: 1280, height: 900 },
  },

  outputDir: './e2e/test-results',

  projects: [
    {
      name: 'e2e',
      testMatch: '**/*.e2e.ts',
    },
    {
      name: 'bridge',
      testMatch: '**/*.spec.ts',
    },
  ],
});
