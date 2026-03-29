/**
 * Tests for module → resolver/endpoint routing.
 *
 * Core principle: If it works in forge-sim, it should work in Forge.
 * If it wouldn't work in Forge, it shouldn't work in forge-sim.
 *
 * In real Forge, each UI module is wired to either:
 *   - A resolver (resolver.function) — for backend function calls via invoke()
 *   - An endpoint (resolver.endpoint) — for remote/service calls via invokeRemote()
 *
 * These tests verify that forge-sim enforces the same boundaries:
 *   - A module can only invoke functions defined in its own resolver
 *   - A module without an endpoint cannot use invokeRemote()
 *   - A module with an endpoint but no resolver cannot use invoke()
 *   - Cross-module function access is rejected
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSimulator, ForgeSimulator } from '../simulator.js';

// ── Test Manifests ──────────────────────────────────────────────────────

/** Two modules with different resolvers — tests cross-module isolation */
const MULTI_RESOLVER_MANIFEST = `
app:
  id: ari:cloud:ecosystem::app/multi-resolver-test
modules:
  jira:issuePanel:
    - key: panel-a
      resource: main
      resolver:
        function: resolver-a
      title: Panel A
    - key: panel-b
      resource: main
      resolver:
        function: resolver-b
      title: Panel B
  function:
    - key: resolver-a
      handler: resolverA.handler
    - key: resolver-b
      handler: resolverB.handler
resources:
  - key: main
    path: src/frontend/index.tsx
`;

/** Module with endpoint only (no local resolver) */
const ENDPOINT_ONLY_MANIFEST = `
app:
  id: ari:cloud:ecosystem::app/endpoint-only-test
modules:
  jira:issuePanel:
    - key: remote-panel
      resource: main
      resolver:
        endpoint: my-endpoint
      title: Remote Panel
  endpoint:
    - key: my-endpoint
      remote: my-backend
      route:
        path: /api/v1
  function:
    - key: unrelated-fn
      handler: other.handler
resources:
  - key: main
    path: src/frontend/index.tsx
remotes:
  - key: my-backend
    baseUrl: https://api.example.com
`;

/** Module with resolver (no endpoint) */
const RESOLVER_ONLY_MANIFEST = `
app:
  id: ari:cloud:ecosystem::app/resolver-only-test
modules:
  jira:issuePanel:
    - key: local-panel
      resource: main
      resolver:
        function: my-resolver
      title: Local Panel
  function:
    - key: my-resolver
      handler: resolver.handler
resources:
  - key: main
    path: src/frontend/index.tsx
`;

/** Mixed: one module with resolver, another with endpoint */
const MIXED_MANIFEST = `
app:
  id: ari:cloud:ecosystem::app/mixed-test
modules:
  jira:issuePanel:
    - key: local-panel
      resource: main
      resolver:
        function: my-resolver
      title: Local Panel
    - key: remote-panel
      resource: main
      resolver:
        endpoint: my-endpoint
      title: Remote Panel
  endpoint:
    - key: my-endpoint
      remote: my-backend
      route:
        path: /api
  function:
    - key: my-resolver
      handler: resolver.handler
resources:
  - key: main
    path: src/frontend/index.tsx
remotes:
  - key: my-backend
    baseUrl: https://api.example.com
`;

/** Non-standard module types (jira:fullPage, etc.) should still be detected */
const FULLPAGE_MANIFEST = `
app:
  id: ari:cloud:ecosystem::app/fullpage-test
modules:
  jira:fullPage:
    - key: my-fullpage
      resource: main
      resolver:
        endpoint: my-endpoint
      title: Full Page
  endpoint:
    - key: my-endpoint
      remote: my-backend
  function:
    - key: resolver
      handler: resolver.handler
resources:
  - key: main
    path: static/build
remotes:
  - key: my-backend
    baseUrl: http://localhost:7071/
`;

// ── Module Route Registration ───────────────────────────────────────────

describe('Module route registration', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    sim = createSimulator();
  });

  it('registers module routes from manifest with resolver', async () => {
    await sim.loadManifest(RESOLVER_ONLY_MANIFEST);
    const route = sim.getModuleRoute('local-panel');
    expect(route).toEqual({ resolverFunctionKey: 'my-resolver', endpointKey: undefined, moduleType: 'jira:issuePanel' });
  });

  it('registers module routes from manifest with endpoint', async () => {
    await sim.loadManifest(ENDPOINT_ONLY_MANIFEST);
    const route = sim.getModuleRoute('remote-panel');
    expect(route).toEqual({ resolverFunctionKey: undefined, endpointKey: 'my-endpoint', moduleType: 'jira:issuePanel' });
  });

  it('registers both resolver and endpoint modules', async () => {
    await sim.loadManifest(MIXED_MANIFEST);
    expect(sim.getModuleRoute('local-panel')).toEqual({
      resolverFunctionKey: 'my-resolver',
      endpointKey: undefined,
      moduleType: 'jira:issuePanel',
    });
    expect(sim.getModuleRoute('remote-panel')).toEqual({
      resolverFunctionKey: undefined,
      endpointKey: 'my-endpoint',
      moduleType: 'jira:issuePanel',
    });
  });

  it('clears module routes on manifest reload', async () => {
    await sim.loadManifest(MIXED_MANIFEST);
    expect(sim.getModuleRoute('local-panel')).toBeDefined();

    await sim.loadManifest(RESOLVER_ONLY_MANIFEST);
    expect(sim.getModuleRoute('local-panel')).toBeDefined(); // still exists (same key)
    expect(sim.getModuleRoute('remote-panel')).toBeUndefined(); // gone
  });

  it('registers non-standard module types like jira:fullPage', async () => {
    await sim.loadManifest(FULLPAGE_MANIFEST);
    const route = sim.getModuleRoute('my-fullpage');
    expect(route).toEqual({ resolverFunctionKey: undefined, endpointKey: 'my-endpoint', moduleType: 'jira:fullPage' });
  });

  it('clears module routes on reset', async () => {
    await sim.loadManifest(MIXED_MANIFEST);
    sim.reset();
    expect(sim.getModuleRoute('local-panel')).toBeUndefined();
    expect(sim.getModuleRoute('remote-panel')).toBeUndefined();
  });
});

// ── Resolver Boundary Enforcement ───────────────────────────────────────

describe('Resolver boundary enforcement', () => {
  let sim: ForgeSimulator;

  beforeEach(async () => {
    sim = createSimulator();
    await sim.loadManifest(MULTI_RESOLVER_MANIFEST);

    // Simulate what the deployer does: define functions and register ownership
    sim.resolver.define('getDataA', async (req: any) => ({ source: 'A', payload: req.payload }));
    sim.resolver.define('getDataB', async (req: any) => ({ source: 'B', payload: req.payload }));
    sim.registerResolverOwnership('getDataA', 'resolver-a');
    sim.registerResolverOwnership('getDataB', 'resolver-b');
  });

  it('allows invoking functions within own module resolver', async () => {
    // panel-a uses resolver-a which owns getDataA
    const result = await sim.invoke('getDataA', { test: true }, 'panel-a');
    expect(result).toEqual({ source: 'A', payload: { test: true } });
  });

  it('allows invoking functions within own module resolver (panel-b)', async () => {
    // panel-b uses resolver-b which owns getDataB
    const result = await sim.invoke('getDataB', { test: true }, 'panel-b');
    expect(result).toEqual({ source: 'B', payload: { test: true } });
  });

  it('rejects cross-module function access', async () => {
    // panel-a tries to invoke getDataB (owned by resolver-b)
    await expect(
      sim.invoke('getDataB', {}, 'panel-a')
    ).rejects.toThrow(/belongs to resolver "resolver-b".*module "panel-a" uses resolver "resolver-a"/);
  });

  it('rejects cross-module function access (reverse)', async () => {
    // panel-b tries to invoke getDataA (owned by resolver-a)
    await expect(
      sim.invoke('getDataA', {}, 'panel-b')
    ).rejects.toThrow(/belongs to resolver "resolver-a".*module "panel-b" uses resolver "resolver-b"/);
  });

  it('allows invoke without moduleKey for backward compatibility', async () => {
    // No moduleKey — skip validation (legacy behavior)
    const result = await sim.invoke('getDataA', {});
    expect(result).toEqual({ source: 'A', payload: {} });
  });

  it('rejects invoke for unknown module', async () => {
    await expect(
      sim.invoke('getDataA', {}, 'nonexistent-module')
    ).rejects.toThrow(/Unknown module "nonexistent-module"/);
  });
});

// ── Endpoint Boundary Enforcement ───────────────────────────────────────

describe('Endpoint boundary enforcement', () => {
  let sim: ForgeSimulator;

  beforeEach(async () => {
    sim = createSimulator();
  });

  it('resolves endpoint for module with endpoint config', async () => {
    await sim.loadManifest(ENDPOINT_ONLY_MANIFEST);
    const endpointKey = sim.resolveModuleEndpoint('remote-panel');
    expect(endpointKey).toBe('my-endpoint');
  });

  it('rejects invokeRemote from module without endpoint', async () => {
    await sim.loadManifest(RESOLVER_ONLY_MANIFEST);
    expect(() => sim.resolveModuleEndpoint('local-panel')).toThrow(
      /Module "local-panel" has no endpoint configured/
    );
  });

  it('rejects invokeRemote from unknown module', async () => {
    await sim.loadManifest(RESOLVER_ONLY_MANIFEST);
    expect(() => sim.resolveModuleEndpoint('nonexistent')).toThrow(
      /Unknown module "nonexistent"/
    );
  });

  it('rejects invoke() from endpoint-only module', async () => {
    await sim.loadManifest(ENDPOINT_ONLY_MANIFEST);
    // Endpoint-only module has no resolver — invoke() should fail
    await expect(
      sim.invoke('someFunction', {}, 'remote-panel')
    ).rejects.toThrow(/configured with endpoint "my-endpoint", not a resolver.*Use invokeRemote/);
  });

  it('allows each module type to use its own mechanism in mixed app', async () => {
    await sim.loadManifest(MIXED_MANIFEST);

    // local-panel has resolver — can use invoke
    sim.resolver.define('getData', async () => ({ ok: true }));
    sim.registerResolverOwnership('getData', 'my-resolver');
    const result = await sim.invoke('getData', {}, 'local-panel');
    expect(result).toEqual({ ok: true });

    // remote-panel has endpoint — can use resolveModuleEndpoint
    const endpointKey = sim.resolveModuleEndpoint('remote-panel');
    expect(endpointKey).toBe('my-endpoint');

    // But: remote-panel cannot use invoke
    await expect(
      sim.invoke('getData', {}, 'remote-panel')
    ).rejects.toThrow(/configured with endpoint.*not a resolver/);

    // And: local-panel cannot use resolveModuleEndpoint
    expect(() => sim.resolveModuleEndpoint('local-panel')).toThrow(
      /has no endpoint configured/
    );
  });
});
