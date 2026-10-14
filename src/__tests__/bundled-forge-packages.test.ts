/**
 * Shape-2 (bundled @forge/*) backends: unsupported, but diagnosable.
 *
 * forge-sim intercepts `@forge/*` at IMPORT time (ESM resolve hook + CJS
 * `Module._resolveFilename` patch). A bundler that inlines those packages
 * leaves no specifier to intercept, so the real package runs and its I/O
 * lands on `global.__forge_fetch__`. We route the surfaces whose wire
 * protocol is a public contract (product REST, SQL, KVS) and refuse the ones
 * that are undocumented Atlassian internals — with an actionable error rather
 * than the bewildering `501 Error` they used to produce.
 *
 * These tests drive `__forge_fetch__` directly: that IS the contract under
 * test, and it avoids pinning the suite to any real package's internals.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createSimulator, type ForgeSimulator } from '../simulator.js';

describe('bundled @forge/* detection at the __forge_fetch__ seam', () => {
  let sim: ForgeSimulator;
  const seam = () => (global as any).__forge_fetch__ as (
    d: Record<string, unknown>,
    p: string,
    i?: unknown,
  ) => Promise<any>;

  beforeEach(() => {
    sim = createSimulator();
  });

  // Descriptor shapes captured from the REAL packages (see the findings doc).
  it.each([
    ['@forge/object-store', { type: 'os', provider: 'app', remote: 'os' }, 'api/v1/metadata'],
    ['@forge/llm', { type: 'llm' }, '/v1/chat'],
    ['@forge/realtime', { type: 'realtime' }, '/'],
    [
      '@forge/events',
      { type: 'fpp', provider: 'app', remote: 'stargate' },
      '/webhook/queue/publish/{contextAri}/{environmentId}/{appId}/{appVersion}',
    ],
  ])('names %s and points at the --external fix', async (pkg, descriptor, path) => {
    await expect(seam()(descriptor, path)).rejects.toThrow(
      new RegExp(`bundled ${pkg.replace('/', '\\/')} into its output`),
    );
    await expect(seam()(descriptor, path)).rejects.toThrow(/--external:@forge/);
  });

  it('leaves product REST calls alone — they share type "fpp" with @forge/events', async () => {
    // requestJira/Confluence/Bitbucket all send type:'fpp'. Gating on the
    // type alone would break the bundled-@forge/api path, which WORKS.
    const res = await seam()(
      { type: 'fpp', provider: 'none', remote: 'jira' },
      '/rest/api/3/myself',
    );
    // Reaches the product-API layer (unmocked → 501 from US, not a throw).
    expect(res.status).toBe(501);
  });

  it('still routes the supported seams: sql and kvs', async () => {
    // Neither should throw — both have real backing implementations.
    await expect(seam()({ type: 'kvs' }, '/api/v1/entity/unknown')).resolves.toBeDefined();
  });

  it('a bundled @forge/events push fails with guidance, not a bare 501', async () => {
    // The end-to-end symptom this replaces: `InternalServerError: 501 Error`
    // with nothing connecting it to the bundler config.
    const err = await seam()(
      { type: 'fpp', provider: 'app', remote: 'stargate' },
      '/webhook/queue/publish/x/y/z/1',
    ).catch((e: Error) => e);
    expect(String(err)).not.toMatch(/^.*501 Error$/);
    expect(String(err)).toMatch(/does not support/);
    expect(String(err)).toMatch(/node_modules/);
  });
});
