/**
 * Tests for the Forge context system:
 *   - buildForgeContext() with various options
 *   - Context flowing through to bridge (view.getContext)
 *   - Context hydration from item keys
 *   - Module-type-specific extension data
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ForgeSimulator, setSimulator, buildForgeContext, buildDefaultContext } from '../index.js';

describe('buildDefaultContext', () => {
  it('returns base context with module key and type', () => {
    const ctx = buildDefaultContext('my-panel', 'jira:issuePanel');
    expect(ctx.moduleKey).toBe('my-panel');
    expect(ctx.extension.type).toBe('jira:issuePanel');
    expect(ctx.accountId).toBe('sim-user-001');
    expect(ctx.cloudId).toBe('sim-cloud-001');
    expect(ctx.environmentType).toBe('DEVELOPMENT');
    expect(ctx.locale).toBe('en-US');
    expect(ctx.timezone).toBeTruthy();
  });

  it('uses real account info when provided', () => {
    const ctx = buildDefaultContext('my-panel', 'jira:issuePanel', {
      accountId: 'real-user-123',
      cloudId: 'real-cloud-456',
      site: 'mysite.atlassian.net',
    });
    expect(ctx.accountId).toBe('real-user-123');
    expect(ctx.cloudId).toBe('real-cloud-456');
    expect(ctx.siteUrl).toBe('https://mysite.atlassian.net');
  });

  it('returns empty extension when no module type', () => {
    const ctx = buildDefaultContext('test');
    expect(ctx.extension).toEqual({});
  });
});

describe('buildForgeContext', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    sim = new ForgeSimulator();
    setSimulator(sim);
  });

  it('builds context with raw context object', async () => {
    const ctx = await buildForgeContext(sim, 'my-panel', 'jira:issuePanel', {
      context: { issueKey: 'PROJ-42', projectKey: 'PROJ' },
    });
    expect(ctx.extension.type).toBe('jira:issuePanel');
    // Raw context on a Jira issue module triggers smart hydration
    // issueKey is extracted from context and hydrated
    expect(ctx.extension.issueKey).toBe('PROJ-42');
    expect(ctx.extension.issue.key).toBe('PROJ-42');
    expect(ctx.extension.projectKey).toBe('PROJ');
    expect(ctx.moduleKey).toBe('my-panel');
  });

  it('builds context with explicit extension override', async () => {
    const ctx = await buildForgeContext(sim, 'gadget', 'jira:dashboardGadget', {
      extension: {
        dashboard: { id: '100' },
        gadget: { id: '200' },
        gadgetConfiguration: { jql: 'project = TEST' },
      },
    });
    expect(ctx.extension.type).toBe('jira:dashboardGadget');
    expect(ctx.extension.dashboard.id).toBe('100');
    expect(ctx.extension.gadgetConfiguration.jql).toBe('project = TEST');
  });

  it('builds default context when no options provided', async () => {
    const ctx = await buildForgeContext(sim, 'my-panel', 'jira:globalPage');
    expect(ctx.extension.type).toBe('jira:globalPage');
    expect(ctx.moduleKey).toBe('my-panel');
  });

  describe('issueKey hydration (no real API)', () => {
    it('extracts project key from issue key when no API available', async () => {
      const ctx = await buildForgeContext(sim, 'panel', 'jira:issuePanel', {
        issueKey: 'PROJ-42',
      });
      expect(ctx.extension.issueKey).toBe('PROJ-42');
      expect(ctx.extension.issue.key).toBe('PROJ-42');
      expect(ctx.extension.projectKey).toBe('PROJ');
      expect(ctx.extension.project.key).toBe('PROJ');
      expect(ctx.extension.type).toBe('jira:issuePanel');
    });
  });

  describe('issueKey hydration (with mock API)', () => {
    it('hydrates full issue context from mock product API', async () => {
      // Set up a mock for the issue endpoint
      sim.productApi.mockRoutes('jira', {
        '/rest/api/3/issue/PROJ-42?fields=summary,issuetype,project': {
          key: 'PROJ-42',
          id: '10001',
          fields: {
            summary: 'Fix the thing',
            issuetype: { name: 'Bug', id: '10100' },
            project: { key: 'PROJ', id: '10000', projectTypeKey: 'software' },
          },
        },
      });

      const ctx = await buildForgeContext(sim, 'panel', 'jira:issuePanel', {
        issueKey: 'PROJ-42',
      });

      expect(ctx.extension.issue.key).toBe('PROJ-42');
      expect(ctx.extension.issue.id).toBe('10001');
      expect(ctx.extension.issue.type).toBe('Bug');
      expect(ctx.extension.issue.typeId).toBe('10100');
      expect(ctx.extension.project.key).toBe('PROJ');
      expect(ctx.extension.project.id).toBe('10000');
      expect(ctx.extension.project.type).toBe('software');
      expect(ctx.extension.issueKey).toBe('PROJ-42');
      expect(ctx.extension.projectKey).toBe('PROJ');
    });
  });

  describe('contentId hydration (no real API)', () => {
    it('uses contentId and spaceKey as-is when no API available', async () => {
      const ctx = await buildForgeContext(sim, 'byline', 'confluence:contentBylineItem', {
        contentId: '12345',
        spaceKey: 'MYSPACE',
      });
      expect(ctx.extension.contentId).toBe('12345');
      expect(ctx.extension.content.id).toBe('12345');
      expect(ctx.extension.spaceKey).toBe('MYSPACE');
      expect(ctx.extension.space.key).toBe('MYSPACE');
      expect(ctx.extension.type).toBe('confluence:contentBylineItem');
    });
  });

  describe('smart context merging', () => {
    it('auto-hydrates issueKey from context object on Jira issue modules', async () => {
      const ctx = await buildForgeContext(sim, 'panel', 'jira:issuePanel', {
        context: { issueKey: 'TEST-1', customField: 'hello' },
      });
      // Should have hydrated issue context AND kept the extra field
      expect(ctx.extension.issueKey).toBe('TEST-1');
      expect(ctx.extension.issue.key).toBe('TEST-1');
      expect(ctx.extension.customField).toBe('hello');
    });

    it('does not auto-hydrate issueKey on non-issue modules', async () => {
      const ctx = await buildForgeContext(sim, 'page', 'jira:globalPage', {
        context: { issueKey: 'TEST-1' },
      });
      // Should just pass through as-is, no hydration
      expect(ctx.extension.issueKey).toBe('TEST-1');
      expect(ctx.extension.issue).toBeUndefined();
    });
  });

  describe('projectKey hydration (no real API)', () => {
    it('uses projectKey as-is when no API available', async () => {
      const ctx = await buildForgeContext(sim, 'settings', 'jira:projectSettingsPage', {
        projectKey: 'MYPROJ',
      });
      expect(ctx.extension.projectKey).toBe('MYPROJ');
      expect(ctx.extension.project.key).toBe('MYPROJ');
      expect(ctx.extension.type).toBe('jira:projectSettingsPage');
    });
  });

  describe('projectKey hydration (with mock API)', () => {
    it('hydrates full project context from mock product API', async () => {
      sim.productApi.mockRoutes('jira', {
        '/rest/api/3/project/PROJ': {
          id: '10000',
          key: 'PROJ',
          projectTypeKey: 'software',
        },
      });

      const ctx = await buildForgeContext(sim, 'settings', 'jira:projectSettingsPage', {
        projectKey: 'PROJ',
      });

      expect(ctx.extension.project.key).toBe('PROJ');
      expect(ctx.extension.project.id).toBe('10000');
      expect(ctx.extension.project.type).toBe('software');
      expect(ctx.extension.projectKey).toBe('PROJ');
      expect(ctx.extension.projectId).toBe('10000');
    });
  });

  describe('module type default contexts', () => {
    it('jira:projectPage gets default project context', async () => {
      const ctx = await buildForgeContext(sim, 'proj-page', 'jira:projectPage');
      expect(ctx.extension.project.key).toBe('SIM');
      expect(ctx.extension.projectKey).toBe('SIM');
      expect(ctx.extension.projectId).toBe('10001');
    });

    it('jira:projectSettingsPage gets default project context', async () => {
      const ctx = await buildForgeContext(sim, 'settings', 'jira:projectSettingsPage');
      expect(ctx.extension.project.key).toBe('SIM');
      expect(ctx.extension.projectKey).toBe('SIM');
    });

    it('confluence:spaceSettings gets default space context', async () => {
      const ctx = await buildForgeContext(sim, 'space-settings', 'confluence:spaceSettings');
      expect(ctx.extension.space.key).toBe('SIM');
      expect(ctx.extension.spaceKey).toBe('SIM');
    });

    it('confluence:spaceSidebar gets default space context', async () => {
      const ctx = await buildForgeContext(sim, 'sidebar', 'confluence:spaceSidebar');
      expect(ctx.extension.space.key).toBe('SIM');
      expect(ctx.extension.spaceKey).toBe('SIM');
    });

    it('confluence:globalSettings gets type-only context', async () => {
      const ctx = await buildForgeContext(sim, 'global', 'confluence:globalSettings');
      expect(ctx.extension.type).toBe('confluence:globalSettings');
    });

    it('confluence:homepageFeed gets type-only context', async () => {
      const ctx = await buildForgeContext(sim, 'feed', 'confluence:homepageFeed');
      expect(ctx.extension.type).toBe('confluence:homepageFeed');
    });
  });
});

describe('Context flows through bridge', () => {
  let sim: ForgeSimulator;

  beforeEach(async () => {
    sim = new ForgeSimulator();
    setSimulator(sim);
    // Deploy a simple test app so we can render
    await sim.deploy(new URL('../__tests__/fixtures/simple-panel', import.meta.url).pathname);
  });

  it('render() sets context accessible via sim.ui.getContext()', async () => {
    await sim.ui.render('simple-panel', {
      context: { issueKey: 'PROJ-42', projectKey: 'PROJ' },
    });

    const ctx = sim.ui.getContext('simple-panel');
    expect(ctx).toBeTruthy();
    expect(ctx!.extension.issueKey).toBe('PROJ-42');
    expect(ctx!.extension.projectKey).toBe('PROJ');
    expect(ctx!.moduleKey).toBe('simple-panel');
  });

  it('render() with issueKey shortcut builds context', async () => {
    await sim.ui.render('simple-panel', { issueKey: 'TEST-99' });

    const ctx = sim.ui.getContext('simple-panel');
    expect(ctx).toBeTruthy();
    expect(ctx!.extension.issueKey).toBe('TEST-99');
    expect(ctx!.extension.issue.key).toBe('TEST-99');
    // Project key extracted from issue key
    expect(ctx!.extension.projectKey).toBe('TEST');
  });

  it('context resets when UI is reset', async () => {
    await sim.ui.render('simple-panel', { context: { issueKey: 'X-1' } });
    expect(sim.ui.getContext('simple-panel')).toBeTruthy();

    sim.ui.reset();
    expect(sim.ui.getContext('simple-panel')).toBeNull();
  });

  it('different modules get different contexts', async () => {
    // Deploy dual-panel fixture for multiple modules
    sim.ui.resetAll();
    await sim.deploy(new URL('../__tests__/fixtures/dual-panel', import.meta.url).pathname);

    await sim.ui.render('issue-summary', {
      context: { issueKey: 'PROJ-1' },
    });
    await sim.ui.render('admin-settings');

    const issueCtx = sim.ui.getContext('issue-summary');
    const adminCtx = sim.ui.getContext('admin-settings');

    expect(issueCtx!.extension.issueKey).toBe('PROJ-1');
    expect(issueCtx!.moduleKey).toBe('issue-summary');

    expect(adminCtx!.moduleKey).toBe('admin-settings');
    expect(adminCtx!.extension.issueKey).toBeUndefined();
  });
});

describe('Context + Resolver integration', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    sim = new ForgeSimulator();
    setSimulator(sim);
  });

  it('extension fields are passed to resolver context', async () => {
    await sim.deploy(new URL('../__tests__/fixtures/simple-panel', import.meta.url).pathname);

    await sim.ui.render('simple-panel', {
      context: { issueKey: 'PROJ-42', projectKey: 'PROJ' },
    });

    // The resolver should have received context overrides including issueKey
    const overrides = sim.resolver.getContextOverrides();
    expect(overrides.issueKey).toBe('PROJ-42');
    expect(overrides.projectKey).toBe('PROJ');
    expect(overrides.moduleKey).toBe('simple-panel');
  });
});
