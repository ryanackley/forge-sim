/**
 * Credential store for forge-sim.
 *
 * Stores PAT (API token) accounts in ~/.forge-sim/credentials.json plus
 * third-party OAuth tokens for external auth providers.
 *
 * Atlassian OAuth was removed in favor of PAT-only — PATs are 30-second
 * setup and don't expire, OAuth was an unnecessary 5-minute developer-app
 * registration dance with no functional gain in a simulator. Existing
 * OAuth-typed accounts are dropped at load time via dropOAuthAccounts().
 */

import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

// ── Types ───────────────────────────────────────────────────────────────────

export interface AtlassianAccount {
  /** Unique local ID (e.g., "ryan-1") */
  id: string;
  /** Display name */
  name: string;
  /** Email address */
  email: string;
  /** Atlassian site (e.g., "mysite.atlassian.net") */
  site: string;
  /** Atlassian Cloud ID */
  cloudId: string;
  /** Account ID from Atlassian (for context.accountId) */
  accountId: string;
  /**
   * Auth type — only 'pat' is supported now. Field retained so that older
   * credentials.json files still parse, and so the productApi auth header
   * builder has an explicit branch.
   */
  authType: 'pat';
  /** PAT API token (used as the password in HTTP Basic auth). */
  accessToken: string;
  /** Unused for PAT — kept to preserve the JSON shape on disk. */
  refreshToken: string;
  /** Unused for PAT (PATs don't expire) — kept for JSON-shape compatibility. */
  expiresAt: number;
  /** Unused for PAT — kept for JSON-shape compatibility. */
  scopes: string[];
  /** Is this the default account? */
  default?: boolean;
}

export interface ExternalAuthAccount {
  id: string;
  displayName: string;
  avatarUrl?: string;
  scopes: string[];
}

export interface ThirdPartyToken {
  provider: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scopes?: string[];
  account?: ExternalAuthAccount;
}

export interface CredentialStore {
  accounts: AtlassianAccount[];
  /** Third-party OAuth tokens keyed by account ID, then provider */
  thirdParty: Record<string, Record<string, ThirdPartyToken>>;
}

// ── Paths ───────────────────────────────────────────────────────────────────

const GLOBAL_DIR = join(homedir(), '.forge-sim');
const GLOBAL_CREDS = join(GLOBAL_DIR, 'credentials.json');

function localCredsPath(appDir: string): string {
  return join(appDir, '.forge-sim', 'credentials.json');
}

// ── CRUD ────────────────────────────────────────────────────────────────────

/**
 * Load credentials from disk. Checks local (app-level) first, then global.
 */
export async function loadCredentials(appDir?: string): Promise<CredentialStore> {
  const empty: CredentialStore = { accounts: [], thirdParty: {} };

  // Try local first
  if (appDir) {
    const local = localCredsPath(appDir);
    if (existsSync(local)) {
      try {
        return JSON.parse(await readFile(local, 'utf-8'));
      } catch {
        return empty;
      }
    }
  }

  // Fall back to global
  if (existsSync(GLOBAL_CREDS)) {
    try {
      return JSON.parse(await readFile(GLOBAL_CREDS, 'utf-8'));
    } catch {
      return empty;
    }
  }

  return empty;
}

/**
 * Save credentials to disk (global by default, local if specified).
 */
export async function saveCredentials(
  store: CredentialStore,
  options?: { local?: string }
): Promise<void> {
  const dir = options?.local ? join(options.local, '.forge-sim') : GLOBAL_DIR;
  const file = options?.local ? localCredsPath(options.local) : GLOBAL_CREDS;

  await mkdir(dir, { recursive: true });
  await writeFile(file, JSON.stringify(store, null, 2), { mode: 0o600 });
}

/**
 * Add or update an account.
 */
export function upsertAccount(store: CredentialStore, account: AtlassianAccount): CredentialStore {
  const existing = store.accounts.findIndex(a => a.id === account.id);
  if (existing >= 0) {
    store.accounts[existing] = account;
  } else {
    store.accounts.push(account);
  }

  // If this is the only account or marked default, ensure it's the default
  if (account.default || store.accounts.length === 1) {
    store.accounts.forEach(a => { a.default = a.id === account.id; });
  }

  return store;
}

/**
 * Remove an account by ID.
 */
export function removeAccount(store: CredentialStore, accountId: string): CredentialStore {
  store.accounts = store.accounts.filter(a => a.id !== accountId);
  delete store.thirdParty[accountId];

  // If we removed the default, make the first remaining account default
  if (store.accounts.length > 0 && !store.accounts.some(a => a.default)) {
    store.accounts[0].default = true;
  }

  return store;
}

/**
 * Get the default account.
 */
export function getDefaultAccount(store: CredentialStore): AtlassianAccount | undefined {
  return store.accounts.find(a => a.default) ?? store.accounts[0];
}

/**
 * Get account by ID.
 */
export function getAccount(store: CredentialStore, id: string): AtlassianAccount | undefined {
  return store.accounts.find(a => a.id === id);
}

/**
 * Check if a token needs refresh. Always false for PAT — PATs never expire.
 * Retained for callers that still invoke this; the result is a constant now.
 */
export function tokenNeedsRefresh(_account: AtlassianAccount): boolean {
  return false;
}

/**
 * Migration helper — strip any legacy OAuth-typed accounts and return the
 * list of dropped account IDs. The CredentialStore is mutated in place.
 *
 * Existing forge-sim users had OAuth accounts from the pre-PAT-only era
 * (a deprecated path even then); this lets the CLI surface a clear
 * "re-add as PAT" message instead of crashing on the now-narrowed type.
 */
export function dropOAuthAccounts(store: CredentialStore): string[] {
  const dropped: string[] = [];
  store.accounts = store.accounts.filter((a) => {
    if ((a as any).authType === 'oauth') {
      dropped.push(a.id);
      delete store.thirdParty[a.id];
      return false;
    }
    return true;
  });
  return dropped;
}

/**
 * Store a third-party OAuth token for an account.
 */
export function setThirdPartyToken(
  store: CredentialStore,
  accountId: string,
  provider: string,
  token: ThirdPartyToken,
): CredentialStore {
  if (!store.thirdParty[accountId]) {
    store.thirdParty[accountId] = {};
  }
  store.thirdParty[accountId][provider] = token;
  return store;
}

/**
 * Get a third-party OAuth token for an account.
 */
export function getThirdPartyToken(
  store: CredentialStore,
  accountId: string,
  provider: string,
): ThirdPartyToken | undefined {
  return store.thirdParty[accountId]?.[provider];
}

/**
 * Clear all credentials (for `forge-sim auth --clear`).
 */
export async function clearCredentials(appDir?: string): Promise<void> {
  const empty: CredentialStore = { accounts: [], thirdParty: {} };
  await saveCredentials(empty);
  if (appDir) {
    const local = localCredsPath(appDir);
    if (existsSync(local)) {
      await saveCredentials(empty, { local: appDir });
    }
  }
}
