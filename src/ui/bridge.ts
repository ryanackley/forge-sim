/**
 * Forge Bridge — the HEADLESS host of `window.__bridge`.
 *
 * @forge/react and @forge/bridge talk to the host through
 * globalThis.__bridge.callBridge(). The protocol — which commands exist, what
 * each frame looks like, which typed BridgeHost method answers it — lives in
 * src/bridge/protocol. The headless host that answers against a
 * ForgeSimulator in process lives in src/bridge/hosts/headless.ts.
 *
 * This module owns what is specific to the render lifecycle and the test API:
 * ForgeDoc capture and waiters, raw-HTML rejection (UIK-003), the forge
 * context, and the
 * Node-vs-browser shims a prebuilt bundle needs (document stub, relative
 * Request base, page-relative __LOCALES__ fetch).
 *
 * Must be set up BEFORE any @forge/react or @forge/bridge imports.
 */

import type { ForgeSimulator } from '../simulator.js';
import { isRawHtmlType } from './html-elements.js';
import { warnOnForgeReactMajorMismatch } from '../forge-package-versions.js';
import { createBridgeDispatcher, normalizeBridgeHeaders } from '../bridge/protocol/index.js';
import { createHeadlessHost, type HeadlessHost } from '../bridge/hosts/headless.js';

// Re-exported for dev-server.ts, which normalizes the same frames over RPC.
export { normalizeBridgeHeaders };

// ── Types ───────────────────────────────────────────────────────────────

export interface ForgeDoc {
  type: string;
  props: Record<string, any>;
  children: ForgeDoc[];
  key: string;
  forgeReactMajorVersion?: number;
}

export interface BridgeCall {
  cmd: string;
  data: any;
  timestamp: number;
}

import type { ForgeContext } from '../context.js';

// ── State ───────────────────────────────────────────────────────────────

interface RenderWaiter {
  resolve: (doc: ForgeDoc) => void;
  reject: (err: Error) => void;
}

let simulator: ForgeSimulator | null = null;
let latestForgeDoc: ForgeDoc | null = null;
let renderResolvers: RenderWaiter[] = [];
let renderListeners: Array<(doc: ForgeDoc) => void> = [];
// Macro inline config — second tree emitted by ForgeReconciler.addConfig().
// Tracked separately from the main view tree so headless tests can render
// both without confusion.
let latestMacroConfigDoc: ForgeDoc | null = null;
let macroConfigRenderResolvers: RenderWaiter[] = [];
let macroConfigRenderListeners: Array<(doc: ForgeDoc) => void> = [];
// Set when a reconcile is rejected (raw HTML, UIK-003). Cleared by the next
// successful reconcile. simulator-ui.render() consumes this to throw even
// when its waitForRender promise wasn't directly awaited (N9 race paths).
let latestRenderError: Error | null = null;
/**
 * Set when a UI-driven invoke asked for a resolver key that does not exist.
 * Surfaced as a hint by waitForContent's timeout (see simulator-ui), which
 * is where the symptom actually shows up — the UI just sits on its loading
 * state forever.
 */
let latestMissingResolverError: Error | null = null;
const bridgeCalls: BridgeCall[] = [];
let tornDown = false;
let currentForgeContext: ForgeContext | null = null;

// ── Raw HTML rejection (spec UIK-003) ───────────────────────────────────
//
// Real Forge UI Kit cannot render arbitrary HTML: apps are restricted to
// components exported from '@forge/react', and a host element like <div>
// surfaces a render error instead of the app. The sim must match — silently
// passing raw HTML through would give false confidence that dies in prod.
//
// Detection: a ForgeDoc type that is a known HTML/SVG/MathML tag, or a
// custom element (hyphenated name, per the HTML spec) — see
// html-elements.ts. In headless mode (test API + MCP) this is a HARD FAIL:
// pending waitForRender promises reject with UIKitRawHtmlError and
// sim.ui.render() throws. The dev-server browser shim (dev-command.ts)
// instead shows a visual error panel — right UX for each surface.

/** Thrown when a UI Kit render contains raw HTML host elements (UIK-003). */
export class UIKitRawHtmlError extends Error {
  constructor(public readonly rawTags: string[]) {
    super(
      `UI Kit does not support raw HTML elements (found: ` +
      `${rawTags.map((t) => `<${t}>`).join(', ')}). Apps are restricted to ` +
      `components exported from '@forge/react' — real Forge rejects this render.`
    );
    this.name = 'UIKitRawHtmlError';
  }
}

function collectRawHtmlTypes(doc: ForgeDoc, found: Set<string> = new Set()): Set<string> {
  if (isRawHtmlType(doc.type)) {
    found.add(doc.type);
  }
  for (const child of doc.children ?? []) {
    collectRawHtmlTypes(child, found);
  }
  return found;
}

// ── Bridge command handlers ─────────────────────────────────────────────

async function handleReconcile(forgeDoc: ForgeDoc, kind: 'view' | 'macroConfig'): Promise<void> {
  // Manual-packaged bundles ship their own @forge/react; the payload is the
  // only place its version is visible. One-time warning per mismatched major.
  // Statically imported: an `await import()` here suspends the handler
  // mid-capture and reorders waiter resolution against a fast follow-up
  // reconcile (broke the render-race tests).
  warnOnForgeReactMajorMismatch(forgeDoc.forgeReactMajorVersion);

  const isMacroConfig = kind === 'macroConfig';
  const data = { forgeDoc };

  // Parity (UIK-003): HARD FAIL on raw HTML host elements. The doc is not
  // published — pending waiters reject, and the error is recorded so
  // sim.ui.render() throws even if no waiter was pending.
  const rawTypes = collectRawHtmlTypes(data.forgeDoc);
  if (rawTypes.size > 0) {
    const error = new UIKitRawHtmlError([...rawTypes]);
    console.error(
      `[forge-sim] UI Kit render rejected: raw HTML element(s) ` +
      `${error.rawTags.map((t) => `<${t}>`).join(', ')} are not supported. ` +
      `UI Kit apps may only render components exported from '@forge/react'. ` +
      `Real Forge fails this render — fix the app, don't rely on passthrough.`
    );
    latestRenderError = error;
    const waiters = isMacroConfig ? macroConfigRenderResolvers : renderResolvers;
    if (isMacroConfig) macroConfigRenderResolvers = [];
    else renderResolvers = [];
    for (const { reject } of waiters) {
      reject(error);
    }
    return;
  }
  latestRenderError = null;

  // The reconciler emits two roots when a macro uses inline config:
  //   - { type: 'Root' }        from ForgeReconciler.render(<App />)
  //   - { type: 'MacroConfig' } from ForgeReconciler.addConfig(<Config />)
  // Route them to separate listener pools so headless tests can subscribe
  // to each tree independently — same shape as the browser bridge shim.
  if (isMacroConfig) {
    latestMacroConfigDoc = data.forgeDoc;
    const resolvers = macroConfigRenderResolvers;
    macroConfigRenderResolvers = [];
    for (const { resolve } of resolvers) {
      resolve(latestMacroConfigDoc!);
    }
    for (const listener of macroConfigRenderListeners) {
      try { listener(latestMacroConfigDoc!); } catch {}
    }
    return;
  }

  latestForgeDoc = data.forgeDoc;
  const resolvers = renderResolvers;
  renderResolvers = [];
  for (const { resolve } of resolvers) {
    resolve(latestForgeDoc!);
  }
  // Notify persistent listeners (e.g., dev server)
  for (const listener of renderListeners) {
    try { listener(latestForgeDoc!); } catch {}
  }
}

/**
 * Consume the most recent missing-resolver invoke failure, if any.
 * Returns it once and clears it.
 */
export function consumeMissingResolverError(): Error | null {
  const err = latestMissingResolverError;
  latestMissingResolverError = null;
  return err;
}

// ── Setup ───────────────────────────────────────────────────────────────

/**
 * Minimal document stub for headless imports of PREBUILT (manual-packaged)
 * bundles. Only installed when no real `document` exists (never in browsers
 * or jsdom test environments).
 *
 * Why: Vite injects its modulepreload polyfill into every default build, and
 * its first statement is `document.createElement("link").relList` — followed
 * by an early return when `relList.supports("modulepreload")` is true. In
 * plain Node that's an immediate `ReferenceError: document is not defined`
 * from inside the minified chunk, hit by anyone who runs a standard
 * `vite build` and calls sim.ui.render(). Answering `supports → true` makes
 * the polyfill exit on its own fast path — the browser-parity answer, since
 * every browser Forge supports has native modulepreload. The stub is
 * deliberately inert-but-permissive so load-time CSS/style injection
 * preambles (document.head.appendChild(style)) are absorbed too.
 */
function installDocumentStub(): void {
  if (typeof (globalThis as any).document !== 'undefined') return;

  const inertElement = (): any => ({
    relList: { supports: () => true },
    style: {},
    setAttribute: () => {},
    appendChild: (child: unknown) => child,
    removeChild: (child: unknown) => child,
    addEventListener: () => {},
    removeEventListener: () => {},
  });

  (globalThis as any).document = {
    __forgeSimStub: true,
    // null (not undefined) outside script evaluation — browser parity.
    // simulator-ui points this at the bundle being imported via
    // setStubCurrentScript(): webpack/Rspack's `publicPath: 'auto'` runtime
    // reads document.currentScript.src at module eval and throws an opaque
    // "Automatic publicPath is not supported in this browser" when it's
    // missing — and every Forge webpack frontend has chunk runtime, because
    // @forge/bridge itself dynamically imports iframe-resizer (adversarial A).
    currentScript: null as null | { src: string },
    createElement: inertElement,
    createTextNode: () => ({}),
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementsByTagName: () => [],
    head: inertElement(),
    body: inertElement(),
    documentElement: inertElement(),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

// ── Headless i18n: page-relative __LOCALES__ fetches ────────────────────
//
// Real @forge/bridge's i18n module has NO bridge seam. It loads translations
// with a page-relative `fetch('./__LOCALES__/i18n-info.json')` and
// `fetch('./__LOCALES__/<locale>.json')` (node_modules/@forge/bridge/out/
// i18n/index.js) — static files Forge's build places next to the entry HTML.
// In a browser that resolves against the document URL; in Node there is no
// document URL and undici throws `TypeError: Failed to parse URL`. The
// I18nProvider effect rejects (unhandled) and `t()` silently falls back to
// returning keys — a headless-only failure that passes untranslated.
//
// Our forge-bridge shim never hits this (it reads sim.i18n directly), so this
// is only reached by PREBUILT bundles with the real package inlined. We are
// the page here, so answer the two relative shapes from sim.i18n — the same
// store the shim path uses — and leave every other URL to the real fetch.
// Absolute URLs never match: the page-relative form is the only one the real
// package emits and the only one a browser would resolve against the resource.

const I18N_BUNDLE_FOLDER_NAME = '__LOCALES__';
const I18N_INFO_FILE_NAME = 'i18n-info.json';
const RELATIVE_LOCALES_RE = new RegExp(`^(?:\\./)?${I18N_BUNDLE_FOLDER_NAME}/([^/?#]+)$`);
const FETCH_PATCH_MARK = Symbol.for('forge-sim.relative-i18n-fetch');

function requestUrl(input: unknown): string | null {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (input && typeof (input as { url?: unknown }).url === 'string') return (input as { url: string }).url;
  return null;
}

async function serveLocalesFile(file: string): Promise<Response> {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      statusText: status === 200 ? 'OK' : 'Not Found',
      headers: { 'content-type': 'application/json' },
    });
  if (!simulator) return json({ error: 'forge-sim bridge: No simulator connected' }, 404);
  try {
    if (file === I18N_INFO_FILE_NAME) {
      // Real file shape is `{ config: {...} }` — the package reads `.config`.
      return json({ config: await simulator.i18n.getI18nInfoConfig() });
    }
    if (file.endsWith('.json')) {
      return json(await simulator.i18n.getTranslationResource(file.slice(0, -'.json'.length)));
    }
  } catch (err) {
    // Missing locale → the same 404 a missing static file would produce, so
    // the real package raises ITS error ("Failed to get translation resource
    // for locale: xx"), exactly as in a browser.
    return json({ error: (err as Error).message }, 404);
  }
  return json({ error: `Not found: ${I18N_BUNDLE_FOLDER_NAME}/${file}` }, 404);
}

// ── Headless page base for `new Request('')` ────────────────────────────
//
// Real @forge/bridge normalizes every requestJira/requestConfluence/
// requestBitbucket/requestRemote init through `new Request('', init)` to
// derive headers and body text (node_modules/@forge/bridge/out/fetch/
// fetch.js, parseRequest). A browser resolves '' against the document base;
// undici has no base and throws `TypeError: Invalid URL`, so a prebuilt
// bundle's first product or remote request dies inside the package before
// it ever reaches the bridge — and with it every hook built on requestJira
// (useIssueProperty, useContentProperty, useSpaceProperty). Give relative
// and empty request URLs the base a browser would: the real document's if
// one exists, otherwise a synthetic headless origin. Absolute URLs pass
// through untouched; nothing about the Request is read back as a URL by the
// package, so the synthetic origin never leaks into app-visible data.

const HEADLESS_PAGE_BASE = 'http://forge-sim.headless/';
const REQUEST_PATCH_MARK = Symbol.for('forge-sim.relative-request-base');
const ABSOLUTE_URL_RE = /^[a-z][a-z0-9+.-]*:/i;

function installRelativeRequestBase(): void {
  const g = globalThis as any;
  const RealRequest = g.Request;
  if (typeof RealRequest !== 'function' || RealRequest[REQUEST_PATCH_MARK]) return;
  const base = () => {
    const doc = g.document;
    const docBase = doc && !doc.__forgeSimStub ? doc.baseURI : undefined;
    return typeof docBase === 'string' && docBase ? docBase : HEADLESS_PAGE_BASE;
  };
  class ForgeSimRequest extends RealRequest {
    constructor(input: unknown, init?: unknown) {
      if (typeof input === 'string' && !ABSOLUTE_URL_RE.test(input)) {
        input = new URL(input, base()).href;
      }
      super(input as any, init as any);
    }
  }
  (ForgeSimRequest as any)[REQUEST_PATCH_MARK] = true;
  Object.defineProperty(ForgeSimRequest, 'name', { value: 'Request' });
  g.Request = ForgeSimRequest;
}

function installRelativeI18nFetch(): void {
  const g = globalThis as any;
  const real = g.fetch;
  if (typeof real !== 'function' || real[FETCH_PATCH_MARK]) return;
  const patched = function forgeSimFetch(this: unknown, input: unknown, init?: unknown) {
    const url = requestUrl(input);
    const m = url ? RELATIVE_LOCALES_RE.exec(url) : null;
    if (m) return serveLocalesFile(decodeURIComponent(m[1]));
    return real.call(this ?? globalThis, input, init);
  } as any;
  patched[FETCH_PATCH_MARK] = true;
  g.fetch = patched;
}

/**
 * Point the document stub's `currentScript` at the script being evaluated
 * (pass null when evaluation ends — the browser-parity resting state).
 * Only touches OUR stub: real documents (browser, jsdom) manage their own.
 *
 * `src` carries the entry-script file URL so bundler runtimes that derive
 * their asset base from it (webpack/Rspack `publicPath: 'auto'`, bundles
 * reading `currentScript.src` directly) resolve it the same way a browser
 * would — relative to the bundle's own directory.
 */
export function setStubCurrentScript(src: string | null): void {
  const doc = (globalThis as any).document;
  if (!doc?.__forgeSimStub) return;
  // tagName matters: webpack 5's publicPath runtime gates on
  // `document.currentScript.tagName.toUpperCase() === "SCRIPT"` before
  // reading `.src`.
  doc.currentScript = src === null
    ? null
    : { src, tagName: 'SCRIPT', type: 'text/javascript', getAttribute: (n: string) => (n === 'src' ? src : null) };
}

/**
 * Install the bridge on globalThis so @forge/bridge and @forge/react find it.
 * Call this BEFORE importing any @forge/react or @forge/bridge modules.
 */
const headlessHost: HeadlessHost = createHeadlessHost({
  getSimulator: () => simulator,
  isTornDown: () => tornDown,
  reconcile: (doc, kind) => handleReconcile(doc as ForgeDoc, kind),
  getContext: handleGetContext,
  getContextExtension: () => (currentForgeContext?.extension as Record<string, unknown> | undefined) ?? null,
  recordMissingResolver: (err) => { latestMissingResolverError = err; },
});

const { callBridge } = createBridgeDispatcher(headlessHost, {
  onCall: (cmd, data) => { bridgeCalls.push({ cmd, data, timestamp: Date.now() }); },
});

async function handleGetContext(): Promise<ForgeContext> {
  if (currentForgeContext) return currentForgeContext;
  // Fallback — no context has been set
  const { buildDefaultContext } = await import('../context.js');
  return buildDefaultContext('sim-module');
}

// The dispatcher this module instance built, published under a global key so
// the seam can find the CURRENT one. `globalThis.__bridge` itself is a stateless
// trampoline that forwards to whatever is under this key. Why the indirection:
// the real @forge/bridge captures `__bridge.callBridge` ONCE, at module
// evaluation (out/bridge.js getCallBridge), and it is CJS, which vitest never
// re-evaluates. This module, by contrast, is re-evaluated by `vi.resetModules()`
// (and loaded twice when a compiled dist copy sits beside the src copy), each
// instance with its own render waiters and attached simulator. Without the
// trampoline the package keeps routing to the first, dead instance and every
// render after a resetModules() hangs on a reconcile nobody is waiting for.
// Same reason src/ui/view-events.ts keeps its store on globalThis.
const DISPATCHER_KEY = Symbol.for('forge-sim.bridge-dispatcher');
const TRAMPOLINE_MARK = Symbol.for('forge-sim.bridge-trampoline');

/**
 * Headless `window`/`self` for prebuilt browser bundles evaluated in Node.
 * Only installed when no real window exists (browsers and jsdom test
 * environments keep theirs).
 *
 * Browser bundles reach for these at module evaluation: webpack/Rspack's
 * chunk runtime keys `self.webpackChunk<app>`, and libraries gate
 * browser-only code on `typeof window === 'undefined'` (SSR guards). The old
 * answer — `window = self = globalThis` — got bundles past the `typeof`
 * check and then failed on the FIRST window method, because Node's global is
 * not an EventTarget: iframe-resizer's SSR guard saw a window, proceeded, and
 * died on `window.addEventListener` (bundler-matrix lab: Rollup's commonjs
 * plugin evaluates @forge/bridge's dynamic `import('iframe-resizer')`
 * eagerly, so it was the one bundler to hit it; the rest only dodge it
 * because that chunk stays lazy). A half-window is worse than none.
 *
 * So: a distinct object whose prototype is globalThis — reads of globals
 * fall through, writes stay on the window (`self.webpackChunk = …` lands
 * here and every chunk reads it back from `self` too) — with a real
 * EventTarget behind add/remove/dispatchEvent and self-referential
 * `window`/`self`. Nothing is added to globalThis itself, so backend bundles
 * sharing the process see no new browser API.
 */
function createHeadlessWindow(): any {
  const events = new EventTarget();
  const win: any = Object.create(globalThis, {
    addEventListener: { value: events.addEventListener.bind(events) },
    removeEventListener: { value: events.removeEventListener.bind(events) },
    dispatchEvent: { value: events.dispatchEvent.bind(events) },
    __forgeSimHeadlessWindow: { value: true },
  });
  Object.defineProperty(win, 'window', { value: win, enumerable: true });
  Object.defineProperty(win, 'self', { value: win, enumerable: true });
  return win;
}

/**
 * Make THIS module instance the live dispatcher and install the seam around
 * it. Called whenever a simulator is attached (constructor via
 * installBridgeSeam, sim.ui.ensureBridge, connectSimulator).
 */
export function installBridge(): void {
  (globalThis as any)[DISPATCHER_KEY] = { callBridge };
  ensureBridgeSeam();
}

/**
 * Make sure a seam exists, WITHOUT claiming to be the live instance: only
 * publish this module's dispatcher if nothing is published yet. This is what
 * runs at module scope. The distinction matters under `vi.resetModules()`:
 * the fresh @forge/react shim imports a fresh copy of this module while the
 * test is still awaiting the ORIGINAL copy's render waiters. A copy that
 * installed itself unconditionally would steal every frame from the copy a
 * simulator is actually attached to, and the render would hang.
 */
function ensureBridgeSeam(): void {
  const g = globalThis as any;
  if (!g[DISPATCHER_KEY]) g[DISPATCHER_KEY] = { callBridge };
  if (!g.__bridge?.[TRAMPOLINE_MARK]) {
    g.__bridge = {
      callBridge: (cmd: string, data?: unknown) => g[DISPATCHER_KEY].callBridge(cmd, data),
      [TRAMPOLINE_MARK]: true,
    };
  }
  if (typeof g.window === 'undefined') g.window = createHeadlessWindow();
  if (typeof g.self === 'undefined') g.self = g.window;
  // Kept on `window` too: the real @forge/bridge reads globalThis.__bridge
  // (out/bridge.js getCallBridge), but bundled copies and @forge/react's own
  // test setup reach for window.__bridge — both must agree.
  g.window.__bridge = g.__bridge;
  installDocumentStub();
  installRelativeI18nFetch();
  installRelativeRequestBase();
}

/**
 * Connect a ForgeSimulator instance to the bridge.
 * After this, invoke/fetchProduct calls from the UI go through the simulator.
 */
export function connectSimulator(sim: ForgeSimulator): void {
  attachSimulator(sim);
  tornDown = false;
}

function attachSimulator(sim: ForgeSimulator): void {
  simulator = sim;
}

/**
 * Make `globalThis.__bridge` present from the moment a ForgeSimulator exists
 * — the frontend seam, installed next to the two backend seams by
 * setSimulator() (src/shims/globals.ts).
 *
 * Why at construction and not at render: the real `@forge/bridge` captures
 * the seam at MODULE EVALUATION — `getCallBridge()` in
 * node_modules/@forge/bridge/out/bridge.js throws BridgeAPIError when
 * `globalThis.__bridge.callBridge` is absent, and ~25 of its modules call it
 * in a top-level `const callBridge = getCallBridge()`. Real Forge has the
 * seam in place before any app script runs; so must we, or a bare
 * `import '@forge/bridge'` before the first render dies in the package.
 *
 * Deliberately leaves `tornDown` alone: resetBridge() sets it so effects
 * from an unmounted React tree are swallowed, and constructing another sim
 * is not a render — connectSimulator() (via sim.ui.ensureBridge()) is what
 * clears it when a render actually starts.
 */
export function installBridgeSeam(sim: ForgeSimulator): void {
  installBridge();
  attachSimulator(sim);
}

// The seam is a property of the ENVIRONMENT, not of a simulator instance: in
// real Forge the iframe has `window.__bridge` before the first app script
// runs, whether or not anything is listening yet. Install it as soon as
// forge-sim itself is loaded, so a test file that does
//
//   import { createSimulator } from 'forge-sim';
//   import { invoke } from '@forge/bridge';   // evaluates getCallBridge() NOW
//
// does not die inside the package before its first beforeEach can construct
// a sim. ESM evaluates imports in source order, so forge-sim is loaded first.
// Until a sim is attached, every command rejects with the host's "No
// simulator connected" — loud, and one line away from the fix.
ensureBridgeSeam();

/**
 * Set the Forge context for the current render.
 * This is what view.getContext() / useProductContext() will return.
 */
export function setForgeContext(context: ForgeContext): void {
  currentForgeContext = context;
}

/**
 * Get the current Forge context (if set).
 */
export function getForgeContext(): ForgeContext | null {
  return currentForgeContext;
}

// ── ForgeDoc access ─────────────────────────────────────────────────────

/** Get the latest ForgeDoc produced by the reconciler. */
export function getLatestForgeDoc(): ForgeDoc | null {
  return latestForgeDoc;
}

/**
 * Get the latest MacroConfig ForgeDoc produced by ForgeReconciler.addConfig().
 * Returns null if the app didn't call addConfig (most apps don't).
 */
export function getLatestMacroConfigDoc(): ForgeDoc | null {
  return latestMacroConfigDoc;
}

/**
 * Wait for the next render (reconcile bridge call).
 *
 * Rejects with {@link UIKitRawHtmlError} if the render contains raw HTML
 * host elements (UIK-003) — hard fail, matching real Forge.
 */
export function waitForRender(): Promise<ForgeDoc> {
  return new Promise((resolve, reject) => {
    renderResolvers.push({ resolve, reject });
  });
}

/**
 * Wait for the next MacroConfig render (from ForgeReconciler.addConfig).
 * Rejects with {@link UIKitRawHtmlError} on raw HTML (UIK-003).
 */
export function waitForMacroConfigRender(): Promise<ForgeDoc> {
  return new Promise((resolve, reject) => {
    macroConfigRenderResolvers.push({ resolve, reject });
  });
}

/**
 * Consume the most recent render error (UIK-003 hard fail), if any.
 * Returns the error once and clears it. Used by simulator-ui.render() to
 * throw even when its waitForRender promise wasn't the awaited path.
 */
export function consumeRenderError(): Error | null {
  const err = latestRenderError;
  latestRenderError = null;
  return err;
}

/** Get all bridge calls made so far. */
export function getBridgeCalls(): BridgeCall[] {
  return [...bridgeCalls];
}

/**
 * Register a persistent listener that fires on every render (reconcile).
 * Used by the dev server to auto-broadcast ForgeDoc updates.
 * Returns an unbind function.
 */
export function onRender(listener: (doc: ForgeDoc) => void): () => void {
  renderListeners.push(listener);
  return () => {
    renderListeners = renderListeners.filter((l) => l !== listener);
  };
}

/**
 * Register a persistent listener for MacroConfig ForgeDoc updates
 * (ForgeReconciler.addConfig). Only fires when the app uses inline config.
 */
export function onMacroConfigRender(listener: (doc: ForgeDoc) => void): () => void {
  macroConfigRenderListeners.push(listener);
  return () => {
    macroConfigRenderListeners = macroConfigRenderListeners.filter((l) => l !== listener);
  };
}

/** Reset all UI state — marks bridge as torn down to swallow stale React effects. */
export function resetBridge(): void {
  tornDown = true;
  latestForgeDoc = null;
  latestMacroConfigDoc = null;
  latestRenderError = null;
  latestMissingResolverError = null;
  renderResolvers = [];
  macroConfigRenderResolvers = [];
  bridgeCalls.length = 0;
  headlessHost.reset();
  currentForgeContext = null;
}

/**
 * Full reset of render-lifecycle state. The attached simulator STAYS
 * attached: it still exists and is still the active one, and the seam is
 * always present now, so a direct `@forge/bridge` call right after a reset
 * (a test's next case, say) must keep reaching it. A new simulator replaces
 * it when constructed.
 */
export function resetAll(): void {
  resetBridge();
  renderListeners = [];
  macroConfigRenderListeners = [];
}
