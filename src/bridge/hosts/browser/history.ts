/**
 * createHistory — the browser-history object Custom UI routing expects.
 *
 * Parity note carried over from the inline script it replaces: real Forge's
 * bridge history uses the history v4 listener signature `(location, action)`,
 * NOT v5's `({ action, location })`. @forge/react's Router and
 * @forge/bridge's createHistory wrapper both destructure the first argument
 * as the location, so a v5-style notify breaks Route matching after a
 * navigation. Both the v4 names (goBack/goForward) and the v5 names
 * (back/forward) are provided because the .d.ts promises the latter.
 */

type Loc = { pathname: string; search: string; hash: string; state: unknown; key: string };
type Listener = (location: Loc, action: string) => void;
type Blocker = (tx: { action: string; location: Loc; retry: () => void }) => void;

function parsePath(path: string | Record<string, any>): { pathname: string; search: string; hash: string } {
  if (typeof path === 'object' && path !== null) {
    return { pathname: path.pathname || '/', search: path.search || '', hash: path.hash || '' };
  }
  let p = String(path || '/');
  let search = '';
  let hash = '';
  const hashIdx = p.indexOf('#');
  if (hashIdx >= 0) { hash = p.slice(hashIdx); p = p.slice(0, hashIdx); }
  const searchIdx = p.indexOf('?');
  if (searchIdx >= 0) { search = p.slice(searchIdx); p = p.slice(0, searchIdx); }
  return { pathname: p, search, hash };
}

function createLocation(to: string | Record<string, any>, state?: unknown): Loc {
  const parsed = parsePath(to);
  return {
    pathname: parsed.pathname || '/',
    search: parsed.search || '',
    hash: parsed.hash || '',
    state: state === undefined ? null : state,
    key: Math.random().toString(36).slice(2, 10),
  };
}

function currentLocation(): Loc {
  const state = window.history.state;
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    state,
    key: (state && state.__key) || 'default',
  };
}

export function createBrowserHistory(): Record<string, any> {
  let listeners: Listener[] = [];
  let blockers: Blocker[] = [];

  const notify = (loc: Loc, action: string) => {
    for (const fn of listeners) {
      try { fn(loc, action); } catch (e) { console.error(e); }
    }
  };

  const stateFor = (loc: Loc, state: unknown): unknown => {
    if (state && typeof state === 'object') return { ...(state as object), __key: loc.key };
    return { __key: loc.key };
  };

  const history: Record<string, any> = {
    action: 'POP',
    location: currentLocation(),
    createHref(to: string | Record<string, any>): string {
      if (typeof to === 'string') return to;
      return (to.pathname || '') + (to.search || '') + (to.hash || '');
    },
    push(to: string | Record<string, any>, state?: unknown): void {
      const loc = createLocation(to, state);
      for (const block of blockers) {
        block({ action: 'PUSH', location: loc, retry: () => history.push(to, state) });
        return; // a blocker owns the decision; it retries if it wants the nav
      }
      window.history.pushState(stateFor(loc, state), '', history.createHref(loc));
      history.action = 'PUSH';
      history.location = loc;
      notify(loc, 'PUSH');
    },
    replace(to: string | Record<string, any>, state?: unknown): void {
      const loc = createLocation(to, state);
      for (const block of blockers) {
        block({ action: 'REPLACE', location: loc, retry: () => history.replace(to, state) });
        return;
      }
      window.history.replaceState(stateFor(loc, state), '', history.createHref(loc));
      history.action = 'REPLACE';
      history.location = loc;
      notify(loc, 'REPLACE');
    },
    go(delta: number): void { window.history.go(delta); },
    goBack(): void { window.history.go(-1); },
    goForward(): void { window.history.go(1); },
    back(): void { window.history.go(-1); },
    forward(): void { window.history.go(1); },
    listen(fn: Listener): () => void {
      listeners.push(fn);
      return () => { listeners = listeners.filter((l) => l !== fn); };
    },
    block(fn: Blocker): () => void {
      blockers.push(fn);
      return () => { blockers = blockers.filter((b) => b !== fn); };
    },
  };

  window.addEventListener('popstate', () => {
    history.action = 'POP';
    history.location = currentLocation();
    notify(history.location, 'POP');
  });

  return history;
}

// ── Memory history ─────────────────────────────────────────────────────
//
// UI Kit modules are served at /module/<key>/ and the bridge reads the
// module key back out of that path for every invoke and getContext. A
// browser-backed history would pushState('/settings') and take the key with
// it. So UI Kit pages get an in-memory history: @forge/react's Router and
// useNavigate work, the URL does not move. Custom UI keeps browser history
// (its SPA fallback serves index.html under /module/<key>/<route>).

export function createMemoryHistory(): Record<string, any> {
  const entries: Loc[] = [{ pathname: '/', search: '', hash: '', state: null, key: 'default' }];
  let index = 0;
  let listeners: Listener[] = [];
  let blockers: Blocker[] = [];

  const notify = (action: string) => {
    const location = entries[index];
    for (const fn of listeners) {
      try { fn(location, action); } catch (e) { console.error(e); }
    }
  };

  const history: Record<string, any> = {
    get action() { return 'POP'; },
    get location() { return entries[index]; },
    set location(_loc: Loc) { /* assigned by @forge/bridge's wrapper; getter is live */ },

    createHref(to: string | Record<string, any>): string {
      if (typeof to === 'string') return to;
      return (to.pathname || '') + (to.search || '') + (to.hash || '');
    },
    push(to: string | Record<string, any>, state?: unknown): void {
      const loc = createLocation(to, state);
      if (blockers.length > 0) {
        blockers[0]({ action: 'PUSH', location: loc, retry: () => history.push(to, state) });
        return;
      }
      entries.splice(index + 1); // drop the forward stack
      entries.push(loc);
      index = entries.length - 1;
      notify('PUSH');
    },
    replace(to: string | Record<string, any>, state?: unknown): void {
      const loc = createLocation(to, state);
      if (blockers.length > 0) {
        blockers[0]({ action: 'REPLACE', location: loc, retry: () => history.replace(to, state) });
        return;
      }
      entries[index] = loc;
      notify('REPLACE');
    },
    go(delta: number): void {
      const next = Math.max(0, Math.min(entries.length - 1, index + delta));
      if (next === index) return;
      index = next;
      notify('POP');
    },
    goBack(): void { history.go(-1); },
    goForward(): void { history.go(1); },
    back(): void { history.go(-1); },
    forward(): void { history.go(1); },
    listen(fn: Listener): () => void {
      listeners.push(fn);
      return () => { listeners = listeners.filter((l) => l !== fn); };
    },
    block(fn: Blocker): () => void {
      blockers.push(fn);
      return () => { blockers = blockers.filter((b) => b !== fn); };
    },
  };
  return history;
}
