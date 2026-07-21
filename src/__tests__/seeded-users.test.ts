/**
 * Seeded-user roster — shape + lookup guarantees.
 *
 * The roster is the always-offline "Acting as" story for the dev-server gear
 * menu. It's a public surface (re-exported from the package index) so tests and
 * agents pull the canonical people instead of hand-rolling a fake team that
 * drifts. These assertions pin the invariants the dev server and renderer rely
 * on: stable ids, exactly one default, and the default reusing the startup id.
 */
import { describe, it, expect } from 'vitest';
import {
  getSeededUsers,
  getSeededUserByAccountId,
  getDefaultSeededUser,
  DEFAULT_SEEDED_ACCOUNT_ID,
} from '../seeded-users.js';

describe('seeded-users roster', () => {
  it('returns a believable small team (5 people)', () => {
    const users = getSeededUsers();
    expect(users).toHaveLength(5);
    for (const u of users) {
      expect(typeof u.accountId).toBe('string');
      expect(u.accountId).toBeTruthy();
      expect(typeof u.displayName).toBe('string');
      expect(u.displayName).toBeTruthy();
      // Every user carries a complete /myself identity (accountId + name + email).
      expect(u.emailAddress).toMatch(/@/);
      expect(['Lead', 'Engineer', 'Designer', 'PM']).toContain(u.role);
    }
  });

  it('has unique accountIds', () => {
    const ids = getSeededUsers().map((u) => u.accountId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('marks exactly one user as the default', () => {
    const defaults = getSeededUsers().filter((u) => u.isDefault);
    expect(defaults).toHaveLength(1);
  });

  it('default user reuses the startup accountId', () => {
    const def = getSeededUsers().find((u) => u.isDefault);
    expect(def?.accountId).toBe(DEFAULT_SEEDED_ACCOUNT_ID);
    // getDefaultSeededUser() agrees with the isDefault flag.
    expect(getDefaultSeededUser().accountId).toBe(DEFAULT_SEEDED_ACCOUNT_ID);
  });

  it('looks up a known user by accountId', () => {
    const diego = getSeededUserByAccountId('sim-user-003');
    expect(diego?.displayName).toBe('Diego Santos');
    expect(diego?.emailAddress).toBe('diego@example.com');
  });

  it('returns undefined for an unknown accountId', () => {
    expect(getSeededUserByAccountId('not-a-real-id')).toBeUndefined();
  });

  it('hands out fresh copies callers cannot use to mutate the source', () => {
    const first = getSeededUsers();
    first[0].displayName = 'MUTATED';
    const second = getSeededUsers();
    expect(second[0].displayName).not.toBe('MUTATED');

    const lookup = getSeededUserByAccountId(DEFAULT_SEEDED_ACCOUNT_ID)!;
    lookup.displayName = 'MUTATED';
    expect(getSeededUserByAccountId(DEFAULT_SEEDED_ACCOUNT_ID)!.displayName).not.toBe('MUTATED');
  });
});
