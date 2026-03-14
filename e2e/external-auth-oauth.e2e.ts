/**
 * E2E test: Third-party OAuth flow via requestCredentials().
 *
 * Spins up a mock OAuth provider (fake Google) that handles:
 *   1. Authorization endpoint → returns page with "Authorize" link
 *   2. Token exchange endpoint → returns access token
 *   3. Profile endpoint → returns user info
 *
 * Then exercises the full browser-driven flow:
 *   - forge-sim loads a manifest with provider config pointing at our mock
 *   - interactiveOAuthFlow starts → callback server listens, onAuthUrl fires
 *   - Playwright navigates to the auth URL → clicks "Authorize"
 *   - Mock provider redirects to callback → forge-sim exchanges code → token stored
 *
 * No real third-party API calls are made.
 */

import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { ForgeSimulator } from '../src/simulator.js';
import { setSimulator } from '../src/shims/globals.js';

// ── Constants ───────────────────────────────────────────────────────────

const MOCK_PORT = 19480;
const CALLBACK_PORT = 19421;

const MOCK_AUTH_CODE = 'mock-auth-code-12345';
const MOCK_ACCESS_TOKEN = 'mock-access-token-ya29.xxx';
const MOCK_REFRESH_TOKEN = 'mock-refresh-token-1//xxx';
const MOCK_USER_ID = 'mock-user-42';
const MOCK_USER_EMAIL = 'testuser@mockgoogle.com';

// ── Mock OAuth Provider ─────────────────────────────────────────────────

function startMockProvider(): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${MOCK_PORT}`);

      // Authorization endpoint — returns a page with an "Authorize" link
      if (url.pathname === '/o/oauth2/v2/auth') {
        const redirectUri = url.searchParams.get('redirect_uri')!;
        const state = url.searchParams.get('state')!;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<!DOCTYPE html><html><body>
          <h1>Mock Google Authorization</h1>
          <p>Client ID: ${url.searchParams.get('client_id')}</p>
          <p>Scopes: ${url.searchParams.get('scope')}</p>
          <a id="authorize" href="${redirectUri}?code=${MOCK_AUTH_CODE}&state=${state}">Authorize</a>
        </body></html>`);
        return;
      }

      // Token exchange endpoint
      if (url.pathname === '/token' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          const params = new URLSearchParams(body);
          const grantType = params.get('grant_type');

          if (grantType === 'authorization_code' && params.get('code') === MOCK_AUTH_CODE) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              access_token: MOCK_ACCESS_TOKEN,
              refresh_token: MOCK_REFRESH_TOKEN,
              expires_in: 3600,
              token_type: 'Bearer',
              scope: 'profile email',
            }));
            return;
          }

          if (grantType === 'refresh_token') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              access_token: 'refreshed-access-token',
              expires_in: 3600,
              token_type: 'Bearer',
            }));
            return;
          }

          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid_grant' }));
        });
        return;
      }

      // Profile endpoint
      if (url.pathname === '/userinfo/v2/me') {
        const auth = req.headers.authorization;
        if (!auth?.includes(MOCK_ACCESS_TOKEN)) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'invalid_token' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: MOCK_USER_ID,
          email: MOCK_USER_EMAIL,
          name: 'Test User',
          picture: 'https://example.com/avatar.jpg',
        }));
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    server.listen(MOCK_PORT, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}

// ── Manifest ────────────────────────────────────────────────────────────

const MANIFEST = `
app:
  id: ari:cloud:ecosystem::app/e2e-oauth-test
modules:
  jira:issuePanel:
    - key: main
      resource: main
      resolver:
        function: resolver
      title: E2E OAuth Test
  function:
    - key: resolver
      handler: index.handler
resources:
  - key: main
    path: src/frontend/index.tsx
remotes:
  - key: mock-google-apis
    baseUrl: http://localhost:${MOCK_PORT}
  - key: mock-google-auth
    baseUrl: http://localhost:${MOCK_PORT}
providers:
  auth:
    - key: mock-google
      name: Mock Google
      type: oauth2
      clientId: mock-client-id
      scopes:
        - profile
        - email
      remotes:
        - mock-google-apis
      bearerMethod: authorization-header
      actions:
        authorization:
          remote: mock-google-auth
          path: /o/oauth2/v2/auth
        exchange:
          remote: mock-google-auth
          path: /token
        refreshToken:
          remote: mock-google-auth
          path: /token
        retrieveProfile:
          remote: mock-google-apis
          path: /userinfo/v2/me
          resolvers:
            id: id
            displayName: email
            avatarUrl: picture
`;

// ── Tests ───────────────────────────────────────────────────────────────

test.describe('External Auth OAuth Flow', () => {
  let mockProvider: Server;
  let sim: ForgeSimulator;

  test.beforeAll(async () => {
    mockProvider = await startMockProvider();
  });

  test.afterAll(async () => {
    mockProvider?.close();
  });

  test.beforeEach(async () => {
    sim = new ForgeSimulator();
    setSimulator(sim);
    await sim.loadManifest(MANIFEST);
    sim.externalAuth.setSecret('mock-google', 'mock-client-secret');
  });

  test('full OAuth dance: interactiveOAuthFlow opens auth URL, browser authorizes, token stored', async ({ page }) => {
    // Capture the auth URL via the hook (instead of opening a real browser)
    let capturedAuthUrl = '';
    sim.externalAuth.onAuthUrl = (url) => { capturedAuthUrl = url; };

    // Start the OAuth flow (runs in background — opens callback server, fires onAuthUrl)
    const flowPromise = sim.externalAuth.interactiveOAuthFlow('mock-google', CALLBACK_PORT);

    // Wait for the callback server to start and onAuthUrl to fire
    await expect.poll(() => capturedAuthUrl, { timeout: 5000 }).toBeTruthy();

    // Playwright navigates to the auth URL (simulating the browser popup)
    await page.goto(capturedAuthUrl);

    // Verify we see the mock authorization page
    await expect(page.locator('h1')).toHaveText('Mock Google Authorization');
    await expect(page.locator('text=mock-client-id')).toBeVisible();
    await expect(page.locator('text=profile email')).toBeVisible();

    // Click "Authorize" — mock provider redirects to our callback with code
    await page.click('#authorize');

    // Should land on the success page
    await expect(page.locator('h1')).toHaveText('✅ Authorized!');

    // The flow promise should resolve with a valid token
    const token = await flowPromise;
    expect(token).not.toBeNull();
    expect(token!.accessToken).toBe(MOCK_ACCESS_TOKEN);
    expect(token!.refreshToken).toBe(MOCK_REFRESH_TOKEN);
    expect(token!.expiresAt).toBeGreaterThan(Date.now());

    // Profile should have been retrieved
    expect(token!.account).toBeDefined();
    expect(token!.account!.id).toBe(MOCK_USER_ID);
    expect(token!.account!.displayName).toBe(MOCK_USER_EMAIL);

    // Store should report credentials as valid
    expect(sim.externalAuth.hasCredentials('mock-google')).toBe(true);
    expect(sim.externalAuth.hasCredentials('mock-google', ['profile', 'email'])).toBe(true);
  });

  test('requestCredentials() triggers interactive flow and returns true on success', async ({ page }) => {
    // Hook to capture auth URL
    let capturedAuthUrl = '';
    sim.externalAuth.onAuthUrl = (url) => { capturedAuthUrl = url; };

    // Call requestCredentials from the shim (same as app code would)
    const forgeApi = await import('../src/shims/forge-api.js');
    const google = forgeApi.asUser().withProvider('mock-google', 'mock-google-apis');

    const credPromise = google.requestCredentials();

    // Wait for auth URL
    await expect.poll(() => capturedAuthUrl, { timeout: 5000 }).toBeTruthy();

    // Complete the dance in the browser
    await page.goto(capturedAuthUrl);
    await page.click('#authorize');
    await expect(page.locator('h1')).toHaveText('✅ Authorized!');

    // requestCredentials should resolve to true
    expect(await credPromise).toBe(true);

    // Subsequent hasCredentials should return true
    expect(await google.hasCredentials()).toBe(true);
  });

  test('withProvider().fetch() uses mock routes (no token needed)', async () => {
    sim.productApi.mockRoutes('mock-google-apis', {
      'GET /userinfo/v2/me': { id: MOCK_USER_ID, email: MOCK_USER_EMAIL },
    });

    const forgeApi = await import('../src/shims/forge-api.js');
    const google = forgeApi.asUser().withProvider('mock-google', 'mock-google-apis');
    const resp = await google.fetch('/userinfo/v2/me');
    const data = await resp.json();

    expect(data.id).toBe(MOCK_USER_ID);
    expect(data.email).toBe(MOCK_USER_EMAIL);
  });

  test('withProvider().fetch() hits real mock server when token is set', async () => {
    // Set a valid token pointing at our mock provider
    sim.externalAuth.setToken('mock-google', {
      provider: 'mock-google',
      accessToken: MOCK_ACCESS_TOKEN,
      expiresAt: Date.now() + 3600_000,
      scopes: ['profile', 'email'],
    });

    // No mock routes — should fall through to real HTTP with Bearer token
    const forgeApi = await import('../src/shims/forge-api.js');
    const google = forgeApi.asUser().withProvider('mock-google', 'mock-google-apis');
    const resp = await google.fetch('/userinfo/v2/me');
    const data = await resp.json();

    expect(data.id).toBe(MOCK_USER_ID);
    expect(data.email).toBe(MOCK_USER_EMAIL);
  });

  test('OAuth error is handled gracefully', async ({ page }) => {
    let capturedAuthUrl = '';
    sim.externalAuth.onAuthUrl = (url) => { capturedAuthUrl = url; };

    const flowPromise = sim.externalAuth.interactiveOAuthFlow('mock-google', CALLBACK_PORT);

    await expect.poll(() => capturedAuthUrl, { timeout: 5000 }).toBeTruthy();

    // Instead of clicking authorize, navigate directly to callback with an error
    const callbackUrl = new URL(capturedAuthUrl);
    const state = callbackUrl.searchParams.get('state')!;
    const redirectUri = callbackUrl.searchParams.get('redirect_uri')!;

    await page.goto(`${redirectUri}?error=access_denied&state=${state}`);
    await expect(page.locator('h1')).toHaveText('❌ Authorization failed');

    // Flow should resolve to null (failed)
    const token = await flowPromise;
    expect(token).toBeNull();
    expect(sim.externalAuth.hasCredentials('mock-google')).toBe(false);
  });
});
