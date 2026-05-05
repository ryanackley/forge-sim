/**
 * Bridge-shim routing tests for macro inline config.
 *
 * The Forge reconciler emits two ForgeDoc trees when a macro uses inline config:
 *   - { type: 'Root', ... }         from ForgeReconciler.render(<App />)
 *   - { type: 'MacroConfig', ... }  from ForgeReconciler.addConfig(<Config />)
 *
 * forge-sim must route them to separate listeners so the shell can render
 * both and toggle between them via tabs.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  onReconcile,
  onMacroConfigReconcile,
  setActiveSubmitTree,
} from '../bridge/forge-bridge-shim';

const G = globalThis as any;

function callBridge(cmd: string, data: any) {
  return G.__bridge.callBridge(cmd, data);
}

/** Reset the in-place state the shim keeps on globalThis between tests so
 * each test starts from a clean slate without re-importing the shim. */
function resetShimState() {
  if (!G.__forgeSim) return;
  G.__forgeSim.reconcileListeners.length = 0;
  G.__forgeSim.macroConfigReconcileListeners.length = 0;
  G.__forgeSim.lastForgeDoc = null;
  G.__forgeSim.lastMacroConfigDoc = null;
  G.__forgeSim.activeSubmitTree = 'view';
}

describe('bridge shim — MacroConfig reconcile routing', () => {
  beforeEach(() => {
    resetShimState();
  });

  it('routes Root forgeDocs to onReconcile, MacroConfig to onMacroConfigReconcile', () => {
    const viewDocs: any[] = [];
    const configDocs: any[] = [];

    onReconcile((d: any) => viewDocs.push(d));
    onMacroConfigReconcile((d: any) => configDocs.push(d));

    callBridge('reconcile', { forgeDoc: { type: 'Root', props: {}, children: [], key: 'r1' } });
    callBridge('reconcile', { forgeDoc: { type: 'MacroConfig', props: {}, children: [], key: 'c1' } });

    expect(viewDocs).toHaveLength(1);
    expect(viewDocs[0].type).toBe('Root');
    expect(configDocs).toHaveLength(1);
    expect(configDocs[0].type).toBe('MacroConfig');
  });

  it('replays the last MacroConfig doc to a late-arriving listener', () => {
    callBridge('reconcile', { forgeDoc: { type: 'MacroConfig', props: { ver: 1 }, children: [], key: 'c1' } });

    const seen: any[] = [];
    onMacroConfigReconcile((d: any) => seen.push(d));

    expect(seen).toHaveLength(1);
    expect(seen[0].props.ver).toBe(1);
  });

  it('replays the last Root doc independently of MacroConfig', () => {
    callBridge('reconcile', { forgeDoc: { type: 'Root', props: { ver: 7 }, children: [], key: 'r1' } });

    const viewSeen: any[] = [];
    const configSeen: any[] = [];
    onReconcile((d: any) => viewSeen.push(d));
    onMacroConfigReconcile((d: any) => configSeen.push(d));

    expect(viewSeen).toHaveLength(1);
    expect(viewSeen[0].props.ver).toBe(7);
    // Config listener should NOT have received the Root replay
    expect(configSeen).toHaveLength(0);
  });

  it('does not cross-contaminate listeners', () => {
    const viewDocs: any[] = [];
    const configDocs: any[] = [];
    onReconcile((d: any) => viewDocs.push(d));
    onMacroConfigReconcile((d: any) => configDocs.push(d));

    callBridge('reconcile', { forgeDoc: { type: 'Root', props: { v: 1 }, children: [], key: 'r1' } });
    callBridge('reconcile', { forgeDoc: { type: 'MacroConfig', props: { v: 1 }, children: [], key: 'c1' } });
    callBridge('reconcile', { forgeDoc: { type: 'Root', props: { v: 2 }, children: [], key: 'r2' } });
    callBridge('reconcile', { forgeDoc: { type: 'MacroConfig', props: { v: 2 }, children: [], key: 'c2' } });

    expect(viewDocs.map((d) => d.props.v)).toEqual([1, 2]);
    expect(configDocs.map((d) => d.props.v)).toEqual([1, 2]);
  });

  it('setActiveSubmitTree controls the submitTree tag on the next view.submit()', () => {
    expect(G.__forgeSim.activeSubmitTree).toBe('view');

    setActiveSubmitTree('macroConfig');
    expect(G.__forgeSim.activeSubmitTree).toBe('macroConfig');

    setActiveSubmitTree('view');
    expect(G.__forgeSim.activeSubmitTree).toBe('view');
  });
});
