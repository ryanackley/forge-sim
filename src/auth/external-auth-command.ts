/**
 * `forge-sim auth --provider <key>` — manage third-party OAuth provider credentials.
 *
 * Reads provider definitions from the app's manifest.yml and orchestrates
 * the OAuth 3LO flow against the provider's endpoints.
 *
 * Usage:
 *   forge-sim auth --provider google        — OAuth dance for a specific provider
 *   forge-sim auth --provider google --secret — set client secret, then dance
 *   forge-sim auth --providers              — dance for all manifest providers
 *   forge-sim auth --providers --list       — show auth status for all providers
 */

import { createServer, type Server } from 'node:http';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline';
import { ExternalAuthStore, loadProviderSecrets, saveProviderSecrets } from '../external-auth-store.js';
import { parseManifest } from '../manifest.js';
import { loadCredentials, saveCredentials, getDefaultAccount, setThirdPartyToken } from './credentials.js';
import type { ManifestAuthProvider } from '../types.js';

export interface ExternalAuthCommandOptions {
  provider?: string;
  providers?: boolean;
  list?: boolean;
  secret?: boolean;
  appDir: string;
  manifestPath: string;
  port?: number;
}

export async function externalAuthCommand(options: ExternalAuthCommandOptions): Promise<void> {
  // Parse manifest to get providers
  const manifest = await parseManifest(options.manifestPath);

  if (manifest.authProviders.size === 0) {
    console.log('  No auth providers found in manifest.yml.');
    return;
  }

  // Load secrets
  const store = new ExternalAuthStore();
  store.loadFromManifest(manifest.authProviders, manifest.remotes);
  const secrets = await loadProviderSecrets(options.appDir);
  store.loadSecrets(secrets);

  // Load existing tokens from credentials
  const creds = await loadCredentials(options.appDir);
  const account = getDefaultAccount(creds);
  if (account) {
    for (const [providerKey, token] of Object.entries(creds.thirdParty[account.id] ?? {})) {
      store.setToken(providerKey, token);
    }
  }

  // ── List providers ──────────────────────────────────────────────────
  if (options.list || (options.providers && !options.provider)) {
    if (options.list) {
      console.log('');
      console.log('  🔑 External Auth Providers:');
      console.log('  ───────────────────────────');
      for (const [key, provider] of manifest.authProviders) {
        const hasSecret = store.hasSecret(key);
        const hasCreds = store.hasCredentials(key);
        const acct = store.getAccount(key);
        const secretIcon = hasSecret ? '✅' : '❌';
        const authIcon = hasCreds ? '✅' : '❌';
        const acctStr = acct ? ` (${acct.displayName})` : '';
        console.log(`  ${key}: ${provider.name}`);
        console.log(`    Secret: ${secretIcon}  Auth: ${authIcon}${acctStr}`);
        if (provider.remotes?.length) {
          const remoteUrls = provider.remotes.map(r => {
            const base = manifest.remotes.get(r)?.baseUrl ?? 'unknown';
            return `${r} → ${base}`;
          });
          console.log(`    Remotes: ${remoteUrls.join(', ')}`);
        }
      }
      console.log('');
      return;
    }

    // --providers (no --list) — dance for all
    for (const [key] of manifest.authProviders) {
      await authForProvider(key, store, options);
    }
    return;
  }

  // ── Single provider ──────────────────────────────────────────────────
  if (options.provider) {
    const provider = manifest.authProviders.get(options.provider);
    if (!provider) {
      console.error(`  ❌ Provider "${options.provider}" not found in manifest.`);
      console.log(`  Available: ${Array.from(manifest.authProviders.keys()).join(', ')}`);
      return;
    }

    await authForProvider(options.provider, store, options);
    return;
  }
}

async function authForProvider(
  providerKey: string,
  store: ExternalAuthStore,
  options: ExternalAuthCommandOptions,
): Promise<void> {
  const provider = store.getProvider(providerKey)!;
  console.log('');
  console.log(`  🔑 ${provider.name} (${providerKey})`);
  console.log(`  ${'─'.repeat(provider.name.length + providerKey.length + 5)}`);

  // Ensure client secret
  if (!store.hasSecret(providerKey)) {
    if (!options.secret) {
      console.log(`  No client secret configured for "${providerKey}".`);
      const answer = await prompt(`  Enter client secret (or press Enter to skip): `);
      if (!answer) {
        console.log('  Skipped.');
        return;
      }
      store.setSecret(providerKey, answer);
      // Save to disk
      const secrets = await loadProviderSecrets(options.appDir);
      secrets[providerKey] = { clientSecret: answer };
      await saveProviderSecrets(options.appDir, secrets);
      console.log(`  ✅ Secret saved to .forge-sim/providers.json`);
    } else {
      const answer = await prompt(`  Client secret for "${providerKey}": `);
      if (!answer) { console.log('  Cancelled.'); return; }
      store.setSecret(providerKey, answer);
      const secrets = await loadProviderSecrets(options.appDir);
      secrets[providerKey] = { clientSecret: answer };
      await saveProviderSecrets(options.appDir, secrets);
      console.log(`  ✅ Secret saved.`);
    }
  }

  // Check if already authorized
  if (store.hasCredentials(providerKey)) {
    const acct = store.getAccount(providerKey);
    console.log(`  Already authorized${acct ? ` as ${acct.displayName}` : ''}.`);
    const reauth = await prompt('  Re-authorize? (y/N): ');
    if (reauth.toLowerCase() !== 'y') return;
  }

  // Run the OAuth dance
  const port = options.port ?? 19421;
  const callbackPath = '/__forge-sim/oauth/callback';
  const redirectUri = `http://localhost:${port}${callbackPath}`;
  const state = randomBytes(16).toString('hex');

  const authUrl = store.buildAuthorizationUrl(providerKey, redirectUri, state);
  if (!authUrl) {
    console.error(`  ❌ Could not build authorization URL. Check manifest remotes.`);
    return;
  }

  console.log('');
  console.log(`  Opening browser for ${provider.name} authorization...`);
  console.log(`  If the browser doesn't open, visit:`);
  console.log(`  ${authUrl}`);
  console.log('');

  try {
    const code = await waitForCallback(port, callbackPath, state, authUrl);
    console.log('  Exchanging code for tokens...');

    const token = await store.exchangeCode(providerKey, code, redirectUri);
    if (!token) {
      console.error('  ❌ Token exchange failed.');
      return;
    }

    // Save token to credentials store
    const creds = await loadCredentials(options.appDir);
    const account = getDefaultAccount(creds);
    if (account) {
      setThirdPartyToken(creds, account.id, providerKey, token);
      await saveCredentials(creds, { local: options.appDir });
    }

    const acct = token.account;
    console.log('');
    console.log(`  ✅ Authorized with ${provider.name}!`);
    if (acct) console.log(`     Account: ${acct.displayName} (${acct.id})`);
    if (token.scopes?.length) console.log(`     Scopes: ${token.scopes.join(', ')}`);
    console.log('');
  } catch (err: any) {
    console.error(`  ❌ OAuth failed: ${err.message}`);
  }
}

// ── Callback Server ─────────────────────────────────────────────────────────

function waitForCallback(
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
        res.end(callbackHtml('❌ Authorization failed', error));
        clearTimeout(timeout);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (!code || state !== expectedState) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(callbackHtml('❌ Invalid callback', 'State mismatch or missing code.'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(callbackHtml('✅ Authorized!', 'You can close this tab.'));
      clearTimeout(timeout);
      server.close();
      resolve(code);
    });

    server.listen(port, '127.0.0.1', () => {
      console.log(`  🔑 Waiting for callback on http://localhost:${port}${callbackPath}`);
      openBrowser(authUrl);
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

function callbackHtml(title: string, message: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>forge-sim</title>
<style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#1a1a2e;color:#e0e0e0}
.card{text-align:center;padding:2rem;border-radius:8px;background:#16213e;box-shadow:0 4px 12px rgba(0,0,0,.3)}
h1{margin:0 0 .5rem}</style></head>
<body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`;
}

function openBrowser(url: string): void {
  const { exec } = require('node:child_process');
  const cmd = process.platform === 'darwin' ? 'open' :
    process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${cmd} "${url}"`);
}

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => { rl.close(); resolve(answer.trim()); });
  });
}
