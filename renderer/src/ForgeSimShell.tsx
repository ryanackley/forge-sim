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

import React, { useState, useEffect, useMemo, useRef } from 'react';
import AppProvider, { useSetColorMode } from '@atlaskit/app-provider';
import '@atlaskit/css-reset';
import { ForgeDocRenderer } from './ForgeDocRenderer';
import { onReconcile, onMacroConfigReconcile, setActiveSubmitTree, view } from './bridge/forge-bridge-shim';

// ---------------------------------------------------------------------------
// Width presets — mirror the real widths Forge uses across product surfaces.
// Numbers are informed by actual Jira/Confluence page chrome observations.
// ---------------------------------------------------------------------------

type WidthPresetKey = 'narrow' | 'standard' | 'wide' | 'full' | 'custom';

interface WidthPreset {
  key: WidthPresetKey;
  label: string;
  description: string;
  /** Pixel width; null means 100% (minus page padding) */
  px: number | null;
}

const WIDTH_PRESETS: Record<WidthPresetKey, WidthPreset> = {
  narrow: {
    key: 'narrow',
    label: 'Narrow',
    description: 'Issue panel, modals (~700px)',
    px: 700,
  },
  standard: {
    key: 'standard',
    label: 'Standard',
    description: 'Full-page apps (~900px)',
    px: 900,
  },
  wide: {
    key: 'wide',
    label: 'Wide',
    description: 'Global / project pages (~1280px)',
    px: 1280,
  },
  full: {
    key: 'full',
    label: 'Full width',
    description: 'Dashboards, edge cases',
    px: null,
  },
  custom: {
    key: 'custom',
    label: 'Custom',
    description: 'Specify a pixel value',
    px: null, // driven by customPx state
  },
};

// ---------------------------------------------------------------------------
// Module-type → default width preset.
// Based on how these modules actually render in Jira / Confluence.
// ---------------------------------------------------------------------------

const MODULE_TYPE_DEFAULTS: Record<string, WidthPresetKey> = {
  // Global / project pages → wide
  'jira:globalPage': 'wide',
  'jira:projectPage': 'wide',
  'jira:projectSettingsPage': 'wide',
  'jira:dashboardBackgroundScript': 'wide',
  'confluence:globalPage': 'wide',
  'confluence:spacePage': 'wide',
  'confluence:spaceSettingsPage': 'wide',

  // Issue / content panels and fields → narrow
  'jira:issuePanel': 'narrow',
  'jira:issueContext': 'narrow',
  'jira:issueActivity': 'narrow',
  'jira:customField': 'narrow',
  'jira:customFieldType': 'narrow',
  'confluence:contentBylineItem': 'narrow',
  'confluence:contextMenu': 'narrow',

  // Full-page admin / dashboard surfaces
  'jira:adminPage': 'wide',
  'confluence:homepageFeed': 'wide',
  'jira:dashboardGadget': 'full',

  // Default / fall-through stays 'standard' below
};

function defaultPresetForModuleType(moduleType: string | undefined): WidthPresetKey {
  if (!moduleType) return 'standard';
  return MODULE_TYPE_DEFAULTS[moduleType] ?? 'standard';
}

// ---------------------------------------------------------------------------
// Color mode — light / dark / auto
//
// We store the user's preference ourselves and drive Atlaskit via
// `useSetColorMode` (from @atlaskit/app-provider). Atlaskit handles all of:
//   - Loading the right theme stylesheet (<style data-theme="dark">)
//   - Setting <html data-color-mode="...">
//   - Reacting to prefers-color-scheme for 'auto' mode
// so our job is just persistence + wiring the toggle UI.
// ---------------------------------------------------------------------------

type ColorMode = 'light' | 'dark' | 'auto';
type ResolvedColorMode = 'light' | 'dark';

const COLOR_MODE_STORAGE_KEY = 'forge-sim:colorMode';

function readStoredColorMode(): ColorMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const raw = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'auto') return raw;
  } catch {
    /* ignore */
  }
  return 'light';
}

function writeStoredColorMode(mode: ColorMode) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

function prefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveColorMode(mode: ColorMode): ResolvedColorMode {
  if (mode === 'auto') return prefersDark() ? 'dark' : 'light';
  return mode;
}

// ---------------------------------------------------------------------------
// Persistence — width
// ---------------------------------------------------------------------------

interface WidthPref {
  preset: WidthPresetKey;
  customPx?: number;
}

const STORAGE_KEY_PREFIX = 'forge-sim:width:';

function readStoredPref(moduleKey: string | undefined): WidthPref | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = STORAGE_KEY_PREFIX + (moduleKey ?? '__default__');
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.preset === 'string') return parsed as WidthPref;
  } catch {
    /* ignore */
  }
  return null;
}

function writeStoredPref(moduleKey: string | undefined, pref: WidthPref) {
  if (typeof window === 'undefined') return;
  try {
    const key = STORAGE_KEY_PREFIX + (moduleKey ?? '__default__');
    window.localStorage.setItem(key, JSON.stringify(pref));
  } catch {
    /* ignore */
  }
}

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
// Gear popover UI — width + color mode
//
// Colors use Atlassian design tokens via CSS custom properties so the chrome
// itself responds to the selected color mode (the same mechanism Atlaskit
// components use under the hood).
// ---------------------------------------------------------------------------

interface GearPopoverProps {
  pref: WidthPref;
  moduleType: string | undefined;
  colorMode: ColorMode;
  resolvedColorMode: ResolvedColorMode;
  onWidthChange: (next: WidthPref) => void;
  onColorModeChange: (next: ColorMode) => void;
}

function GearPopover({
  pref,
  moduleType,
  colorMode,
  resolvedColorMode,
  onWidthChange,
  onColorModeChange,
}: GearPopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const suggestedKey = defaultPresetForModuleType(moduleType);
  const active = pref.preset;

  return (
    <div
      ref={rootRef}
      style={{
        position: 'fixed',
        bottom: '12px',
        right: '12px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '12px',
        zIndex: 9999,
      }}
    >
      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: '36px',
            right: 0,
            width: '260px',
            background: 'var(--ds-surface-overlay, #fff)',
            border: '1px solid var(--ds-border, #dfe1e6)',
            borderRadius: '6px',
            boxShadow: 'var(--ds-shadow-overlay, 0 4px 12px rgba(9,30,66,0.15))',
            padding: '8px',
            color: 'var(--ds-text, #172b4d)',
          }}
        >
          {/* ───────────── Color mode ───────────── */}
          <div
            style={{
              padding: '6px 8px 8px',
              fontSize: '11px',
              color: 'var(--ds-text-subtle, #6b778c)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontWeight: 600,
            }}
          >
            Color mode
          </div>
          <div
            style={{
              display: 'flex',
              gap: '4px',
              padding: '0 4px 8px',
            }}
          >
            {(['light', 'dark', 'auto'] as ColorMode[]).map((m) => {
              const isActive = colorMode === m;
              return (
                <button
                  key={m}
                  onClick={() => onColorModeChange(m)}
                  style={{
                    flex: 1,
                    padding: '6px 4px',
                    background: isActive
                      ? 'var(--ds-background-selected, #e9f2ff)'
                      : 'var(--ds-background-neutral-subtle, transparent)',
                    color: isActive
                      ? 'var(--ds-text-selected, #0c66e4)'
                      : 'var(--ds-text, #172b4d)',
                    border: '1px solid',
                    borderColor: isActive
                      ? 'var(--ds-border-selected, #388bff)'
                      : 'var(--ds-border, #dfe1e6)',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '12px',
                    fontWeight: isActive ? 600 : 400,
                    textTransform: 'capitalize',
                  }}
                >
                  {m}
                  {m === 'auto' && colorMode === 'auto' && (
                    <span
                      style={{
                        marginLeft: '4px',
                        fontSize: '10px',
                        opacity: 0.7,
                      }}
                    >
                      ({resolvedColorMode})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div
            style={{
              height: '1px',
              background: 'var(--ds-border, #f4f5f7)',
              margin: '4px 0 8px',
            }}
          />

          {/* ───────────── Preview width ───────────── */}
          <div
            style={{
              padding: '6px 8px 8px',
              fontSize: '11px',
              color: 'var(--ds-text-subtle, #6b778c)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontWeight: 600,
            }}
          >
            Preview width
          </div>

          {(Object.keys(WIDTH_PRESETS) as WidthPresetKey[]).map((k) => {
            const preset = WIDTH_PRESETS[k];
            const isActive = active === k;
            const isSuggested = suggestedKey === k;
            return (
              <button
                key={k}
                onClick={() =>
                  onWidthChange({ preset: k, customPx: pref.customPx })
                }
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px',
                  marginBottom: '2px',
                  background: isActive
                    ? 'var(--ds-background-selected, #e9f2ff)'
                    : 'transparent',
                  border: '1px solid',
                  borderColor: isActive
                    ? 'var(--ds-border-selected, #388bff)'
                    : 'transparent',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: '12px',
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    color: isActive
                      ? 'var(--ds-text-selected, #0c66e4)'
                      : 'var(--ds-text, #172b4d)',
                  }}
                >
                  {preset.label}
                  {isSuggested && (
                    <span
                      style={{
                        marginLeft: '6px',
                        fontSize: '10px',
                        color: 'var(--ds-text-success, #00875a)',
                        fontWeight: 600,
                      }}
                    >
                      • module default
                    </span>
                  )}
                </div>
                <div
                  style={{
                    color: 'var(--ds-text-subtle, #6b778c)',
                    fontSize: '11px',
                    marginTop: '2px',
                  }}
                >
                  {preset.description}
                </div>
              </button>
            );
          })}

          {active === 'custom' && (
            <div style={{ padding: '4px 8px 8px' }}>
              <label
                style={{
                  fontSize: '11px',
                  color: 'var(--ds-text-subtle, #6b778c)',
                  display: 'block',
                  marginBottom: '4px',
                }}
              >
                Custom width (px)
              </label>
              <input
                type="number"
                min={200}
                max={4000}
                value={pref.customPx ?? 900}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) {
                    onWidthChange({ preset: 'custom', customPx: n });
                  }
                }}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  border: '1px solid var(--ds-border, #dfe1e6)',
                  borderRadius: '3px',
                  fontSize: '12px',
                  fontFamily: 'inherit',
                  background: 'var(--ds-background-input, #fff)',
                  color: 'var(--ds-text, #172b4d)',
                }}
              />
            </div>
          )}

          {moduleType && (
            <div
              style={{
                padding: '8px',
                marginTop: '4px',
                borderTop: '1px solid var(--ds-border, #f4f5f7)',
                color: 'var(--ds-text-subtle, #6b778c)',
                fontSize: '11px',
              }}
            >
              Module:{' '}
              <code style={{ color: 'var(--ds-text, #172b4d)' }}>{moduleType}</code>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="forge-sim settings"
        title="forge-sim settings"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'var(--ds-background-neutral-bold, #172b4d)',
          color: 'var(--ds-text-inverse, #fff)',
          border: 'none',
          padding: '6px 10px',
          borderRadius: '4px',
          fontSize: '12px',
          fontFamily: 'monospace',
          cursor: 'pointer',
          opacity: 0.9,
        }}
      >
        <span>⚙️</span>
        <span>forge-sim</span>
      </button>
    </div>
  );
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
// Macro inline config tabs — only rendered when ForgeReconciler.addConfig()
// has produced a config tree alongside the main view tree.
// ---------------------------------------------------------------------------

interface MacroInlineConfigTabsProps {
  activeTab: 'view' | 'config';
  onTabChange: (tab: 'view' | 'config') => void;
}

function MacroInlineConfigTabs({ activeTab, onTabChange }: MacroInlineConfigTabsProps) {
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

function ShellInner({ initialColorMode }: ShellInnerProps) {
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
  // Setting this on every tab switch (and on mount when only view is present)
  // ensures inline-config submits get routed to the macro config store.
  useEffect(() => {
    setActiveSubmitTree(macroTab === 'config' ? 'macroConfig' : 'view');
  }, [macroTab]);

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
    const preset = WIDTH_PRESETS[pref.preset];
    if (pref.preset === 'full') return '100%';
    if (pref.preset === 'custom') {
      const n = pref.customPx ?? 900;
      return `${n}px`;
    }
    return preset.px ? `${preset.px}px` : '100%';
  }, [pref]);

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
          minHeight: '100vh',
          background: 'var(--ds-surface, #fafbfc)',
          transition: 'background 120ms ease',
        }}
      >
        <div
          data-forge-sim-content
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
            <MacroInlineConfigTabs
              activeTab={macroTab}
              onTabChange={setMacroTab}
            />
          )}
          <ForgeDocRenderer doc={activeDoc} />
        </div>
      </div>

      <GearPopover
        pref={pref}
        moduleType={moduleType}
        colorMode={colorMode}
        resolvedColorMode={resolvedColorMode}
        onWidthChange={handlePrefChange}
        onColorModeChange={handleColorModeChange}
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
  );
}
