import { sql } from '@forge/sql';
import { kvs } from '@forge/kvs';
import { requestJira } from '@forge/api';
import type { RecalcEvent, SnapshotEvent, KrJiraConfig } from '../types/index.js';

/**
 * Recalculate a jira-linked key result by querying the Jira API.
 * Reads JQL config from Entity Store, queries Jira, updates SQL.
 */
export async function recalcKeyResult(event: any) {
  const { key_result_id, objective_id } = event.body as RecalcEvent;

  console.log(`[recalcKR] Recalculating KR ${key_result_id}`);

  // Get Jira config from Entity Store
  const config = await kvs.get(`kr-config:${key_result_id}`) as KrJiraConfig | undefined;
  if (!config) {
    console.log(`[recalcKR] No Jira config for KR ${key_result_id}, skipping`);
    return;
  }

  let newValue = 0;

  try {
    if (config.metric === 'count') {
      // Count issues matching JQL
      const response = await requestJira(`/rest/api/3/search?jql=${encodeURIComponent(config.jql)}&maxResults=0`);
      const data = await response.json();
      newValue = data.total || 0;

    } else if (config.metric === 'sum_field' && config.field) {
      // Sum a numeric field across matching issues
      const response = await requestJira(`/rest/api/3/search?jql=${encodeURIComponent(config.jql)}&fields=${config.field}&maxResults=100`);
      const data = await response.json();
      newValue = (data.issues || []).reduce((sum: number, issue: any) => {
        return sum + (Number(issue.fields?.[config.field!]) || 0);
      }, 0);

    } else if (config.metric === 'ratio' && config.ratio_jql) {
      // Ratio: count(jql) / count(ratio_jql) * 100
      const [numResponse, denResponse] = await Promise.all([
        requestJira(`/rest/api/3/search?jql=${encodeURIComponent(config.jql)}&maxResults=0`),
        requestJira(`/rest/api/3/search?jql=${encodeURIComponent(config.ratio_jql)}&maxResults=0`),
      ]);
      const numData = await numResponse.json();
      const denData = await denResponse.json();
      const denominator = denData.total || 1;
      newValue = Math.round(((numData.total || 0) / denominator) * 100);
    }
  } catch (err: any) {
    console.log(`[recalcKR] Jira API error for KR ${key_result_id}: ${err.message}`);
    return;
  }

  // Update the key result's current_value
  await sql.prepare(
    `UPDATE key_results SET current_value = ? WHERE id = ?`
  ).bindParams(newValue, key_result_id).execute();

  // Record as a progress update
  const updateId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  await sql.prepare(`
    INSERT INTO progress_updates (id, key_result_id, value, note, updated_by)
    VALUES (?, ?, ?, ?, ?)
  `).bindParams(updateId, key_result_id, newValue, 'Auto-recalculated from Jira', 'system').execute();

  // Recalculate status
  const krResult = await sql.prepare(
    `SELECT target_value FROM key_results WHERE id = ?`
  ).bindParams(key_result_id).execute();

  if (krResult.rows.length > 0) {
    const target = (krResult.rows[0] as any).target_value;
    const pct = target > 0 ? (newValue / target) * 100 : 0;

    const displayConfig = await kvs.get('config:display') as any;
    const onTrack = displayConfig?.color_thresholds?.on_track ?? 70;
    const atRisk = displayConfig?.color_thresholds?.at_risk ?? 40;

    let status: string;
    if (pct >= 100) status = 'completed';
    else if (pct >= onTrack) status = 'on-track';
    else if (pct >= atRisk) status = 'at-risk';
    else status = 'behind';

    await sql.prepare(
      `UPDATE key_results SET status = ? WHERE id = ?`
    ).bindParams(status, key_result_id).execute();
  }

  console.log(`[recalcKR] KR ${key_result_id} updated to ${newValue}`);
}

/**
 * Snapshot all KR progress for a cycle — creates a point-in-time record.
 * Useful for historical tracking and charting.
 */
export async function snapshotProgress(event: any) {
  const { cycle, triggered_by } = event.body as SnapshotEvent;

  console.log(`[snapshot] Creating progress snapshot for ${cycle} (triggered by: ${triggered_by})`);

  // Get all active KRs in this cycle
  const result = await sql.prepare(`
    SELECT kr.id, kr.current_value, kr.objective_id
    FROM key_results kr
    INNER JOIN objectives o ON o.id = kr.objective_id
    WHERE o.cycle = ? AND o.status = 'active'
  `).bindParams(cycle).execute();

  let snapshotCount = 0;
  for (const row of result.rows as any[]) {
    const updateId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    await sql.prepare(`
      INSERT INTO progress_updates (id, key_result_id, value, note, updated_by)
      VALUES (?, ?, ?, ?, ?)
    `).bindParams(
      updateId,
      row.id,
      row.current_value,
      `Snapshot: ${triggered_by}`,
      'system',
    ).execute();
    snapshotCount++;
  }

  console.log(`[snapshot] Created ${snapshotCount} progress snapshots for ${cycle}`);
}
