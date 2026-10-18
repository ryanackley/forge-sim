/**
 * showFlag / closeFlag — the host-drawn toast real Forge renders outside the
 * app iframe. We draw it inside the frame, bottom-left, matching what the
 * UI Kit renderer shim drew before the hosts were unified.
 *
 * Re-showing an id replaces the existing flag rather than stacking a
 * duplicate, and a flag auto-dismisses after 5s unless isAutoDismiss is
 * explicitly false — both match the previous behaviour that the
 * eval7-f7-bridge-showflag tests pin.
 */

const COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  info: { bg: '#DEEBFF', border: '#0052CC', icon: 'ℹ️' },
  success: { bg: '#E3FCEF', border: '#00875A', icon: '✅' },
  warning: { bg: '#FFFAE6', border: '#FF8B00', icon: '⚠️' },
  error: { bg: '#FFEBE6', border: '#DE350B', icon: '❌' },
};

const AUTO_DISMISS_MS = 5_000;

function applyStyles(el: HTMLElement, styles: Record<string, string>): void {
  for (const k of Object.keys(styles)) (el.style as any)[k] = styles[k];
}

export interface FlagSurface {
  show(options: Record<string, any>): void;
  close(id: unknown): boolean;
}

export function createFlagSurface(): FlagSurface {
  const open = new Map<string, HTMLElement>();

  function container(): HTMLElement {
    const existing = document.getElementById('forge-sim-flag-container');
    if (existing) return existing;
    const c = document.createElement('div');
    c.id = 'forge-sim-flag-container';
    c.setAttribute('data-testid', 'forge-sim-flag-container');
    applyStyles(c, {
      position: 'fixed', bottom: '24px', left: '24px',
      display: 'flex', flexDirection: 'column-reverse', gap: '8px',
      zIndex: '1100', maxWidth: '400px',
    });
    document.body.appendChild(c);
    return c;
  }

  function close(id: unknown): boolean {
    if (id === undefined || id === null) return false;
    const key = String(id);
    const el = open.get(key);
    if (!el) return false;
    open.delete(key);
    el.style.opacity = '0';
    el.style.transform = 'translateX(-20px)';
    setTimeout(() => { el.parentNode?.removeChild(el); }, 200);
    return true;
  }

  return {
    close,
    show(options) {
      const type = options.appearance ?? options.type ?? 'info';
      const colors = COLORS[type] ?? COLORS.info;
      if (options.id !== undefined) close(options.id);

      const flag = document.createElement('div');
      flag.setAttribute('data-testid', 'forge-sim-flag');
      applyStyles(flag, {
        background: colors.bg, borderLeft: `3px solid ${colors.border}`,
        borderRadius: '4px', padding: '12px 16px',
        boxShadow: '0 1px 1px rgba(9,30,66,0.25), 0 0 1px rgba(9,30,66,0.31)',
        fontFamily: '-apple-system, BlinkMacSystemFont, Roboto, sans-serif',
        fontSize: '14px', color: '#172B4D',
        transition: 'opacity 0.2s, transform 0.2s',
      });

      if (options.title) {
        const title = document.createElement('div');
        title.style.fontWeight = '600';
        title.textContent = `${colors.icon} ${options.title}`;
        flag.appendChild(title);
      }
      if (options.description) {
        const desc = document.createElement('div');
        applyStyles(desc, { marginTop: '4px', color: '#6B778C' });
        desc.textContent = options.description;
        flag.appendChild(desc);
      }
      if (Array.isArray(options.actions) && options.actions.length) {
        const actions = document.createElement('div');
        applyStyles(actions, { marginTop: '8px', display: 'flex', gap: '8px' });
        for (const action of options.actions) {
          const btn = document.createElement('button');
          applyStyles(btn, {
            background: 'none', border: 'none', color: colors.border,
            cursor: 'pointer', fontWeight: '600', fontSize: '13px', padding: '0',
          });
          btn.textContent = action?.text ?? '';
          // Same-realm bridge: onClick arrives as a live function reference.
          if (typeof action?.onClick === 'function') btn.addEventListener('click', action.onClick);
          actions.appendChild(btn);
        }
        flag.appendChild(actions);
      }

      container().appendChild(flag);
      const key = options.id !== undefined ? String(options.id) : undefined;
      if (key !== undefined) open.set(key, flag);

      if (options.isAutoDismiss !== false) {
        setTimeout(() => {
          if (key !== undefined && open.get(key) === flag) close(key);
          else if (key === undefined) flag.parentNode?.removeChild(flag);
        }, AUTO_DISMISS_MS);
      }
    },
  };
}
