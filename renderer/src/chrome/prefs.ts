/**
 * Shared dev-chrome preferences — width presets, color mode, acting-user.
 *
 * These pure types / constants / localStorage helpers are used by BOTH the
 * in-iframe shell (ForgeSimShell) and the top-level combined module page
 * (ForgeSimModulePage). They deliberately contain no JSX so either surface can
 * import them without pulling in Atlaskit render dependencies.
 *
 * localStorage is the cross-frame sync channel: the parent page owns the gear
 * chrome, but the embedded content iframe reads the same keys (color mode,
 * width) so both realms stay in agreement via `storage` events.
 */

// ---------------------------------------------------------------------------
// Width presets — mirror the real widths Forge uses across product surfaces.
// Numbers are informed by actual Jira/Confluence page chrome observations.
// ---------------------------------------------------------------------------

export type WidthPresetKey = 'narrow' | 'standard' | 'wide' | 'full' | 'custom';

export interface WidthPreset {
  key: WidthPresetKey;
  label: string;
  description: string;
  /** Pixel width; null means 100% (minus page padding) */
  px: number | null;
}

export const WIDTH_PRESETS: Record<WidthPresetKey, WidthPreset> = {
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

export const MODULE_TYPE_DEFAULTS: Record<string, WidthPresetKey> = {
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

export function defaultPresetForModuleType(moduleType: string | undefined): WidthPresetKey {
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

export type ColorMode = 'light' | 'dark' | 'auto';
export type ResolvedColorMode = 'light' | 'dark';

export const COLOR_MODE_STORAGE_KEY = 'forge-sim:colorMode';

export function readStoredColorMode(): ColorMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const raw = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'auto') return raw;
  } catch {
    /* ignore */
  }
  return 'light';
}

export function writeStoredColorMode(mode: ColorMode) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function prefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveColorMode(mode: ColorMode): ResolvedColorMode {
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
export interface ActingUserOption {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  avatarUrl?: string;
  /** Seeded-roster only; absent for real picked users. */
  role?: string;
}

/** The `getActingUserState` RPC payload. */
export interface ActingUserState {
  mode: 'connected' | 'offline';
  current: ActingUserOption | null;
  /** Seeded roster (offline) or [] (connected — search is live). */
  users: ActingUserOption[];
  /** The site backing the live search (connected only). */
  site: string | null;
}

export const ACTING_AS_STORAGE_KEY = 'forge-sim:actingAs';

export function readStoredActingAs(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ACTING_AS_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeStoredActingAs(accountId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ACTING_AS_STORAGE_KEY, accountId);
  } catch {
    /* ignore */
  }
}

export function clearStoredActingAs() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ACTING_AS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Map an acting-user to the `{ label, value, user }` shape AsyncSelect wants. */
export function toUserOption(u: ActingUserOption) {
  return { label: u.displayName, value: u.accountId, user: u };
}

// ---------------------------------------------------------------------------
// Persistence — width
// ---------------------------------------------------------------------------

export interface WidthPref {
  preset: WidthPresetKey;
  customPx?: number;
}

export const STORAGE_KEY_PREFIX = 'forge-sim:width:';

export function readStoredPref(moduleKey: string | undefined): WidthPref | null {
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

export function writeStoredPref(moduleKey: string | undefined, pref: WidthPref) {
  if (typeof window === 'undefined') return;
  try {
    const key = STORAGE_KEY_PREFIX + (moduleKey ?? '__default__');
    window.localStorage.setItem(key, JSON.stringify(pref));
  } catch {
    /* ignore */
  }
}
