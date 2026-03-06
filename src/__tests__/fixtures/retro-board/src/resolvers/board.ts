import { storage } from '@forge/api';
import { Queue } from '@forge/events';
import type { RetroBoard, RetroItem, Category, VoteEvent, NewItemEvent, SummaryEvent } from '../types/index.js';

const voteQueue = new Queue({ key: 'voteQueue' });
const itemQueue = new Queue({ key: 'itemQueue' });
const summaryQueue = new Queue({ key: 'summaryQueue' });

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

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
 * Get the retro board for a sprint
 */
export async function getBoard({ payload, context }: { payload: { sprintId: string }; context: any }) {
  const sprintId = payload.sprintId || 'current';
  const board = await getBoardFromStorage(sprintId);
  
  // Sort items by votes descending within each category
  board.items.sort((a, b) => b.votes - a.votes);
  
  return { board };
}

/**
 * Add a new item — pushes to itemQueue for async processing
 */
export async function addItem({ payload, context }: { 
  payload: { sprintId: string; text: string; category: Category };
  context: any;
}) {
  const item: RetroItem = {
    id: generateId(),
    text: payload.text,
    category: payload.category,
    votes: 0,
    authorId: context.accountId || 'anonymous',
    createdAt: Date.now(),
  };

  const event: NewItemEvent = {
    sprintId: payload.sprintId || 'current',
    item,
  };

  await itemQueue.push({ body: event });
  
  return { success: true, item };
}

/**
 * Submit a vote — pushes to voteQueue for async processing
 */
export async function submitVote({ payload, context }: {
  payload: { sprintId: string; itemId: string };
  context: any;
}) {
  const event: VoteEvent = {
    sprintId: payload.sprintId || 'current',
    itemId: payload.itemId,
    voterId: context.accountId || 'anonymous',
  };

  await voteQueue.push({ body: event });
  
  return { success: true };
}

/**
 * Close the retro and trigger summary generation
 */
export async function closeRetro({ payload, context }: {
  payload: { sprintId: string };
  context: any;
}) {
  const sprintId = payload.sprintId || 'current';
  const board = await getBoardFromStorage(sprintId);
  board.closed = true;
  await storage.set(`retro:${sprintId}`, board);

  const event: SummaryEvent = { sprintId };
  await summaryQueue.push({ body: event });

  return { success: true };
}

/**
 * Get sprint info from Jira (simulated in forge-sim)
 */
export async function getSprintInfo({ payload, context }: {
  payload: { boardId?: string };
  context: any;
}) {
  // In real Forge, this would call requestJira('/rest/agile/1.0/board/{boardId}/sprint?state=active')
  // For forge-sim, return simulated data
  return {
    sprint: {
      id: 'sprint-42',
      name: 'Sprint 42 — The Answer',
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      goal: 'Ship the retro board feature',
    },
  };
}
