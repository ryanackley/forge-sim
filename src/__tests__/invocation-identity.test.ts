/**
 * Who a function runs as is decided by its kind, not by which sim API fired
 * it. Forge attaches a user only to invocations a person starts from the
 * app's UI (resolvers, Rovo actions); scheduled triggers, web triggers, event
 * triggers, queue consumers, pre-uninstall, custom field value, workflow and
 * JQL functions run as the app (see function-registry.ts for the docs each
 * rule is taken from). For those kinds:
 *
 *   - the runtime view has no `aaid`, so the real `authorize()` throws its
 *     "Couldn't find the accountId of the invoking user" error
 *   - the real `asUser()` gets the proxy's 401 with
 *     `forge-proxy-error: NEEDS_AUTHENTICATION_ERR`, which @forge/api turns
 *     into NeedsAuthenticationError (api/out/api/fetch.js:66-74)
 *   - `asApp()` works, and the mock layer is told `provider: 'app'`
 *   - the handler's `context` is Forge's documented Context
 *     (installContext, optional license), with no accountId or cloudId
 *   - a sticky `setContext({ accountId })`, a render as another user, or the
 *     resolver that pushed a queue event never leak a user in
 *
 * `asUser(accountId)` for another user is offline impersonation and needs a
 * scope declared with `allowImpersonation: true`.
 *
 * Driven through the real packages in-process (`@forge/api`, `@forge/events`)
 * against the sim's seams, plus one bundled deploy of a fixture declaring
 * every kind.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { asApp, asUser, authorize, route } from '@forge/api';
import { Queue } from '@forge/events';
import { createSimulator, ForgeSimulator, invocationBudgetSeconds } from '../simulator.js';
import { AUTHORIZE_NO_ACCOUNT_ERROR } from '../authorize.js';
import { functionTypeHasUser, type ForgeFunctionType } from '../function-registry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, 'fixtures', 'invocation-kinds');

const manifest = (scopes: string) => `
app:
  id: ari:cloud:ecosystem::app/identity-test
  name: Identity Test
  runtime:
    name: nodejs22.x
permissions:
  scopes:
${scopes}
modules:
  function:
    - key: resolverFn
      handler: index.resolver
    - key: triggerFn
      handler: index.trigger
    - key: schedFn
      handler: index.sched
    - key: hookFn
      handler: index.hook
    - key: consumerFn
      handler: index.consumer
    - key: preUninstallFn
      handler: index.preUninstall
    - key: cfValueFn
      handler: index.cfValue
    - key: validatorFn
      handler: index.validator
    - key: jqlFn
      handler: index.jql
  jira:issuePanel:
    - key: my-panel
      resource: main
      render: native
      icon: https://example.com/icon.svg
      title: Identity panel
      resolver:
        function: resolverFn
  trigger:
    - key: on-created
      function: triggerFn
      events:
        - avi:jira:created:issue
  scheduledTrigger:
    - key: nightly
      function: schedFn
      interval: day
  webtrigger:
    - key: hook
      function: hookFn
  consumer:
    - key: work-consumer
      queue: work-queue
      function: consumerFn
  preUninstall:
    - key: pu
      function: preUninstallFn
  jira:customField:
    - key: score
      name: Score
      description: A computed score
      type: string
      view:
        value:
          function: cfValueFn
  jira:workflowValidator:
    - key: assigned-validator
      name: Assigned validator
      description: Only assigned work items may transition
      function: validatorFn
  jira:jqlFunction:
    - key: issues-with-text
      name: issuesWithText
      function: jqlFn
      arguments:
        - name: text
          required: true
      operators:
        - in
      types:
        - issue
resources:
  - key: main
    path: src/frontend/index.jsx
`;

const PLAIN_SCOPES = `    - read:jira-work`;
const IMPERSONATION_SCOPES = `    read:jira-work:
      allowImpersonation: true`;

interface Probe {
  aaid: string | undefined;
  moduleType: string;
  context: Record<string, unknown>;
  asUser: { status: number; body: any } | { error: { name: string; status: number; message: string; serviceKey?: string } };
  asApp: { status: number; body: any };
  authorize: string;
}

/** What a handler sees, through the real @forge/api against the sim's seams. */
async function probe(context: unknown): Promise<Probe> {
  const rt = (globalThis as any).__forge_runtime__;
  const out: Partial<Probe> = {
    aaid: rt.aaid,
    moduleType: rt.appContext.moduleType,
    context: (context ?? {}) as Record<string, unknown>,
  };
  try {
    const res = await asUser().requestJira(route`/rest/api/3/myself`);
    out.asUser = { status: res.status, body: await res.json() };
  } catch (err: any) {
    out.asUser = { error: { name: err.name, status: err.status, message: err.message, serviceKey: err.serviceKey } };
  }
  const app = await asApp().requestJira(route`/rest/api/3/myself`);
  out.asApp = { status: app.status, body: await app.json() };
  try {
    authorize();
    out.authorize = 'ok';
  } catch (err: any) {
    out.authorize = err.message;
  }
  return out as Probe;
}

interface MyselfCall {
  provider: string | undefined;
  accountId: string | undefined;
}

function setup(scopes = PLAIN_SCOPES) {
  const sim = createSimulator();
  const calls: MyselfCall[] = [];
  const probes: Record<string, Probe> = {};
  return {
    sim,
    calls,
    probes,
    async load() {
      await sim.loadManifest(manifest(scopes));
      sim.registerModuleRoute('my-panel', { resolverFunctionKey: 'resolverFn', moduleType: 'jira:issuePanel' });
      // The mock sees who each request acts as.
      sim.mockProductRoutes('jira', {
        'GET /rest/api/3/myself': (_path: string, options?: { provider?: string; accountId?: string }) => {
          calls.push({ provider: options?.provider, accountId: options?.accountId });
          return { accountId: options?.accountId ?? 'app-system-user' };
        },
      });
      const record = (kind: string) => async (_a: unknown, context: unknown) => {
        probes[kind] = await probe(context);
      };
      sim.resolver.define('whoami', async (req: any) => {
        probes.resolver = await probe(req.context);
        return probes.resolver;
      });
      sim.registerFunction('triggerFn', record('trigger'), 'trigger');
      sim.registerFunction('schedFn', record('scheduledTrigger'), 'scheduledTrigger');
      sim.registerFunction('hookFn', async (_req: unknown, context: unknown) => {
        probes.webTrigger = await probe(context);
        return { statusCode: 200, body: 'ok' };
      }, 'webTrigger');
      sim.registerConsumer('work-queue', record('consumer'));
      // These kinds have no firing API of their own; sim.invoke() drives them
      // with Forge's (payload, context) convention and a user-less context.
      sim.registerFunction('preUninstallFn', record('preUninstall'), 'preUninstall');
      sim.registerFunction('cfValueFn', record('customFieldValue'), 'customFieldValue');
      sim.registerFunction('validatorFn', record('workflow'), 'workflow');
      sim.registerFunction('jqlFn', record('jqlFunction'), 'jqlFunction');
    },
  };
}

type Fire = (sim: ForgeSimulator) => Promise<unknown>;
const USERLESS_KINDS: Array<[ForgeFunctionType, Fire]> = [
  ['trigger', (sim) => sim.fireTrigger('avi:jira:created:issue', { issue: { key: 'ID-1' } })],
  ['scheduledTrigger', (sim) => sim.fireScheduledTrigger('nightly')],
  ['webTrigger', (sim) => sim.fireWebTrigger('hook')],
  ['consumer', (sim) => sim.queue.push('work-queue', [{ body: { n: 1 } }])],
  ['preUninstall', (sim) => sim.invoke('preUninstallFn', { context: { cloudId: 'c', moduleKey: 'pu' } })],
  ['customFieldValue', (sim) => sim.invoke('cfValueFn', { issues: [{ id: 1 }] })],
  ['workflow', (sim) => sim.invoke('validatorFn', { issue: { key: 'ID-1' } })],
  ['jqlFunction', (sim) => sim.invoke('jqlFn', { clause: {} })],
];

describe('invocation identity: who each function kind runs as', () => {
  let rig: ReturnType<typeof setup>;
  let sim: ForgeSimulator;

  beforeEach(async () => {
    rig = setup();
    sim = rig.sim;
    await rig.load();
  });

  afterEach(async () => {
    await sim.stop();
  });

  it('the kind table: only resolvers, actions and bare functions carry a user', () => {
    const withUser = (['resolver', 'action', 'generic'] as ForgeFunctionType[]).map(functionTypeHasUser);
    expect(withUser).toEqual([true, true, true]);
    for (const [kind] of USERLESS_KINDS) expect(functionTypeHasUser(kind)).toBe(false);
  });

  it('the manifest gives every function the kind of the module that binds it', () => {
    const types = Object.fromEntries(
      [...sim.getManifest()!.functions.entries()].map(([k, f]) => [k, f.type]),
    );
    expect(types).toEqual({
      resolverFn: 'resolver',
      triggerFn: 'trigger',
      schedFn: 'scheduledTrigger',
      hookFn: 'webTrigger',
      consumerFn: 'consumer',
      preUninstallFn: 'preUninstall',
      cfValueFn: 'customFieldValue',
      validatorFn: 'workflow',
      jqlFn: 'jqlFunction',
    });
    expect(sim.getManifest()!.preUninstalls).toEqual([{ key: 'pu', functionKey: 'preUninstallFn' }]);
    expect(sim.getManifest()!.impersonationScopes).toEqual([]);
  });

  describe.each(USERLESS_KINDS)('%s', (kind, fire) => {
    it('runs as the app: no aaid, asUser() refused, asApp() works, authorize() throws, Forge Context shape', async () => {
      await fire(sim);
      const p = rig.probes[kind];
      expect(p, `probe recorded for ${kind}`).toBeDefined();
      expect(p.aaid).toBeUndefined();
      expect(p.moduleType).toBe(kind);

      // The real package's error, from the proxy's 401 (api/out/api/fetch.js:66-74).
      expect(p.asUser).toEqual({
        error: {
          name: 'NEEDS_AUTHENTICATION_ERR',
          status: 401,
          message: 'Authentication Required',
          serviceKey: 'atlassian-token-service-key',
        },
      });
      // The refusal never reached the mock; asApp() did, tagged as the app.
      expect(rig.calls).toEqual([{ provider: 'app', accountId: undefined }]);
      expect(p.asApp.status).toBe(200);

      // node_modules/@forge/api/out/authorization/index.js:7-9
      expect(p.authorize).toBe(AUTHORIZE_NO_ACCOUNT_ERROR);

      // https://developer.atlassian.com/platform/forge/function-reference/arguments/
      expect(p.context.installContext).toBe('ari:cloud:jira::site/sim-cloud-001');
      expect(p.context).not.toHaveProperty('accountId');
      expect(p.context).not.toHaveProperty('cloudId');
      expect(p.context).not.toHaveProperty('principal');
    });

    it('ignores a sticky setContext user and the last render\'s user', async () => {
      sim.resolver.setContext({ accountId: 'carol', cloudId: 'carol-cloud' });
      sim.resolver.setRenderContext({ accountId: 'bob', moduleKey: 'my-panel' });
      await fire(sim);
      const p = rig.probes[kind];
      expect(p.aaid).toBeUndefined();
      expect('error' in p.asUser).toBe(true);
      expect(p.context).not.toHaveProperty('accountId');
      // The user-flavoured layers still apply to a resolver.
      const r = await sim.invoke('whoami', {});
      expect(r.aaid).toBe('bob');
    });

    it('names the kind in the warning that explains the refused asUser()', async () => {
      const warned: string[] = [];
      const spy = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
        warned.push(args.map(String).join(' '));
      });
      try {
        await fire(sim);
      } finally {
        spy.mockRestore();
      }
      const warning = warned.find((m) => m.includes('asUser() has no user to act as'));
      expect(warning).toContain(`a ${kind} invocation runs as the app`);
      expect(warning).toContain('allowImpersonation');
    });
  });

  it('sticky installContext and license reach a user-less function; nothing else from setContext does', async () => {
    sim.resolver.setContext({
      accountId: 'carol',
      installContext: 'ari:cloud:jira::site/other-cloud',
      license: { active: true },
      moduleKey: 'elsewhere',
    } as any);
    await sim.fireScheduledTrigger('nightly');
    expect(rig.probes.scheduledTrigger.context).toEqual({
      installContext: 'ari:cloud:jira::site/other-cloud',
      license: { active: true },
    });
  });

  it('a resolver runs as the invoking user, and the mock is told so', async () => {
    const p = (await sim.invoke('whoami', {}, { context: { accountId: 'alice' } })) as Probe;
    expect(p.aaid).toBe('alice');
    expect(p.asUser).toEqual({ status: 200, body: { accountId: 'alice' } });
    expect(p.authorize).toBe('ok');
    expect(rig.calls).toEqual([
      { provider: 'user', accountId: 'alice' },
      { provider: 'app', accountId: undefined },
    ]);
  });

  it('a consumer pushed from a resolver running as alice is its own invocation, as the app', async () => {
    sim.resolver.define('pushWork', async () => {
      await new Queue({ key: 'work-queue' }).push({ body: { from: 'alice' } });
      return (globalThis as any).__forge_runtime__.aaid;
    });
    const pusherAaid = await sim.invoke('pushWork', {}, { context: { accountId: 'alice' } });
    expect(pusherAaid).toBe('alice');
    const c = rig.probes.consumer;
    expect(c, 'consumer ran during the push').toBeDefined();
    expect(c.aaid).toBeUndefined();
    expect(c.moduleType).toBe('consumer');
    expect(c.context).toEqual({ installContext: 'ari:cloud:jira::site/sim-cloud-001' });
    expect('error' in c.asUser).toBe(true);
  });

  it('req.context.moduleKey and getAppContext().moduleKey describe the same invocation', async () => {
    const seen: Array<{ reqModuleKey: unknown; appModuleKey: unknown }> = [];
    sim.resolver.define('where', async (req: any) => {
      seen.push({
        reqModuleKey: req.context.moduleKey,
        appModuleKey: (globalThis as any).__forge_runtime__.appContext.moduleKey,
      });
    });
    await sim.invoke('where', {}, { moduleKey: 'my-panel' });
    sim.currentModuleKey = 'bg';
    await sim.invoke('where', {});
    sim.currentModuleKey = undefined;
    // A per-call context moduleKey still wins for req.context.
    await sim.invoke('where', {}, { moduleKey: 'my-panel', context: { moduleKey: 'explicit' } });
    expect(seen).toEqual([
      { reqModuleKey: 'my-panel', appModuleKey: 'my-panel' },
      { reqModuleKey: 'bg', appModuleKey: 'bg' },
      { reqModuleKey: 'explicit', appModuleKey: 'my-panel' },
    ]);
  });

  describe('asUser(accountId): offline impersonation', () => {
    it('is refused without a scope declared allowImpersonation: true', async () => {
      const warned: string[] = [];
      const spy = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
        warned.push(args.map(String).join(' '));
      });
      let failure: any;
      sim.registerFunction('triggerFn', async () => {
        try {
          await asUser('bob').requestJira(route`/rest/api/3/myself`);
        } catch (err: any) {
          failure = { name: err.name, status: err.status };
        }
      }, 'trigger');
      try {
        await sim.fireTrigger('avi:jira:created:issue', { issue: { key: 'ID-1' } });
      } finally {
        spy.mockRestore();
      }
      expect(failure).toEqual({ name: 'NEEDS_AUTHENTICATION_ERR', status: 401 });
      expect(rig.calls).toEqual([]);
      const warning = warned.find((m) => m.includes('asUser("bob") is offline user impersonation'));
      expect(warning).toContain('allowImpersonation: true');
    });

    it('acts as that user from a user-less kind and from a resolver once the scope is declared', async () => {
      await sim.stop();
      rig = setup(IMPERSONATION_SCOPES);
      sim = rig.sim;
      await rig.load();
      expect(sim.getManifest()!.impersonationScopes).toEqual(['read:jira-work']);

      const answers: any[] = [];
      sim.registerFunction('triggerFn', async () => {
        const res = await asUser('bob').requestJira(route`/rest/api/3/myself`);
        answers.push(await res.json());
      }, 'trigger');
      await sim.fireTrigger('avi:jira:created:issue', { issue: { key: 'ID-1' } });

      sim.resolver.define('asBob', async () => {
        const res = await asUser('bob').requestJira(route`/rest/api/3/myself`);
        answers.push(await res.json());
      });
      await sim.invoke('asBob', {}, { context: { accountId: 'alice' } });

      expect(answers).toEqual([{ accountId: 'bob' }, { accountId: 'bob' }]);
      expect(rig.calls).toEqual([
        { provider: 'user', accountId: 'bob' },
        { provider: 'user', accountId: 'bob' },
      ]);
    });
  });
});

describe('invocation identity through a bundled deploy', () => {
  let sim: ForgeSimulator;

  beforeEach(async () => {
    sim = createSimulator();
    sim.mockProductRoutes('jira', {
      'GET /rest/api/3/myself': (_path: string, options?: { provider?: string; accountId?: string }) => ({
        provider: options?.provider ?? null,
        accountId: options?.accountId ?? null,
      }),
    });
    const result = await sim.deploy(FIXTURE, { fireScheduledTriggers: false, throwOnError: false } as any);
    expect(result.errors ?? []).toEqual([]);
  });

  afterEach(async () => {
    await sim.stop();
  });

  it('registers each function under the kind the manifest binds it to', () => {
    const types = Object.fromEntries(
      ['resolverFn', 'triggerFn', 'schedFn', 'hookFn', 'consumerFn', 'preUninstallFn', 'cfValueFn', 'validatorFn', 'jqlFn']
        .map((k) => [k, sim.functions.getType(k) ?? sim.getManifest()?.functions.get(k)?.type]),
    );
    expect(types).toEqual({
      resolverFn: 'resolver',
      triggerFn: 'trigger',
      schedFn: 'scheduledTrigger',
      hookFn: 'webTrigger',
      consumerFn: 'consumer',
      preUninstallFn: 'preUninstall',
      cfValueFn: 'customFieldValue',
      validatorFn: 'workflow',
      jqlFn: 'jqlFunction',
    });
  });

  it('the bundled real @forge/api sees no user in a scheduled trigger and the user in a resolver', async () => {
    await sim.fireScheduledTrigger('nightly');
    const sched = await sim.kvs.get('probe:scheduledTrigger');
    expect(sched.aaid).toBeNull();
    expect(sched.asUser.error).toMatchObject({ name: 'NEEDS_AUTHENTICATION_ERR', status: 401 });
    expect(sched.asApp).toEqual({ status: 200, body: { provider: 'app', accountId: null } });
    expect(sched.authorize).toBe(AUTHORIZE_NO_ACCOUNT_ERROR);
    expect(sched.contextKeys).toEqual(['installContext']);

    await sim.invoke('whoami', {}, { context: { accountId: 'alice' } });
    const res = await sim.kvs.get('probe:resolver');
    expect(res.aaid).toBe('alice');
    expect(res.asUser).toEqual({ status: 200, body: { provider: 'user', accountId: 'alice' } });
    expect(res.authorize).toBe('ok');
  });

  it('pre-uninstall, custom field value, workflow and JQL functions get Forge\'s (payload, context) and run as the app', async () => {
    await sim.invoke('preUninstallFn', { context: { cloudId: 'c', moduleKey: 'pu' }, contextToken: 't' });
    await sim.invoke('cfValueFn', { issues: [] });
    await sim.invoke('validatorFn', { issue: { key: 'ID-1' }, transition: {} });
    await sim.invoke('jqlFn', { clause: {} });
    const expectedPayloadKeys: Record<string, string[]> = {
      preUninstall: ['context', 'contextToken'],
      customFieldValue: ['issues'],
      workflow: ['issue', 'transition'],
      jqlFunction: ['clause'],
    };
    for (const kind of ['preUninstall', 'customFieldValue', 'workflow', 'jqlFunction']) {
      const p = await sim.kvs.get(`probe:${kind}`);
      expect(p, kind).toBeDefined();
      // Two arguments: the payload as given, then the documented Context.
      expect(p.payloadKeys, kind).toEqual(expectedPayloadKeys[kind]);
      expect(p.contextKeys, kind).toEqual(['installContext']);
      expect(p.aaid, kind).toBeNull();
      expect(p.moduleType, kind).toBe(kind);
      expect(p.asUser.error?.name, kind).toBe('NEEDS_AUTHENTICATION_ERR');
    }
  });

  it('a Rovo action gets (payload, context) with the invoking user as context.principal, and a 55 s budget', async () => {
    await sim.invoke('actionFn', { minutes: 5 }, { context: { accountId: 'alice' } });
    const a = await sim.kvs.get('probe:action');
    expect(a.payloadKeys).toEqual(['minutes']);
    expect(a.contextKeys).toEqual(['installContext', 'principal']);
    expect(a.principal).toEqual({ accountId: 'alice' });
    expect(a.aaid).toBe('alice');
    expect(a.asUser).toEqual({ status: 200, body: { provider: 'user', accountId: 'alice' } });
    expect(a.moduleType).toBe('action');
    expect(a.remainingMs).toBeGreaterThan(25_000);
    expect(a.remainingMs).toBeLessThanOrEqual(55_000);
  });

  it('a consumer delivery is attributed to its consumer module and function, with the function\'s timeoutSeconds budget', async () => {
    sim.resolver.define('pushWork', async () => {
      await new Queue({ key: 'work-queue' }).push({ body: { job: 1 } });
    });
    await sim.invoke('pushWork', {});
    const c = await sim.kvs.get('probe:consumer');
    expect(c).toBeDefined();
    expect(c.moduleKey).toBe('work-consumer');
    expect(c.functionKey).toBe('consumerFn');
    expect(c.payloadKeys).toEqual(['body', 'eventId', 'jobId', 'queueName']);
    // consumerFn declares timeoutSeconds: 600.
    expect(c.remainingMs).toBeGreaterThan(55_000);
    expect(c.remainingMs).toBeLessThanOrEqual(600_000);
  });
});

describe('runtime budgets', () => {
  it('timeoutSeconds extends only scheduled triggers and consumers, clamped to 1..900', () => {
    expect(invocationBudgetSeconds('resolver')).toBe(25);
    expect(invocationBudgetSeconds('action')).toBe(55);
    expect(invocationBudgetSeconds('preUninstall')).toBe(55);
    expect(invocationBudgetSeconds('webTrigger', 600)).toBe(55);
    expect(invocationBudgetSeconds('workflow', 600)).toBe(25);
    expect(invocationBudgetSeconds('consumer')).toBe(55);
    expect(invocationBudgetSeconds('consumer', 600)).toBe(600);
    expect(invocationBudgetSeconds('scheduledTrigger', 2000)).toBe(900);
    expect(invocationBudgetSeconds('consumer', 0)).toBe(1);
  });

  it('a consumer past its own timeoutSeconds is reported against that budget, not the 55 s default', async () => {
    const sim = createSimulator();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      sim.registerConsumer('slow-q', async () => { await new Promise((r) => setTimeout(r, 1200)); }, { timeoutSeconds: 1 });
      sim.resolver.define('pushSlow', async () => {
        await new Queue({ key: 'slow-q' }).push({ body: {} });
      });
      await sim.invoke('pushSlow', {});
      const line = errorSpy.mock.calls.map((c) => String(c[0])).find((m) => /TIMEOUT: Consumer for queue "slow-q"/.test(m));
      expect(line).toContain('limit of 1s');
    } finally {
      errorSpy.mockRestore();
      await sim.stop();
    }
  });
});
