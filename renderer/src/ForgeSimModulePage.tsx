/**
 * ForgeSimModulePage — the top-level parent page for NESTED dev surfaces
 * (Confluence macros, Jira custom fields, workflow validators / conditions /
 * post-functions).
 *
 * Background: standard surfaces (jira:issuePanel, jira:globalPage, ...) render
 * ForgeSimShell as the top-level document, so its fixed gear popover + render
 * badge pin to the real browser viewport. Nested surfaces need per-mode JS-realm
 * isolation (a macro's View and Config are two separate renders into a single
 * per-realm bridge singleton, exactly like real Forge's separate sandboxed
 * iframes), so each mode renders in its own CHILD content iframe.
 *
 * Previously the parent wrapper was hand-rolled vanilla HTML. That meant the
 * gear + badge lived INSIDE a child iframe, where `position:fixed` pins to the
 * child's viewport, not the browser's — so once the iframe grew past the window
 * the gear dropped off-screen and the upward-opening popover clipped.
 *
 * This component replaces the three vanilla generators with a single Atlaskit
 * React document. Because it is the top-level page, its gear + badge pin to the
 * real viewport again and the popover / upward AsyncSelect menu escape freely.
 * The content still renders in per-mode child iframes (unchanged, parity-correct),
 * each sized to content via the existing `{ type:'resize', height }` postMessage.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AppProvider, { useSetColorMode } from '@atlaskit/app-provider';
import '@atlaskit/css-reset';
import Lozenge from '@atlaskit/lozenge';
import Button from '@atlaskit/button/new';
import SectionMessage from '@atlaskit/section-message';
import { GearPopover } from './chrome/GearPopover';
import { rpc } from './bridge/forge-bridge-shim';
import {
  WidthPref,
  ColorMode,
  ResolvedColorMode,
  ActingUserOption,
  ActingUserState,
  WIDTH_PRESETS,
  COLOR_MODE_STORAGE_KEY,
  readStoredColorMode,
  writeStoredColorMode,
  resolveColorMode,
  writeStoredActingAs,
  clearStoredActingAs,
  readStoredPref,
  writeStoredPref,
} from './chrome/prefs';

// ---------------------------------------------------------------------------
// Props + per-surface metadata
// ---------------------------------------------------------------------------

export interface ModulePageMode {
  /** URL/key suffix: 'view' | 'config' | 'edit' | 'create'. */
  mode: string;
  /** Human tab label: 'View' | 'Config' | 'Edit' | 'Create'. */
  label: string;
}

export type ModuleSurface = 'macro' | 'customField' | 'workflow';

export interface ForgeSimModulePageProps {
  /** The combined-page module key (no `--mode` suffix). */
  baseKey: string;
  /** Friendly module title shown as the subtitle. */
  title: string;
  surface: ModuleSurface;
  /** Ordered modes; modes[0] loads immediately, the rest are deferred. */
  modes: ModulePageMode[];
  /** Dev-server WS port for macro/customField reload-on-update. */
  wsPort: number;
  /** Custom-field data type, shown as a secondary badge (custom fields only). */
  fieldType?: string;
  /** Workflow badge label override (e.g. "Workflow Validator"). */
  badgeLabel?: string;
  /** Parity warnings surfaced above the content. */
  warnings?: string[];
}

type LozengeAppearance = 'success' | 'new' | 'removed' | 'default';

interface SurfaceMeta {
  badge: string;
  appearance: LozengeAppearance;
  /** Which mode's iframe receives the Save submit; null → no Save. */
  submitMode: string | null;
  /** WS message type that triggers a view reload; null → no reload. */
  wsType: string | null;
  /** WS message field carrying the base key. */
  wsKeyField: string | null;
  warningTitle: string;
}

function surfaceMetaFor(props: ForgeSimModulePageProps): SurfaceMeta {
  switch (props.surface) {
    case 'macro':
      return {
        badge: props.badgeLabel ?? 'Macro',
        appearance: 'success',
        submitMode: 'config',
        wsType: 'macroConfigUpdate',
        wsKeyField: 'macroKey',
        warningTitle: 'Parity Note',
      };
    case 'customField':
      return {
        badge: props.badgeLabel ?? 'Custom Field',
        appearance: 'new',
        submitMode: 'edit',
        wsType: 'fieldValueUpdate',
        wsKeyField: 'fieldKey',
        warningTitle: 'Parity Warning',
      };
    case 'workflow':
    default:
      return {
        badge: props.badgeLabel ?? 'Workflow',
        appearance: 'removed',
        submitMode: null,
        wsType: null,
        wsKeyField: null,
        warningTitle: 'Parity Note',
      };
  }
}

// ---------------------------------------------------------------------------
// Outer — owns the AppProvider mount (initial theme from stored pref).
// ---------------------------------------------------------------------------

export function ForgeSimModulePage(props: ForgeSimModulePageProps) {
  const initialColorMode = useMemo<ColorMode>(() => readStoredColorMode(), []);
  return (
    <AppProvider defaultColorMode={initialColorMode}>
      <ModulePageInner {...props} initialColorMode={initialColorMode} />
    </AppProvider>
  );
}

interface ModulePageInnerProps extends ForgeSimModulePageProps {
  initialColorMode: ColorMode;
}

function ModulePageInner({
  baseKey,
  title,
  surface,
  modes,
  wsPort,
  fieldType,
  badgeLabel,
  warnings,
  initialColorMode,
}: ModulePageInnerProps) {
  const meta = useMemo(
    () => surfaceMetaFor({ baseKey, title, surface, modes, wsPort, fieldType, badgeLabel, warnings }),
    [baseKey, title, surface, modes, wsPort, fieldType, badgeLabel, warnings],
  );

  const firstMode = modes[0]?.mode;
  const [activeMode, setActiveMode] = useState<string>(firstMode);

  // Per-mode render counts, mirrored up from each content iframe. The badge
  // shows the visible mode's count.
  const [renderCounts, setRenderCounts] = useState<Record<string, number>>({});

  // mode → iframe element. Populated during render (refs) before effects run,
  // so the mount effect can drive src / deferred-load / WS reload imperatively
  // without React fighting a controlled `src` attribute.
  const frameRefs = useRef<Record<string, HTMLIFrameElement | null>>({});

  const srcFor = useCallback((mode: string) => `/module/${baseKey}--${mode}/`, [baseKey]);

  const modeForSource = useCallback(
    (source: unknown): string | undefined => {
      for (const m of modes) {
        const f = frameRefs.current[m.mode];
        if (f && f.contentWindow === source) return m.mode;
      }
      return undefined;
    },
    [modes],
  );

  // Imperative iframe lifecycle: immediate first load, deferred rest (dodges
  // Vite's dep-optimizer race on cold boot), content resize, render-count
  // mirroring, and macro/custom-field reload-on-update over WS.
  useEffect(() => {
    if (!firstMode) return;
    const frames = frameRefs.current;

    // 1. Load the first mode immediately.
    const firstFrame = frames[firstMode];
    if (firstFrame && !firstFrame.src) firstFrame.src = srcFor(firstMode);

    // 2. Deferred load of the remaining modes once the first frame is up, so
    //    the initial Atlaskit dep-optimize isn't racing multiple parallel
    //    imports of the same ~1200-module tree.
    const loadDeferred = () => {
      for (const m of modes.slice(1)) {
        const f = frames[m.mode];
        if (f && !f.src) f.src = srcFor(m.mode);
      }
    };
    if (firstFrame) {
      firstFrame.addEventListener('load', loadDeferred, { once: true });
    }

    // 3. Content iframe messages: resize (grow the frame to fit) + render count.
    const onMessage = (e: MessageEvent) => {
      const data = e.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'resize' && typeof data.height === 'number') {
        const mode = modeForSource(e.source);
        if (mode) {
          const f = frames[mode];
          if (f) f.style.height = `${data.height}px`;
        }
        return;
      }
      if (data.type === 'forge-sim:renderCount' && typeof data.count === 'number') {
        const mode = modeForSource(e.source);
        if (mode) {
          setRenderCounts((prev) =>
            prev[mode] === data.count ? prev : { ...prev, [mode]: data.count },
          );
        }
      }
    };
    window.addEventListener('message', onMessage);

    // 4. Reload-on-update (macro Config Save / custom-field Edit submit). The
    //    dev server broadcasts after storing the new config/value; we switch to
    //    View and reload the view iframe so useConfig() picks up fresh data.
    let ws: WebSocket | undefined;
    if (meta.wsType && meta.wsKeyField) {
      try {
        ws = new WebSocket(`ws://localhost:${wsPort}`);
        ws.onmessage = (evt) => {
          let msg: any;
          try {
            msg = JSON.parse(evt.data);
          } catch {
            return;
          }
          if (msg && msg.type === meta.wsType && msg[meta.wsKeyField!] === baseKey) {
            setActiveMode('view');
            const viewFrame = frames['view'];
            if (viewFrame && viewFrame.src) viewFrame.src = viewFrame.src; // reload
          }
        };
      } catch {
        /* no dev server socket — ignore */
      }
    }

    return () => {
      window.removeEventListener('message', onMessage);
      if (firstFrame) firstFrame.removeEventListener('load', loadDeferred);
      if (ws) {
        ws.onmessage = null;
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      }
    };
    // Mount-once: the iframe set and WS wiring are stable for the page's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------------
  // Gear chrome state — color mode, width, acting-user switcher.
  // Mirrors ShellInner, minus the content-rendering concerns.
  // -------------------------------------------------------------------------

  const setAtlaskitColorMode = useSetColorMode();
  const [colorMode, setColorMode] = useState<ColorMode>(initialColorMode);
  const [resolvedColorMode, setResolvedColorMode] = useState<ResolvedColorMode>(() =>
    resolveColorMode(initialColorMode),
  );

  // Honor the color-mode setter at boot (MEMORY rule) so the parent + its child
  // iframes agree even before the first user change.
  useEffect(() => {
    setAtlaskitColorMode(initialColorMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleColorModeChange = (next: ColorMode) => {
    setColorMode(next);
    // Writing the shared localStorage key fires a cross-frame `storage` event
    // in each content iframe, whose embedded shell flips its own theme live.
    writeStoredColorMode(next);
    setAtlaskitColorMode(next);
  };

  // Width — the parent constrains the iframe container; the embedded shell
  // returns '100%' so it never double-constrains.
  const [pref, setPref] = useState<WidthPref>(() => {
    const stored = readStoredPref(baseKey);
    return stored ?? { preset: 'standard' };
  });

  const handlePrefChange = (next: WidthPref) => {
    setPref(next);
    writeStoredPref(baseKey, next);
  };

  const effectiveMaxWidth = useMemo<string>(() => {
    const preset = WIDTH_PRESETS[pref.preset];
    if (pref.preset === 'full') return '100%';
    if (pref.preset === 'custom') return `${pref.customPx ?? 900}px`;
    return preset.px ? `${preset.px}px` : '100%';
  }, [pref]);

  // Acting-user switcher.
  const [switcher, setSwitcher] = useState<ActingUserState | null>(null);
  useEffect(() => {
    let cancelled = false;
    rpc('getActingUserState')
      .then((res: ActingUserState) => {
        if (cancelled || !res) return;
        setSwitcher(res);
      })
      .catch(() => {
        /* no dev server — leave switcher null (hides the section) */
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
    setSwitcher((prev) => (prev ? { ...prev, current: user } : prev));
    try {
      await rpc('setActingUser', user ? { user } : {});
    } catch {
      /* ignore — reload resyncs from the server */
    }
    if (typeof window !== 'undefined') window.location.reload();
  };

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const handleSave = () => {
    if (!meta.submitMode) return;
    const f = frameRefs.current[meta.submitMode];
    if (f?.contentWindow) {
      f.contentWindow.postMessage({ type: 'forge-sim-trigger-submit' }, '*');
    }
  };

  const hasSubmitMode = !!meta.submitMode && modes.some((m) => m.mode === meta.submitMode);
  const hasViewMode = modes.some((m) => m.mode === 'view');
  const showSave = hasSubmitMode && hasViewMode && activeMode === meta.submitMode;

  const activeRenderCount = renderCounts[activeMode] ?? 0;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      data-forge-sim-module-page
      style={{
        minHeight: '100vh',
        background: 'var(--ds-surface, #f4f5f7)',
        color: 'var(--ds-text, #172b4d)',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        transition: 'background 120ms ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 24px 0',
          maxWidth: '1280px',
          margin: '0 auto',
        }}
      >
        <a
          href="/"
          style={{
            display: 'inline-block',
            marginBottom: '12px',
            color: 'var(--ds-link, #0052cc)',
            textDecoration: 'none',
            fontSize: '13px',
          }}
        >
          ← Back to modules
        </a>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '18px', fontWeight: 600 }}>{baseKey}</span>
          <Lozenge appearance={meta.appearance}>{meta.badge}</Lozenge>
          {fieldType && <Lozenge appearance="default">{fieldType}</Lozenge>}
        </div>
        {title && title !== baseKey && (
          <div style={{ fontSize: '13px', color: 'var(--ds-text-subtle, #6b778c)', marginTop: '4px' }}>
            {title}
          </div>
        )}

        {warnings && warnings.length > 0 && (
          <div style={{ marginTop: '12px' }}>
            <SectionMessage appearance="warning" title={meta.warningTitle}>
              {warnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </SectionMessage>
          </div>
        )}

        {/* Mode tabs + Save */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '16px',
            borderBottom: '2px solid var(--ds-border, #dfe1e6)',
          }}
        >
          {modes.map((m) => {
            const isActive = m.mode === activeMode;
            return (
              <button
                key={m.mode}
                type="button"
                onClick={() => setActiveMode(m.mode)}
                aria-pressed={isActive}
                style={{
                  appearance: 'none',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: '8px 12px',
                  marginBottom: '-2px',
                  fontSize: '14px',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--ds-text, #172b4d)' : 'var(--ds-text-subtle, #6b778c)',
                  borderBottom: isActive
                    ? '2px solid var(--ds-border-selected, #0052cc)'
                    : '2px solid transparent',
                }}
              >
                {m.label}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          {showSave && (
            <div style={{ paddingBottom: '6px' }}>
              <Button appearance="primary" onClick={handleSave}>
                Save
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Content — per-mode child iframes, all mounted, toggled via display. */}
      <div style={{ maxWidth: effectiveMaxWidth, margin: '0 auto', padding: '0 24px 24px' }}>
        {modes.map((m) => (
          <iframe
            key={m.mode}
            title={`${baseKey} (${m.label})`}
            ref={(el) => {
              frameRefs.current[m.mode] = el;
            }}
            style={{
              display: m.mode === activeMode ? 'block' : 'none',
              width: '100%',
              border: 'none',
              minHeight: '200px',
            }}
          />
        ))}
      </div>

      {/* Top-level fixed dev chrome — pins to the real browser viewport. */}
      <GearPopover
        pref={pref}
        moduleType={undefined}
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
          zIndex: 9999,
        }}
      >
        🔥 renders: {activeRenderCount}
      </div>
    </div>
  );
}
