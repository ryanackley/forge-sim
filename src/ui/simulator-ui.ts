/**
 * SimulatorUI — first-class UI API on ForgeSimulator.
 *
 * Owns the bridge lifecycle and exposes ForgeDoc operations directly
 * on the simulator instance. No more importing bridge functions separately.
 *
 * Usage:
 *   const sim = createSimulator();
 *   await sim.deploy('./my-app');
 *   await sim.ui.render('issue-panel', { issueKey: 'PROJ-1' });
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
  setActiveCaptureModule,
  replayCapturedRender,
  moduleUsesConfig,
  consumeRenderError,
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

/**
 * Heuristic: is this arg likely a user-supplied data object rather than a
 * synthetic event? Used by `interact` to catch the P10 antipattern of calling
 * `interact(form, 'onSubmit', { name: 'Pat' })` (passing data where the real
 * Forge platform passes a SyntheticEvent).
 *
 * An event-like object has `preventDefault` (a function) — every SyntheticEvent
 * does. A plain data object doesn't. We deliberately don't check for `target`
 * because some test patterns synthesize partial events with target only.
 */
function isProbablyDataObject(arg: unknown): boolean {
  if (typeof arg !== 'object' || arg === null) return false;
  // Real synthetic events / our minimal stubs always have preventDefault.
  if (typeof (arg as { preventDefault?: unknown }).preventDefault === 'function') {
    return false;
  }
  // Has `target` (event-shaped) — treat as event, not data.
  if ('target' in arg) return false;
  // Otherwise, it's a plain object — almost certainly data.
  return true;
}

/** Shape of an option an @forge/react Select accepts / fires onChange with. */
type AKOption = { label: string; value: unknown };

/**
 * Collect the options available on a Select node. Real Forge `<Select>` accepts
 * either an `options={[{label, value}]}` prop or `<Option label value/>` children.
 * Either form should be reachable from `fillField`'s value lookup.
 */
function collectSelectOptions(selectNode: ForgeDoc): AKOption[] {
  const out: AKOption[] = [];
  const optionsProp = selectNode.props.options;
  if (Array.isArray(optionsProp)) {
    for (const opt of optionsProp) {
      if (opt && typeof opt === 'object' && 'value' in opt) {
        out.push({
          label: typeof (opt as { label?: unknown }).label === 'string'
            ? String((opt as { label: string }).label)
            : String((opt as { value: unknown }).value),
          value: (opt as { value: unknown }).value,
        });
      }
    }
  }
  for (const child of selectNode.children ?? []) {
    if (child.type === 'Option' && child.props && 'value' in child.props) {
      out.push({
        label: typeof child.props.label === 'string'
          ? String(child.props.label)
          : String(child.props.value),
        value: child.props.value,
      });
    }
  }
  return out;
}

/**
 * Resolve the caller's `fillField` value into the exact shape Select's
 * onChange receives in real Forge: `AKOption` (single) or `AKOption[]` (multi).
 *
 * Caller can pass:
 *   - a raw value (string, number, ...) — looked up in `options`
 *   - a partial option `{value}` — label filled in from `options`
 *   - a full option `{value, label}` — passed through (label kept as given)
 *   - `null` (single) or `[]` (multi) — clears the selection
 *
 * For isMulti: caller passes an array of any of the above shapes; we resolve
 * each. For single: caller passes one value.
 *
 * Throws with a clear "value not in options" error listing available values.
 */
function resolveSelectValue(
  value: unknown,
  options: AKOption[],
  fieldName: string,
  isMulti: boolean
): AKOption | AKOption[] | null {
  if (isMulti) {
    if (value === null || value === undefined) return [];
    if (!Array.isArray(value)) {
      throw new Error(
        `Select[name="${fieldName}"] is isMulti — fillField expects an array, got ${typeof value}.`
      );
    }
    return value.map((v) => resolveSingleSelectValue(v, options, fieldName));
  }
  if (value === null || value === undefined) return null;
  return resolveSingleSelectValue(value, options, fieldName);
}

function resolveSingleSelectValue(
  value: unknown,
  options: AKOption[],
  fieldName: string
): AKOption {
  // If caller passed a fully-formed option object, use it verbatim — they
  // know what they want. Lets devs test with custom labels or values that
  // aren't in `options` (e.g. async-loaded options).
  if (value && typeof value === 'object' && 'value' in value && 'label' in value) {
    return {
      label: String((value as { label: unknown }).label),
      value: (value as { value: unknown }).value,
    };
  }
  // Partial option {value} — fill in label from the lookup.
  if (value && typeof value === 'object' && 'value' in value) {
    const raw = (value as { value: unknown }).value;
    const match = options.find((o) => o.value === raw);
    if (match) return match;
    throw selectOptionNotFound(raw, options, fieldName);
  }
  // Raw value — look up the matching option.
  const match = options.find((o) => o.value === value);
  if (match) return match;
  throw selectOptionNotFound(value, options, fieldName);
}

function selectOptionNotFound(value: unknown, options: AKOption[], fieldName: string): Error {
  const available = options.length === 0
    ? '(no options declared on this Select)'
    : options.map((o) => `${JSON.stringify(o.value)} (${o.label})`).join(', ');
  return new Error(
    `Select[name="${fieldName}"] has no option with value=${JSON.stringify(value)}. ` +
    `Available: ${available}. ` +
    `Pass a fully-formed { value, label } if you need an option not in the declared list.`
  );
}

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
   *   await sim.ui.render('issue-panel', { issueKey: 'PROJ-1' });
   *   const doc = await sim.ui.waitForContent('issue-panel', 'PROJ-1');
   *
   * If the module has never been rendered, this method auto-renders it once
   * with default options before waiting. This is a convenience for the common
   * "set state, then assert" pattern:
   *
   *   sim.ui.setMacroConfig('pet-card', { name: 'Rex' });
   *   const doc = await sim.ui.waitForContent('pet-card', 'Rex');  // ← no manual render needed
   *
   * Once a module has been rendered (by you or by auto-render), waitForContent
   * becomes pure observation — it will NOT re-render, so it's safe to use for
   * waiting on async state changes (useEffect, in-flight invokes, etc.).
   *
   * If you need non-default render options (e.g. context overrides), call
   * sim.ui.render() explicitly first.
   *
   * **Text matching scope (convenience method, not exhaustive).** Uses
   * `getTextContent`, which walks `<String>` child nodes plus a curated list
   * of visible-text props (Tag.text, FormHeader.title, EmptyState.header,
   * etc. — see `VISIBLE_TEXT_PROPS` in doc-utils.ts). For composite/nested
   * data (Select option labels, Comment.author objects, DynamicTable cells)
   * drop down to `sim.ui.findByType(doc, ...)` and assert on the props
   * directly:
   *
   *   const select = sim.ui.findFirstByType(doc, 'Select')!;
   *   expect(select.props.options.map(o => o.label)).toContain('Bug');
   */
  async waitForContent(moduleKey: string, text: string, timeoutMs = 5000): Promise<ForgeDoc> {
    // Auto-render if this module has never been rendered. Idempotent: once
    // a doc exists in moduleDocs, repeat calls skip this branch entirely.
    if (!this.moduleDocs.has(moduleKey)) {
      await this.render(moduleKey);
    }

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
        const doc = this.getForgeDoc(moduleKey);
        const currentText = doc ? getTextContent(doc) : '(no doc)';

        // Build a helpful hint when we can detect a likely cause.
        const hints: string[] = [];

        // Hint 1: macro module with no saved config — likely missed setMacroConfig.
        // Gated on (a) the bundle actually calling useConfig(), so we don't
        // fire on macros that don't depend on inline config (N10), and
        // (b) the doc rendering at all, since if useConfig was never called
        // we can't make any claim about config dependence.
        try {
          const manifest = this.sim.getManifest();
          const uiModule = manifest?.uiModules.find(m => m.key === moduleKey);
          if (uiModule?.type === 'macro' && moduleUsesConfig(moduleKey)) {
            const baseKey = moduleKey.replace(/--(?:view|config)$/, '');
            const savedConfig = this.macroConfigs.get(baseKey);
            if (!savedConfig || Object.keys(savedConfig).length === 0) {
              hints.push(
                `Module "${moduleKey}" calls useConfig() but no config has been seeded. ` +
                `Did you forget sim.ui.setMacroConfig("${baseKey}", {...}) before render()? ` +
                `useConfig() returns {} until setMacroConfig is called.`
              );
            }
          }
        } catch {
          // Best-effort hint — never let hint logic itself fail the test.
        }

        // Hint 2: doc exists but text is missing — guide toward debug output
        // and the escape-hatch path for composite/nested-data text that the
        // VISIBLE_TEXT_PROPS allowlist doesn't cover (Select.options[].label,
        // Comment.author.text-as-object, DynamicTable cells, etc.)
        if (doc && !hints.length) {
          hints.push(
            `The module rendered, but its text content does not include "${text}". ` +
            `Inspect the tree with sim.ui.getForgeDoc("${moduleKey}") to see what's ` +
            `there. waitForContent is a convenience method — it walks <String> nodes ` +
            `and a curated set of visible-text props (Tag.text, FormHeader.title, etc.). ` +
            `For composite props (Select.options[].label, Comment.author.text), use ` +
            `sim.ui.findByType(doc, "Select") and assert on .props.options directly.`
          );
        }

        const hintBlock = hints.length ? `\n\nHint: ${hints.join('\n      ')}` : '';
        reject(new Error(
          `Timed out waiting for "${text}" in module "${moduleKey}" after ${timeoutMs}ms.\n` +
          `Current content: "${currentText}"${hintBlock}`
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
   *   // Item key shortcut — hydrates full context via product API
   *   await sim.ui.render('my-panel', { issueKey: 'PROJ-42' });
   *
   *   // Confluence content
   *   await sim.ui.render('my-macro', { contentId: '12345' });
   *
   *   // Raw context-field overrides (accountId, locale, …) — merged, with
   *   // canonical fields promoted to the top level. See docs/reference/module-contexts.md.
   *   await sim.ui.render('my-panel', { issueKey: 'PROJ-1', context: { accountId: 'user-9' } });
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
    // Tell the shim's wrapped ForgeReconciler which module to attribute the
    // captured render/addConfig elements to. This drives the replay path
    // below when the bundle is cached by the test runner's module loader.
    setActiveCaptureModule(moduleKey);
    // Stash options so `refresh()` can replay them — but strip `macroConfig`,
    // which is a one-shot per-render override and would defeat its own
    // semantics if it persisted into refresh.
    const { macroConfig: _oneShotMacroConfig, ...persistedOptions } = options ?? {};
    this.moduleRenderConfig.set(moduleKey, persistedOptions);

    // When the caller passes `macroConfig` as a per-render override, force a
    // fresh render — the bundle's React tree was built against the previous
    // forgeContext.config and won't re-read it without invalidation. Without
    // this, vitest's path-based bundle cache turns the second render into a
    // silent no-op and the new macroConfig appears to "not take" (F3 from
    // skill run #8).
    if (options?.macroConfig !== undefined) {
      this.moduleDocs.delete(moduleKey);
    }

    // Build the full Forge context for this module
    const forgeContext = await buildForgeContext(
      this.sim, moduleKey, uiModule.type, options ?? {},
    );

    // Macro config injection — three sources, in priority order:
    //   1. `options.macroConfig` (this render only — one-shot override; F3 from run #8)
    //   2. A previous `renderInlineConfig().save(values)` for the same key
    //   3. A previous `sim.ui.setMacroConfig(key, values)` call
    //
    // Key shapes:
    //   - Custom config sub-modules:  "<base>--view" / "<base>--config"
    //     → strip the suffix to find the saved key
    //   - Inline config / flat macro:  "<key>"
    if (uiModule.type === 'macro') {
      const baseKey = moduleKey.replace(/--(?:view|config)$/, '');
      const oneShot = options?.macroConfig;
      const saved = this.macroConfigs.get(baseKey) ?? this.macroConfigs.get(moduleKey);
      const effective = oneShot ?? saved;
      if (effective !== undefined) {
        forgeContext.extension = { ...forgeContext.extension, config: effective };
      }
    }

    this.moduleContexts.set(moduleKey, forgeContext);
    setForgeContext(forgeContext);

    // Apply the render's view as a per-render resolver context overlay
    // — sits between user-set sticky `setContext()` and per-call invoke
    // overrides in the merge order. Resolvers invoked by the rendered UI
    // (during render and from React effects spawned by it) see this view;
    // resolvers invoked outside any render see only the user's sticky.
    //
    // Crucially this does NOT mutate sticky `contextOverrides`, so a user
    // who set `setContext({ accountId: 'alice' })` before calling render
    // still has 'alice' after the render. Parallel to
    // `sim.invoke('fn', payload, { context })`, which is also one-shot
    // non-mutating. Replaced (not merged) by the next render() call,
    // cleared by `sim.reset()`.
    if (forgeContext.extension) {
      const { type: _type, ...extensionFields } = forgeContext.extension;
      this.sim.resolver.setRenderContext({
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
      //
      // The waiter can REJECT (UIK-003 raw HTML hard fail). It isn't always
      // awaited (cached-bundle paths skip the race below), so capture the
      // error instead of letting an unhandled rejection escape — the
      // consumeRenderError() check after the import turns it into a throw.
      let renderError: Error | null = null;
      const renderPromise = waitForRender().catch((e: Error) => {
        renderError = e;
        return null as unknown as ForgeDoc;
      });

      // Import the frontend module — this triggers ForgeReconciler.render()
      // which produces a ForgeDoc via the bridge.
      // Cache-bust so refresh gets a fresh execution.
      const fileUrl = pathToFileURL(resourcePath).href;
      await import(fileUrl + '?t=' + Date.now());

      // If the reconcile hasn't landed yet, wait for it — with a timeout
      // safety net in case React's reconciler bails out on a tree it
      // considers unchanged (e.g. refresh of an identical UI), in which
      // case `reconcile` may never fire and we'd otherwise hang.
      //
      // Vitest workaround (N9): vitest's vite-node loader caches bundles
      // by file path and ignores `?t=` query strings, so the cache-bust
      // is a no-op. On 2nd+ renders the bundle's top-level
      // ForgeReconciler.render(<App />) call doesn't re-run, no reconcile
      // pulse fires, and we'd hang forever (or fail at the 100ms race
      // and leave moduleDocs[key] null). The shim wraps render/addConfig
      // and captures the React elements; we replay them here against a
      // fresh container to produce a brand-new reconcile pulse equivalent
      // to a real bundle re-evaluation.
      if (!this.moduleDocs.has(moduleKey)) {
        const replayed = await replayCapturedRender(moduleKey);
        await Promise.race([
          renderPromise,
          new Promise<void>(resolve => setTimeout(resolve, replayed ? 200 : 100)),
        ]);
      }

      // UIK-003 hard fail: if the reconcile was rejected (raw HTML host
      // elements), surface it as a throw from render() — the doc was never
      // published, so returning null here would just be a confusing hang
      // for the caller. Covers both the awaited-waiter path (renderError)
      // and paths where the waiter wasn't racing (consumeRenderError).
      const rawHtmlError = renderError ?? consumeRenderError();
      if (rawHtmlError) {
        throw rawHtmlError;
      }
    } finally {
      // Stop attributing further render() captures to this module — protects
      // against unrelated ForgeReconciler.render calls (background scripts,
      // multi-module apps) from clobbering the captured element.
      setActiveCaptureModule(null);
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
      // The waiter can reject (UIK-003 raw HTML). If the timeout wins the
      // race first, a later rejection must not escape as an unhandled
      // rejection — capture it and rethrow synchronously when raced.
      let configRenderError: Error | null = null;
      await Promise.race([
        waitForMacroConfigRender().catch((e: Error) => { configRenderError = e; }),
        new Promise<void>(resolve => setTimeout(resolve, 100)),
      ]);
      if (configRenderError) throw configRenderError;
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
   *
   * For form fields with onChange, this auto-injects `target.type` and
   * `target.name` if you pass an event-shaped first arg without them — that's
   * what makes useForm + register() work in headless mode. See
   * `simulateEvent` in doc-utils.ts for the gory details.
   */
  interact(node: ForgeDoc, eventName: string, ...args: any[]): any {
    // P10 guard: catch the "passed data as the event" antipattern on Form.onSubmit.
    // Real Forge Form.onSubmit receives a synthetic event from the platform —
    // user data is provided by react-hook-form's handleSubmit wrapper. If a test
    // passes a data object directly, RHF treats it as the event and the user's
    // submit handler never runs (silent failure that's hard to debug).
    if (
      eventName === 'onSubmit' &&
      node.type === 'Form' &&
      args.length > 0 &&
      isProbablyDataObject(args[0])
    ) {
      throw new Error(
        `sim.ui.interact(form, 'onSubmit', data) — Form.onSubmit expects a synthetic event, not a data object.\n` +
        `\n` +
        `  • To submit with values:  await sim.ui.submitForm('${this.activeModuleKey ?? '<moduleKey>'}', { /* values */ })\n` +
        `  • To submit current state: await sim.ui.submitForm('${this.activeModuleKey ?? '<moduleKey>'}')\n` +
        `\n` +
        `Both helpers also fire the right preventDefault/stopPropagation that handleSubmit needs.`
      );
    }
    return simulateEvent(node, eventName, ...args);
  }

  /**
   * Find a form field by its `name` prop and fire onChange with the right
   * shape for the field's component type.
   *
   *   await sim.ui.fillField('macro', 'name', 'Pat');
   *   await sim.ui.fillField('macro', 'age', 5);
   *   await sim.ui.fillField('macro', 'role', 'admin');           // Select: raw value
   *   await sim.ui.fillField('macro', 'role', { value: 'admin' }); // Select: partial option
   *   await sim.ui.fillField('macro', 'tags', ['a', 'b']);         // Select isMulti
   *
   * Most fields receive a synthetic-event-shaped onChange (Textfield, TextArea,
   * Checkbox, Toggle, etc.) — the target.type/name injection in `simulateEvent`
   * makes useForm + register() work as expected.
   *
   * Select is a special case: real Forge <Select> is backed by react-select,
   * which fires `onChange(option)` with `AKOption | AKOption[]` — NOT an event.
   * For Select, fillField looks up the matching option from the Select's
   * `options` prop (or `Option` children) and fires onChange with that option
   * object, matching production behavior. (F2)
   *
   * Searches Textfield, TextArea, Checkbox, Toggle, Select, RadioGroup,
   * DatePicker, TimePicker, UserPicker, Range, CheckboxGroup. Throws if
   * no field with that name is found.
   */
  fillField(moduleKey: string, name: string, value: unknown): void {
    const doc = this.getForgeDoc(moduleKey);
    if (!doc) {
      throw new Error(
        `No rendered ForgeDoc for module "${moduleKey}". ` +
        `Call await sim.ui.render("${moduleKey}") first.`
      );
    }

    // Walk the tree looking for a form field with matching name.
    const FIELD_TYPES = new Set([
      'Textfield', 'TextArea', 'Checkbox', 'CheckboxGroup', 'Radio', 'RadioGroup',
      'Toggle', 'Select', 'DatePicker', 'TimePicker', 'UserPicker', 'Range',
    ]);
    let field: ForgeDoc | null = null;
    function walk(node: ForgeDoc): void {
      if (field) return;
      if (FIELD_TYPES.has(node.type) && node.props.name === name) {
        field = node;
        return;
      }
      for (const child of node.children ?? []) walk(child);
    }
    walk(doc);

    if (!field) {
      const allNamedFields: string[] = [];
      function collect(node: ForgeDoc): void {
        if (FIELD_TYPES.has(node.type) && typeof node.props.name === 'string') {
          allNamedFields.push(`${node.type}[name="${node.props.name}"]`);
        }
        for (const child of node.children ?? []) collect(child);
      }
      collect(doc);
      throw new Error(
        `No form field with name="${name}" in module "${moduleKey}". ` +
        `Available fields: ${allNamedFields.join(', ') || '(none)'}`
      );
    }

    const fieldNode = field as ForgeDoc;

    // ── Select: option-object firing (F2) ────────────────────────────────
    // Real Forge Select is react-select, which calls onChange(option) — NOT
    // an event. Look up the option from `options` prop or `Option` children
    // and fire that exact shape so RHF stores the same value sim and prod.
    if (fieldNode.type === 'Select') {
      const options = collectSelectOptions(fieldNode);
      const isMulti = fieldNode.props.isMulti === true;
      const selected = resolveSelectValue(value, options, name, isMulti);
      simulateEvent(fieldNode, 'onChange', selected);
      return;
    }

    // Build the synthetic event. simulateEvent will inject target.type/name
    // if missing — but for Checkbox/Toggle we also need `checked` to mirror
    // the native event shape. Best-effort: include both for booleans.
    const isCheckable = fieldNode.type === 'Checkbox' || fieldNode.type === 'Toggle';
    const target: Record<string, unknown> = { value, name };
    if (isCheckable && typeof value === 'boolean') {
      target.checked = value;
    }
    simulateEvent(fieldNode, 'onChange', { target });
  }

  /**
   * Find a Form node and fire its onSubmit with a minimal synthetic event
   * (preventDefault + stopPropagation), which is what react-hook-form's
   * handleSubmit() wrapper needs to suppress the platform's default.
   *
   * If `values` is provided, fills each field via `fillField` first — then
   * submits. Fields not in `values` keep their current state (defaults from
   * useForm({defaultValues}) or whatever previous fillField calls set).
   *
   *   await sim.ui.submitForm('macro');                       // submit current state
   *   await sim.ui.submitForm('macro', { name: 'Pat', age: 5 });  // fill + submit
   *
   * Returns whatever the form's onSubmit returns (often a Promise).
   *
   * If validation blocks the submit (required fields missing, etc.),
   * react-hook-form's handleSubmit returns without calling the user's
   * handler — same as production. Inspect the rendered tree afterward to
   * see validation error messages.
   */
  async submitForm(moduleKey: string, values?: Record<string, unknown>): Promise<unknown> {
    if (values) {
      for (const [name, value] of Object.entries(values)) {
        this.fillField(moduleKey, name, value);
      }
      // Let any state-update re-renders flush before we trigger submit.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }

    const doc = this.getForgeDoc(moduleKey);
    if (!doc) {
      throw new Error(
        `No rendered ForgeDoc for module "${moduleKey}". ` +
        `Call await sim.ui.render("${moduleKey}") first.`
      );
    }

    const form = findFirstByType(doc, 'Form');
    if (!form) {
      throw new Error(
        `No <Form> in module "${moduleKey}". submitForm requires a Form node ` +
        `(typically wired up via useForm + handleSubmit).`
      );
    }
    if (typeof form.props.onSubmit !== 'function') {
      throw new Error(
        `<Form> in module "${moduleKey}" has no onSubmit handler.`
      );
    }

    const event = {
      preventDefault: () => {},
      stopPropagation: () => {},
    };
    const result = form.props.onSubmit(event);
    return result instanceof Promise ? await result : result;
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
    // Clear the moduleKey→resourcePath cache. Without this, a reset+redeploy
    // sequence that changes a resource path (e.g. renaming foo.jsx → foo.tsx
    // in the manifest) keeps serving the stale path. Tracked as N1.
    this.resolvedResources.clear();
    this.viewEventListeners.clear();
    this.activeModuleKey = null;
    // Clear the per-render resolver context overlay — UI is gone, so post-
    // render effects (and any subsequent cold sim.invoke) should drop back
    // to defaults+sticky.
    this.sim.resolver.setRenderContext(null);
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
    // Per-render overlay clears with the UI (matches `reset()` above).
    this.sim.resolver.setRenderContext(null);
  }
}
