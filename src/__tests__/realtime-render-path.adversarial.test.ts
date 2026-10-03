/**
 * Adversarial tests: realtime THROUGH the real UIKit render path.
 *
 * Everything here is derived from Atlassian's published Realtime semantics,
 * NOT from forge-sim's implementation:
 *   - https://developer.atlassian.com/platform/forge/apis-reference/ui-api-bridge/realtime/
 *   - https://developer.atlassian.com/platform/forge/runtime-reference/realtime-events-api/
 *   - https://developer.atlassian.com/platform/forge/realtime/authorizing-realtime-channels
 *
 * The load-bearing quotes:
 *
 *  (1) "Subscriptions created with the `subscribe()` function are scoped to
 *      channels for the current module context by default. This means that a
 *      subscription in a module, for example `jira:issuePanel`, will only
 *      receive messages that are published from the same module in the same
 *      Jira issue. It will not receive messages from a `jira:issueContext` on
 *      that issue, or the `jira:issuePanel` on a different issue, even if they
 *      share the same channel name."
 *
 *  (2) "events sent by the `publish` API can only be received by subscriptions
 *      created using the `subscribe` @forge/bridge API, and `publishGlobal`
 *      events can only be received by subscriptions created using the
 *      `subscribeGlobal` bridge API."   → the two planes are disjoint.
 *
 *  (3) "The properties in `contextOverrides` must match exactly in the
 *      `subscribe()` and `publish()` calls in order for messages to be
 *      received." … "`contextOverrides` does not allow for a subscriber with a
 *      broader context to receive messages from a publisher with a more
 *      specific context. For example, a subscriber with overrides
 *      `[Jira.Project]` will not receive messages from a publisher with
 *      overrides `[Jira.Project, Jira.Issue]`."
 *
 *  (4) "Providing `contextOverrides` will completely override the default
 *      channel context. If it's provided as an empty array, then the channel
 *      will not be secured by any Atlassian app context values, and will be
 *      equivalent to a global channel."
 *
 * The app under test is generated on disk (under the gitignored `.forge-sim/`)
 * so the whole stack runs for real: manifest validation → deploy → bundle →
 * `sim.ui.render()` → React mount → `useEffect` → `@forge/bridge` realtime →
 * SimulatedRealtime → resolver `@forge/realtime` publish.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { resolve, join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { createSimulator, ForgeSimulator } from '../simulator.js';

// ── Generated app ─────────────────────────────────────────────────────────

const APP_DIR = resolve(import.meta.dirname, '../../.forge-sim/test-tmp/realtime-render-path');

const MANIFEST = `modules:
  jira:issuePanel:
    - key: panel-a
      resource: frontend-a
      resolver:
        function: resolver-a
      render: native
      title: Panel A
      icon: https://example.com/icon.png
    - key: panel-b
      resource: frontend-b
      resolver:
        function: resolver-b
      render: native
      title: Panel B
      icon: https://example.com/icon.png
  function:
    - key: resolver-a
      handler: resolver-a.handler
    - key: resolver-b
      handler: resolver-b.handler
resources:
  - key: frontend-a
    path: src/frontend-a.tsx
  - key: frontend-b
    path: src/frontend-b.tsx
app:
  runtime:
    name: nodejs22.x
  id: ari:cloud:ecosystem::app/realtime-render-path
  name: Realtime Render Path
`;

/**
 * One frontend source, parameterized per panel. Reads its behavior from
 * `globalThis.__RT_CFG` at effect time so a single generated bundle can serve
 * every scenario (the bundle is cached by the test runner's module loader).
 *
 * Everything observable is pushed into `globalThis.__RT_SINK` as well as into
 * React state — the sink makes delivery assertions independent of ForgeDoc
 * text matching, while the React state proves the component actually
 * re-rendered on the event.
 */
function frontendSource(panel: 'a' | 'b'): string {
  return `
import ForgeReconciler, { Text, Stack } from '@forge/react';
import { invoke, realtime } from '@forge/bridge';
import { useState, useEffect } from 'react';

const g = globalThis;
const PANEL = '${panel}';

function cfg() {
  const c = g.__RT_CFG || {};
  return c['${panel}'] || {};
}
function sink(name, value) {
  g.__RT_SINK = g.__RT_SINK || {};
  g.__RT_SINK[name] = g.__RT_SINK[name] || [];
  g.__RT_SINK[name].push(value);
}

const Panel = () => {
  const [events, setEvents] = useState([]);
  const [state, setState] = useState('booting');

  useEffect(() => {
    let sub = null;
    let disposed = false;
    sink('mount-' + PANEL, '1');
    (async () => {
      const c = cfg();
      // Optionally await a resolver round-trip BEFORE subscribing, so the
      // subscribe lands well after render() has returned.
      if (c.awaitInvokeFirst) {
        await invoke('slowBoot' + PANEL.toUpperCase(), {});
      }
      const onEvent = (p) => {
        const text = typeof p === 'string' ? p : JSON.stringify(p);
        sink('event-' + PANEL, text);
        setEvents((prev) => prev.concat([text]));
      };
      const channel = c.channel || 'progress';
      if (c.global) {
        sub = await realtime.subscribeGlobal(channel, onEvent, c.options);
      } else {
        sub = await realtime.subscribe(channel, onEvent, c.options);
      }
      sink('subscribed-' + PANEL, channel);
      if (!disposed) setState('subscribed');
    })();
    return () => {
      disposed = true;
      sink('cleanup-' + PANEL, '1');
      if (sub) sub.unsubscribe();
    };
  }, []);

  return (
    <Stack>
      <Text>{PANEL.toUpperCase()}-state:{state}</Text>
      {events.map((e, i) => <Text key={'e' + i}>{PANEL.toUpperCase()}-event:{e}</Text>)}
    </Stack>
  );
};

ForgeReconciler.render(<Panel />);
`;
}

function resolverSource(panel: 'a' | 'b'): string {
  const U = panel.toUpperCase();
  return `
import Resolver from '@forge/resolver';
import { publish, publishGlobal } from '@forge/realtime';

const resolver = new Resolver();

resolver.define('slowBoot${U}', async () => {
  await new Promise((r) => setTimeout(r, 120));
  return 'booted';
});

resolver.define('publishFrom${U}', async (req) => {
  const p = (req && req.payload) || {};
  const channel = p.channel || 'progress';
  const message = p.message === undefined ? 'from-${panel}' : p.message;
  if (p.global) {
    return publishGlobal(channel, message, p.options);
  }
  return publish(channel, message, p.options);
});

export const handler = resolver.getDefinitions();
`;
}

function writeApp(): void {
  rmSync(APP_DIR, { recursive: true, force: true });
  mkdirSync(join(APP_DIR, 'src'), { recursive: true });
  writeFileSync(join(APP_DIR, 'manifest.yml'), MANIFEST);
  writeFileSync(join(APP_DIR, 'src/frontend-a.tsx'), frontendSource('a'));
  writeFileSync(join(APP_DIR, 'src/frontend-b.tsx'), frontendSource('b'));
  writeFileSync(join(APP_DIR, 'src/resolver-a.ts'), resolverSource('a'));
  writeFileSync(join(APP_DIR, 'src/resolver-b.ts'), resolverSource('b'));
}

// ── Sink / config helpers ─────────────────────────────────────────────────

type PanelCfg = {
  channel?: string;
  global?: boolean;
  options?: Record<string, unknown>;
  awaitInvokeFirst?: boolean;
};

const G = globalThis as any;

function setCfg(cfg: { a?: PanelCfg; b?: PanelCfg }): void {
  G.__RT_CFG = cfg;
}
function resetSink(): void {
  G.__RT_SINK = {};
}
function sink(name: string): string[] {
  return (G.__RT_SINK?.[name] ?? []) as string[];
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Channel keys currently registered in SimulatedRealtime. */
function subscriptionKeys(sim: ForgeSimulator): string[] {
  return sim.realtime.getSubscriptions().map((s) => s.channelKey).sort();
}

/**
 * Poll the sink until `name` has at least `count` entries. Used instead of
 * `sim.ui.waitForContent()` where the doc-tagging path is itself under
 * suspicion (it keys on the same global activeModuleKey slot).
 */
async function waitForSink(name: string, count = 1, timeoutMs = 2000): Promise<string[]> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (sink(name).length >= count) return sink(name);
    await sleep(5);
  }
  throw new Error(`waitForSink: "${name}" never reached ${count} entries; sink=${JSON.stringify(G.__RT_SINK)}`);
}

/**
 * Registry keys whose channel name matches one of `channels` — filters out
 * noise from React trees of earlier tests that are never unmounted.
 */
function keysForChannels(sim: ForgeSimulator, channels: string[]): string[] {
  return subscriptionKeys(sim).filter((k) => channels.some((c) => k.endsWith(':' + c)));
}

// ── Suite ─────────────────────────────────────────────────────────────────

describe('realtime through the UIKit render path (adversarial)', () => {
  let sim: ForgeSimulator;

  beforeAll(() => {
    writeApp();
  });

  afterAll(() => {
    if (existsSync(APP_DIR)) rmSync(APP_DIR, { recursive: true, force: true });
  });

  beforeEach(async () => {
    resetSink();
    setCfg({});
    sim = createSimulator();
    await sim.deploy(APP_DIR);
  });

  // ── Baseline: does the integration path work at all? ───────────────────

  it('delivers a scoped resolver publish to a useEffect subscriber and re-renders the component', async () => {
    setCfg({ a: { channel: 'progress' } });

    await sim.ui.render('panel-a');
    await sim.ui.waitForContent('panel-a', 'A-state:subscribed');

    expect(subscriptionKeys(sim)).toEqual(['scoped:panel-a:progress']);

    const result = await sim.invoke('publishFromA', { message: 'tick-1' });
    expect(result.errors).toBeUndefined();
    expect(result.eventId).toMatch(/^rt-evt-/);

    // Callback fired…
    expect(sink('event-a')).toEqual(['tick-1']);
    // …and the component re-rendered with the payload.
    const doc = await sim.ui.waitForContent('panel-a', 'A-event:tick-1');
    expect(sim.ui.getTextContent(doc)).toContain('A-event:tick-1');
  });

  // ── Race: subscribe-time attribution via the single activeModuleKey slot ──
  //
  // Suspected mechanism (src/ui/simulator-ui.ts ~L907): render() deliberately
  // leaves `activeModuleKey` pointing at the module it just rendered so that
  // post-return useEffect work is attributed to it. But that slot is GLOBAL —
  // one per SimulatorUI — and `@forge/bridge` realtime.subscribe() reads it at
  // SUBSCRIBE time via getCurrentModuleKeyForBridge() (src/shims/forge-bridge.ts
  // ~L545: `sim.currentModuleKey ?? sim.ui.getActiveModule()`).
  //
  // So if panel-a's effect awaits a ~120ms resolver round-trip before it calls
  // subscribe(), and panel-b renders + subscribes in that window, panel-a's
  // subscribe should be keyed under panel-b: `scoped:panel-b:chan-a`.
  //
  // The assertion is deliberately on the SUBSCRIBER REGISTRY's channel keys
  // (sim.realtime.getSubscriptions()), NOT on whether a publish is received:
  // resolveInvocationModuleKey (src/simulator.ts ~L461) falls back to the same
  // slot on the publish side, so publish-side drift could cancel subscribe-side
  // drift and mask the misattribution.
  describe('subscribe-time module attribution race', () => {
    it('attributes a late (post-await) subscribe in panel-a to panel-a, not to the module rendered after it', async () => {
      setCfg({
        a: { channel: 'chan-a', awaitInvokeFirst: true }, // awaits slowBootA (~120ms) THEN subscribes
        b: { channel: 'chan-b' },                          // subscribes immediately on mount
      });

      // Render A; its effect (which fires async, AFTER render() resolves)
      // kicks off invoke('slowBootA') and parks for ~120ms.
      await sim.ui.render('panel-a');
      await waitForSink('mount-a');
      expect(sim.ui.getActiveModule()).toBe('panel-a');
      expect(sink('subscribed-a')).toEqual([]); // still parked on slowBootA

      // Render B WITHOUT waiting for A to subscribe. This overwrites the
      // global activeModuleKey slot with 'panel-b'.
      await sim.ui.render('panel-b');
      await waitForSink('subscribed-b');
      expect(sim.ui.getActiveModule()).toBe('panel-b');
      expect(sink('subscribed-b')).toEqual(['chan-b']);
      expect(sink('subscribed-a')).toEqual([]); // A still parked — B won the race

      // Now let A's slowBoot resolve and its subscribe() land. Poll the sink
      // rather than waitForContent('panel-a') — doc tagging uses the same slot.
      await waitForSink('subscribed-a');
      expect(sink('subscribed-a')).toEqual(['chan-a']);

      // Ordering sanity: A really did subscribe after B.
      const order = Object.entries(G.__RT_SINK as Record<string, string[]>)
        .filter(([k]) => k.startsWith('subscribed-'))
        .map(([k]) => k);
      expect(order).toEqual(['subscribed-b', 'subscribed-a']);

      // THE assertion. Expected per Forge semantics (quote (1) in the header):
      // each subscription is scoped to the module it was created in.
      expect(keysForChannels(sim, ['chan-a', 'chan-b'])).toEqual([
        'scoped:panel-a:chan-a',
        'scoped:panel-b:chan-b',
      ]);
    });

    it('functional impact: the misattributed panel-a subscriber misses its own module\'s publish and receives panel-b\'s', async () => {
      // Same race as above; this shows the misattribution is not cosmetic.
      // The publish side is pinned with an EXPLICIT moduleKey (precedence #1
      // in resolveInvocationModuleKey, src/simulator.ts ~L461) so it cannot
      // drift with the activeModuleKey slot and cancel the subscribe-side
      // drift. (Without the explicit key, deploy() does not populate
      // resolverOwnership, so derivation step 2 is skipped and step 3 reads
      // the same slot — which is exactly how the bug hides.)
      setCfg({
        a: { channel: 'chan-a', awaitInvokeFirst: true },
        b: { channel: 'chan-b' },
      });
      await sim.ui.render('panel-a');
      await waitForSink('mount-a');
      await sim.ui.render('panel-b');
      await waitForSink('subscribed-b');
      await waitForSink('subscribed-a');

      // Forge quote (1): panel-a's subscription must receive panel-a's publish…
      const fromA = await sim.invoke('publishFromA', { channel: 'chan-a', message: 'own-module' }, { moduleKey: 'panel-a' });
      expect(fromA.errors).toBeUndefined();
      expect(sink('event-a')).toEqual(['own-module']);

      // …and must NOT receive a same-channel-name publish from a different module.
      const fromB = await sim.invoke('publishFromB', { channel: 'chan-a', message: 'other-module' }, { moduleKey: 'panel-b' });
      expect(fromB.errors).toBeUndefined();
      expect(sink('event-a')).toEqual(['own-module']);
    });

    it('no masking: with no explicit moduleKey, an unpinned publish is keyed to the resolver\'s owning module, not the active slot', async () => {
      // Historical note (2026-10-02): before the fix this test documented a
      // masking trap — both subscribe and publish read the same global
      // ui.getActiveModule() slot, so a publish from resolver-a landed on
      // scoped:panel-b:chan-a, exactly where the misattributed subscriber
      // sat, and delivery "worked" end-to-end. Two fixes closed it:
      //   1. deploy() no longer wipes resolverOwnership (simulator.ts
      //      loadManifestData), so resolveInvocationModuleKey step 2 pins
      //      publishFromA → resolver-a → panel-a without touching the slot.
      //   2. render() runs inside an AsyncLocalStorage scope, so the late
      //      subscribe is attributed to panel-a too.
      // Now both sides agree on the CORRECT key.
      setCfg({
        a: { channel: 'chan-a', awaitInvokeFirst: true },
        b: { channel: 'chan-b' },
      });
      await sim.ui.render('panel-a');
      await waitForSink('mount-a');
      await sim.ui.render('panel-b');
      await waitForSink('subscribed-b');
      await waitForSink('subscribed-a');

      expect(keysForChannels(sim, ['chan-a'])).toEqual(['scoped:panel-a:chan-a']);
      const r = await sim.invoke('publishFromA', { channel: 'chan-a', message: 'unpinned' });
      expect(r.errors).toBeUndefined();
      // Publish-side key derived from ownership, not from the active slot
      // (which is panel-b at this point).
      expect(sim.ui.getActiveModule()).toBe('panel-b');
      expect(sim.realtime.getEventLog().at(-1)?.channelKey).toBe('scoped:panel-a:chan-a');
      expect(sink('event-a')).toEqual(['unpinned']);
    });

    it('root cause of the mask: deploy() wipes resolverOwnership, so cross-module invokes are not rejected', async () => {
      // deployer.ts ~L721 registers ownership (publishFromA → resolver-a),
      // then deployer.ts ~L838 calls sim.loadManifestData(), which does
      // `this.resolverOwnership.clear()` (simulator.ts ~L297) and re-registers
      // module ROUTES but never ownership. Public-surface proof: Forge-parity
      // validateResolverAccess (simulator.ts ~L438) should reject invoking
      // resolver-a's function under panel-b, and does not.
      await expect(
        sim.invoke('publishFromA', { channel: 'x', message: 'x' }, { moduleKey: 'panel-b' }),
      ).rejects.toThrow(/belongs to resolver "resolver-a"/);
    });

    it('control: same scenario with no await before subscribe keys both panels correctly', async () => {
      setCfg({
        a: { channel: 'chan-a' },
        b: { channel: 'chan-b' },
      });
      await sim.ui.render('panel-a');
      await waitForSink('subscribed-a');
      await sim.ui.render('panel-b');
      await waitForSink('subscribed-b');
      expect(keysForChannels(sim, ['chan-a', 'chan-b'])).toEqual([
        'scoped:panel-a:chan-a',
        'scoped:panel-b:chan-b',
      ]);
    });
  });
});
