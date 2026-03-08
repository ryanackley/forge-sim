/**
 * SimulatorUI — first-class UI API on ForgeSimulator.
 *
 * Owns the bridge lifecycle and exposes ForgeDoc operations directly
 * on the simulator instance. No more importing bridge functions separately.
 *
 * Usage:
 *   const sim = new ForgeSimulator();
 *   await sim.deploy('./my-app');
 *   await sim.invoke('getPanel', { issueKey: 'PROJ-1' });
 *   const doc = sim.ui.getForgeDoc();
 *   const btn = sim.ui.findByType(doc, 'Button', 'Edit');
 *   await sim.ui.interact(btn, 'onClick');
 */

import type { ForgeDoc, BridgeCall } from './bridge.js';
import {
  installBridge,
  connectSimulator,
  getLatestForgeDoc,
  waitForRender,
  getBridgeCalls,
  resetBridge,
  onRender,
  resetAll,
} from './bridge.js';
import {
  findByType,
  findFirstByType,
  findByProps,
  findByTypeAndText,
  getTextContent,
  simulateEvent,
  listComponentTypes,
  prettyPrint,
} from './doc-utils.js';
import type { ForgeSimulator } from '../simulator.js';

export class SimulatorUI {
  private bridgeInstalled = false;

  constructor(private sim: ForgeSimulator) {}

  // ── Bridge Lifecycle ──────────────────────────────────────────────────

  /**
   * Install the bridge and connect this simulator.
   * Called automatically by deploy() — you don't need to call this manually
   * unless you're setting up the bridge before deploying.
   */
  ensureBridge(): void {
    if (!this.bridgeInstalled) {
      installBridge();
      this.bridgeInstalled = true;
    }
    connectSimulator(this.sim);
  }

  // ── ForgeDoc Access ───────────────────────────────────────────────────

  /** Get the latest ForgeDoc produced by the reconciler, or null if no UI has rendered. */
  getForgeDoc(): ForgeDoc | null {
    return getLatestForgeDoc();
  }

  /** Wait for the next render (reconcile). Returns the new ForgeDoc. */
  waitForRender(): Promise<ForgeDoc> {
    return waitForRender();
  }

  /**
   * Register a persistent listener that fires on every render.
   * Returns an unbind function.
   */
  onRender(listener: (doc: ForgeDoc) => void): () => void {
    return onRender(listener);
  }

  /** Get all bridge calls made so far (for debugging/assertions). */
  getBridgeCalls(): BridgeCall[] {
    return getBridgeCalls();
  }

  // ── Tree Traversal ────────────────────────────────────────────────────

  /** Find all nodes matching a component type. */
  findByType(doc: ForgeDoc, type: string): ForgeDoc[] {
    return findByType(doc, type);
  }

  /** Find the first node matching a component type, or null. */
  findFirstByType(doc: ForgeDoc, type: string): ForgeDoc | null {
    return findFirstByType(doc, type);
  }

  /** Find nodes whose props match all given key/value pairs. */
  findByProps(doc: ForgeDoc, props: Record<string, any>): ForgeDoc[] {
    return findByProps(doc, props);
  }

  /**
   * Find a component by type and optional text content.
   * Throws if no match found (for clear test assertion errors).
   */
  findByTypeAndText(doc: ForgeDoc, type: string, matchText?: string, nthMatch?: number): ForgeDoc {
    return findByTypeAndText(doc, type, matchText, nthMatch);
  }

  /** Extract all text content from a subtree. */
  getTextContent(doc: ForgeDoc): string {
    return getTextContent(doc);
  }

  /** List all unique component types in a tree. */
  listComponentTypes(doc: ForgeDoc): string[] {
    return listComponentTypes(doc);
  }

  /** Pretty-print a ForgeDoc tree (for debugging/logging). */
  prettyPrint(doc: ForgeDoc): string {
    return prettyPrint(doc);
  }

  // ── Interaction ───────────────────────────────────────────────────────

  /**
   * Simulate an event on a ForgeDoc node.
   * Returns the handler's return value (may be a Promise for async handlers).
   */
  interact(node: ForgeDoc, eventName: string, ...args: any[]): any {
    return simulateEvent(node, eventName, ...args);
  }

  /**
   * High-level: find a component and interact with it in one call.
   * Returns { result, updatedDoc } after the interaction.
   */
  async interactWith(
    componentType: string,
    options?: { matchText?: string; nthMatch?: number; event?: string; args?: any[] }
  ): Promise<{ result: any; updatedDoc: ForgeDoc | null }> {
    const doc = this.getForgeDoc();
    if (!doc) throw new Error('No UI rendered. Deploy and invoke a UI function first.');

    const node = findByTypeAndText(doc, componentType, options?.matchText, options?.nthMatch);
    const eventName = options?.event ?? 'onClick';
    const result = simulateEvent(node, eventName, ...(options?.args ?? []));

    // Await if async
    const finalResult = result instanceof Promise ? await result : result;

    return {
      result: finalResult,
      updatedDoc: this.getForgeDoc(),
    };
  }

  // ── Reset ─────────────────────────────────────────────────────────────

  /** Reset UI state (ForgeDoc, bridge calls, listeners). Does NOT disconnect simulator. */
  reset(): void {
    resetBridge();
  }

  /** Full reset — disconnects simulator too. */
  resetAll(): void {
    resetAll();
    this.bridgeInstalled = false;
  }
}
