import { Queue } from '@forge/events';
import type { RecalcEvent, SnapshotEvent } from '../types/index.js';
import { sql } from '@forge/sql';
import { kvs } from '@forge/kvs';

const recalcQueue = new Queue({ key: 'recalcQueue' });
const snapshotQueue = new Queue({ key: 'snapshotQueue' });

/**
 * Trigger handler for sprint completion.
 * Recalculates all jira-linked KRs and snapshots progress.
 */
export async function onSprintComplete(event: any) {
  const sprintName = event?.sprint?.name || 'Unknown Sprint';
  console.log(`[onSprintComplete] Sprint completed: ${sprintName}`);

  // Get display config to determine current cycle
  const config = await kvs.get('config:display') as any;
  const cycle = config?.default_cycle || 'Q1-2026';

  // Find all jira-linked KRs in the active cycle and queue recalcs
  const result = await sql.prepare(`
    SELECT kr.id, kr.objective_id
    FROM key_results kr
    INNER JOIN objectives o ON o.id = kr.objective_id
    WHERE kr.measurement_type = 'jira-linked'
      AND o.cycle = ?
      AND o.status = 'active'
  `).bindParams(cycle).execute();

  const recalcEvents = (result.rows as any[]).map(row => ({
    body: { key_result_id: row.id, objective_id: row.objective_id } as RecalcEvent,
  }));

  if (recalcEvents.length > 0) {
    await recalcQueue.push(recalcEvents);
    console.log(`[onSprintComplete] Queued ${recalcEvents.length} KR recalculations`);
  }

  // Snapshot progress
  const snapshotEvent: SnapshotEvent = { cycle, triggered_by: 'sprint-complete' };
  await snapshotQueue.push({ body: snapshotEvent });

  return { triggered: true, recalcCount: recalcEvents.length, cycle };
}
