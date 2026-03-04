/**
 * Consumer handler for the work-queue.
 * In real Forge, this is invoked when events are pushed to the queue.
 */
import { kvs } from '@forge/kvs';

export async function handler(event, context) {
  const { issueKey, viewedAt } = event.body;
  
  // Store analytics event
  const analyticsKey = `analytics:${issueKey}:${viewedAt}`;
  await kvs.set(analyticsKey, { issueKey, viewedAt, processedAt: Date.now() });
  
  return { success: true };
}
