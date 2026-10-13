/**
 * Content-Type lookup for hand-served static files.
 *
 * The Custom UI middleware (and anything else that serves files with
 * readFileSync + writeHead instead of going through Vite's static serving)
 * must set Content-Type itself — Vite's own MIME handling only applies to
 * files Vite serves, and Vite 6 bundles its mime library so we can't reuse it.
 *
 * The table is MDN's "Common MIME types" list:
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/MIME_types/Common_types
 * plus dev-server deviations noted inline. Wrong or missing entries are a real
 * footgun: a .wasm served as application/octet-stream breaks
 * WebAssembly.instantiateStreaming(), and module scripts require a JavaScript
 * MIME type.
 */

const MIME_TYPES: Record<string, string> = {
  // ── Deviations from MDN ──
  // .ts here is a TypeScript source, not MPEG transport stream (MDN:
  // video/mp2t). The dev server serves app source files to the browser, so
  // script types win. Same for .tsx/.jsx (not in MDN's list at all).
  ts: 'text/javascript',
  tsx: 'text/javascript',
  jsx: 'text/javascript',

  // ── MDN common types ──
  aac: 'audio/aac',
  abw: 'application/x-abiword',
  apng: 'image/apng',
  arc: 'application/x-freearc',
  avif: 'image/avif',
  avi: 'video/x-msvideo',
  azw: 'application/vnd.amazon.ebook',
  bin: 'application/octet-stream',
  bmp: 'image/bmp',
  bz: 'application/x-bzip',
  bz2: 'application/x-bzip2',
  cda: 'application/x-cdf',
  csh: 'application/x-csh',
  css: 'text/css',
  csv: 'text/csv',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  eot: 'application/vnd.ms-fontobject',
  epub: 'application/epub+zip',
  gz: 'application/gzip',
  gif: 'image/gif',
  htm: 'text/html',
  html: 'text/html',
  ico: 'image/vnd.microsoft.icon',
  ics: 'text/calendar',
  jar: 'application/java-archive',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  js: 'text/javascript',
  json: 'application/json',
  jsonld: 'application/ld+json',
  md: 'text/markdown',
  mid: 'audio/midi',
  midi: 'audio/midi',
  mjs: 'text/javascript',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  mpeg: 'video/mpeg',
  mpkg: 'application/vnd.apple.installer+xml',
  odp: 'application/vnd.oasis.opendocument.presentation',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odt: 'application/vnd.oasis.opendocument.text',
  oga: 'audio/ogg',
  ogv: 'video/ogg',
  ogx: 'application/ogg',
  opus: 'audio/ogg',
  otf: 'font/otf',
  png: 'image/png',
  pdf: 'application/pdf',
  php: 'application/x-httpd-php',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  rar: 'application/vnd.rar',
  rtf: 'application/rtf',
  sh: 'application/x-sh',
  svg: 'image/svg+xml',
  tar: 'application/x-tar',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  ttf: 'font/ttf',
  txt: 'text/plain',
  vsd: 'application/vnd.visio',
  wasm: 'application/wasm',
  wav: 'audio/wav',
  weba: 'audio/webm',
  webm: 'video/webm',
  webmanifest: 'application/manifest+json',
  webp: 'image/webp',
  woff: 'font/woff',
  woff2: 'font/woff2',
  xhtml: 'application/xhtml+xml',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xml: 'application/xml',
  xul: 'application/vnd.mozilla.xul+xml',
  zip: 'application/zip',
  '3gp': 'video/3gpp',
  '3g2': 'video/3gpp2',
  '7z': 'application/x-7z-compressed',
};

/**
 * Content-Type for a file path (or bare extension), falling back to
 * application/octet-stream. Extension matching is case-insensitive.
 */
export function contentTypeFor(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return MIME_TYPES[ext] ?? 'application/octet-stream';
}
