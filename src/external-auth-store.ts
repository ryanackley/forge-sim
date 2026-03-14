/**
 * ExternalAuthStore — manages third-party OAuth tokens for withProvider().
 *
 * Three modes:
 *   - Mock: No tokens needed. withProvider().fetch() routes through productApi mock routes.
 *   - Token: Dev provides tokens (via CLI, config, or MCP). fetch() injects Bearer header.
 *   - Live OAuth: Full 3LO dance against the provider's endpoints from the manifest.
 *
 * Tokens are stored in the CredentialStore (per Atlassian account, per provider).
 * Provider client secrets are stored in .forge-sim/providers.json (per-project, 0600).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createServer, type Server } from 'node:http';
import { randomBytes } from 'node:crypto';
import type { ManifestAuthProvider, ManifestRemote } from './types.js';
import type { ExternalAuthAccount, ThirdPartyToken } from './auth/credentials.js';

// ── Provider Secrets Config ─────────────────────────────────────────────────

export interface ProviderSecrets {
  [providerKey: string]: { clientSecret: string };
}

/**
 * Load provider secrets from <appDir>/.forge-sim/providers.json.
 */
export async function loadProviderSecrets(appDir: string): Promise<ProviderSecrets> {
  const file = join(appDir, '.forge-sim', 'providers.json');
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(await readFile(file, 'utf-8'));
  } catch {
    return {};
  }
}

/**
 * Save provider secrets to <appDir>/.forge-sim/providers.json (mode 0600).
 */
export async function saveProviderSecrets(appDir: string, secrets: ProviderSecrets): Promise<void> {
  const dir = join(appDir, '.forge-sim');
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, 'providers.json'),
    JSON.stringify(secrets, null, 2),
    { mode: 0o600 },
  );
}

// ── ExternalAuthStore ───────────────────────────────────────────────────────

export class ExternalAuthStore {
  /** Provider definitions from manifest */
  private providers = new Map<string, ManifestAuthProvider>();
  /** Remote definitions from manifest (key → baseUrl) */
  private remotes = new Map<string, ManifestRemote>();
  /** Provider client secrets (from providers.json or programmatic) */
  private secrets = new Map<string, string>();
  /** Stored tokens keyed by provider key */
  private tokens = new Map<string, ThirdPartyToken>();

  /**
   * Hook for intercepting the auth URL instead of opening a browser.
   * When set, called with the auth URL. When null, uses platform-default browser open.
   * Useful for testing and headless environments.
   */
  onAuthUrl: ((url: string) => void) | null = null;

  // ── Setup ───────────────────────────────────────────────────────────

  /**
   * Load providers and remotes from a parsed manifest.
   */
  loadFromManifest(
    providers: Map<string, ManifestAuthProvider>,
    remotes: Map<string, ManifestRemote>,
  ): void {
    this.providers = new Map(providers);
    this.remotes = new Map(remotes);
  }

  /**
   * Set the client secret for a provider.
   */
  setSecret(providerKey: string, clientSecret: string): void {
    this.secrets.set(providerKey, clientSecret);
  }

  /**
   * Load secrets from a ProviderSecrets object (from disk).
   */
  loadSecrets(secrets: ProviderSecrets): void {
    for (const [key, val] of Object.entries(secrets)) {
      if (val.clientSecret) {
        this.secrets.set(key, val.clientSecret);
      }
    }
  }

  /**
   * Check if a provider has a client secret configured.
   */
  hasSecret(providerKey: string): boolean {
    return this.secrets.has(providerKey);
  }

  // ── Token Management ────────────────────────────────────────────────

  /**
   * Set a token directly (for mock/manual mode).
   */
  setToken(providerKey: string, token: ThirdPartyToken): void {
    this.tokens.set(providerKey, token);
  }

  /**
   * Get stored token for a provider.
   */
  getToken(providerKey: string): ThirdPartyToken | undefined {
    return this.tokens.get(providerKey);
  }

  /**
   * Check if a provider has valid credentials.
   */
  hasCredentials(providerKey: string, scopes?: string[]): boolean {
    const token = this.tokens.get(providerKey);
    if (!token) return false;

    // Check expiry
    if (token.expiresAt && Date.now() >= token.expiresAt) return false;

    // Check scopes if requested
    if (scopes && scopes.length > 0 && token.scopes) {
      return scopes.every(s => token.scopes!.includes(s));
    }

    return true;
  }

  /**
   * Remove token for a provider.
   */
  revokeToken(providerKey: string): void {
    this.tokens.delete(providerKey);
  }

  /**
   * Get the external account info for a provider.
   */
  getAccount(providerKey: string): ExternalAuthAccount | undefined {
    return this.tokens.get(providerKey)?.account;
  }

  /**
   * List all accounts for a provider (in our sim, max 1 per provider).
   */
  listAccounts(providerKey: string): ExternalAuthAccount[] {
    const account = this.getAccount(providerKey);
    return account ? [account] : [];
  }

  // ── Provider Info ───────────────────────────────────────────────────

  /**
   * Get provider definition from manifest.
   */
  getProvider(key: string): ManifestAuthProvider | undefined {
    return this.providers.get(key);
  }

  /**
   * List all configured providers.
   */
  listProviders(): ManifestAuthProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Resolve a remote's base URL.
   */
  getRemoteBaseUrl(remoteKey: string): string | undefined {
    return this.remotes.get(remoteKey)?.baseUrl;
  }

  /**
   * Get the primary remote base URL for a provider (first remote in the list).
   */
  getProviderBaseUrl(providerKey: string, remoteName?: string): string | undefined {
    const provider = this.providers.get(providerKey);
    if (!provider) return undefined;

    const key = remoteName ?? provider.remotes?.[0];
    if (!key) return undefined;

    return this.remotes.get(key)?.baseUrl;
  }

  /**
   * Get the client secret for a provider.
   */
  getSecret(providerKey: string): string | undefined {
    return this.secrets.get(providerKey);
  }

  // ── OAuth Flow Helpers ──────────────────────────────────────────────

  /**
   * Build the authorization URL for a provider's OAuth flow.
   */
  buildAuthorizationUrl(
    providerKey: string,
    redirectUri: string,
    state: string,
  ): string | null {
    const provider = this.providers.get(providerKey);
    if (!provider) return null;

    const authAction = provider.actions.authorization;
    const baseUrl = this.remotes.get(authAction.remote)?.baseUrl;
    if (!baseUrl) return null;

    const url = new URL(authAction.path, baseUrl);
    url.searchParams.set('client_id', provider.clientId ?? '');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('response_type', 'code');

    if (provider.scopes?.length) {
      url.searchParams.set('scope', provider.scopes.join(' '));
    }

    // Add any custom query parameters from manifest
    if (authAction.queryParameters) {
      for (const [key, value] of Object.entries(authAction.queryParameters)) {
        url.searchParams.set(key, value);
      }
    }

    return url.toString();
  }

  /**
   * Exchange an authorization code for tokens.
   */
  async exchangeCode(
    providerKey: string,
    code: string,
    redirectUri: string,
  ): Promise<ThirdPartyToken | null> {
    const provider = this.providers.get(providerKey);
    if (!provider) return null;

    const secret = this.secrets.get(providerKey);
    if (!secret) return null;

    const exchangeAction = provider.actions.exchange;
    const baseUrl = this.remotes.get(exchangeAction.remote)?.baseUrl;
    if (!baseUrl) return null;

    const url = `${baseUrl}${exchangeAction.path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    };

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: provider.clientId ?? '',
      client_secret: secret,
      code,
      redirect_uri: redirectUri,
    });

    // Basic auth option
    if (exchangeAction.useBasicAuth) {
      const basic = Buffer.from(`${provider.clientId}:${secret}`).toString('base64');
      headers['Authorization'] = `Basic ${basic}`;
    }

    const response = await fetch(url, { method: 'POST', headers, body: body.toString() });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Token exchange failed (${response.status}): ${text}`);
    }

    const data = await response.json() as Record<string, any>;
    const resolvers = exchangeAction.resolvers ?? {};

    const accessToken = resolveField(data, resolvers.accessToken ?? 'access_token');
    const refreshToken = resolveField(data, resolvers.refreshToken ?? 'refresh_token');
    const expiresIn = resolveField(data, resolvers.accessTokenExpires ?? 'expires_in');

    const token: ThirdPartyToken = {
      provider: providerKey,
      accessToken: String(accessToken ?? ''),
      refreshToken: refreshToken ? String(refreshToken) : undefined,
      expiresAt: expiresIn ? Date.now() + Number(expiresIn) * 1000 : undefined,
      scopes: provider.scopes ?? [],
    };

    // Retrieve profile if configured
    if (provider.actions.retrieveProfile) {
      try {
        token.account = await this.retrieveProfile(providerKey, token.accessToken);
      } catch {
        // Profile retrieval is optional — continue without it
      }
    }

    this.tokens.set(providerKey, token);
    return token;
  }

  /**
   * Refresh an expired token.
   */
  async refreshToken(providerKey: string): Promise<ThirdPartyToken | null> {
    const provider = this.providers.get(providerKey);
    const existing = this.tokens.get(providerKey);
    if (!provider || !existing?.refreshToken) return null;

    const refreshAction = provider.actions.refreshToken ?? provider.actions.exchange;
    const secret = this.secrets.get(providerKey);
    if (!secret) return null;

    const baseUrl = this.remotes.get(refreshAction.remote)?.baseUrl;
    if (!baseUrl) return null;

    const url = `${baseUrl}${refreshAction.path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    };

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: provider.clientId ?? '',
      client_secret: secret,
      refresh_token: existing.refreshToken,
    });

    if (refreshAction.useBasicAuth) {
      const basic = Buffer.from(`${provider.clientId}:${secret}`).toString('base64');
      headers['Authorization'] = `Basic ${basic}`;
    }

    const response = await fetch(url, { method: 'POST', headers, body: body.toString() });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Token refresh failed (${response.status}): ${text}`);
    }

    const data = await response.json() as Record<string, any>;
    const resolvers = refreshAction.resolvers ?? {};

    const accessToken = resolveField(data, resolvers.accessToken ?? 'access_token');
    const refreshTokenNew = resolveField(data, resolvers.refreshToken ?? 'refresh_token');
    const expiresIn = resolveField(data, resolvers.accessTokenExpires ?? 'expires_in');

    const updated: ThirdPartyToken = {
      ...existing,
      accessToken: String(accessToken ?? existing.accessToken),
      refreshToken: refreshTokenNew ? String(refreshTokenNew) : existing.refreshToken,
      expiresAt: expiresIn ? Date.now() + Number(expiresIn) * 1000 : existing.expiresAt,
    };

    this.tokens.set(providerKey, updated);
    return updated;
  }

  /**
   * Retrieve external account profile using the provider's retrieveProfile action.
   */
  async retrieveProfile(
    providerKey: string,
    accessToken: string,
  ): Promise<ExternalAuthAccount | undefined> {
    const provider = this.providers.get(providerKey);
    if (!provider?.actions.retrieveProfile) return undefined;

    const profileAction = provider.actions.retrieveProfile;
    const baseUrl = this.remotes.get(profileAction.remote)?.baseUrl;
    if (!baseUrl) return undefined;

    const url = `${baseUrl}${profileAction.path}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });

    if (!response.ok) return undefined;

    const data = await response.json() as Record<string, any>;
    const resolvers = profileAction.resolvers ?? {};

    return {
      id: String(resolveField(data, resolvers.id ?? 'id') ?? ''),
      displayName: String(resolveField(data, resolvers.displayName ?? 'displayName') ?? ''),
      avatarUrl: resolveField(data, resolvers.avatarUrl ?? 'avatarUrl') as string | undefined,
      scopes: provider.scopes ?? [],
    };
  }

  /**
   * Ensure a token is valid, refreshing if needed.
   */
  async ensureValidToken(providerKey: string): Promise<ThirdPartyToken | null> {
    const token = this.tokens.get(providerKey);
    if (!token) return null;

    // Check if expired
    if (token.expiresAt && Date.now() >= token.expiresAt - 5 * 60 * 1000) {
      if (token.refreshToken) {
        return this.refreshToken(providerKey);
      }
      return null; // Expired with no refresh token
    }

    return token;
  }

  // ── Interactive OAuth (popup browser) ────────────────────────────────

  /**
   * Run an interactive OAuth flow: opens the browser, waits for callback,
   * exchanges code, stores token. Used by requestCredentials() at runtime.
   *
   * Returns the token on success, null if the provider lacks a secret or
   * the flow is cancelled/fails.
   */
  async interactiveOAuthFlow(providerKey: string, port = 19421): Promise<ThirdPartyToken | null> {
    const provider = this.providers.get(providerKey);
    if (!provider) {
      console.warn(`[forge-sim] Unknown provider: ${providerKey}`);
      return null;
    }

    if (!this.secrets.has(providerKey)) {
      console.warn(
        `[forge-sim] No client secret for "${providerKey}". ` +
        `Run \`forge-sim auth --provider ${providerKey} --secret\` first.`
      );
      return null;
    }

    const callbackPath = '/__forge-sim/oauth/callback';
    const redirectUri = `http://localhost:${port}${callbackPath}`;
    const state = randomBytes(16).toString('hex');

    const authUrl = this.buildAuthorizationUrl(providerKey, redirectUri, state);
    if (!authUrl) {
      console.warn(`[forge-sim] Could not build auth URL for "${providerKey}".`);
      return null;
    }

    console.log(`[forge-sim] Opening browser for ${provider.name} authorization...`);

    try {
      const code = await this.waitForCallback(port, callbackPath, state, authUrl);
      const token = await this.exchangeCode(providerKey, code, redirectUri);
      if (token) {
        console.log(`[forge-sim] ✅ Authorized with ${provider.name}!`);
      }
      return token;
    } catch (err: any) {
      console.warn(`[forge-sim] OAuth flow failed for "${providerKey}": ${err.message}`);
      return null;
    }
  }

  private waitForCallback(
    port: number,
    callbackPath: string,
    expectedState: string,
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
          res.end(oauthCallbackHtml('❌ Authorization failed', error));
          clearTimeout(timeout);
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (!code || state !== expectedState) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(oauthCallbackHtml('❌ Invalid callback', 'State mismatch or missing code.'));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(oauthCallbackHtml('✅ Authorized!', 'You can close this tab.'));
        clearTimeout(timeout);
        server.close();
        resolve(code);
      });

      server.listen(port, '127.0.0.1', () => {
        if (this.onAuthUrl) {
          this.onAuthUrl(authUrl);
        } else {
          openBrowserUrl(authUrl);
        }
      });

      server.on('error', (err: any) => {
        clearTimeout(timeout);
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`Port ${port} in use.`));
        } else {
          reject(err);
        }
      });
    });
  }

  // ── Reset ───────────────────────────────────────────────────────────

  clear(): void {
    this.providers.clear();
    this.remotes.clear();
    this.secrets.clear();
    this.tokens.clear();
  }
}

// ── Utilities ───────────────────────────────────────────────────────────────

/**
 * Resolve a dot-path field from an object (e.g., "user.token" → obj.user.token).
 */
function resolveField(obj: Record<string, any>, path: string): any {
  const parts = path.split('.');
  let current: any = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

function oauthCallbackHtml(title: string, message: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>forge-sim</title>
<style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#1a1a2e;color:#e0e0e0}
.card{text-align:center;padding:2rem;border-radius:8px;background:#16213e;box-shadow:0 4px 12px rgba(0,0,0,.3)}
h1{margin:0 0 .5rem}</style></head>
<body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`;
}

function openBrowserUrl(url: string): void {
  const { exec } = require('node:child_process');
  const cmd = process.platform === 'darwin' ? 'open' :
    process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${cmd} "${url}"`);
}
