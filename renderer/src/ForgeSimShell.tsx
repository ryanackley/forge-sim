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
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import AppProvider from '@atlaskit/app-provider';
import '@atlaskit/css-reset';
import { ForgeDocRenderer } from './ForgeDocRenderer';
import { onReconcile, view } from './bridge/forge-bridge-shim';

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
// Persistence
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
// Width control UI
// ---------------------------------------------------------------------------

interface WidthControlProps {
  pref: WidthPref;
  moduleType: string | undefined;
  onChange: (next: WidthPref) => void;
}

function WidthControl({ pref, moduleType, onChange }: WidthControlProps) {
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
            background: '#fff',
            border: '1px solid #dfe1e6',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(9,30,66,0.15)',
            padding: '8px',
          }}
        >
          <div
            style={{
              padding: '6px 8px 8px',
              fontSize: '11px',
              color: '#6b778c',
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
                  onChange({ preset: k, customPx: pref.customPx })
                }
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px',
                  marginBottom: '2px',
                  background: isActive ? '#e9f2ff' : 'transparent',
                  border: '1px solid',
                  borderColor: isActive ? '#388bff' : 'transparent',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: '12px',
                }}
              >
                <div style={{ fontWeight: 600, color: '#172b4d' }}>
                  {preset.label}
                  {isSuggested && (
                    <span
                      style={{
                        marginLeft: '6px',
                        fontSize: '10px',
                        color: '#00875a',
                        fontWeight: 600,
                      }}
                    >
                      • module default
                    </span>
                  )}
                </div>
                <div style={{ color: '#6b778c', fontSize: '11px', marginTop: '2px' }}>
                  {preset.description}
                </div>
              </button>
            );
          })}

          {active === 'custom' && (
            <div style={{ padding: '4px 8px 8px' }}>
              <label
                style={{ fontSize: '11px', color: '#6b778c', display: 'block', marginBottom: '4px' }}
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
                    onChange({ preset: 'custom', customPx: n });
                  }
                }}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  border: '1px solid #dfe1e6',
                  borderRadius: '3px',
                  fontSize: '12px',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          )}

          {moduleType && (
            <div
              style={{
                padding: '8px',
                marginTop: '4px',
                borderTop: '1px solid #f4f5f7',
                color: '#6b778c',
                fontSize: '11px',
              }}
            >
              Module: <code style={{ color: '#172b4d' }}>{moduleType}</code>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Preview settings"
        title="Preview width"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: '#172b4d',
          color: '#fff',
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

export function ForgeSimShell() {
  const [doc, setDoc] = useState<any>(null);
  const [renderCount, setRenderCount] = useState(0);

  const moduleKey = useMemo(getModuleKeyFromURL, []);
  const [moduleType, setModuleType] = useState<string | undefined>(undefined);
  const [pref, setPref] = useState<WidthPref>(() => {
    const stored = readStoredPref(moduleKey);
    return stored ?? { preset: 'standard' };
  });
  // Tracks whether the current `pref` was chosen explicitly or derived from
  // the module type. If derived, we keep updating it as moduleType resolves
  // and we don't persist it until the user explicitly interacts.
  const prefIsExplicit = useRef<boolean>(!!readStoredPref(moduleKey));

  // Listen for ForgeDoc updates
  useEffect(() => {
    const unbind = onReconcile((forgeDoc: any) => {
      setDoc(forgeDoc);
      setRenderCount((n) => n + 1);
    });
    return unbind;
  }, []);

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
          color: '#6b778c',
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

  return (
    <AppProvider defaultColorMode="light">
      <div
        data-forge-sim-content
        style={{
          maxWidth: effectiveMaxWidth,
          margin: '24px auto',
          padding: '24px',
          background: '#fff',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          minHeight: '200px',
          transition: 'max-width 120ms ease',
        }}
      >
        <ForgeDocRenderer doc={doc} />
      </div>
      <WidthControl pref={pref} moduleType={moduleType} onChange={handlePrefChange} />
      <div
        style={{
          position: 'fixed',
          bottom: '12px',
          left: '12px',
          background: '#172b4d',
          color: '#fff',
          padding: '4px 10px',
          borderRadius: '4px',
          fontSize: '11px',
          fontFamily: 'monospace',
          opacity: 0.6,
        }}
      >
        🔥 renders: {renderCount}
      </div>
    </AppProvider>
  );
}
