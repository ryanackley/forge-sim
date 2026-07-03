/**
 * @forge/react shim parity tests.
 *
 * Two jobs:
 *   1. Drift detection — fail if real @forge/react adds a public component/hook
 *      that our shim hasn't re-exported. This stops us shipping a shim that
 *      silently drops symbols.
 *   2. Casing-trap parity — ensure forge-sim does NOT expose component names
 *      that don't exist in real @forge/react. The classic offender is
 *      `TextField` (uppercase F): the props type is `TextfieldProps` so devs
 *      reach for `TextField`, but the real export is `Textfield`. Aliasing it
 *      in the shim would mask a bug that explodes on deploy.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

// Stub the browser bridge globals before loading @forge/react. Real
// @forge/bridge's invoke module calls getCallBridge() at module-load time,
// which throws if __bridge.callBridge isn't present. We're not invoking
// anything here — we just need the module graph to load so we can
// introspect the named exports.
// @forge/bridge 5.x looked at window.__bridge; 6.x (nested inside
// @forge/react 12) looks at globalThis.__bridge. Stub both.
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {};
}
if (!(globalThis as any).window.__bridge) {
  (globalThis as any).window.__bridge = { callBridge: () => undefined };
}
if (!(globalThis as any).__bridge) {
  (globalThis as any).__bridge = { callBridge: () => undefined };
}

// Resolve real @forge/react from forge-sim's own node_modules — same trick
// the shim uses, so we compare apples to apples.
const require = createRequire(import.meta.url);
const realPath = resolve(__dirname, '..', '..', 'node_modules', '@forge', 'react');
const realModule = require(realPath);

// We deliberately skip these even though they exist in real @forge/react.
// Add to this set with a comment when intentionally excluding something.
const INTENTIONALLY_SKIPPED = new Set<string>([
  'default',         // re-exported as `default` already
  '__esModule',      // CJS interop marker
]);

// Names that must NEVER be exported from the shim — keeps us honest about
// parity violations like the Textfield/TextField casing trap.
const FORBIDDEN_EXPORTS = [
  // Real export is `Textfield` (lowercase f). `TextField` is the most common
  // Forge gotcha — we let it fail loud in tests instead of silently passing.
  'TextField',
];

/** Looks like a component (PascalCase function/class) or hook (`useFoo`). */
function isPublicSymbol(key: string, value: unknown): boolean {
  if (INTENTIONALLY_SKIPPED.has(key)) return false;
  if (typeof value !== 'function' && typeof value !== 'object') return false;
  if (value === null) return false;
  // PascalCase = component, useXxx = hook. Skip lowerCamelCase utilities and
  // ALL_CAPS constants — those are internals we don't need to mirror.
  return /^[A-Z]/.test(key) || /^use[A-Z]/.test(key);
}

describe('@forge/react shim parity', () => {
  it('re-exports every public component and hook from real @forge/react', async () => {
    // Import the shim through the alias so we test what consumers actually see
    const shim = await import('@forge/react');

    const realPublicKeys = Object.keys(realModule)
      .filter(key => isPublicSymbol(key, realModule[key]))
      .sort();

    const missing = realPublicKeys.filter(key => !(key in shim));

    expect(missing, `shim is missing ${missing.length} public exports from real @forge/react: ${missing.join(', ')}`).toEqual([]);
  });

  it('does NOT expose forbidden aliases (parity violations)', async () => {
    const shim = await import('@forge/react');

    const leaked = FORBIDDEN_EXPORTS.filter(key => key in shim);

    expect(
      leaked,
      `shim leaks symbols that don't exist in real @forge/react: ${leaked.join(', ')}. ` +
        `These would let bad code pass forge-sim tests but fail on deploy.`,
    ).toEqual([]);
  });

  it('confirms the parity assumption: real @forge/react has Textfield, not TextField', () => {
    expect('Textfield' in realModule, '@forge/react no longer exports Textfield — update the shim').toBe(true);
    expect('TextField' in realModule, '@forge/react now exports TextField — the casing trap is gone, drop the FORBIDDEN_EXPORTS guard').toBe(false);
  });
});
