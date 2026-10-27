/**
 * Tests that spawn the compiled CLI or MCP server (`dist/`) exercise whatever
 * was last built, not `src/`: `npm test` does not build first. Against a dist
 * older than its source they pass or fail for the wrong reason (a regression
 * in `src/cli.ts` stays invisible to them until the next build). Those tests
 * call `assertDistFresh()` in a `beforeAll`, so a stale build fails them with
 * the fix instead. A MISSING dist still skips (`describe.runIf(hasDist)`),
 * like every other dist-backed test in the suite.
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');
const SRC_DIR = join(REPO_ROOT, 'src');

/** The most recently modified compiled source under src/ (tests excluded). */
function newestSource(dir: string): { file: string; mtimeMs: number } {
  let newest = { file: '', mtimeMs: 0 };
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      const inner = newestSource(path);
      if (inner.mtimeMs > newest.mtimeMs) newest = inner;
    } else if (/\.(ts|tsx|mts)$/.test(entry.name)) {
      const { mtimeMs } = statSync(path);
      if (mtimeMs > newest.mtimeMs) newest = { file: path, mtimeMs };
    }
  }
  return newest;
}

/** Throw when `distFile` is older than any source file it could be built from. */
export function assertDistFresh(distFile: string): void {
  const built = statSync(distFile).mtimeMs;
  const newest = newestSource(SRC_DIR);
  if (newest.mtimeMs > built) {
    throw new Error(
      `${relative(REPO_ROOT, distFile)} is older than ${relative(REPO_ROOT, newest.file)}: ` +
      `these tests run the compiled build, so they would test stale code. Run \`npm run build\` first.`,
    );
  }
}
