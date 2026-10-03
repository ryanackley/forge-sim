/**
 * Realtime channel-key PARITY tests.
 *
 * Every expectation below is derived from Atlassian's published Realtime
 * contract — the real `@forge/bridge` typings shipped in node_modules and the
 * Forge developer docs — NOT from forge-sim's implementation. Where current
 * forge-sim disagrees, the test is wrapped in `it(...)` and annotated
 * with `// FIXED 2026-10-02 (was PARITY GAP):` so the suite stays green while the gap stays loud.
 * Fixing the gap makes the `it.fails` test "unexpectedly pass", which is the
 * prompt to drop the wrapper.
 *
 * Sources of truth (priority order):
 *
 *  T1  node_modules/@forge/bridge/out/realtime/productContext.d.ts
 *        ProductContext = Jira | Confluence | Bitbucket, i.e. exactly
 *        'board' | 'issue' | 'project' | 'content' | 'space' |
 *        'repository' | 'pullRequest'. Read at runtime (see
 *        `realProductContextValues()`), so if Atlassian adds a value the
 *        pin moves with the package rather than with this file.
 *  T2  node_modules/@forge/bridge/out/realtime/realtime.d.ts
 *        SubscriptionOptions { replaySeconds?; token?; contextOverrides?: ProductContext[] }
 *        PublishOptions      { token?; contextOverrides?: ProductContext[] }
 *        PublishResult       { eventId?: string|null; eventTimestamp?: string|null; errors?: string[] }
 *
 *  D1  https://developer.atlassian.com/platform/forge/realtime/authorizing-realtime-channels
 *        - default channel context = module + product context
 *        - "Providing `contextOverrides` will completely override the default
 *          channel context. If it's provided as an empty array, then the
 *          channel will not be secured by any Atlassian app context values,
 *          and will be equivalent to a global channel."
 *        - "The properties in `contextOverrides` must match exactly in the
 *          `subscribe()` and `publish()` calls in order for messages to be
 *          received." Subscriber `[Jira.Project]` does NOT receive from
 *          publisher `[Jira.Project, Jira.Issue]`.
 *        - "create channels that exist across different modules or pages"
 *        - "`contextOverrides` is only supported for functions invoked from
 *          the app frontend ... not currently available for async events and
 *          web triggers."
 *        - permissions table: ['subscribe'] → publish Blocked;
 *          ['publish'] → subscribe Blocked; omitted → both Allowed.
 *  D2  https://developer.atlassian.com/platform/forge/apis-reference/ui-api-bridge/realtime/
 *        - token: "The subscription will only receive events that have been
 *          published with a token containing the same channel context claims."
 *        - eventTimestamp: "The timestamp of the published event, in epoch
 *          milliseconds."
 *  D3  https://developer.atlassian.com/platform/forge/runtime-reference/realtime-events-api/
 *        - "The resulting `eventId` and `eventTimestamp` will be null if there
 *          are no existing subscribers."
 *        - signRealtimeToken(channelName, claims, permissions?) ;
 *          TokenResult { token: string|null; expiresAt: number|null; errors?: any[] }
 *        - "events sent by the `publish` API can only be received by
 *          subscriptions created using the `subscribe` @forge/bridge API, and
 *          `publishGlobal` events can only be received by subscriptions
 *          created using the `subscribeGlobal` bridge API."
 *  D4  https://developer.atlassian.com/platform/forge/realtime/error-handling-for-realtime-methods/
 *        - publish → PublishResult { eventId: string|null; eventTimestamp: string|null; errors: RealtimeError[] }
 *          with `errors.map(e => e.message)`
 *        - subscribe → rejected Promise on error
 *        - 'Realtime token validation failed: MISSING_PERMISSION'
 *        - 'Realtime token validation failed: CHANNEL_NAME_MISMATCH'
 *        - 'Unauthorized request'
 *
 * Doc-vs-doc contradictions we noticed (flagged in the relevant tests):
 *  C1  `PublishResult.errors` is `string[]` in T2, `any[]` in D2/D3, and
 *      `RealtimeError[]` (objects with `.message`) in D4. D4 is the only one
 *      with executable example code, so we pin D4.
 *  C2  `TokenResult.errors` is optional (`errors?: any[]`) in D3 but required
 *      (`errors: RealtimeError[]`) in D4.
 *  C3  `Subscription.unsubscribe` is `() => void` in D2 but
 *      `() => Promise<void>` in T2.
 *  C4  D1 says `contextOverrides: []` is "equivalent to a global channel"
 *      while D3 says `publish` events can ONLY reach `subscribe`
 *      subscriptions (never `subscribeGlobal`). Whether `publish(ch, p,
 *      { contextOverrides: [] })` lands on `subscribeGlobal(ch)` is
 *      therefore unsettled; we document current behaviour only.
 *
 * Also pinned here (promised by the header of src/realtime-channel-key.ts
 * and its renderer mirror): the canonical key builder and the browser mirror
 * produce identical keys over a matrix of inputs.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SimulatedRealtime, type RealtimeInvocationContext, type PublishResult } from '../realtime.js';
import * as canonical from '../realtime-channel-key.js';
import * as mirror from '../../renderer/src/bridge/channel-key.js';
import { createSimulator, ForgeSimulator } from '../simulator.js';

// ── Source-of-truth helpers ────────────────────────────────────────────────

const REAL_PRODUCT_CONTEXT_DTS = resolve(
  import.meta.dirname,
  '../../node_modules/@forge/bridge/out/realtime/productContext.d.ts',
);

/** The exact set of ProductContext string values declared by the real @forge/bridge typings (T1). */
function realProductContextValues(): string[] {
  const src = readFileSync(REAL_PRODUCT_CONTEXT_DTS, 'utf8');
  const values = [...src.matchAll(/=\s*"([A-Za-z]+)"/g)].map((m) => m[1]);
  if (values.length === 0) throw new Error('could not parse ProductContext enum values from real typings');
  return values;
}

// Named constants mirroring the real enums so the tests read like app code.
const Jira = { Board: 'board', Issue: 'issue', Project: 'project' } as const;
const Confluence = { Content: 'content', Space: 'space' } as const;
const Bitbucket = { Repository: 'repository', PullRequest: 'pullRequest' } as const;

/** Error messages exactly as published in D4. */
const ERR = {
  missingPermission: 'Realtime token validation failed: MISSING_PERMISSION',
  channelMismatch: 'Realtime token validation failed: CHANNEL_NAME_MISMATCH',
  unauthorized: 'Unauthorized request',
};

// ── Fixture ────────────────────────────────────────────────────────────────

describe('Realtime channel-key parity (docs + real typings vs forge-sim)', () => {
  let rt: SimulatedRealtime;
  let invocationContext: RealtimeInvocationContext | null;

  /** Run subsequent backend publish() calls as a frontend-invoked resolver for `moduleKey`. */
  const asResolver = (moduleKey: string) => {
    invocationContext = { kind: 'resolver', moduleKey };
  };

  beforeEach(() => {
    invocationContext = null;
    rt = new SimulatedRealtime(undefined, () => invocationContext);
  });

  // ────────────────────────────────────────────────────────────────────────
  // 0. The real typings say what they say (guards the derivation itself)
  // ────────────────────────────────────────────────────────────────────────

  describe('real @forge/bridge typings (T1, T2)', () => {
    it('ProductContext is exactly board|issue|project|content|space|repository|pullRequest', () => {
      expect(realProductContextValues().sort()).toEqual(
        ['board', 'content', 'issue', 'project', 'pullRequest', 'repository', 'space'],
      );
    });

    it('the enum is grouped as Jira / Confluence / Bitbucket with the documented members', () => {
      const src = readFileSync(REAL_PRODUCT_CONTEXT_DTS, 'utf8');
      expect(src).toMatch(/enum Jira\s*\{[^}]*Board = "board"[^}]*Issue = "issue"[^}]*Project = "project"/s);
      expect(src).toMatch(/enum Confluence\s*\{[^}]*Content = "content"[^}]*Space = "space"/s);
      expect(src).toMatch(/enum Bitbucket\s*\{[^}]*Repository = "repository"[^}]*PullRequest = "pullRequest"/s);
      expect(src).toMatch(/type ProductContext = Jira \| Confluence \| Bitbucket/);
    });

    it('SubscriptionOptions / PublishOptions type contextOverrides as ProductContext[] (not string[])', () => {
      const src = readFileSync(
        resolve(import.meta.dirname, '../../node_modules/@forge/bridge/out/realtime/realtime.d.ts'),
        'utf8',
      );
      expect(src).toMatch(/interface SubscriptionOptions \{[^}]*contextOverrides\?: ProductContext\[\]/s);
      expect(src).toMatch(/interface PublishOptions \{[^}]*contextOverrides\?: ProductContext\[\]/s);
      // C1: the bridge typings claim errors?: string[]; D4 (with runnable code) says RealtimeError[].
      expect(src).toMatch(/interface PublishResult \{[^}]*eventTimestamp\?: string \| null;[^}]*errors\?: string\[\]/s);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 1. contextOverrides accepts only ProductContext names
  // ────────────────────────────────────────────────────────────────────────

  describe('contextOverrides value domain (T1, D1)', () => {
    it.each(realProductContextValues())(
      'every real ProductContext value (%s) is accepted: matching subscriber and publisher meet',
      async (ctx) => {
        const received: unknown[] = [];
        rt.subscribe('ch', (p) => received.push(p), 'jira:issuePanel', { contextOverrides: [ctx] });

        asResolver('jira:issuePanel');
        const result = await rt.publish('ch', { ctx }, { contextOverrides: [ctx] });

        expect(result.errors).toBeUndefined();
        expect(received).toEqual([{ ctx }]);
      },
    );

    // FIXED 2026-10-02 (was PARITY GAP): T1/T2 type `contextOverrides` as `ProductContext[]`; forge-sim
    // widens it to `string[]` (src/realtime.ts:25 `contextOverrides?: string[]`
    // and src/realtime.ts:70) and performs no runtime validation, so a value
    // that the real package rejects at compile time is silently folded into
    // the channel key by overridesSegment() (src/realtime-channel-key.ts:62-65)
    // and a bogus subscriber/publisher pair happily "meet". Per D4 the
    // rejection surface for subscribe is a rejected Promise and for publish a
    // non-empty `errors` array; forge-sim produces neither.
    it('a non-ProductContext override such as "bogus" is not silently accepted', async () => {
      const received: unknown[] = [];
      let subscribeThrew = false;
      try {
        rt.subscribe('ch', (p) => received.push(p), 'jira:issuePanel', { contextOverrides: ['bogus'] });
      } catch {
        subscribeThrew = true;
      }

      asResolver('jira:issuePanel');
      const result = await rt.publish('ch', 'x', { contextOverrides: ['bogus'] });

      const publishRejected = (result.errors?.length ?? 0) > 0 && result.eventId === null;
      expect(subscribeThrew || publishRejected).toBe(true);
      expect(received).toHaveLength(0);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 2. contextOverrides: [] means the global plane
  // ────────────────────────────────────────────────────────────────────────

  describe('contextOverrides: [] is the global (context-free) plane (D1)', () => {
    it('subscriber [] and publisher [] meet even across different modules', async () => {
      const received: unknown[] = [];
      rt.subscribe('ch', (p) => received.push(p), 'jira:issuePanel', { contextOverrides: [] });

      asResolver('jira:issueContext');
      const result = await rt.publish('ch', 'no-context', { contextOverrides: [] });

      expect(result.eventId).not.toBeNull();
      expect(received).toEqual(['no-context']);
    });

    it('[] is distinct from undefined: a default-scoped publish does not reach an [] subscriber', async () => {
      const received: unknown[] = [];
      rt.subscribe('ch', (p) => received.push(p), 'jira:issuePanel', { contextOverrides: [] });

      asResolver('jira:issuePanel');
      await rt.publish('ch', 'default-scoped');

      expect(received).toHaveLength(0);
    });

    it('[] is distinct from a non-empty override: [Jira.Project] publisher does not reach an [] subscriber', async () => {
      const received: unknown[] = [];
      rt.subscribe('ch', (p) => received.push(p), 'jira:issuePanel', { contextOverrides: [] });

      asResolver('jira:issuePanel');
      await rt.publish('ch', 'project-scoped', { contextOverrides: [Jira.Project] });

      expect(received).toHaveLength(0);
    });

    // UNSETTLED (C4): D1 says [] is "equivalent to a global channel"; D3 says
    // publish() events can only reach subscribe() subscriptions. The docs do
    // not say whether publish(ch, p, { contextOverrides: [] }) is literally the
    // same channel as publishGlobal(ch). forge-sim currently routes [] onto
    // the same key as subscribeGlobal (src/realtime-channel-key.ts:121-123).
    // This test documents that choice; it is NOT a doc claim.
    it('documents current behaviour: publish with [] lands on subscribeGlobal subscribers (unsettled by docs)', async () => {
      const received: unknown[] = [];
      rt.subscribeGlobal('ch', (p) => received.push(p));

      asResolver('jira:issuePanel');
      await rt.publish('ch', 'crossed-planes', { contextOverrides: [] });

      expect(received).toEqual(['crossed-planes']);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 3. Mismatched overrides never meet; matching ones do
  // ────────────────────────────────────────────────────────────────────────

  describe('contextOverrides must match exactly (D1)', () => {
    it('doc example: subscriber [Jira.Project] does NOT receive from publisher [Jira.Project, Jira.Issue]', async () => {
      const received: unknown[] = [];
      rt.subscribe('ch', (p) => received.push(p), 'jira:issuePanel', { contextOverrides: [Jira.Project] });

      asResolver('jira:issuePanel');
      const result = await rt.publish('ch', 'narrower', { contextOverrides: [Jira.Project, Jira.Issue] });

      expect(received).toHaveLength(0);
      // D3: no subscribers on that channel context → eventId/eventTimestamp null.
      expect(result.eventId).toBeNull();
      expect(result.eventTimestamp).toBeNull();
    });

    it('the reverse is also blocked: broader publisher does not reach a narrower subscriber', async () => {
      const received: unknown[] = [];
      rt.subscribe('ch', (p) => received.push(p), 'jira:issuePanel', {
        contextOverrides: [Jira.Project, Jira.Issue],
      });

      asResolver('jira:issuePanel');
      await rt.publish('ch', 'broader', { contextOverrides: [Jira.Project] });

      expect(received).toHaveLength(0);
    });

    it('overrides completely replace the default context: default subscriber does not receive [Jira.Issue] publish', async () => {
      const received: unknown[] = [];
      rt.subscribe('ch', (p) => received.push(p), 'jira:issuePanel');

      asResolver('jira:issuePanel');
      await rt.publish('ch', 'overridden', { contextOverrides: [Jira.Issue] });

      expect(received).toHaveLength(0);
    });

    it('identical overrides meet (same module)', async () => {
      const received: unknown[] = [];
      rt.subscribe('ch', (p) => received.push(p), 'jira:issuePanel', {
        contextOverrides: [Jira.Project, Jira.Issue],
      });

      asResolver('jira:issuePanel');
      await rt.publish('ch', 'exact', { contextOverrides: [Jira.Project, Jira.Issue] });

      expect(received).toEqual(['exact']);
    });

    it('cross-product overrides never meet: [Confluence.Space] vs [Jira.Project]', async () => {
      const received: unknown[] = [];
      rt.subscribe('ch', (p) => received.push(p), 'confluence:contentAction', {
        contextOverrides: [Confluence.Space],
      });

      asResolver('confluence:contentAction');
      await rt.publish('ch', 'wrong-product', { contextOverrides: [Jira.Project] });

      expect(received).toHaveLength(0);
    });

    // FIXED 2026-10-02 (was PARITY GAP): D1 — "Providing `contextOverrides` will completely override
    // the default channel context" and overrides let you "create channels
    // that exist across different modules or pages"; the worked example is a
    // channel "scoped to the current Jira project" where "messages can be
    // published between different issues and boards in the project". The
    // module identity is part of the DEFAULT context that overrides replace.
    // forge-sim's scopedChannelKey() (src/realtime-channel-key.ts:95-104)
    // still prefixes the module key even when overrides are present
    // (`['scoped', escapeSegment(moduleKey), ctx(...), channel]`), so an
    // issue panel and an issue context on the same project never meet.
    it('identical overrides meet ACROSS modules: [Jira.Project] in jira:issuePanel hears [Jira.Project] from jira:issueContext', async () => {
      const received: unknown[] = [];
      rt.subscribe('ch', (p) => received.push(p), 'jira:issuePanel', { contextOverrides: [Jira.Project] });

      asResolver('jira:issueContext');
      const result = await rt.publish('ch', 'same-project', { contextOverrides: [Jira.Project] });

      expect(result.eventId).not.toBeNull();
      expect(received).toEqual(['same-project']);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 4. Ordering of contextOverrides — unsettled by the docs
  // ────────────────────────────────────────────────────────────────────────

  describe('ordering of contextOverrides (UNSETTLED — documents current behaviour only)', () => {
    // D1 says the properties "must match exactly" but never says whether
    // [Jira.Project, Jira.Issue] and [Jira.Issue, Jira.Project] are the same
    // channel. forge-sim chose set semantics (dedupe + sort) — see the
    // ASSUMPTION note in src/realtime-channel-key.ts:54-61. This test pins
    // the CURRENT choice so a future change is deliberate; it is not a doc
    // claim in either direction.
    it('currently treats [Project, Issue] and [Issue, Project] as the same channel (set semantics)', async () => {
      const received: unknown[] = [];
      rt.subscribe('ch', (p) => received.push(p), 'jira:issuePanel', {
        contextOverrides: [Jira.Project, Jira.Issue],
      });

      asResolver('jira:issuePanel');
      await rt.publish('ch', 'reordered', { contextOverrides: [Jira.Issue, Jira.Project] });

      expect(received).toEqual(['reordered']);
    });

    it('currently treats duplicate entries as a single dimension: [Issue, Issue] == [Issue]', async () => {
      const received: unknown[] = [];
      rt.subscribe('ch', (p) => received.push(p), 'jira:issuePanel', { contextOverrides: [Jira.Issue] });

      asResolver('jira:issuePanel');
      await rt.publish('ch', 'deduped', { contextOverrides: [Jira.Issue, Jira.Issue] });

      expect(received).toEqual(['deduped']);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 5. ':' in module keys / channel names must not collide
  // ────────────────────────────────────────────────────────────────────────

  describe("':' in module keys and channel names does not create collisions", () => {
    it("key builder: ('a', 'b:c') !== ('a:b', 'c')", () => {
      expect(canonical.scopedChannelKey('a', 'b:c')).not.toBe(canonical.scopedChannelKey('a:b', 'c'));
    });

    it("key builder: overrides segment cannot be forged from a channel name", () => {
      const genuine = canonical.scopedChannelKey('jira:issuePanel', 'ch', [Jira.Project]);
      const forged = canonical.scopedChannelKey('jira:issuePanel', 'ctx(project):ch');
      expect(forged).not.toBe(genuine);
    });

    it("key builder: a backslash before ':' cannot be used to re-introduce an unescaped separator", () => {
      // 'a\' + ':b' vs 'a\:b' as one segment — the escaping must keep these distinct.
      expect(canonical.scopedChannelKey('a\\', ':b')).not.toBe(canonical.scopedChannelKey('a\\:b', ''));
      expect(canonical.scopedChannelKey('a\\', 'b')).not.toBe(canonical.scopedChannelKey('a', '\\b'));
    });

    it("key builder: global 'x:y' and scoped module 'x' channel 'y' are different keys", () => {
      expect(canonical.globalChannelKey('x:y')).not.toBe(canonical.scopedChannelKey('x', 'y'));
      expect(canonical.globalChannelKey('global:y')).not.toBe(canonical.globalChannelKey('y'));
    });

    it("end-to-end: subscriber (module 'a', channel 'b:c') does not hear publisher (module 'a:b', channel 'c')", async () => {
      const received: unknown[] = [];
      rt.subscribe('b:c', (p) => received.push(p), 'a');

      asResolver('a:b');
      const result = await rt.publish('c', 'collision?');

      expect(received).toHaveLength(0);
      expect(result.eventId).toBeNull();
    });

    it("end-to-end: every real Forge module key contains ':' and still round-trips", async () => {
      const received: unknown[] = [];
      rt.subscribe('my:channel', (p) => received.push(p), 'jira:issuePanel');

      asResolver('jira:issuePanel');
      await rt.publish('my:channel', 'ok');

      expect(received).toEqual(['ok']);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 5b. Canonical key builder and the renderer mirror agree
  // ────────────────────────────────────────────────────────────────────────

  describe('canonical src/realtime-channel-key.ts == renderer/src/bridge/channel-key.ts mirror', () => {
    const modules = ['jira:issuePanel', 'a', 'a:b', 'with\\back', 'ctx(project)', ''];
    const channels = ['ch', 'b:c', 'c', 'global:ch', 'ctx(project):ch', '\\', ''];
    const overrideSets: Array<readonly string[] | undefined> = [
      undefined,
      [],
      [Jira.Project],
      [Jira.Project, Jira.Issue],
      [Jira.Issue, Jira.Project],
      [Confluence.Space, Confluence.Content, Confluence.Space],
      [Bitbucket.PullRequest],
      ['bo:gus'],
    ];

    it('scopedChannelKey matches over the full matrix', () => {
      for (const m of modules) for (const c of channels) for (const o of overrideSets) {
        expect(mirror.scopedChannelKey(m, c, o)).toBe(canonical.scopedChannelKey(m, c, o));
      }
    });

    it('channelKeyFor matches over the full matrix, including null module', () => {
      for (const m of [...modules, null, undefined]) for (const c of channels) for (const o of overrideSets) {
        expect(mirror.channelKeyFor(m, c, o)).toBe(canonical.channelKeyFor(m, c, o));
      }
    });

    it('globalChannelKey and isGlobalByEmptyOverrides match', () => {
      for (const c of channels) expect(mirror.globalChannelKey(c)).toBe(canonical.globalChannelKey(c));
      for (const o of overrideSets) {
        expect(mirror.isGlobalByEmptyOverrides(o)).toBe(canonical.isGlobalByEmptyOverrides(o));
      }
    });

    it('the mirror body is byte-identical to the canonical body below the header', () => {
      const strip = (s: string) => s.slice(s.indexOf("const SEP = ':';"));
      const canonicalSrc = readFileSync(resolve(import.meta.dirname, '../realtime-channel-key.ts'), 'utf8');
      const mirrorSrc = readFileSync(resolve(import.meta.dirname, '../../renderer/src/bridge/channel-key.ts'), 'utf8');
      expect(strip(mirrorSrc)).toBe(strip(canonicalSrc));
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 6. Realtime tokens: claims matching and subscribe/publish permissions
  // ────────────────────────────────────────────────────────────────────────

  describe('realtime tokens (D1 permissions table, D2 claims, D4 error strings)', () => {
    it('TokenResult: token is a string, expiresAt is epoch SECONDS in the future (D3)', async () => {
      const before = Math.floor(Date.now() / 1000);
      const { token, expiresAt, errors } = await rt.signRealtimeToken('ch', { a: 1 });

      expect(typeof token).toBe('string');
      expect(typeof expiresAt).toBe('number');
      // Seconds, not milliseconds: must be within a day of now when read as seconds.
      expect(expiresAt!).toBeGreaterThan(before);
      expect(expiresAt!).toBeLessThan(before + 60 * 60 * 24);
      // C2: D3 says errors is optional, D4 says required. Either way, if present it is an array.
      if (errors !== undefined) expect(Array.isArray(errors)).toBe(true);
    });

    it('signRealtimeToken accepts the documented third `permissions` argument without erroring (D3)', async () => {
      const r = await (rt.signRealtimeToken as any)('ch', {}, ['subscribe']);
      expect(r.token).not.toBeNull();
      expect(r.errors ?? []).toEqual([]);
    });

    // FIXED 2026-10-02 (was PARITY GAP): D2 — "The subscription will only receive events that have
    // been published with a token containing the same channel context
    // claims." forge-sim ignores `options.token` entirely: addSubscriber()
    // (src/realtime.ts) never folds the token into the key and the header
    // comment at src/realtime.ts:13-14 admits "Token-based channel
    // authorization is accepted but not enforced".
    it('a subscriber with token claims {room:1} does not hear a publisher with claims {room:2}', async () => {
      const { token: sub } = await rt.signRealtimeToken('ch', { room: 1 });
      const { token: pub } = await rt.signRealtimeToken('ch', { room: 2 });
      const received: unknown[] = [];
      rt.subscribeGlobal('ch', (p) => received.push(p), { token: sub! });

      await rt.publishGlobal('ch', 'other-room', { token: pub! });

      expect(received).toHaveLength(0);
    });

    // FIXED 2026-10-02 (was PARITY GAP): same root cause as above (token never participates in
    // channel identity). D1: "If using the subscribeGlobal and publishGlobal
    // methods, the channel is only secured by the token" — so a token-less
    // subscriber must not hear a token-secured publish.
    it('a token-less subscriber does not hear a token-secured publishGlobal', async () => {
      const { token } = await rt.signRealtimeToken('ch', { secret: true });
      const received: unknown[] = [];
      rt.subscribeGlobal('ch', (p) => received.push(p));

      await rt.publishGlobal('ch', 'secured', { token: token! });

      expect(received).toHaveLength(0);
    });

    it('matching token claims on both sides meet', async () => {
      const { token: sub } = await rt.signRealtimeToken('ch', { room: 1 });
      const { token: pub } = await rt.signRealtimeToken('ch', { room: 1 });
      const received: unknown[] = [];
      rt.subscribeGlobal('ch', (p) => received.push(p), { token: sub! });

      const result = await rt.publishGlobal('ch', 'same-room', { token: pub! });

      expect(result.errors).toBeUndefined();
      expect(received).toEqual(['same-room']);
    });

    // FIXED 2026-10-02 (was PARITY GAP): D1 permissions table — ['subscribe'] → Publish "Blocked";
    // D4 — publish returns PublishResult with errors[].message
    // 'Realtime token validation failed: MISSING_PERMISSION'. forge-sim's
    // signRealtimeToken (src/realtime.ts:192 and the shim at
    // src/shims/forge-realtime.ts:27) takes only (channel, claims) — the
    // permissions argument is dropped — and publish never validates tokens.
    it("publish with a ['subscribe']-only token returns MISSING_PERMISSION and delivers nothing", async () => {
      const { token } = await (rt.signRealtimeToken as any)('ch', {}, ['subscribe']);
      const received: unknown[] = [];
      rt.subscribeGlobal('ch', (p) => received.push(p), { token });

      const result = await rt.publishGlobal('ch', 'should-be-blocked', { token });

      expect(result.eventId).toBeNull();
      expect(result.eventTimestamp).toBeNull();
      expect(result.errors!.map((e) => e.message)).toEqual([ERR.missingPermission]);
      expect(received).toHaveLength(0);
    });

    // FIXED 2026-10-02 (was PARITY GAP): D1 permissions table — ['publish'] → Subscribe "Blocked";
    // D4 — subscribe "returns a rejected Promise on error" with
    // error.message 'Realtime token validation failed: MISSING_PERMISSION'.
    // forge-sim's subscribe/subscribeGlobal always succeed.
    it("subscribe with a ['publish']-only token is rejected with MISSING_PERMISSION", async () => {
      const { token } = await (rt.signRealtimeToken as any)('ch', {}, ['publish']);

      await expect(
        (async () => rt.subscribeGlobal('ch', () => {}, { token }))(),
      ).rejects.toThrow(ERR.missingPermission);
    });

    it("a ['subscribe','publish'] token allows both directions (D1 table row 2)", async () => {
      const { token } = await (rt.signRealtimeToken as any)('ch', {}, ['subscribe', 'publish']);
      const received: unknown[] = [];
      rt.subscribeGlobal('ch', (p) => received.push(p), { token });

      const result = await rt.publishGlobal('ch', 'both', { token });

      expect(result.errors).toBeUndefined();
      expect(received).toEqual(['both']);
    });

    // FIXED 2026-10-02 (was PARITY GAP): D4 — 'Realtime token validation failed: CHANNEL_NAME_MISMATCH'
    // when "the token was signed for a different channel". forge-sim bakes the
    // channel into the fake token string but never checks it on publish.
    it('publish with a token signed for a different channel returns CHANNEL_NAME_MISMATCH', async () => {
      const { token } = await rt.signRealtimeToken('other-channel', {});
      rt.subscribeGlobal('ch', () => {});

      const result = await rt.publishGlobal('ch', 'wrong-channel', { token: token! });

      expect(result.eventId).toBeNull();
      expect(result.errors!.map((e) => e.message)).toEqual([ERR.channelMismatch]);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 7. Backend contextOverrides: allowed from frontend-invoked resolvers only
  // ────────────────────────────────────────────────────────────────────────

  describe('backend contextOverrides are frontend-invocation-only (D1 limitations, D3)', () => {
    it('a frontend-invoked resolver MAY publish with contextOverrides (same module)', async () => {
      const received: unknown[] = [];
      rt.subscribe('ch', (p) => received.push(p), 'jira:issuePanel', { contextOverrides: [Jira.Project] });

      asResolver('jira:issuePanel');
      const result = await rt.publish('ch', 'from-resolver', { contextOverrides: [Jira.Project] });

      expect(result.errors).toBeUndefined();
      expect(received).toEqual(['from-resolver']);
    });

    it.each(['trigger', 'scheduledTrigger', 'webTrigger', 'consumer'] as const)(
      'publish with contextOverrides from a %s is Unauthorized request (never delivered)',
      async (kind) => {
        const received: unknown[] = [];
        rt.subscribe('ch', (p) => received.push(p), 'jira:issuePanel', { contextOverrides: [Jira.Project] });
        invocationContext = { kind, moduleKey: null };

        const result = await rt.publish('ch', 'async-ctx', { contextOverrides: [Jira.Project] });

        expect(result.eventId).toBeNull();
        expect(result.errors!.map((e) => e.message)).toEqual([ERR.unauthorized]);
        expect(received).toHaveLength(0);
      },
    );

    it.each(['trigger', 'scheduledTrigger', 'webTrigger', 'consumer'] as const)(
      'contextOverrides: [] from a %s is NOT a loophole onto the global plane',
      async (kind) => {
        const received: unknown[] = [];
        rt.subscribeGlobal('ch', (p) => received.push(p));
        rt.subscribe('ch', (p) => received.push(p), 'jira:issuePanel', { contextOverrides: [] });
        invocationContext = { kind, moduleKey: null };

        const result = await rt.publish('ch', 'loophole?', { contextOverrides: [] });

        expect(result.errors!.map((e) => e.message)).toEqual([ERR.unauthorized]);
        expect(received).toHaveLength(0);
      },
    );
  });

  // ────────────────────────────────────────────────────────────────────────
  // 8. PublishResult shape
  // ────────────────────────────────────────────────────────────────────────

  describe('PublishResult shape (T2, D2, D3, D4)', () => {
    const shapeOf = (r: PublishResult) => ({
      keys: Object.keys(r).sort(),
      eventIdType: r.eventId === null ? 'null' : typeof r.eventId,
      eventTimestampType: r.eventTimestamp === null ? 'null' : typeof r.eventTimestamp,
      errorsIsArray: Array.isArray(r.errors),
    });

    it('with a subscriber: eventId is a string, eventTimestamp is a STRING of epoch milliseconds, no errors key (real package omits it on success)', async () => {
      rt.subscribeGlobal('ch', () => {});
      const before = Date.now();
      const result = await rt.publishGlobal('ch', 'x');
      const after = Date.now();

      expect(shapeOf(result)).toEqual({
        keys: ['eventId', 'eventTimestamp'],
        eventIdType: 'string',
        eventTimestampType: 'string',
        errorsIsArray: false,
      });
      expect(result.eventTimestamp).toMatch(/^\d+$/);
      const ms = Number(result.eventTimestamp);
      expect(ms).toBeGreaterThanOrEqual(before);
      expect(ms).toBeLessThanOrEqual(after);
      expect(result.errors).toBeUndefined();
    });

    it('with NO subscriber: eventId and eventTimestamp are null and there is no errors key (D3 — not an error)', async () => {
      const result = await rt.publishGlobal('nobody-home', 'x');

      expect(result).toEqual({ eventId: null, eventTimestamp: null });
    });

    it('on error: eventId and eventTimestamp are null and errors is a non-empty list of { message } (D4 shape; success omits the key per the real package)', async () => {
      invocationContext = { kind: 'consumer', moduleKey: null };
      const result = await rt.publish('ch', 'x');

      expect(result.eventId).toBeNull();
      expect(result.eventTimestamp).toBeNull();
      expect(result.errors!.length).toBeGreaterThan(0);
      for (const e of result.errors!) {
        expect(typeof e).toBe('object');
        expect(typeof e.message).toBe('string');
      }
      // D4 example code: result.errors.map(e => e.message)
      expect(result.errors!.map((e) => e.message)).toEqual([ERR.unauthorized]);
    });

    it('scoped publish and publishGlobal return the same shape (D4: "This is the same for publishGlobal")', async () => {
      rt.subscribeGlobal('g', () => {});
      rt.subscribe('s', () => {}, 'jira:issuePanel');
      asResolver('jira:issuePanel');

      const g = await rt.publishGlobal('g', 'x');
      const s = await rt.publish('s', 'x');

      expect(shapeOf(g)).toEqual(shapeOf(s));
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // 9. Planes are disjoint even when the module key is unknown
  // ────────────────────────────────────────────────────────────────────────

  describe('scoped/global planes are disjoint (D3)', () => {
    it('subscribeGlobal does not hear a scoped publish; subscribe does not hear publishGlobal', async () => {
      const g: unknown[] = [];
      const s: unknown[] = [];
      rt.subscribeGlobal('ch', (p) => g.push(p));
      rt.subscribe('ch', (p) => s.push(p), 'jira:issuePanel');

      asResolver('jira:issuePanel');
      await rt.publish('ch', 'scoped');
      await rt.publishGlobal('ch', 'global');

      expect(s).toEqual(['scoped']);
      expect(g).toEqual(['global']);
    });

    // FIXED 2026-10-02 (was PARITY GAP): D3 — "`publishGlobal` events can only be received by
    // subscriptions created using the `subscribeGlobal` bridge API". A
    // `subscribe()` call is scoped by definition (D2: "scoped to channels for
    // the current module context by default"); when forge-sim cannot
    // determine the module key it silently widens the subscription onto the
    // global plane (channelKeyFor() fallback, src/realtime-channel-key.ts:
    // 125-127 — the file's own comment calls this "questionable parity"),
    // so a scoped subscriber starts hearing publishGlobal events.
    it('a subscribe() with an unknown module key is rejected (Unauthorized request) and never hears publishGlobal', async () => {
      const received: unknown[] = [];
      // D4: subscribe "returns a rejected Promise on error" — the backend
      // throws synchronously and the async bridge shim turns that into the
      // rejection. The subscription is never registered on any plane.
      expect(() => rt.subscribe('ch', (p) => received.push(p), null)).toThrow(ERR.unauthorized);

      await rt.publishGlobal('ch', 'global-leak');

      expect(received).toHaveLength(0);
      expect(rt.getSubscriptions()).toEqual([]);
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────
// End-to-end through the `@forge/realtime` shim (resolver → simulator)
// ──────────────────────────────────────────────────────────────────────────

const E2E_MANIFEST = `
modules:
  function:
    - key: main-resolver
      handler: index.handler
    - key: hookFn
      handler: index.hookFn
  jira:issuePanel:
    - key: my-panel
      resource: main
      render: native
      title: Realtime Parity Panel
      icon: https://example.com/icon.png
      resolver:
        function: main-resolver
  webtrigger:
    - key: incoming-hook
      function: hookFn
resources:
  - key: main
    path: src/frontend/index.tsx
app:
  id: ari:cloud:ecosystem::app/realtime-parity
  name: Realtime Parity
  runtime:
    name: nodejs22.x
`;

describe('Realtime parity through the @forge/realtime shim (end-to-end)', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    sim = createSimulator();
    sim.loadManifest(E2E_MANIFEST);
    sim.registerModuleRoute('my-panel', { resolverFunctionKey: 'main-resolver', moduleType: 'jira:issuePanel' });
    sim.registerResolverOwnership('pub', 'main-resolver');
  });

  it('resolver publish with contextOverrides reaches a same-module subscriber with identical overrides', async () => {
    const forgeRealtime = await import('@forge/realtime');
    const received: unknown[] = [];
    sim.realtime.subscribe('ch', (p) => received.push(p), 'my-panel', { contextOverrides: [Jira.Issue] });

    sim.resolver.define('pub', async () =>
      forgeRealtime.publish('ch', 'e2e', { contextOverrides: [Jira.Issue] } as any),
    );
    const result: PublishResult = await sim.invoke('pub', {}, { moduleKey: 'my-panel' });

    expect(result.errors).toBeUndefined();
    expect(received).toEqual(['e2e']);
  });

  it('resolver publish with MISMATCHED contextOverrides does not reach the subscriber', async () => {
    const forgeRealtime = await import('@forge/realtime');
    const received: unknown[] = [];
    sim.realtime.subscribe('ch', (p) => received.push(p), 'my-panel', { contextOverrides: [Jira.Issue] });

    sim.resolver.define('pub', async () =>
      forgeRealtime.publish('ch', 'e2e', { contextOverrides: [Jira.Project] } as any),
    );
    const result: PublishResult = await sim.invoke('pub', {}, { moduleKey: 'my-panel' });

    expect(result.eventId).toBeNull();
    expect(received).toHaveLength(0);
  });

  // FIXED 2026-10-02 (was PARITY GAP): same as the unit-level MISSING_PERMISSION test, but proves
  // the gap exists through the user-facing import. The shim's
  // signRealtimeToken signature is (channel, claims) —
  // src/shims/forge-realtime.ts:27-32 — so the documented third
  // `permissions` argument (D3) is dropped before it reaches the simulator.
  it("@forge/realtime: signRealtimeToken(ch, {}, ['subscribe']) token cannot publish (MISSING_PERMISSION)", async () => {
    const forgeRealtime = await import('@forge/realtime');
    sim.realtime.subscribeGlobal('ch', () => {});

    sim.resolver.define('pub', async () => {
      const { token } = await (forgeRealtime.signRealtimeToken as any)('ch', {}, ['subscribe']);
      return forgeRealtime.publishGlobal('ch', 'blocked?', { token });
    });
    const result: PublishResult = await sim.invoke('pub', {}, { moduleKey: 'my-panel' });

    expect(result.eventId).toBeNull();
    expect(result.errors!.map((e) => e.message)).toEqual([ERR.missingPermission]);
  });
});
