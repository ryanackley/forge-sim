/**
 * `forge-sim auth` command — manage Atlassian accounts.
 *
 * Usage:
 *   forge-sim auth              — interactive: set up OAuth app or add account
 *   forge-sim auth --list       — list configured accounts
 *   forge-sim auth --clear      — remove all credentials
 *   forge-sim auth --local      — store credentials per-app instead of global
 *   forge-sim auth --remove <id> — remove a specific account
 *   forge-sim auth --setup      — reconfigure OAuth app (client ID/secret)
 */

import { loadCredentials, saveCredentials, upsertAccount, removeAccount, clearCredentials } from './credentials.js';
import { startOAuthFlow, setOAuthConfig, hasOAuthConfig } from './oauth.js';
import { getOAuthAppConfig, saveOAuthAppConfig } from './config.js';
import { createInterface } from 'node:readline';

// ── Default Scopes ──────────────────────────────────────────────────────────

const DEFAULT_SCOPES = [
  // Jira
  'read:jira-work',
  'write:jira-work',
  'read:jira-user',
  'manage:jira-project',
  'manage:jira-configuration',
  // Confluence
  'read:confluence-content.all',
  'write:confluence-content',
  'read:confluence-space.summary',
  'read:confluence-user',
  // User identity
  'read:me',
  // Offline access (for refresh tokens)
  'offline_access',
];

// ── CLI Interface ───────────────────────────────────────────────────────────

export interface AuthCommandOptions {
  list?: boolean;
  clear?: boolean;
  remove?: string;
  setup?: boolean;
  local?: string;  // app directory for per-app credentials
}

export async function authCommand(options: AuthCommandOptions): Promise<void> {
  // Load OAuth app config from disk or env
  const oauthAppConfig = await getOAuthAppConfig();
  if (oauthAppConfig) {
    setOAuthConfig(oauthAppConfig);
  }

  // ── List accounts ─────────────────────────────────────────────────────
  if (options.list) {
    const store = await loadCredentials(options.local);
    if (store.accounts.length === 0) {
      console.log('  No accounts configured.');
      console.log('  Run `forge-sim auth` to add one.');
      return;
    }

    console.log('');
    console.log('  Atlassian Accounts:');
    console.log('  ───────────────────');
    for (const account of store.accounts) {
      const marker = account.default ? ' (default)' : '';
      const expired = Date.now() >= account.expiresAt ? ' ⚠️  expired' : '';
      console.log(`  ${account.id}: ${account.name} (${account.email}) @ ${account.site}${marker}${expired}`);
    }
    console.log('');
    return;
  }

  // ── Clear all credentials ─────────────────────────────────────────────
  if (options.clear) {
    await clearCredentials(options.local);
    console.log('  ✅ All credentials cleared.');
    return;
  }

  // ── Remove specific account ───────────────────────────────────────────
  if (options.remove) {
    const store = await loadCredentials(options.local);
    const account = store.accounts.find(a => a.id === options.remove);
    if (!account) {
      console.error(`  ❌ Account "${options.remove}" not found.`);
      return;
    }
    removeAccount(store, options.remove);
    await saveCredentials(store, { local: options.local });
    console.log(`  ✅ Removed account: ${account.name} (${account.email})`);
    return;
  }

  // ── Setup OAuth app (first time or --setup) ───────────────────────────
  if (options.setup || !hasOAuthConfig()) {
    await setupOAuthApp();
    return;
  }

  // ── Interactive: add account or select default ────────────────────────
  const store = await loadCredentials(options.local);

  if (store.accounts.length > 0) {
    console.log('');
    console.log('  👤 Configured accounts:');
    store.accounts.forEach((a, i) => {
      const marker = a.default ? ' ← default' : '';
      console.log(`     ${i + 1}. ${a.name} (${a.email}) @ ${a.site}${marker}`);
    });
    console.log(`     ${store.accounts.length + 1}. Add new account...`);
    console.log('');

    const choice = await prompt(`  Select account [1-${store.accounts.length + 1}]: `);
    const num = parseInt(choice, 10);

    if (num >= 1 && num <= store.accounts.length) {
      // Set as default
      store.accounts.forEach(a => { a.default = false; });
      store.accounts[num - 1].default = true;
      await saveCredentials(store, { local: options.local });
      const selected = store.accounts[num - 1];
      console.log(`  ✅ Default account: ${selected.name} @ ${selected.site}`);
      return;
    }

    // Fall through to "add new account"
  }

  // ── Add new account via OAuth ─────────────────────────────────────────
  console.log('');
  console.log('  🔑 Starting Atlassian OAuth flow...');
  console.log('     Opening browser for authorization...');
  console.log('');

  try {
    const result = await startOAuthFlow({
      scopes: DEFAULT_SCOPES,
    });

    // If multiple sites, let user pick
    if (result.resources.length > 1) {
      console.log('  📍 Multiple Atlassian sites found:');
      result.resources.forEach((r, i) => {
        console.log(`     ${i + 1}. ${r.name} (${new URL(r.url).host})`);
      });
      const siteChoice = await prompt(`  Select site [1-${result.resources.length}]: `);
      const siteNum = parseInt(siteChoice, 10);
      if (siteNum >= 1 && siteNum <= result.resources.length) {
        const selectedResource = result.resources[siteNum - 1];
        result.account.site = new URL(selectedResource.url).host;
        result.account.cloudId = selectedResource.id;
      }
    }

    upsertAccount(store, result.account);
    await saveCredentials(store, { local: options.local });

    console.log('');
    console.log(`  ✅ Authorized as: ${result.account.name} (${result.account.email})`);
    console.log(`     Site: ${result.account.site}`);
    console.log(`     Cloud ID: ${result.account.cloudId}`);
    console.log(`     Account ID: ${result.account.accountId}`);
    console.log('');
  } catch (err: any) {
    console.error(`  ❌ OAuth failed: ${err.message}`);
  }
}

// ── OAuth App Setup ─────────────────────────────────────────────────────────

async function setupOAuthApp(): Promise<void> {
  console.log('');
  console.log('  🔧 OAuth App Setup');
  console.log('  ──────────────────');
  console.log('');
  console.log('  forge-sim needs an OAuth app to connect to Atlassian.');
  console.log('  You only need to do this once.');
  console.log('');
  console.log('  1. Go to https://developer.atlassian.com/console/myapps/');
  console.log('  2. Create a new app (or use an existing one)');
  console.log('  3. Go to Authorization → OAuth 2.0 (3LO) → Configure');
  console.log('  4. Set callback URL: http://localhost:5173/__tools/oauth/callback');
  console.log('  5. Go to Permissions → add Jira API (and/or Confluence API)');
  console.log('  6. Copy your Client ID and Secret from the Settings page');
  console.log('');

  const clientId = await prompt('  Client ID: ');
  if (!clientId) {
    console.log('  Cancelled.');
    return;
  }

  const clientSecret = await prompt('  Client Secret: ');
  if (!clientSecret) {
    console.log('  Cancelled.');
    return;
  }

  await saveOAuthAppConfig({ clientId, clientSecret });
  setOAuthConfig({ clientId, clientSecret });

  console.log('');
  console.log('  ✅ OAuth app saved to ~/.forge-sim/config.json');
  console.log('');

  const addNow = await prompt('  Add an Atlassian account now? (Y/n): ');
  if (addNow.toLowerCase() !== 'n') {
    await authCommand({});
  }
}

// ── Utilities ───────────────────────────────────────────────────────────────

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}
