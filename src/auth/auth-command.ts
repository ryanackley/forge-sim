/**
 * `forge-sim auth` command — manage Atlassian accounts (PAT only).
 *
 * Usage:
 *   forge-sim auth              — add account (PAT) or select default
 *   forge-sim auth --list       — list configured accounts
 *   forge-sim auth --clear      — remove all credentials
 *   forge-sim auth --clear-all  — credentials AND service config (e.g. Anthropic key)
 *   forge-sim auth --remove <id> — remove a specific account
 *   forge-sim auth --local      — store credentials per-app instead of global
 *   forge-sim auth --llm        — configure Anthropic API key for @forge/llm
 *   forge-sim auth --provider <key>  — manage external OAuth providers
 *   forge-sim auth --providers       — same, for every manifest provider
 *
 * Atlassian OAuth was removed (PAT setup is 30s vs ~5min for OAuth app
 * registration, multi-user testing is solved by multiple PATs, and the
 * simulator doesn't enforce OAuth scopes anyway).
 */

import {
  loadCredentials, saveCredentials, upsertAccount, removeAccount,
  clearCredentials, dropOAuthAccounts, type AtlassianAccount,
} from './credentials.js';
import {
  getAnthropicApiKey, saveAnthropicApiKey, clearAnthropicApiKey,
  dropOAuthAppConfig,
} from './config.js';
import { createInterface } from 'node:readline';

// ── CLI Interface ───────────────────────────────────────────────────────────

export interface AuthCommandOptions {
  list?: boolean;
  clear?: boolean;
  clearAll?: boolean;
  remove?: string;
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

/**
 * One-shot migration that fires on every `forge-sim auth` invocation.
 * Cleans up legacy OAuth-typed accounts and the now-defunct OAuth app
 * config from ~/.forge-sim/config.json. Idempotent.
 */
async function runOAuthRemovalMigration(local?: string): Promise<void> {
  // Strip OAuth-typed accounts from credentials.json (both local + global).
  const store = await loadCredentials(local);
  const dropped = dropOAuthAccounts(store);
  if (dropped.length) {
    await saveCredentials(store, { local });
    console.warn(
      `  ⚠ Atlassian OAuth was removed in this release. Dropped ${dropped.length} OAuth ` +
      `account${dropped.length > 1 ? 's' : ''} — re-add with \`forge-sim auth\` (PAT, much faster setup).`,
    );
  }
  // Strip the dev's OAuth-app registration from config.json, if present.
  if (await dropOAuthAppConfig()) {
    console.warn(`  ⚠ Removed legacy OAuth app config from ~/.forge-sim/config.json.`);
  }
}

export async function authCommand(options: AuthCommandOptions): Promise<void> {
  await runOAuthRemovalMigration(options.local);

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
        console.log(`  ${a.id}: ${a.name} (${a.email}) @ ${a.site} [🎫 PAT]${def}`);
      }
    }

    // LLM key status
    console.log('');
    const llmKey = await getAnthropicApiKey();
    if (llmKey) {
      const source = process.env.ANTHROPIC_API_KEY?.trim() ? 'env' : 'config';
      const masked = maskApiKey(llmKey);
      console.log(`  Anthropic API (LLM): ✅ ${masked} [${source}]`);
    } else {
      console.log('  Anthropic API (LLM): not configured');
      console.log('  Run `forge-sim auth --llm` to add one.');
    }

    console.log('');
    return;
  }

  // ── Clear all (credentials + service config) ──────────────────────────
  if (options.clearAll) {
    await clearCredentials(options.local);
    const { saveConfig } = await import('./config.js');
    await saveConfig({});
    console.log('  ✅ All credentials and service config cleared.');
    return;
  }

  // ── Clear credentials only ────────────────────────────────────────
  if (options.clear) {
    await clearCredentials(options.local);
    console.log('  ✅ All credentials cleared (service config preserved).');
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

  // ── Default: PAT flow or account selection ────────────────────────────
  const store = await loadCredentials(options.local);

  if (store.accounts.length > 0) {
    console.log('');
    console.log('  👤 Configured accounts:');
    store.accounts.forEach((a, i) => {
      const marker = a.default ? ' ← default' : '';
      console.log(`     ${i + 1}. ${a.name} (${a.email}) @ ${a.site}${marker}`);
    });
    console.log(`     ${store.accounts.length + 1}. Add new account (API token)...`);
    console.log('');

    const choice = await prompt(`  Select [1-${store.accounts.length + 1}]: `);
    const num = parseInt(choice, 10);

    if (num >= 1 && num <= store.accounts.length) {
      store.accounts.forEach(a => { a.default = false; });
      store.accounts[num - 1].default = true;
      await saveCredentials(store, { local: options.local });
      const s = store.accounts[num - 1];
      console.log(`  ✅ Default: ${s.name} @ ${s.site}`);
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
