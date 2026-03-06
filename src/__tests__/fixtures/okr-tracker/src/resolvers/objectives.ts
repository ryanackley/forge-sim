import { sql } from '@forge/sql';
import { kvs } from '@forge/kvs';
import type { ObjectiveRow, OkrDisplayConfig } from '../types/index.js';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * List objectives for a cycle with rollup scores
 */
export async function listObjectives({ payload, context }: {
  payload: { cycle?: string; status?: string };
  context: any;
}) {
  // Get display config from Entity Store for default cycle
  const config = await kvs.get('config:display') as OkrDisplayConfig | undefined;
  const cycle = payload.cycle || config?.default_cycle || 'Q1-2026';

  let query = `
    SELECT o.*,
      COUNT(kr.id) AS kr_count,
      COALESCE(AVG(
        CASE WHEN kr.target_value > 0
          THEN (kr.current_value / kr.target_value) * 100
          ELSE 0
        END
      ), 0) AS completion_pct
    FROM objectives o
    LEFT JOIN key_results kr ON kr.objective_id = o.id
    WHERE o.cycle = ?
  `;
  const params: any[] = [cycle];

  if (payload.status) {
    query += ` AND o.status = ?`;
    params.push(payload.status);
  }

  query += ` GROUP BY o.id ORDER BY o.created_at DESC`;

  const result = await sql.prepare(query).bindParams(...params).execute();

  return {
    objectives: result.rows,
    cycle,
  };
}

/**
 * Get a single objective with its key results and recent progress
 */
export async function getObjective({ payload, context }: {
  payload: { objectiveId: string };
  context: any;
}) {
  // Get the objective
  const objResult = await sql.prepare(
    `SELECT * FROM objectives WHERE id = ?`
  ).bindParams(payload.objectiveId).execute();

  if (objResult.rows.length === 0) {
    return { error: 'Objective not found' };
  }

  const objective = objResult.rows[0];

  // Get key results
  const krResult = await sql.prepare(
    `SELECT * FROM key_results WHERE objective_id = ? ORDER BY created_at ASC`
  ).bindParams(payload.objectiveId).execute();

  // Get latest 5 progress updates per KR
  const krIds = krResult.rows.map((kr: any) => kr.id);
  let progressUpdates: any[] = [];

  if (krIds.length > 0) {
    const placeholders = krIds.map(() => '?').join(',');
    const progressResult = await sql.prepare(`
      SELECT pu.* FROM progress_updates pu
      INNER JOIN (
        SELECT key_result_id, MAX(updated_at) as latest
        FROM progress_updates
        WHERE key_result_id IN (${placeholders})
        GROUP BY key_result_id
      ) latest_pu ON pu.key_result_id = latest_pu.key_result_id
        AND pu.updated_at = latest_pu.latest
      ORDER BY pu.updated_at DESC
    `).bindParams(...krIds).execute();
    progressUpdates = progressResult.rows;
  }

  // Get child objectives (hierarchical rollup)
  const childResult = await sql.prepare(
    `SELECT id, title, status FROM objectives WHERE parent_id = ?`
  ).bindParams(payload.objectiveId).execute();

  // Get Jira config for linked KRs from Entity Store
  const jiraConfigs: Record<string, any> = {};
  for (const kr of krResult.rows) {
    if ((kr as any).measurement_type === 'jira-linked') {
      const config = await kvs.get(`kr-config:${(kr as any).id}`);
      if (config) jiraConfigs[(kr as any).id] = config;
    }
  }

  return {
    objective,
    keyResults: krResult.rows,
    progressUpdates,
    children: childResult.rows,
    jiraConfigs,
  };
}

/**
 * Create a new objective
 */
export async function createObjective({ payload, context }: {
  payload: {
    title: string;
    description?: string;
    cycle: string;
    parent_id?: string;
  };
  context: any;
}) {
  const id = generateId();
  const ownerId = context.accountId || 'anonymous';

  await sql.prepare(`
    INSERT INTO objectives (id, title, description, owner_id, cycle, status, parent_id)
    VALUES (?, ?, ?, ?, ?, 'active', ?)
  `).bindParams(
    id,
    payload.title,
    payload.description || '',
    ownerId,
    payload.cycle,
    payload.parent_id || null,
  ).execute();

  return { success: true, id };
}

/**
 * Update objective status
 */
export async function updateObjectiveStatus({ payload, context }: {
  payload: { objectiveId: string; status: string };
  context: any;
}) {
  await sql.prepare(
    `UPDATE objectives SET status = ? WHERE id = ?`
  ).bindParams(payload.status, payload.objectiveId).execute();

  return { success: true };
}

/**
 * Get cycle summary — aggregated stats across all objectives in a cycle
 */
export async function getCycleSummary({ payload, context }: {
  payload: { cycle: string };
  context: any;
}) {
  const result = await sql.prepare(`
    SELECT
      COUNT(DISTINCT o.id) AS total_objectives,
      COUNT(kr.id) AS total_key_results,
      SUM(CASE WHEN o.status = 'completed' THEN 1 ELSE 0 END) AS completed_objectives,
      COALESCE(AVG(
        CASE WHEN kr.target_value > 0
          THEN (kr.current_value / kr.target_value) * 100
          ELSE 0
        END
      ), 0) AS avg_completion,
      SUM(CASE WHEN kr.status = 'on-track' THEN 1 ELSE 0 END) AS kr_on_track,
      SUM(CASE WHEN kr.status = 'at-risk' THEN 1 ELSE 0 END) AS kr_at_risk,
      SUM(CASE WHEN kr.status = 'behind' THEN 1 ELSE 0 END) AS kr_behind,
      SUM(CASE WHEN kr.status = 'completed' THEN 1 ELSE 0 END) AS kr_completed
    FROM objectives o
    LEFT JOIN key_results kr ON kr.objective_id = o.id
    WHERE o.cycle = ?
  `).bindParams(payload.cycle).execute();

  return { summary: result.rows[0] || {} };
}
