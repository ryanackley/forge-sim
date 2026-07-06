/**
 * The "Your First Test" example from docs/testing/README.md, running for real.
 *
 * The #region below must stay byte-identical (whitespace-normalized) to the
 * doc's fenced block — docs-examples-sync.test.ts enforces it. This file
 * deliberately lives inside the fixture app's test/ directory so that
 * `resolve(import.meta.dirname, '..')` resolves to the app root exactly as it
 * would in a reader's project.
 */
// #region first-test
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createSimulator, type ForgeSimulator } from 'forge-sim';
import { resolve } from 'node:path';

describe('My Forge App', () => {
  let sim: ForgeSimulator;

  beforeAll(async () => {
    sim = createSimulator();
    await sim.deploy(resolve(import.meta.dirname, '..'));
  });

  afterAll(async () => {
    await sim.stop();
  });

  it('creates a thing', async () => {
    const result = await sim.invoke('createItem', { title: 'Hello' });
    expect(result.success).toBe(true);
  });
});
// #endregion
