import { storage } from '@forge/api';

export const handler = async (event: any) => {
  const { event: eventType, issueKey, timestamp } = event.body;
  console.log('Queue handler received:', eventType, issueKey);

  // Store analytics record
  const key = `analytics:${issueKey}:${timestamp}`;
  await storage.set(key, { eventType, issueKey, timestamp, processed: true });

  return { success: true };
};
