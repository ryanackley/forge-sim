/**
 * Persistence roundtrip test — OKR Tracker.
 *
 * 1. Deploy OKR Tracker, create data (objectives, key results, progress)
 * 2. Save state (KVS + SQL)
 * 3. Create a fresh simulator, restore state via initSQLFilePath + loadState
 * 4. Re-deploy (migrations should be no-ops since tables exist)
 * 5. Verify all data survived the roundtrip
 */

import { describe, it, expect, afterAll } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createSimulator, ForgeSimulator } from '../simulator.js';
import { deploy } from '../deployer.js';
import { saveState, loadState, getSQLDumpPath } from '../persistence.js';

const OKR_TRACKER_DIR = join(import.meta.dirname, 'fixtures', 'okr-tracker');

describe('Persistence Roundtrip: OKR Tracker', () => {
  let sim1: ForgeSimulator;
  let sim2: ForgeSimulator;
  let stateDir: string;

  // Saved IDs for verification
  let objectiveId: number;
  let keyResultId: number;

  afterAll(async () => {
    await sim1?.stop();
    await sim2?.stop();
    if (stateDir) await rm(stateDir, { recursive: true, force: true }).catch(() => {});
  }, 30_000);

  it('Phase 1: deploy, create data, save state', async () => {
    stateDir = await mkdtemp(join(tmpdir(), 'forge-sim-okr-persist-'));
    sim1 = createSimulator();

    // Mock Jira API
    sim1.mockProductRoutes('jira', {
      'GET /rest/api/3/search': () => ({ total: 5, issues: [] }),
    });

    // Deploy (triggers migrations)
    await sim1.sql.start();
    const result = await sim1.deploy(OKR_TRACKER_DIR);
    expect(result.loadedFunctions).toContain('okrResolver');

    // Verify migrations ran
    const tables = await sim1.sql.query<{ [k: string]: string }>('SHOW TABLES');
    const tableNames = tables.map(r => Object.values(r)[0]);
    expect(tableNames).toContain('objectives');
    expect(tableNames).toContain('key_results');
    expect(tableNames).toContain('progress_updates');

    // Create an objective
    const obj = await sim1.invoke('createObjective', {
      title: 'Ship Forge Sim v1',
      description: 'Get forge-sim to v1.0 release',
      cycle: 'Q1-2026',
    });
    expect(obj.id).toBeDefined();
    objectiveId = obj.id;

    // Create a key result
    const kr = await sim1.invoke('createKeyResult', {
      objective_id: objectiveId,
      title: '100% test coverage',
      target_value: 100,
      unit: 'percent',
      measurement_type: 'manual',
    });
    expect(kr.id).toBeDefined();
    keyResultId = kr.id;

    // Record progress
    await sim1.invoke('recordProgress', {
      key_result_id: keyResultId,
      value: 42,
      note: 'Good progress so far',
    });

    // Also put something in KVS
    await sim1.kvs.set('okr:config', { defaultCycle: 'Q1-2026', theme: 'dark' });

    // Verify data before save
    const objBefore = await sim1.invoke('getObjective', { objectiveId });
    expect(objBefore.objective.title).toBe('Ship Forge Sim v1');

    // Save state
    await saveState(sim1, stateDir);

    // Verify files exist — entities.json holds plain KVS in dump.kvs[]
    const entitiesJson = JSON.parse(await readFile(join(stateDir, 'entities.json'), 'utf-8'));
    const okrConfig = (entitiesJson.kvs ?? []).find(
      (e: { key: string }) => e.key === 'okr:config',
    );
    expect(okrConfig?.value).toEqual({ defaultCycle: 'Q1-2026', theme: 'dark' });

    const sqlDump = await readFile(join(stateDir, 'sql.dump'), 'utf-8');
    expect(sqlDump).toContain('CREATE TABLE');
    expect(sqlDump).toContain('Ship Forge Sim v1');
    expect(sqlDump).toContain('USE forge_app');
    expect(sqlDump).toContain('SET foreign_key_checks = 0');
  }, 60_000);

  it('Phase 2: fresh simulator, restore state, verify data', async () => {
    // Create fresh simulator
    sim2 = createSimulator();

    // Mock Jira API again
    sim2.mockProductRoutes('jira', {
      'GET /rest/api/3/search': () => ({ total: 5, issues: [] }),
    });

    // Set SQL init file BEFORE start (like dev-command does)
    const sqlDumpPath = await getSQLDumpPath(stateDir);
    expect(sqlDumpPath).toBeDefined();
    sim2.sql.setInitSQLFilePath(sqlDumpPath!);

    // Start SQL (will restore from init file)
    await sim2.sql.start();

    // Restore KVS
    await loadState(sim2, stateDir);

    // Re-deploy (migrations should see tables already exist)
    const result = await sim2.deploy(OKR_TRACKER_DIR);
    expect(result.loadedFunctions).toContain('okrResolver');

    // Verify KVS survived
    const config = await sim2.kvs.get('okr:config');
    expect(config).toEqual({ defaultCycle: 'Q1-2026', theme: 'dark' });

    // Verify SQL data survived
    const objResult = await sim2.invoke('getObjective', { objectiveId });
    expect(objResult.objective.title).toBe('Ship Forge Sim v1');
    expect(objResult.objective.description).toBe('Get forge-sim to v1.0 release');

    // Verify key result via listObjectives
    const listResult = await sim2.invoke('listObjectives', { cycle: 'Q1-2026' });
    expect(listResult.objectives.length).toBeGreaterThanOrEqual(1);
    const restored = listResult.objectives.find((o: any) => o.id === objectiveId);
    expect(restored).toBeDefined();
    expect(restored.title).toBe('Ship Forge Sim v1');

    // Verify progress history survived
    const objDetail = await sim2.invoke('getObjective', { objectiveId });
    expect(objDetail.progressUpdates.length).toBeGreaterThanOrEqual(1);
    expect(Number(objDetail.progressUpdates[0].value)).toBe(42);
    expect(objDetail.progressUpdates[0].note).toBe('Good progress so far');

    // Verify we can still write new data (tables are functional)
    const newObj = await sim2.invoke('createObjective', {
      title: 'Post-restore objective',
      description: 'Created after state restore',
      cycle: 'Q1-2026',
    });
    expect(newObj.id).toBeDefined();
    expect(newObj.id).not.toBe(objectiveId); // should be a new ID
  }, 60_000);
});
