import { Queue } from '@forge/events';
import type { SummaryEvent } from '../types/index.js';

const summaryQueue = new Queue({ key: 'summaryQueue' });

/**
 * Trigger handler for sprint completion.
 * Auto-closes the retro and kicks off summary generation.
 */
export async function onSprintComplete(event: any) {
  const sprintId = event?.sprint?.id?.toString() || 'current';
  
  console.log(`[onSprintComplete] Sprint ${sprintId} completed, generating summary`);

  const summaryEvent: SummaryEvent = { sprintId };
  await summaryQueue.push({ body: summaryEvent });

  return { triggered: true, sprintId };
}
