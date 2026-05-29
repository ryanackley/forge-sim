/**
 * sim.invoke({ moduleKey, context }) — options-object third arg.
 *
 * Two consecutive black-box skill runs (#7 and #10) reached for the shape
 * `sim.invoke('fn', payload, { accountId: 'x' })` to vary the resolver's
 * `req.context.accountId` between calls. The old signature `(fn, payload, moduleKey?)`
 * coerced the object to a string and emitted "Unknown module '[object Object]'",
 * which wastes minutes of head-scratching.
 *
 * New shape (pre-release, no back-compat baggage):
 *   sim.invoke(functionKey, payload?, options?: InvokeOptions)
 *
 * Where InvokeOptions = { moduleKey?: string; context?: Partial<ResolverContext> }.
 *
 * `context` is a one-shot per-call override — merged onto sim's base + sticky
 * context for THIS invocation only. The sticky `setContext()` state is
 * untouched.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSimulator, type ForgeSimulator } from '../simulator.js';

describe('sim.invoke options object — per-call context override', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    sim = createSimulator();
    sim.resolver.define('whoami', async (req: any) => ({
      accountId: req.context.accountId,
      cloudId: req.context.cloudId,
      extension: req.context.extension,
    }));
  });

  afterEach(async () => {
    await sim.stop();
  });

  it('per-call context.accountId overrides the default', async () => {
    const result = await sim.invoke('whoami', {}, { context: { accountId: 'alice' } });
    expect(result.accountId).toBe('alice');
  });

  it('per-call override does not mutate sticky state', async () => {
    sim.resolver.setContext({ accountId: 'sticky-bob' });

    // One-shot override
    const first = await sim.invoke('whoami', {}, { context: { accountId: 'one-shot-alice' } });
    expect(first.accountId).toBe('one-shot-alice');

    // Next call with no override falls back to the sticky value, NOT to alice
    const second = await sim.invoke('whoami', {});
    expect(second.accountId).toBe('sticky-bob');
  });

  it('per-call override merges with sticky context (not replace)', async () => {
    sim.resolver.setContext({ accountId: 'sticky-bob', cloudId: 'sticky-cloud' });

    // Only override accountId — cloudId should still be the sticky value
    const result = await sim.invoke('whoami', {}, { context: { accountId: 'alice' } });
    expect(result.accountId).toBe('alice');
    expect(result.cloudId).toBe('sticky-cloud');
  });

  it('per-call override supports nested extension fields', async () => {
    const result = await sim.invoke('whoami', {}, {
      context: { extension: { issueKey: 'PROJ-1', spaceKey: 'TEAM' } },
    });
    expect(result.extension).toEqual({ issueKey: 'PROJ-1', spaceKey: 'TEAM' });
  });

  it('two adjacent calls with different accountIds (the run-7/run-10 use case)', async () => {
    const counts: Record<string, number> = {};
    sim.resolver.define('vote', async (req: any) => {
      const user = req.context.accountId;
      counts[user] = (counts[user] ?? 0) + 1;
      return { user };
    });

    await sim.invoke('vote', {}, { context: { accountId: 'alice' } });
    await sim.invoke('vote', {}, { context: { accountId: 'bob' } });
    await sim.invoke('vote', {}, { context: { accountId: 'alice' } });

    expect(counts).toEqual({ alice: 2, bob: 1 });
  });

  it('omitted options falls back to base/sticky context', async () => {
    sim.resolver.setContext({ accountId: 'sticky-user' });
    const result = await sim.invoke('whoami', {});
    expect(result.accountId).toBe('sticky-user');
  });
});

describe('sim.invoke options object — bad shapes throw with hints', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    sim = createSimulator();
    sim.resolver.define('noop', async () => ({ ok: true }));
  });

  afterEach(async () => {
    await sim.stop();
  });

  it('throws TypeError when options is a string', async () => {
    await expect(
      // @ts-expect-error — legacy third-arg-as-string shape, no longer supported
      sim.invoke('noop', {}, 'some-module')
    ).rejects.toThrow(/InvokeOptions object.*\{ moduleKey: "some-module" \}/);
  });

  it('throws TypeError when options is a number', async () => {
    await expect(
      // @ts-expect-error
      sim.invoke('noop', {}, 42)
    ).rejects.toThrow(/InvokeOptions object.*Got: number/);
  });

  it('throws TypeError when options is an array', async () => {
    await expect(
      // @ts-expect-error
      sim.invoke('noop', {}, ['a', 'b'])
    ).rejects.toThrow(/InvokeOptions object/);
  });

  it('throws TypeError with "did you mean { context: ... }" hint on bare context fields', async () => {
    await expect(
      // @ts-expect-error — the exact mistake run #7 and #10 made
      sim.invoke('noop', {}, { accountId: 'alice' })
    ).rejects.toThrow(/Did you mean \{ context: \{ accountId: \.\.\. \} \}/);
  });

  it('throws TypeError with hint on multiple bare context fields', async () => {
    await expect(
      // @ts-expect-error
      sim.invoke('noop', {}, { accountId: 'alice', cloudId: 'cloud-1' })
    ).rejects.toThrow(/Did you mean \{ context: \{ accountId: \.\.\., cloudId: \.\.\. \} \}/);
  });

  it('throws TypeError with valid-keys list when keys are random', async () => {
    await expect(
      // @ts-expect-error
      sim.invoke('noop', {}, { wat: 'huh', wut: 1 })
    ).rejects.toThrow(/unknown key.*"wat", "wut".*Valid keys: moduleKey, context/);
  });

  it('throws TypeError when options.moduleKey is not a string', async () => {
    await expect(
      // @ts-expect-error
      sim.invoke('noop', {}, { moduleKey: 42 })
    ).rejects.toThrow(/options\.moduleKey must be a string/);
  });

  it('throws TypeError when options.context is not an object', async () => {
    await expect(
      // @ts-expect-error
      sim.invoke('noop', {}, { context: 'alice' })
    ).rejects.toThrow(/options\.context must be an object/);
  });

  it('throws TypeError when options.context is an array', async () => {
    await expect(
      // @ts-expect-error
      sim.invoke('noop', {}, { context: ['alice'] })
    ).rejects.toThrow(/options\.context must be an object/);
  });

  it('accepts undefined options gracefully', async () => {
    const result = await sim.invoke('noop', {}, undefined);
    expect(result).toEqual({ ok: true });
  });

  it('accepts null options gracefully', async () => {
    // @ts-expect-error — null isn't in the type but the runtime should be lenient
    const result = await sim.invoke('noop', {}, null);
    expect(result).toEqual({ ok: true });
  });

  it('accepts an empty options object', async () => {
    const result = await sim.invoke('noop', {}, {});
    expect(result).toEqual({ ok: true });
  });
});

describe('sim.invoke options object — moduleKey still works through the new shape', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    sim = createSimulator();
    sim.registerModuleRoute('panel-a', { resolverFunctionKey: 'resolver-a' });
    sim.resolver.define('getData', async () => ({ ok: true }));
    sim.registerResolverOwnership('getData', 'resolver-a');
  });

  afterEach(async () => {
    await sim.stop();
  });

  it('moduleKey scoping works via options.moduleKey', async () => {
    const result = await sim.invoke('getData', {}, { moduleKey: 'panel-a' });
    expect(result).toEqual({ ok: true });
  });

  it('moduleKey + context can be combined', async () => {
    sim.resolver.define('whoamiHere', async (req: any) => ({
      user: req.context.accountId,
      module: req.context.moduleKey,
    }));
    sim.registerResolverOwnership('whoamiHere', 'resolver-a');

    const result = await sim.invoke('whoamiHere', {}, {
      moduleKey: 'panel-a',
      context: { accountId: 'alice' },
    });
    expect(result.user).toBe('alice');
  });
});
