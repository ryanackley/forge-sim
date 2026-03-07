/**
 * Credential store for forge-sim.
 *
 * Stores OAuth tokens per-account in ~/.forge-sim/credentials.json.
 * Supports multiple accounts (different users/sites) and 3rd party OAuth tokens.
 *
 * Token refresh is handled transparently — callers just call getAccessToken()
 * and get a valid token back.
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
  /** OAuth access token */
  accessToken: string;
  /** OAuth refresh token */
  refreshToken: string;
  /** Token expiry (Unix ms) */
  expiresAt: number;
  /** Granted OAuth scopes */
  scopes: string[];
  /** Is this the default account? */
  default?: boolean;
}

export interface ThirdPartyToken {
  provider: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
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
 * Check if a token needs refresh (expired or expiring within 5 minutes).
 */
export function tokenNeedsRefresh(account: AtlassianAccount): boolean {
  const BUFFER_MS = 5 * 60 * 1000; // 5 minutes
  return Date.now() >= account.expiresAt - BUFFER_MS;
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
