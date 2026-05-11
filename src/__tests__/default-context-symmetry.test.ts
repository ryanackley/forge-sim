/**
 * Tests for N3: the default Forge context (accountId/cloudId/siteUrl) must
 * be the same across all invocation paths.
 *
 * Before the fix:
 *   - Cold `sim.invoke(...)` / MCP `forge_invoke` used a hard-coded
 *     `accountId: sim-user-001` regardless of whether an Atlassian account
 *     was connected.
 *   - UI render → bridge.invoke (post-render path) used
 *     `productApi.connectedAccount.accountId` — the real ARI.
 *
 * Tests that mixed surfaces wrote to KVS under two different accountIds.
 * Silent footgun. Found by the third skill-chain integration test.
 *
 * After the fix:
 *   - All paths consult `sim.getDefaultContext()`, which reads the connected
 *     account if any and otherwise returns the sim-* placeholders.
 *   - Resolver, simulator.buildContext, and dev-command's daemon fallback
 *     all use the same source.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ForgeSimulator } from '../simulator.js';
import type { AtlassianAccount } from '../auth/credentials.js';

function fakeAccount(overrides: Partial<AtlassianAccount> = {}): AtlassianAccount {
  return {
    id: 'ryan-1',
    name: 'Ryan',
    email: 'ryan@example.com',
    site: 'ryan.atlassian.net',
    cloudId: 'cloud-abc-123',
    accountId: '557058:fake-account-id',
    authType: 'pat',
    accessToken: 'fake-token',
    refreshToken: '',
    expiresAt: 0,
    scopes: [],
    ...overrides,
  } as AtlassianAccount;
}

describe('N3: getDefaultContext — no connected account', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    sim = new ForgeSimulator();
  });

  afterEach(async () => {
    await sim.reset();
    await sim.stop();
  });

  it('returns the sim-* placeholders when no account is connected', () => {
    const ctx = sim.getDefaultContext();
    expect(ctx.accountId).toBe('sim-user-001');
    expect(ctx.cloudId).toBe('sim-cloud-001');
    expect(ctx.siteUrl).toBe('https://sim-site.atlassian.net');
  });

  it('cold resolver.invoke sees the sim-* placeholders', async () => {
    let seenContext: any;
    sim.resolver.define('echo', (req) => {
      seenContext = req.context;
      return { ok: true };
    });

    await sim.resolver.invoke('echo');

    expect(seenContext.accountId).toBe('sim-user-001');
    expect(seenContext.cloudId).toBe('sim-cloud-001');
  });
});

describe('N3: getDefaultContext — with connected account', () => {
  let sim: ForgeSimulator;
  const account = fakeAccount({
    accountId: '557058:b9b088eb-4493-adf0-933bf4d529e2',
    cloudId: 'real-cloud-uuid',
    site: 'real.atlassian.net',
  });

  beforeEach(() => {
    sim = new ForgeSimulator();
    sim.productApi.connectRealApis(account);
  });

  afterEach(async () => {
    await sim.reset();
    await sim.stop();
  });

  it('getDefaultContext returns the connected account info', () => {
    const ctx = sim.getDefaultContext();
    expect(ctx.accountId).toBe('557058:b9b088eb-4493-adf0-933bf4d529e2');
    expect(ctx.cloudId).toBe('real-cloud-uuid');
    expect(ctx.siteUrl).toBe('https://real.atlassian.net');
  });

  it('cold resolver.invoke sees the connected account accountId (the headline fix)', async () => {
    // This is the bug. Pre-fix, this test would see `sim-user-001` instead
    // of the real accountId, even though the same simulator's UI render
    // path was correctly seeing the real accountId.
    let seenContext: any;
    sim.resolver.define('echo', (req) => {
      seenContext = req.context;
      return { ok: true };
    });

    await sim.resolver.invoke('echo');

    expect(seenContext.accountId).toBe('557058:b9b088eb-4493-adf0-933bf4d529e2');
    expect(seenContext.cloudId).toBe('real-cloud-uuid');
    expect(seenContext.siteUrl).toBe('https://real.atlassian.net');
  });

  it('installContext reflects the connected cloudId', () => {
    expect(sim.getDefaultContext().installContext).toBe(
      'ari:cloud:jira::site/real-cloud-uuid',
    );
  });
});

describe('N3: getDefaultContext — symmetry across paths', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    sim = new ForgeSimulator();
  });

  afterEach(async () => {
    await sim.reset();
    await sim.stop();
  });

  it('resolver.invoke and getDefaultContext agree (no account)', async () => {
    let seenAccountId: string | undefined;
    sim.resolver.define('echo', (req) => {
      seenAccountId = req.context.accountId;
      return {};
    });

    await sim.resolver.invoke('echo');
    expect(seenAccountId).toBe(sim.getDefaultContext().accountId);
  });

  it('resolver.invoke and getDefaultContext agree (account connected)', async () => {
    sim.productApi.connectRealApis(fakeAccount());
    let seenAccountId: string | undefined;
    sim.resolver.define('echo', (req) => {
      seenAccountId = req.context.accountId;
      return {};
    });

    await sim.resolver.invoke('echo');
    expect(seenAccountId).toBe(sim.getDefaultContext().accountId);
    expect(seenAccountId).toBe('557058:fake-account-id');
  });

  it('connecting an account mid-session is reflected in the next resolver.invoke', async () => {
    let seenAccountId: string | undefined;
    sim.resolver.define('echo', (req) => {
      seenAccountId = req.context.accountId;
      return {};
    });

    // Before connect — sim-user-001
    await sim.resolver.invoke('echo');
    expect(seenAccountId).toBe('sim-user-001');

    // Connect
    sim.productApi.connectRealApis(fakeAccount({ accountId: 'connected-1' }));

    // After connect — real ARI on the SAME resolver instance
    await sim.resolver.invoke('echo');
    expect(seenAccountId).toBe('connected-1');

    // Disconnect
    sim.productApi.disconnectRealApis();

    // After disconnect — back to placeholder
    await sim.resolver.invoke('echo');
    expect(seenAccountId).toBe('sim-user-001');
  });

  it('explicit resolver.setContext() overrides still take precedence over connected account', async () => {
    // The override mechanism is the existing escape hatch for tests that
    // want a specific accountId regardless of connection state. The N3 fix
    // changes the BASE default, not the override behavior.
    sim.productApi.connectRealApis(fakeAccount({ accountId: 'real-id' }));
    sim.resolver.setContext({ accountId: 'override-id' });

    let seenAccountId: string | undefined;
    sim.resolver.define('echo', (req) => {
      seenAccountId = req.context.accountId;
      return {};
    });

    await sim.resolver.invoke('echo');
    expect(seenAccountId).toBe('override-id');
  });
});

describe('N3: standalone SimulatedResolver (no simulator) still works', () => {
  // Backward compat — the resolver class can be used directly (not via
  // ForgeSimulator). In that case it falls back to the original hard-coded
  // sim-* defaults. This protects users who built tests against the
  // resolver class directly before forge-sim shipped.
  it('uses the built-in sim-* defaults when no provider is supplied', async () => {
    const { SimulatedResolver } = await import('../resolver.js');
    const resolver = new SimulatedResolver();

    let seenContext: any;
    resolver.define('echo', (req) => {
      seenContext = req.context;
      return {};
    });

    await resolver.invoke('echo');
    expect(seenContext.accountId).toBe('sim-user-001');
    expect(seenContext.cloudId).toBe('sim-cloud-001');
  });
});
