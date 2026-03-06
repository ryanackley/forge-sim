/**
 * OKR Tracker — end-to-end integration tests.
 *
 * Uses BOTH SQL (real MySQL via forge-sql shim chain) and KVS (entity store)
 * to test the full OKR Tracker Forge app: objectives, key results, progress
 * tracking, Jira-linked recalculation, snapshots, and triggers.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ForgeSimulator, setSimulator } from '../simulator.js';
import {
  CREATE_OBJECTIVES_TABLE,
  CREATE_KEY_RESULTS_TABLE,
  CREATE_PROGRESS_UPDATES_TABLE,
} from './fixtures/okr-tracker/src/migrations/schema.js';
import type {
  OkrDisplayConfig,
  KrJiraConfig,
} from './fixtures/okr-tracker/src/types/index.js';

// Real @forge/sql and @forge/kvs — dynamically imported after setSimulator()
let sql: any;
let kvs: any;

describe('OKR Tracker E2E', () => {
  let sim: ForgeSimulator;

  beforeAll(async () => {
    sim = new ForgeSimulator();
    setSimulator(sim);
    await sim.sql.start();

    // Import real shim-routed packages
    const forgeSql = await import('@forge/sql');
    const forgeKvs = await import('@forge/kvs');
    sql = forgeSql.sql;
    kvs = forgeKvs.kvs;

    // Run DDL migrations
    await sql.executeRaw(CREATE_OBJECTIVES_TABLE);
    await sql.executeRaw(CREATE_KEY_RESULTS_TABLE);
    await sql.executeRaw(CREATE_PROGRESS_UPDATES_TABLE);

    // Seed default display config
    const displayConfig: OkrDisplayConfig = {
      default_cycle: 'Q1-2026',
      visible_statuses: ['active', 'completed'],
      dashboard_layout: 'grid',
      color_thresholds: { on_track: 70, at_risk: 40 },
    };
    await sim.kvs.set('config:display', displayConfig);

    // ── Queues ────────────────────────────────────────────────────────
    const recalcQueue = sim.createQueue({ key: 'recalcQueue' });
    const snapshotQueue = sim.createQueue({ key: 'snapshotQueue' });

    // ── Import app logic ──────────────────────────────────────────────
    const objectives = await import('./fixtures/okr-tracker/src/resolvers/objectives.js');
    const keyResults = await import('./fixtures/okr-tracker/src/resolvers/key-results.js');
    const consumers = await import('./fixtures/okr-tracker/src/resolvers/consumers.js');
    const triggers = await import('./fixtures/okr-tracker/src/resolvers/triggers.js');

    // ── Resolvers ─────────────────────────────────────────────────────
    const ctx = { accountId: 'user-1' };

    sim.resolver.define('listObjectives', (req) =>
      objectives.listObjectives({ payload: req.payload, context: req.context ?? ctx }));
    sim.resolver.define('getObjective', (req) =>
      objectives.getObjective({ payload: req.payload, context: req.context ?? ctx }));
    sim.resolver.define('createObjective', (req) =>
      objectives.createObjective({ payload: req.payload, context: req.context ?? ctx }));
    sim.resolver.define('updateObjectiveStatus', (req) =>
      objectives.updateObjectiveStatus({ payload: req.payload, context: req.context ?? ctx }));
    sim.resolver.define('getCycleSummary', (req) =>
      objectives.getCycleSummary({ payload: req.payload, context: req.context ?? ctx }));
    sim.resolver.define('createKeyResult', (req) =>
      keyResults.createKeyResult({ payload: req.payload, context: req.context ?? ctx }));
    sim.resolver.define('recordProgress', (req) =>
      keyResults.recordProgress({ payload: req.payload, context: req.context ?? ctx }));
    sim.resolver.define('getProgressHistory', (req) =>
      keyResults.getProgressHistory({ payload: req.payload, context: req.context ?? ctx }));
    sim.resolver.define('updateKrConfig', (req) =>
      keyResults.updateKrConfig({ payload: req.payload, context: req.context ?? ctx }));

    // ── Consumers ─────────────────────────────────────────────────────
    sim.registerConsumer('recalcQueue', consumers.recalcKeyResult);
    sim.registerConsumer('snapshotQueue', consumers.snapshotProgress);

    // ── Trigger handler ───────────────────────────────────────────────
    sim.resolver.define('onSprintCompleteFn', (req) =>
      triggers.onSprintComplete(req.payload));

    // ── Manifest (for fireTrigger) ────────────────────────────────────
    sim.loadManifest(`
modules:
  function:
    - key: onSprintCompleteFn
      handler: index.onSprintComplete
  trigger:
    - key: sprint-complete-trigger
      function: onSprintCompleteFn
      events:
        - avi:jira:sprint:completed
  consumer:
    - key: recalc-consumer
      function: recalcKrFn
      queue: recalcQueue
    - key: snapshot-consumer
      function: snapshotProgressFn
      queue: snapshotQueue
app:
  id: ari:cloud:ecosystem::app/okr-tracker-test
  name: OKR Tracker
`);
  }, 60_000);

  afterAll(async () => {
    await sim.stop();
  }, 30_000);

  // ── 1. Migrations ─────────────────────────────────────────────────────

  describe('Migrations', () => {
    it('tables exist after DDL', async () => {
      const tables = await sql.executeRaw('SHOW TABLES');
      const tableNames = tables.rows.map((r: any) => Object.values(r)[0]);
      expect(tableNames).toContain('objectives');
      expect(tableNames).toContain('key_results');
      expect(tableNames).toContain('progress_updates');
    });
  });

  // ── 2. Objective CRUD ─────────────────────────────────────────────────

  describe('Objective CRUD', () => {
    let objId: string;

    it('creates an objective', async () => {
      const result = await sim.invoke('createObjective', {
        title: 'Improve deployment speed',
        description: 'Reduce deploy time by 50%',
        cycle: 'Q1-2026',
      });
      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
      objId = result.id;
    });

    it('lists objectives for a cycle', async () => {
      const result = await sim.invoke('listObjectives', { cycle: 'Q1-2026' });
      expect(result.objectives.length).toBeGreaterThanOrEqual(1);
      const obj = result.objectives.find((o: any) => o.id === objId);
      expect(obj).toBeDefined();
      expect(obj.title).toBe('Improve deployment speed');
      expect(obj.kr_count).toBeDefined();
    });

    it('gets a single objective with details', async () => {
      const result = await sim.invoke('getObjective', { objectiveId: objId });
      expect(result.objective).toBeDefined();
      expect(result.objective.title).toBe('Improve deployment speed');
      expect(result.keyResults).toEqual([]);
      expect(result.children).toEqual([]);
    });

    it('updates objective status', async () => {
      await sim.invoke('updateObjectiveStatus', {
        objectiveId: objId,
        status: 'completed',
      });
      const result = await sim.invoke('getObjective', { objectiveId: objId });
      expect(result.objective.status).toBe('completed');
    });

    it('filters objectives by status', async () => {
      // Create a draft objective
      const { id: draftId } = await sim.invoke('createObjective', {
        title: 'Draft OKR',
        cycle: 'Q1-2026',
      });
      await sim.invoke('updateObjectiveStatus', { objectiveId: draftId, status: 'draft' });

      const result = await sim.invoke('listObjectives', { cycle: 'Q1-2026', status: 'draft' });
      expect(result.objectives.every((o: any) => o.status === 'draft')).toBe(true);
    });

    it('lists no objectives for an empty cycle', async () => {
      const result = await sim.invoke('listObjectives', { cycle: 'Q4-2099' });
      expect(result.objectives).toHaveLength(0);
    });

    it('returns error for non-existent objective', async () => {
      const result = await sim.invoke('getObjective', { objectiveId: 'nonexistent' });
      expect(result.error).toBe('Objective not found');
    });
  });

  // ── 3. Key Results ────────────────────────────────────────────────────

  describe('Key Results', () => {
    let objId: string;
    let manualKrId: string;
    let jiraKrId: string;

    beforeAll(async () => {
      // Reset status back to active for this section
      const { id } = await sim.invoke('createObjective', {
        title: 'KR Test Objective',
        cycle: 'Q1-2026',
      });
      objId = id;
    });

    it('creates a manual key result', async () => {
      const result = await sim.invoke('createKeyResult', {
        objective_id: objId,
        title: 'Reduce build time to 5 min',
        target_value: 5,
        unit: 'minutes',
        measurement_type: 'manual',
      });
      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
      manualKrId = result.id;
    });

    it('manual KR appears in getObjective', async () => {
      const result = await sim.invoke('getObjective', { objectiveId: objId });
      expect(result.keyResults).toHaveLength(1);
      expect(result.keyResults[0].title).toBe('Reduce build time to 5 min');
      expect(Number(result.keyResults[0].current_value)).toBe(0);
    });

    it('creates a jira-linked key result with config in KVS', async () => {
      const jiraConfig: KrJiraConfig = {
        jql: 'project = DEPLOY AND type = Bug AND status = Done',
        metric: 'count',
      };

      // Mock Jira API for the recalc that fires on creation
      sim.mockProductRoutes('jira', {
        'GET /rest/api/3/search': { total: 7, issues: [] },
      });

      const result = await sim.invoke('createKeyResult', {
        objective_id: objId,
        title: 'Resolve 10 deploy bugs',
        target_value: 10,
        unit: 'count',
        measurement_type: 'jira-linked',
        jira_config: jiraConfig,
      });
      expect(result.success).toBe(true);
      jiraKrId = result.id;

      // Verify config stored in KVS
      const storedConfig = await sim.kvs.get(`kr-config:${jiraKrId}`);
      expect(storedConfig).toEqual(jiraConfig);
    });

    it('jira-linked KR triggered recalc consumer (current_value updated)', async () => {
      // The consumer should have already run (queue processes synchronously by default)
      const result = await sim.invoke('getObjective', { objectiveId: objId });
      const jiraKr = result.keyResults.find((kr: any) => kr.id === jiraKrId);
      expect(Number(jiraKr.current_value)).toBe(7); // from mocked Jira response
    });

    it('getObjective returns jiraConfigs for linked KRs', async () => {
      const result = await sim.invoke('getObjective', { objectiveId: objId });
      expect(result.jiraConfigs[jiraKrId]).toBeDefined();
      expect(result.jiraConfigs[jiraKrId].jql).toContain('DEPLOY');
    });
  });

  // ── 4. Progress Recording ─────────────────────────────────────────────

  describe('Progress Recording', () => {
    let objId: string;
    let krId: string;

    beforeAll(async () => {
      const { id } = await sim.invoke('createObjective', {
        title: 'Progress Test Objective',
        cycle: 'Q1-2026',
      });
      objId = id;
      const kr = await sim.invoke('createKeyResult', {
        objective_id: objId,
        title: 'Ship 100 features',
        target_value: 100,
        unit: 'count',
        measurement_type: 'manual',
      });
      krId = kr.id;
    });

    it('records progress and updates current_value', async () => {
      const result = await sim.invoke('recordProgress', {
        key_result_id: krId,
        value: 25,
        note: 'First batch shipped',
      });
      expect(result.success).toBe(true);

      // Verify current_value updated
      const obj = await sim.invoke('getObjective', { objectiveId: objId });
      const kr = obj.keyResults.find((k: any) => k.id === krId);
      expect(Number(kr.current_value)).toBe(25);
    });

    it('status is "behind" when < 40%', async () => {
      // 25/100 = 25% → behind
      const obj = await sim.invoke('getObjective', { objectiveId: objId });
      const kr = obj.keyResults.find((k: any) => k.id === krId);
      expect(kr.status).toBe('behind');
    });

    it('status is "at-risk" when >= 40% and < 70%', async () => {
      await sim.invoke('recordProgress', { key_result_id: krId, value: 50 });
      const obj = await sim.invoke('getObjective', { objectiveId: objId });
      const kr = obj.keyResults.find((k: any) => k.id === krId);
      expect(kr.status).toBe('at-risk');
    });

    it('status is "on-track" when >= 70% and < 100%', async () => {
      await sim.invoke('recordProgress', { key_result_id: krId, value: 75 });
      const obj = await sim.invoke('getObjective', { objectiveId: objId });
      const kr = obj.keyResults.find((k: any) => k.id === krId);
      expect(kr.status).toBe('on-track');
    });

    it('status is "completed" when >= 100%', async () => {
      await sim.invoke('recordProgress', { key_result_id: krId, value: 100 });
      const obj = await sim.invoke('getObjective', { objectiveId: objId });
      const kr = obj.keyResults.find((k: any) => k.id === krId);
      expect(kr.status).toBe('completed');
    });

    it('getProgressHistory returns all updates', async () => {
      const result = await sim.invoke('getProgressHistory', {
        key_result_id: krId,
        limit: 10,
      });
      expect(result.updates.length).toBeGreaterThanOrEqual(4);
      const values = result.updates.map((u: any) => Number(u.value));
      expect(values).toContain(25);
      expect(values).toContain(50);
      expect(values).toContain(75);
      expect(values).toContain(100);
    });
  });

  // ── 5. Cycle Summary ──────────────────────────────────────────────────

  describe('Cycle Summary', () => {
    beforeAll(async () => {
      // Create a fresh objective + KR specifically for summary testing
      const { id: summaryObjId } = await sim.invoke('createObjective', {
        title: 'Summary Test Obj',
        cycle: 'Q2-2026',
      });
      const { id: summaryKrId } = await sim.invoke('createKeyResult', {
        objective_id: summaryObjId,
        title: 'Summary KR',
        target_value: 100,
        unit: 'count',
        measurement_type: 'manual',
      });
      await sim.invoke('recordProgress', { key_result_id: summaryKrId, value: 80 });
    });

    it('returns aggregated cycle stats', async () => {
      const result = await sim.invoke('getCycleSummary', { cycle: 'Q2-2026' });
      const s = result.summary;
      expect(Number(s.total_objectives)).toBe(1);
      expect(Number(s.total_key_results)).toBe(1);
      expect(Number(s.avg_completion)).toBeCloseTo(80, 0);
    });

    it('returns zeros for empty cycle', async () => {
      const result = await sim.invoke('getCycleSummary', { cycle: 'Q4-2099' });
      const s = result.summary;
      expect(Number(s.total_objectives)).toBe(0);
      expect(Number(s.total_key_results)).toBe(0);
    });
  });

  // ── 6. Queue Processing — recalcQueue ─────────────────────────────────

  describe('Queue Processing — recalcQueue', () => {
    let objId: string;
    let krId: string;

    beforeAll(async () => {
      const { id } = await sim.invoke('createObjective', {
        title: 'Recalc Queue Obj',
        cycle: 'Q1-2026',
      });
      objId = id;

      // Create jira-linked KR; mock initial response
      sim.mockProductRoutes('jira', {
        'GET /rest/api/3/search': { total: 3, issues: [] },
      });

      const kr = await sim.invoke('createKeyResult', {
        objective_id: objId,
        title: 'Close 20 tickets',
        target_value: 20,
        unit: 'count',
        measurement_type: 'jira-linked',
        jira_config: { jql: 'project = TEST AND status = Done', metric: 'count' as const },
      });
      krId = kr.id;
    });

    it('recalc consumer updates KR from Jira API (count metric)', async () => {
      // Mock updated Jira response
      sim.mockProductRoutes('jira', {
        'GET /rest/api/3/search': { total: 15, issues: [] },
      });

      // Push recalc event directly
      const recalcQueue = sim.createQueue({ key: 'recalcQueue' });
      await recalcQueue.push({
        body: { key_result_id: krId, objective_id: objId },
      });

      const obj = await sim.invoke('getObjective', { objectiveId: objId });
      const kr = obj.keyResults.find((k: any) => k.id === krId);
      expect(Number(kr.current_value)).toBe(15);
    });

    it('recalc consumer creates a progress_update entry', async () => {
      const result = await sim.invoke('getProgressHistory', { key_result_id: krId });
      const autoEntries = result.updates.filter(
        (u: any) => u.note === 'Auto-recalculated from Jira'
      );
      expect(autoEntries.length).toBeGreaterThanOrEqual(1);
    });

    it('recalc consumer updates status based on thresholds', async () => {
      // 15/20 = 75% → on-track (>= 70)
      const obj = await sim.invoke('getObjective', { objectiveId: objId });
      const kr = obj.keyResults.find((k: any) => k.id === krId);
      expect(kr.status).toBe('on-track');
    });
  });

  // ── 7. Queue Processing — snapshotQueue ───────────────────────────────

  describe('Queue Processing — snapshotQueue', () => {
    let objId: string;
    let krId: string;

    beforeAll(async () => {
      const { id } = await sim.invoke('createObjective', {
        title: 'Snapshot Obj',
        cycle: 'Q3-2026',
      });
      objId = id;
      const kr = await sim.invoke('createKeyResult', {
        objective_id: objId,
        title: 'Snapshot KR',
        target_value: 50,
        unit: 'count',
        measurement_type: 'manual',
      });
      krId = kr.id;
      await sim.invoke('recordProgress', { key_result_id: krId, value: 30 });
    });

    it('snapshot consumer creates progress_update entries for active KRs', async () => {
      const snapshotQueue = sim.createQueue({ key: 'snapshotQueue' });
      await snapshotQueue.push({
        body: { cycle: 'Q3-2026', triggered_by: 'manual' },
      });

      const result = await sim.invoke('getProgressHistory', { key_result_id: krId });
      const snapshots = result.updates.filter(
        (u: any) => u.note === 'Snapshot: manual'
      );
      expect(snapshots.length).toBeGreaterThanOrEqual(1);
      expect(Number(snapshots[0].value)).toBe(30);
    });
  });

  // ── 8. Trigger: sprint complete ───────────────────────────────────────

  describe('Sprint complete trigger', () => {
    let objId: string;
    let jiraKrId: string;

    beforeAll(async () => {
      // Set default cycle
      await sim.kvs.set('config:display', {
        default_cycle: 'Q1-2026',
        visible_statuses: ['active'],
        dashboard_layout: 'grid',
        color_thresholds: { on_track: 70, at_risk: 40 },
      });

      const { id } = await sim.invoke('createObjective', {
        title: 'Trigger Test Obj',
        cycle: 'Q1-2026',
      });
      objId = id;

      // Create a jira-linked KR
      sim.mockProductRoutes('jira', {
        'GET /rest/api/3/search': { total: 5, issues: [] },
      });
      const kr = await sim.invoke('createKeyResult', {
        objective_id: objId,
        title: 'Trigger KR',
        target_value: 10,
        unit: 'count',
        measurement_type: 'jira-linked',
        jira_config: { jql: 'project = TRIG AND status = Done', metric: 'count' as const },
      });
      jiraKrId = kr.id;
    });

    it('fireTrigger dispatches onSprintComplete', async () => {
      // Update mock to return new Jira count
      sim.mockProductRoutes('jira', {
        'GET /rest/api/3/search': { total: 9, issues: [] },
      });

      const results = await sim.fireTrigger('avi:jira:sprint:completed', {
        sprint: { name: 'Sprint 5', id: 5 },
      });

      expect(results).toHaveLength(1);
      expect(results[0].triggered).toBe(true);
      expect(results[0].recalcCount).toBeGreaterThanOrEqual(1);
    });

    it('trigger queued recalc and snapshot', async () => {
      // After trigger, KR should have been recalculated
      const obj = await sim.invoke('getObjective', { objectiveId: objId });
      const kr = obj.keyResults.find((k: any) => k.id === jiraKrId);
      expect(Number(kr.current_value)).toBe(9);

      // Snapshot should exist
      const history = await sim.invoke('getProgressHistory', { key_result_id: jiraKrId });
      const snapshots = history.updates.filter(
        (u: any) => u.note === 'Snapshot: sprint-complete'
      );
      expect(snapshots.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── 9. Full flow ──────────────────────────────────────────────────────

  describe('Full flow', () => {
    it('create objective → add KRs → record progress → summary → verify', async () => {
      const cycle = 'Q4-2026';

      // Create objective
      const { id: objId } = await sim.invoke('createObjective', {
        title: 'Launch v2.0',
        description: 'Ship the next major version',
        cycle,
      });

      // Add 3 key results
      const { id: kr1 } = await sim.invoke('createKeyResult', {
        objective_id: objId,
        title: 'Complete 50 story points',
        target_value: 50,
        unit: 'points',
        measurement_type: 'manual',
      });
      const { id: kr2 } = await sim.invoke('createKeyResult', {
        objective_id: objId,
        title: 'Zero P1 bugs',
        target_value: 0,
        unit: 'count',
        measurement_type: 'manual',
      });
      const { id: kr3 } = await sim.invoke('createKeyResult', {
        objective_id: objId,
        title: 'Ship 5 features',
        target_value: 5,
        unit: 'count',
        measurement_type: 'manual',
      });

      // Record progress
      await sim.invoke('recordProgress', { key_result_id: kr1, value: 35 });
      await sim.invoke('recordProgress', { key_result_id: kr3, value: 3 });

      // Check objective listing with rollup
      const listResult = await sim.invoke('listObjectives', { cycle });
      const obj = listResult.objectives.find((o: any) => o.id === objId);
      expect(obj).toBeDefined();
      expect(Number(obj.kr_count)).toBe(3);

      // Get detailed view
      const detail = await sim.invoke('getObjective', { objectiveId: objId });
      expect(detail.keyResults).toHaveLength(3);

      // Update more progress — complete kr3
      await sim.invoke('recordProgress', { key_result_id: kr3, value: 5 });
      await sim.invoke('recordProgress', { key_result_id: kr1, value: 50 });

      // Verify statuses
      const updated = await sim.invoke('getObjective', { objectiveId: objId });
      const kr1Row = updated.keyResults.find((k: any) => k.id === kr1);
      const kr3Row = updated.keyResults.find((k: any) => k.id === kr3);
      expect(kr1Row.status).toBe('completed');
      expect(kr3Row.status).toBe('completed');

      // Cycle summary
      const summary = await sim.invoke('getCycleSummary', { cycle });
      expect(Number(summary.summary.total_objectives)).toBe(1);
      expect(Number(summary.summary.total_key_results)).toBe(3);

      // Mark objective completed
      await sim.invoke('updateObjectiveStatus', { objectiveId: objId, status: 'completed' });
      const final = await sim.invoke('getObjective', { objectiveId: objId });
      expect(final.objective.status).toBe('completed');
    });

    it('hierarchical objectives (parent-child)', async () => {
      const { id: parentId } = await sim.invoke('createObjective', {
        title: 'Company Goal: Revenue',
        cycle: 'Q1-2026',
      });
      const { id: childId } = await sim.invoke('createObjective', {
        title: 'Team Goal: Upsell',
        cycle: 'Q1-2026',
        parent_id: parentId,
      });

      const result = await sim.invoke('getObjective', { objectiveId: parentId });
      expect(result.children).toHaveLength(1);
      expect(result.children[0].id).toBe(childId);
      expect(result.children[0].title).toBe('Team Goal: Upsell');
    });
  });
});
