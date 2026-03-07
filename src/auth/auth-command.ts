/**
 * `forge-sim auth` command — manage Atlassian accounts.
 *
 * Usage:
 *   forge-sim auth              — interactive: add account or select default
 *   forge-sim auth --list       — list configured accounts
 *   forge-sim auth --clear      — remove all credentials
 *   forge-sim auth --local      — store credentials per-app instead of global
 *   forge-sim auth --remove <id> — remove a specific account
 */

import { loadCredentials, saveCredentials, upsertAccount, removeAccount, getDefaultAccount, clearCredentials } from './credentials.js';
import { startOAuthFlow, setOAuthClientId, hasOAuthConfig, type AccessibleResource } from './oauth.js';
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
  local?: string;  // app directory for per-app credentials
}

export async function authCommand(options: AuthCommandOptions): Promise<void> {
  // Load OAuth client ID from environment or config
  // (no client_secret needed — we use PKCE)
  const clientId = process.env.FORGE_SIM_OAUTH_CLIENT_ID || '';
  if (clientId) {
    setOAuthClientId(clientId);
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
  if (!hasOAuthConfig()) {
    console.log('');
    console.log('  ⚠️  OAuth client ID not configured.');
    console.log('');
    console.log('  Set the environment variable:');
    console.log('    FORGE_SIM_OAUTH_CLIENT_ID=<your-client-id>');
    console.log('');
    console.log('  Or create an OAuth app at https://developer.atlassian.com');
    console.log('  with callback URL: http://localhost:5173/__tools/oauth/callback');
    console.log('  (No client_secret needed — forge-sim uses PKCE)');
    return;
  }

  console.log('');
  console.log('  🔑 Starting Atlassian OAuth flow...');
  console.log('     Opening browser for authorization...');
  console.log('');

  try {
    const result = await startOAuthFlow({
      scopes: DEFAULT_SCOPES,
    });

    // If multiple sites, let user pick
    let selectedResource = result.resources[0];
    if (result.resources.length > 1) {
      console.log('  📍 Multiple Atlassian sites found:');
      result.resources.forEach((r, i) => {
        console.log(`     ${i + 1}. ${r.name} (${new URL(r.url).host})`);
      });
      const siteChoice = await prompt(`  Select site [1-${result.resources.length}]: `);
      const siteNum = parseInt(siteChoice, 10);
      if (siteNum >= 1 && siteNum <= result.resources.length) {
        selectedResource = result.resources[siteNum - 1];
        // Update account with selected site
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
