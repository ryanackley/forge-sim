/**
 * Canonical host-element tag sets — used to detect raw HTML in UI Kit trees
 * (spec UIK-003).
 *
 * Real Forge UI Kit apps may only render components exported from
 * '@forge/react'. React serializes any JSX tag written in lowercase as a
 * string "host element" type, so a ForgeDoc node whose type is a known
 * HTML/SVG/MathML tag — or a custom element — is raw HTML that real Forge
 * would reject.
 *
 * Sources (vendored, not a runtime dependency, because the browser bridge
 * shim in dev-command.ts needs the list injected into a generated script):
 *   - HTML:   WHATWG HTML Standard element list, as curated by the
 *             `html-tags` package (https://github.com/sindresorhus/html-tags)
 *   - HTML (obsolete): WHATWG "obsolete features" — browsers (and React)
 *             still treat these as host elements, so they must be flagged too
 *   - SVG:    SVG 1.1/2.0 element list, as curated by the `svg-tags` package
 *   - MathML: MathML Core element list (MDN)
 *   - Custom elements: per the HTML spec, valid custom element names MUST
 *             contain a hyphen — checked structurally, no list needed
 */

const HTML_TAGS = [
  'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio', 'b', 'base',
  'bdi', 'bdo', 'blockquote', 'body', 'br', 'button', 'canvas', 'caption',
  'cite', 'code', 'col', 'colgroup', 'data', 'datalist', 'dd', 'del',
  'details', 'dfn', 'dialog', 'div', 'dl', 'dt', 'em', 'embed', 'fieldset',
  'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5',
  'h6', 'head', 'header', 'hgroup', 'hr', 'html', 'i', 'iframe', 'img',
  'input', 'ins', 'kbd', 'label', 'legend', 'li', 'link', 'main', 'map',
  'mark', 'menu', 'meta', 'meter', 'nav', 'noscript', 'object', 'ol',
  'optgroup', 'option', 'output', 'p', 'picture', 'pre', 'progress', 'q',
  'rp', 'rt', 'ruby', 's', 'samp', 'script', 'search', 'section', 'select',
  'slot', 'small', 'source', 'span', 'strong', 'style', 'sub', 'summary',
  'sup', 'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th',
  'thead', 'time', 'title', 'tr', 'track', 'u', 'ul', 'var', 'video', 'wbr',
];

const HTML_OBSOLETE_TAGS = [
  'acronym', 'applet', 'basefont', 'bgsound', 'big', 'blink', 'center',
  'content', 'dir', 'font', 'frame', 'frameset', 'image', 'isindex',
  'keygen', 'listing', 'marquee', 'menuitem', 'multicol', 'nextid', 'nobr',
  'noembed', 'noframes', 'param', 'plaintext', 'rb', 'rtc', 'shadow',
  'spacer', 'strike', 'tt', 'xmp',
];

const SVG_TAGS = [
  'svg', 'animate', 'animateMotion', 'animateTransform', 'circle',
  'clipPath', 'defs', 'desc', 'ellipse', 'feBlend', 'feColorMatrix',
  'feComponentTransfer', 'feComposite', 'feConvolveMatrix',
  'feDiffuseLighting', 'feDisplacementMap', 'feDistantLight',
  'feDropShadow', 'feFlood', 'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR',
  'feGaussianBlur', 'feImage', 'feMerge', 'feMergeNode', 'feMorphology',
  'feOffset', 'fePointLight', 'feSpecularLighting', 'feSpotLight',
  'feTile', 'feTurbulence', 'filter', 'foreignObject', 'g', 'line',
  'linearGradient', 'marker', 'mask', 'metadata', 'mpath', 'path',
  'pattern', 'polygon', 'polyline', 'radialGradient', 'rect', 'set',
  'stop', 'switch', 'symbol', 'text', 'textPath', 'tspan', 'use', 'view',
];

const MATHML_TAGS = [
  'math', 'annotation', 'maction', 'menclose', 'merror', 'mfenced',
  'mfrac', 'mi', 'mmultiscripts', 'mn', 'mo', 'mover', 'mpadded',
  'mphantom', 'mprescripts', 'mroot', 'mrow', 'ms', 'mspace', 'msqrt',
  'mstyle', 'msub', 'msubsup', 'msup', 'mtable', 'mtd', 'mtext', 'mtr',
  'munder', 'munderover', 'semantics',
];

/**
 * Flat, deduped list of every known host-element tag. Exported so the
 * dev-server browser bridge shim (a generated script) can inline it via
 * JSON.stringify.
 */
export const RAW_HTML_TAG_LIST: string[] = [
  ...new Set([...HTML_TAGS, ...HTML_OBSOLETE_TAGS, ...SVG_TAGS, ...MATHML_TAGS]),
];

const RAW_HTML_TAG_SET = new Set(RAW_HTML_TAG_LIST);

/**
 * Is this ForgeDoc `type` a raw HTML host element?
 *
 * True when the type is a known HTML/SVG/MathML tag, or a custom element
 * (the HTML spec requires custom element names to contain a hyphen).
 *
 * Deliberately NOT a casing heuristic: an unknown lowercase type that isn't
 * in any spec list (e.g. a typo like `dvi`) is not flagged here — it falls
 * through to the renderer's FallbackComponent as a visible degrade.
 */
export function isRawHtmlType(type: unknown): boolean {
  if (typeof type !== 'string') return false;
  return RAW_HTML_TAG_SET.has(type) || type.includes('-');
}
