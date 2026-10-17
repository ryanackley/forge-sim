#!/usr/bin/env node
/**
 * Regenerate the browser mirror of the bridge command table.
 *
 * `src/bridge-commands.ts` is canonical. The renderer is a separate build
 * whose tsconfig is `"include": ["src"]` (meaning `renderer/src`), so it
 * cannot import from the parent `src/` — the same build boundary the
 * realtime channel-key mirror crosses (see sync-channel-key-mirror.mjs).
 * This script copies everything from the first code marker onward, verbatim,
 * under a mirror-specific header, and refuses to run if anything other than
 * the header doc comment sits above the marker.
 *
 * Usage:  node scripts/sync-bridge-commands-mirror.mjs [--check]
 *
 *   (no args)  rewrite the mirror from the canonical file
 *   --check    exit non-zero if the mirror is stale, without writing (for CI)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const CANONICAL = join(repoRoot, 'src/bridge-commands.ts');
const MIRROR = join(repoRoot, 'renderer/src/bridge/bridge-commands.ts');

/** First line of the shared code section — everything from here down is copied. */
const MARKER = '/** What a host is expected to do with a command. */';

const HEADER = `/**
 * Bridge command table — browser mirror.
 *
 * ⚠️ GENERATED MIRROR of \`src/bridge-commands.ts\`. Everything below the
 * header is copied verbatim from that file. Do NOT hand-edit this file:
 * change the canonical module, then run
 * \`node scripts/sync-bridge-commands-mirror.mjs\`.
 *
 * This duplicate exists only to cross a build boundary. The renderer is a
 * separate build whose tsconfig is \`"include": ["src"]\` (meaning
 * \`renderer/src\`), so it cannot import from the parent \`src/\`.
 *
 * \`src/__tests__/bridge-command-parity.test.ts\` imports BOTH files and
 * asserts identical output over a matrix of frames, so divergence fails CI
 * instead of silently giving dev-mode and headless different bridge
 * behaviour.
 */

`;

const canonical = readFileSync(CANONICAL, 'utf8');
const markerAt = canonical.indexOf(MARKER);
if (markerAt === -1) {
  console.error(
    `[sync-bridge-commands-mirror] Could not find the code marker in ${CANONICAL}.\n` +
      `Expected a line reading exactly:\n  ${MARKER}\n` +
      `If the canonical file was restructured, update MARKER in this script.`,
  );
  process.exit(2);
}

// Guard against the marker blind spot: this script copies from the marker
// DOWN, so any real code placed ABOVE the marker in the canonical file would
// be silently excluded from the mirror forever. The only thing allowed above
// the marker is the file's header doc comment.
const aboveMarker = canonical.slice(0, markerAt);
if (!/^\s*\/\*\*[\s\S]*?\*\/\s*$/.test(aboveMarker)) {
  console.error(
    `[sync-bridge-commands-mirror] Found code above the marker in ${CANONICAL}.\n` +
      'Only the header doc comment may precede the marker line; move the code below it\n' +
      'so it is included in the mirror.',
  );
  process.exit(2);
}

const expected = HEADER + canonical.slice(markerAt);
const checkOnly = process.argv.includes('--check');

let current = null;
try {
  current = readFileSync(MIRROR, 'utf8');
} catch {
  // Missing mirror is "stale" — fall through.
}

if (current === expected) {
  console.log('[sync-bridge-commands-mirror] mirror is up to date');
  process.exit(0);
}

if (checkOnly) {
  console.error(
    '[sync-bridge-commands-mirror] MIRROR IS STALE.\n' +
      `  canonical: ${CANONICAL}\n` +
      `  mirror:    ${MIRROR}\n` +
      'Run `node scripts/sync-bridge-commands-mirror.mjs` and commit the result.',
  );
  process.exit(1);
}

writeFileSync(MIRROR, expected);
console.log(`[sync-bridge-commands-mirror] regenerated ${MIRROR}`);
