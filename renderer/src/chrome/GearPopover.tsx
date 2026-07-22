/**
 * GearPopover — the forge-sim dev settings popover (bottom-right gear).
 *
 * Holds the mode-aware "Acting as" user switcher (Atlaskit AsyncSelect),
 * color-mode toggle, and preview-width presets. Extracted from ForgeSimShell
 * so it can be rendered by BOTH surfaces:
 *   - Top-level standard surfaces → ForgeSimShell renders it directly.
 *   - Nested surfaces (macro / custom-field / workflow) → the top-level
 *     ForgeSimModulePage renders it, so `position:fixed` pins to the real
 *     browser viewport instead of a child iframe's viewport.
 *
 * It is pure chrome: all state lives in the parent, wired through callbacks.
 */

import React, { useState, useEffect, useRef } from 'react';
import Avatar from '@atlaskit/avatar';
import { AsyncSelect } from '@atlaskit/select';
import {
  WIDTH_PRESETS,
  WidthPresetKey,
  WidthPref,
  ColorMode,
  ResolvedColorMode,
  ActingUserOption,
  ActingUserState,
  defaultPresetForModuleType,
  toUserOption,
} from './prefs';

/** Avatar + name + subtitle (role or email) for a select option / value. */
export function formatUserOption(option: { label: string; user?: ActingUserOption }) {
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
// Gear popover UI — acting user + color mode + width
//
// Colors use Atlassian design tokens via CSS custom properties so the chrome
// itself responds to the selected color mode (the same mechanism Atlaskit
// components use under the hood).
// ---------------------------------------------------------------------------

export interface GearPopoverProps {
  pref: WidthPref;
  moduleType: string | undefined;
  colorMode: ColorMode;
  resolvedColorMode: ResolvedColorMode;
  switcher: ActingUserState | null;
  onWidthChange: (next: WidthPref) => void;
  onColorModeChange: (next: ColorMode) => void;
  onSearchUsers: (query: string) => Promise<ActingUserOption[]>;
  onActingUserChange: (user: ActingUserOption | null) => void;
}

export function GearPopover({
  pref,
  moduleType,
  colorMode,
  resolvedColorMode,
  switcher,
  onWidthChange,
  onColorModeChange,
  onSearchUsers,
  onActingUserChange,
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
