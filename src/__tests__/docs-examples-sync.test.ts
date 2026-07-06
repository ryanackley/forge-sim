/**
 * run= region sync — every doc block flagged `run=<file>#<region>` must match
 * the `// #region <name>` of the referenced test file (whitespace-normalized).
 *
 * The referenced files execute in the normal suite, so a green sync test
 * means the doc block is not just compilable but provably runnable. When this
 * test fails, the message names both sides — update whichever one is wrong
 * (usually together).
 *
 * run= file paths resolve relative to src/__tests__/.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractDocSnippets, type DocSnippet } from './helpers/doc-snippets.js';

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(TESTS_DIR, '../..');

/** Extract the body of `// #region <name>` … `// #endregion` from a file. */
function extractRegion(file: string, region: string): string {
  const lines = readFileSync(file, 'utf8').split('\n');
  const start = lines.findIndex((l) =>
    new RegExp(`^\\s*//\\s*#region\\s+${region}\\s*$`).test(l),
  );
  if (start === -1) {
    throw new Error(`region '${region}' not found in ${file}`);
  }
  const end = lines.findIndex(
    (l, i) => i > start && /^\s*\/\/\s*#endregion\b/.test(l),
  );
  if (end === -1) {
    throw new Error(`region '${region}' in ${file} has no #endregion`);
  }
  return lines.slice(start + 1, end).join('\n');
}

/**
 * Whitespace normalization: strip trailing whitespace, drop leading/trailing
 * blank lines, and dedent by the common indentation — so a region nested
 * inside an `it()` body still matches a column-0 doc block.
 */
function normalize(code: string): string {
  let lines = code.split('\n').map((l) => l.replace(/\s+$/, ''));
  while (lines.length > 0 && lines[0] === '') lines = lines.slice(1);
  while (lines.length > 0 && lines[lines.length - 1] === '') lines = lines.slice(0, -1);
  const indents = lines
    .filter((l) => l !== '')
    .map((l) => /^\s*/.exec(l)![0].length);
  const dedent = indents.length > 0 ? Math.min(...indents) : 0;
  return lines.map((l) => (l === '' ? l : l.slice(dedent))).join('\n');
}

const runSnippets = extractDocSnippets(REPO_ROOT).filter(
  (s): s is DocSnippet & { flags: { run: NonNullable<DocSnippet['flags']['run']> } } =>
    s.flags.run !== undefined,
);

describe('run= doc blocks stay in sync with their test regions', () => {
  it('found run= blocks', () => {
    expect(runSnippets.length).toBeGreaterThan(0);
  });

  it.each(
    runSnippets.map((s) => [`${s.relFile}:${s.startLine} → ${s.flags.run.file}#${s.flags.run.region}`, s] as const),
  )('%s', (_name, snippet) => {
    const targetFile = resolve(TESTS_DIR, snippet.flags.run.file);
    const region = extractRegion(targetFile, snippet.flags.run.region);
    expect(
      normalize(snippet.code),
      `Doc block at ${snippet.relFile}:${snippet.startLine} has drifted from ` +
        `region '${snippet.flags.run.region}' in src/__tests__/${snippet.flags.run.file}. ` +
        `Update whichever side is stale.`,
    ).toBe(normalize(region));
  });
});
