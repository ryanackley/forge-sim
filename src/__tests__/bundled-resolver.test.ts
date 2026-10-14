/**
 * Manual packaging (#40), adversarial finding D: backends that BUNDLE
 * @forge/resolver into their output.
 *
 * Real Forge fully supports an inlined @forge/resolver — the platform only
 * ever calls the exported dispatch function. forge-sim's interception, by
 * contrast, is keyed on the *specifier* `@forge/resolver` (ESM resolve hook
 * + CJS `Module._resolveFilename` patch), and a bundled copy has no
 * specifier left to intercept. The shim's registering `define()` never runs,
 * so the app's resolver keys are invisible to the simulator.
 *
 * These tests bundle against the REAL @forge/resolver (not a hand-written
 * lookalike) so they keep tracking upstream's actual dispatch shape.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { resolve, join } from 'node:path';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'os';
import { createSimulator, type ForgeSimulator } from '../simulator.js';
import { detectResolverDispatch } from '../deployer.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

/** Bundle with the REAL @forge/* packages inlined — no externals. */
async function bundle(
  srcFile: string,
  outFile: string,
  opts: { format: 'cjs' | 'esm'; platform?: 'node' | 'browser'; jsx?: boolean } = { format: 'cjs' },
): Promise<void> {
  const esbuild = await import('esbuild');
  await esbuild.build({
    entryPoints: [srcFile],
    bundle: true,
    format: opts.format,
    platform: opts.platform ?? 'node',
    ...(opts.jsx ? { jsx: 'automatic' as const } : {}),
    outfile: outFile,
    nodePaths: [join(REPO_ROOT, 'node_modules')],
    logLevel: 'silent',
  });
}

const MANIFEST = `
app:
  id: ari:cloud:ecosystem::app/11111111-2222-3333-4444-555555555555
  runtime:
    name: nodejs22.x
  package:
    bundler: manual@2026
    path: out
modules:
  jira:issuePanel:
    - key: panel
      resource: main
      render: native
      title: Panel
      icon: https://example.com/i.svg
      resolver:
        function: main-fn
  function:
    - key: main-fn
      handler: index.handler
resources:
  - key: main
    bundler: manual@2026
    path: frontend
`;

const BACKEND_SRC = `
import Resolver from '@forge/resolver';
const resolver = new Resolver();
resolver.define('getText', async (req) => \`bundled:\${req.payload?.from ?? '?'}\`);
resolver.define('whoami', async (req) => req.context.accountId);
resolver.define('boom', async () => { throw new Error('handler exploded'); });
export const handler = resolver.getDefinitions();
`;

const FRONTEND_SRC = (key: string) => `
import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Text } from '@forge/react';
import { invoke } from '@forge/bridge';
const App = () => {
  const [d, setD] = useState(null);
  // No .catch() — the canonical app shape, and the one that used to take
  // down the whole test runner when the resolver was missing.
  useEffect(() => { invoke('${key}', { from: 'ui' }).then(setD); }, []);
  return <Text>{d ?? 'Loading...'}</Text>;
};
ForgeReconciler.render(<App />);
`;

/** Build a manual-packaged app whose backend inlines @forge/resolver. */
async function buildApp(prefix: string, frontendInvokeKey: string): Promise<string> {
  const appDir = await mkdtemp(join(tmpdir(), prefix));
  // No `type` field: the packaged .js is CommonJS, as compiled output is.
  await writeFile(join(appDir, 'package.json'), '{ "name": "t", "private": true }', 'utf8');
  await writeFile(join(appDir, 'manifest.yml'), MANIFEST, 'utf8');

  const srcDir = join(appDir, 'src');
  await mkdir(srcDir, { recursive: true });
  await mkdir(join(appDir, 'out'), { recursive: true });
  await mkdir(join(appDir, 'frontend'), { recursive: true });

  await writeFile(join(srcDir, 'backend.js'), BACKEND_SRC, 'utf8');
  await bundle(join(srcDir, 'backend.js'), join(appDir, 'out', 'index.js'), { format: 'cjs' });

  await writeFile(join(srcDir, 'app.jsx'), FRONTEND_SRC(frontendInvokeKey), 'utf8');
  await bundle(join(srcDir, 'app.jsx'), join(appDir, 'frontend', 'index.js'), {
    format: 'esm',
    platform: 'browser',
    jsx: true,
  });
  await writeFile(
    join(appDir, 'frontend', 'index.html'),
    '<!doctype html><html><body><script type="module" src="./index.js"></script></body></html>',
    'utf8'
  );
  return appDir;
}

describe('bundled @forge/resolver — backend invoke (adversarial D)', () => {
  let appDir: string;
  let sim: ForgeSimulator;

  beforeAll(async () => {
    appDir = await buildApp('forge-sim-bundled-resolver-', 'getText');
    sim = createSimulator();
    await sim.deploy(appDir, { throwOnError: false });
  }, 60_000);

  afterAll(async () => {
    sim?.ui.resetAll();
    await rm(appDir, { recursive: true, force: true }).catch(() => undefined);
  });

  it('the fixture really is bundled — no bare @forge/resolver specifier survives', async () => {
    const out = await readFile(join(appDir, 'out', 'index.js'), 'utf8');
    expect(out).not.toMatch(/require\(["']@forge\/resolver["']\)/);
    expect(out).not.toMatch(/from\s*["']@forge\/resolver["']/);
    // The real package's internals ARE inlined (its error string proves it).
    expect(out).toContain('Resolver has no definition for');
  });

  it('routes an inlined resolver definition key through the dispatch function', async () => {
    await expect(sim.invoke('getText', { from: 'test' })).resolves.toBe('bundled:test');
  });

  it('invoking the manifest function key reaches the dispatcher, not a raw closure', async () => {
    // Pre-fix this threw "Cannot read properties of undefined (reading
    // 'functionKey')" — the dispatch closure called with a resolver request.
    await expect(sim.invoke('main-fn')).rejects.toThrow(/no definition|No resolver defined/i);
    await expect(sim.invoke('main-fn')).rejects.not.toThrow(/reading 'functionKey'/);
  });

  it('passes a real backendRuntimePayload so context.accountId survives', async () => {
    // Real @forge/resolver OVERWRITES context.accountId from
    // backendRuntimePayload.principal.accountId — passing `{}` blanks it.
    const who = await sim.invoke('whoami');
    expect(who).toBe(sim.getDefaultContext().accountId);
    expect(who).toBeTruthy();
  });

  it('honors a per-call context override through the dispatcher', async () => {
    const who = await sim.invoke('whoami', {}, { context: { accountId: 'alice-123' } });
    expect(who).toBe('alice-123');
  });

  it('propagates an error thrown BY a bundled handler instead of masking it', async () => {
    await expect(sim.invoke('boom')).rejects.toThrow(/handler exploded/);
  });

  it('still reports a genuinely unknown key, naming the bundled resolver', async () => {
    await expect(sim.invoke('nope')).rejects.toThrow(/No resolver defined for "nope"/);
    await expect(sim.invoke('nope')).rejects.toThrow(/bundled resolver/);
  });

  it('a redeploy replaces the dispatcher rather than stacking another one', async () => {
    const before = sim.resolver.getDispatchKeys();
    await sim.deploy(appDir, { throwOnError: false });
    await sim.deploy(appDir, { throwOnError: false });
    expect(sim.resolver.getDispatchKeys()).toEqual(before);
    await expect(sim.invoke('getText', { from: 'again' })).resolves.toBe('bundled:again');
  });
});

describe('bundled @forge/resolver — full-stack UI invoke (adversarial D)', () => {
  let appDir: string;

  afterAll(async () => {
    await rm(appDir, { recursive: true, force: true }).catch(() => undefined);
  });

  it('renders a prebuilt UI whose invoke lands on a bundled resolver key', async () => {
    appDir = await buildApp('forge-sim-bundled-fullstack-', 'getText');
    const sim = createSimulator();
    await sim.deploy(appDir, { throwOnError: false });
    const doc = await sim.ui.waitForContent('panel', 'bundled:ui');
    expect(JSON.stringify(doc)).toContain('bundled:ui');
    sim.ui.resetAll();
  }, 60_000);

  it('a missing resolver fails ONE test with an actionable hint, not the process', async () => {
    // The containment case: app code does `invoke(...).then(setState)` with
    // no catch. Pre-fix the rejection escaped as an unhandled rejection and
    // vitest exited 1 with every test still reporting "passed".
    const missingDir = await buildApp('forge-sim-bundled-missing-', 'noSuchKey');
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const sim = createSimulator();
      await sim.deploy(missingDir, { throwOnError: false });

      await expect(
        sim.ui.waitForContent('panel', 'anything', 1500)
      ).rejects.toThrow(/No resolver defined for "noSuchKey"/);

      // The UI is stuck on its loading state — exactly the browser's
      // behavior for a dangling invoke, not a crash.
      expect(JSON.stringify(sim.ui.getForgeDoc('panel'))).toContain('Loading...');
      expect(
        errSpy.mock.calls.some((c) => /UI invoke\("noSuchKey"\) failed/.test(String(c[0])))
      ).toBe(true);
      sim.ui.resetAll();
    } finally {
      errSpy.mockRestore();
      await rm(missingDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }, 60_000);
});

describe('detectResolverDispatch', () => {
  it('matches the real @forge/resolver dispatch shape', async () => {
    // By explicit path: a bare `@forge/resolver` specifier is aliased to our
    // SHIM under vitest, and the shim's getDefinitions() returns an object.
    // The point here is the REAL package's closure.
    const { createRequire } = await import('node:module');
    const req = createRequire(import.meta.url);
    const Real = req(join(REPO_ROOT, 'node_modules/@forge/resolver/out/index.js'));
    const r = new (Real.default ?? Real)();
    r.define('a', () => 1);
    expect(detectResolverDispatch(r.getDefinitions())).toBe(true);
  });

  it('does NOT match ordinary handler shapes', () => {
    expect(detectResolverDispatch((req: any) => req)).toBe(false);
    // Trigger/consumer handlers take (event, context) — arity 2, like a
    // dispatcher, so the name check is what keeps them apart.
    expect(detectResolverDispatch((event: any, context: any) => [event, context])).toBe(false);
    expect(detectResolverDispatch(() => 'no args')).toBe(false);
  });
});
