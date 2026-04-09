/**
 * `forge-sim auth` command — manage Atlassian accounts.
 *
 * Default flow uses PAT (API token) — zero setup, just email + token.
 * OAuth flow available for multi-user testing (requires registering an OAuth app).
 *
 * Usage:
 *   forge-sim auth              — add account (PAT) or select default
 *   forge-sim auth --oauth      — add account via OAuth 3LO
 *   forge-sim auth --setup      — configure OAuth app (client ID/secret)
 *   forge-sim auth --list       — list configured accounts
 *   forge-sim auth --clear      — remove all credentials
 *   forge-sim auth --remove <id> — remove a specific account
 *   forge-sim auth --local      — store credentials per-app instead of global
 */

import { loadCredentials, saveCredentials, upsertAccount, removeAccount, clearCredentials, type AtlassianAccount } from './credentials.js';
import { startOAuthFlow, setOAuthConfig, hasOAuthConfig } from './oauth.js';
import { getOAuthAppConfig, saveOAuthAppConfig, getAnthropicApiKey, saveAnthropicApiKey, clearAnthropicApiKey } from './config.js';
import { createInterface } from 'node:readline';

// ── Default Scopes (OAuth only) ─────────────────────────────────────────────

const DEFAULT_SCOPES = [
  'read:jira-work', 'write:jira-work', 'read:jira-user',
  'manage:jira-project', 'manage:jira-configuration',
  'read:confluence-content.all', 'write:confluence-content',
  'read:confluence-space.summary', 'read:confluence-user',
  'read:me', 'offline_access',
];

// ── CLI Interface ───────────────────────────────────────────────────────────

export interface AuthCommandOptions {
  list?: boolean;
  clear?: boolean;
  clearAll?: boolean;
  remove?: string;
  setup?: boolean;
  oauth?: boolean;
  local?: string;
  /** External auth: specific provider key */
  provider?: string;
  /** External auth: all providers */
  providers?: boolean;
  /** External auth: set client secret */
  secret?: boolean;
  /** LLM: configure Anthropic API key for @forge/llm */
  llm?: boolean;
  /** App directory (for manifest + local credentials) */
  appDir?: string;
  /** Manifest path override */
  manifestPath?: string;
}

export async function authCommand(options: AuthCommandOptions): Promise<void> {
  // ── External auth providers (--provider / --providers) ────────────────
  if (options.provider || options.providers) {
    const { externalAuthCommand } = await import('./external-auth-command.js');
    const appDir = options.appDir ?? options.local ?? process.cwd();
    const manifestPath = options.manifestPath ?? `${appDir}/manifest.yml`;
    await externalAuthCommand({
      provider: options.provider,
      providers: options.providers,
      list: options.list,
      secret: options.secret,
      appDir,
      manifestPath,
    });
    return;
  }

  // ── LLM / Anthropic API key (--llm) ─────────────────────────────────
  if (options.llm) {
    if (options.clear) {
      await clearAnthropicApiKey();
      console.log('  ✅ Anthropic API key removed from config.');
    } else {
      await addAnthropicKey();
    }
    return;
  }

  // Load OAuth app config if it exists
  const oauthAppConfig = await getOAuthAppConfig();
  if (oauthAppConfig) setOAuthConfig(oauthAppConfig);

  // ── List ──────────────────────────────────────────────────────────────
  if (options.list) {
    const store = await loadCredentials(options.local);
    console.log('');

    // Atlassian accounts
    if (store.accounts.length === 0) {
      console.log('  Atlassian Accounts: none');
      console.log('  Run `forge-sim auth` to add one.');
    } else {
      console.log('  Atlassian Accounts:');
      console.log('  ───────────────────');
      for (const a of store.accounts) {
        const def = a.default ? ' (default)' : '';
        const type = a.authType === 'oauth' ? '🔑 OAuth' : '🎫 PAT';
        const expired = a.authType === 'oauth' && Date.now() >= a.expiresAt ? ' ⚠️  expired' : '';
        console.log(`  ${a.id}: ${a.name} (${a.email}) @ ${a.site} [${type}]${def}${expired}`);
      }
    }

    // LLM key status
    console.log('');
    const llmKey = await getAnthropicApiKey();
    if (llmKey) {
      const source = process.env.ANTHROPIC_API_KEY ? 'env' : 'config';
      const masked = maskApiKey(llmKey);
      console.log(`  Anthropic API (LLM): ✅ ${masked} [${source}]`);
    } else {
      console.log('  Anthropic API (LLM): not configured');
      console.log('  Run `forge-sim auth --llm` to add one.');
    }

    console.log('');
    return;
  }

  // ── Clear all (credentials + OAuth app config) ─────────────────────
  if (options.clearAll) {
    await clearCredentials(options.local);
    const { saveConfig } = await import('./config.js');
    await saveConfig({});
    console.log('  ✅ All credentials and OAuth app config cleared.');
    return;
  }

  // ── Clear credentials only ────────────────────────────────────────
  if (options.clear) {
    await clearCredentials(options.local);
    console.log('  ✅ All credentials cleared (OAuth app config preserved).');
    return;
  }

  // ── Remove ────────────────────────────────────────────────────────────
  if (options.remove) {
    const store = await loadCredentials(options.local);
    const account = store.accounts.find(a => a.id === options.remove);
    if (!account) { console.error(`  ❌ Account "${options.remove}" not found.`); return; }
    removeAccount(store, options.remove);
    await saveCredentials(store, { local: options.local });
    console.log(`  ✅ Removed: ${account.name} (${account.email})`);
    return;
  }

  // ── OAuth setup ───────────────────────────────────────────────────────
  if (options.setup) {
    await setupOAuthApp();
    return;
  }

  // ── OAuth flow ────────────────────────────────────────────────────────
  if (options.oauth) {
    if (!hasOAuthConfig()) {
      await setupOAuthApp();
      if (!hasOAuthConfig()) return;
    }
    await addOAuthAccount(options.local);
    return;
  }

  // ── Default: PAT flow or account selection ────────────────────────────
  const store = await loadCredentials(options.local);

  if (store.accounts.length > 0) {
    console.log('');
    console.log('  👤 Configured accounts:');
    store.accounts.forEach((a, i) => {
      const marker = a.default ? ' ← default' : '';
      const type = a.authType === 'oauth' ? 'OAuth' : 'PAT';
      console.log(`     ${i + 1}. ${a.name} (${a.email}) @ ${a.site} [${type}]${marker}`);
    });
    console.log(`     ${store.accounts.length + 1}. Add new account (API token)...`);
    console.log(`     ${store.accounts.length + 2}. Add new account (OAuth)...`);
    console.log('');

    const choice = await prompt(`  Select [1-${store.accounts.length + 2}]: `);
    const num = parseInt(choice, 10);

    if (num >= 1 && num <= store.accounts.length) {
      store.accounts.forEach(a => { a.default = false; });
      store.accounts[num - 1].default = true;
      await saveCredentials(store, { local: options.local });
      const s = store.accounts[num - 1];
      console.log(`  ✅ Default: ${s.name} @ ${s.site}`);
      return;
    }

    if (num === store.accounts.length + 2) {
      if (!hasOAuthConfig()) { await setupOAuthApp(); if (!hasOAuthConfig()) return; }
      await addOAuthAccount(options.local);
      return;
    }
    // Fall through to PAT flow
  }

  await addPatAccount(options.local);
}

// ── PAT Flow ────────────────────────────────────────────────────────────────

async function addPatAccount(local?: string): Promise<void> {
  console.log('');
  console.log('  🎫 Add Atlassian Account (API Token)');
  console.log('  ─────────────────────────────────────');
  console.log('');
  console.log('  Create an API token at: https://id.atlassian.com/manage-profile/security/api-tokens');
  console.log('');

  const site = await prompt('  Atlassian site (e.g., mysite.atlassian.net): ');
  if (!site) { console.log('  Cancelled.'); return; }

  const email = await prompt('  Email: ');
  if (!email) { console.log('  Cancelled.'); return; }

  const apiToken = await prompt('  API Token: ');
  if (!apiToken) { console.log('  Cancelled.'); return; }

  // Validate by fetching /myself
  const siteUrl = site.includes('://') ? site : `https://${site}`;
  const siteHost = new URL(siteUrl).host;
  const basicAuth = Buffer.from(`${email}:${apiToken}`).toString('base64');

  console.log('');
  console.log('  Verifying...');

  try {
    const response = await fetch(`${siteUrl}/rest/api/3/myself`, {
      headers: { 'Authorization': `Basic ${basicAuth}`, 'Accept': 'application/json' },
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`  ❌ Authentication failed (${response.status}): ${body}`);
      return;
    }

    const user = await response.json() as { accountId: string; displayName: string; emailAddress: string };

    // Fetch cloud ID
    const tenantResponse = await fetch(`${siteUrl}/_edge/tenant_info`);
    const tenant = await tenantResponse.json() as { cloudId: string };

    const account: AtlassianAccount = {
      id: `${user.accountId.slice(0, 8)}-${Date.now().toString(36)}`,
      name: user.displayName,
      email: user.emailAddress || email,
      site: siteHost,
      cloudId: tenant.cloudId,
      accountId: user.accountId,
      authType: 'pat',
      accessToken: apiToken,
      refreshToken: '',
      expiresAt: 0, // PATs don't expire
      scopes: [],
      default: true,
    };

    const store = await loadCredentials(local);
    upsertAccount(store, account);
    await saveCredentials(store, { local });

    console.log('');
    console.log(`  ✅ Authenticated as: ${account.name} (${account.email})`);
    console.log(`     Site: ${account.site}`);
    console.log(`     Cloud ID: ${account.cloudId}`);
    console.log(`     Account ID: ${account.accountId}`);
    console.log('');
  } catch (err: any) {
    console.error(`  ❌ Connection failed: ${err.message}`);
  }
}

// ── OAuth Flow ──────────────────────────────────────────────────────────────

async function addOAuthAccount(local?: string): Promise<void> {
  console.log('');
  console.log('  🔑 Starting Atlassian OAuth flow...');
  console.log('     Opening browser for authorization...');
  console.log('');

  try {
    const result = await startOAuthFlow({ scopes: DEFAULT_SCOPES });

    // If multiple unique sites, let user pick
    if (result.resources.length > 1) {
      console.log('  📍 Multiple Atlassian sites found:');
      result.resources.forEach((r, i) => {
        console.log(`     ${i + 1}. ${r.name} (${new URL(r.url).host})`);
      });
      const choice = await prompt(`  Select site [1-${result.resources.length}]: `);
      const num = parseInt(choice, 10);
      if (num >= 1 && num <= result.resources.length) {
        const sel = result.resources[num - 1];
        result.account.site = new URL(sel.url).host;
        result.account.cloudId = sel.id;
      }
    }

    result.account.authType = 'oauth';
    const store = await loadCredentials(local);
    upsertAccount(store, result.account);
    await saveCredentials(store, { local });

    console.log('');
    console.log(`  ✅ Authorized as: ${result.account.name} (${result.account.email})`);
    console.log(`     Site: ${result.account.site}`);
    console.log(`     Cloud ID: ${result.account.cloudId}`);
    console.log('');
  } catch (err: any) {
    console.error(`  ❌ OAuth failed: ${err.message}`);
  }
}

// ── OAuth App Setup ─────────────────────────────────────────────────────────

async function setupOAuthApp(): Promise<void> {
  console.log('');
  console.log('  🔧 OAuth App Setup (one-time)');
  console.log('  ─────────────────────────────');
  console.log('');
  console.log('  1. Go to https://developer.atlassian.com/console/myapps/');
  console.log('  2. Create an OAuth 2.0 (3LO) app');
  console.log('  3. Set callback URL: http://localhost:5173/__tools/oauth/callback');
  console.log('  4. Add Jira/Confluence API permissions');
  console.log('  5. Copy Client ID and Secret from Settings');
  console.log('');

  const clientId = await prompt('  Client ID: ');
  if (!clientId) { console.log('  Cancelled.'); return; }
  const clientSecret = await prompt('  Client Secret: ');
  if (!clientSecret) { console.log('  Cancelled.'); return; }

  await saveOAuthAppConfig({ clientId, clientSecret });
  setOAuthConfig({ clientId, clientSecret });
  console.log('');
  console.log('  ✅ OAuth app saved to ~/.forge-sim/config.json');
  console.log('');
}

// ── Anthropic API Key ────────────────────────────────────────────────────────

async function addAnthropicKey(): Promise<void> {
  console.log('');
  console.log('  🤖 Anthropic API Key (for @forge/llm)');
  console.log('  ──────────────────────────────────────');
  console.log('');
  console.log('  Get your API key at: https://console.anthropic.com/settings/keys');
  console.log('');

  const apiKey = await prompt('  API Key: ');
  if (!apiKey) { console.log('  Cancelled.'); return; }

  console.log('');
  console.log('  Verifying...');

  try {
    const response = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`  ❌ Validation failed (${response.status}): ${body}`);
      return;
    }

    await saveAnthropicApiKey(apiKey);

    console.log('');
    console.log(`  ✅ Anthropic API key saved (${maskApiKey(apiKey)})`);
    console.log('     Stored in: ~/.forge-sim/config.json');
    console.log('');
  } catch (err: any) {
    console.error(`  ❌ Connection failed: ${err.message}`);
  }
}

// ── Utilities ───────────────────────────────────────────────────────────────

function maskApiKey(key: string): string {
  if (key.length <= 12) return '****';
  return key.slice(0, 7) + '...' + key.slice(-4);
}

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => { rl.close(); resolve(answer.trim()); });
  });
}
