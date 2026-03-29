/**
 * Dual-panel integration test — two UI modules in one app.
 * Tests that modules have isolated ForgeDoc trees, separate contexts,
 * and shared storage (KVS).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createSimulator, ForgeSimulator } from '../simulator.js';

const FIXTURE_DIR = new URL('./fixtures/dual-panel', import.meta.url).pathname;

describe('Dual Panel App', () => {
  let sim: ForgeSimulator;

  beforeEach(async () => {
    sim = createSimulator();
    await sim.deploy(FIXTURE_DIR);
  });

  it('deploys with two UI modules and four resolvers', () => {
    const manifest = sim.getManifest()!;
    expect(manifest.uiModules).toHaveLength(2);
    expect(manifest.uiModules.map(m => m.key)).toEqual(['issue-summary', 'admin-settings']);

    const resolvers = sim.resolver.getDefinitions();
    expect(resolvers).toContain('getIssueSummary');
    expect(resolvers).toContain('getIssueComments');
    expect(resolvers).toContain('getSettings');
    expect(resolvers).toContain('updateTheme');
  });

  it('renders issue panel with context', async () => {
    await sim.ui.render('issue-summary', {
      context: { issueKey: 'PROJ-42' },
    });

    // Wait for async data to load (replaces "Loading issue...")
    const doc = await sim.ui.waitForContent('issue-summary', 'Summary for PROJ-42');
    const text = sim.ui.getTextContent(doc);
    expect(text).toContain('Summary for PROJ-42');
    // Badge text is in props, not text content — check the JSON tree
    const docJson = JSON.stringify(doc);
    expect(docJson).toContain('views');
  });

  it('renders admin page independently', async () => {
    await sim.ui.render('admin-settings');

    const doc = await sim.ui.waitForContent('admin-settings', 'Admin Settings');
    const text = sim.ui.getTextContent(doc);
    expect(text).toContain('Admin Settings');
    expect(text).toContain('Theme: light');
    expect(text).toContain('v1.2.0');
  });

  it('renders both modules with isolated ForgeDoc trees', async () => {
    // Render issue panel
    await sim.ui.render('issue-summary', {
      context: { issueKey: 'TEST-1' },
    });
    await sim.ui.waitForContent('issue-summary', 'Summary for TEST-1');

    // Render admin panel
    await sim.ui.render('admin-settings');
    await sim.ui.waitForContent('admin-settings', 'Admin Settings');

    // Both should be independently accessible
    const issueDoc = sim.ui.getForgeDoc('issue-summary')!;
    const adminDoc = sim.ui.getForgeDoc('admin-settings')!;

    expect(issueDoc).not.toBeNull();
    expect(adminDoc).not.toBeNull();

    // Verify content isolation
    const issueText = sim.ui.getTextContent(issueDoc);
    const adminText = sim.ui.getTextContent(adminDoc);

    expect(issueText).toContain('Summary for TEST-1');
    expect(adminText).toContain('Admin Settings');

    // Cross-contamination check
    expect(issueText).not.toContain('Admin Settings');
    expect(adminText).not.toContain('TEST-1');

    // Both modules tracked
    const modules = sim.ui.getRenderedModules();
    expect(modules).toContain('issue-summary');
    expect(modules).toContain('admin-settings');
  });

  it('modules share KVS storage', async () => {
    // Render issue panel — it increments view count in KVS
    await sim.ui.render('issue-summary', {
      context: { issueKey: 'SHARED-1' },
    });
    await sim.ui.waitForContent('issue-summary', 'Summary for SHARED-1');

    // View count should be in KVS
    const views = await sim.kvs.get('views:SHARED-1');
    expect(views).toBe(1);

    // Admin panel can also read/write the same KVS
    await sim.kvs.set('settings:theme', 'dark');

    // Render admin panel — it should read the theme we just set
    await sim.ui.render('admin-settings');
    const adminDoc = await sim.ui.waitForContent('admin-settings', 'Theme: dark');
    expect(sim.ui.getTextContent(adminDoc)).toContain('Theme: dark');
  });

  it('context is scoped per module', async () => {
    // Render issue panel with issueKey context
    await sim.ui.render('issue-summary', {
      context: { issueKey: 'CTX-99' },
    });
    await sim.ui.waitForContent('issue-summary', 'CTX-99');

    // Render admin panel with no context — should still work
    await sim.ui.render('admin-settings');
    await sim.ui.waitForContent('admin-settings', 'Admin Settings');

    // Issue panel's context shouldn't leak to admin
    const adminText = sim.ui.getTextContent(sim.ui.getForgeDoc('admin-settings')!);
    expect(adminText).not.toContain('CTX-99');
  });

  it('refresh preserves module context', async () => {
    // Render issue panel with context
    await sim.ui.render('issue-summary', {
      context: { issueKey: 'REFRESH-1' },
    });
    await sim.ui.waitForContent('issue-summary', 'Summary for REFRESH-1');

    // Refresh — should re-render with the same context
    await sim.ui.refresh('issue-summary');
    const refreshed = await sim.ui.waitForContent('issue-summary', 'Summary for REFRESH-1');
    expect(sim.ui.getTextContent(refreshed)).toContain('Summary for REFRESH-1');

    // View count should have incremented (2 renders = 2 views)
    const views = await sim.kvs.get('views:REFRESH-1');
    expect(views).toBe(2);
  });

  it('ui.findByType finds components in rendered module', async () => {
    await sim.ui.render('admin-settings');
    const doc = await sim.ui.waitForContent('admin-settings', 'Admin Settings');

    // Should have Text and Button components
    const texts = sim.ui.findByType(doc, 'Text');
    expect(texts.length).toBeGreaterThan(0);

    const buttons = sim.ui.findByType(doc, 'Button');
    expect(buttons.length).toBeGreaterThan(0);

    // Button should have theme toggle text
    const toggleBtn = buttons.find(b =>
      b.props.text?.includes('dark') || b.props.text?.includes('light')
    );
    expect(toggleBtn).toBeDefined();
  });
});
