/**
 * Tests for GraphQL API support (requestGraph).
 *
 * Covers:
 * - Mock routing by operation name
 * - Static response mocks
 * - Function handler mocks (with variables)
 * - Catch-all '*' handler
 * - Anonymous queries
 * - Unmocked operation error messages
 * - asApp/asUser both have requestGraph
 * - Integration through the forge-api shim
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SimulatedProductApi } from '../product-api.js';

describe('GraphQL (requestGraph)', () => {
  let api: SimulatedProductApi;

  beforeEach(() => {
    api = new SimulatedProductApi();
  });

  // ── Operation name extraction ───────────────────────────────────────

  describe('operation name matching', () => {
    it('matches a named query', async () => {
      api.mockGraphQL({
        'GetIssue': { data: { issue: { key: 'TEST-1' } } },
      });

      const resp = await api.requestGraph('query GetIssue { issue { key } }');
      expect(resp.ok).toBe(true);
      expect(await resp.json()).toEqual({ data: { issue: { key: 'TEST-1' } } });
    });

    it('matches a named mutation', async () => {
      api.mockGraphQL({
        'CreateIssue': { data: { createIssue: { id: '123' } } },
      });

      const resp = await api.requestGraph('mutation CreateIssue($input: CreateIssueInput!) { createIssue(input: $input) { id } }');
      expect(resp.ok).toBe(true);
      expect(await resp.json()).toEqual({ data: { createIssue: { id: '123' } } });
    });

    it('matches a named subscription', async () => {
      api.mockGraphQL({
        'OnIssueUpdate': { data: { onIssueUpdate: { key: 'TEST-2' } } },
      });

      const resp = await api.requestGraph('subscription OnIssueUpdate { onIssueUpdate { key } }');
      expect(resp.ok).toBe(true);
      expect(await resp.json()).toEqual({ data: { onIssueUpdate: { key: 'TEST-2' } } });
    });
  });

  // ── Handler types ───────────────────────────────────────────────────

  describe('mock handler types', () => {
    it('supports static object responses', async () => {
      api.mockGraphQL({
        'GetUser': { data: { user: { name: 'Ryan' } } },
      });

      const resp = await api.requestGraph('query GetUser { user { name } }');
      expect(await resp.json()).toEqual({ data: { user: { name: 'Ryan' } } });
    });

    it('supports function handlers with query and variables', async () => {
      api.mockGraphQL({
        'SearchIssues': (query: string, variables: any) => ({
          data: {
            issues: [{ key: `PROJ-${variables.projectId}` }],
            queryLength: query.length,
          },
        }),
      });

      const resp = await api.requestGraph(
        'query SearchIssues($projectId: ID!) { issues(projectId: $projectId) { key } }',
        { projectId: '42' },
      );
      const json = await resp.json();
      expect(json.data.issues[0].key).toBe('PROJ-42');
      expect(json.data.queryLength).toBeGreaterThan(0);
    });

    it('supports async function handlers', async () => {
      api.mockGraphQL({
        'SlowQuery': async () => {
          return { data: { result: 'done' } };
        },
      });

      const resp = await api.requestGraph('query SlowQuery { result }');
      expect(await resp.json()).toEqual({ data: { result: 'done' } });
    });
  });

  // ── Catch-all and anonymous queries ─────────────────────────────────

  describe('catch-all and anonymous queries', () => {
    it('uses * catch-all for anonymous queries', async () => {
      api.mockGraphQL({
        '*': { data: { fallback: true } },
      });

      const resp = await api.requestGraph('{ viewer { name } }');
      expect(resp.ok).toBe(true);
      expect(await resp.json()).toEqual({ data: { fallback: true } });
    });

    it('uses * catch-all for unmatched named queries', async () => {
      api.mockGraphQL({
        'GetUser': { data: { user: { name: 'Ryan' } } },
        '*': { errors: [{ message: 'Unknown operation' }] },
      });

      const resp = await api.requestGraph('query SomethingElse { foo }');
      expect(await resp.json()).toEqual({ errors: [{ message: 'Unknown operation' }] });
    });

    it('prefers exact match over catch-all', async () => {
      api.mockGraphQL({
        'GetUser': { data: { user: { name: 'Ryan' } } },
        '*': { data: { fallback: true } },
      });

      const resp = await api.requestGraph('query GetUser { user { name } }');
      expect(await resp.json()).toEqual({ data: { user: { name: 'Ryan' } } });
    });
  });

  // ── Unmocked operations ─────────────────────────────────────────────

  describe('unmocked operations', () => {
    it('returns 501 with helpful error for unmocked named operation', async () => {
      const resp = await api.requestGraph('query GetIssue { issue { key } }');
      expect(resp.status).toBe(501);
      const json = await resp.json();
      expect(json.error).toContain('GetIssue');
      expect(json.error).toContain('mockGraphQL');
    });

    it('returns 501 with helpful error for unmocked anonymous query', async () => {
      const resp = await api.requestGraph('{ viewer { name } }');
      expect(resp.status).toBe(501);
      const json = await resp.json();
      expect(json.error).toContain('anonymous');
    });
  });

  // ── Multiple mocks ─────────────────────────────────────────────────

  describe('multiple operations', () => {
    it('routes different operations to different handlers', async () => {
      api.mockGraphQL({
        'GetIssue': { data: { issue: { key: 'TEST-1' } } },
        'GetUser': { data: { user: { name: 'Ryan' } } },
        'CreateIssue': (q: string, v: any) => ({ data: { createIssue: { summary: v.summary } } }),
      });

      const r1 = await api.requestGraph('query GetIssue { issue { key } }');
      expect(await r1.json()).toEqual({ data: { issue: { key: 'TEST-1' } } });

      const r2 = await api.requestGraph('query GetUser { user { name } }');
      expect(await r2.json()).toEqual({ data: { user: { name: 'Ryan' } } });

      const r3 = await api.requestGraph(
        'mutation CreateIssue($summary: String!) { createIssue(summary: $summary) { summary } }',
        { summary: 'Fix the bug' },
      );
      expect(await r3.json()).toEqual({ data: { createIssue: { summary: 'Fix the bug' } } });
    });

    it('can add mocks incrementally', async () => {
      api.mockGraphQL({ 'A': { data: { a: true } } });
      api.mockGraphQL({ 'B': { data: { b: true } } });

      const r1 = await api.requestGraph('query A { a }');
      expect(await r1.json()).toEqual({ data: { a: true } });

      const r2 = await api.requestGraph('query B { b }');
      expect(await r2.json()).toEqual({ data: { b: true } });
    });
  });

  // ── Clear ───────────────────────────────────────────────────────────

  describe('clear', () => {
    it('clears GraphQL mocks on clear()', async () => {
      api.mockGraphQL({ 'GetIssue': { data: { issue: { key: 'TEST-1' } } } });

      // Sanity: mock works
      const r1 = await api.requestGraph('query GetIssue { issue { key } }');
      expect(r1.ok).toBe(true);

      api.clear();

      // After clear: unmocked
      const r2 = await api.requestGraph('query GetIssue { issue { key } }');
      expect(r2.status).toBe(501);
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles queries with extra whitespace in operation declaration', async () => {
      api.mockGraphQL({ 'GetIssue': { data: { ok: true } } });

      const resp = await api.requestGraph('query   GetIssue   { issue { key } }');
      expect(resp.ok).toBe(true);
    });

    it('handles mutation keyword', async () => {
      api.mockGraphQL({ 'UpdateIssue': { data: { ok: true } } });

      const resp = await api.requestGraph('mutation UpdateIssue($id: ID!) { updateIssue(id: $id) { ok } }');
      expect(resp.ok).toBe(true);
    });

    it('handles query with variables and fragments', async () => {
      api.mockGraphQL({
        'GetIssueWithDetails': (q: string, v: any) => ({
          data: { issue: { key: v.key, ...{ title: 'Test' } } },
        }),
      });

      const query = `
        query GetIssueWithDetails($key: String!) {
          issue(key: $key) {
            ...IssueFields
          }
        }
        fragment IssueFields on Issue {
          key
          title
        }
      `;

      const resp = await api.requestGraph(query, { key: 'TEST-99' });
      const json = await resp.json();
      expect(json.data.issue.key).toBe('TEST-99');
    });
  });
});

// ── Shim integration ────────────────────────────────────────────────────

describe('GraphQL shim integration', () => {
  it('asApp().requestGraph and asUser().requestGraph are functions', async () => {
    // Import the shim directly to verify exports
    const shim = await import('../shims/forge-api.js');
    const appClient = shim.asApp();
    const userClient = shim.asUser();

    expect(typeof appClient.requestGraph).toBe('function');
    expect(typeof userClient.requestGraph).toBe('function');
  });
});
