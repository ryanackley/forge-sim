/**
 * Realtime doc-parity, round 2 (adversarial).
 *
 * Every expectation below is derived ONLY from these ground-truth sources —
 * NOT from forge-sim's implementation or its existing realtime tests:
 *
 *  [D1] Forge bridge realtime
 *       https://developer.atlassian.com/platform/forge/apis-reference/ui-api-bridge/realtime/
 *  [D2] Realtime events API
 *       https://developer.atlassian.com/platform/forge/runtime-reference/realtime-events-api/
 *  [D3] Authorizing Realtime channels
 *       https://developer.atlassian.com/platform/forge/realtime/authorizing-realtime-channels/
 *  [D4] Error handling for Realtime methods
 *       https://developer.atlassian.com/platform/forge/realtime/error-handling-for-realtime-methods/
 *  [T1] @forge/bridge@5.17.0  node_modules/@forge/bridge/out/realtime/{index,realtime,productContext}.d.ts
 *  [T2] @forge/realtime@1.0.1 out/{index,publish,signRealtimeToken,utils}.{d.ts,js}
 *       (fetched with `npm pack @forge/realtime`; the package is not installed in this repo)
 *
 * Driving conventions (forge-sim test API only, never its realtime internals):
 *  - backend publish/sign go through resolvers invoked with an explicit
 *    `moduleKey`, which is how a frontend-originated invocation is modelled;
 *  - frontend subscribe/publish go through the `@forge/bridge` shim, either
 *    from a rendered UI module (useEffect, exactly like the doc snippets) or
 *    directly from the test with `sim.currentModuleKey` naming the module.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSimulator, type ForgeSimulator } from '../simulator.js';

import * as bridge from '@forge/bridge';
import * as bridgeRealtimeSubpath from '@forge/bridge/realtime';
import * as forgeRealtime from '@forge/realtime';

const { realtime: rt, Jira, Confluence, Bitbucket } = bridge;

// ── Fixture app ─────────────────────────────────────────────────────────

const CHANNEL = 'doc-channel';

/** Doc-snippet-shaped frontend: subscribes in useEffect, renders what arrives. */
function subscriberFrontend(label: string): string {
  return `
import ForgeReconciler, { Text, Stack } from '@forge/react';
import { realtime } from '@forge/bridge';
import { useEffect, useState } from 'react';

const App = () => {
  const [events, setEvents] = useState<string[]>([]);
  const [status, setStatus] = useState('subscribing');
  useEffect(() => {
    // [D1] subscribe example: the callback "takes a string or JSON payload"
    const subscription = realtime.subscribe('${CHANNEL}', (payload) => {
      setEvents((prev) => [...prev, typeof payload === 'string' ? payload : JSON.stringify(payload)]);
    });
    subscription.then(() => setStatus('ready'), (e: any) => setStatus('error: ' + e.message));
    return () => { subscription.then((s) => s.unsubscribe()).catch(() => {}); };
  }, []);
  return (
    <Stack>
      <Text>${label} {status}</Text>
      {events.map((e, i) => <Text key={String(i)}>evt: {e}</Text>)}
    </Stack>
  );
};
ForgeReconciler.render(<App />);
`;
}

const BACKEND = `
import Resolver from '@forge/resolver';
import { publish, publishGlobal, signRealtimeToken } from '@forge/realtime';

const resolver = new Resolver();
// [D2] "import { publish } from '@forge/realtime'" inside a resolver file.
resolver.define('pub', async ({ payload }) => {
  try {
    return { ok: true, result: await publish(payload.channel, payload.body, payload.options) };
  } catch (e) {
    return { ok: false, thrown: String(e && e.message) };
  }
});
resolver.define('pubGlobal', async ({ payload }) => {
  try {
    return { ok: true, result: await publishGlobal(payload.channel, payload.body, payload.options) };
  } catch (e) {
    return { ok: false, thrown: String(e && e.message) };
  }
});
resolver.define('sign', async ({ payload }) =>
  signRealtimeToken(payload.channel, payload.claims, payload.permissions));
export const handler = resolver.getDefinitions();
`;

const ASYNC_HANDLERS = `
import { publish, publishGlobal } from '@forge/realtime';
import { kvs } from '@forge/kvs';

async function both(channel, tag) {
  const scoped = await publish(channel, 'scoped-from-' + tag);
  const global = await publishGlobal(channel, 'global-from-' + tag);
  return { scoped, global };
}
export async function onIssue(event, context) {
  return both('trigger-channel', 'trigger');
}
export async function onSched(event, context) {
  const r = await both('sched-channel', 'sched');
  return { statusCode: 200, body: JSON.stringify(r) };
}
export async function onHook(request, context) {
  const r = await both('hook-channel', 'hook');
  return { statusCode: 200, headers: { 'Content-Type': ['application/json'] }, body: JSON.stringify(r) };
}
export async function onJob(event, context) {
  const r = await both('job-channel', 'job');
  await kvs.set('job-result', r);
}
`;

const MANIFEST = `
modules:
  jira:issuePanel:
    - key: panel-a
      title: Panel A
      icon: https://example.com/icon.svg
      resource: fe-a
      render: native
      resolver:
        function: backend
  jira:issueContext:
    - key: ctx-b
      title: Ctx B
      label: Ctx B
      icon: https://example.com/icon.svg
      resource: fe-b
      render: native
      resolver:
        function: backend
  trigger:
    - key: issue-created
      function: on-issue
      events:
        - avi:jira:created:issue
  scheduledTrigger:
    - key: sched
      function: on-sched
      interval: hour
  webtrigger:
    - key: hook
      function: on-hook
  consumer:
    - key: worker
      queue: jobs
      function: on-job
  function:
    - key: backend
      handler: index.handler
    - key: on-issue
      handler: async-handlers.onIssue
    - key: on-sched
      handler: async-handlers.onSched
    - key: on-hook
      handler: async-handlers.onHook
    - key: on-job
      handler: async-handlers.onJob
resources:
  - key: fe-a
    path: src/fe-a.tsx
  - key: fe-b
    path: src/fe-b.tsx
app:
  id: ari:cloud:ecosystem::app/realtime-doc-parity-round2
  runtime:
    name: nodejs22.x
permissions:
  scopes:
    - read:jira-work
`;

const ISSUE_1 = { issue: { key: 'RT-1', id: '10001' }, project: { key: 'P1', id: '100' } };
const ISSUE_2 = { issue: { key: 'RT-2', id: '10002' }, project: { key: 'P1', id: '100' } };
const ISSUE_OTHER_PROJECT = { issue: { key: 'Q-7', id: '20007' }, project: { key: 'Q', id: '200' } };

let dir: string;
let sim: ForgeSimulator;

const flush = () => new Promise((r) => setTimeout(r, 15));

type Opts = { token?: string; contextOverrides?: unknown } | undefined;

/** Backend publish() from a resolver invoked by module `moduleKey`. */
async function pub(moduleKey: string, channel: string, body: unknown, options?: Opts, extension: Record<string, unknown> = ISSUE_1) {
  return sim.invoke('pub', { channel, body, options }, { moduleKey, extension });
}
async function pubGlobal(moduleKey: string, channel: string, body: unknown, options?: Opts) {
  return sim.invoke('pubGlobal', { channel, body, options }, { moduleKey, extension: ISSUE_1 });
}
async function sign(channel: string, claims: unknown, permissions?: unknown) {
  return sim.invoke('sign', { channel, claims, permissions }, { moduleKey: 'panel-a', extension: ISSUE_1 });
}

/** Frontend subscribe via @forge/bridge, attributed to `moduleKey`. */
async function subscribeAs(moduleKey: string | null, channel: string, options?: any) {
  const received: unknown[] = [];
  sim.currentModuleKey = moduleKey ?? undefined;
  try {
    const sub = await rt.subscribe(channel, (p) => { received.push(p); }, options);
    return { received, sub };
  } finally {
    sim.currentModuleKey = undefined;
  }
}
async function subscribeGlobalAs(channel: string, options?: any) {
  const received: unknown[] = [];
  const sub = await rt.subscribeGlobal(channel, (p) => { received.push(p); }, options);
  return { received, sub };
}
/** Frontend publish via @forge/bridge, attributed to `moduleKey`. */
async function bridgePubAs(moduleKey: string, channel: string, body: any, options?: any) {
  sim.currentModuleKey = moduleKey;
  try {
    return await rt.publish(channel, body, options);
  } finally {
    sim.currentModuleKey = undefined;
  }
}

beforeAll(async () => {
  dir = join(tmpdir(), `forge-sim-rt-parity2-${Date.now()}`);
  mkdirSync(join(dir, 'src'), { recursive: true });
  // The fixture lives in os.tmpdir(); give it the repo node_modules so `react`
  // (the JSX runtime) resolves exactly as it would in a real app checkout.
  symlinkSync(join(import.meta.dirname, "..", "..", "node_modules"), join(dir, "node_modules"), "dir");
  writeFileSync(join(dir, 'manifest.yml'), MANIFEST);
  writeFileSync(join(dir, 'src', 'index.js'), BACKEND);
  writeFileSync(join(dir, 'src', 'async-handlers.js'), ASYNC_HANDLERS);
  writeFileSync(join(dir, 'src', 'fe-a.tsx'), subscriberFrontend('panel-a'));
  writeFileSync(join(dir, 'src', 'fe-b.tsx'), subscriberFrontend('ctx-b'));
  sim = createSimulator();
  await sim.deploy(dir, { fireScheduledTriggers: false });
});

afterAll(async () => {
  await sim.stop();
  rmSync(dir, { recursive: true, force: true });
});

afterEach(() => {
  vi.useRealTimers();
  sim.currentModuleKey = undefined;
  sim.realtime.reset();
  sim.ui.resetAll();
});

// ── A. Import surface ───────────────────────────────────────────────────

describe('A. import paths and exports', () => {
  it('A1 @forge/bridge exports realtime {subscribe,publish,subscribeGlobal,publishGlobal} and the ProductContext enums', () => {
    // [T1] out/index.d.ts: `export * from './realtime'`; realtime/index.d.ts
    // re-exports `realtime` and `Jira, Confluence, Bitbucket`.
    expect(typeof rt.subscribe).toBe('function');
    expect(typeof rt.publish).toBe('function');
    expect(typeof rt.subscribeGlobal).toBe('function');
    expect(typeof rt.publishGlobal).toBe('function');
    // [T1] productContext.d.ts enum values
    expect(Jira).toEqual({ Board: 'board', Issue: 'issue', Project: 'project' });
    expect(Confluence).toEqual({ Content: 'content', Space: 'space' });
    expect(Bitbucket).toEqual({ Repository: 'repository', PullRequest: 'pullRequest' });
  });

  it('A2 @forge/bridge/realtime subpath exports the enums and realtime (doc snippet: import { Jira } from "@forge/bridge/realtime")', () => {
    // [D3] "import { Jira } from '@forge/bridge/realtime';"
    // [T1] package.json exports "./realtime" -> out/realtime/index.d.ts
    expect(bridgeRealtimeSubpath.Jira.Project).toBe('project');
    expect(bridgeRealtimeSubpath.Confluence.Space).toBe('space');
    expect(bridgeRealtimeSubpath.Bitbucket.PullRequest).toBe('pullRequest');
    expect(typeof bridgeRealtimeSubpath.realtime.subscribe).toBe('function');
  });

  it('A3 @forge/realtime exports publish, publishGlobal, signRealtimeToken and the enums; it has no subscribe', () => {
    // (Was a divergence: the shim did not export the enums. Fixed 2026-10-03.)
    // [T2] index.d.ts: export { publish, publishGlobal }, { signRealtimeToken }, { Jira, Confluence, Bitbucket }
    // [D1] "resolvers cannot subscribe to channels."
    expect(typeof forgeRealtime.publish).toBe('function');
    expect(typeof forgeRealtime.publishGlobal).toBe('function');
    expect(typeof forgeRealtime.signRealtimeToken).toBe('function');
    expect((forgeRealtime as any).subscribe).toBeUndefined();
    expect((forgeRealtime as any).subscribeGlobal).toBeUndefined();
    expect((forgeRealtime as any).Jira).toEqual({ Board: 'board', Issue: 'issue', Project: 'project' });
    expect((forgeRealtime as any).Confluence).toEqual({ Content: 'content', Space: 'space' });
    expect((forgeRealtime as any).Bitbucket).toEqual({ Repository: 'repository', PullRequest: 'pullRequest' });
  });
});

// ── B. Default channel context ──────────────────────────────────────────

describe('B. default (module-scoped) channel context', () => {
  it('B1 resolver publish() reaches a subscribe() in the same module on the same issue (rendered UI path)', async () => {
    // [D1] "This includes events published from both the frontend and from resolvers."
    await sim.ui.render('panel-a', { extension: ISSUE_1 });
    await sim.ui.waitForContent('panel-a', 'panel-a ready');

    const res = await pub('panel-a', CHANNEL, 'hello-from-resolver');
    expect(res.ok).toBe(true);
    const doc = await sim.ui.waitForContent('panel-a', 'evt: hello-from-resolver');
    expect(sim.ui.getTextContent(doc)).toContain('evt: hello-from-resolver');
  });

  it('B2 a different module (jira:issueContext) on the same issue does NOT receive the issuePanel publish', async () => {
    // [D1] "It will not receive messages from a jira:issueContext on that issue ...
    //       even if they share the same channel name."
    const a = await subscribeAs('panel-a', CHANNEL);
    const b = await subscribeAs('ctx-b', CHANNEL);
    await pub('panel-a', CHANNEL, 'only-for-panel-a');
    await flush();
    expect(a.received).toEqual(['only-for-panel-a']);
    expect(b.received).toEqual([]);
  });

  it('B2b (rendered path) a realtime-driven re-render of panel-a is stored under panel-a, not under the last-rendered module', async () => {
    // (Was a divergence: the re-render was filed under the last-rendered module. Fixed 2026-10-03.)
    // Observability contract from forge-sim's own testing guide (docs/testing/README.md,
    // "Multiple modules, isolated trees"): "Each module gets its own ForgeDoc tree."
    // A subscriber callback fires outside any render scope; the resulting
    // setState re-render must still be attributed to the module that owns it.
    await sim.ui.render('panel-a', { extension: ISSUE_1 });
    await sim.ui.waitForContent('panel-a', 'panel-a ready');
    await sim.ui.render('ctx-b', { extension: ISSUE_1 });
    await sim.ui.waitForContent('ctx-b', 'ctx-b ready');

    await pub('panel-a', CHANNEL, 'only-for-panel-a');
    await flush();
    await sim.ui.settle();

    const aText = sim.ui.getTextContent(sim.ui.getForgeDoc('panel-a')!);
    const bText = sim.ui.getTextContent(sim.ui.getForgeDoc('ctx-b')!);
    expect(aText).toContain('panel-a ready');
    expect(aText).toContain('evt: only-for-panel-a');
    expect(bText).toContain('ctx-b ready');
    expect(bText).not.toContain('panel-a');
    expect(bText).not.toContain('only-for-panel-a');
  });

  it.fails('B3 the same module on a DIFFERENT issue does NOT receive the publish', async () => {
    // CONFIRMED DIVERGENCE: forge-sim keys the default context by module only; issue is ignored.
    // [D1] "... or the jira:issuePanel on a different issue, even if they share
    //       the same channel name."
    const { received } = await subscribeAs('panel-a', CHANNEL);
    // Same module key, but the resolver invocation's extension context is issue RT-2.
    const res = await pub('panel-a', CHANNEL, 'issue-2-event', undefined, ISSUE_2);
    await flush();
    expect(res.ok).toBe(true);
    expect(received).toEqual([]);
  });

  it('B4 publish() is never heard by subscribeGlobal(), and publishGlobal() never by subscribe()', async () => {
    // [D2] "events sent by the publish API can only be received by subscriptions
    //       created using the subscribe @forge/bridge API, and publishGlobal events
    //       can only be received by subscriptions created using the subscribeGlobal bridge API."
    const scoped = await subscribeAs('panel-a', CHANNEL);
    const global = await subscribeGlobalAs(CHANNEL);

    await pub('panel-a', CHANNEL, 'scoped-msg');
    await pubGlobal('panel-a', CHANNEL, 'global-msg');
    await flush();

    expect(scoped.received).toEqual(['scoped-msg']);
    expect(global.received).toEqual(['global-msg']);
  });

  it('B5 frontend realtime.publish() from panel-a reaches panel-a only', async () => {
    // [D1] publish: "If you have subscribed to the channel with the subscribe()
    //       function, your callback will be invoked with the event."
    const a = await subscribeAs('panel-a', CHANNEL);
    const b = await subscribeAs('ctx-b', CHANNEL);
    const result = await bridgePubAs('panel-a', CHANNEL, 'from-bridge');
    await flush();
    expect(a.received).toEqual(['from-bridge']);
    expect(b.received).toEqual([]);
    expect(typeof result.eventId).toBe('string');
  });

  it('B6 a subscribe() made outside any module context cannot be satisfied and must not widen to global', async () => {
    // [D3] "Realtime channels are always restricted to an app installation at a
    //       minimum" and the default context "will be the Atlassian app context of
    //       the module" — with no module there is no context to scope to.
    // [D2] publishGlobal events "can only be received by ... subscribeGlobal".
    let rejected: Error | null = null;
    let received: unknown[] = [];
    try {
      const r = await subscribeAs(null, CHANNEL);
      received = r.received;
    } catch (e) {
      rejected = e as Error;
    }
    await pubGlobal('panel-a', CHANNEL, 'global-msg');
    await flush();
    // Either it rejects (D4: subscribe "returns a rejected Promise on error") or
    // it silently never hears a global publish. It must never hear it.
    expect(received).toEqual([]);
    if (rejected) expect(typeof rejected.message).toBe('string');
  });
});

// ── C. PublishResult shape ──────────────────────────────────────────────

describe('C. PublishResult / payload shape', () => {
  it('C1 success: eventId string, eventTimestamp = epoch-ms string, and NO errors key (per real @forge/realtime typings)', async () => {
    // (Was a divergence: forge-sim returned `errors: []` on success. Fixed 2026-10-03.)
    // [D2] "eventId: The ID of the published event as a string."
    //      "eventTimestamp: The timestamp of the published event, in epoch milliseconds."
    //      signature: `eventTimestamp: string | null`
    // [T2] publish.d.ts success branch: `{ eventId: any; eventTimestamp: any; errors?: undefined }`
    //      publish.js: `return { eventId, eventTimestamp };` — no errors key on success.
    await subscribeAs('panel-a', CHANNEL);
    const before = Date.now();
    const { result } = await pub('panel-a', CHANNEL, 'x');
    const after = Date.now();

    expect(typeof result.eventId).toBe('string');
    expect(typeof result.eventTimestamp).toBe('string');
    const ts = Number(result.eventTimestamp);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
    expect(result).not.toHaveProperty('errors');
  });

  it('C2 no subscribers: eventId and eventTimestamp are null', async () => {
    // [D2] "The resulting eventId and eventTimestamp will be null if there are no existing subscribers."
    const { result } = await pub('panel-a', 'nobody-listens', 'x');
    expect(result.eventId).toBeNull();
    expect(result.eventTimestamp).toBeNull();
  });

  it('C3 an object payload is delivered to the subscriber as an object', async () => {
    // [D2] "payload: The event payload as a string or serializable object."
    // [T1] subscribe callback: `(payload: string | T, error?: Error) => any`
    const { received } = await subscribeAs('panel-a', CHANNEL);
    await pub('panel-a', CHANNEL, { n: 1, nested: { ok: true } });
    await flush();
    expect(received).toEqual([{ n: 1, nested: { ok: true } }]);
  });

  it('C4 frontend publish() returns a PublishResult too (eventId string with a subscriber, null without)', async () => {
    // [D1] publish "Returns PublishResult ... eventId ... null if ... there are no
    //       existing subscriptions for that channel."
    const none = await bridgePubAs('panel-a', 'quiet-channel', 'x');
    expect(none.eventId).toBeNull();
    expect(none.eventTimestamp).toBeNull();
    await subscribeAs('panel-a', CHANNEL);
    const some = await bridgePubAs('panel-a', CHANNEL, 'x');
    expect(typeof some.eventId).toBe('string');
    expect(typeof some.eventTimestamp).toBe('string');
  });
});

// ── D. Global channels & non-frontend invocation contexts ───────────────

describe('D. global channels and async invocation contexts', () => {
  it('D1 publishGlobal() from a resolver reaches subscribeGlobal() in every module', async () => {
    // [D3] "Global channels can be used to send messages across different
    //       Atlassian app contexts within an app installation"
    sim.currentModuleKey = 'panel-a';
    const a = await subscribeGlobalAs('g');
    sim.currentModuleKey = 'ctx-b';
    const b = await subscribeGlobalAs('g');
    sim.currentModuleKey = undefined;
    const { result } = await pubGlobal('panel-a', 'g', 'to-all');
    await flush();
    expect(a.received).toEqual(['to-all']);
    expect(b.received).toEqual(['to-all']);
    expect(typeof result.eventId).toBe('string');
  });

  it('D2 publishGlobal() works from a product trigger, scheduled trigger, web trigger and queue consumer', async () => {
    // [D3] global channels are for "publishing messages from a Forge function
    //       that isn't associated with a UI context, for example functions for
    //       Atlassian app events or lifecycle events."
    // [D2] "Use publishGlobal instead" for "async events and web triggers".
    const trig = await subscribeGlobalAs('trigger-channel');
    const sched = await subscribeGlobalAs('sched-channel');
    const hook = await subscribeGlobalAs('hook-channel');
    const job = await subscribeGlobalAs('job-channel');

    const [trigResult] = await sim.fireTrigger('avi:jira:created:issue', { issue: { key: 'RT-9' } });
    const schedResult = await sim.fireScheduledTrigger('sched');
    const hookResult = await sim.fireWebTrigger('hook', { method: 'POST', body: '{}' });
    await sim.queue.push('jobs', { body: { id: 1 } });
    await flush();

    expect(trig.received).toEqual(['global-from-trigger']);
    expect(sched.received).toEqual(['global-from-sched']);
    expect(hook.received).toEqual(['global-from-hook']);
    expect(job.received).toEqual(['global-from-job']);

    expect(typeof trigResult.global.eventId).toBe('string');
    expect(typeof JSON.parse(schedResult.body!).global.eventId).toBe('string');
    expect(typeof JSON.parse(hookResult.body as string).global.eventId).toBe('string');
    const jobResult = await sim.kvs.get('job-result');
    expect(typeof (jobResult as any).global.eventId).toBe('string');
  });

  it('D3 scoped publish() from a product trigger, scheduled trigger, web trigger or consumer does not deliver and reports an error', async () => {
    // [D2] Limitations: "The publish API is only supported for functions invoked
    //       from the app frontend. This is not currently available for async
    //       events and web triggers."
    // [D4] publish — "On error, eventId and eventTimestamp will be null and errors
    //       will return a list of errors."
    // ASSUMPTION: the docs do not name the error message for this case; only
    // "a list of errors" + null ids + non-delivery are asserted.
    sim.currentModuleKey = 'panel-a';
    const trig = await subscribeAs('panel-a', 'trigger-channel');
    const sched = await subscribeAs('panel-a', 'sched-channel');
    const hook = await subscribeAs('panel-a', 'hook-channel');
    const job = await subscribeAs('panel-a', 'job-channel');

    const [trigResult] = await sim.fireTrigger('avi:jira:created:issue', { issue: { key: 'RT-9' } });
    const schedResult = await sim.fireScheduledTrigger('sched');
    const hookResult = await sim.fireWebTrigger('hook', { method: 'POST', body: '{}' });
    await sim.queue.push('jobs', { body: { id: 2 } });
    await flush();

    for (const r of [trig, sched, hook, job]) expect(r.received).toEqual([]);

    const scopedResults = [
      trigResult.scoped,
      JSON.parse(schedResult.body!).scoped,
      JSON.parse(hookResult.body as string).scoped,
      ((await sim.kvs.get('job-result')) as any).scoped,
    ];
    for (const s of scopedResults) {
      expect(s.eventId).toBeNull();
      expect(s.eventTimestamp).toBeNull();
      expect(Array.isArray(s.errors)).toBe(true);
      expect(s.errors.length).toBeGreaterThan(0);
      expect(typeof s.errors[0].message).toBe('string');
    }
  });

  it('D4 publishGlobal() ignores contextOverrides (real package never sends them for global publishes)', async () => {
    // [T2] publish.js publishGlobal: `const { token } = options || {};` —
    //      contextOverrides is not read, not validated, not sent.
    const plain = await subscribeGlobalAs('g2');
    const { result } = await pubGlobal('panel-a', 'g2', 'ignored-overrides', { contextOverrides: [Jira.Project] });
    await flush();
    expect(plain.received).toEqual(['ignored-overrides']);
    expect(typeof result.eventId).toBe('string');
  });

  it('D5 publishGlobal() with a token-less publish never reaches a token-secured subscribeGlobal()', async () => {
    // [D3] "If using the subscribeGlobal and publishGlobal methods, the channel is
    //       only secured by the token."
    const { token } = await sign('g3', { room: 'r1' });
    const secured = await subscribeGlobalAs('g3', { token });
    await pubGlobal('panel-a', 'g3', 'unsecured');
    await flush();
    expect(secured.received).toEqual([]);
    await pubGlobal('panel-a', 'g3', 'secured', { token });
    await flush();
    expect(secured.received).toEqual(['secured']);
  });
});

// ── E. contextOverrides ─────────────────────────────────────────────────

describe('E. contextOverrides', () => {
  it('E1 identical [Jira.Project] overrides let different modules in the same project share a channel', async () => {
    // [D3] "This will allow you to create channels that exist across different
    //       modules or pages while still enforcing the user's product permissions
    //       for the context properties you provide." / example: "a channel that is
    //       scoped to the current Jira project. Messages can be published between
    //       different issues and boards in the project."
    const b = await subscribeAs('ctx-b', CHANNEL, { contextOverrides: [Jira.Project] });
    const { result } = await pub('panel-a', CHANNEL, 'project-wide', { contextOverrides: [Jira.Project] }, ISSUE_2);
    await flush();
    expect(b.received).toEqual(['project-wide']);
    expect(typeof result.eventId).toBe('string');
  });

  it('E2 a subscriber with [Jira.Project] does not receive from a publisher with [Jira.Project, Jira.Issue]', async () => {
    // [D3] "a subscriber with overrides [Jira.Project] will not receive messages
    //       from a publisher with overrides [Jira.Project, Jira.Issue], even though
    //       they have overlapping properties."
    const s = await subscribeAs('panel-a', CHANNEL, { contextOverrides: [Jira.Project] });
    await pub('panel-a', CHANNEL, 'narrower', { contextOverrides: [Jira.Project, Jira.Issue] });
    await flush();
    expect(s.received).toEqual([]);
  });

  it('E3 overrides completely replace the default context: default <-> [Jira.Project] never meet, even in the same module', async () => {
    // [D3] "Providing contextOverrides will completely override the default channel context."
    //      "The properties in contextOverrides must match exactly in the subscribe()
    //       and publish() calls in order for messages to be received."
    const dflt = await subscribeAs('panel-a', CHANNEL);
    const proj = await subscribeAs('panel-a', CHANNEL, { contextOverrides: [Jira.Project] });
    await pub('panel-a', CHANNEL, 'to-project', { contextOverrides: [Jira.Project] });
    await pub('panel-a', CHANNEL, 'to-default');
    await flush();
    expect(dflt.received).toEqual(['to-default']);
    expect(proj.received).toEqual(['to-project']);
  });

  it('E4 an empty contextOverrides array makes the channel reachable across modules (equivalent to a global channel)', async () => {
    // [D3] "If it's provided as an empty array, then the channel will not be
    //       secured by any Atlassian app context values, and will be equivalent
    //       to a global channel."
    const b = await subscribeAs('ctx-b', CHANNEL, { contextOverrides: [] });
    await pub('panel-a', CHANNEL, 'unsecured', { contextOverrides: [] });
    await flush();
    expect(b.received).toEqual(['unsecured']);
  });

  it.fails('E5 [Jira.Project] on both sides but DIFFERENT projects: not delivered', async () => {
    // CONFIRMED DIVERGENCE: forge-sim keys overrides by property NAME, not by the project's value.
    // [D3] overrides "only include those properties in the channel context" —
    //      the channel is "scoped to the current Jira project", so another
    //      project's publisher is a different channel context.
    const s = await subscribeAs('panel-a', CHANNEL, { contextOverrides: [Jira.Project] });
    await pub('panel-a', CHANNEL, 'other-project', { contextOverrides: [Jira.Project] }, ISSUE_OTHER_PROJECT);
    await flush();
    expect(s.received).toEqual([]);
  });

  it('E6 a non-array contextOverrides makes publish() reject with the real package\'s error message', async () => {
    // (Was a divergence: forge-sim resolved to an error result instead of rejecting. Fixed 2026-10-03.)
    // [T2] publish.js: `if (contextOverrides && !Array.isArray(contextOverrides)) {
    //        throw new Error('Invalid value for contextOverrides. Please provide an array of valid context properties.'); }`
    const res = await pub('panel-a', CHANNEL, 'x', { contextOverrides: 'project' as any });
    expect(res.ok).toBe(false);
    expect(res.thrown).toBe('Invalid value for contextOverrides. Please provide an array of valid context properties.');
  });

  it('E7 every ProductContext enum value is accepted as an override and matches itself', async () => {
    // [T1]/[T2] ProductContext = Jira | Confluence | Bitbucket (7 values).
    for (const ov of [Jira.Board, Jira.Issue, Jira.Project, Confluence.Content, Confluence.Space, Bitbucket.Repository, Bitbucket.PullRequest]) {
      const s = await subscribeAs('panel-a', CHANNEL, { contextOverrides: [ov] });
      const { result } = await pub('panel-a', CHANNEL, `via-${ov}`, { contextOverrides: [ov] });
      await flush();
      expect(s.received, `override ${ov}`).toEqual([`via-${ov}`]);
      expect(typeof result.eventId, `override ${ov}`).toBe('string');
      s.sub.unsubscribe();
    }
  });

  it('E8 frontend publish() with [Jira.Project] reaches a [Jira.Project] subscriber in another module', async () => {
    // [D3] frontend example: realtime.publish('my-test-channel', ..., { contextOverrides: [Jira.Project] })
    //      paired with realtime.subscribe(..., { contextOverrides: [Jira.Project] }).
    const b = await subscribeAs('ctx-b', CHANNEL, { contextOverrides: [Jira.Project] });
    const result = await bridgePubAs('panel-a', CHANNEL, 'fe-project-wide', { contextOverrides: [Jira.Project] });
    await flush();
    expect(b.received).toEqual(['fe-project-wide']);
    expect(typeof result.eventId).toBe('string');
  });
});

// ── F. Realtime tokens ──────────────────────────────────────────────────

const MISSING_PERMISSION = 'Realtime token validation failed: MISSING_PERMISSION';
const CHANNEL_NAME_MISMATCH = 'Realtime token validation failed: CHANNEL_NAME_MISMATCH';
const INVALID_TOKEN = 'Realtime token validation failed: INVALID_TOKEN';
const TOKEN_EXPIRED = 'Realtime token validation failed: TOKEN_EXPIRED';

describe('F. realtime tokens', () => {
  it('F1 signRealtimeToken returns a string token and expiresAt in epoch SECONDS, with no errors key on success', async () => {
    // [D2] "expiresAt: The timestamp of when the token expires, in Epoch time."
    // [D3] "expiresAt is an epoch timestamp expressed in seconds (in accordance
    //       with the JWT standard for the exp field)"
    // [T2] signRealtimeToken.js success: `return { token: jwt, expiresAt };`
    const nowSec = Date.now() / 1000;
    const r = await sign('tok-chan', { allowedUsers: ['a', 'b'] });
    expect(typeof r.token).toBe('string');
    expect(r.token.length).toBeGreaterThan(0);
    expect(typeof r.expiresAt).toBe('number');
    expect(r.expiresAt).toBeGreaterThan(nowSec);
    expect(r.expiresAt).toBeLessThan(Date.now()); // seconds, not milliseconds
    expect(r).not.toHaveProperty('errors');
  });

  it('F2 a token-secured publish is received only by subscribers holding a token with the same claims', async () => {
    // [D1] token: "The subscription will only receive events that have been
    //       published with a token containing the same channel context claims."
    const { token } = await sign(CHANNEL, { room: 'r1' });
    const { token: token2 } = await sign(CHANNEL, { room: 'r1' }); // separately signed, same claims
    const withToken = await subscribeAs('panel-a', CHANNEL, { token: token2 });
    const noToken = await subscribeAs('panel-a', CHANNEL);
    await pub('panel-a', CHANNEL, 'secret', { token });
    await flush();
    expect(withToken.received).toEqual(['secret']);
    expect(noToken.received).toEqual([]);
  });

  it('F3 different claims are a different channel', async () => {
    // [D2] "for events to be communicated on the same channel the claims object
    //       must match exactly between the publisher and subscriber."
    const { token: pubTok } = await sign(CHANNEL, { room: 'r1' });
    const { token: subTok } = await sign(CHANNEL, { room: 'r2' });
    const s = await subscribeAs('panel-a', CHANNEL, { token: subTok });
    await pub('panel-a', CHANNEL, 'r1-only', { token: pubTok });
    await flush();
    expect(s.received).toEqual([]);
  });

  it('F4 permissions table: omitted / [subscribe,publish] allow both; [subscribe] blocks publish; [publish] blocks subscribe', async () => {
    // [D3] table: Omitted -> Allowed/Allowed; ['subscribe','publish'] -> Allowed/Allowed;
    //      ['subscribe'] -> Subscribe Allowed, Publish Blocked; ['publish'] -> Subscribe Blocked, Publish Allowed.
    // [D4] MISSING_PERMISSION: "The provided token does not contain the required
    //      publish or subscribe permission."
    const both = (await sign(CHANNEL, {}, ['subscribe', 'publish'])).token;
    const subOnly = (await sign(CHANNEL, {}, ['subscribe'])).token;
    const pubOnly = (await sign(CHANNEL, {}, ['publish'])).token;

    // both
    const sBoth = await subscribeAs('panel-a', CHANNEL, { token: both });
    const rBoth = (await pub('panel-a', CHANNEL, 'both', { token: both })).result;
    await flush();
    expect(sBoth.received).toEqual(['both']);
    expect(typeof rBoth.eventId).toBe('string');

    // subscribe-only: subscribe allowed, publish blocked
    const sSub = await subscribeAs('panel-a', CHANNEL, { token: subOnly });
    const rSub = (await pub('panel-a', CHANNEL, 'blocked', { token: subOnly })).result;
    await flush();
    expect(rSub.eventId).toBeNull();
    expect(rSub.eventTimestamp).toBeNull();
    expect(rSub.errors.map((e: any) => e.message)).toEqual([MISSING_PERMISSION]);
    expect(sSub.received).toEqual([]);

    // publish-only: publish allowed (and a subscribe-only holder with the same claims hears it), subscribe blocked
    const rPub = (await pub('panel-a', CHANNEL, 'from-pub-only', { token: pubOnly })).result;
    await flush();
    expect(typeof rPub.eventId).toBe('string');
    expect(sSub.received).toEqual(['from-pub-only']);
    await expect(subscribeAs('panel-a', CHANNEL, { token: pubOnly })).rejects.toThrow(MISSING_PERMISSION);
  });

  it('F5 CHANNEL_NAME_MISMATCH on publish (result) and on subscribe (rejection)', async () => {
    // [D2] "channelName ... should exactly match the channel parameter in the
    //       corresponding subscribe() or publish() function."
    // [D4] "Realtime token validation failed: CHANNEL_NAME_MISMATCH — The token was signed for a different channel."
    const { token } = await sign('chan-x', {});
    const r = (await pub('panel-a', 'chan-y', 'x', { token })).result;
    expect(r.eventId).toBeNull();
    expect(r.errors.map((e: any) => e.message)).toEqual([CHANNEL_NAME_MISMATCH]);
    await expect(subscribeAs('panel-a', 'chan-y', { token })).rejects.toThrow(CHANNEL_NAME_MISMATCH);
  });

  it('F6 INVALID_TOKEN for a malformed token, and a pre-validation failure never delivers', async () => {
    // [D4] "Realtime token validation failed: INVALID_TOKEN — The provided Realtime
    //       token is malformed or could not be verified."
    //      "These errors occur when a provided Realtime token fails validation
    //       before the operation is executed."
    const plain = await subscribeAs('panel-a', CHANNEL);
    const r = (await pub('panel-a', CHANNEL, 'x', { token: 'definitely-not-a-token' })).result;
    await flush();
    expect(r.eventId).toBeNull();
    expect(r.eventTimestamp).toBeNull();
    expect(r.errors.map((e: any) => e.message)).toEqual([INVALID_TOKEN]);
    expect(plain.received).toEqual([]);
    await expect(subscribeAs('panel-a', CHANNEL, { token: 'definitely-not-a-token' })).rejects.toThrow(INVALID_TOKEN);
  });

  it('F7 TOKEN_EXPIRED once the clock passes expiresAt', async () => {
    // [D4] "Realtime token validation failed: TOKEN_EXPIRED — The provided Realtime token has expired."
    // [T2] utils.js: `Date.now() / 1000 >= decodedToken.exp` -> TOKEN_EXPIRED
    const { token, expiresAt } = await sign(CHANNEL, {});
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime((expiresAt + 1) * 1000);
    const r = (await pub('panel-a', CHANNEL, 'x', { token })).result;
    expect(r.eventId).toBeNull();
    expect(r.errors.map((e: any) => e.message)).toEqual([TOKEN_EXPIRED]);
    await expect(subscribeAs('panel-a', CHANNEL, { token })).rejects.toThrow(TOKEN_EXPIRED);
  });

  it('F8 the bridge publish() reports the same token errors as the events API', async () => {
    // [D4] "Expected errors are the same between the associated Realtime events
    //       API and Realtime bridge API operations."
    const subOnly = (await sign(CHANNEL, {}, ['subscribe'])).token;
    const r = await bridgePubAs('panel-a', CHANNEL, 'x', { token: subOnly });
    expect(r.eventId).toBeNull();
    expect((r.errors ?? []).map((e: any) => e.message)).toEqual([MISSING_PERMISSION]);
    const r2 = await bridgePubAs('panel-a', CHANNEL, 'x', { token: 'garbage' });
    expect((r2.errors ?? []).map((e: any) => e.message)).toEqual([INVALID_TOKEN]);
  });

  it('F9 on scoped channels the token is IN ADDITION to the module context: same token, other module, no delivery', async () => {
    // [D1] token: "This is in addition to the existing Atlassian app context scope of the channel."
    // [D3] "the channel is secured by the Atlassian app context (or a subset if
    //       contextOverrides is provided) and your token's claims."
    const { token } = await sign(CHANNEL, { room: 'r1' });
    const b = await subscribeAs('ctx-b', CHANNEL, { token });
    await pub('panel-a', CHANNEL, 'panel-a-secret', { token });
    await flush();
    expect(b.received).toEqual([]);
  });

  it('F10 token + contextOverrides: the subset context and the claims must both match', async () => {
    // [D3] "(or a subset if contextOverrides is provided) and your token's claims"
    const { token } = await sign(CHANNEL, { room: 'r1' });
    const { token: other } = await sign(CHANNEL, { room: 'r9' });
    const match = await subscribeAs('ctx-b', CHANNEL, { token, contextOverrides: [Jira.Project] });
    const wrongClaims = await subscribeAs('ctx-b', CHANNEL, { token: other, contextOverrides: [Jira.Project] });
    const noOverrides = await subscribeAs('ctx-b', CHANNEL, { token });
    await pub('panel-a', CHANNEL, 'proj-secret', { token, contextOverrides: [Jira.Project] });
    await flush();
    expect(match.received).toEqual(['proj-secret']);
    expect(wrongClaims.received).toEqual([]);
    expect(noOverrides.received).toEqual([]);
  });

  it('F11 doc resolver snippet: `Date.now() - BUFFER < expiresAt * 1000` is true for a fresh token', async () => {
    // [D3] resolver example compares `Date.now() - TOKEN_EXPIRY_BUFFER < expiresAt * 1000`
    const TOKEN_EXPIRY_BUFFER = 5000;
    const { expiresAt } = await sign('my-test-channel', { allowedUsers: ['accountId-1'] });
    expect(Date.now() - TOKEN_EXPIRY_BUFFER < expiresAt * 1000).toBe(true);
  });
});

// ── G. replay and unsubscribe ───────────────────────────────────────────

describe('G. replaySeconds and unsubscribe', () => {
  it('G1 replaySeconds delivers events published before the subscription (within the window)', async () => {
    // [D1] "replaySeconds: A timespan in seconds to receive previous events from
    //       a channel when initially subscribing."
    const first = await subscribeAs('panel-a', CHANNEL); // ensures the publish is a real, subscribed publish
    await pub('panel-a', CHANNEL, 'before-you-joined');
    await flush();
    expect(first.received).toEqual(['before-you-joined']);
    const late = await subscribeAs('panel-a', CHANNEL, { replaySeconds: 60 });
    await flush();
    expect(late.received).toEqual(['before-you-joined']);
  });

  it('G2 replaySeconds does not replay events older than the window, and no replay happens without the option', async () => {
    // [D1] "A timespan in seconds" — events outside the timespan are not replayed.
    await subscribeAs('panel-a', CHANNEL);
    await pub('panel-a', CHANNEL, 'ancient');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 120_000);
    const windowed = await subscribeAs('panel-a', CHANNEL, { replaySeconds: 60 });
    const none = await subscribeAs('panel-a', CHANNEL);
    await flush();
    expect(windowed.received).toEqual([]);
    expect(none.received).toEqual([]);
  });

  it('G3 unsubscribe() removes only that Subscription instance', async () => {
    // [D1] "Calling Subscription.unsubscribe() will remove the channel subscription
    //       for the specific Subscription instance and will not globally remove all
    //       subscriptions from that channel."
    const s1 = await subscribeAs('panel-a', CHANNEL);
    const s2 = await subscribeAs('panel-a', CHANNEL);
    await s1.sub.unsubscribe();
    const { result } = await pub('panel-a', CHANNEL, 'after-s1-left');
    await flush();
    expect(s1.received).toEqual([]);
    expect(s2.received).toEqual(['after-s1-left']);
    expect(typeof result.eventId).toBe('string');
    await s2.sub.unsubscribe();
    const { result: none } = await pub('panel-a', CHANNEL, 'nobody');
    expect(none.eventId).toBeNull();
  });

  it('G4 the doc unsubscribe idiom `subscription.then(s => s.unsubscribe())` works on both subscribe kinds', async () => {
    // [D1] unsubscribe example — both `subscribe` and `subscribeGlobal` promises
    //      are unsubscribed via `.then(s => s.unsubscribe())`.
    sim.currentModuleKey = 'panel-a';
    const scoped: unknown[] = [];
    const global: unknown[] = [];
    const subscription = rt.subscribe(CHANNEL, (p) => { scoped.push(p); });
    const globalSubscription = rt.subscribeGlobal('g-chan', (p) => { global.push(p); });
    await Promise.all([subscription, globalSubscription]);
    sim.currentModuleKey = undefined;
    await Promise.all([subscription.then((s) => s.unsubscribe()), globalSubscription.then((s) => s.unsubscribe())]);
    await pub('panel-a', CHANNEL, 'x');
    await pubGlobal('panel-a', 'g-chan', 'y');
    await flush();
    expect(scoped).toEqual([]);
    expect(global).toEqual([]);
  });
});
