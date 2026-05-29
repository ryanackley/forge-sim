/**
 * Tests for SimulatedLLM — the @forge/llm backend.
 *
 * Covers:
 *   - Mock response queuing and FIFO order
 *   - Call history tracking
 *   - Error when no API key or mocks
 *   - Auto-detected finish_reason
 *   - Tool call responses
 *   - Stream wrapper
 *   - Model list
 *   - Reset clears state
 *   - Anthropic request/response translation (via internals check)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SimulatedLLM, LlmApiError } from '../llm.js';
import type { LlmPrompt, LlmResponse, MockLlmResponse } from '../llm.js';

describe('SimulatedLLM', () => {
  let llm: SimulatedLLM;

  beforeEach(() => {
    llm = new SimulatedLLM();
    // Ensure no real API key leaks into tests
    delete process.env.ANTHROPIC_API_KEY;
  });

  // ── Mock responses ───────────────────────────────────────────────────

  describe('mock responses', () => {
    it('returns queued mock responses in FIFO order', async () => {
      llm.mockResponse({ content: 'First' });
      llm.mockResponse({ content: 'Second' });

      const prompt: LlmPrompt = {
        model: 'claude-sonnet-4-5-20250929',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const r1 = await llm.chat(prompt);
      expect(r1.choices[0].message.content).toEqual([{ type: 'text', text: 'First' }]);

      const r2 = await llm.chat(prompt);
      expect(r2.choices[0].message.content).toEqual([{ type: 'text', text: 'Second' }]);
    });

    it('throws LlmApiError when no mocks and no API key', async () => {
      const prompt: LlmPrompt = {
        model: 'claude-sonnet-4-5-20250929',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await expect(llm.chat(prompt)).rejects.toThrow(LlmApiError);
      await expect(llm.chat(prompt)).rejects.toThrow('No Anthropic API key configured');
    });

    it('sets finish_reason to end_turn for text-only responses', async () => {
      llm.mockResponse({ content: 'Just text' });

      const r = await llm.chat({
        model: 'claude-sonnet-4-5-20250929',
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(r.choices[0].finish_reason).toBe('end_turn');
    });

    it('sets finish_reason to tool_use when tool_calls are present', async () => {
      llm.mockResponse({
        content: '',
        tool_calls: [{
          id: 'call_1',
          type: 'function',
          index: 0,
          function: { name: 'get_data', arguments: { query: 'bugs' } },
        }],
      });

      const r = await llm.chat({
        model: 'claude-sonnet-4-5-20250929',
        messages: [{ role: 'user', content: 'Find bugs' }],
      });

      expect(r.choices[0].finish_reason).toBe('tool_use');
      expect(r.choices[0].message.tool_calls).toHaveLength(1);
      expect(r.choices[0].message.tool_calls![0].function.name).toBe('get_data');
    });

    it('allows explicit finish_reason override', async () => {
      llm.mockResponse({ content: 'max', finish_reason: 'max_tokens' });

      const r = await llm.chat({
        model: 'claude-sonnet-4-5-20250929',
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(r.choices[0].finish_reason).toBe('max_tokens');
    });

    it('accepts ContentPart[] as content', async () => {
      llm.mockResponse({
        content: [
          { type: 'text', text: 'Part 1' },
          { type: 'text', text: 'Part 2' },
        ],
      });

      const r = await llm.chat({
        model: 'claude-sonnet-4-5-20250929',
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(r.choices[0].message.content).toEqual([
        { type: 'text', text: 'Part 1' },
        { type: 'text', text: 'Part 2' },
      ]);
    });

    it('supports mockResponses for batch queuing', async () => {
      llm.mockResponses(
        { content: 'A' },
        { content: 'B' },
        { content: 'C' },
      );

      const prompt: LlmPrompt = {
        model: 'claude-sonnet-4-5-20250929',
        messages: [{ role: 'user', content: 'Hi' }],
      };

      const r1 = await llm.chat(prompt);
      const r2 = await llm.chat(prompt);
      const r3 = await llm.chat(prompt);

      expect(r1.choices[0].message.content).toEqual([{ type: 'text', text: 'A' }]);
      expect(r2.choices[0].message.content).toEqual([{ type: 'text', text: 'B' }]);
      expect(r3.choices[0].message.content).toEqual([{ type: 'text', text: 'C' }]);
    });

    it('returns zeroed usage for mock responses', async () => {
      llm.mockResponse({ content: 'test' });

      const r = await llm.chat({
        model: 'claude-sonnet-4-5-20250929',
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(r.usage).toEqual({ input_token: 0, output_token: 0, total_token: 0 });
    });
  });

  // ── Call history ──────────────────────────────────────────────────────

  describe('call history', () => {
    it('records each chat() call with prompt and response', async () => {
      llm.mockResponse({ content: 'Answer 1' });
      llm.mockResponse({ content: 'Answer 2' });

      const p1: LlmPrompt = {
        model: 'claude-sonnet-4-5-20250929',
        messages: [{ role: 'user', content: 'Q1' }],
      };
      const p2: LlmPrompt = {
        model: 'claude-sonnet-4-5-20250929',
        messages: [{ role: 'user', content: 'Q2' }],
      };

      await llm.chat(p1);
      await llm.chat(p2);

      const history = llm.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].prompt.messages[0].content).toBe('Q1');
      expect(history[1].prompt.messages[0].content).toBe('Q2');
    });

    it('returns a copy of history (not a reference)', async () => {
      llm.mockResponse({ content: 'test' });
      await llm.chat({
        model: 'claude-sonnet-4-5-20250929',
        messages: [{ role: 'user', content: 'Hi' }],
      });

      const h1 = llm.getHistory();
      const h2 = llm.getHistory();
      expect(h1).not.toBe(h2);
      expect(h1).toEqual(h2);
    });
  });

  // ── Stream ────────────────────────────────────────────────────────────

  describe('stream', () => {
    it('returns an async iterable that yields the full response as one chunk', async () => {
      llm.mockResponse({ content: 'Streamed response' });

      const stream = await llm.stream({
        model: 'claude-sonnet-4-5-20250929',
        messages: [{ role: 'user', content: 'Hi' }],
      });

      const chunks: LlmResponse[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0].choices[0].message.content).toEqual([
        { type: 'text', text: 'Streamed response' },
      ]);
    });

    it('has a close() method', async () => {
      llm.mockResponse({ content: 'test' });
      const stream = await llm.stream({
        model: 'claude-sonnet-4-5-20250929',
        messages: [{ role: 'user', content: 'Hi' }],
      });

      // Should not throw
      await stream.close();
    });
  });

  // ── Model list ────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns available models', async () => {
      const result = await llm.list();
      expect(result.models.length).toBeGreaterThanOrEqual(2);
      expect(result.models.some(m => m.model.includes('sonnet'))).toBe(true);
      expect(result.models.some(m => m.model.includes('haiku'))).toBe(true);
      expect(result.models.every(m => m.status === 'active')).toBe(true);
    });

    it('returns a copy (not internal reference)', async () => {
      const r1 = await llm.list();
      const r2 = await llm.list();
      expect(r1.models).not.toBe(r2.models);
    });
  });

  // ── Reset ─────────────────────────────────────────────────────────────

  describe('reset', () => {
    it('clears mock responses', async () => {
      llm.mockResponse({ content: 'test' });
      llm.reset();

      await expect(llm.chat({
        model: 'claude-sonnet-4-5-20250929',
        messages: [{ role: 'user', content: 'Hi' }],
      })).rejects.toThrow(LlmApiError);
    });

    it('clears call history', async () => {
      llm.mockResponse({ content: 'test' });
      await llm.chat({
        model: 'claude-sonnet-4-5-20250929',
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(llm.getHistory()).toHaveLength(1);
      llm.reset();
      expect(llm.getHistory()).toHaveLength(0);
    });
  });

  // ── Agent loop simulation ─────────────────────────────────────────────

  describe('agent loop simulation', () => {
    it('can script a multi-turn tool-use conversation', async () => {
      // Turn 1: AI wants to call a tool
      llm.mockResponse({
        content: '',
        tool_calls: [{
          id: 'call_abc',
          type: 'function',
          index: 0,
          function: { name: 'search_issues', arguments: { jql: 'project = TEST' } },
        }],
      });

      // Turn 2: AI gives final answer
      llm.mockResponse({ content: 'Found 42 issues in project TEST.' });

      // Simulate the agent loop
      const messages: any[] = [
        { role: 'user', content: 'How many issues in project TEST?' },
      ];

      // Turn 1
      const r1 = await llm.chat({
        model: 'claude-sonnet-4-5-20250929',
        messages,
        tools: [{
          type: 'function',
          function: {
            name: 'search_issues',
            description: 'Search Jira issues',
            parameters: { type: 'object', properties: { jql: { type: 'string' } } },
          },
        }],
      });

      expect(r1.choices[0].finish_reason).toBe('tool_use');
      expect(r1.choices[0].message.tool_calls![0].function.name).toBe('search_issues');

      // Add assistant message + tool result
      messages.push(r1.choices[0].message);
      messages.push({
        role: 'tool',
        tool_call_id: 'call_abc',
        content: JSON.stringify({ total: 42, issues: [] }),
      });

      // Turn 2
      const r2 = await llm.chat({
        model: 'claude-sonnet-4-5-20250929',
        messages,
      });

      expect(r2.choices[0].finish_reason).toBe('end_turn');
      expect(r2.choices[0].message.content).toEqual([
        { type: 'text', text: 'Found 42 issues in project TEST.' },
      ]);

      // Verify history has both calls
      expect(llm.getHistory()).toHaveLength(2);
    });
  });

  // ── LlmApiError ──────────────────────────────────────────────────────

  describe('LlmApiError', () => {
    it('has code and context.responseText', () => {
      const err = new LlmApiError('Something broke', 'API_ERROR');
      expect(err.name).toBe('LlmApiError');
      expect(err.code).toBe('API_ERROR');
      expect(err.context?.responseText).toBe('Something broke');
      expect(err.message).toBe('Something broke');
      expect(err).toBeInstanceOf(Error);
    });
  });

  // ── Logging ──────────────────────────────────────────────────────────

  describe('logging', () => {
    it('calls the log function on chat()', async () => {
      const logFn = vi.fn();
      const loggedLlm = new SimulatedLLM(logFn);
      loggedLlm.mockResponse({ content: 'test' });

      await loggedLlm.chat({
        model: 'claude-sonnet-4-5-20250929',
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(logFn).toHaveBeenCalledWith(
        'invoke',
        expect.stringContaining('llm.chat'),
        expect.objectContaining({ messageCount: 1 }),
      );
      expect(logFn).toHaveBeenCalledWith('info', expect.stringContaining('mock'));
    });
  });
});
