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
import Avatar from '@atlaskit/avatar';
import { AsyncSelect } from '@atlaskit/select';
import '@atlaskit/css-reset';
import { ForgeDocRenderer } from './ForgeDocRenderer';
import { onReconcile, onMacroConfigReconcile, setActiveSubmitTree, view, rpc } from './bridge/forge-bridge-shim';

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
// Acting user ("Acting as" gear switcher)
//
// The renderer is a separate Vite package, so it never imports the seeded
// roster from forge-sim's src. Everything flows over RPC:
//   - `getActingUserState` → { mode, current, users, site } on mount
//   - `searchUsers` → mode-aware live search (real /user/picker vs seeded filter)
//   - `setActingUser` → echoes the pick back; the dev server is the single
//     source of truth for who's acting.
//
// Two modes (`forge-sim dev`'s default is connecting to a live instance):
//   - connected: search REAL users off the instance; roster is empty.
//   - offline:   the seeded roster is the always-no-cloud fallback.
// localStorage only drives the pre-RPC highlight; the server wins.
// ---------------------------------------------------------------------------

/** The thin "who am I" option the switcher works with (mirrors ActingUser). */
interface ActingUserOption {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  avatarUrl?: string;
  /** Seeded-roster only; absent for real picked users. */
  role?: string;
}

/** The `getActingUserState` RPC payload. */
interface ActingUserState {
  mode: 'connected' | 'offline';
  current: ActingUserOption | null;
  /** Seeded roster (offline) or [] (connected — search is live). */
  users: ActingUserOption[];
  /** The site backing the live search (connected only). */
  site: string | null;
}

const ACTING_AS_STORAGE_KEY = 'forge-sim:actingAs';

function readStoredActingAs(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ACTING_AS_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredActingAs(accountId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ACTING_AS_STORAGE_KEY, accountId);
  } catch {
    /* ignore */
  }
}

function clearStoredActingAs() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ACTING_AS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Map an acting-user to the `{ label, value, user }` shape AsyncSelect wants. */
function toUserOption(u: ActingUserOption) {
  return { label: u.displayName, value: u.accountId, user: u };
}

/** Avatar + name + subtitle (role or email) for a select option / value. */
function formatUserOption(option: { label: string; user?: ActingUserOption }) {
  const u = option.user;
  const subtitle = u?.role ?? u?.emailAddress ?? '';
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
      <Avatar name={option.label} src={u?.avatarUrl} size="small" />
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span
          style={{
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {option.label}
        </span>
        {subtitle && (
          <span style={{ color: 'var(--ds-text-subtle, #6b778c)', fontSize: '11px' }}>
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
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
  switcher: ActingUserState | null;
  onWidthChange: (next: WidthPref) => void;
  onColorModeChange: (next: ColorMode) => void;
  onSearchUsers: (query: string) => Promise<ActingUserOption[]>;
  onActingUserChange: (user: ActingUserOption | null) => void;
  // Reports how many vertical pixels the popover needs (measured from the
  // iframe bottom) while it's open, or null when closed. The shell floors the
  // auto-resize height to this so the upward-opening popup + user-search menu
  // aren't clipped inside a content-sized iframe.
  onChromeHeightChange: (needed: number | null) => void;
}

function GearPopover({
  pref,
  moduleType,
  colorMode,
  resolvedColorMode,
  switcher,
  onWidthChange,
  onColorModeChange,
  onSearchUsers,
  onActingUserChange,
  onChromeHeightChange,
}: GearPopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

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

  // Report the room the popover needs so the shell can grow the iframe to fit.
  // Geometry (all measured from the iframe bottom):
  //   gear root      bottom: 12px
  //   popup panel    bottom: 36px (relative to root) → 48px from iframe bottom
  //   panel height   measured live (varies with sections / custom-width input)
  //   user search    AsyncSelect menuPlacement="top", maxMenuHeight 220 →
  //                  reserve ~240px ABOVE the panel, but only when a switcher
  //                  is present (that's the only upward-opening menu).
  // Re-measures on the inputs that change the panel's height. Closing reports
  // null, which drops the floor back to the content height.
  useEffect(() => {
    if (!open) {
      onChromeHeightChange(null);
      return;
    }
    const panelHeight = panelRef.current
      ? Math.ceil(panelRef.current.getBoundingClientRect().height)
      : 0;
    const menuReserve = switcher ? 240 : 0;
    const needed = 12 + 36 + panelHeight + menuReserve + 12;
    onChromeHeightChange(needed);
  }, [open, switcher, pref.preset, colorMode, onChromeHeightChange]);

  // Drop the floor if this popover unmounts while open.
  useEffect(() => () => onChromeHeightChange(null), [onChromeHeightChange]);

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
          ref={panelRef}
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
          {/* ───────────── Acting as ─────────────
              Only rendered when the dev server answered `getActingUserState`.
              The headless / MCP render path has no dev server, so `switcher`
              stays null and this whole section is a graceful no-op.

              Searchable picker (Atlaskit AsyncSelect):
                - connected: `searchUsers` proxies the instance's /user/picker
                  (real accountIds — no fake-id leak into a live session).
                - offline:   `searchUsers` filters the seeded roster; the roster
                  is preloaded as defaultOptions so the menu is populated on open.
              A pick overrides the current user (beats the real API) and reloads
              so the app's mount-effect invoke() calls re-run as the new user. */}
          {switcher && (
            <>
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
                Acting as
              </div>
              <div style={{ padding: '0 4px 4px' }}>
                <AsyncSelect
                  inputId="forge-sim-acting-as"
                  aria-label="Acting as user"
                  cacheOptions
                  defaultOptions={
                    switcher.mode === 'offline'
                      ? switcher.users.map(toUserOption)
                      : true
                  }
                  value={switcher.current ? toUserOption(switcher.current) : null}
                  loadOptions={async (input: string) =>
                    (await onSearchUsers(input)).map(toUserOption)
                  }
                  onChange={(opt: unknown) =>
                    onActingUserChange(
                      (opt as { user?: ActingUserOption } | null)?.user ?? null,
                    )
                  }
                  formatOptionLabel={formatUserOption}
                  placeholder={
                    switcher.mode === 'connected' ? 'Search users…' : 'Pick a user…'
                  }
                  noOptionsMessage={() =>
                    switcher.mode === 'connected'
                      ? 'Type to search users'
                      : 'No matching users'
                  }
                  isClearable={switcher.mode === 'connected'}
                  spacing="compact"
                  menuPlacement="top"
                  maxMenuHeight={220}
                  styles={{
                    menu: (base: Record<string, unknown>) => ({ ...base, zIndex: 10000 }),
                    menuPortal: (base: Record<string, unknown>) => ({ ...base, zIndex: 10000 }),
                  }}
                />
              </div>
              {switcher.mode === 'connected' && switcher.site && (
                <div
                  style={{
                    padding: '0 8px 6px',
                    fontSize: '11px',
                    color: 'var(--ds-text-subtle, #6b778c)',
                  }}
                >
                  Live users from {switcher.site}
                </div>
              )}

              <div
                style={{
                  height: '1px',
                  background: 'var(--ds-border, #f4f5f7)',
                  margin: '4px 0 8px',
                }}
              />
            </>
          )}

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
  // Floor for the posted height, in px, driven by the gear popover while it's
  // open (see GearPopover.onChromeHeightChange). A ref mirror lets the
  // ResizeObserver callback read the latest value without re-subscribing.
  const [gearChromeHeight, setGearChromeHeight] = useState<number | null>(null);
  const gearChromeHeightRef = useRef<number | null>(null);

  const postHeight = useCallback(() => {
    const node = contentNodeRef.current;
    // Only emit when actually embedded — top-level module pages (100vh) grow
    // on their own, and posting to self is pointless.
    const embedded =
      typeof window !== 'undefined' && window.parent && window.parent !== window;
    if (!node || !embedded) return;
    // + 48 covers the card's 24px top+bottom margins so the parent iframe
    // isn't clipped at the seam. Math.ceil avoids fractional-pixel jitter.
    const contentHeight = Math.ceil(node.getBoundingClientRect().height) + 48;
    // Floor to the open gear popover's needed height so its upward-opening
    // popup + user-search menu aren't clipped inside a short (content-sized)
    // iframe. Reverts to content height when the popover closes.
    const height = Math.max(contentHeight, gearChromeHeightRef.current ?? 0);
    try {
      window.parent.postMessage({ type: 'resize', height }, '*');
    } catch {
      /* cross-origin parent — ignore */
    }
  }, []);

  const contentCardRef = useCallback(
    (node: HTMLDivElement | null) => {
      contentNodeRef.current = node;
      const embedded =
        typeof window !== 'undefined' && window.parent && window.parent !== window;

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
    [postHeight],
  );

  // Re-post whenever the gear popover's needed height changes so the iframe
  // grows to fit the open popover (and shrinks back on close). Keep the ref
  // mirror in sync for the ResizeObserver callback's benefit.
  useEffect(() => {
    gearChromeHeightRef.current = gearChromeHeight;
    postHeight();
  }, [gearChromeHeight, postHeight]);

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
        onChromeHeightChange={setGearChromeHeight}
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
