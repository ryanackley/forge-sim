/**
 * SimulatorUI — first-class UI API on ForgeSimulator.
 *
 * Owns the bridge lifecycle and exposes ForgeDoc operations directly
 * on the simulator instance. No more importing bridge functions separately.
 *
 * Usage:
 *   const sim = createSimulator();
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
  onMacroConfigRender,
  resetAll,
  setForgeContext,
  getForgeContext,
} from './bridge.js';
import { buildForgeContext, type ForgeContext, type RenderContextOptions } from '../context.js';
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
import {
  extractInlineConfigFields,
  validateInlineConfigTree,
  defaultsFromFields,
  type InlineConfigField,
  type InlineConfigHandle,
  type InlineConfigValidation,
} from './inline-config.js';
import type { ForgeSimulator } from '../simulator.js';
// setSimulator is auto-called in the ForgeSimulator constructor.
// We keep this import for the defensive re-wire in ensureBridge().
import { setSimulator } from '../shims/globals.js';
import { onViewEvent, resetViewEvents, type ViewEventType } from '../shims/forge-bridge.js';
import { pathToFileURL } from 'node:url';

export class SimulatorUI {
  private bridgeInstalled = false;

  /** Per-module ForgeDoc storage: moduleKey → ForgeDoc */
  private moduleDocs = new Map<string, ForgeDoc>();

  /**
   * Per-module MacroConfig ForgeDoc storage (from ForgeReconciler.addConfig).
   * Only populated for inline-config macros — the second tree emitted alongside
   * the main view tree.
   */
  private macroConfigDocs = new Map<string, ForgeDoc>();

  /**
   * Per-macro saved config values: moduleKey → name/value map.
   * Survives between renders so a view rendered after an inline config save
   * sees the saved values via context.extension.config / useConfig().
   */
  private macroConfigs = new Map<string, Record<string, unknown>>();

  /** Which module is currently rendering (set before invoke, cleared after) */
  private activeModuleKey: string | null = null;

  /** Last render config per module (for refresh) */
  private moduleRenderConfig = new Map<string, RenderContextOptions>();

  /** Built Forge context per module (what useProductContext returns) */
  private moduleContexts = new Map<string, ForgeContext>();

  /** Cached resource file paths (so we don't re-resolve on refresh) */
  private resolvedResources = new Map<string, string>();

  /** Render listeners scoped per module */
  private moduleListeners = new Map<string, Array<(doc: ForgeDoc) => void>>();

  /** View event listeners: submit/close/refresh */
  private viewEventListeners = new Map<ViewEventType, Array<(moduleKey: string, payload: any) => void>>();

  /** Unbind function for the global view event listener */
  private viewEventUnbind: (() => void) | null = null;

  /** Unbind function for the MacroConfig render listener */
  private macroConfigRenderUnbind: (() => void) | null = null;

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
      // Listen for MacroConfig renders (ForgeReconciler.addConfig).
      // Tag to the same active module key — inline config lives on the
      // flat macro module, not a sub-module.
      this.macroConfigRenderUnbind = onMacroConfigRender((doc) => {
        if (this.activeModuleKey) {
          this.macroConfigDocs.set(this.activeModuleKey, doc);
        }
      });
      // Listen for view.submit()/close()/refresh() from app code
      this.viewEventUnbind = onViewEvent((event, payload) => {
        const moduleKey = this.activeModuleKey ?? '(unknown)';
        const listeners = this.viewEventListeners.get(event);
        if (listeners) {
          for (const fn of listeners) {
            try { fn(moduleKey, payload); } catch {}
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

  /**
   * Get the Forge context for a module (what useProductContext() returns).
   * Returns null if the module hasn't been rendered.
   */
  getContext(moduleKey?: string): ForgeContext | null {
    if (moduleKey) {
      return this.moduleContexts.get(moduleKey) ?? null;
    }
    // Return current bridge context
    return getForgeContext();
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

  // ── View Event Listeners ──────────────────────────────────────────────

  /**
   * Listen for view.submit() calls from app code.
   * Callback receives the module key and the payload passed to submit().
   *
   *   sim.ui.onSubmit((moduleKey, payload) => {
   *     expect(moduleKey).toBe('my-field--edit');
   *     expect(payload).toEqual({ value: 42 });
   *   });
   */
  onSubmit(listener: (moduleKey: string, payload: any) => void): () => void {
    return this.addViewEventListener('submit', listener);
  }

  /**
   * Listen for view.close() calls from app code.
   */
  onClose(listener: (moduleKey: string, payload: any) => void): () => void {
    return this.addViewEventListener('close', listener);
  }

  /**
   * Listen for view.refresh() calls from app code.
   */
  onRefresh(listener: (moduleKey: string, payload: any) => void): () => void {
    return this.addViewEventListener('refresh', listener);
  }

  private addViewEventListener(
    event: ViewEventType,
    listener: (moduleKey: string, payload: any) => void,
  ): () => void {
    if (!this.viewEventListeners.has(event)) {
      this.viewEventListeners.set(event, []);
    }
    this.viewEventListeners.get(event)!.push(listener);
    return () => {
      const arr = this.viewEventListeners.get(event);
      if (arr) {
        const idx = arr.indexOf(listener);
        if (idx >= 0) arr.splice(idx, 1);
      }
    };
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
   *   // Full context object
   *   await sim.ui.render('my-panel', {
   *     context: { issueKey: 'PROJ-1', projectKey: 'PROJ' }
   *   });
   *
   *   // Item key shortcut — hydrates full context via product API
   *   await sim.ui.render('my-panel', { issueKey: 'PROJ-42' });
   *
   *   // Confluence content
   *   await sim.ui.render('my-macro', { contentId: '12345' });
   *
   *   const doc = sim.ui.getForgeDoc('my-panel');
   */
  async render(moduleKey: string, options?: RenderContextOptions): Promise<ForgeDoc | null> {
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

      // Check if this is a Custom UI module (directory with index.html)
      // Custom UI modules use @forge/bridge in the browser, not @forge/react.
      // sim.ui.render() only works with UIKit modules.
      const { statSync, existsSync: existsSyncCheck } = await import('node:fs');
      const { join } = await import('node:path');
      try {
        const stat = statSync(resourcePath);
        if (stat.isDirectory()) {
          const hasIndexHtml = existsSyncCheck(join(resourcePath, 'index.html'));
          throw new Error(
            `UI module "${moduleKey}" is a Custom UI module` +
            `${hasIndexHtml ? ' (has index.html)' : ''} — ` +
            `sim.ui.render() only works with UIKit modules that use @forge/react. ` +
            `Custom UI modules run in an iframe with @forge/bridge and need ` +
            `\`forge-sim dev\` for browser-based rendering.`
          );
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes('Custom UI module')) throw e;
        // stat failed — let it continue and fail naturally
      }

      this.resolvedResources.set(moduleKey, resourcePath);
    }

    this.ensureBridge();
    this.setActiveModule(moduleKey);
    this.moduleRenderConfig.set(moduleKey, options ?? {});

    // Build the full Forge context for this module
    const forgeContext = await buildForgeContext(
      this.sim, moduleKey, uiModule.type, options ?? {},
    );

    // Macro stateful config injection — if a previous renderInlineConfig().save()
    // (or setMacroConfig) stored values for this macro, surface them as
    // extension.config so useConfig() resolves them. Two key shapes:
    //   - Custom config sub-modules:  "<base>--view" / "<base>--config"
    //     → strip the suffix to find the saved key
    //   - Inline config / flat macro:  "<key>"
    if (uiModule.type === 'macro') {
      const baseKey = moduleKey.replace(/--(?:view|config)$/, '');
      const saved = this.macroConfigs.get(baseKey) ?? this.macroConfigs.get(moduleKey);
      if (saved !== undefined) {
        forgeContext.extension = { ...forgeContext.extension, config: saved };
      }
    }

    this.moduleContexts.set(moduleKey, forgeContext);
    setForgeContext(forgeContext);

    // Also apply extension fields as resolver context overrides
    // so resolver handlers get context.issueKey etc.
    if (forgeContext.extension) {
      const { type: _type, ...extensionFields } = forgeContext.extension;
      this.sim.resolver.setContext({
        ...extensionFields,
        accountId: forgeContext.accountId,
        cloudId: forgeContext.cloudId,
        siteUrl: forgeContext.siteUrl,
        moduleKey: forgeContext.moduleKey,
      });
    }

    try {
      // Set up a render listener BEFORE the import, so we don't miss the
      // reconcile if it fires synchronously during evaluation.
      const renderPromise = waitForRender();

      // Import the frontend module — this triggers ForgeReconciler.render()
      // which produces a ForgeDoc via the bridge.
      // Cache-bust so refresh gets a fresh execution.
      const fileUrl = pathToFileURL(resourcePath).href;
      await import(fileUrl + '?t=' + Date.now());

      // If the reconcile hasn't landed yet, wait for it — with a timeout
      // safety net in case React's reconciler bails out on a tree it
      // considers unchanged (e.g. refresh of an identical UI), in which
      // case `reconcile` may never fire and we'd otherwise hang.
      if (!this.moduleDocs.has(moduleKey)) {
        await Promise.race([
          renderPromise,
          new Promise<void>(resolve => setTimeout(resolve, 100)),
        ]);
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

  // ── Inline Macro Config ───────────────────────────────────────────────

  /**
   * Render a macro's inline config tree (`ForgeReconciler.addConfig(<Config />)`)
   * and return a stateful handle that mirrors the platform's Save/Cancel chrome.
   *
   * Inline macro config is platform-managed in real Forge — the user does NOT
   * write a Save button. The platform harvests named form fields when the user
   * clicks its rendered Save, and stores them as a key/value map. This API
   * mirrors that:
   *
   *   const cfg = await sim.ui.renderInlineConfig('cool-macro');
   *   cfg.getFields();              // [{ name: 'age', type: 'TextField', ... }]
   *   await cfg.save({ age: 5 });   // stores values, available to view
   *
   *   await sim.ui.render('cool-macro');
   *   // The macro's view sees `useConfig()` → { age: 5 }
   *
   * The macro's main view tree (`ForgeReconciler.render(<App />)`) is also
   * loaded as a side effect — `sim.ui.getForgeDoc(moduleKey)` returns it.
   *
   * @throws if the module is not a macro, or has no `addConfig()` tree
   */
  async renderInlineConfig(
    moduleKey: string,
    options?: RenderContextOptions,
  ): Promise<InlineConfigHandle> {
    const manifest = this.sim.getManifest();
    if (!manifest) {
      throw new Error('No manifest loaded. Deploy an app first.');
    }
    const uiModule = manifest.uiModules.find(m => m.key === moduleKey);
    if (!uiModule) {
      throw new Error(`No UI module with key "${moduleKey}".`);
    }
    if (uiModule.type !== 'macro') {
      throw new Error(
        `renderInlineConfig() requires a macro module. "${moduleKey}" is "${uiModule.type}".`
      );
    }
    if ((uiModule as any).viewMode !== undefined) {
      // This is a custom-config sub-module ('--view' or '--config'). Inline
      // config is for the flat macro shape (config: true / config: {} without resource).
      throw new Error(
        `"${moduleKey}" is a custom-config sub-module. ` +
        `Inline config requires the flat macro key. ` +
        `For custom-config, render the sub-module directly: ` +
        `sim.ui.render('${moduleKey.replace(/--(?:view|config)$/, '--config')}')`
      );
    }

    // Clear any stale config doc from a prior render — we want this call to
    // wait for a fresh emit, not return a cached one.
    this.macroConfigDocs.delete(moduleKey);

    // Render the macro module — this loads the bundle, which calls both
    // ForgeReconciler.render() AND ForgeReconciler.addConfig() if defined.
    await this.render(moduleKey, options);

    // The MacroConfig render fires asynchronously (addConfig runs after render).
    // Give it a moment to land if it hasn't yet.
    if (!this.macroConfigDocs.has(moduleKey)) {
      const { waitForMacroConfigRender } = await import('./bridge.js');
      await Promise.race([
        waitForMacroConfigRender(),
        new Promise<void>(resolve => setTimeout(resolve, 100)),
      ]);
    }

    const doc = this.macroConfigDocs.get(moduleKey);
    if (!doc) {
      const inline = (uiModule as any).inlineMacroConfig === true;
      throw new Error(
        `Macro "${moduleKey}" did not produce a MacroConfig tree. ` +
        (inline
          ? 'Manifest declares inline config (config: true) but the app did not call ForgeReconciler.addConfig(<Config />).'
          : 'Manifest does not declare inline config — set `config: true` and call ForgeReconciler.addConfig(<Config />) in the bundle.')
      );
    }

    return this.makeInlineConfigHandle(moduleKey, doc);
  }

  /**
   * Get the current MacroConfig ForgeDoc for a macro (the inline config tree).
   * Returns null if the macro hasn't been rendered or doesn't use addConfig().
   */
  getMacroConfigDoc(moduleKey: string): ForgeDoc | null {
    return this.macroConfigDocs.get(moduleKey) ?? null;
  }

  /**
   * Get the saved config values for a macro (whatever the most recent
   * cfg.save() / setMacroConfig() persisted). Returns undefined if nothing
   * has been saved yet.
   */
  getMacroConfig(moduleKey: string): Record<string, unknown> | undefined {
    const baseKey = moduleKey.replace(/--(?:view|config)$/, '');
    return this.macroConfigs.get(baseKey) ?? this.macroConfigs.get(moduleKey);
  }

  /**
   * Fast-path bypass: directly seed the saved config for a macro without
   * exercising the form. Useful for tests that only care about the view's
   * behavior given a specific config.
   *
   *   sim.ui.setMacroConfig('cool-macro', { age: 5 });
   *   await sim.ui.render('cool-macro');
   *   // view sees useConfig() → { age: 5 }
   */
  setMacroConfig(moduleKey: string, values: Record<string, unknown>): void {
    const baseKey = moduleKey.replace(/--(?:view|config)$/, '');
    this.macroConfigs.set(baseKey, { ...values });
  }

  /**
   * Validate a MacroConfig ForgeDoc against the allowed component subset.
   * Returns the violations without throwing — callers decide what to do.
   */
  validateInlineConfigTree(doc: ForgeDoc | null): InlineConfigValidation {
    return validateInlineConfigTree(doc);
  }

  private makeInlineConfigHandle(moduleKey: string, doc: ForgeDoc): InlineConfigHandle {
    const ui = this;
    const baseKey = moduleKey.replace(/--(?:view|config)$/, '');
    return {
      get doc() { return ui.macroConfigDocs.get(moduleKey) ?? doc; },
      moduleKey,
      getFields() {
        return extractInlineConfigFields(ui.macroConfigDocs.get(moduleKey) ?? doc);
      },
      validate() {
        return validateInlineConfigTree(ui.macroConfigDocs.get(moduleKey) ?? doc);
      },
      async save(values?: Record<string, unknown>) {
        const fields = extractInlineConfigFields(ui.macroConfigDocs.get(moduleKey) ?? doc);
        const fieldNames = new Set(fields.map(f => f.name));
        // Start from declared defaults (mimics platform: clicking Save with
        // no edits persists whatever the form currently shows).
        const merged: Record<string, unknown> = defaultsFromFields(fields);
        if (values) {
          for (const [k, v] of Object.entries(values)) {
            if (!fieldNames.has(k)) {
              // Real Forge would drop unknown keys silently. Surface a warn so
              // tests can tell when they're testing something the platform won't
              // actually accept.
              console.warn(
                `[forge-sim] Macro "${moduleKey}": value for "${k}" has no matching ` +
                `<X name="${k}" />. Real Forge ignores unknown keys.`
              );
              continue;
            }
            merged[k] = v;
          }
        }
        ui.macroConfigs.set(baseKey, merged);
      },
      cancel() {
        // No-op for headless: any stored config is preserved (same as the
        // platform Cancel button — it only discards in-progress edits).
      },
    };
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
    return this.render(key, config);
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
    this.macroConfigDocs.clear();
    this.macroConfigs.clear();
    this.moduleRenderConfig.clear();
    this.moduleContexts.clear();
    this.viewEventListeners.clear();
    this.activeModuleKey = null;
  }

  /** Full reset — disconnects simulator too. */
  resetAll(): void {
    resetAll();
    resetViewEvents();
    this.moduleDocs.clear();
    this.macroConfigDocs.clear();
    this.macroConfigs.clear();
    this.moduleRenderConfig.clear();
    this.moduleContexts.clear();
    this.resolvedResources.clear();
    this.moduleListeners.clear();
    this.viewEventListeners.clear();
    if (this.viewEventUnbind) {
      this.viewEventUnbind();
      this.viewEventUnbind = null;
    }
    if (this.macroConfigRenderUnbind) {
      this.macroConfigRenderUnbind();
      this.macroConfigRenderUnbind = null;
    }
    this.activeModuleKey = null;
    this.bridgeInstalled = false;
  }
}
