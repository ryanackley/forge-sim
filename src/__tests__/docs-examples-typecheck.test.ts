/**
 * Doc-example drift guard — every TS code block in the markdown docs must
 * typecheck against the LIVE source API (src/simulator.ts, src/shims/*), and
 * every yaml manifest block must parse cleanly.
 *
 * How blocks are handled (see src/__tests__/helpers/doc-snippets.ts for the
 * fence-flag convention):
 *
 *   - Blocks containing top-level `import` are compiled verbatim as ESM
 *     modules — they must be copy-paste runnable. Using an unimported symbol
 *     is a doc bug, and this test will say so.
 *   - Fragment blocks (no imports) are wrapped in an async arrow with an
 *     ambient preamble providing `sim`, `createSimulator`, etc. — the world a
 *     reader mentally carries between blocks.
 *   - Back-to-back variants (`const sim = ...` twice) are split into
 *     independently-compiled segments.
 *
 * Failures point back at the markdown source: `docs/reference/api.md:49`.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
  extractDocSnippets,
  typecheckableSnippets,
  manifestSnippets,
  splitRedeclarationSegments,
  type DocSnippet,
} from './helpers/doc-snippets.js';
import { parseManifestContent } from '../manifest.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// ---------------------------------------------------------------------------
// Virtual file construction
// ---------------------------------------------------------------------------

/**
 * Ambient world for snippets: the reader has already seen
 * `import { createSimulator } from 'forge-sim'` and `const sim = ...` in a
 * previous block. Namespace alias avoids identifier collisions with anything
 * a snippet declares itself; declares whose names a snippet imports itself
 * are filtered out to avoid TS2300 duplicates.
 */
const PREAMBLE_DECLS: Array<[name: string, line: string]> = [
  // `let`, not `const` — several docs blocks reassign (`sim = createSimulator()`)
  // inside a beforeEach, mirroring the surrounding test-file world.
  ['sim', `declare let sim: __fs.ForgeSimulator;`],
  ['createSimulator', `declare const createSimulator: typeof __fs.createSimulator;`],
  ['getSimulator', `declare const getSimulator: typeof __fs.getSimulator;`],
  ['setSimulator', `declare const setSimulator: typeof __fs.setSimulator;`],
  ['WhereConditions', `declare const WhereConditions: typeof __fs.WhereConditions;`],
  ['Sort', `declare const Sort: typeof __fs.Sort;`],
  ['route', `declare const route: typeof __fs.route;`],
  ['mockResponse', `declare const mockResponse: typeof __fs.mockResponse;`],
  ['payload', `declare const payload: Record<string, unknown>;`],
  ['ForgeSimulator', `type ForgeSimulator = __fs.ForgeSimulator;`],
  ['ParsedManifest', `type ParsedManifest = __fs.ParsedManifest;`],
  ['ResolverContext', `type ResolverContext = __fs.ResolverContext;`],
];

/** Identifiers a snippet imports itself (so the preamble must not redeclare). */
function importedNames(importLines: string[]): Set<string> {
  const names = new Set<string>();
  for (const line of importLines) {
    const braces = /\{([^}]*)\}/.exec(line);
    if (braces) {
      for (const part of braces[1].split(',')) {
        const name = part.replace(/^\s*type\s+/, '').split(/\s+as\s+/).pop()?.trim();
        if (name) names.add(name);
      }
    }
    const dflt = /^import\s+(?:type\s+)?([A-Za-z_$][\w$]*)\s*(?:,|from)/.exec(line);
    if (dflt) names.add(dflt[1]);
    const star = /\*\s+as\s+([A-Za-z_$][\w$]*)/.exec(line);
    if (star) names.add(star[1]);
  }
  return names;
}

function buildPreamble(imported: Set<string>): string[] {
  return [
    `import type * as __fs from 'forge-sim';`,
    ...PREAMBLE_DECLS.filter(([name]) => !imported.has(name)).map(([, l]) => l),
    `export {};`,
  ];
}

interface VirtualFile {
  /** Absolute (fake) path ending in .mts so TS treats it as ESM. */
  path: string;
  text: string;
  /** virtual line (0-based) → original markdown line (1-based), or null for harness lines. */
  lineMap: Array<number | null>;
  snippet: DocSnippet;
  /** Display name for the test. */
  name: string;
}

function buildVirtualFiles(snippets: DocSnippet[]): VirtualFile[] {
  const files: VirtualFile[] = [];

  for (const snippet of snippets) {
    const codeLines = snippet.code.split('\n');
    // Blocks with top-level `export` are complete app modules (e.g. resolver
    // files ending in `export const handler = ...`) — compile verbatim, no
    // async wrapper (which would make `export` illegal).
    const isModule = codeLines.some((l) => /^export[\s{]/.test(l));

    // Hoist top-level import lines so the rest can live inside the wrapper.
    const importLines: Array<{ text: string; orig: number }> = [];
    const bodyLines: Array<{ text: string; orig: number }> = [];
    for (let i = 0; i < codeLines.length; i++) {
      const target =
        !isModule && /^import[\s{]/.test(codeLines[i]) ? importLines : bodyLines;
      target.push({ text: codeLines[i], orig: snippet.startLine + i });
    }

    const preamble = buildPreamble(
      importedNames(
        (isModule ? codeLines.filter((l) => /^import[\s{]/.test(l)) : []).concat(
          importLines.map((l) => l.text),
        ),
      ),
    );

    const segments = isModule
      ? [{ code: bodyLines.map((l) => l.text).join('\n'), lineOffset: 0 }]
      : splitRedeclarationSegments(bodyLines.map((l) => l.text).join('\n'));

    segments.forEach((segment, idx) => {
      const segLines = bodyLines.slice(
        segment.lineOffset,
        segment.lineOffset + segment.code.split('\n').length,
      );
      const text: string[] = [];
      const lineMap: Array<number | null> = [];

      const push = (t: string, orig: number | null): void => {
        text.push(t);
        lineMap.push(orig);
      };

      for (const l of importLines) push(l.text, l.orig);
      for (const p of preamble) push(p, null);
      if (!isModule) push(`async () => {`, null);
      for (const l of segLines) push(l.text, l.orig);
      if (!isModule) push(`};`, null);

      const slug = snippet.relFile.replace(/[^\w]+/g, '_');
      const suffix = segments.length > 1 ? `_seg${idx}` : '';
      files.push({
        path: `${REPO_ROOT}/__doc_snippets__/${slug}_L${snippet.startLine}${suffix}.mts`,
        text: text.join('\n'),
        lineMap,
        snippet,
        name:
          `${snippet.relFile}:${snippet.startLine}` +
          (segments.length > 1 ? ` (variant ${idx + 1})` : ''),
      });
    });
  }
  return files;
}

// ---------------------------------------------------------------------------
// One shared ts.Program for all snippets
// ---------------------------------------------------------------------------

/** Mirrors vitest.config.ts aliases + maps 'forge-sim' to live source. */
const COMPILER_OPTIONS: ts.CompilerOptions = {
  strict: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.Node16,
  moduleResolution: ts.ModuleResolutionKind.Node16,
  jsx: ts.JsxEmit.ReactJSX,
  noEmit: true,
  skipLibCheck: true,
  types: ['node', 'vitest/globals'],
  baseUrl: REPO_ROOT,
  paths: {
    'forge-sim': ['src/index.ts'],
    'forge-sim/shims/*': ['src/shims/*'],
    '@forge/api': ['src/shims/forge-api.ts'],
    '@forge/kvs': ['src/shims/forge-kvs.ts'],
    '@forge/events': ['src/shims/forge-events.ts'],
    '@forge/resolver': ['src/shims/forge-resolver.ts'],
    '@forge/object-store': ['src/shims/forge-object-store.ts'],
    '@forge/bridge': ['src/shims/forge-bridge.ts'],
    // Subpath before bare package — same ordering gotcha as vitest.config.ts.
    '@forge/react/router': ['src/shims/forge-react-router.ts'],
    '@forge/react': ['src/shims/forge-react.ts'],
  },
};

function createProgram(virtualFiles: VirtualFile[]): ts.Program {
  const byPath = new Map(virtualFiles.map((f) => [f.path, f]));
  const host = ts.createCompilerHost(COMPILER_OPTIONS);
  const realGetSourceFile = host.getSourceFile.bind(host);
  const realReadFile = host.readFile.bind(host);
  const realFileExists = host.fileExists.bind(host);

  host.getSourceFile = (fileName, languageVersion, ...rest) => {
    const vf = byPath.get(fileName);
    if (vf) {
      return ts.createSourceFile(fileName, vf.text, languageVersion, true);
    }
    return realGetSourceFile(fileName, languageVersion, ...rest);
  };
  host.readFile = (fileName) => byPath.get(fileName)?.text ?? realReadFile(fileName);
  host.fileExists = (fileName) => byPath.has(fileName) || realFileExists(fileName);

  return ts.createProgram(
    virtualFiles.map((f) => f.path),
    COMPILER_OPTIONS,
    host,
  );
}

function formatDiagnostics(
  program: ts.Program,
  vf: VirtualFile,
): string[] {
  const sf = program.getSourceFile(vf.path);
  if (!sf) return [`internal: virtual source file missing for ${vf.name}`];
  const diags = [
    ...program.getSyntacticDiagnostics(sf),
    ...program.getSemanticDiagnostics(sf),
  ];
  return diags.map((d) => {
    let location = vf.snippet.relFile;
    if (d.start !== undefined) {
      const { line } = sf.getLineAndCharacterOfPosition(d.start);
      const mdLine = vf.lineMap[line];
      location =
        mdLine !== null && mdLine !== undefined
          ? `${vf.snippet.relFile}:${mdLine}`
          : `${vf.snippet.relFile}:${vf.snippet.startLine} (harness preamble)`;
    }
    return `${location} — TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const allSnippets = extractDocSnippets(REPO_ROOT);
const tsSnippets = typecheckableSnippets(allSnippets);
const virtualFiles = buildVirtualFiles(tsSnippets);

describe('doc examples typecheck against the live API', () => {
  let program: ts.Program;

  beforeAll(() => {
    program = createProgram(virtualFiles);
  }, 120_000);

  it('found a sane number of checkable TS blocks', () => {
    // Canary: if extraction breaks and returns nothing, every block-level
    // test would vacuously disappear. Docs currently have 100+ TS blocks.
    expect(tsSnippets.length).toBeGreaterThan(40);
  });

  it.each(virtualFiles.map((vf) => [vf.name, vf] as const))(
    '%s',
    (_name, vf) => {
      const errors = formatDiagnostics(program, vf);
      expect(errors, errors.join('\n')).toEqual([]);
    },
  );
});

describe('doc manifest yaml blocks parse cleanly', () => {
  const manifests = manifestSnippets(allSnippets);

  it('found manifest yaml blocks', () => {
    expect(manifests.length).toBeGreaterThan(0);
  });

  it.each(manifests.map((s) => [`${s.relFile}:${s.startLine}`, s] as const))(
    '%s',
    (_name, snippet) => {
      // Doc manifests are deliberately partial (no app.runtime, no icons) —
      // only unknown module types indicate drift from KNOWN_MODULE_TYPES.
      const parsed = parseManifestContent(snippet.code);
      const problems = parsed.warnings.filter((w) =>
        w.message.startsWith('Unknown module type'),
      );
      expect(problems, problems.map((p) => p.message).join('\n')).toEqual([]);
    },
  );
});
