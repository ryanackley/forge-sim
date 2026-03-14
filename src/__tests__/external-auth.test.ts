/**
 * Tests for ExternalAuthStore and withProvider() shim wiring.
 *
 * Covers:
 * - Provider/remote loading from manifest
 * - Token management (set, get, hasCredentials, revoke)
 * - withProvider() chain (hasCredentials, fetch via mock routes, getAccount)
 * - Authorization URL building
 * - Scope checking
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ForgeSimulator } from '../simulator.js';
import { setSimulator } from '../shims/globals.js';
import * as forgeApi from '../shims/forge-api.js';
import { ExternalAuthStore } from '../external-auth-store.js';
import type { ManifestAuthProvider, ManifestRemote } from '../types.js';

// ── Test Fixtures ───────────────────────────────────────────────────────

const GOOGLE_PROVIDER: ManifestAuthProvider = {
  key: 'google',
  name: 'Google',
  type: 'oauth2',
  clientId: 'google-client-id',
  scopes: ['profile', 'email'],
  remotes: ['google-apis'],
  bearerMethod: 'authorization-header',
  actions: {
    authorization: { remote: 'google-account', path: '/o/oauth2/v2/auth' },
    exchange: { remote: 'google-oauth', path: '/token' },
    refreshToken: { remote: 'google-oauth', path: '/token' },
    revokeToken: { remote: 'google-oauth', path: '/revoke' },
    retrieveProfile: {
      remote: 'google-apis',
      path: '/userinfo/v2/me',
      resolvers: { id: 'id', displayName: 'email', avatarUrl: 'picture' },
    },
  },
};

const GITHUB_PROVIDER: ManifestAuthProvider = {
  key: 'github',
  name: 'GitHub',
  type: 'oauth2',
  clientId: 'github-client-id',
  scopes: ['repo', 'user'],
  remotes: ['github-api'],
  bearerMethod: 'authorization-header',
  actions: {
    authorization: { remote: 'github-auth', path: '/login/oauth/authorize' },
    exchange: { remote: 'github-auth', path: '/login/oauth/access_token' },
  },
};

const REMOTES = new Map<string, ManifestRemote>([
  ['google-apis', { key: 'google-apis', baseUrl: 'https://www.googleapis.com' }],
  ['google-account', { key: 'google-account', baseUrl: 'https://accounts.google.com' }],
  ['google-oauth', { key: 'google-oauth', baseUrl: 'https://oauth2.googleapis.com' }],
  ['github-api', { key: 'github-api', baseUrl: 'https://api.github.com' }],
  ['github-auth', { key: 'github-auth', baseUrl: 'https://github.com' }],
]);

const PROVIDERS = new Map<string, ManifestAuthProvider>([
  ['google', GOOGLE_PROVIDER],
  ['github', GITHUB_PROVIDER],
]);

const MANIFEST_YAML = `
app:
  id: ari:cloud:ecosystem::app/test
modules:
  jira:issuePanel:
    - key: main
      resource: main
      resolver:
        function: resolver
      title: Test
  function:
    - key: resolver
      handler: index.handler
resources:
  - key: main
    path: src/frontend/index.tsx
remotes:
  - key: google-apis
    baseUrl: https://www.googleapis.com
  - key: google-account
    baseUrl: https://accounts.google.com
  - key: google-oauth
    baseUrl: https://oauth2.googleapis.com
  - key: github-api
    baseUrl: https://api.github.com
  - key: github-auth
    baseUrl: https://github.com
providers:
  auth:
    - key: google
      name: Google
      type: oauth2
      clientId: google-client-id
      scopes:
        - profile
        - email
      remotes:
        - google-apis
      bearerMethod: authorization-header
      actions:
        authorization:
          remote: google-account
          path: /o/oauth2/v2/auth
        exchange:
          remote: google-oauth
          path: /token
        refreshToken:
          remote: google-oauth
          path: /token
        revokeToken:
          remote: google-oauth
          path: /revoke
        retrieveProfile:
          remote: google-apis
          path: /userinfo/v2/me
          resolvers:
            id: id
            displayName: email
            avatarUrl: picture
    - key: github
      name: GitHub
      type: oauth2
      clientId: github-client-id
      scopes:
        - repo
        - user
      remotes:
        - github-api
      bearerMethod: authorization-header
      actions:
        authorization:
          remote: github-auth
          path: /login/oauth/authorize
        exchange:
          remote: github-auth
          path: /login/oauth/access_token
`;

// ── ExternalAuthStore Unit Tests ────────────────────────────────────────

describe('ExternalAuthStore', () => {
  let store: ExternalAuthStore;

  beforeEach(() => {
    store = new ExternalAuthStore();
    store.loadFromManifest(PROVIDERS, REMOTES);
  });

  describe('provider info', () => {
    it('lists providers from manifest', () => {
      const providers = store.listProviders();
      expect(providers).toHaveLength(2);
      expect(providers.map(p => p.key)).toContain('google');
      expect(providers.map(p => p.key)).toContain('github');
    });

    it('gets provider by key', () => {
      const google = store.getProvider('google');
      expect(google?.name).toBe('Google');
      expect(google?.clientId).toBe('google-client-id');
    });

    it('resolves remote base URL', () => {
      expect(store.getRemoteBaseUrl('google-apis')).toBe('https://www.googleapis.com');
      expect(store.getRemoteBaseUrl('github-api')).toBe('https://api.github.com');
    });

    it('resolves provider base URL from first remote', () => {
      expect(store.getProviderBaseUrl('google')).toBe('https://www.googleapis.com');
      expect(store.getProviderBaseUrl('github')).toBe('https://api.github.com');
    });

    it('resolves provider base URL with explicit remote', () => {
      expect(store.getProviderBaseUrl('google', 'google-oauth'))
        .toBe('https://oauth2.googleapis.com');
    });
  });

  describe('secrets', () => {
    it('tracks client secrets', () => {
      expect(store.hasSecret('google')).toBe(false);
      store.setSecret('google', 'secret123');
      expect(store.hasSecret('google')).toBe(true);
      expect(store.getSecret('google')).toBe('secret123');
    });

    it('loads secrets from object', () => {
      store.loadSecrets({
        google: { clientSecret: 'g-secret' },
        github: { clientSecret: 'gh-secret' },
      });
      expect(store.getSecret('google')).toBe('g-secret');
      expect(store.getSecret('github')).toBe('gh-secret');
    });
  });

  describe('token management', () => {
    it('sets and gets tokens', () => {
      store.setToken('google', {
        provider: 'google',
        accessToken: 'ya29.test',
        scopes: ['profile'],
      });
      const token = store.getToken('google');
      expect(token?.accessToken).toBe('ya29.test');
    });

    it('hasCredentials returns true for valid token', () => {
      store.setToken('google', {
        provider: 'google',
        accessToken: 'ya29.test',
        expiresAt: Date.now() + 3600_000,
      });
      expect(store.hasCredentials('google')).toBe(true);
    });

    it('hasCredentials returns false for expired token', () => {
      store.setToken('google', {
        provider: 'google',
        accessToken: 'ya29.expired',
        expiresAt: Date.now() - 1000,
      });
      expect(store.hasCredentials('google')).toBe(false);
    });

    it('hasCredentials checks scopes', () => {
      store.setToken('google', {
        provider: 'google',
        accessToken: 'ya29.test',
        scopes: ['profile'],
      });
      expect(store.hasCredentials('google', ['profile'])).toBe(true);
      expect(store.hasCredentials('google', ['profile', 'email'])).toBe(false);
    });

    it('hasCredentials returns false when no token', () => {
      expect(store.hasCredentials('google')).toBe(false);
    });

    it('revokeToken removes token', () => {
      store.setToken('google', { provider: 'google', accessToken: 'ya29.test' });
      expect(store.hasCredentials('google')).toBe(true);
      store.revokeToken('google');
      expect(store.hasCredentials('google')).toBe(false);
    });

    it('getAccount returns account info', () => {
      store.setToken('google', {
        provider: 'google',
        accessToken: 'ya29.test',
        account: {
          id: '12345',
          displayName: 'test@gmail.com',
          scopes: ['profile', 'email'],
        },
      });
      const acct = store.getAccount('google');
      expect(acct?.displayName).toBe('test@gmail.com');
    });

    it('listAccounts returns empty when no token', () => {
      expect(store.listAccounts('google')).toEqual([]);
    });
  });

  describe('authorization URL', () => {
    it('builds correct URL with scopes and state', () => {
      const url = store.buildAuthorizationUrl('google', 'http://localhost:19421/callback', 'test-state');
      expect(url).not.toBeNull();
      const parsed = new URL(url!);
      expect(parsed.origin).toBe('https://accounts.google.com');
      expect(parsed.pathname).toBe('/o/oauth2/v2/auth');
      expect(parsed.searchParams.get('client_id')).toBe('google-client-id');
      expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost:19421/callback');
      expect(parsed.searchParams.get('state')).toBe('test-state');
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('scope')).toBe('profile email');
    });

    it('returns null for unknown provider', () => {
      expect(store.buildAuthorizationUrl('unknown', 'http://localhost/cb', 'state')).toBeNull();
    });
  });

  describe('clear', () => {
    it('resets all state', () => {
      store.setSecret('google', 'secret');
      store.setToken('google', { provider: 'google', accessToken: 'test' });
      store.clear();
      expect(store.listProviders()).toHaveLength(0);
      expect(store.hasSecret('google')).toBe(false);
      expect(store.hasCredentials('google')).toBe(false);
    });
  });
});

// ── Manifest Parsing ────────────────────────────────────────────────────

describe('manifest provider parsing', () => {
  it('parses providers and remotes from manifest YAML', async () => {
    const sim = new ForgeSimulator();
    setSimulator(sim);
    const manifest = await sim.loadManifest(MANIFEST_YAML);

    expect(manifest.remotes.size).toBe(5);
    expect(manifest.remotes.get('google-apis')?.baseUrl).toBe('https://www.googleapis.com');

    expect(manifest.authProviders.size).toBe(2);
    const google = manifest.authProviders.get('google')!;
    expect(google.name).toBe('Google');
    expect(google.clientId).toBe('google-client-id');
    expect(google.actions.authorization.remote).toBe('google-account');
  });

  it('populates simulator externalAuth from manifest', async () => {
    const sim = new ForgeSimulator();
    setSimulator(sim);
    await sim.loadManifest(MANIFEST_YAML);

    expect(sim.externalAuth.listProviders()).toHaveLength(2);
    expect(sim.externalAuth.getProviderBaseUrl('google')).toBe('https://www.googleapis.com');
  });
});

// ── withProvider() Shim Integration ─────────────────────────────────────

describe('withProvider() shim', () => {
  let sim: ForgeSimulator;

  beforeEach(async () => {
    sim = new ForgeSimulator();
    setSimulator(sim);
    await sim.loadManifest(MANIFEST_YAML);
  });

  it('hasCredentials returns false when no token set', async () => {
    const google = forgeApi.asUser().withProvider('google', 'google-apis');
    expect(await google.hasCredentials()).toBe(false);
  });

  it('hasCredentials returns true after setting token', async () => {
    sim.externalAuth.setToken('google', {
      provider: 'google',
      accessToken: 'ya29.test',
      expiresAt: Date.now() + 3600_000,
    });
    const google = forgeApi.asUser().withProvider('google', 'google-apis');
    expect(await google.hasCredentials()).toBe(true);
  });

  it('fetch falls through to mock routes when no token', async () => {
    sim.productApi.mockRoutes('google-apis', {
      'GET /userinfo/v2/me': {
        id: '12345',
        email: 'mock@gmail.com',
        name: 'Mock User',
      },
    });

    const google = forgeApi.asUser().withProvider('google', 'google-apis');
    const response = await google.fetch('/userinfo/v2/me');
    const data = await response.json();
    expect(data.email).toBe('mock@gmail.com');
  });

  it('getAccount returns account info from token', async () => {
    sim.externalAuth.setToken('google', {
      provider: 'google',
      accessToken: 'ya29.test',
      account: {
        id: '12345',
        displayName: 'test@gmail.com',
        scopes: ['profile'],
      },
    });

    const google = forgeApi.asUser().withProvider('google', 'google-apis');
    const account = await google.getAccount();
    expect(account?.displayName).toBe('test@gmail.com');
  });

  it('listAccounts returns accounts from token', async () => {
    sim.externalAuth.setToken('google', {
      provider: 'google',
      accessToken: 'ya29.test',
      account: {
        id: '12345',
        displayName: 'test@gmail.com',
        scopes: ['profile'],
      },
    });

    const google = forgeApi.asUser().withProvider('google', 'google-apis');
    const accounts = await google.listAccounts();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].displayName).toBe('test@gmail.com');
  });

  it('asAccount returns account methods', async () => {
    sim.externalAuth.setToken('google', {
      provider: 'google',
      accessToken: 'ya29.test',
      account: { id: '12345', displayName: 'test@gmail.com', scopes: ['profile'] },
    });

    sim.productApi.mockRoutes('google-apis', {
      'GET /userinfo/v2/me': { id: '12345', email: 'test@gmail.com' },
    });

    const google = forgeApi.asUser().withProvider('google', 'google-apis');
    const acctMethods = google.asAccount('12345');
    expect(await acctMethods.hasCredentials()).toBe(true);
    const resp = await acctMethods.fetch('/userinfo/v2/me');
    const data = await resp.json();
    expect(data.email).toBe('test@gmail.com');
  });

  it('requestCredentials returns true when token exists', async () => {
    sim.externalAuth.setToken('google', {
      provider: 'google',
      accessToken: 'ya29.test',
      expiresAt: Date.now() + 3600_000,
    });
    const google = forgeApi.asUser().withProvider('google', 'google-apis');
    expect(await google.requestCredentials()).toBe(true);
  });

  it('requestCredentials returns false when no secret configured', async () => {
    const warns: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: any[]) => warns.push(args.join(' '));

    const google = forgeApi.asUser().withProvider('google', 'google-apis');
    const result = await google.requestCredentials();
    expect(result).toBe(false);
    expect(warns.some(w => w.includes('No client secret'))).toBe(true);

    console.warn = origWarn;
  });

  it('mock routes work for different providers independently', async () => {
    sim.productApi.mockRoutes('google-apis', {
      'GET /userinfo/v2/me': { provider: 'google' },
    });
    sim.productApi.mockRoutes('github-api', {
      'GET /user': { provider: 'github' },
    });

    const googleResp = await forgeApi.asUser()
      .withProvider('google', 'google-apis')
      .fetch('/userinfo/v2/me');
    expect((await googleResp.json()).provider).toBe('google');

    const githubResp = await forgeApi.asUser()
      .withProvider('github', 'github-api')
      .fetch('/user');
    expect((await githubResp.json()).provider).toBe('github');
  });
});
