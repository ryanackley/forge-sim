/**
 * Tests for the `@forge/react` shim's component allowlist.
 *
 * The shim at `src/shims/forge-react.ts` loads the real @forge/react package
 * and explicitly re-exports each named component. Vitest aliases redirect
 * user code to this shim, so the components the user can import are exactly
 * the ones this file re-exports — not the ones the real package contains.
 *
 * That manual list has drifted from reality in both directions:
 *   - Missing real components → user imports fail outright
 *   - Re-exporting removed UIKit 1 components → user gets `undefined` and
 *     renders <undefined />, which fails silently at runtime
 *
 * These tests pin down the post-Option-A state. They DON'T fully solve the
 * drift problem — a future automated sync against real @forge/react would.
 * See the discussion under N4 in the audit notes.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SHIM_PATH = join(import.meta.dirname, '..', 'shims', 'forge-react.ts');
const REAL_DTS_PATH = join(
  import.meta.dirname,
  '..',
  '..',
  'node_modules',
  '@forge',
  'react',
  'out',
  'components',
  'ui-kit-components.d.ts',
);

const shimContent = readFileSync(SHIM_PATH, 'utf8');

/** Match `export const Foo =` (the shim's re-export pattern). */
function shimExports(name: string): boolean {
  return new RegExp(`^\\s*export\\s+const\\s+${name}\\s*=`, 'm').test(
    shimContent,
  );
}

describe('@forge/react shim — known real components', () => {
  // These are components that exist in the real @forge/react package and
  // should be re-exported by the shim. If real @forge/react ever drops one,
  // the corresponding test should be deleted, not silently left in.
  const REAL_COMPONENTS = [
    // The bug N4 was about
    'List',
    'ListItem',
    // Spot-check the rest of the surface so a wholesale shim regression
    // (e.g. someone accidentally guts the file) gets caught
    'Box',
    'Stack',
    'Heading',
    'Text',
    'Button',
    'DynamicTable',
    'Textfield',
    'Select',
    'SectionMessage',
    'Modal',
    'Popup',
  ];

  it.each(REAL_COMPONENTS)('shim re-exports "%s"', (name) => {
    expect(shimExports(name)).toBe(true);
  });
});

describe('@forge/react shim — dead UIKit 1 components must not return', () => {
  // These were removed from real @forge/react. Re-exporting them returns
  // `undefined` from `realModule.X`, which then renders `<undefined />` —
  // a silent footgun. Block reintroduction.
  const DEAD_COMPONENTS = ['Table', 'Head', 'Row', 'Cell', 'Flag', 'InlineDialog'];

  it.each(DEAD_COMPONENTS)('shim does NOT re-export "%s" (removed from real @forge/react)', (name) => {
    expect(shimExports(name)).toBe(false);
  });

  it('real @forge/react .d.ts does not declare any of the dead components', () => {
    // Sanity check: if Atlassian ever brings these back, this assertion
    // fails and the corresponding shim re-exports can be re-added with a
    // clear test failure trail. (As of @forge/react@11.13.0 they're gone.)
    const realDts = readFileSync(REAL_DTS_PATH, 'utf8');
    for (const name of DEAD_COMPONENTS) {
      expect(
        new RegExp(`^export\\s+declare\\s+const\\s+${name}\\b`, 'm').test(realDts),
        `Unexpectedly found "${name}" in real @forge/react UIKit components.`,
      ).toBe(false);
    }
  });
});

// Note: A lightweight auto-drift check (scan real @forge/react's
// ui-kit-components.d.ts, assert the shim covers each value export) was
// drafted alongside this fix. Running it surfaced 24 additional missing
// components (charts, form parts, editors, AtlassianIcon, etc.) beyond
// List/ListItem — bigger than this point fix. Tracked in the issue for
// the structural shim-sync fix (Option B/C).
