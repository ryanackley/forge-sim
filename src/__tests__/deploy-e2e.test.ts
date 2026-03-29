/**
 * Deploy-based E2E tests — deploy real fixture apps through the full pipeline
 * and invoke resolvers through the deployed wiring.
 *
 * Unlike the manually-wired retro-board-e2e and okr-tracker-e2e tests,
 * these tests use sim.deploy(appDir) which:
 *   1. Reads manifest.yml
 *   2. Dynamically imports handler modules
 *   3. Wires resolvers, consumers, triggers via manifest
 *   4. Fires scheduled triggers (e.g. migrations)
 *
 * This catches deployer regressions the manual tests won't.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { resolve } from 'node:path';
import { createSimulator, ForgeSimulator } from '../simulator.js';
import { resetBridge } from '../ui/bridge.js';

const RETRO_BOARD_DIR = resolve(import.meta.dirname, 'fixtures/retro-board');
const OKR_TRACKER_DIR = resolve(import.meta.dirname, 'fixtures/okr-tracker');

// ─────────────────────────────────────────────────────────────────────────────
// Retro Board — deploy-based (KVS + Queues + Triggers, no SQL)
// ─────────────────────────────────────────────────────────────────────────────

describe('Deploy E2E: Retro Board', () => {
  let sim: ForgeSimulator;

  beforeAll(async () => {
    sim = createSimulator();

    const result = await sim.deploy(RETRO_BOARD_DIR);

    // UI resource may fail (React component issues in test env) — that's fine,
    // we're testing the backend pipeline here
    const backendErrors = result.errors.filter(e => !e.error.includes('Resource'));
    expect(backendErrors).toHaveLength(0);
    expect(result.loadedFunctions).toContain('retroResolver');
    expect(result.loadedFunctions).toContain('processVoteFn');
    expect(result.loadedFunctions).toContain('processItemFn');
    expect(result.loadedFunctions).toContain('generateSummaryFn');
    expect(result.loadedFunctions).toContain('onSprintCompleteFn');
  });

  it('deploys all functions from manifest', () => {
    const manifest = sim.getManifest();
    expect(manifest).not.toBeNull();
    expect(manifest!.raw.app.name).toBe('Sprint Retro Board');
    expect(manifest!.functions.size).toBe(5);
    expect(manifest!.consumers).toHaveLength(3);
    expect(manifest!.triggers).toHaveLength(1);
  });

  it('resolvers are invocable after deploy', async () => {
    const result = await sim.invoke('getBoard', { sprintId: 'deploy-test' });
    expect(result.board).toBeDefined();
    expect(result.board.items).toHaveLength(0);
    expect(result.board.closed).toBe(false);
  });

  it('addItem → getBoard round-trip through deployed resolvers + consumers', async () => {
    const sid = 'deploy-roundtrip';

    await sim.invoke('addItem', { sprintId: sid, text: 'Deployed item', category: 'went-well' });
    await sim.invoke('addItem', { sprintId: sid, text: 'Another item', category: 'improve' });

    const { board } = await sim.invoke('getBoard', { sprintId: sid });
    expect(board.items).toHaveLength(2);
    expect(board.items.map((i: any) => i.text)).toContain('Deployed item');
    expect(board.items.map((i: any) => i.text)).toContain('Another item');
  });

  it('voting works through deployed consumer wiring', async () => {
    const sid = 'deploy-votes';

    const { item } = await sim.invoke('addItem', { sprintId: sid, text: 'Vote me', category: 'went-well' });

    // submitVote uses context.accountId as voterId (not payload.voterId)
    // so we need to switch context between invokes
    sim.resolver.setContext({ accountId: 'alice' });
    await sim.invoke('submitVote', { sprintId: sid, itemId: item.id });
    sim.resolver.setContext({ accountId: 'bob' });
    await sim.invoke('submitVote', { sprintId: sid, itemId: item.id });
    // Duplicate — same accountId as first vote, should be blocked
    sim.resolver.setContext({ accountId: 'alice' });
    await sim.invoke('submitVote', { sprintId: sid, itemId: item.id });

    const { board } = await sim.invoke('getBoard', { sprintId: sid });
    const voted = board.items.find((i: any) => i.id === item.id);
    expect(voted.votes).toBe(2);
  });

  it('closeRetro generates summary through deployed queue pipeline', async () => {
    const sid = 'deploy-close';

    await sim.invoke('addItem', { sprintId: sid, text: 'Great CI', category: 'went-well' });
    await sim.invoke('addItem', { sprintId: sid, text: 'Slow reviews', category: 'improve' });
    await sim.invoke('addItem', { sprintId: sid, text: 'Automate reviews', category: 'action-items' });

    await sim.invoke('closeRetro', { sprintId: sid });

    const { board } = await sim.invoke('getBoard', { sprintId: sid });
    expect(board.closed).toBe(true);
    expect(board.summary).toBeDefined();
    expect(board.summary).toContain('Retro Summary');
    expect(board.summary).toContain('Great CI');
    expect(board.summary).toContain('Slow reviews');
    expect(board.summary).toContain('Automate reviews');
  });

  it('fireTrigger works with deployed trigger wiring', async () => {
    // Trigger handler now correctly receives (event, context) as two args
    // so event.sprint.id is properly extracted
    const sid = '99';
    await sim.invoke('addItem', { sprintId: sid, text: 'Trigger test', category: 'went-well' });

    const results = await sim.fireTrigger('avi:jira:sprint:completed', {
      sprint: { id: 99 },
    });

    expect(results).toHaveLength(1);
    expect(results[0].triggered).toBe(true);
    expect(results[0].sprintId).toBe('99');

    const { board } = await sim.invoke('getBoard', { sprintId: sid });
    expect(board.summary).toContain('Trigger test');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OKR Tracker — deploy-based (SQL + KVS + Queues + Consumers + Triggers)
// ─────────────────────────────────────────────────────────────────────────────

describe('Deploy E2E: OKR Tracker', () => {
  let sim: ForgeSimulator;

  beforeAll(async () => {
    sim = createSimulator();

    // Start MySQL before deploy — deployer fires scheduled trigger (migration)
    await sim.sql.start();

    // Mock Jira API for recalcKeyResult consumer
    sim.mockProductRoutes('jira', {
      'GET /rest/api/3/search': (path: string) => {
        // Parse JQL from query string to return different results
        const url = new URL(path, 'http://localhost');
        const jql = url.searchParams.get('jql') || '';

        if (jql.includes('done')) {
          return { total: 12, issues: [] };
        }
        return { total: 5, issues: [] };
      },
    });

    const result = await sim.deploy(OKR_TRACKER_DIR);

    // Deployer should have loaded all 5 functions
    expect(result.loadedFunctions).toContain('okrResolver');
    expect(result.loadedFunctions).toContain('runMigrationFn');
    expect(result.loadedFunctions).toContain('recalcKrFn');
    expect(result.loadedFunctions).toContain('snapshotProgressFn');
    expect(result.loadedFunctions).toContain('onSprintCompleteFn');

    // Scheduled trigger should have fired migrations (no errors)
    const migrationErrors = result.errors.filter(e => e.functionKey === 'runMigrationFn');
    expect(migrationErrors).toHaveLength(0);
  }, 60_000);

  afterAll(async () => {
    await sim.stop();
  }, 30_000);

  it('migrations ran — tables exist', async () => {
    const tables = await sim.sql.query<{ [k: string]: string }>('SHOW TABLES');
    const tableNames = tables.map(r => Object.values(r)[0]);

    expect(tableNames).toContain('objectives');
    expect(tableNames).toContain('key_results');
    expect(tableNames).toContain('progress_updates');
    // Migration runner creates its own tracking table
    expect(tableNames).toContain('__migrations');
  });

  it('createObjective + listObjectives through deployed resolvers', async () => {
    const createResult = await sim.invoke('createObjective', {
      title: 'Ship v2.0',
      description: 'Major release',
      cycle: 'Q1-2026',
    });
    expect(createResult.success).toBe(true);
    expect(createResult.id).toBeDefined();

    const listResult = await sim.invoke('listObjectives', { cycle: 'Q1-2026' });
    expect(listResult.objectives.length).toBeGreaterThanOrEqual(1);

    const found = listResult.objectives.find((o: any) => o.id === createResult.id);
    expect(found).toBeDefined();
    expect(found.title).toBe('Ship v2.0');
    expect(found.status).toBe('active');
  });

  it('getObjective returns details with key results', async () => {
    // Create objective + KR
    const { id: objId } = await sim.invoke('createObjective', {
      title: 'Improve quality',
      cycle: 'Q1-2026',
    });

    const { id: krId } = await sim.invoke('createKeyResult', {
      objective_id: objId,
      title: 'Reduce bug count',
      target_value: 50,
      unit: 'count',
      measurement_type: 'manual',
    });

    const result = await sim.invoke('getObjective', { objectiveId: objId });
    expect(result.objective.title).toBe('Improve quality');
    expect(result.keyResults).toHaveLength(1);
    expect(result.keyResults[0].title).toBe('Reduce bug count');
    expect(Number(result.keyResults[0].target_value)).toBe(50);
  });

  it('recordProgress updates KR value and status', async () => {
    const { id: objId } = await sim.invoke('createObjective', {
      title: 'Progress test',
      cycle: 'Q2-2026',
    });

    const { id: krId } = await sim.invoke('createKeyResult', {
      objective_id: objId,
      title: 'Complete tasks',
      target_value: 100,
      unit: 'count',
      measurement_type: 'manual',
    });

    // Set config for thresholds
    await sim.kvs.set('config:display', {
      default_cycle: 'Q2-2026',
      color_thresholds: { on_track: 70, at_risk: 40 },
    });

    // Record 30% progress → behind
    await sim.invoke('recordProgress', { key_result_id: krId, value: 30, note: 'Started' });
    let kr = (await sim.invoke('getObjective', { objectiveId: objId })).keyResults[0];
    expect(Number(kr.current_value)).toBe(30);
    expect(kr.status).toBe('behind');

    // Record 50% → at-risk
    await sim.invoke('recordProgress', { key_result_id: krId, value: 50 });
    kr = (await sim.invoke('getObjective', { objectiveId: objId })).keyResults[0];
    expect(kr.status).toBe('at-risk');

    // Record 80% → on-track
    await sim.invoke('recordProgress', { key_result_id: krId, value: 80 });
    kr = (await sim.invoke('getObjective', { objectiveId: objId })).keyResults[0];
    expect(kr.status).toBe('on-track');

    // Record 100% → completed
    await sim.invoke('recordProgress', { key_result_id: krId, value: 100 });
    kr = (await sim.invoke('getObjective', { objectiveId: objId })).keyResults[0];
    expect(kr.status).toBe('completed');
  });

  it('getProgressHistory returns time series', async () => {
    const { id: objId } = await sim.invoke('createObjective', {
      title: 'History test',
      cycle: 'Q2-2026',
    });

    const { id: krId } = await sim.invoke('createKeyResult', {
      objective_id: objId,
      title: 'Track history',
      target_value: 100,
      unit: '%',
      measurement_type: 'manual',
    });

    await sim.invoke('recordProgress', { key_result_id: krId, value: 10, note: 'Week 1' });
    await sim.invoke('recordProgress', { key_result_id: krId, value: 35, note: 'Week 2' });
    await sim.invoke('recordProgress', { key_result_id: krId, value: 60, note: 'Week 3' });

    const { updates } = await sim.invoke('getProgressHistory', { key_result_id: krId });
    expect(updates).toHaveLength(3);
    // Verify all values present (order may vary within same timestamp)
    const values = updates.map((u: any) => Number(u.value));
    expect(values).toContain(10);
    expect(values).toContain(35);
    expect(values).toContain(60);
    const notes = updates.map((u: any) => u.note);
    expect(notes).toContain('Week 1');
    expect(notes).toContain('Week 2');
    expect(notes).toContain('Week 3');
  });

  it('getCycleSummary returns aggregated stats', async () => {
    // Use a fresh cycle to get clean numbers
    const cycle = 'Q3-2026-deploy';

    const { id: obj1 } = await sim.invoke('createObjective', { title: 'Obj A', cycle });
    const { id: obj2 } = await sim.invoke('createObjective', { title: 'Obj B', cycle });

    await sim.invoke('createKeyResult', {
      objective_id: obj1, title: 'KR-A1', target_value: 100, unit: 'count', measurement_type: 'manual',
    });
    await sim.invoke('createKeyResult', {
      objective_id: obj2, title: 'KR-B1', target_value: 50, unit: 'count', measurement_type: 'manual',
    });

    const { summary } = await sim.invoke('getCycleSummary', { cycle });
    expect(Number(summary.total_objectives)).toBe(2);
    expect(Number(summary.total_key_results)).toBe(2);
  });

  it('updateObjectiveStatus changes status', async () => {
    const { id } = await sim.invoke('createObjective', {
      title: 'Status test',
      cycle: 'Q2-2026',
    });

    await sim.invoke('updateObjectiveStatus', { objectiveId: id, status: 'completed' });

    const result = await sim.invoke('getObjective', { objectiveId: id });
    expect(result.objective.status).toBe('completed');
  });

  it('jira-linked KR triggers recalc consumer via deployed queue wiring', async () => {
    const { id: objId } = await sim.invoke('createObjective', {
      title: 'Jira integration',
      cycle: 'Q1-2026',
    });

    // Creating a jira-linked KR should push to recalcQueue → consumer fires
    const { id: krId } = await sim.invoke('createKeyResult', {
      objective_id: objId,
      title: 'Close bugs',
      target_value: 20,
      unit: 'count',
      measurement_type: 'jira-linked',
      jira_config: { jql: 'project = BUG AND status = done', metric: 'count' },
    });

    // Consumer should have updated current_value from mocked Jira response (12 for 'done' jql)
    const result = await sim.invoke('getObjective', { objectiveId: objId });
    const kr = result.keyResults.find((k: any) => k.id === krId);
    expect(kr).toBeDefined();
    expect(Number(kr.current_value)).toBe(12);

    // Jira config should be in KVS
    expect(result.jiraConfigs[krId]).toBeDefined();
    expect(result.jiraConfigs[krId].jql).toContain('done');
  });

  it('fireTrigger dispatches sprint complete through deployed wiring', async () => {
    // Set cycle config
    await sim.kvs.set('config:display', {
      default_cycle: 'Q1-2026',
      color_thresholds: { on_track: 70, at_risk: 40 },
    });

    const results = await sim.fireTrigger('avi:jira:sprint:completed', {
      sprint: { name: 'Sprint 10' },
    });

    expect(results).toHaveLength(1);
    expect(results[0].triggered).toBe(true);
    expect(results[0].cycle).toBe('Q1-2026');
  });

  it('full deploy flow: create → track → summarize', async () => {
    const cycle = 'Q4-2026-full';

    await sim.kvs.set('config:display', {
      default_cycle: cycle,
      color_thresholds: { on_track: 70, at_risk: 40 },
    });

    // Create objective hierarchy
    const { id: parentId } = await sim.invoke('createObjective', {
      title: 'Platform Reliability', cycle,
    });
    const { id: childId } = await sim.invoke('createObjective', {
      title: 'Reduce Downtime', cycle, parent_id: parentId,
    });

    // Add key results
    const { id: kr1 } = await sim.invoke('createKeyResult', {
      objective_id: parentId, title: 'Uptime %', target_value: 100, unit: '%', measurement_type: 'manual',
    });
    const { id: kr2 } = await sim.invoke('createKeyResult', {
      objective_id: childId, title: 'Incident count', target_value: 10, unit: 'count', measurement_type: 'manual',
    });

    // Record progress
    await sim.invoke('recordProgress', { key_result_id: kr1, value: 99.5, note: 'Almost there' });
    await sim.invoke('recordProgress', { key_result_id: kr2, value: 3, note: 'Q4 looking good' });

    // Verify parent shows child
    const parentResult = await sim.invoke('getObjective', { objectiveId: parentId });
    expect(parentResult.children).toHaveLength(1);
    expect(parentResult.children[0].title).toBe('Reduce Downtime');

    // Verify cycle summary
    const { summary } = await sim.invoke('getCycleSummary', { cycle });
    expect(Number(summary.total_objectives)).toBe(2);
    expect(Number(summary.total_key_results)).toBe(2);
    expect(Number(summary.avg_completion)).toBeGreaterThan(0);

    // Complete the parent
    await sim.invoke('updateObjectiveStatus', { objectiveId: parentId, status: 'completed' });
    const { summary: updated } = await sim.invoke('getCycleSummary', { cycle });
    expect(Number(updated.completed_objectives)).toBeGreaterThanOrEqual(1);
  });
});
