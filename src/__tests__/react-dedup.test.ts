/**
 * Regression test: a Forge app whose project has its own node_modules/react
 * (a different on-disk copy from forge-sim's) must still render correctly.
 *
 * Background — the bug this guards against:
 *   `@forge/react` is a custom React renderer that sets up the hooks dispatcher
 *   on whichever React instance it imported. If the user's bundle imports
 *   `react` and Node resolves it to a DIFFERENT copy than @forge/react's,
 *   the bundle's useState reads from a null dispatcher and dies with
 *   `Cannot read properties of null (reading 'useState')`.
 *
 *   The loader hook deduplicates by intercepting any `react` /
 *   `react-dom` / `react/jsx-*-runtime` import and redirecting to
 *   forge-sim's installed copy. Single React instance across the graph.
 *
 * The fixture's `node_modules/react` is copied in at test setup (not
 * committed) so we exercise the duplication path that real users hit.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { cp, rm, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ForgeSimulator } from '../simulator.js';

const FIXTURE_DIR = join(import.meta.dirname, 'fixtures/react-dedup');
const FIXTURE_NODE_MODULES = join(FIXTURE_DIR, 'node_modules');
const FIXTURE_REACT = join(FIXTURE_NODE_MODULES, 'react');

const FORGE_SIM_REACT = join(import.meta.dirname, '..', '..', 'node_modules', 'react');

describe('React deduplication — project with its own node_modules/react', () => {
  beforeAll(async () => {
    // Copy forge-sim's react into the fixture's node_modules so the bundle
    // resolves it to a DIFFERENT inode than forge-sim's. Without this copy,
    // Node walks up to forge-sim's node_modules and there's no duplication
    // to test against.
    if (!existsSync(FORGE_SIM_REACT)) {
      throw new Error(`forge-sim's react not found at ${FORGE_SIM_REACT}`);
    }
    await rm(FIXTURE_NODE_MODULES, { recursive: true, force: true });
    await cp(FORGE_SIM_REACT, FIXTURE_REACT, { recursive: true });
    // Sanity check
    await access(join(FIXTURE_REACT, 'package.json'));
  }, 30_000);

  afterAll(async () => {
    await rm(FIXTURE_NODE_MODULES, { recursive: true, force: true });
  });

  it('renders a macro that uses useState + useEffect + invoke without crashing', async () => {
    const sim = new ForgeSimulator();
    await sim.deploy(FIXTURE_DIR);

    // Initial render — useEffect hasn't fired yet, so useState's initial
    // null is what renders. If the React-dedup loader hook is broken,
    // this throws "Cannot read properties of null (reading 'useState')"
    // before the loading text ever appears.
    const doc = await sim.ui.render('react-dedup-test');

    expect(doc).not.toBeNull();
    // Component rendered successfully — content reflects useState's initial
    // value before useEffect fired.
    const text = sim.ui.getTextContent(doc!);
    // After invoke resolves, setData triggers a re-render with the resolver
    // payload. We accept either render — the point of this test is "no crash."
    expect(text).toMatch(/Loading|hello from resolver/);
  });

  it('confirms the fixture has its own node_modules/react (test prerequisite)', async () => {
    // Sanity: this test exists to verify our test setup actually creates
    // duplication. If forge-sim's react and the fixture's react point at
    // the same inode, we're not testing what we think we are.
    const { statSync } = await import('node:fs');
    const forgeSimInode = statSync(join(FORGE_SIM_REACT, 'package.json')).ino;
    const fixtureInode = statSync(join(FIXTURE_REACT, 'package.json')).ino;
    expect(fixtureInode, 'fixture react and forge-sim react must be different copies').not.toBe(forgeSimInode);
  });
});
