/**
 * Tests for `forge-sim dev` context flags (--issue, --content, --space, --context).
 *
 * Verifies that:
 *   - Context options are correctly threaded into DevCommandOptions
 *   - buildForgeContext is used (instead of buildDefaultContext) when context flags are present
 *   - The WebSocket bridge serves the correct context to the browser
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSimulator, ForgeSimulator, buildForgeContext, buildDefaultContext } from '../index.js';
import type { RenderContextOptions } from '../context.js';

describe('Dev command context flags', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    sim = createSimulator();

  });

  describe('--issue flag', () => {
    it('builds context with issueKey hydration (no API)', async () => {
      const renderContext: RenderContextOptions = { issueKey: 'PROJ-42' };
      const ctx = await buildForgeContext(sim, 'my-panel', 'jira:issuePanel', renderContext);

      expect(ctx.extension.type).toBe('jira:issuePanel');
      expect(ctx.extension.issueKey).toBe('PROJ-42');
      expect(ctx.extension.issue.key).toBe('PROJ-42');
      expect(ctx.extension.projectKey).toBe('PROJ');
      expect(ctx.extension.project.key).toBe('PROJ');
      expect(ctx.moduleKey).toBe('my-panel');
    });

    it('hydrates full issue data when mock API available', async () => {
      sim.productApi.mockRoutes('jira', {
        '/rest/api/3/issue/TEST-99?fields=summary,issuetype,project': {
          key: 'TEST-99',
          id: '20001',
          fields: {
            summary: 'Test issue',
            issuetype: { name: 'Story', id: '10200' },
            project: { key: 'TEST', id: '20000', projectTypeKey: 'business' },
          },
        },
      });

      const renderContext: RenderContextOptions = { issueKey: 'TEST-99' };
      const ctx = await buildForgeContext(sim, 'panel', 'jira:issuePanel', renderContext);

      expect(ctx.extension.issue.key).toBe('TEST-99');
      expect(ctx.extension.issue.id).toBe('20001');
      expect(ctx.extension.issue.type).toBe('Story');
      expect(ctx.extension.issue.typeId).toBe('10200');
      expect(ctx.extension.project.key).toBe('TEST');
      expect(ctx.extension.project.id).toBe('20000');
      expect(ctx.extension.project.type).toBe('business');
    });

    it('works with issueActivity module type', async () => {
      const ctx = await buildForgeContext(sim, 'activity', 'jira:issueActivity', {
        issueKey: 'DEV-5',
      });

      expect(ctx.extension.type).toBe('jira:issueActivity');
      expect(ctx.extension.issueKey).toBe('DEV-5');
      expect(ctx.extension.projectKey).toBe('DEV');
    });

    it('works with issueGlance module type', async () => {
      const ctx = await buildForgeContext(sim, 'glance', 'jira:issueGlance', {
        issueKey: 'ABC-123',
      });

      expect(ctx.extension.type).toBe('jira:issueGlance');
      expect(ctx.extension.issue.key).toBe('ABC-123');
      expect(ctx.extension.projectKey).toBe('ABC');
    });
  });

  describe('--content flag', () => {
    it('builds context with contentId (no API)', async () => {
      const ctx = await buildForgeContext(sim, 'byline', 'confluence:contentBylineItem', {
        contentId: '98765',
      });

      expect(ctx.extension.type).toBe('confluence:contentBylineItem');
      expect(ctx.extension.contentId).toBe('98765');
      expect(ctx.extension.content.id).toBe('98765');
    });

    it('includes spaceKey when both --content and --space provided', async () => {
      const ctx = await buildForgeContext(sim, 'byline', 'confluence:contentBylineItem', {
        contentId: '98765',
        spaceKey: 'DOCS',
      });

      expect(ctx.extension.contentId).toBe('98765');
      expect(ctx.extension.spaceKey).toBe('DOCS');
      expect(ctx.extension.space.key).toBe('DOCS');
    });

    it('hydrates content data when mock API available', async () => {
      sim.productApi.mockRoutes('confluence', {
        '/rest/api/content/55555?expand=space': {
          id: '55555',
          type: 'page',
          space: { key: 'ENG', id: '30000' },
        },
      });

      const ctx = await buildForgeContext(sim, 'action', 'confluence:contentAction', {
        contentId: '55555',
      });

      expect(ctx.extension.content.id).toBe('55555');
      expect(ctx.extension.content.type).toBe('page');
      expect(ctx.extension.space.key).toBe('ENG');
      expect(ctx.extension.space.id).toBe('30000');
      expect(ctx.extension.contentId).toBe('55555');
      expect(ctx.extension.spaceKey).toBe('ENG');
    });
  });

  describe('--context flag (raw JSON)', () => {
    it('merges raw JSON into extension', async () => {
      const ctx = await buildForgeContext(sim, 'page', 'jira:globalPage', {
        context: { customSetting: 'dark', featureFlag: true },
      });

      expect(ctx.extension.type).toBe('jira:globalPage');
      expect(ctx.extension.customSetting).toBe('dark');
      expect(ctx.extension.featureFlag).toBe(true);
    });

    it('smart-hydrates issueKey inside context JSON for Jira issue modules', async () => {
      const ctx = await buildForgeContext(sim, 'panel', 'jira:issuePanel', {
        context: { issueKey: 'SMART-1', extraData: 'preserved' },
      });

      // Should have hydrated AND preserved extra fields
      expect(ctx.extension.issueKey).toBe('SMART-1');
      expect(ctx.extension.issue.key).toBe('SMART-1');
      expect(ctx.extension.extraData).toBe('preserved');
    });

    it('does not smart-hydrate issueKey for non-issue modules', async () => {
      const ctx = await buildForgeContext(sim, 'page', 'confluence:globalPage', {
        context: { issueKey: 'NOPE-1' },
      });

      expect(ctx.extension.issueKey).toBe('NOPE-1');
      expect(ctx.extension.issue).toBeUndefined();
    });
  });

  describe('no context flags (default behavior)', () => {
    it('buildDefaultContext returns minimal extension', () => {
      const ctx = buildDefaultContext('panel', 'jira:issuePanel');

      expect(ctx.extension).toEqual({ type: 'jira:issuePanel' });
      expect(ctx.moduleKey).toBe('panel');
      expect(ctx.accountId).toBe('sim-user-001');
    });

    it('buildForgeContext with no options matches default behavior', async () => {
      const ctx = await buildForgeContext(sim, 'panel', 'jira:issuePanel');

      expect(ctx.extension).toEqual({ type: 'jira:issuePanel' });
      expect(ctx.moduleKey).toBe('panel');
    });
  });

  describe('context with real account credentials', () => {
    it('uses real account info in base context', async () => {
      sim.productApi.connectRealApis({
        id: 'test',
        site: 'mysite.atlassian.net',
        accountId: 'user-abc',
        cloudId: 'cloud-xyz',
        authType: 'pat',
        token: 'fake-token',
      });

      const ctx = await buildForgeContext(sim, 'panel', 'jira:issuePanel', {
        issueKey: 'PROJ-1',
      });

      expect(ctx.accountId).toBe('user-abc');
      expect(ctx.cloudId).toBe('cloud-xyz');
      expect(ctx.siteUrl).toBe('https://mysite.atlassian.net');
      expect(ctx.extension.issueKey).toBe('PROJ-1');
    });
  });

  describe('CLI flag simulation', () => {
    // These simulate what cli.ts produces from the parsed flags

    it('--issue PROJ-42 produces correct RenderContextOptions', async () => {
      // Simulates: forge-sim dev --issue PROJ-42
      const renderContext: RenderContextOptions = { issueKey: 'PROJ-42' };
      const ctx = await buildForgeContext(sim, 'panel', 'jira:issuePanel', renderContext);

      expect(ctx.extension.issueKey).toBe('PROJ-42');
      expect(ctx.extension.issue.key).toBe('PROJ-42');
    });

    it('--content 12345 --space DOCS produces correct RenderContextOptions', async () => {
      // Simulates: forge-sim dev --content 12345 --space DOCS
      const renderContext: RenderContextOptions = { contentId: '12345', spaceKey: 'DOCS' };
      const ctx = await buildForgeContext(sim, 'macro', 'macro', renderContext);

      expect(ctx.extension.contentId).toBe('12345');
      expect(ctx.extension.spaceKey).toBe('DOCS');
    });

    it('--context with complex JSON produces correct RenderContextOptions', async () => {
      // Simulates: forge-sim dev --context '{"dashboard":{"id":"100"},"gadget":{"id":"200"}}'
      const renderContext: RenderContextOptions = {
        context: { dashboard: { id: '100' }, gadget: { id: '200' } },
      };
      const ctx = await buildForgeContext(sim, 'gadget', 'jira:dashboardGadget', renderContext);

      expect(ctx.extension.dashboard).toEqual({ id: '100' });
      expect(ctx.extension.gadget).toEqual({ id: '200' });
    });

    it('no flags means renderContext is undefined → uses buildDefaultContext path', () => {
      // Simulates: forge-sim dev (no context flags)
      const hasContextFlags = false;
      const renderContext = hasContextFlags ? {} : undefined;

      expect(renderContext).toBeUndefined();

      // In devCommand, this means buildDefaultContext is called
      const ctx = buildDefaultContext('panel', 'jira:issuePanel', sim.productApi.connectedAccount);
      expect(ctx.extension).toEqual({ type: 'jira:issuePanel' });
    });
  });

  describe('startup context hint (F5)', () => {
    const mod = (type: string, key = 'm1') =>
      ({ module: { key, type }, resourcePath: '', mode: 'uikit' }) as any;

    it('suggests --issue for issue modules when no context flags given', async () => {
      const { contextHintLines } = await import('../dev-command.js');
      const lines = contextHintLines([mod('jira:issuePanel')], undefined);
      expect(lines.join('\n')).toContain('--issue PROJ-1');
      expect(lines.join('\n')).toContain('--context');
    });

    it('suggests each relevant flag once across module kinds', async () => {
      const { contextHintLines } = await import('../dev-command.js');
      const lines = contextHintLines(
        [mod('jira:issuePanel'), mod('jira:issueGlance', 'm2'), mod('macro', 'm3'), mod('confluence:spacePage', 'm4')],
        undefined,
      );
      const text = lines.join('\n');
      expect(text.match(/--issue PROJ-1/g)).toHaveLength(1);
      expect(text).toContain('--content 12345');
      expect(text).toContain('--space DOCS');
    });

    it('stays silent when context flags were provided', async () => {
      const { contextHintLines } = await import('../dev-command.js');
      expect(contextHintLines([mod('jira:issuePanel')], { issueKey: 'PROJ-1' })).toEqual([]);
    });

    it('stays silent for modules that need no item context', async () => {
      const { contextHintLines } = await import('../dev-command.js');
      expect(contextHintLines([mod('jira:globalPage')], undefined)).toEqual([]);
    });
  });

  describe('hydration fallback warning (F8)', () => {
    it('warns when --issue points at an issue no mock or real API can serve', async () => {
      const { vi } = await import('vitest');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        // Publish-gate F8: `--issue GATE-1` against an empty mock set used to
        // fall back to minimal context with zero log output.
        await buildForgeContext(sim, 'panel', 'jira:issuePanel', { issueKey: 'GATE-1' });
        const hydrationWarns = warnSpy.mock.calls.filter((args) =>
          typeof args[0] === 'string' && args[0].includes('Could not hydrate issue "GATE-1"')
        );
        expect(hydrationWarns).toHaveLength(1);
        // The message must be actionable: name the route to mock.
        expect(hydrationWarns[0][0]).toContain('GET /rest/api/3/issue/GATE-1');
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('does NOT warn when the issue hydrates from a mock route', async () => {
      const { vi } = await import('vitest');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        sim.productApi.mockRoutes('jira', {
          '/rest/api/3/issue/OK-1?fields=summary,issuetype,project': {
            key: 'OK-1', id: '1',
            fields: { summary: 'x', issuetype: { name: 'Task', id: '1' }, project: { key: 'OK', id: '2' } },
          },
        });
        await buildForgeContext(sim, 'panel', 'jira:issuePanel', { issueKey: 'OK-1' });
        const hydrationWarns = warnSpy.mock.calls.filter((args) =>
          typeof args[0] === 'string' && args[0].includes('Could not hydrate')
        );
        expect(hydrationWarns).toHaveLength(0);
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('warns for content and project hydration failures too', async () => {
      const { vi } = await import('vitest');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        await buildForgeContext(sim, 'macro', 'macro', { contentId: '404404' });
        await buildForgeContext(sim, 'page', 'jira:projectPage', { projectKey: 'NOPE' });
        const text = warnSpy.mock.calls.map((a) => String(a[0])).join('\n');
        expect(text).toContain('Could not hydrate content "404404"');
        expect(text).toContain('Could not hydrate project "NOPE"');
      } finally {
        warnSpy.mockRestore();
      }
    });
  });
});
