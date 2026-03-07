/**
 * Atlassian OAuth 2.0 (3LO) with PKCE for forge-sim.
 *
 * Uses PKCE (Proof Key for Code Exchange) — no client_secret needed.
 * The client_id is public and shipped with the package.
 * Security comes from the per-session code_verifier/code_challenge pair.
 *
 * Flow:
 *   1. Generate code_verifier + code_challenge (SHA256)
 *   2. Open browser to Atlassian auth with code_challenge
 *   3. Listen on localhost for the callback
 *   4. Exchange auth code + code_verifier for tokens
 *   5. Fetch user info and accessible resources (sites)
 *   6. Return a fully populated AtlassianAccount
 */

import { createServer, type Server } from 'node:http';
import { URL } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import type { AtlassianAccount } from './credentials.js';

// ── OAuth Configuration ─────────────────────────────────────────────────────

// Public client ID — safe to ship in the package (no secret)
// TODO: Replace with actual client ID once registered
let OAUTH_CLIENT_ID = '';

const ATLASSIAN_AUTH_URL = 'https://auth.atlassian.com/authorize';
const ATLASSIAN_TOKEN_URL = 'https://auth.atlassian.com/oauth/token';
const ATLASSIAN_ME_URL = 'https://api.atlassian.com/me';
const ATLASSIAN_RESOURCES_URL = 'https://api.atlassian.com/oauth/token/accessible-resources';

/**
 * Set the OAuth client ID (can also be set via FORGE_SIM_OAUTH_CLIENT_ID env var).
 */
export function setOAuthClientId(clientId: string): void {
  OAUTH_CLIENT_ID = clientId;
}

export function getOAuthClientId(): string {
  return OAUTH_CLIENT_ID || process.env.FORGE_SIM_OAUTH_CLIENT_ID || '';
}

export function hasOAuthConfig(): boolean {
  return getOAuthClientId().length > 0;
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

// ── PKCE Helpers ────────────────────────────────────────────────────────────

/**
 * Generate a cryptographic code verifier (43-128 chars, RFC 7636).
 */
function generateCodeVerifier(): string {
  return randomBytes(64).toString('base64url');
}

/**
 * Generate code challenge from verifier (S256 method).
 */
function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

// ── OAuth Flow ──────────────────────────────────────────────────────────────

/**
 * Run the full OAuth 3LO + PKCE flow:
 * 1. Generate PKCE pair
 * 2. Start local callback server
 * 3. Open browser to Atlassian auth
 * 4. Wait for callback with auth code
 * 5. Exchange code + code_verifier for tokens (no client_secret!)
 * 6. Fetch user info + accessible resources
 */
export async function startOAuthFlow(options: {
  scopes: string[];
  port?: number;
  callbackPath?: string;
  openBrowser?: (url: string) => void;
}): Promise<OAuthResult> {
  const clientId = getOAuthClientId();
  if (!clientId) {
    throw new Error(
      'OAuth client ID not configured. Set FORGE_SIM_OAUTH_CLIENT_ID env var.'
    );
  }

  const port = options.port ?? 5173;
  const callbackPath = options.callbackPath ?? '/__tools/oauth/callback';
  const redirectUri = `http://localhost:${port}${callbackPath}`;
  const state = randomBytes(16).toString('hex');

  // PKCE: generate verifier/challenge pair
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Build authorization URL
  const authUrl = new URL(ATLASSIAN_AUTH_URL);
  authUrl.searchParams.set('audience', 'api.atlassian.com');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('scope', options.scopes.join(' '));
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('prompt', 'consent');
  // PKCE parameters
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  // Wait for the callback
  const authCode = await waitForCallback(
    port, callbackPath, state,
    options.openBrowser ?? defaultOpenBrowser,
    authUrl.toString(),
  );

  // Exchange code for tokens (PKCE — code_verifier instead of client_secret)
  const tokens = await exchangeCode(authCode, redirectUri, codeVerifier, clientId);

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
 * Note: Atlassian refresh token exchange does NOT require client_secret
 * when the original auth used PKCE.
 */
export async function refreshAccessToken(account: AtlassianAccount): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}> {
  const clientId = getOAuthClientId();

  const response = await fetch(ATLASSIAN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: clientId,
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

// ── Callback Server ─────────────────────────────────────────────────────────

function waitForCallback(
  port: number,
  callbackPath: string,
  expectedState: string,
  openBrowser: (url: string) => void,
  authUrl: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server?.close();
      reject(new Error('OAuth timeout — no callback received within 5 minutes'));
    }, 5 * 60 * 1000);

    const server: Server = createServer((req, res) => {
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
        res.end(callbackHtml('❌ Authorization failed', error, false));
        clearTimeout(timeout);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (!code || state !== expectedState) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(callbackHtml('❌ Invalid callback', 'State mismatch or missing code.', false));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(callbackHtml('✅ Authorized!', 'You can close this tab and return to your terminal.', true));
      clearTimeout(timeout);
      server.close();
      resolve(code);
    });

    server.listen(port, '127.0.0.1', () => {
      console.log(`  🔑 Waiting for OAuth callback on http://localhost:${port}${callbackPath}`);
      openBrowser(authUrl);
    });

    server.on('error', (err: any) => {
      clearTimeout(timeout);
      if (err.code === 'EADDRINUSE') {
        reject(new Error(
          `Port ${port} in use. If forge-sim dev is running, use the Tools UI to add accounts.`
        ));
      } else {
        reject(err);
      }
    });
  });
}

// ── Token Exchange ──────────────────────────────────────────────────────────

async function exchangeCode(
  code: string,
  redirectUri: string,
  codeVerifier: string,
  clientId: string,
): Promise<OAuthTokenResponse> {
  const response = await fetch(ATLASSIAN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
      // No client_secret — PKCE replaces it
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${body}`);
  }

  return response.json() as Promise<OAuthTokenResponse>;
}

// ── API Helpers ─────────────────────────────────────────────────────────────

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

// ── Utilities ───────────────────────────────────────────────────────────────

function defaultOpenBrowser(url: string): void {
  const { exec } = require('node:child_process');
  const cmd = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'start'
    : 'xdg-open';
  exec(`${cmd} "${url}"`);
}

function callbackHtml(title: string, message: string, success: boolean): string {
  const color = success ? '#22c55e' : '#ef4444';
  return `<!DOCTYPE html>
<html><body style="font-family:-apple-system,sans-serif;text-align:center;padding:60px;background:#1a1a2e;color:#e0e0e0;">
  <h2 style="color:${color}">${title}</h2>
  <p>${message}</p>
</body></html>`;
}
