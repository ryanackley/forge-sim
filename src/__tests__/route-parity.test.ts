/**
 * route() parity — differential suite against the REAL @forge/api.
 *
 * `route` is Atlassian's path-traversal defense and its behavior is subtle
 * (mode-aware escaping; see assertions below). Our shim used to hand-roll it
 * and drifted: always-encoding, never throwing — an app interpolating a
 * user-supplied `/` passed in the sim and threw in production.
 *
 * The fix re-exports the real implementation (shim → real package
 * fallthrough), so most of this file is near-tautological TODAY. That is the
 * point of keeping it:
 *
 *   1. The differential half fails if the shim ever stops serving the real
 *      functions (a refactor reintroducing a local copy).
 *   2. The absolute half pins the CURRENT real behavior, so an upstream
 *      @forge/api bump that changes route semantics fails the version-bump
 *      ritual visibly instead of sliding through.
 *
 * The real module is loaded by explicit path — a bare specifier resolves to
 * the shim under vitest, which would make every comparison a self-compare.
 */
import { describe, it, expect } from 'vitest';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import * as shim from '../shims/forge-api.js';
import { createSimulator } from '../simulator.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const real = createRequire(import.meta.url)(
  join(REPO_ROOT, 'node_modules/@forge/api/out/index.js'),
);

type Tag = (strings: TemplateStringsArray, ...values: any[]) => { value: string };

/** Run a tagged-template invocation against both and compare outcome. */
function differential(fn: (tag: Tag) => { value: string }) {
  let realOut: string | undefined, realErr: string | undefined;
  let shimOut: string | undefined, shimErr: string | undefined;
  try { realOut = fn(real.route).value; } catch (e: any) { realErr = e.message; }
  try { shimOut = fn((shim as any).route).value; } catch (e: any) { shimErr = e.message; }
  expect(shimOut).toBe(realOut);
  expect(shimErr).toBe(realErr);
  return { out: realOut, err: realErr };
}

describe('route(): shim ≡ real @forge/api (differential)', () => {
  it('serves the real implementation, not a lookalike', () => {
    // Strongest possible check: same function object.
    expect((shim as any).route).toBe(real.route);
    expect((shim as any).routeFromAbsolute).toBe(real.routeFromAbsolute);
    expect((shim as any).assumeTrustedRoute).toBe(real.assumeTrustedRoute);
  });

  it.each([
    ['plain path param', (t: Tag) => t`/rest/api/3/issue/${'PROJ-1'}`],
    ['space in path param', (t: Tag) => t`/x/${'a b'}`],
    ['unicode in path param', (t: Tag) => t`/x/${'å'}`],
    ['number param', (t: Tag) => t`/x/${42}`],
    ['traversal: dotdot', (t: Tag) => t`/x/${'../etc'}`],
    ['traversal: slash', (t: Tag) => t`/x/${'a/b'}`],
    ['traversal: backslash', (t: Tag) => t`/x/${'a\\b'}`],
    ['traversal: query-start', (t: Tag) => t`/x/${'a?b'}`],
    ['traversal: fragment', (t: Tag) => t`/x/${'a#b'}`],
    ['traversal: encoded dotdot', (t: Tag) => t`/x/${'.%2e'}`],
    ['query param string', (t: Tag) => t`/x?q=${'c d'}`],
    ['query param after fragment-mode flip', (t: Tag) => t`/x#${'frag ment'}`],
    ['URLSearchParams in query', (t: Tag) => t`/x?${new URLSearchParams({ a: 'b c' })}`],
    ['Route composed in path', (t: Tag) => t`/x${t`/sub/${'v'}`}`],
    ['Route composed in query', (t: Tag) => t`/x?next=${t`/a b`}`],
  ])('%s', (_name, fn) => {
    differential(fn as any);
  });

  it('pins the real semantics we rely on (fails loudly on upstream change)', () => {
    // Path mode: segments NOT encoded…
    expect(real.route`/x/${'a b'}`.value).toBe('/x/a b');
    // …but traversal attempts throw instead.
    expect(() => real.route`/x/${'../etc'}`).toThrow(/path manipulation/);
    expect(() => real.route`/x/${'a/b'}`).toThrow(/path manipulation/);
    // Query mode (after ? or #): encoded.
    expect(real.route`/x?q=${'c d'}`.value).toBe('/x?q=c%20d');
    // Routes embed verbatim in path mode, ENCODED in query mode.
    const sub = real.route`/a b`;
    expect(real.route`/x${sub}`.value).toBe('/x/a b');
    expect(real.route`/x?next=${sub}`.value).toBe('/x?next=%2Fa%20b');
    // Return value is a readonly object, not a string.
    const r = real.route`/x`;
    expect(typeof r).toBe('object');
    expect(() => { (r as any).value = '/other'; }).toThrow(/modification/);
  });

  it('routeFromAbsolute: requires an absolute URL and strips the origin', () => {
    expect((shim as any).routeFromAbsolute('https://x.atlassian.net/a/b?q=1').value).toBe('/a/b?q=1');
    // Bare paths are NOT absolute URLs — real throws (our old shim accepted them).
    expect(() => (shim as any).routeFromAbsolute('/bare/path')).toThrow();
  });
});

describe('per-surface string policy (mirrors real wrapper functions)', () => {
  it('requestJira/Confluence/Bitbucket REJECT plain strings, like requireSafeUrl', async () => {
    const sim = createSimulator();
    try {
      for (const fn of ['requestJira', 'requestConfluence', 'requestBitbucket'] as const) {
        // Bare export and asApp()/asUser() client methods share one path.
        await expect((shim as any)[fn]('/rest/api/3/myself')).rejects.toThrow(
          /route.*template literal.*@forge\/api/s,
        );
        await expect((shim as any).asApp()[fn]('/rest/api/3/myself')).rejects.toThrow(
          /instead of a Route/,
        );
      }
    } finally {
      sim.reset();
    }
  });

  it('requestJira ACCEPTS a real Route (and one from assumeTrustedRoute)', async () => {
    const sim = createSimulator();
    try {
      sim.mockProductApi('jira', async () => ({ status: 200, body: { ok: true } }));
      const viaRoute = await (shim as any).requestJira((shim as any).route`/rest/api/3/myself`);
      expect(viaRoute.status).toBe(200);
      const viaTrusted = await (shim as any).requestJira((shim as any).assumeTrustedRoute('/rest/api/3/myself'));
      expect(viaTrusted.status).toBe(200);
    } finally {
      sim.reset();
    }
  });

  it('egress fetch still accepts a plain string — the real wrapWithRouteUnwrapper policy', async () => {
    // fetch() is the ONE surface where real @forge/api takes string|Route.
    // It must NOT gain the Route requirement. Unmocked external fetch is
    // disabled by default in the sim and rejects with its own error — the
    // assertion is that it is NOT the Route-policy error.
    const sim = createSimulator();
    try {
      const err = await (shim as any).fetch('https://example.com/x').then(
        () => null,
        (e: Error) => e,
      );
      if (err) expect(String(err)).not.toMatch(/instead of a Route/);
    } finally {
      sim.reset();
    }
  });
});

describe('the sim-only string route helper stays removed', () => {
  it("'forge-sim' no longer exports route — it produced strings every real product request rejects", async () => {
    const index = await import('../index.js');
    expect((index as any).route).toBeUndefined();
  });
});
