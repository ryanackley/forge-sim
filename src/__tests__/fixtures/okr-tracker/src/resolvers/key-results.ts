import { sql } from '@forge/sql';
import { kvs } from '@forge/kvs';
import { Queue } from '@forge/events';
import type { KrJiraConfig, RecalcEvent } from '../types/index.js';

const recalcQueue = new Queue({ key: 'recalcQueue' });

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Create a key result for an objective
 */
export async function createKeyResult({ payload, context }: {
  payload: {
    objective_id: string;
    title: string;
    target_value: number;
    unit: string;
    measurement_type: 'manual' | 'jira-linked';
    jira_config?: KrJiraConfig;
  };
  context: any;
}) {
  const id = generateId();

  await sql.prepare(`
    INSERT INTO key_results (id, objective_id, title, target_value, current_value, unit, measurement_type, status)
    VALUES (?, ?, ?, ?, 0, ?, ?, 'on-track')
  `).bindParams(
    id,
    payload.objective_id,
    payload.title,
    payload.target_value,
    payload.unit,
    payload.measurement_type,
  ).execute();

  // Store Jira config in Entity Store if jira-linked
  if (payload.measurement_type === 'jira-linked' && payload.jira_config) {
    await kvs.set(`kr-config:${id}`, payload.jira_config);
  }

  // If jira-linked, trigger immediate recalc
  if (payload.measurement_type === 'jira-linked') {
    const event: RecalcEvent = { key_result_id: id, objective_id: payload.objective_id };
    await recalcQueue.push({ body: event });
  }

  return { success: true, id };
}

/**
 * Record a manual progress update for a key result
 */
export async function recordProgress({ payload, context }: {
  payload: {
    key_result_id: string;
    value: number;
    note?: string;
  };
  context: any;
}) {
  const updateId = generateId();
  const updatedBy = context.accountId || 'anonymous';

  // Insert progress update (time series)
  await sql.prepare(`
    INSERT INTO progress_updates (id, key_result_id, value, note, updated_by)
    VALUES (?, ?, ?, ?, ?)
  `).bindParams(
    updateId,
    payload.key_result_id,
    payload.value,
    payload.note || '',
    updatedBy,
  ).execute();

  // Update current_value on the key result
  await sql.prepare(`
    UPDATE key_results SET current_value = ? WHERE id = ?
  `).bindParams(payload.value, payload.key_result_id).execute();

  // Recalculate status based on thresholds
  await updateKrStatus(payload.key_result_id);

  return { success: true, updateId };
}

/**
 * Get progress history for a key result (time series)
 */
export async function getProgressHistory({ payload, context }: {
  payload: { key_result_id: string; limit?: number };
  context: any;
}) {
  const limit = payload.limit || 20;

  const result = await sql.prepare(`
    SELECT * FROM progress_updates
    WHERE key_result_id = ?
    ORDER BY updated_at DESC
    LIMIT ${Number(limit)}
  `).bindParams(payload.key_result_id).execute();

  return { updates: result.rows };
}

/**
 * Update KR Jira config in Entity Store
 */
export async function updateKrConfig({ payload, context }: {
  payload: { key_result_id: string; jira_config: KrJiraConfig };
  context: any;
}) {
  await kvs.set(`kr-config:${payload.key_result_id}`, payload.jira_config);

  // Trigger recalc
  const krResult = await sql.prepare(
    `SELECT objective_id FROM key_results WHERE id = ?`
  ).bindParams(payload.key_result_id).execute();

  if (krResult.rows.length > 0) {
    const event: RecalcEvent = {
      key_result_id: payload.key_result_id,
      objective_id: (krResult.rows[0] as any).objective_id,
    };
    await recalcQueue.push({ body: event });
  }

  return { success: true };
}

/**
 * Recalculate KR status based on completion percentage and display config thresholds
 */
async function updateKrStatus(krId: string) {
  const krResult = await sql.prepare(
    `SELECT target_value, current_value FROM key_results WHERE id = ?`
  ).bindParams(krId).execute();

  if (krResult.rows.length === 0) return;

  const kr = krResult.rows[0] as any;
  const pct = kr.target_value > 0
    ? (kr.current_value / kr.target_value) * 100
    : 0;

  // Get thresholds from display config
  const config = await kvs.get('config:display') as any;
  const onTrackThreshold = config?.color_thresholds?.on_track ?? 70;
  const atRiskThreshold = config?.color_thresholds?.at_risk ?? 40;

  let status: string;
  if (pct >= 100) {
    status = 'completed';
  } else if (pct >= onTrackThreshold) {
    status = 'on-track';
  } else if (pct >= atRiskThreshold) {
    status = 'at-risk';
  } else {
    status = 'behind';
  }

  await sql.prepare(
    `UPDATE key_results SET status = ? WHERE id = ?`
  ).bindParams(status, krId).execute();
}

export { updateKrStatus };
