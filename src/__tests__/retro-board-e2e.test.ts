/**
 * Retro Board — end-to-end integration tests.
 *
 * Manually wires up resolvers and consumers on ForgeSimulator to mirror the
 * retro-board Forge app logic (KVS storage, queues, consumers, triggers).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createSimulator, ForgeSimulator } from '../simulator.js';

// ── Types (mirrored from fixture) ───────────────────────────────────────────

type Category = 'went-well' | 'improve' | 'action-items';

interface RetroItem {
  id: string;
  text: string;
  category: Category;
  votes: number;
  authorId: string;
  createdAt: number;
}

interface RetroBoard {
  sprintId: string;
  sprintName: string;
  items: RetroItem[];
  closed: boolean;
  summary?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

let idCounter = 0;
function generateId(): string {
  return `item-${++idCounter}`;
}

function makeItem(overrides: Partial<RetroItem> & { text: string; category: Category }): RetroItem {
  return {
    id: generateId(),
    votes: 0,
    authorId: 'anonymous',
    createdAt: Date.now(),
    ...overrides,
  };
}

async function getBoardFromStorage(sim: ForgeSimulator, sprintId: string): Promise<RetroBoard> {
  const board = (await sim.kvs.get(`retro:${sprintId}`)) as RetroBoard | undefined;
  return board ?? { sprintId, sprintName: `Sprint ${sprintId}`, items: [], closed: false };
}

// ── Suite ───────────────────────────────────────────────────────────────────

describe('Retro Board E2E', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    idCounter = 0;
    sim = createSimulator();

    // ── Consumers (mirrors consumers.ts) ────────────────────────────────

    sim.registerConsumer('itemQueue', async (event) => {
      const { sprintId, item } = event.body as { sprintId: string; item: RetroItem };
      if (!item.text || item.text.trim().length === 0) return;
      if (item.text.length > 500) item.text = item.text.slice(0, 500);

      const board = await getBoardFromStorage(sim, sprintId);
      if (board.closed) return;

      board.items.push(item);
      await sim.kvs.set(`retro:${sprintId}`, board);
    });

    sim.registerConsumer('voteQueue', async (event) => {
      const { sprintId, itemId, voterId } = event.body as {
        sprintId: string;
        itemId: string;
        voterId: string;
      };

      const board = await getBoardFromStorage(sim, sprintId);
      const item = board.items.find((i) => i.id === itemId);
      if (!item) return;

      const voteKey = `votes:${sprintId}:${itemId}`;
      const existingVotes = ((await sim.kvs.get(voteKey)) as string[] | undefined) ?? [];
      if (existingVotes.includes(voterId)) return;

      existingVotes.push(voterId);
      await sim.kvs.set(voteKey, existingVotes);

      item.votes += 1;
      await sim.kvs.set(`retro:${sprintId}`, board);
    });

    sim.registerConsumer('summaryQueue', async (event) => {
      const { sprintId } = event.body as { sprintId: string };
      const board = await getBoardFromStorage(sim, sprintId);

      const categories: Record<Category, RetroItem[]> = {
        'went-well': board.items.filter((i) => i.category === 'went-well'),
        improve: board.items.filter((i) => i.category === 'improve'),
        'action-items': board.items.filter((i) => i.category === 'action-items'),
      };

      const lines: string[] = [`## Retro Summary: ${board.sprintName}`, ''];
      for (const [cat, items] of Object.entries(categories)) {
        const label =
          cat === 'went-well'
            ? '🟢 What Went Well'
            : cat === 'improve'
              ? '🟡 What Could Improve'
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
      await sim.kvs.set(`retro:${sprintId}`, board);
    });

    // ── Resolvers (mirrors board.ts) ────────────────────────────────────

    sim.resolver.define('getBoard', async (req) => {
      const sprintId = req.payload?.sprintId || 'current';
      const board = await getBoardFromStorage(sim, sprintId);
      board.items.sort((a, b) => b.votes - a.votes);
      return { board };
    });

    sim.resolver.define('addItem', async (req) => {
      const item = makeItem({
        text: req.payload.text,
        category: req.payload.category,
      });
      const sprintId = req.payload.sprintId || 'current';

      await sim.queue.push('itemQueue', { body: { sprintId, item } });
      return { success: true, item };
    });

    sim.resolver.define('submitVote', async (req) => {
      const sprintId = req.payload.sprintId || 'current';
      await sim.queue.push('voteQueue', {
        body: { sprintId, itemId: req.payload.itemId, voterId: req.payload.voterId || 'anonymous' },
      });
      return { success: true };
    });

    sim.resolver.define('closeRetro', async (req) => {
      const sprintId = req.payload.sprintId || 'current';
      const board = await getBoardFromStorage(sim, sprintId);
      board.closed = true;
      await sim.kvs.set(`retro:${sprintId}`, board);
      await sim.queue.push('summaryQueue', { body: { sprintId } });
      return { success: true };
    });

    // ── Trigger handler (mirrors triggers.ts) ───────────────────────────

    sim.resolver.define('onSprintCompleteFn', async (event: any, _context?: any) => {
      const sprintId = event?.sprint?.id?.toString() || 'current';
      await sim.queue.push('summaryQueue', { body: { sprintId } });
      return { triggered: true, sprintId };
    });

    // Load manifest so fireTrigger works
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
app:
  id: ari:cloud:ecosystem::app/retro-board-test
  name: Sprint Retro Board
`);
  });

  // ── 1. Board CRUD ───────────────────────────────────────────────────────

  describe('Board CRUD', () => {
    it('returns an empty board when none exists', async () => {
      const result = await sim.invoke('getBoard', { sprintId: 'sprint-1' });
      expect(result.board).toEqual({
        sprintId: 'sprint-1',
        sprintName: 'Sprint sprint-1',
        items: [],
        closed: false,
      });
    });

    it('adds items to different categories and persists them', async () => {
      const sid = 'sprint-crud';

      await sim.invoke('addItem', { sprintId: sid, text: 'Great teamwork', category: 'went-well' });
      await sim.invoke('addItem', { sprintId: sid, text: 'Slow deploys', category: 'improve' });
      await sim.invoke('addItem', { sprintId: sid, text: 'Add linting', category: 'action-items' });

      const { board } = await sim.invoke('getBoard', { sprintId: sid });
      expect(board.items).toHaveLength(3);

      const categories = board.items.map((i: RetroItem) => i.category);
      expect(categories).toContain('went-well');
      expect(categories).toContain('improve');
      expect(categories).toContain('action-items');
    });

    it('items persist across getBoard calls', async () => {
      const sid = 'persist-check';
      await sim.invoke('addItem', { sprintId: sid, text: 'Item A', category: 'went-well' });

      const first = await sim.invoke('getBoard', { sprintId: sid });
      const second = await sim.invoke('getBoard', { sprintId: sid });
      expect(first.board.items).toHaveLength(1);
      expect(second.board.items).toHaveLength(1);
      expect(first.board.items[0].text).toBe('Item A');
    });
  });

  // ── 2. Queue processing (itemQueue) ─────────────────────────────────────

  describe('Queue processing — itemQueue', () => {
    it('addItem pushes to itemQueue and consumer writes item to board', async () => {
      const result = await sim.invoke('addItem', {
        sprintId: 'q-test',
        text: 'Queue item',
        category: 'improve',
      });
      expect(result.success).toBe(true);
      expect(result.item.text).toBe('Queue item');

      const { board } = await sim.invoke('getBoard', { sprintId: 'q-test' });
      expect(board.items).toHaveLength(1);
      expect(board.items[0].text).toBe('Queue item');
    });

    it('rejects items added to a closed board', async () => {
      const sid = 'closed-board';
      // Add one item, then close
      await sim.invoke('addItem', { sprintId: sid, text: 'Before close', category: 'went-well' });
      await sim.invoke('closeRetro', { sprintId: sid });

      // Try adding after close
      await sim.invoke('addItem', { sprintId: sid, text: 'After close', category: 'improve' });

      const { board } = await sim.invoke('getBoard', { sprintId: sid });
      expect(board.items).toHaveLength(1);
      expect(board.items[0].text).toBe('Before close');
    });
  });

  // ── 3. Voting flow ─────────────────────────────────────────────────────

  describe('Voting flow', () => {
    it('submitVote increments vote count via voteQueue consumer', async () => {
      const sid = 'vote-test';
      const { item } = await sim.invoke('addItem', {
        sprintId: sid,
        text: 'Votable item',
        category: 'went-well',
      });

      await sim.invoke('submitVote', { sprintId: sid, itemId: item.id, voterId: 'user-1' });
      await sim.invoke('submitVote', { sprintId: sid, itemId: item.id, voterId: 'user-2' });

      const { board } = await sim.invoke('getBoard', { sprintId: sid });
      const voted = board.items.find((i: RetroItem) => i.id === item.id);
      expect(voted.votes).toBe(2);
    });

    it('prevents duplicate votes from the same voter', async () => {
      const sid = 'dup-vote';
      const { item } = await sim.invoke('addItem', {
        sprintId: sid,
        text: 'No dups',
        category: 'improve',
      });

      await sim.invoke('submitVote', { sprintId: sid, itemId: item.id, voterId: 'user-1' });
      await sim.invoke('submitVote', { sprintId: sid, itemId: item.id, voterId: 'user-1' });
      await sim.invoke('submitVote', { sprintId: sid, itemId: item.id, voterId: 'user-1' });

      const { board } = await sim.invoke('getBoard', { sprintId: sid });
      const voted = board.items.find((i: RetroItem) => i.id === item.id);
      expect(voted.votes).toBe(1);
    });

    it('skips vote for non-existent item', async () => {
      const sid = 'ghost-vote';
      await sim.invoke('addItem', { sprintId: sid, text: 'Real item', category: 'went-well' });

      // Vote on an item that doesn't exist — should not throw
      await sim.invoke('submitVote', { sprintId: sid, itemId: 'nonexistent', voterId: 'user-1' });

      const { board } = await sim.invoke('getBoard', { sprintId: sid });
      expect(board.items[0].votes).toBe(0);
    });

    it('getBoard sorts items by votes descending', async () => {
      const sid = 'sort-test';

      const { item: a } = await sim.invoke('addItem', { sprintId: sid, text: 'A', category: 'went-well' });
      const { item: b } = await sim.invoke('addItem', { sprintId: sid, text: 'B', category: 'went-well' });
      const { item: c } = await sim.invoke('addItem', { sprintId: sid, text: 'C', category: 'went-well' });

      // B gets 3 votes, C gets 1, A gets 0
      await sim.invoke('submitVote', { sprintId: sid, itemId: b.id, voterId: 'u1' });
      await sim.invoke('submitVote', { sprintId: sid, itemId: b.id, voterId: 'u2' });
      await sim.invoke('submitVote', { sprintId: sid, itemId: b.id, voterId: 'u3' });
      await sim.invoke('submitVote', { sprintId: sid, itemId: c.id, voterId: 'u1' });

      const { board } = await sim.invoke('getBoard', { sprintId: sid });
      expect(board.items[0].text).toBe('B');
      expect(board.items[0].votes).toBe(3);
      expect(board.items[1].text).toBe('C');
      expect(board.items[1].votes).toBe(1);
      expect(board.items[2].text).toBe('A');
      expect(board.items[2].votes).toBe(0);
    });
  });

  // ── 4. Close retro + summary ────────────────────────────────────────────

  describe('Close retro + summary generation', () => {
    it('closeRetro marks board closed and generates a summary', async () => {
      const sid = 'summary-test';

      await sim.invoke('addItem', { sprintId: sid, text: 'Fast CI', category: 'went-well' });
      await sim.invoke('addItem', { sprintId: sid, text: 'Flaky tests', category: 'improve' });
      await sim.invoke('addItem', { sprintId: sid, text: 'Fix flaky tests', category: 'action-items' });

      const result = await sim.invoke('closeRetro', { sprintId: sid });
      expect(result.success).toBe(true);

      const { board } = await sim.invoke('getBoard', { sprintId: sid });
      expect(board.closed).toBe(true);
      expect(board.summary).toBeDefined();
      expect(board.summary).toContain('Retro Summary');
      expect(board.summary).toContain('Fast CI');
      expect(board.summary).toContain('Flaky tests');
      expect(board.summary).toContain('Fix flaky tests');
    });

    it('summary groups items by category', async () => {
      const sid = 'cat-summary';

      await sim.invoke('addItem', { sprintId: sid, text: 'Good stuff', category: 'went-well' });
      await sim.invoke('addItem', { sprintId: sid, text: 'Bad stuff', category: 'improve' });

      await sim.invoke('closeRetro', { sprintId: sid });

      const { board } = await sim.invoke('getBoard', { sprintId: sid });
      expect(board.summary).toContain('What Went Well');
      expect(board.summary).toContain('What Could Improve');
      expect(board.summary).toContain('Action Items');
      // Action items had none so should show _No items_
      expect(board.summary).toContain('_No items_');
    });

    it('summary sorts items by votes within categories', async () => {
      const sid = 'vote-summary';

      const { item: a } = await sim.invoke('addItem', { sprintId: sid, text: 'Low votes', category: 'went-well' });
      const { item: b } = await sim.invoke('addItem', { sprintId: sid, text: 'High votes', category: 'went-well' });

      await sim.invoke('submitVote', { sprintId: sid, itemId: b.id, voterId: 'u1' });
      await sim.invoke('submitVote', { sprintId: sid, itemId: b.id, voterId: 'u2' });
      await sim.invoke('submitVote', { sprintId: sid, itemId: a.id, voterId: 'u1' });

      await sim.invoke('closeRetro', { sprintId: sid });

      const { board } = await sim.invoke('getBoard', { sprintId: sid });
      const wellSection = board.summary!.split('What Went Well')[1].split('###')[0];
      const highIdx = wellSection.indexOf('High votes');
      const lowIdx = wellSection.indexOf('Low votes');
      expect(highIdx).toBeLessThan(lowIdx);
    });
  });

  // ── 5. Trigger: sprint complete ─────────────────────────────────────────

  describe('Sprint complete trigger', () => {
    it('fireTrigger dispatches onSprintComplete which generates summary', async () => {
      const sid = '42';

      // Seed a board with items
      await sim.invoke('addItem', { sprintId: sid, text: 'Deployed on time', category: 'went-well' });
      await sim.invoke('addItem', { sprintId: sid, text: 'Need more tests', category: 'improve' });

      // Fire the trigger
      const results = await sim.fireTrigger('avi:jira:sprint:completed', {
        sprint: { id: 42 },
      });

      expect(results).toHaveLength(1);
      expect(results[0].triggered).toBe(true);
      expect(results[0].sprintId).toBe('42');

      // Summary should have been generated
      const { board } = await sim.invoke('getBoard', { sprintId: sid });
      expect(board.summary).toContain('Retro Summary');
      expect(board.summary).toContain('Deployed on time');
    });
  });

  // ── 6. Full flow ────────────────────────────────────────────────────────

  describe('Full retro flow', () => {
    it('add items → vote → close → verify final state', async () => {
      const sid = 'full-flow';

      // Add items across all categories
      const { item: w1 } = await sim.invoke('addItem', {
        sprintId: sid, text: 'Pair programming worked great', category: 'went-well',
      });
      const { item: w2 } = await sim.invoke('addItem', {
        sprintId: sid, text: 'Clean releases', category: 'went-well',
      });
      const { item: i1 } = await sim.invoke('addItem', {
        sprintId: sid, text: 'Too many meetings', category: 'improve',
      });
      const { item: i2 } = await sim.invoke('addItem', {
        sprintId: sid, text: 'Documentation gaps', category: 'improve',
      });
      const { item: a1 } = await sim.invoke('addItem', {
        sprintId: sid, text: 'Schedule doc sprint', category: 'action-items',
      });

      // Vote on items
      await sim.invoke('submitVote', { sprintId: sid, itemId: i1.id, voterId: 'alice' });
      await sim.invoke('submitVote', { sprintId: sid, itemId: i1.id, voterId: 'bob' });
      await sim.invoke('submitVote', { sprintId: sid, itemId: i1.id, voterId: 'charlie' });
      await sim.invoke('submitVote', { sprintId: sid, itemId: w1.id, voterId: 'alice' });
      await sim.invoke('submitVote', { sprintId: sid, itemId: w1.id, voterId: 'bob' });
      await sim.invoke('submitVote', { sprintId: sid, itemId: a1.id, voterId: 'alice' });
      await sim.invoke('submitVote', { sprintId: sid, itemId: i2.id, voterId: 'bob' });

      // Verify pre-close state
      const preClose = await sim.invoke('getBoard', { sprintId: sid });
      expect(preClose.board.items).toHaveLength(5);
      expect(preClose.board.closed).toBe(false);
      expect(preClose.board.summary).toBeUndefined();

      // Top item should be "Too many meetings" with 3 votes
      expect(preClose.board.items[0].text).toBe('Too many meetings');
      expect(preClose.board.items[0].votes).toBe(3);

      // Close and generate summary
      await sim.invoke('closeRetro', { sprintId: sid });

      const { board } = await sim.invoke('getBoard', { sprintId: sid });
      expect(board.closed).toBe(true);
      expect(board.summary).toBeDefined();

      // Summary contains all items
      expect(board.summary).toContain('Pair programming worked great');
      expect(board.summary).toContain('Clean releases');
      expect(board.summary).toContain('Too many meetings');
      expect(board.summary).toContain('Documentation gaps');
      expect(board.summary).toContain('Schedule doc sprint');

      // Summary contains vote counts
      expect(board.summary).toContain('Too many meetings (3 votes)');
      expect(board.summary).toContain('Pair programming worked great (2 votes)');
      expect(board.summary).toContain('Schedule doc sprint (1 votes)');

      // No more items can be added after close
      await sim.invoke('addItem', { sprintId: sid, text: 'Late addition', category: 'went-well' });
      const afterClose = await sim.invoke('getBoard', { sprintId: sid });
      expect(afterClose.board.items).toHaveLength(5);
    });
  });
});
