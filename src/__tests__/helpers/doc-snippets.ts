/**
 * Doc snippet extractor — pulls fenced code blocks out of the markdown docs
 * so tests can typecheck / execute / sync-check them.
 *
 * Fence flag convention (info string after the language token; invisible in
 * rendered markdown — GitHub only uses the first token for highlighting):
 *
 *   ```ts                                     → checked (default)
 *   ```ts no-check                            → skipped (illustrative pseudo-code,
 *                                               output shapes, type signatures)
 *   ```ts run=docs-examples/foo.test.ts#name  → must match the #region `name` of
 *                                               that real test file (which executes
 *                                               in the normal suite)
 *
 * See docs/testing/README.md § "Doc examples are tested".
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export interface DocSnippetFlags {
  /** Block is deliberately not compilable — skip typechecking. */
  noCheck: boolean;
  /** `run=<file>#<region>` reference to a real test file region. */
  run?: { file: string; region: string };
}

export interface DocSnippet {
  /** Absolute path of the markdown file. */
  file: string;
  /** Repo-relative path (for readable test names). */
  relFile: string;
  /** 1-based line number of the first line of code (line after the fence). */
  startLine: number;
  /** Normalized language token (lowercased, e.g. 'ts', 'typescript', 'yaml'). */
  lang: string;
  flags: DocSnippetFlags;
  code: string;
}

/** Markdown files covered by doc-example tests: README.md + docs/**\/*.md. */
export function listDocFiles(repoRoot: string): string[] {
  const files: string[] = [join(repoRoot, 'README.md')];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.md')) files.push(full);
    }
  };
  walk(join(repoRoot, 'docs'));
  return files.sort();
}

function parseFlags(tokens: string[]): DocSnippetFlags {
  const flags: DocSnippetFlags = { noCheck: false };
  for (const token of tokens) {
    if (token === 'no-check') {
      flags.noCheck = true;
    } else if (token.startsWith('run=')) {
      const ref = token.slice('run='.length);
      const hash = ref.indexOf('#');
      if (hash === -1) {
        throw new Error(
          `Invalid run= flag '${token}' — expected run=<file>#<region>`,
        );
      }
      flags.run = { file: ref.slice(0, hash), region: ref.slice(hash + 1) };
    } else {
      throw new Error(
        `Unknown doc-snippet flag '${token}' — supported: no-check, run=<file>#<region>`,
      );
    }
  }
  return flags;
}

/**
 * Extract all fenced code blocks from a markdown file.
 *
 * CommonMark-ish fence handling: a fence opens with 3+ backticks or tildes
 * (optionally indented up to 3 spaces) and closes with a fence of the same
 * character at least as long, with nothing else on the line. Blocks inside a
 * longer outer fence (e.g. ```` markdown examples containing ``` ````) stay
 * part of the outer block.
 */
export function extractSnippetsFromFile(
  file: string,
  repoRoot: string,
): DocSnippet[] {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const snippets: DocSnippet[] = [];

  let open: {
    char: string;
    len: number;
    indent: number;
    lang: string;
    flags: DocSnippetFlags;
    startLine: number; // 1-based first code line
    buf: string[];
  } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(line);

    if (open) {
      // Closing fence: same char, >= length, rest is blank.
      if (
        m &&
        m[2][0] === open.char &&
        m[2].length >= open.len &&
        m[3].trim() === ''
      ) {
        snippets.push({
          file,
          relFile: relative(repoRoot, file),
          startLine: open.startLine,
          lang: open.lang,
          flags: open.flags,
          code: open.buf.join('\n'),
        });
        open = null;
      } else {
        open.buf.push(
          // Strip the opening fence's indentation from indented blocks.
          open.indent > 0 ? line.replace(new RegExp(`^ {0,${open.indent}}`), '') : line,
        );
      }
      continue;
    }

    if (m) {
      const info = m[3].trim();
      // Backtick fences cannot contain backticks in the info string (CommonMark).
      if (m[2][0] === '`' && info.includes('`')) continue;
      const tokens = info.split(/\s+/).filter(Boolean);
      const lang = (tokens[0] ?? '').toLowerCase();
      open = {
        char: m[2][0],
        len: m[2].length,
        indent: m[1].length,
        lang,
        flags: parseFlags(tokens.slice(1)),
        startLine: i + 2, // next line, 1-based
        buf: [],
      };
    }
  }

  if (open) {
    throw new Error(
      `${relative(repoRoot, file)}: unclosed code fence starting at line ${open.startLine - 1}`,
    );
  }
  return snippets;
}

/** Extract all snippets from README.md + docs/**\/*.md. */
export function extractDocSnippets(repoRoot: string): DocSnippet[] {
  return listDocFiles(repoRoot).flatMap((f) =>
    extractSnippetsFromFile(f, repoRoot),
  );
}

const TS_LANGS = new Set(['ts', 'typescript']);

/** TS blocks that should compile (includes run= blocks; excludes no-check). */
export function typecheckableSnippets(snippets: DocSnippet[]): DocSnippet[] {
  return snippets.filter((s) => TS_LANGS.has(s.lang) && !s.flags.noCheck);
}

/** yaml blocks that look like Forge manifests. */
export function manifestSnippets(snippets: DocSnippet[]): DocSnippet[] {
  return snippets.filter(
    (s) =>
      (s.lang === 'yaml' || s.lang === 'yml') &&
      !s.flags.noCheck &&
      /^\s*modules:/m.test(s.code),
  );
}

/**
 * Split a snippet body into independently-compilable segments.
 *
 * Docs often show variants of the same call back-to-back:
 *
 *   const sim = createSimulator();
 *   const sim = createSimulator({ ... });   // ← redeclaration
 *
 * Valid documentation, invalid TypeScript. When a top-level (column-0)
 * const/let/var redeclares a name already declared in the current segment,
 * start a new segment so each variant typechecks in isolation.
 *
 * Returns segments with their line offset into the original snippet.
 */
export function splitRedeclarationSegments(
  code: string,
): Array<{ code: string; lineOffset: number }> {
  const lines = code.split('\n');
  const segments: Array<{ code: string; lineOffset: number }> = [];
  let declared = new Set<string>();
  let start = 0;

  for (let i = 0; i < lines.length; i++) {
    const m = /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(lines[i]);
    if (m) {
      if (declared.has(m[1])) {
        segments.push({ code: lines.slice(start, i).join('\n'), lineOffset: start });
        start = i;
        declared = new Set<string>();
      }
      declared.add(m[1]);
    }
  }
  segments.push({ code: lines.slice(start).join('\n'), lineOffset: start });
  return segments;
}
