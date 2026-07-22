/**
 * ForgeSimShell — the top-level wrapper for forge-sim dev mode.
 *
 * This component lives in the renderer source directory so that all Atlaskit
 * imports resolve from renderer/node_modules (where they're installed).
 *
 * The generated entry.tsx imports this shell, which handles:
 *   - Atlaskit AppProvider + CSS reset
 *   - Listening for ForgeDoc from the bridge shim (useBrowserDoc)
 *   - Rendering ForgeDoc via ForgeDocRenderer
 *   - Dev-only width controls (gear menu) with module-type-aware defaults
 *   - Dev-only color mode toggle (light / dark / auto)
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import AppProvider, { useSetColorMode } from '@atlaskit/app-provider';
import '@atlaskit/css-reset';
import { ForgeDocRenderer } from './ForgeDocRenderer';
import { onReconcile, onMacroConfigReconcile, setActiveSubmitTree, view, rpc } from './bridge/forge-bridge-shim';
import { GearPopover } from './chrome/GearPopover';
import {
  WidthPref,
  ColorMode,
  ResolvedColorMode,
  ActingUserOption,
  ActingUserState,
  WIDTH_PRESETS,
  COLOR_MODE_STORAGE_KEY,
  defaultPresetForModuleType,
  readStoredColorMode,
  writeStoredColorMode,
  resolveColorMode,
  writeStoredActingAs,
  clearStoredActingAs,
  readStoredPref,
  writeStoredPref,
} from './chrome/prefs';

// ---------------------------------------------------------------------------
// Module info — pulled from URL + bridge context.
// ---------------------------------------------------------------------------

function getModuleKeyFromURL(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const match = window.location.pathname.match(/^\/module\/([^/]+)/);
  return match?.[1];
}

async function fetchModuleType(_moduleKey: string | undefined): Promise<string | undefined> {
  if (typeof window === 'undefined') return undefined;
  try {
    const ctx: any = await view.getContext();
    return ctx?.extension?.type ?? ctx?.moduleType;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

/**
 * Outer shell — owns the AppProvider mount. AppProvider loads the initial
 * theme based on the stored preference; all subsequent changes flow through
 * `useSetColorMode` inside the inner shell.
 */
export function ForgeSimShell() {
  // Read the stored pref ONCE at mount time, so AppProvider gets the right
  // initial `defaultColorMode`. Further changes don't re-read — the inner
  // shell's useSetColorMode drives Atlaskit after that.
  const initialColorMode = useMemo<ColorMode>(() => readStoredColorMode(), []);

  return (
    <AppProvider defaultColorMode={initialColorMode}>
      <ShellInner initialColorMode={initialColorMode} />
    </AppProvider>
  );
}

interface ShellInnerProps {
  initialColorMode: ColorMode;
}

// ---------------------------------------------------------------------------
// Macro inline config — only rendered when ForgeReconciler.addConfig() has
// produced a config tree alongside the main view tree.
//
// Forge's inline macro config is platform-managed: the user does NOT write
// a Save button inside their Config component — the platform renders modal
// chrome (Save/Cancel) and harvests named form fields. This shell mirrors
// that contract so docs-correct apps work in dev mode.
// ---------------------------------------------------------------------------

/**
 * Walk a ForgeDoc and collect declared `defaultValue` props keyed by `name`.
 * Used as the fallback value for components that don't bind to native HTML
 * forms (Select, DatePicker, UserPicker) — clicking Save without interacting
 * persists the declared defaults, matching platform behavior.
 *
 * Returns the defaults map AND the set of names whose component types do NOT
 * cleanly bind to FormData. The Save handler uses this set to prefer the
 * declared default over FormData's empty-string for those components.
 */
function collectDefaultsFromConfigTree(
  node: any,
  out: Record<string, unknown>,
  nonFormDataNames: Set<string>,
): void {
  if (!node || typeof node !== 'object') return;
  const props = node.props ?? {};
  if (typeof props.name === 'string') {
    if (props.defaultValue !== undefined && !(props.name in out)) {
      out[props.name] = props.defaultValue;
    }
    if (NON_FORMDATA_COMPONENTS.has(node.type)) {
      nonFormDataNames.add(props.name);
    }
  }
  if (Array.isArray(node.children)) {
    for (const c of node.children) collectDefaultsFromConfigTree(c, out, nonFormDataNames);
  }
}

/**
 * Walk a ForgeDoc and collect type names of form components that don't
 * cleanly participate in a native FormData harvest (Atlaskit wraps these in
 * components that don't expose a [name] attribute on the DOM).
 *
 * The dev shell shows a parity note for these so users aren't surprised when
 * Save captures defaults but not their interactive input.
 */
const NON_FORMDATA_COMPONENTS = new Set([
  'Select',
  'DatePicker',
  'UserPicker',
  'CheckboxGroup', // Atlaskit's CheckboxGroup uses internal state, not [name] on a DOM input
  'RadioGroup',
]);

function listNonFormDataComponents(node: any, out: Set<string>): void {
  if (!node || typeof node !== 'object') return;
  if (NON_FORMDATA_COMPONENTS.has(node.type)) out.add(node.type);
  if (Array.isArray(node.children)) {
    for (const c of node.children) listNonFormDataComponents(c, out);
  }
}

interface MacroInlineConfigShellProps {
  configDoc: any;
  activeTab: 'view' | 'config';
  onTabChange: (tab: 'view' | 'config') => void;
  formRef: React.RefObject<HTMLFormElement | null>;
  onSave: () => void;
  onCancel: () => void;
}

function MacroInlineConfigTabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: 'view' | 'config';
  onTabChange: (tab: 'view' | 'config') => void;
}) {
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 16px',
    fontSize: '13px',
    fontWeight: 600,
    border: '1px solid var(--ds-border, #dfe1e6)',
    cursor: 'pointer',
    background: active
      ? 'var(--ds-background-selected, #0c66e4)'
      : 'var(--ds-background-neutral-subtle, #fafbfc)',
    color: active
      ? 'var(--ds-text-inverse, #fff)'
      : 'var(--ds-text-subtle, #6b778c)',
    transition: 'all 0.12s ease',
    fontFamily: 'inherit',
  });

  return (
    <div
      data-forge-sim-macro-tabs
      style={{
        display: 'flex',
        gap: 0,
        marginBottom: 16,
        borderBottom: '1px solid var(--ds-border, #f4f5f7)',
        paddingBottom: 12,
      }}
    >
      <button
        onClick={() => onTabChange('view')}
        style={{ ...tabStyle(activeTab === 'view'), borderRadius: '4px 0 0 4px' }}
      >
        View
      </button>
      <button
        onClick={() => onTabChange('config')}
        style={{ ...tabStyle(activeTab === 'config'), borderRadius: '0 4px 4px 0', borderLeft: 'none' }}
      >
        Config
      </button>
      <span
        style={{
          marginLeft: 'auto',
          fontSize: '11px',
          color: 'var(--ds-text-subtle, #6b778c)',
          alignSelf: 'center',
          fontFamily: 'monospace',
        }}
      >
        inline macro config
      </span>
    </div>
  );
}

/**
 * Save/Cancel chrome shown beneath the Config tree. Mirrors how real Forge
 * renders the macro config modal: app declares fields, platform owns submit.
 */
function MacroInlineConfigFooter({
  onSave,
  onCancel,
  parityHint,
}: {
  onSave: () => void;
  onCancel: () => void;
  parityHint?: string;
}) {
  const btnStyle = (primary: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    fontSize: '13px',
    fontWeight: 600,
    border: '1px solid var(--ds-border, #dfe1e6)',
    cursor: 'pointer',
    borderRadius: '4px',
    background: primary
      ? 'var(--ds-background-brand-bold, #0c66e4)'
      : 'var(--ds-background-neutral-subtle, #fafbfc)',
    color: primary
      ? 'var(--ds-text-inverse, #fff)'
      : 'var(--ds-text, #172b4d)',
    fontFamily: 'inherit',
  });
  return (
    <div
      data-forge-sim-config-footer
      style={{
        marginTop: 16,
        paddingTop: 12,
        borderTop: '1px solid var(--ds-border, #f4f5f7)',
        display: 'flex',
        gap: 8,
        justifyContent: 'flex-end',
        alignItems: 'center',
      }}
    >
      {parityHint && (
        <span
          style={{
            marginRight: 'auto',
            fontSize: '11px',
            color: 'var(--ds-text-subtle, #6b778c)',
            fontFamily: 'monospace',
          }}
          title={parityHint}
        >
          ⚠️ parity: see console
        </span>
      )}
      <button type="button" onClick={onCancel} style={btnStyle(false)}>
        Cancel
      </button>
      <button type="button" onClick={onSave} style={btnStyle(true)}>
        Save
      </button>
    </div>
  );
}

function ShellInner({ initialColorMode }: ShellInnerProps) {
  // Are we running inside a parent iframe (a nested surface — macro /
  // custom-field / workflow content iframe)? On those surfaces the top-level
  // ForgeSimModulePage owns the gear + badge chrome, so the embedded shell
  // renders ONLY the module content. On standard top-level surfaces
  // (jira:issuePanel, jira:globalPage, ...) the shell IS the document, so it
  // renders its own chrome as before.
  const embedded = typeof window !== 'undefined' && window.parent !== window;

  const [doc, setDoc] = useState<any>(null);
  // Macro inline config: a separate ForgeDoc tree emitted by
  // ForgeReconciler.addConfig(<Config />). Null until the app calls addConfig.
  const [macroConfigDoc, setMacroConfigDoc] = useState<any>(null);
  const [macroTab, setMacroTab] = useState<'view' | 'config'>('view');
  const [renderCount, setRenderCount] = useState(0);

  // Width prefs
  const moduleKey = useMemo(getModuleKeyFromURL, []);
  const [moduleType, setModuleType] = useState<string | undefined>(undefined);
  const [pref, setPref] = useState<WidthPref>(() => {
    const stored = readStoredPref(moduleKey);
    return stored ?? { preset: 'standard' };
  });
  const prefIsExplicit = useRef<boolean>(!!readStoredPref(moduleKey));

  // Acting-as user switcher — mode + who's currently acting. Fetched once from
  // the dev server over RPC; a null `switcher` (headless/MCP path, no dev
  // server) hides the whole gear section.
  const [switcher, setSwitcher] = useState<ActingUserState | null>(null);

  useEffect(() => {
    let cancelled = false;
    rpc('getActingUserState')
      .then((res: ActingUserState) => {
        if (cancelled || !res) return;
        setSwitcher(res);
      })
      .catch(() => {
        /* no dev server (headless/MCP) — leave switcher null */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSearchUsers = async (query: string): Promise<ActingUserOption[]> => {
    try {
      const res: { users?: ActingUserOption[] } = await rpc('searchUsers', { query });
      return res?.users ?? [];
    } catch {
      return [];
    }
  };

  const handleActingUserChange = async (user: ActingUserOption | null) => {
    const nextId = user?.accountId;
    if (nextId === switcher?.current?.accountId) return;
    if (nextId) writeStoredActingAs(nextId);
    else clearStoredActingAs();
    // Optimistic — the reload below resyncs from the server regardless.
    setSwitcher((prev) => (prev ? { ...prev, current: user } : prev));
    try {
      await rpc('setActingUser', user ? { user } : {});
    } catch {
      /* ignore — reload resyncs from the server anyway */
    }
    // Reload so the app's mount-effect invoke() calls re-run as the new user.
    if (typeof window !== 'undefined') window.location.reload();
  };

  // Color mode — Atlaskit's setter loads the right theme stylesheet and sets
  // <html data-color-mode>, including handling 'auto' via prefers-color-scheme.
  const setAtlaskitColorMode = useSetColorMode();
  const [colorMode, setColorMode] = useState<ColorMode>(initialColorMode);
  // Derived resolved mode (for the 'Auto (light|dark)' badge in the popover)
  const [resolvedColorMode, setResolvedColorMode] = useState<ResolvedColorMode>(() =>
    resolveColorMode(initialColorMode),
  );

  // Keep resolvedColorMode in sync with the OS preference when in 'auto' mode
  // (for the popover badge — Atlaskit already flips the theme itself).
  useEffect(() => {
    setResolvedColorMode(resolveColorMode(colorMode));
    if (colorMode !== 'auto' || typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setResolvedColorMode(mq.matches ? 'dark' : 'light');
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, [colorMode]);

  // Listen for ForgeDoc updates — main view tree
  useEffect(() => {
    const unbind = onReconcile((forgeDoc: any) => {
      setDoc(forgeDoc);
      setRenderCount((n) => n + 1);
    });
    return unbind;
  }, []);

  // Listen for ForgeDoc updates — macro inline config tree
  useEffect(() => {
    const unbind = onMacroConfigReconcile((forgeDoc: any) => {
      setMacroConfigDoc(forgeDoc);
      setRenderCount((n) => n + 1);
    });
    return unbind;
  }, []);

  // Tell the bridge which tree the next view.submit() is coming from.
  // The user's inline config component is NOT supposed to call view.submit()
  // (real Forge auto-saves via platform chrome) — but if they do, route the
  // payload to the macro config store. Our platform Save button below uses
  // this same flag, then calls view.submit() with the harvested values.
  useEffect(() => {
    setActiveSubmitTree(macroTab === 'config' ? 'macroConfig' : 'view');
  }, [macroTab]);

  // Auto-resize when embedded in a parent iframe (macro / custom-field /
  // workflow dev pages nest the renderer in a child iframe pinned at
  // min-height: 200px). Those pages listen for a { type: 'resize', height }
  // postMessage to grow the iframe to fit — but nothing ever emitted it, so
  // config/view/field/validator sub-iframes were stuck at 200px regardless of
  // content. Measure the content card and post its height to the parent.
  //
  // A callback ref (not a mount-time useEffect) is required because the loading
  // gate returns different DOM before the first ForgeDoc arrives — the card
  // this observes doesn't exist yet at mount. React re-invokes the ref as the
  // card attaches/detaches, so the observer always tracks the live node.
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const contentNodeRef = useRef<HTMLDivElement | null>(null);

  const postHeight = useCallback(() => {
    const node = contentNodeRef.current;
    // Only emit when actually embedded — top-level module pages (100vh) grow
    // on their own, and posting to self is pointless.
    if (!node || !embedded) return;
    // + 48 covers the card's 24px top+bottom margins so the parent iframe
    // isn't clipped at the seam. Math.ceil avoids fractional-pixel jitter.
    // Pure content height — the gear + its upward-opening popover now live on
    // the top-level parent page (ForgeSimModulePage), so there's nothing inside
    // this iframe to reserve room for. The iframe sizes to content only.
    const height = Math.ceil(node.getBoundingClientRect().height) + 48;
    try {
      window.parent.postMessage({ type: 'resize', height }, '*');
    } catch {
      /* cross-origin parent — ignore */
    }
  }, [embedded]);

  const contentCardRef = useCallback(
    (node: HTMLDivElement | null) => {
      contentNodeRef.current = node;

      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (!node || !embedded) return;

      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => postHeight());
        ro.observe(node);
        resizeObserverRef.current = ro;
      }
      // Emit once immediately so the parent sizes correctly even if the content
      // never resizes again after attach.
      postHeight();
    },
    [postHeight, embedded],
  );

  // When embedded, mirror the render count up to the parent page so its
  // top-level badge (🔥 renders: N) reflects the visible content iframe.
  useEffect(() => {
    if (!embedded) return;
    try {
      window.parent.postMessage({ type: 'forge-sim:renderCount', count: renderCount }, '*');
    } catch {
      /* cross-origin parent — ignore */
    }
  }, [embedded, renderCount]);

  // When embedded, the parent page's gear owns color mode. It writes the shared
  // localStorage key and we react to the cross-frame `storage` event so the
  // content theme flips live without a reload.
  useEffect(() => {
    if (!embedded || typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== COLOR_MODE_STORAGE_KEY) return;
      const next = readStoredColorMode();
      setColorMode(next);
      setAtlaskitColorMode(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [embedded, setAtlaskitColorMode]);

  // Form ref + parity bookkeeping for the inline config Save button.
  const configFormRef = useRef<HTMLFormElement | null>(null);
  const [configParityHint, setConfigParityHint] = useState<string | undefined>(undefined);

  // Detect non-FormData-binding components (Atlaskit Select etc.) when the
  // config tree changes, and surface a parity note so the dev sees it.
  useEffect(() => {
    if (!macroConfigDoc) {
      setConfigParityHint(undefined);
      return;
    }
    const offenders = new Set<string>();
    listNonFormDataComponents(macroConfigDoc, offenders);
    if (offenders.size === 0) {
      setConfigParityHint(undefined);
      return;
    }
    const list = [...offenders].sort().join(', ');
    const msg =
      `[forge-sim] inline macro config: ${list} doesn't bind to native ` +
      `FormData. Save will use declared defaultValue for these — interactive ` +
      `value tracking is a known dev-mode gap. Headless tests via ` +
      `sim.ui.renderInlineConfig() are unaffected.`;
    // Log once per config tree change
    console.warn(msg);
    setConfigParityHint(msg);
  }, [macroConfigDoc]);

  // Platform Save: harvest named form fields from the rendered Config tree
  // and submit them as { name → value }. Falls back to the declared
  // defaultValue for components that don't bind to native HTML form data.
  const handleConfigSave = async () => {
    // 1. Seed from declared defaultValue (matches platform behavior:
    //    clicking Save without changes persists declared defaults).
    const values: Record<string, unknown> = {};
    const nonFormDataNames = new Set<string>();
    if (macroConfigDoc) {
      collectDefaultsFromConfigTree(macroConfigDoc, values, nonFormDataNames);
    }

    // 2. Native HTML form harvest — overlays user-entered values for
    //    components that actually bind to FormData (Textfield, TextArea,
    //    Checkbox). For known non-FormData components (Atlaskit Select etc.,
    //    which inject empty hidden inputs) we keep the declared default
    //    rather than letting an empty string clobber it.
    if (configFormRef.current) {
      try {
        const fd = new FormData(configFormRef.current);
        for (const [key, val] of fd.entries()) {
          if (nonFormDataNames.has(key) && val === '') continue;
          values[key] = val;
        }
      } catch {
        // FormData can throw on detached elements — ignore and fall through
      }
    }

    // 3. Submit through the existing macroConfig route. The bridge tags
    //    the payload with submitTree:'macroConfig' (we already set the
    //    flag in the tab effect above), the dev-server stores it under
    //    the macro key and broadcasts macroConfigUpdate to all clients.
    await view.submit(values);

    // 4. Switch back to View — the dev-server's broadcast triggers a
    //    reload of the view iframe, so useConfig() picks up the new values.
    setMacroTab('view');
  };

  const handleConfigCancel = () => {
    // Discard in-progress edits and return to view. The previously stored
    // config (if any) is preserved — no platform-level rollback needed.
    setMacroTab('view');
  };

  // Resolve module type once on mount, then set default width if user hasn't
  // explicitly chosen one.
  useEffect(() => {
    let cancelled = false;
    fetchModuleType(moduleKey).then((type) => {
      if (cancelled || !type) return;
      setModuleType(type);
      if (!prefIsExplicit.current) {
        const suggested = defaultPresetForModuleType(type);
        setPref((prev) =>
          prev.preset === suggested ? prev : { preset: suggested, customPx: prev.customPx },
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [moduleKey]);

  const handlePrefChange = (next: WidthPref) => {
    prefIsExplicit.current = true;
    setPref(next);
    writeStoredPref(moduleKey, next);
  };

  const handleColorModeChange = (next: ColorMode) => {
    setColorMode(next);
    writeStoredColorMode(next);
    // Drive Atlaskit — this loads the dark theme stylesheet on first flip
    // and sets <html data-color-mode>.
    setAtlaskitColorMode(next);
  };

  // Compute effective width
  const effectiveMaxWidth = useMemo<string>(() => {
    // Embedded content fills its iframe — the parent page owns the width preset
    // and sizes the iframe itself, so the inner card must not double-constrain.
    if (embedded) return '100%';
    const preset = WIDTH_PRESETS[pref.preset];
    if (pref.preset === 'full') return '100%';
    if (pref.preset === 'custom') {
      const n = pref.customPx ?? 900;
      return `${n}px`;
    }
    return preset.px ? `${preset.px}px` : '100%';
  }, [pref, embedded]);

  if (!doc) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: 'var(--ds-text-subtle, #6b778c)',
          background: 'var(--ds-surface, transparent)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚡</div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>Loading Forge app...</div>
          <div style={{ fontSize: '14px', marginTop: '8px' }}>
            Waiting for ForgeReconciler.render() to produce a ForgeDoc
          </div>
        </div>
      </div>
    );
  }

  // When a macro uses inline config (ForgeReconciler.addConfig), we get a
  // second ForgeDoc tree. Show tabs so the user can switch between View and
  // Config in the same iframe — matches how Confluence's macro editor toggles
  // the macro view vs its config dialog.
  const hasInlineMacroConfig = macroConfigDoc != null;
  const activeDoc = hasInlineMacroConfig && macroTab === 'config' ? macroConfigDoc : doc;

  return (
    <>
      {/* Page background — flips with color mode via token */}
      <div
        data-forge-sim-page
        style={{
          // Top-level surfaces fill the viewport (100vh). When embedded in a
          // content iframe (macro/field/workflow), the iframe is sized to
          // content by the resize emitter, so 100vh would force it to the
          // iframe's own height. Worse, the content card's 24px top/bottom
          // margins collapse THROUGH this wrapper + <body> to <html>,
          // overflowing the content-sized iframe by one margin (24px) and
          // producing an internal scrollbar. `display: flow-root` establishes
          // a block formatting context that contains those margins so the
          // document height matches the posted content height exactly.
          ...(embedded
            ? { display: 'flow-root', minHeight: 0 }
            : { minHeight: '100vh' }),
          background: 'var(--ds-surface, #fafbfc)',
          transition: 'background 120ms ease',
        }}
      >
        <div
          data-forge-sim-content
          ref={contentCardRef}
          style={{
            maxWidth: effectiveMaxWidth,
            margin: '24px auto',
            padding: '24px',
            background: 'var(--ds-surface-raised, #fff)',
            color: 'var(--ds-text, #172b4d)',
            borderRadius: '8px',
            boxShadow: 'var(--ds-shadow-raised, 0 1px 3px rgba(0,0,0,0.1))',
            minHeight: '200px',
            transition: 'max-width 120ms ease, background 120ms ease',
          }}
        >
          {hasInlineMacroConfig && (
            <MacroInlineConfigTabBar
              activeTab={macroTab}
              onTabChange={setMacroTab}
            />
          )}
          {hasInlineMacroConfig && macroTab === 'config' ? (
            <form
              ref={configFormRef}
              data-forge-sim-config-form
              onSubmit={(e) => { e.preventDefault(); handleConfigSave(); }}
            >
              <ForgeDocRenderer doc={activeDoc} />
              <MacroInlineConfigFooter
                onSave={handleConfigSave}
                onCancel={handleConfigCancel}
                parityHint={configParityHint}
              />
            </form>
          ) : (
            <ForgeDocRenderer doc={activeDoc} />
          )}
        </div>
      </div>

      {/* Dev chrome — only when top-level. On nested surfaces the parent
          ForgeSimModulePage renders the gear + badge so they pin to the real
          browser viewport instead of this content iframe's viewport. */}
      {!embedded && (
        <>
          <GearPopover
            pref={pref}
            moduleType={moduleType}
            colorMode={colorMode}
            resolvedColorMode={resolvedColorMode}
            switcher={switcher}
            onWidthChange={handlePrefChange}
            onColorModeChange={handleColorModeChange}
            onSearchUsers={handleSearchUsers}
            onActingUserChange={handleActingUserChange}
          />

          <div
            style={{
              position: 'fixed',
              bottom: '12px',
              left: '12px',
              background: 'var(--ds-background-neutral-bold, #172b4d)',
              color: 'var(--ds-text-inverse, #fff)',
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'monospace',
              opacity: 0.6,
            }}
          >
            🔥 renders: {renderCount}
          </div>
        </>
      )}
    </>
  );
}
