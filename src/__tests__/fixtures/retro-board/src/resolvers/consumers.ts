import { storage } from '@forge/api';
import type { RetroBoard, VoteEvent, NewItemEvent, SummaryEvent, Category } from '../types/index.js';

async function getBoardFromStorage(sprintId: string): Promise<RetroBoard> {
  const board = await storage.get(`retro:${sprintId}`) as RetroBoard | undefined;
  return board ?? {
    sprintId,
    sprintName: `Sprint ${sprintId}`,
    items: [],
    closed: false,
  };
}

/**
 * Process a vote event from the voteQueue.
 * Reads the board from KVS, increments the vote count, writes back.
 */
export async function processVote(event: any) {
  const { sprintId, itemId, voterId } = event.body as VoteEvent;
  
  console.log(`[processVote] Processing vote for item ${itemId} by ${voterId}`);

  const board = await getBoardFromStorage(sprintId);
  const item = board.items.find(i => i.id === itemId);
  
  if (!item) {
    console.log(`[processVote] Item ${itemId} not found, skipping`);
    return;
  }

  // Check for duplicate votes (simple approach — track in a set stored per item)
  const voteKey = `votes:${sprintId}:${itemId}`;
  const existingVotes = (await storage.get(voteKey) as string[] | undefined) ?? [];
  
  if (existingVotes.includes(voterId)) {
    console.log(`[processVote] Duplicate vote from ${voterId} for ${itemId}, skipping`);
    return;
  }

  // Record the vote
  existingVotes.push(voterId);
  await storage.set(voteKey, existingVotes);

  // Increment vote count on the item
  item.votes += 1;
  await storage.set(`retro:${sprintId}`, board);

  console.log(`[processVote] Item ${itemId} now has ${item.votes} votes`);
}

/**
 * Process a new item event from the itemQueue.
 * Validates and writes the item to KVS.
 */
export async function processItem(event: any) {
  const { sprintId, item } = event.body as NewItemEvent;
  
  console.log(`[processItem] Adding item "${item.text}" to sprint ${sprintId}`);

  // Validate
  if (!item.text || item.text.trim().length === 0) {
    console.log('[processItem] Empty text, skipping');
    return;
  }

  if (item.text.length > 500) {
    console.log('[processItem] Text too long, truncating');
    item.text = item.text.slice(0, 500);
  }

  const board = await getBoardFromStorage(sprintId);
  
  if (board.closed) {
    console.log('[processItem] Board is closed, rejecting item');
    return;
  }

  board.items.push(item);
  await storage.set(`retro:${sprintId}`, board);

  console.log(`[processItem] Board now has ${board.items.length} items`);
}

/**
 * Generate a summary for a closed retro.
 */
export async function generateSummary(event: any) {
  const { sprintId } = event.body as SummaryEvent;
  
  console.log(`[generateSummary] Generating summary for sprint ${sprintId}`);

  const board = await getBoardFromStorage(sprintId);

  const categories: Record<Category, typeof board.items> = {
    'went-well': board.items.filter(i => i.category === 'went-well'),
    'improve': board.items.filter(i => i.category === 'improve'),
    'action-items': board.items.filter(i => i.category === 'action-items'),
  };

  const lines: string[] = [`## Retro Summary: ${board.sprintName}`, ''];

  for (const [cat, items] of Object.entries(categories)) {
    const label = cat === 'went-well' ? '🟢 What Went Well' 
                : cat === 'improve' ? '🟡 What Could Improve' 
                : '🔴 Action Items';
    lines.push(`### ${label}`);
    
    if (items.length === 0) {
      lines.push('- _No items_');
    } else {
      const sorted = [...items].sort((a, b) => b.votes - a.votes);
      for (const item of sorted) {
        lines.push(`- ${item.text} (${item.votes} votes)`);
      }
    }
    lines.push('');
  }

  board.summary = lines.join('\n');
  await storage.set(`retro:${sprintId}`, board);

  console.log(`[generateSummary] Summary generated (${lines.length} lines)`);
}
