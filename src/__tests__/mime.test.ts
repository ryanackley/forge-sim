/**
 * Content-Type lookup for hand-served static files (src/mime.ts).
 *
 * The table exists because the Custom UI middleware serves files itself
 * instead of through Vite; a wrong entry is a user-facing footgun (e.g. a
 * .wasm served as octet-stream breaks WebAssembly.instantiateStreaming).
 */
import { describe, it, expect } from 'vitest';
import { contentTypeFor } from '../mime.js';

describe('contentTypeFor', () => {
  it.each([
    // The entries the old inline table covered
    ['index.html', 'text/html'],
    ['app.js', 'text/javascript'],
    ['style.css', 'text/css'],
    ['data.json', 'application/json'],
    ['icon.svg', 'image/svg+xml'],
    ['logo.png', 'image/png'],
    ['photo.jpg', 'image/jpeg'],
    // The Phase-2 motivator: manual packaging legitimizes wasm + data files
    ['module.wasm', 'application/wasm'],
    // Modern web assets the old table missed
    ['bundle.mjs', 'text/javascript'],
    ['font.woff2', 'font/woff2'],
    ['pic.webp', 'image/webp'],
    ['app.webmanifest', 'application/manifest+json'],
    ['readme.md', 'text/markdown'],
    ['doc.pdf', 'application/pdf'],
    ['notes.txt', 'text/plain'],
    ['feed.xml', 'application/xml'],
    // Sourcemaps: siblings of a prebuilt bundle once the dev server serves
    // the resource dir (#40 adversarial C). webpack/Rspack emit these by
    // default; octet-stream makes devtools skip them without a word.
    ['index.js.map', 'application/json'],
    ['styles.css.map', 'application/json'],
  ])('%s → %s', (file, mime) => {
    expect(contentTypeFor(file)).toBe(mime);
  });

  it('serves TS/JSX sources as JavaScript (dev-server deviation from MDN)', () => {
    // MDN maps .ts to video/mp2t (MPEG transport stream); in the dev server
    // these are app sources the browser must execute.
    expect(contentTypeFor('index.ts')).toBe('text/javascript');
    expect(contentTypeFor('App.tsx')).toBe('text/javascript');
    expect(contentTypeFor('App.jsx')).toBe('text/javascript');
  });

  it('is case-insensitive and path-tolerant', () => {
    expect(contentTypeFor('/deep/dir/IMAGE.PNG')).toBe('image/png');
    expect(contentTypeFor('archive.7Z')).toBe('application/x-7z-compressed');
  });

  it('falls back to application/octet-stream', () => {
    expect(contentTypeFor('file.unknownext')).toBe('application/octet-stream');
    expect(contentTypeFor('no-extension')).toBe('application/octet-stream');
  });
});
