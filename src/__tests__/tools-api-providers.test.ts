/**
 * Tests for /api/providers/* endpoints.
 *
 * Covers:
 * - GET /api/providers — lists manifest providers with status
 * - POST /api/providers/:key/start — registers a pending flow, returns authUrl
 * - DELETE /api/providers/:key — clears the stored token, broadcasts
 * - Errors: unknown provider, missing client secret
 * - broadcastStateChange callback fires on connect + disconnect
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import { createSimulator } from '../simulator.js';
import { createApiHandler } from '../tools/api.js';
import { parseManifestContent } from '../manifest.js';
import {
  getOAuthCallbackRegistry,
  _resetOAuthCallbackRegistryForTests,
} from '../auth/oauth-callback-registry.js';

const MANIFEST_YAML = `
app:
  id: ari:cloud:ecosystem::app/test
  name: providers-test
modules:
  function:
    - key: handler
      handler: index.handler
providers:
  auth:
    - key: google
      name: Google
      type: oauth2
      clientId: google-client-id
      scopes: [profile, email]
      remotes: [google-apis]
      actions:
        authorization:
          remote: google-account
          path: /o/oauth2/v2/auth
        exchange:
          remote: google-oauth
          path: /token
remotes:
  - key: google-apis
    baseUrl: https://www.googleapis.com
  - key: google-account
    baseUrl: https://accounts.google.com
  - key: google-oauth
    baseUrl: https://oauth2.googleapis.com
`.trim();

async function startServer(opts: {
  broadcastStateChange?: (type: string, data?: any) => void;
} = {}) {
  const sim = createSimulator();
  const manifest = parseManifestContent(MANIFEST_YAML);
  // The shim loadFromManifest is what dev does at boot; mirror that.
  sim.externalAuth.loadFromManifest(manifest.authProviders, manifest.remotes);
  const handler = createApiHandler(sim, manifest, {
    broadcastStateChange: opts.broadcastStateChange,
  });

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    void handler(req, res, url);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('bind failed');
  return { sim, server, url: `http://127.0.0.1:${address.port}` };
}

const servers: Array<ReturnType<typeof createServer>> = [];

describe('/api/providers', () => {
  beforeEach(() => {
    _resetOAuthCallbackRegistryForTests();
  });

  afterAll(async () => {
    await Promise.all(servers.map((s) => new Promise<void>((resolve, reject) => {
      s.close((err) => err ? reject(err) : resolve());
    })));
  });

  it('GET lists providers from manifest with status fields', async () => {
    const { server, url } = await startServer();
    servers.push(server);

    const res = await fetch(`${url}/api/providers`);
    expect(res.ok).toBe(true);
    const body = await res.json();

    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      key: 'google',
      name: 'Google',
      scopes: ['profile', 'email'],
      hasSecret: false,
      connected: false,
    });
    expect(body[0].account).toBeUndefined();
  });

  it('GET reflects hasSecret and connected when populated', async () => {
    const { sim, server, url } = await startServer();
    servers.push(server);

    sim.externalAuth.setSecret('google', 'shh');
    sim.externalAuth.setToken('google', {
      provider: 'google',
      accessToken: 'access-token-123',
      account: { id: 'user-1', displayName: 'Test User', scopes: [] },
    });

    const res = await fetch(`${url}/api/providers`);
    const body = await res.json();
    expect(body[0]).toMatchObject({
      key: 'google',
      hasSecret: true,
      connected: true,
      account: { id: 'user-1', displayName: 'Test User' },
    });
  });

  it('POST /:key/start returns 400 when no client secret is configured', async () => {
    const { server, url } = await startServer();
    servers.push(server);

    const res = await fetch(`${url}/api/providers/google/start`, { method: 'POST' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/No client secret/i);
  });

  it('POST /:key/start returns 404 for unknown provider', async () => {
    const { server, url } = await startServer();
    servers.push(server);

    const res = await fetch(`${url}/api/providers/unknown/start`, { method: 'POST' });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/Unknown provider/i);
  });

  it('POST /:key/start returns { authUrl, state, redirectUri } and registers a pending flow', async () => {
    const { sim, server, url } = await startServer();
    servers.push(server);
    sim.externalAuth.setSecret('google', 'shh');

    const res = await fetch(`${url}/api/providers/google/start`, { method: 'POST' });
    expect(res.ok).toBe(true);
    const body = await res.json();

    expect(body.authUrl).toMatch(/^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth/);
    expect(body.authUrl).toContain('client_id=google-client-id');
    expect(body.authUrl).toContain(`state=${body.state}`);
    expect(body.redirectUri).toBe('http://localhost:5173/__tools/oauth/callback');
    expect(body.state).toMatch(/^[0-9a-f]{32}$/);

    // Pending flow registered for cleanup
    expect(getOAuthCallbackRegistry().size()).toBe(1);
    expect(getOAuthCallbackRegistry().listProviders()).toEqual(['google']);
  });

  it('DELETE /:key revokes the token and broadcasts providerDisconnected', async () => {
    const broadcast = vi.fn();
    const { sim, server, url } = await startServer({ broadcastStateChange: broadcast });
    servers.push(server);

    sim.externalAuth.setToken('google', {
      provider: 'google',
      accessToken: 'access-token-123',
    });
    expect(sim.externalAuth.hasCredentials('google')).toBe(true);

    const res = await fetch(`${url}/api/providers/google`, { method: 'DELETE' });
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.success).toBe(true);

    expect(sim.externalAuth.hasCredentials('google')).toBe(false);
    expect(broadcast).toHaveBeenCalledWith('providerDisconnected', { providerKey: 'google' });
  });

  it('DELETE /:key returns 404 for unknown provider', async () => {
    const { server, url } = await startServer();
    servers.push(server);

    const res = await fetch(`${url}/api/providers/unknown`, { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});
