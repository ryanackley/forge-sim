/**
 * Tests for credential store — account CRUD, token management, third-party tokens.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import {
  type CredentialStore,
  type AtlassianAccount,
  upsertAccount,
  removeAccount,
  getDefaultAccount,
  getAccount,
  tokenNeedsRefresh,
  setThirdPartyToken,
  getThirdPartyToken,
} from '../auth/credentials.js';

function makeAccount(overrides: Partial<AtlassianAccount> = {}): AtlassianAccount {
  return {
    id: 'test-1',
    name: 'Test User',
    email: 'test@example.com',
    site: 'test.atlassian.net',
    cloudId: 'cloud-123',
    accountId: 'account-456',
    accessToken: 'at-test',
    refreshToken: 'rt-test',
    expiresAt: Date.now() + 3600 * 1000,
    scopes: ['read:jira-work'],
    default: true,
    ...overrides,
  };
}

function emptyStore(): CredentialStore {
  return { accounts: [], thirdParty: {} };
}

describe('Credential Store', () => {
  describe('upsertAccount', () => {
    it('adds a new account', () => {
      const store = emptyStore();
      const account = makeAccount();
      upsertAccount(store, account);
      expect(store.accounts).toHaveLength(1);
      expect(store.accounts[0].email).toBe('test@example.com');
    });

    it('updates existing account by id', () => {
      const store = emptyStore();
      upsertAccount(store, makeAccount({ name: 'Old Name' }));
      upsertAccount(store, makeAccount({ name: 'New Name' }));
      expect(store.accounts).toHaveLength(1);
      expect(store.accounts[0].name).toBe('New Name');
    });

    it('first account becomes default', () => {
      const store = emptyStore();
      upsertAccount(store, makeAccount({ default: false }));
      expect(store.accounts[0].default).toBe(true);
    });

    it('setting new default clears old default', () => {
      const store = emptyStore();
      upsertAccount(store, makeAccount({ id: 'a', default: true }));
      upsertAccount(store, makeAccount({ id: 'b', default: true }));
      expect(store.accounts.find(a => a.id === 'a')?.default).toBe(false);
      expect(store.accounts.find(a => a.id === 'b')?.default).toBe(true);
    });
  });

  describe('removeAccount', () => {
    it('removes account by id', () => {
      const store = emptyStore();
      upsertAccount(store, makeAccount({ id: 'a' }));
      upsertAccount(store, makeAccount({ id: 'b', default: false }));
      removeAccount(store, 'a');
      expect(store.accounts).toHaveLength(1);
      expect(store.accounts[0].id).toBe('b');
    });

    it('promotes next account to default when default is removed', () => {
      const store = emptyStore();
      upsertAccount(store, makeAccount({ id: 'a', default: true }));
      upsertAccount(store, makeAccount({ id: 'b', default: false }));
      removeAccount(store, 'a');
      expect(store.accounts[0].default).toBe(true);
    });

    it('cleans up third-party tokens on remove', () => {
      const store = emptyStore();
      upsertAccount(store, makeAccount({ id: 'a' }));
      setThirdPartyToken(store, 'a', 'github', {
        provider: 'github',
        accessToken: 'gho_test',
      });
      expect(store.thirdParty['a']).toBeDefined();
      removeAccount(store, 'a');
      expect(store.thirdParty['a']).toBeUndefined();
    });
  });

  describe('getDefaultAccount', () => {
    it('returns the default account', () => {
      const store = emptyStore();
      upsertAccount(store, makeAccount({ id: 'a', default: false }));
      upsertAccount(store, makeAccount({ id: 'b', default: true }));
      expect(getDefaultAccount(store)?.id).toBe('b');
    });

    it('returns first account if none marked default', () => {
      const store: CredentialStore = {
        accounts: [
          makeAccount({ id: 'a', default: false }),
          makeAccount({ id: 'b', default: false }),
        ],
        thirdParty: {},
      };
      expect(getDefaultAccount(store)?.id).toBe('a');
    });

    it('returns undefined for empty store', () => {
      expect(getDefaultAccount(emptyStore())).toBeUndefined();
    });
  });

  describe('tokenNeedsRefresh', () => {
    it('returns false for valid token', () => {
      const account = makeAccount({ expiresAt: Date.now() + 60 * 60 * 1000 });
      expect(tokenNeedsRefresh(account)).toBe(false);
    });

    it('returns true for expired token', () => {
      const account = makeAccount({ expiresAt: Date.now() - 1000 });
      expect(tokenNeedsRefresh(account)).toBe(true);
    });

    it('returns true for token expiring within 5 minutes', () => {
      const account = makeAccount({ expiresAt: Date.now() + 2 * 60 * 1000 });
      expect(tokenNeedsRefresh(account)).toBe(true);
    });
  });

  describe('third-party tokens', () => {
    it('stores and retrieves third-party tokens', () => {
      const store = emptyStore();
      setThirdPartyToken(store, 'user-1', 'github', {
        provider: 'github',
        accessToken: 'gho_abc',
        refreshToken: 'ghr_def',
      });

      const token = getThirdPartyToken(store, 'user-1', 'github');
      expect(token?.accessToken).toBe('gho_abc');
      expect(token?.refreshToken).toBe('ghr_def');
    });

    it('returns undefined for missing token', () => {
      const store = emptyStore();
      expect(getThirdPartyToken(store, 'user-1', 'github')).toBeUndefined();
    });

    it('supports multiple providers per account', () => {
      const store = emptyStore();
      setThirdPartyToken(store, 'user-1', 'github', { provider: 'github', accessToken: 'gh' });
      setThirdPartyToken(store, 'user-1', 'slack', { provider: 'slack', accessToken: 'sl' });
      expect(getThirdPartyToken(store, 'user-1', 'github')?.accessToken).toBe('gh');
      expect(getThirdPartyToken(store, 'user-1', 'slack')?.accessToken).toBe('sl');
    });
  });
});
