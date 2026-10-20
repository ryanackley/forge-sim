/**
 * View-event stream — the sim-side observation channel for view.submit(),
 * view.close() and view.refresh().
 *
 * Emitter: the headless BridgeHost (src/bridge/hosts/headless.ts) when the
 * app's @forge/bridge sends the corresponding frame. Listener: SimulatorUI,
 * which fans the stream out to sim.ui.onSubmit/onClose/onRefresh tagged with
 * the active module key.
 *
 * The store lives on globalThis rather than in module state on purpose: the
 * emitter and the listener can be loaded as two module copies (a compiled
 * shim under dist/ next to the src/ copy vitest runs, or an alias-resolved
 * module next to a relative import). One shared store keeps them one stream.
 */

export type ViewEventType = 'submit' | 'close' | 'refresh';
export type ViewEventListener = (event: ViewEventType, payload: any) => void;

const viewEventStore = ((globalThis as any).__forgeSimViewEvents ??= {
  listeners: [] as ViewEventListener[],
}) as { listeners: ViewEventListener[] };

/** Fire a view event to every registered listener. Listener errors are swallowed. */
export function emitViewEvent(event: ViewEventType, payload: any): void {
  for (const fn of viewEventStore.listeners) {
    try { fn(event, payload); } catch {}
  }
}

/**
 * Register a listener for view events. Returns an unbind function.
 * @internal — used by SimulatorUI to wire onSubmit/onClose/onRefresh.
 */
export function onViewEvent(listener: ViewEventListener): () => void {
  viewEventStore.listeners.push(listener);
  return () => {
    const idx = viewEventStore.listeners.indexOf(listener);
    if (idx >= 0) viewEventStore.listeners.splice(idx, 1);
  };
}

/** Clear all view event listeners. @internal */
export function resetViewEvents(): void {
  viewEventStore.listeners.length = 0;
}
