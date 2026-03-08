/**
 * Tests for SimulatorUI — the first-class UI API on ForgeSimulator.
 *
 * Demonstrates the clean unit test story:
 *   const sim = new ForgeSimulator();
 *   await sim.deploy('./my-app');
 *   await sim.invoke('getPanel', { issueKey: 'PROJ-1' });
 *   const doc = sim.ui.getForgeDoc();
 *   // assert on the tree, interact with components, etc.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ForgeSimulator } from '../simulator.js';
import { setSimulator } from '../shims/globals.js';

describe('SimulatorUI', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    sim = new ForgeSimulator();
    setSimulator(sim);
  });

  afterEach(() => {
    sim.reset();
  });

  describe('bridge lifecycle', () => {
    it('sim.ui exists on ForgeSimulator', () => {
      expect(sim.ui).toBeDefined();
      expect(typeof sim.ui.getForgeDoc).toBe('function');
      expect(typeof sim.ui.waitForRender).toBe('function');
      expect(typeof sim.ui.interact).toBe('function');
      expect(typeof sim.ui.findByType).toBe('function');
      expect(typeof sim.ui.prettyPrint).toBe('function');
    });

    it('getForgeDoc returns null before any render', () => {
      expect(sim.ui.getForgeDoc()).toBeNull();
    });

    it('ensureBridge is idempotent', () => {
      sim.ui.ensureBridge();
      sim.ui.ensureBridge(); // should not throw
    });
  });

  describe('deploy + UI access', () => {
    it('ForgeDoc is available after deploy + invoke', async () => {
      const fixtureDir = new URL('./fixtures/my-issues', import.meta.url).pathname;
      await sim.deploy(fixtureDir);
      await sim.invoke('getMyIssues', {});

      const doc = sim.ui.getForgeDoc();
      expect(doc).not.toBeNull();
      expect(doc!.type).toBeDefined();
    });

    it('invoke auto-tags ForgeDoc to module key from manifest', async () => {
      // Register a resolver that triggers reconcile (simulating @forge/react)
      sim.ui.ensureBridge();
      sim.resolver.define('autoPanel', async () => {
        const bridge = (globalThis as any).__bridge;
        await bridge.callBridge('reconcile', {
          forgeDoc: { type: 'App', props: {}, key: 'root', children: [
            { type: 'String', props: { text: 'auto-tagged' }, key: 's1', children: [] },
          ]},
        });
      });
      sim.loadManifestData({
        functions: [{ key: 'autoPanel', handler: 'index.autoPanel' }],
        consumers: [], triggers: [], scheduledTriggers: [],
        uiModules: [{ type: 'jira:issuePanel', key: 'auto-panel', resolverFunctionKey: 'autoPanel' }],
        entities: [],
      });

      // Invoke directly (not through sim.ui.render) — should auto-detect module
      await sim.invoke('autoPanel', {});

      const modules = sim.ui.getRenderedModules();
      expect(modules).toContain('auto-panel');
      const doc = sim.ui.getForgeDoc('auto-panel');
      expect(doc).not.toBeNull();
      expect(sim.ui.getTextContent(doc!)).toBe('auto-tagged');
    });
  });

  describe('render + refresh', () => {
    it('render invokes module resolver and tags ForgeDoc', async () => {
      // Use a simple inline resolver that triggers React rendering
      sim.resolver.define('simplePanel', async () => {
        // Simulate what @forge/react does: call reconcile via the bridge
        const bridge = (globalThis as any).__bridge;
        await bridge.callBridge('reconcile', {
          forgeDoc: {
            type: 'App', props: {}, key: 'root', children: [
              { type: 'Text', props: {}, key: 't1', children: [
                { type: 'String', props: { text: 'Rendered!' }, key: 's1', children: [] },
              ]},
            ],
          },
        });
        return { body: 'ok' };
      });

      // Set up a manifest with a UI module pointing to our resolver
      sim.loadManifestData({
        functions: [{ key: 'simplePanel', handler: 'index.simplePanel' }],
        consumers: [],
        triggers: [],
        scheduledTriggers: [],
        uiModules: [{ type: 'jira:issuePanel', key: 'test-panel', resolverFunctionKey: 'simplePanel' }],
        entities: [],
      });

      const doc = await sim.ui.render('test-panel');
      expect(doc).not.toBeNull();
      expect(sim.ui.getTextContent(doc!)).toBe('Rendered!');
      expect(sim.ui.getForgeDoc('test-panel')).not.toBeNull();
    });

    it('render throws for unknown module key', async () => {
      sim.loadManifestData({
        functions: [], consumers: [], triggers: [], scheduledTriggers: [],
        uiModules: [{ type: 'jira:issuePanel', key: 'real-panel', resolverFunctionKey: 'fn' }],
        entities: [],
      });

      await expect(sim.ui.render('nonexistent')).rejects.toThrow('No UI module with key');
    });

    it('render throws without manifest', async () => {
      await expect(sim.ui.render('anything')).rejects.toThrow('No manifest loaded');
    });

    it('render tells you to specify resolver when function has multiple definitions', async () => {
      const fixtureDir = new URL('./fixtures/my-issues', import.meta.url).pathname;
      await sim.deploy(fixtureDir);

      // 'resolver' function registered multiple definitions — should get helpful error
      await expect(sim.ui.render('my-issues-panel')).rejects.toThrow('multiple resolver definitions');
    });

    it('refresh re-renders a module', async () => {
      let renderCount = 0;
      sim.resolver.define('counterPanel', async () => {
        renderCount++;
        const bridge = (globalThis as any).__bridge;
        await bridge.callBridge('reconcile', {
          forgeDoc: {
            type: 'App', props: {}, key: 'root', children: [
              { type: 'String', props: { text: `Render #${renderCount}` }, key: 's1', children: [] },
            ],
          },
        });
      });
      sim.loadManifestData({
        functions: [{ key: 'counterPanel', handler: 'index.counterPanel' }],
        consumers: [], triggers: [], scheduledTriggers: [],
        uiModules: [{ type: 'jira:issuePanel', key: 'counter-panel', resolverFunctionKey: 'counterPanel' }],
        entities: [],
      });

      await sim.ui.render('counter-panel');
      expect(sim.ui.getTextContent(sim.ui.getForgeDoc('counter-panel')!)).toBe('Render #1');

      await sim.ui.refresh('counter-panel');
      expect(sim.ui.getTextContent(sim.ui.getForgeDoc('counter-panel')!)).toBe('Render #2');
    });

    it('refresh with no args works when only one module rendered', async () => {
      sim.resolver.define('panel', async () => {
        const bridge = (globalThis as any).__bridge;
        await bridge.callBridge('reconcile', {
          forgeDoc: { type: 'App', props: {}, key: 'root', children: [] },
        });
      });
      sim.loadManifestData({
        functions: [{ key: 'panel', handler: 'index.panel' }],
        consumers: [], triggers: [], scheduledTriggers: [],
        uiModules: [{ type: 'jira:issuePanel', key: 'only-panel', resolverFunctionKey: 'panel' }],
        entities: [],
      });

      await sim.ui.render('only-panel');
      const doc = await sim.ui.refresh(); // no key — should auto-resolve
      expect(doc).not.toBeNull();
    });

    it('refresh throws with no modules rendered', async () => {
      sim.loadManifestData({
        functions: [], consumers: [], triggers: [], scheduledTriggers: [],
        uiModules: [{ type: 'jira:issuePanel', key: 'p', resolverFunctionKey: 'fn' }],
        entities: [],
      });

      await expect(sim.ui.refresh()).rejects.toThrow('No modules rendered');
    });
  });

  describe('tree traversal', () => {
    it('findByType finds nodes', () => {
      const doc = {
        type: 'App', props: {}, key: 'root', children: [
          { type: 'Button', props: { text: 'Click me' }, key: 'b1', children: [] },
          { type: 'Text', props: {}, key: 't1', children: [
            { type: 'String', props: { text: 'Hello' }, key: 's1', children: [] },
          ]},
          { type: 'Button', props: { text: 'Other' }, key: 'b2', children: [] },
        ],
      };

      const buttons = sim.ui.findByType(doc, 'Button');
      expect(buttons).toHaveLength(2);
    });

    it('findFirstByType returns first match', () => {
      const doc = {
        type: 'App', props: {}, key: 'root', children: [
          { type: 'Text', props: {}, key: 't1', children: [] },
          { type: 'Button', props: { label: 'first' }, key: 'b1', children: [] },
          { type: 'Button', props: { label: 'second' }, key: 'b2', children: [] },
        ],
      };

      const btn = sim.ui.findFirstByType(doc, 'Button');
      expect(btn).not.toBeNull();
      expect(btn!.props.label).toBe('first');
    });

    it('findFirstByType returns null when not found', () => {
      const doc = { type: 'App', props: {}, key: 'root', children: [] };
      expect(sim.ui.findFirstByType(doc, 'NonExistent')).toBeNull();
    });

    it('findByProps matches prop values', () => {
      const doc = {
        type: 'App', props: {}, key: 'root', children: [
          { type: 'Button', props: { appearance: 'primary' }, key: 'b1', children: [] },
          { type: 'Button', props: { appearance: 'subtle' }, key: 'b2', children: [] },
        ],
      };

      const primary = sim.ui.findByProps(doc, { appearance: 'primary' });
      expect(primary).toHaveLength(1);
      expect(primary[0].key).toBe('b1');
    });

    it('findByTypeAndText finds by content', () => {
      const doc = {
        type: 'App', props: {}, key: 'root', children: [
          { type: 'Button', props: {}, key: 'b1', children: [
            { type: 'String', props: { text: 'Save' }, key: 's1', children: [] },
          ]},
          { type: 'Button', props: {}, key: 'b2', children: [
            { type: 'String', props: { text: 'Cancel' }, key: 's2', children: [] },
          ]},
        ],
      };

      const saveBtn = sim.ui.findByTypeAndText(doc, 'Button', 'Save');
      expect(saveBtn.key).toBe('b1');
    });

    it('findByTypeAndText throws on no match', () => {
      const doc = { type: 'App', props: {}, key: 'root', children: [] };
      expect(() => sim.ui.findByTypeAndText(doc, 'Button')).toThrow('No Button found');
    });

    it('getTextContent extracts text from tree', () => {
      const doc = {
        type: 'Text', props: {}, key: 't1', children: [
          { type: 'String', props: { text: 'Hello ' }, key: 's1', children: [] },
          { type: 'String', props: { text: 'World' }, key: 's2', children: [] },
        ],
      };

      expect(sim.ui.getTextContent(doc)).toBe('Hello World');
    });

    it('listComponentTypes lists unique types', () => {
      const doc = {
        type: 'App', props: {}, key: 'root', children: [
          { type: 'Button', props: {}, key: 'b1', children: [] },
          { type: 'Text', props: {}, key: 't1', children: [
            { type: 'String', props: { text: 'hi' }, key: 's1', children: [] },
          ]},
          { type: 'Button', props: {}, key: 'b2', children: [] },
        ],
      };

      const types = sim.ui.listComponentTypes(doc);
      expect(types).toContain('App');
      expect(types).toContain('Button');
      expect(types).toContain('Text');
      // String is excluded by listComponentTypes
    });
  });

  describe('interaction', () => {
    it('interact fires event handler', () => {
      let clicked = false;
      const node = {
        type: 'Button',
        props: { onClick: () => { clicked = true; } },
        key: 'b1',
        children: [],
      };

      sim.ui.interact(node, 'onClick');
      expect(clicked).toBe(true);
    });

    it('interact returns handler result', () => {
      const node = {
        type: 'Button',
        props: { onClick: () => 42 },
        key: 'b1',
        children: [],
      };

      expect(sim.ui.interact(node, 'onClick')).toBe(42);
    });

    it('interact returns undefined for missing handler', () => {
      const node = { type: 'Button', props: {}, key: 'b1', children: [] };
      expect(sim.ui.interact(node, 'onClick')).toBeUndefined();
    });

    it('interact passes args to handler', () => {
      const node = {
        type: 'Select',
        props: { onChange: (val: string) => `selected: ${val}` },
        key: 's1',
        children: [],
      };

      expect(sim.ui.interact(node, 'onChange', 'option-a')).toBe('selected: option-a');
    });
  });

  describe('prettyPrint', () => {
    it('renders a readable tree', () => {
      const doc = {
        type: 'App', props: {}, key: 'root', children: [
          { type: 'Text', props: {}, key: 't1', children: [
            { type: 'String', props: { text: 'Hello' }, key: 's1', children: [] },
          ]},
        ],
      };

      const output = sim.ui.prettyPrint(doc);
      expect(output).toContain('<App>');
      expect(output).toContain('<Text>');
      expect(output).toContain('text="Hello"');
    });
  });

  describe('reset', () => {
    it('reset clears ForgeDoc', () => {
      // Manually inject a doc state through the bridge
      sim.ui.ensureBridge();
      // After reset, doc should be null
      sim.ui.reset();
      expect(sim.ui.getForgeDoc()).toBeNull();
    });
  });

  describe('multi-module isolation', () => {
    it('modules have separate ForgeDoc trees', async () => {
      sim.ui.ensureBridge();
      const bridge = (globalThis as any).__bridge;

      // Simulate rendering module A
      sim.ui.setActiveModule('panel-a');
      await bridge.callBridge('reconcile', {
        forgeDoc: {
          type: 'App', props: {}, key: 'root-a', children: [
            { type: 'Text', props: {}, key: 't1', children: [
              { type: 'String', props: { text: 'Panel A' }, key: 's1', children: [] },
            ]},
          ],
        },
      });
      sim.ui.setActiveModule(null);

      // Simulate rendering module B
      sim.ui.setActiveModule('panel-b');
      await bridge.callBridge('reconcile', {
        forgeDoc: {
          type: 'App', props: {}, key: 'root-b', children: [
            { type: 'Text', props: {}, key: 't2', children: [
              { type: 'String', props: { text: 'Panel B' }, key: 's2', children: [] },
            ]},
          ],
        },
      });
      sim.ui.setActiveModule(null);

      // Both should be independently accessible
      const docA = sim.ui.getForgeDoc('panel-a');
      const docB = sim.ui.getForgeDoc('panel-b');
      expect(docA).not.toBeNull();
      expect(docB).not.toBeNull();
      expect(sim.ui.getTextContent(docA!)).toBe('Panel A');
      expect(sim.ui.getTextContent(docB!)).toBe('Panel B');

      // Rendered modules list
      const modules = sim.ui.getRenderedModules();
      expect(modules).toContain('panel-a');
      expect(modules).toContain('panel-b');
    });

    it('getForgeDoc without key returns last rendered', async () => {
      sim.ui.ensureBridge();
      const bridge = (globalThis as any).__bridge;

      sim.ui.setActiveModule('first');
      await bridge.callBridge('reconcile', {
        forgeDoc: { type: 'App', props: {}, key: 'r1', children: [] },
      });

      sim.ui.setActiveModule('second');
      await bridge.callBridge('reconcile', {
        forgeDoc: { type: 'App', props: {}, key: 'r2', children: [] },
      });
      sim.ui.setActiveModule(null);

      // Without key, returns the global latest (last rendered)
      const latest = sim.ui.getForgeDoc();
      expect(latest).not.toBeNull();
      expect(latest!.key).toBe('r2');
    });

    it('onModuleRender fires only for that module', async () => {
      sim.ui.ensureBridge();
      const bridge = (globalThis as any).__bridge;
      const calls: string[] = [];

      sim.ui.onModuleRender('target', (doc) => {
        calls.push(sim.ui.getTextContent(doc));
      });

      // Render a different module — listener should NOT fire
      sim.ui.setActiveModule('other');
      await bridge.callBridge('reconcile', {
        forgeDoc: { type: 'App', props: {}, key: 'r1', children: [
          { type: 'String', props: { text: 'wrong' }, key: 's1', children: [] },
        ]},
      });

      expect(calls).toHaveLength(0);

      // Render the target module — listener SHOULD fire
      sim.ui.setActiveModule('target');
      await bridge.callBridge('reconcile', {
        forgeDoc: { type: 'App', props: {}, key: 'r2', children: [
          { type: 'String', props: { text: 'right' }, key: 's2', children: [] },
        ]},
      });
      sim.ui.setActiveModule(null);

      expect(calls).toEqual(['right']);
    });
  });

  describe('interactWith (high-level)', () => {
    it('finds and interacts in one call', async () => {
      let clicked = false;
      // Set up a ForgeDoc via the bridge
      sim.ui.ensureBridge();

      // Simulate a rendered doc by going through the bridge
      const bridge = (globalThis as any).__bridge;
      await bridge.callBridge('reconcile', {
        forgeDoc: {
          type: 'App', props: {}, key: 'root', children: [
            {
              type: 'Button', props: { onClick: () => { clicked = true; return 'done'; } },
              key: 'b1', children: [
                { type: 'String', props: { text: 'Save' }, key: 's1', children: [] },
              ],
            },
          ],
        },
      });

      const { result, updatedDoc } = await sim.ui.interactWith('Button', { matchText: 'Save' });
      expect(clicked).toBe(true);
      expect(result).toBe('done');
      expect(updatedDoc).not.toBeNull();
    });

    it('interactWith throws when no UI rendered', async () => {
      await expect(sim.ui.interactWith('Button')).rejects.toThrow('No UI rendered');
    });
  });
});
