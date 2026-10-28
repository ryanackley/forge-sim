/**
 * The manifest's `providers.auth` load wherever a manifest reaches the sim:
 * `sim.deploy()`, a redeploy, and (through the same loadManifestData) MCP
 * and `forge-sim dev`. The real `@forge/api` builds `withProvider()` from
 * the runtime's external-auth metadata on every call, so a provider the sim
 * did not load fails at construction with "Bad provider or missing config",
 * which is what every surface used to do for every provider.
 *
 * Also pinned, since they only show once providers load at all:
 *   - the request URL rule (a leading `/` replaces the remote's base path)
 *   - the bearer methods from the providers reference, including the
 *     advanced object form
 *   - `hasCredentials()` is false for an expired token that cannot be
 *     refreshed, so `fetch()` fails client-side instead of at the seam
 *   - `requestCredentials()` rejects as on Forge and the sim log says how to
 *     authorize instead
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSimulator, type ForgeSimulator } from '../simulator.js';
import { linkNodeModules } from './helpers/scratch-app.js';

const PROVIDER = (key: string, bearerMethod: string) => `
    - key: ${key}
      name: ${key}
      type: oauth2
      clientId: cid-${key}
      scopes:
        - openid
      remotes:
        - svc-api
${bearerMethod}
      actions:
        authorization:
          remote: svc-account
          path: /oauth/authorize
        exchange:
          remote: svc-oauth
          path: /token
        refreshToken:
          remote: svc-oauth
          path: /token
        retrieveProfile:
          remote: svc-api
          path: /me
          resolvers:
            id: id
            displayName: name`;

const manifest = (providers: string) => `
modules:
  jira:issuePanel:
    - key: panel
      resource: main
      render: native
      title: Panel
      icon: https://example.com/icon.svg
      resolver:
        function: res
  function:
    - key: res
      handler: index.handler
resources:
  - key: main
    path: src/frontend/index.jsx
remotes:
  - key: svc-api
    baseUrl: https://api.example.invalid/tpp-hdr
  - key: svc-account
    baseUrl: https://account.example.invalid
  - key: svc-oauth
    baseUrl: https://oauth.example.invalid
permissions:
  scopes: []
  external:
    fetch:
      backend:
        - remote: svc-api
        - remote: svc-account
        - remote: svc-oauth
${providers ? `providers:\n  auth:${providers}` : ''}
app:
  id: ari:cloud:ecosystem::app/providers-on-deploy
  runtime:
    name: nodejs22.x
`;

const ALL_PROVIDERS =
  PROVIDER('header', '      bearerMethod: authorization-header') +
  PROVIDER('formy', '      bearerMethod: form-encoded') +
  PROVIDER('query', '      bearerMethod: uri-query') +
  PROVIDER('custom', `      bearerMethod:
        type: authorization-header
        prefix: 'token '
        parameter: X-Custom-Header`);

const BACKEND = `
import Resolver from '@forge/resolver';
import api from '@forge/api';
const resolver = new Resolver();
resolver.define('has', async ({ payload }) => api.asUser().withProvider(payload.provider, 'svc-api').hasCredentials());
resolver.define('fetch', async ({ payload }) => {
  const res = await api.asUser().withProvider(payload.provider, 'svc-api').fetch(payload.path, payload.init);
  return { status: res.status, body: await res.json() };
});
resolver.define('request', async ({ payload }) => api.asUser().withProvider(payload.provider, 'svc-api').requestCredentials());
export const handler = resolver.getDefinitions();
`;

const FRONTEND = `
import React from 'react';
import ForgeReconciler, { Text } from '@forge/react';
ForgeReconciler.render(<Text>hi</Text>);
`;

const outbound = vi.fn(async (url: string, init?: RequestInit) =>
  new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }));

let dir: string;
let sim: ForgeSimulator;

async function writeApp(providers = ALL_PROVIDERS) {
  await mkdir(join(dir, 'src', 'frontend'), { recursive: true });
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'providers-on-deploy', private: true, type: 'module' }));
  await writeFile(join(dir, 'manifest.yml'), manifest(providers));
  await writeFile(join(dir, 'src', 'index.js'), BACKEND);
  await writeFile(join(dir, 'src', 'frontend', 'index.jsx'), FRONTEND);
  linkNodeModules(dir);
}

const token = (provider: string, extra: Record<string, unknown> = {}) => ({ provider, accessToken: `tok-${provider}`, ...extra });

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'forge-sim-providers-'));
  sim = createSimulator();
  outbound.mockClear();
  vi.stubGlobal('fetch', outbound);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await sim.stop();
  await rm(dir, { recursive: true, force: true });
});

describe('providers load on deploy', () => {
  it('after sim.deploy(), the manifest providers are there and the real withProvider() constructs', async () => {
    await writeApp();
    await sim.deploy(dir, { fireScheduledTriggers: false });
    expect(sim.externalAuth.listProviders().map((p) => p.key).sort()).toEqual(['custom', 'formy', 'header', 'query']);
    expect(await sim.invoke('has', { provider: 'header' })).toBe(false);
    sim.externalAuth.setToken('header', token('header'));
    expect(await sim.invoke('has', { provider: 'header' })).toBe(true);
  });

  it('a provider the manifest does not declare still fails at construction, as on Forge', async () => {
    await writeApp();
    await sim.deploy(dir, { fireScheduledTriggers: false });
    await expect(sim.invoke('has', { provider: 'github' })).rejects.toThrow(/Bad provider or missing config for provider github/);
  });

  it('a redeploy drops a removed provider and keeps the token of one still declared', async () => {
    await writeApp();
    await sim.deploy(dir, { fireScheduledTriggers: false });
    sim.externalAuth.setToken('header', token('header'));
    sim.externalAuth.setToken('query', token('query'));

    await writeFile(join(dir, 'manifest.yml'), manifest(PROVIDER('header', '      bearerMethod: authorization-header')));
    await sim.deploy(dir, { fireScheduledTriggers: false });
    expect(sim.externalAuth.listProviders().map((p) => p.key)).toEqual(['header']);
    expect(await sim.invoke('has', { provider: 'header' })).toBe(true);
    await expect(sim.invoke('has', { provider: 'query' })).rejects.toThrow(/Bad provider or missing config/);

    await writeFile(join(dir, 'manifest.yml'), manifest(''));
    await sim.deploy(dir, { fireScheduledTriggers: false });
    expect(sim.externalAuth.listProviders()).toEqual([]);
  });
});

describe('request URL and bearer method', () => {
  beforeEach(async () => {
    await writeApp();
    await sim.deploy(dir, { fireScheduledTriggers: false });
    for (const key of ['header', 'formy', 'query', 'custom']) sim.externalAuth.setToken(key, token(key));
  });

  const lastCall = () => {
    const [url, init] = outbound.mock.calls.at(-1) as [string, RequestInit];
    return { url, init, headers: (init?.headers ?? {}) as Record<string, string> };
  };

  it('a leading / replaces the base URL path; a relative path is appended to it', async () => {
    await sim.invoke('fetch', { provider: 'header', path: '/user/me' });
    expect(lastCall().url).toBe('https://api.example.invalid/user/me');
    await sim.invoke('fetch', { provider: 'header', path: 'user/me?x=1' });
    expect(lastCall().url).toBe('https://api.example.invalid/tpp-hdr/user/me?x=1');
  });

  it('authorization-header: Bearer in Authorization', async () => {
    await sim.invoke('fetch', { provider: 'header', path: '/me' });
    expect(lastCall().headers.Authorization).toBe('Bearer tok-header');
    expect(lastCall().url).not.toContain('access_token');
  });

  it('the advanced form: custom prefix and header name', async () => {
    await sim.invoke('fetch', { provider: 'custom', path: '/me' });
    expect(lastCall().headers['X-Custom-Header']).toBe('token tok-custom');
    expect(lastCall().headers.Authorization).toBeUndefined();
  });

  it('form-encoded: the token rides in the form body, not a header', async () => {
    await sim.invoke('fetch', { provider: 'formy', path: '/me', init: { method: 'POST', body: 'a=1', headers: { 'content-type': 'text/plain' } } });
    const { init, headers } = lastCall();
    expect(init.method).toBe('POST');
    expect(String(init.body)).toBe('a=1&access_token=tok-formy');
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(headers.Authorization).toBeUndefined();
  });

  it('uri-query: the token is a query parameter', async () => {
    await sim.invoke('fetch', { provider: 'query', path: '/me?a=1' });
    expect(lastCall().url).toBe('https://api.example.invalid/me?a=1&access_token=tok-query');
    expect(lastCall().headers.Authorization).toBeUndefined();
  });

  it('a mocked provider remote answers first and the token never leaves', async () => {
    sim.mockProductRoutes('svc-api', { 'GET /me': { mocked: true } });
    expect(await sim.invoke('fetch', { provider: 'header', path: '/me' })).toEqual({ status: 200, body: { mocked: true } });
    expect(outbound).not.toHaveBeenCalled();
  });
});

describe('expired tokens and consent', () => {
  beforeEach(async () => {
    await writeApp();
    await sim.deploy(dir, { fireScheduledTriggers: false });
  });

  it('an expired token with no way to refresh is no credentials, consistently', async () => {
    sim.externalAuth.setToken('header', token('header', { expiresAt: Date.now() - 1000 }));
    expect(sim.externalAuth.hasCredentials('header')).toBe(false);
    expect(await sim.invoke('has', { provider: 'header' })).toBe(false);
    await expect(sim.invoke('fetch', { provider: 'header', path: '/me' })).rejects.toThrow(/no credentials previously requested/);
    expect(outbound).not.toHaveBeenCalled();
  });

  it('an expired token that can be refreshed still counts as credentials', async () => {
    sim.externalAuth.setSecret('header', 'client-secret');
    sim.externalAuth.setToken('header', token('header', { expiresAt: Date.now() - 1000, refreshToken: 'rt' }));
    expect(sim.externalAuth.canRefresh('header')).toBe(true);
    expect(sim.externalAuth.hasCredentials('header')).toBe(true);
    expect(await sim.invoke('has', { provider: 'header' })).toBe(true);
  });

  it('requestCredentials() rejects as on Forge, and the sim log says how to authorize instead', async () => {
    await expect(sim.invoke('request', { provider: 'header' })).rejects.toMatchObject({ name: 'NEEDS_AUTHENTICATION_ERR' });
    const warning = sim.getLogs().find((l) => l.level === 'warn' && /requested credentials for "header"/.test(l.message));
    expect(warning?.message).toContain('forge-sim auth --provider header');
    expect(warning?.message).toContain('sim.externalAuth.setToken()');
  });
});
