/**
 * Tests for the raw-HTML host-element detection (spec UIK-003).
 *
 * Detection is map-based (canonical HTML/SVG/MathML tag lists) plus the
 * HTML spec's custom-element rule (name contains a hyphen) — NOT a casing
 * heuristic.
 */

import { describe, it, expect } from 'vitest';
import { isRawHtmlType, RAW_HTML_TAG_LIST } from '../ui/html-elements.js';

describe('isRawHtmlType (UIK-003 detection)', () => {
  it('flags standard HTML tags', () => {
    for (const tag of ['div', 'span', 'p', 'a', 'table', 'input', 'iframe', 'script', 'h1']) {
      expect(isRawHtmlType(tag), tag).toBe(true);
    }
  });

  it('flags obsolete HTML tags (still host elements in React)', () => {
    for (const tag of ['marquee', 'center', 'font', 'blink', 'big']) {
      expect(isRawHtmlType(tag), tag).toBe(true);
    }
  });

  it('flags SVG tags, including camelCase ones', () => {
    for (const tag of ['svg', 'path', 'circle', 'clipPath', 'foreignObject', 'linearGradient']) {
      expect(isRawHtmlType(tag), tag).toBe(true);
    }
  });

  it('flags MathML tags', () => {
    for (const tag of ['math', 'mi', 'mo', 'mfrac', 'msqrt']) {
      expect(isRawHtmlType(tag), tag).toBe(true);
    }
  });

  it('flags custom elements (hyphenated names, per the HTML spec)', () => {
    for (const tag of ['my-widget', 'x-foo', 'some-long-element-name']) {
      expect(isRawHtmlType(tag), tag).toBe(true);
    }
  });

  it('does NOT flag Forge component / internal ForgeDoc types', () => {
    for (const type of [
      'Text', 'Button', 'Stack', 'Box', 'SectionMessage', 'DynamicTable',
      'Root', 'String', 'ContentWrapper', 'MacroConfig', 'Select', 'Form',
    ]) {
      expect(isRawHtmlType(type), type).toBe(false);
    }
  });

  it('does NOT flag unknown non-spec lowercase types (typos degrade visibly, not fatally)', () => {
    expect(isRawHtmlType('dvi')).toBe(false);
    expect(isRawHtmlType('spann')).toBe(false);
  });

  it('handles non-string input', () => {
    expect(isRawHtmlType(undefined)).toBe(false);
    expect(isRawHtmlType(null)).toBe(false);
    expect(isRawHtmlType(42)).toBe(false);
  });

  it('exports a deduped, all-lowercase-first tag list (no Forge component collisions)', () => {
    expect(RAW_HTML_TAG_LIST.length).toBe(new Set(RAW_HTML_TAG_LIST).size);
    // Every host tag starts lowercase — Forge components are uppercase-first,
    // so the map can never collide with a legitimate ForgeDoc type.
    expect(RAW_HTML_TAG_LIST.every((t) => /^[a-z]/.test(t))).toBe(true);
  });
});
