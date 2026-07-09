/**
 * Compile-time enforcement of the context / extension split.
 *
 * The `context` option MERGES fields onto the built context; the `extension`
 * option REPLACES the extension object. Nesting `extension` inside `context`
 * mixes the two semantics, so `ContextOverride` (render surface) and
 * `InvokeOptions['context']` (invoke surface) both carry `extension?: never`.
 *
 * `@ts-expect-error` in test files is NOT verified anywhere (tsconfig
 * excludes src/__tests__, and vitest's esbuild strips types without
 * checking), so this file does what the doc-example harness does: build a
 * real ts.Program over in-memory snippets compiled against the LIVE source
 * types, and assert diagnostics where we demand them — and, just as
 * important, assert NO diagnostics on the shapes that must stay legal.
 *
 * The runtime halves of these cases (TypeError with fix-it hint) live in
 * invoke-options.test.ts and ui-render-context-override.test.ts.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

interface Case {
  name: string;
  code: string;
  /** true → the snippet MUST fail to compile; false → MUST compile clean. */
  expectError: boolean;
}

const CASES: Case[] = [
  // ── Positive: shapes that must stay legal ────────────────────────────────
  {
    name: 'render: context + extension side by side (the fully-mocked combo)',
    expectError: false,
    code: `
      import type { RenderContextOptions } from '../context.js';
      const opts: RenderContextOptions = {
        context: { accountId: 'alice', locale: 'de-DE', issueKey: 'PROJ-1', tenantTag: 'pro' },
        extension: { issue: { key: 'PROJ-1', id: '10001' }, project: { key: 'PROJ' } },
      };
      export default opts;
    `,
  },
  {
    name: 'render: context via a pre-built variable without extension',
    expectError: false,
    code: `
      import type { RenderContextOptions } from '../context.js';
      const fromVar = { accountId: 'alice', tenantTag: 'pro' };
      const opts: RenderContextOptions = { context: fromVar };
      export default opts;
    `,
  },
  {
    name: 'invoke: context + extension side by side',
    expectError: false,
    code: `
      import type { InvokeOptions } from '../types.js';
      const opts: InvokeOptions = {
        moduleKey: 'panel',
        context: { accountId: 'alice', principal: 'user' },
        extension: { content: { id: '12345' } },
      };
      export default opts;
    `,
  },

  // ── Negative: shapes the type must reject ────────────────────────────────
  {
    name: 'render: extension nested inside a context literal',
    expectError: true,
    code: `
      import type { RenderContextOptions } from '../context.js';
      const opts: RenderContextOptions = {
        context: { accountId: 'alice', extension: { issueKey: 'PROJ-1' } },
      };
      export default opts;
    `,
  },
  {
    name: 'render: extension smuggled in via a pre-built variable (structural typing leak)',
    expectError: true,
    code: `
      import type { RenderContextOptions } from '../context.js';
      const fromVar = { accountId: 'alice', extension: { issueKey: 'PROJ-1' } };
      const opts: RenderContextOptions = { context: fromVar };
      export default opts;
    `,
  },
  {
    name: 'invoke: extension nested inside a context literal',
    expectError: true,
    code: `
      import type { InvokeOptions } from '../types.js';
      const opts: InvokeOptions = { context: { extension: { spaceKey: 'TEAM' } } };
      export default opts;
    `,
  },
  {
    name: 'invoke: extension smuggled in via a pre-built variable',
    expectError: true,
    code: `
      import type { InvokeOptions } from '../types.js';
      const fromVar = { accountId: 'bob', extension: { spaceKey: 'TEAM' } };
      const opts: InvokeOptions = { context: fromVar };
      export default opts;
    `,
  },
];

// Virtual files live in a fake dir directly under src/ so relative imports
// ('../context.js', '../types.js') resolve to the live source files.
const COMPILER_OPTIONS: ts.CompilerOptions = {
  strict: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.Node16,
  moduleResolution: ts.ModuleResolutionKind.Node16,
  jsx: ts.JsxEmit.ReactJSX,
  noEmit: true,
  skipLibCheck: true,
};

function casePath(idx: number): string {
  return `${REPO_ROOT}/src/__extension_split_cases__/case_${idx}.mts`;
}

describe('context.extension is rejected by the type system', () => {
  let diagnosticsByCase: string[][];

  beforeAll(() => {
    const byPath = new Map(CASES.map((c, i) => [casePath(i), c.code]));
    const host = ts.createCompilerHost(COMPILER_OPTIONS);
    const realGetSourceFile = host.getSourceFile.bind(host);
    const realReadFile = host.readFile.bind(host);
    const realFileExists = host.fileExists.bind(host);

    host.getSourceFile = (fileName, languageVersion, ...rest) => {
      const code = byPath.get(fileName);
      if (code !== undefined) {
        return ts.createSourceFile(fileName, code, languageVersion, true);
      }
      return realGetSourceFile(fileName, languageVersion, ...rest);
    };
    host.readFile = (fileName) => byPath.get(fileName) ?? realReadFile(fileName);
    host.fileExists = (fileName) => byPath.has(fileName) || realFileExists(fileName);

    const program = ts.createProgram([...byPath.keys()], COMPILER_OPTIONS, host);

    diagnosticsByCase = CASES.map((_, i) => {
      const sf = program.getSourceFile(casePath(i));
      if (!sf) return [`internal: missing virtual source file for case ${i}`];
      return [
        ...program.getSyntacticDiagnostics(sf),
        ...program.getSemanticDiagnostics(sf),
      ].map((d) => `TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
    });
  }, 120_000);

  it.each(CASES.map((c, i) => [c.name, i] as const))('%s', (_name, idx) => {
    const diags = diagnosticsByCase[idx];
    if (CASES[idx].expectError) {
      expect(
        diags.length,
        `expected a compile error, got none — the type no longer rejects nested extension`
      ).toBeGreaterThan(0);
      // The rejection must be the extension?: never slot, not some incidental
      // breakage. TS phrases it two ways depending on the assignment path:
      //   - literal:  "...'extension' are incompatible" / "not assignable to type 'never'"
      //   - variable: "Type '{ ... }' is not assignable to type 'undefined'"
      //     (optional `never` prop flattens to `undefined` in the message)
      expect(
        diags.join('\n'),
        `compile error exists but is not the extension rejection:\n${diags.join('\n')}`
      ).toMatch(/extension|not assignable to type '(?:undefined|never)'/);
    } else {
      expect(diags, diags.join('\n')).toEqual([]);
    }
  });
});
