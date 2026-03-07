/**
 * Atlassian OAuth 2.0 (3LO) flow for forge-sim.
 *
 * 1. Opens browser to Atlassian auth page
 * 2. Listens on localhost for the callback
 * 3. Exchanges auth code for access + refresh tokens
 * 4. Fetches user info and accessible resources (sites)
 * 5. Returns a fully populated AtlassianAccount
 *
 * Tokens are stored by the caller (credentials.ts).
 */

import { createServer, type Server } from 'node:http';
import { URL } from 'node:url';
import { randomBytes } from 'node:crypto';
import type { AtlassianAccount } from './credentials.js';

// ── OAuth Configuration ─────────────────────────────────────────────────────

// These get set from the registered OAuth app on developer.atlassian.com
// TODO: Replace with actual values once Ryan registers the app
let OAUTH_CLIENT_ID = '';
let OAUTH_CLIENT_SECRET = '';

const ATLASSIAN_AUTH_URL = 'https://auth.atlassian.com/authorize';
const ATLASSIAN_TOKEN_URL = 'https://auth.atlassian.com/oauth/token';
const ATLASSIAN_ME_URL = 'https://api.atlassian.com/me';
const ATLASSIAN_RESOURCES_URL = 'https://api.atlassian.com/oauth/token/accessible-resources';

/**
 * Set the OAuth client credentials (called during startup from config).
 */
export function setOAuthCredentials(clientId: string, clientSecret: string): void {
  OAUTH_CLIENT_ID = clientId;
  OAUTH_CLIENT_SECRET = clientSecret;
}

export function hasOAuthCredentials(): boolean {
  return OAUTH_CLIENT_ID.length > 0 && OAUTH_CLIENT_SECRET.length > 0;
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface AtlassianUser {
  account_id: string;
  email: string;
  name: string;
  picture: string;
}

export interface AccessibleResource {
  id: string;      // Cloud ID
  name: string;    // Site name
  url: string;     // https://mysite.atlassian.net
  scopes: string[];
  avatarUrl: string;
}

export interface OAuthResult {
  account: AtlassianAccount;
  resources: AccessibleResource[];
}

// ── OAuth Flow ──────────────────────────────────────────────────────────────

/**
 * Run the full OAuth 3LO flow:
 * 1. Start local callback server
 * 2. Open browser to Atlassian auth
 * 3. Wait for callback with auth code
 * 4. Exchange code for tokens
 * 5. Fetch user info + accessible resources
 */
export async function startOAuthFlow(options: {
  scopes: string[];
  port?: number;
  callbackPath?: string;
  openBrowser?: (url: string) => void;
}): Promise<OAuthResult> {
  if (!hasOAuthCredentials()) {
    throw new Error(
      'OAuth not configured. Set FORGE_SIM_OAUTH_CLIENT_ID and FORGE_SIM_OAUTH_CLIENT_SECRET, ' +
      'or run forge-sim with a registered OAuth app.'
    );
  }

  const port = options.port ?? 5173;
  const callbackPath = options.callbackPath ?? '/__tools/oauth/callback';
  const redirectUri = `http://localhost:${port}${callbackPath}`;
  const state = randomBytes(16).toString('hex');

  // Build authorization URL
  const authUrl = new URL(ATLASSIAN_AUTH_URL);
  authUrl.searchParams.set('audience', 'api.atlassian.com');
  authUrl.searchParams.set('client_id', OAUTH_CLIENT_ID);
  authUrl.searchParams.set('scope', options.scopes.join(' '));
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('prompt', 'consent');

  // Wait for the callback
  const authCode = await waitForCallback(port, callbackPath, state, options.openBrowser ?? defaultOpenBrowser, authUrl.toString());

  // Exchange code for tokens
  const tokens = await exchangeCode(authCode, redirectUri);

  // Fetch user info
  const user = await fetchUser(tokens.access_token);

  // Fetch accessible resources (sites)
  const resources = await fetchResources(tokens.access_token);

  if (resources.length === 0) {
    throw new Error('No accessible Atlassian sites found for this account.');
  }

  // Use the first resource (caller can let user pick if multiple)
  const site = resources[0];
  const siteHost = new URL(site.url).host;

  const account: AtlassianAccount = {
    id: `${user.account_id.slice(0, 8)}-${Date.now().toString(36)}`,
    name: user.name,
    email: user.email,
    site: siteHost,
    cloudId: site.id,
    accountId: user.account_id,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    scopes: tokens.scope.split(' '),
    default: true,
  };

  return { account, resources };
}

/**
 * Refresh an expired access token.
 */
export async function refreshAccessToken(account: AtlassianAccount): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}> {
  const response = await fetch(ATLASSIAN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: OAUTH_CLIENT_ID,
      client_secret: OAUTH_CLIENT_SECRET,
      refresh_token: account.refreshToken,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${body}`);
  }

  const data = await response.json() as OAuthTokenResponse;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function waitForCallback(
  port: number,
  callbackPath: string,
  expectedState: string,
  openBrowser: (url: string) => void,
  authUrl: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let server: Server;
    const timeout = setTimeout(() => {
      server?.close();
      reject(new Error('OAuth timeout — no callback received within 5 minutes'));
    }, 5 * 60 * 1000);

    server = createServer((req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${port}`);

      if (url.pathname !== callbackPath) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<html><body><h2>❌ Authorization failed</h2><p>${error}</p><p>You can close this tab.</p></body></html>`);
        clearTimeout(timeout);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (!code || state !== expectedState) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<html><body><h2>❌ Invalid callback</h2><p>State mismatch or missing code.</p></body></html>');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html><body style="font-family: -apple-system, sans-serif; text-align: center; padding: 60px;">
          <h2>✅ Authorized!</h2>
          <p>You can close this tab and return to your terminal.</p>
        </body></html>
      `);

      clearTimeout(timeout);
      server.close();
      resolve(code);
    });

    // Listen on a random port for the callback server
    // (we use the tools callback path, not a separate port)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : port;
      // Update redirect URI to use actual port... actually we need a fixed port
      // The redirect URI must match what's registered in the OAuth app
      // So we close this and use the Vite server's port instead
      server.close();
    });

    // Actually, we need to hook into the existing Vite server or use the fixed port
    // For now, start a temporary server on the expected port
    server.listen(port, '127.0.0.1', () => {
      console.log(`  🔑 Waiting for OAuth callback on http://localhost:${port}${callbackPath}`);
      openBrowser(authUrl);
    });

    server.on('error', (err: any) => {
      clearTimeout(timeout);
      if (err.code === 'EADDRINUSE') {
        // Port in use (Vite is running) — we'll need to hook into Vite's server instead
        // For CLI auth (forge-sim auth), this port should be free
        reject(new Error(`Port ${port} in use. If forge-sim dev is running, use the Tools UI to add accounts.`));
      } else {
        reject(err);
      }
    });
  });
}

async function exchangeCode(code: string, redirectUri: string): Promise<OAuthTokenResponse> {
  const response = await fetch(ATLASSIAN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: OAUTH_CLIENT_ID,
      client_secret: OAUTH_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${body}`);
  }

  return response.json() as Promise<OAuthTokenResponse>;
}

async function fetchUser(accessToken: string): Promise<AtlassianUser> {
  const response = await fetch(ATLASSIAN_ME_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user info (${response.status})`);
  }

  return response.json() as Promise<AtlassianUser>;
}

async function fetchResources(accessToken: string): Promise<AccessibleResource[]> {
  const response = await fetch(ATLASSIAN_RESOURCES_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch accessible resources (${response.status})`);
  }

  return response.json() as Promise<AccessibleResource[]>;
}

function defaultOpenBrowser(url: string): void {
  const { exec } = require('node:child_process');
  const cmd = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'start'
    : 'xdg-open';
  exec(`${cmd} "${url}"`);
}
