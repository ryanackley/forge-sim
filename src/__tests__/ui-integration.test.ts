/**
 * Integration test: UIKit app → bridge → ForgeSimulator → resolver → product API + KVS
 * 
 * This is the full stack: a React UI component calls invoke(), which goes through
 * the bridge to the simulator, which runs the actual resolver code, which calls
 * mocked Jira APIs and writes to simulated KVS.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Bridge must be installed BEFORE any @forge/react or @forge/bridge imports
import { installBridge, connectSimulator, getLatestForgeDoc, waitForRender, resetBridge } from '../ui/bridge.js';
installBridge();

import { createSimulator, ForgeSimulator } from '../simulator.js';
import { findByType, findFirstByType, getTextContent, simulateEvent, prettyPrint } from '../ui/doc-utils.js';

describe('UI ↔ Simulator Integration', () => {
  let sim: ForgeSimulator;

  beforeEach(async () => {
    // Reset everything
    resetBridge();
    vi.resetModules();

    // Fresh simulator
    sim = createSimulator();
    connectSimulator(sim);

    // Mock Jira API
    sim.mockProductRoutes('jira', {
      '/rest/api/3/issue/TEST-1': { key: 'TEST-1', summary: 'Fix the thing' },
    });
  });

  it('should render a UIKit app that calls a simulated resolver', async () => {
    // Register the resolver (normally done by deploy(), but manual here for clarity)
    // This imports the shims which route to our simulator
    const { invoke: simInvoke } = await import('../shims/forge-api.js');
    
    sim.resolver.define('getIssue', async (req) => {
      const { issueKey } = req.payload;
      const resp = await sim.productApi.request('jira', `/rest/api/3/issue/${issueKey}`);
      const issue = await resp.json();
      
      const viewKey = `views:${issueKey}`;
      const currentViews = (await sim.kvs.get(viewKey)) || 0;
      await sim.kvs.set(viewKey, currentViews + 1);
      
      return { issue, views: currentViews + 1 };
    });

    // Wait for the initial render + the async data load re-render
    const renderPromise = waitForRender();
    
    // Import the UI app (triggers ForgeReconciler.render())
    await import('../../test-app/src/ui-app.js');
    
    // First render shows "Loading..."
    let doc = await renderPromise;
    let text = getTextContent(doc);
    expect(text).toContain('Loading');

    // Wait for the invoke to complete and trigger re-render
    const dataRender = await waitForRender();
    text = getTextContent(dataRender);
    
    expect(text).toContain('TEST-1');
    expect(text).toContain('Fix the thing');
    expect(text).toContain('Views');
    expect(text).toContain('1');

    // Verify KVS was written
    expect(await sim.kvs.get('views:TEST-1')).toBe(1);

    console.log('Rendered UI:\n' + prettyPrint(dataRender));
  });

  it('should update UI when clicking refresh (invoke called again)', async () => {
    sim.resolver.define('getIssue', async (req) => {
      const { issueKey } = req.payload;
      const resp = await sim.productApi.request('jira', `/rest/api/3/issue/${issueKey}`);
      const issue = await resp.json();
      
      const viewKey = `views:${issueKey}`;
      const currentViews = (await sim.kvs.get(viewKey)) || 0;
      await sim.kvs.set(viewKey, currentViews + 1);
      
      return { issue, views: currentViews + 1 };
    });

    // Load app and wait for data
    const renderPromise = waitForRender();
    await import('../../test-app/src/ui-app.js');
    await renderPromise;
    const firstDataRender = await waitForRender();

    // Verify initial state
    expect(getTextContent(firstDataRender)).toContain('Views');
    expect(await sim.kvs.get('views:TEST-1')).toBe(1);

    // Click "Refresh" button
    const button = findFirstByType(firstDataRender, 'Button');
    expect(button).not.toBeNull();
    
    const refreshRender = waitForRender();
    simulateEvent(button!, 'onClick');
    
    // Wait for loading state
    const loadingDoc = await refreshRender;
    
    // Wait for data to come back
    const updatedDoc = await waitForRender();
    const text = getTextContent(updatedDoc);
    
    // Views should now be 2
    expect(text).toContain('2');
    expect(await sim.kvs.get('views:TEST-1')).toBe(2);
  });
});
