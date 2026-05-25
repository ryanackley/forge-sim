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

import { createInterface } from 'node:readline';
import { ExternalAuthStore, loadProviderSecrets, saveProviderSecrets } from '../external-auth-store.js';
import { parseManifest } from '../manifest.js';
import { loadCredentials, saveCredentials, getDefaultAccount, setThirdPartyToken, type ThirdPartyToken } from './credentials.js';
import { getOAuthCallbackRegistry } from './oauth-callback-registry.js';
import { ensureCallbackHost } from './standalone-callback-host.js';
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

  // Run the OAuth dance — single redirect URI shared with the dev server's
  // /__tools/oauth/callback route. If dev is up, we reuse its listener; if
  // not, ensureCallbackHost() spins up a minimal one for the duration of the
  // flow. Either way, dispatch is via the in-process OAuthCallbackRegistry.
  let host;
  try {
    host = await ensureCallbackHost();
  } catch (err: any) {
    console.error(`  ❌ ${err.message}`);
    return;
  }

  try {
    // Box the captured token so the closure assignment isn't lost to TS
    // control-flow narrowing (TS otherwise infers the outer var as `null`).
    const captured: { token: ThirdPartyToken | null } = { token: null };
    const { state, redirectUri, promise } = getOAuthCallbackRegistry().register({
      providerKey,
      onCode: async (code) => {
        console.log('  Exchanging code for tokens...');
        captured.token = await store.exchangeCode(providerKey, code, redirectUri);
        if (!captured.token) {
          throw new Error('Token exchange returned no token.');
        }
      },
    });

    const authUrl = store.buildAuthorizationUrl(providerKey, redirectUri, state);
    if (!authUrl) {
      getOAuthCallbackRegistry().cancelAll('Auth URL build failed');
      console.error(`  ❌ Could not build authorization URL. Check manifest remotes.`);
      return;
    }

    console.log('');
    console.log(`  Opening browser for ${provider.name} authorization...`);
    console.log(`  If the browser doesn't open, visit:`);
    console.log(`  ${authUrl}`);
    console.log(`  🔑 Waiting for callback on ${redirectUri}`);
    console.log('');

    openBrowser(authUrl);

    try {
      await promise;
    } catch (err: any) {
      console.error(`  ❌ OAuth failed: ${err.message}`);
      return;
    }

    const token = captured.token;
    if (!token) {
      // promise resolved but no token captured — shouldn't happen, but guard.
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
  } finally {
    await host.shutdown();
  }
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
