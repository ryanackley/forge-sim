/**
 * Seeded fake users for the dev-server "Acting as" switcher.
 *
 * forge-sim already supports user impersonation on two of its three driver
 * surfaces (in-process `sim.resolver.setContext({ accountId })` and the MCP
 * per-invoke `{ context: { accountId } }` override). The browser dev server
 * had no live switcher — every render ran as the single startup accountId.
 *
 * This roster is the always-offline story: a fixed set of believable people
 * you can flip between from the ⚙️ gear menu without a connected site. The
 * first entry reuses the default accountId so "no switch" needs zero special
 * casing.
 *
 * Public surface (re-exported from the package index) for the same reason the
 * trigger-event templates are: tests and agents should pull the canonical
 * roster instead of hand-rolling a fake one that drifts from the dev server.
 *
 * Parity note: only `accountId` ever reaches a resolver `context` (the real
 * Forge shape). The rich fields (displayName, emailAddress, role) are gear-menu
 * chrome AND feed the `/rest/api/3/myself` product-API fallback so the two
 * "who am I" surfaces an app can read stay consistent after a switch.
 */

export type SeededUserRole = 'Lead' | 'Engineer' | 'Designer' | 'PM';

/**
 * The minimal "who am I" shape the switcher works with. Both a seeded fake
 * user (offline) and a real user picked off a connected site populate this.
 * Only `accountId` ever reaches a resolver context (real Forge shape); the
 * rest feeds the current-user REST fallback and the gear-menu chrome.
 *
 * `emailAddress`/`avatarUrl` are optional because a real `/user/picker` hit
 * returns a display name + avatar URL but not always an email, and forge-sim
 * never invents one for a real person.
 */
export interface ActingUser {
  /** The only field that reaches a resolver context (real Forge shape). */
  accountId: string;
  displayName: string;
  emailAddress?: string;
  avatarUrl?: string;
}

export interface SeededUser extends ActingUser {
  /** Seeded fakes always have a believable email. */
  emailAddress: string;
  role: SeededUserRole;
  /** Exactly one roster entry is the default; it reuses the startup accountId. */
  isDefault?: boolean;
}

/** The startup accountId the simulator already uses when nothing is set. */
export const DEFAULT_SEEDED_ACCOUNT_ID = 'sim-user-001';

/**
 * A small, believable dev team (~5 people). Deliberately mixed roles so
 * per-user app behavior (assignee views, "you voted", permission-gated UI)
 * has something to differentiate. Avatars come free from Atlaskit
 * `<Avatar name={displayName} />` (initials + deterministic color).
 */
const SEEDED_USERS: readonly SeededUser[] = [
  {
    accountId: DEFAULT_SEEDED_ACCOUNT_ID,
    displayName: 'Ryan Ackley',
    emailAddress: 'ryan@example.com',
    role: 'Lead',
    isDefault: true,
  },
  {
    accountId: 'sim-user-002',
    displayName: 'Nyx Sable',
    emailAddress: 'nyx@example.com',
    role: 'Engineer',
  },
  {
    accountId: 'sim-user-003',
    displayName: 'Diego Santos',
    emailAddress: 'diego@example.com',
    role: 'Engineer',
  },
  {
    accountId: 'sim-user-004',
    displayName: 'Priya Nair',
    emailAddress: 'priya@example.com',
    role: 'Designer',
  },
  {
    accountId: 'sim-user-005',
    displayName: 'Sam Whitfield',
    emailAddress: 'sam@example.com',
    role: 'PM',
  },
];

/** The roster, as a fresh array (callers can't mutate the source). */
export function getSeededUsers(): SeededUser[] {
  return SEEDED_USERS.map((u) => ({ ...u }));
}

/** Look up a seeded user by accountId, or `undefined` if not in the roster. */
export function getSeededUserByAccountId(accountId: string): SeededUser | undefined {
  const found = SEEDED_USERS.find((u) => u.accountId === accountId);
  return found ? { ...found } : undefined;
}

/** The default seeded user (the lead). Always present. */
export function getDefaultSeededUser(): SeededUser {
  return { ...(SEEDED_USERS.find((u) => u.isDefault) ?? SEEDED_USERS[0]) };
}
