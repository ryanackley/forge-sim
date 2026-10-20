/**
 * In-memory history — the object `view.createHistory()` resolves when the
 * URL must not move. Shared by the browser host (UI Kit pages, whose module
 * key lives in the URL path) and the Node-side `@forge/bridge` shim.
 *
 * No DOM, no Node: this file is reached from the browser bundle
 * (tsconfig.bridge-browser.json) and from the root build alike.
 *
 * Parity note: real Forge's bridge history uses the history v4 runtime
 * contract — `listen((location, action) => void)`, NOT v5's
 * `listen(({ action, location }))` — and `goBack()`/`goForward()`. Source of
 * truth: the createHistory signature in the official view docs, and the
 * @ts-ignore in @forge/react's Router ("the history object returned by the
 * bridge does not conform to the v5 types. Instead it uses v4 types").
 * @forge/bridge's own createHistory wrapper and @forge/react/router both
 * destructure the first listener arg as the location, so a v5-style notify
 * breaks Route matching after every navigation.
 *
 * The v5 names (back/forward) are provided too: @forge/bridge's .d.ts types
 * the return as history v5's `History`, so TS apps are told those exist.
 */

export type HistoryLocation = {
  pathname: string;
  search: string;
  hash: string;
  state: unknown;
  key: string;
};
export type HistoryListener = (location: HistoryLocation, action: string) => void;
export type HistoryBlocker = (tx: { action: string; location: HistoryLocation; retry: () => void }) => void;

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

function createLocation(to: string | Record<string, any>, state?: unknown): HistoryLocation {
  const parsed = parsePath(to);
  return {
    pathname: parsed.pathname || '/',
    search: parsed.search || '',
    hash: parsed.hash || '',
    state: state === undefined ? null : state,
    key: Math.random().toString(36).slice(2, 10),
  };
}

export function createMemoryHistory(): Record<string, any> {
  const entries: HistoryLocation[] = [{ pathname: '/', search: '', hash: '', state: null, key: 'default' }];
  let index = 0;
  let listeners: HistoryListener[] = [];
  let blockers: HistoryBlocker[] = [];

  const notify = (action: string) => {
    const location = entries[index];
    for (const fn of listeners) {
      try { fn(location, action); } catch (e) { console.error(e); }
    }
  };

  const history: Record<string, any> = {
    get action() { return 'POP'; },
    get location() { return entries[index]; },
    set location(_loc: HistoryLocation) { /* assigned by @forge/bridge's wrapper; getter is live */ },

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
    // v4 names (the documented Forge contract)
    goBack(): void { history.go(-1); },
    goForward(): void { history.go(1); },
    // v5 names (what @forge/bridge's .d.ts promises)
    back(): void { history.go(-1); },
    forward(): void { history.go(1); },
    listen(fn: HistoryListener): () => void {
      listeners.push(fn);
      return () => { listeners = listeners.filter((l) => l !== fn); };
    },
    block(fn: HistoryBlocker): () => void {
      blockers.push(fn);
      return () => { blockers = blockers.filter((b) => b !== fn); };
    },
  };
  return history;
}
