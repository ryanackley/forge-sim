// Optional lab mode: pre-install a real jsdom window/document as the global
// browser environment BEFORE dist/ loads. ensureBridgeSeam() only aliases
// `window`/`self` to globalThis when they're undefined and only installs the
// document stub when no document exists, so this swaps the hand-grown stub
// layer for jsdom wholesale without touching src/. A/B switch for the
// "evaluate prebuilt bundles against jsdom" hypothesis.
//
// Activate with LAB_DOM=jsdom. Must be imported before ../../dist/index.js.
import { createRequire } from 'node:module';

if (process.env.LAB_DOM === 'jsdom') {
  const require = createRequire(import.meta.url);
  const { JSDOM } = require('../../node_modules/jsdom');
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'https://forge-sim.headless/',
    pretendToBeVisual: true,
  });
  const w = dom.window;
  globalThis.window = w;
  globalThis.document = w.document;
  globalThis.self = w;
  // Bare interface references bundles commonly make at eval time.
  for (const k of ['HTMLElement', 'Element', 'Node', 'CustomEvent', 'MutationObserver', 'getComputedStyle', 'location', 'history']) {
    if (!(k in globalThis)) {
      try { globalThis[k] = w[k]; } catch { /* readonly global — leave it */ }
    }
  }
  console.log('[lab] jsdom mode: real window/document installed before dist');
}
