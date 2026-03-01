/**
 * ForgeDoc tree utilities — find, extract, interact with rendered UI components.
 */

import type { ForgeDoc } from './bridge.js';

/** Find all nodes matching a component type. */
export function findByType(doc: ForgeDoc, type: string): ForgeDoc[] {
  const results: ForgeDoc[] = [];
  function walk(node: ForgeDoc) {
    if (node.type === type) results.push(node);
    for (const child of node.children ?? []) walk(child);
  }
  walk(doc);
  return results;
}

/** Find the first node matching a component type, or null. */
export function findFirstByType(doc: ForgeDoc, type: string): ForgeDoc | null {
  if (doc.type === type) return doc;
  for (const child of doc.children ?? []) {
    const found = findFirstByType(child, type);
    if (found) return found;
  }
  return null;
}

/** Find nodes whose props match all given key/value pairs. */
export function findByProps(doc: ForgeDoc, props: Record<string, any>): ForgeDoc[] {
  const results: ForgeDoc[] = [];
  function walk(node: ForgeDoc) {
    const matches = Object.entries(props).every(([key, value]) => node.props[key] === value);
    if (matches) results.push(node);
    for (const child of node.children ?? []) walk(child);
  }
  walk(doc);
  return results;
}

/** Extract all text content from a subtree (from 'String' nodes). */
export function getTextContent(doc: ForgeDoc): string {
  const texts: string[] = [];
  function walk(node: ForgeDoc) {
    if (node.type === 'String' && node.props.text != null) {
      texts.push(String(node.props.text));
    }
    for (const child of node.children ?? []) walk(child);
  }
  walk(doc);
  return texts.join('');
}

/** Simulate an event (e.g. onClick, onChange) on a node. */
export function simulateEvent(node: ForgeDoc, eventName: string, ...args: any[]): any {
  const handler = node.props[eventName];
  if (typeof handler === 'function') return handler(...args);
  return undefined;
}

/** List all unique component types in a tree. */
export function listComponentTypes(doc: ForgeDoc): string[] {
  const types = new Set<string>();
  function walk(node: ForgeDoc) {
    if (node.type !== 'String') types.add(node.type);
    for (const child of node.children ?? []) walk(child);
  }
  walk(doc);
  return [...types];
}

/** Find a component by type and optional text content. */
export function findByTypeAndText(
  doc: ForgeDoc,
  type: string,
  matchText?: string,
  nthMatch?: number
): ForgeDoc {
  const candidates = findByType(doc, type);
  if (candidates.length === 0) {
    const available = listComponentTypes(doc).join(', ');
    throw new Error(`No ${type} found. Available components: ${available}`);
  }

  let matches = candidates;
  if (matchText) {
    matches = candidates.filter((node) => getTextContent(node).includes(matchText));
    if (matches.length === 0) {
      const texts = candidates.map((n) => getTextContent(n) || '(no text)');
      throw new Error(
        `No ${type} containing "${matchText}". Found ${type} nodes with text: ${texts.join(', ')}`
      );
    }
  }

  const idx = (nthMatch ?? 1) - 1;
  if (idx >= matches.length) {
    throw new Error(`Requested match #${nthMatch} but only ${matches.length} ${type} node(s) found.`);
  }
  return matches[idx];
}

/** Pretty-print a ForgeDoc tree. */
export function prettyPrint(doc: ForgeDoc, indent = 0): string {
  const pad = '  '.repeat(indent);
  const propsStr = Object.entries(doc.props)
    .filter(([, v]) => typeof v !== 'function' && typeof v !== 'object')
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(' ');

  let line = `${pad}<${doc.type}`;
  if (propsStr) line += ` ${propsStr}`;

  if (doc.children.length === 0) return line + ' />';

  line += '>';
  const childLines = doc.children.map((c) => prettyPrint(c, indent + 1));
  return [line, ...childLines, `${pad}</${doc.type}>`].join('\n');
}
