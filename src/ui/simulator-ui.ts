/**
 * SimulatorUI — first-class UI API on ForgeSimulator.
 *
 * Owns the bridge lifecycle and exposes ForgeDoc operations directly
 * on the simulator instance. No more importing bridge functions separately.
 *
 * Usage:
 *   const sim = new ForgeSimulator();
 *   await sim.deploy('./my-app');
 *   await sim.ui.render('issue-panel', {
 *     context: { issueKey: 'PROJ-1', projectKey: 'PROJ' }
 *   });
 *   const doc = sim.ui.getForgeDoc('issue-panel');
 *   const btn = sim.ui.findByTypeAndText(doc, 'Button', 'Edit');
 *   sim.ui.interact(btn, 'onClick');
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
import { setSimulator } from '../shims/globals.js';
import { pathToFileURL } from 'node:url';

export class SimulatorUI {
  private bridgeInstalled = false;

  /** Per-module ForgeDoc storage: moduleKey → ForgeDoc */
  private moduleDocs = new Map<string, ForgeDoc>();

  /** Which module is currently rendering (set before invoke, cleared after) */
  private activeModuleKey: string | null = null;

  /** Last render config per module (for refresh) */
  private moduleRenderConfig = new Map<string, { context?: Record<string, unknown> }>();

  /** Cached resource file paths (so we don't re-resolve on refresh) */
  private resolvedResources = new Map<string, string>();

  /** Render listeners scoped per module */
  private moduleListeners = new Map<string, Array<(doc: ForgeDoc) => void>>();

  constructor(private sim: ForgeSimulator) {}

  // ── Bridge Lifecycle ──────────────────────────────────────────────────

  /**
   * Install the bridge and connect this simulator.
   * Called automatically by deploy() — you don't need to call this manually
   * unless you're setting up the bridge before deploying.
   */
  ensureBridge(): void {
    // Make sure shims can access the simulator (for @forge/kvs, @forge/api, etc.)
    setSimulator(this.sim as any);

    if (!this.bridgeInstalled) {
      installBridge();
      // Listen to every render and tag it with the active module key
      onRender((doc) => {
        if (this.activeModuleKey) {
          this.moduleDocs.set(this.activeModuleKey, doc);
          // Fire module-scoped listeners
          const listeners = this.moduleListeners.get(this.activeModuleKey);
          if (listeners) {
            for (const fn of listeners) {
              try { fn(doc); } catch {}
            }
          }
        }
      });
      this.bridgeInstalled = true;
    }
    connectSimulator(this.sim);
  }

  /**
   * Set the active module key (called before invoke so the reconcile
   * output gets tagged to the right module). Internal use.
   * @internal
   */
  setActiveModule(moduleKey: string | null): void {
    this.activeModuleKey = moduleKey;
  }

  // ── ForgeDoc Access ───────────────────────────────────────────────────

  /**
   * Get the ForgeDoc for a specific module, or the most recently rendered doc.
   *
   * @param moduleKey — UI module key from manifest (e.g. 'issue-panel').
   *   If omitted, returns the most recently rendered ForgeDoc (any module).
   */
  getForgeDoc(moduleKey?: string): ForgeDoc | null {
    if (moduleKey) {
      return this.moduleDocs.get(moduleKey) ?? null;
    }
    // No key specified — return the global latest (backward compat)
    return getLatestForgeDoc();
  }

  /** Get all rendered module keys. */
  getRenderedModules(): string[] {
    return [...this.moduleDocs.keys()];
  }

  /** Wait for the next render (reconcile) from any module. Returns the new ForgeDoc. */
  waitForRender(): Promise<ForgeDoc> {
    return waitForRender();
  }

  /**
   * Register a persistent listener that fires on every render (any module).
   * Returns an unbind function.
   */
  onRender(listener: (doc: ForgeDoc) => void): () => void {
    return onRender(listener);
  }

  /**
   * Register a listener scoped to a specific module.
   * Returns an unbind function.
   */
  onModuleRender(moduleKey: string, listener: (doc: ForgeDoc) => void): () => void {
    if (!this.moduleListeners.has(moduleKey)) {
      this.moduleListeners.set(moduleKey, []);
    }
    this.moduleListeners.get(moduleKey)!.push(listener);
    return () => {
      const arr = this.moduleListeners.get(moduleKey);
      if (arr) {
        const idx = arr.indexOf(listener);
        if (idx >= 0) arr.splice(idx, 1);
      }
    };
  }

  /**
   * Wait until a module's ForgeDoc contains the expected text.
   * Useful for async frontends that show "Loading..." then fetch data.
   *
   *   await sim.ui.render('issue-panel', { context: { issueKey: 'PROJ-1' } });
   *   const doc = await sim.ui.waitForContent('issue-panel', 'PROJ-1');
   */
  async waitForContent(moduleKey: string, text: string, timeoutMs = 5000): Promise<ForgeDoc> {
    const start = Date.now();

    // Check if already there
    const current = this.getForgeDoc(moduleKey);
    if (current && getTextContent(current).includes(text)) {
      return current;
    }

    // Wait for renders until content appears or timeout
    return new Promise<ForgeDoc>((resolve, reject) => {
      const unbind = this.onModuleRender(moduleKey, (doc) => {
        if (getTextContent(doc).includes(text)) {
          unbind();
          resolve(doc);
        }
      });

      // Also listen globally in case module key tagging missed it
      const unbindGlobal = onRender((doc) => {
        if (getTextContent(doc).includes(text)) {
          unbindGlobal();
          unbind();
          resolve(doc);
        }
      });

      setTimeout(() => {
        unbind();
        unbindGlobal();
        const currentText = this.getForgeDoc(moduleKey)
          ? getTextContent(this.getForgeDoc(moduleKey)!)
          : '(no doc)';
        reject(new Error(
          `Timed out waiting for "${text}" in module "${moduleKey}" after ${timeoutMs}ms. ` +
          `Current content: "${currentText}"`
        ));
      }, timeoutMs);
    });
  }

  /** Get all bridge calls made so far (for debugging/assertions). */
  getBridgeCalls(): BridgeCall[] {
    return getBridgeCalls();
  }

  // ── Module Rendering ───────────────────────────────────────────────────

  /**
   * Render a UI module by its manifest key.
   *
   * Loads the module's frontend resource (the file that calls
   * ForgeReconciler.render()), which triggers React reconciliation
   * and produces a ForgeDoc. The frontend's invoke() calls are routed
   * to the module's resolver via the bridge.
   *
   *   await sim.ui.render('my-issues-panel', {
   *     context: { issueKey: 'PROJ-1', projectKey: 'PROJ' }
   *   });
   *   const doc = sim.ui.getForgeDoc('my-issues-panel');
   */
  async render(moduleKey: string, options?: { context?: Record<string, unknown> }): Promise<ForgeDoc | null> {
    const manifest = this.sim.getManifest();
    if (!manifest) {
      throw new Error('No manifest loaded. Deploy an app first.');
    }

    const appDir = this.sim.getAppDir();
    if (!appDir) {
      throw new Error('No app directory set. Deploy an app first.');
    }

    const uiModule = manifest.uiModules.find(m => m.key === moduleKey);
    if (!uiModule) {
      const available = manifest.uiModules.map(m => m.key).join(', ');
      throw new Error(`No UI module with key "${moduleKey}". Available: ${available || 'none'}`);
    }

    if (!uiModule.resourceKey) {
      throw new Error(`UI module "${moduleKey}" has no resource defined in the manifest.`);
    }

    const resource = manifest.resources.get(uiModule.resourceKey);
    if (!resource) {
      throw new Error(
        `UI module "${moduleKey}" references resource "${uiModule.resourceKey}" ` +
        `but it's not defined in manifest resources.`
      );
    }

    // Resolve the resource file path (cache it for refresh)
    let resourcePath = this.resolvedResources.get(moduleKey);
    if (!resourcePath) {
      const { resolveResourceFile } = await import('../deployer.js');
      resourcePath = await resolveResourceFile(appDir, resource.path) ?? undefined;
      if (!resourcePath) {
        throw new Error(`Resource file not found: "${resource.path}" (resolved from ${appDir})`);
      }
      this.resolvedResources.set(moduleKey, resourcePath);
    }

    this.ensureBridge();
    this.setActiveModule(moduleKey);
    this.moduleRenderConfig.set(moduleKey, { context: options?.context });

    // Apply module-scoped context for this render
    if (options?.context) {
      this.sim.resolver.setContext(options.context);
    }

    try {
      // Import the frontend module — this triggers ForgeReconciler.render()
      // which produces a ForgeDoc via the bridge.
      // Cache-bust so refresh gets a fresh execution.
      const fileUrl = pathToFileURL(resourcePath).href;
      await import(fileUrl + '?t=' + Date.now());

      // Give the reconciler a tick to produce the ForgeDoc
      // (ForgeReconciler.render() is synchronous in our shim, but
      // React effects/state updates may need a microtask)
      if (!this.moduleDocs.has(moduleKey)) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    } finally {
      // NOTE: We intentionally leave both activeModuleKey AND context set.
      // React effects (useEffect) fire async invoke() calls that trigger
      // re-renders AFTER this function returns. Those calls need:
      //   1. activeModuleKey — to tag the ForgeDoc to the right module
      //   2. context — so the resolver receives the correct context
      // Both are overwritten on the next render() call, or cleared on reset().
    }

    return this.getForgeDoc(moduleKey);
  }

  /**
   * Refresh a UI module — clears its ForgeDoc and re-renders.
   * Like a tab refresh in the browser: unmount + remount from scratch.
   *
   * If no module key given and only one module is rendered, refreshes that one.
   */
  async refresh(moduleKey?: string): Promise<ForgeDoc | null> {
    const key = moduleKey ?? this.resolveOnlyModule();
    const config = this.moduleRenderConfig.get(key);
    this.moduleDocs.delete(key);
    return this.render(key, { context: config?.context });
  }

  /** Resolve module key when there's exactly one rendered module. */
  private resolveOnlyModule(): string {
    if (this.moduleDocs.size === 1) {
      return this.moduleDocs.keys().next().value!;
    }
    if (this.moduleDocs.size === 0) {
      throw new Error('No modules rendered. Call render(moduleKey) first.');
    }
    const keys = [...this.moduleDocs.keys()].join(', ');
    throw new Error(`Multiple modules rendered (${keys}). Specify which one to refresh.`);
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

  /** Reset UI state (ForgeDoc, bridge calls, module docs). Does NOT disconnect simulator. */
  reset(): void {
    resetBridge();
    this.moduleDocs.clear();
    this.moduleRenderConfig.clear();
    this.activeModuleKey = null;
  }

  /** Full reset — disconnects simulator too. */
  resetAll(): void {
    resetAll();
    this.moduleDocs.clear();
    this.moduleRenderConfig.clear();
    this.resolvedResources.clear();
    this.moduleListeners.clear();
    this.activeModuleKey = null;
    this.bridgeInstalled = false;
  }
}
