/**
 * Quiescence regression suite — eval bugs B3 and B7.
 *
 * B3: `waitForContent` used to resolve at the render COMMIT where the target
 * text appeared. Effects scheduled by that commit (e.g. a controlled-input
 * sync like `useEffect(() => setValue(String(threshold)), [threshold])`)
 * hadn't flushed yet — so an immediate `fillField` was silently clobbered
 * when the pending effect fired. In a real browser those effects flush
 * before a human could possibly type, so the headless sequence simulated a
 * physically impossible interaction. Parity fix: waitForContent settles
 * (renders quiet + no pending invokes) before resolving, and re-verifies
 * the text.
 *
 * B7: no drain API — a fire-and-forget UI effect (useEffect → invoke →
 * @forge/sql) still in flight at `sim.stop()` landed on stopped MySQL and
 * surfaced as an unhandled error. Fix: `sim.idle()` + `sim.stop()` drains
 * pending invocations first.
 *
 * The `fixtures/effect-clobber` app replicates the exact sprint-pulse shape
 * that surfaced B3.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { ForgeSimulator, createSimulator } from '../simulator.js';

const FIXTURE = join(import.meta.dirname, 'fixtures/effect-clobber');
const KEY = 'settings-panel';

describe('B3 — waitForContent settles before resolving', () => {
  let sim: ForgeSimulator;

  beforeEach(async () => {
    sim = new ForgeSimulator();
    await sim.deploy(FIXTURE);
  });

  afterEach(() => {
    sim.ui.resetAll();
  });

  it('control: filling before the data-fetch lands IS clobbered — proves the fixture reproduces the hazard', async () => {
    // Raw render() — the getSettings invoke is still in flight when it
    // returns. This is where the OLD waitForContent left users when the
    // target text was already present in the first commit.
    const doc = await sim.ui.render(KEY);
    expect(sim.ui.getTextContent(doc!)).toContain('Alert threshold');

    // Type "faster than physics" — before the fetch lands.
    sim.ui.fillField(KEY, 'threshold', '55');

    // Let everything flush: the fetch lands, `threshold` changes 20 → 30,
    // and useEffect(() => setValue(String(threshold)), [threshold]) fires.
    const settled = await sim.ui.settle(KEY);
    const field = sim.ui.findByProps(settled!, { name: 'threshold' })[0];
    expect(field.props.value).toBe('30'); // NOT '55' — this is why B3 existed
  });

  it('fillField immediately after waitForContent sticks (the B3 A-case)', async () => {
    // 'Alert threshold' is present from the very first commit — under the
    // OLD waitForContent this resolved while getSettings was still in
    // flight, and the fill below got clobbered when it landed. The settle
    // step now holds until pending invokes drain and renders go quiet.
    const doc = await sim.ui.waitForContent(KEY, 'Alert threshold');
    // The returned doc is the SETTLED tree — the fetch has already landed.
    expect(sim.ui.getTextContent(doc)).toContain('Current threshold: 30');

    // The exact sequence the eval agent used — immediate fill, no sleeps.
    sim.ui.fillField(KEY, 'threshold', '55');

    // Flush the controlled-input re-render, then save.
    await sim.ui.settle(KEY);
    await sim.ui.interactWith('Button', { matchText: 'Save' });
    await sim.ui.waitForContent(KEY, 'Saved 55');

    expect(await sim.kvs.get('settings')).toEqual({ threshold: 55 });
  });

  it('settle() alone waits out the invoke → setState → effect chain', async () => {
    const initial = await sim.ui.render(KEY);
    expect(sim.ui.getTextContent(initial!)).toContain('Loading settings');

    const settled = await sim.ui.settle(KEY);
    expect(settled).not.toBeNull();
    expect(sim.ui.getTextContent(settled!)).toContain('Current threshold: 30');
    expect(sim.pendingInvokes).toBe(0);
  });

  it('re-render of an already-rendered module is a fresh mount, not a no-op (vite-node cached-bundle path)', async () => {
    // First mount fetches threshold 30.
    await sim.ui.waitForContent(KEY, 'Current threshold: 30');

    // Change the backing state, then explicitly render again. Under
    // vite-node the `?t=` cache-bust is ignored, so without the
    // missing-pulse replay in render() this second render would be a
    // silent no-op and the stale "30" doc would come back — the exact
    // shape that produced a stale Textfield in the sprint-pulse eval
    // suite when forge-sim was npm-linked.
    await sim.kvs.set('settings', { threshold: 77 });
    await sim.ui.render(KEY);
    const doc = await sim.ui.waitForContent(KEY, 'Current threshold: 77');

    const field = sim.ui.findByProps(doc, { name: 'threshold' })[0];
    expect(field.props.value).toBe('77');
  });

  it('waitForContent still resolves for already-stable content (no settle penalty regression)', async () => {
    await sim.ui.waitForContent(KEY, 'Current threshold: 30');

    // Second wait on stable content should be fast — settle's quiet window
    // (50ms) plus loop overhead, nowhere near the 1000ms settle budget.
    const start = Date.now();
    await sim.ui.waitForContent(KEY, 'Alert threshold');
    expect(Date.now() - start).toBeLessThan(900);
  });
});

describe('B7 — sim.idle() and sim.stop() drain in-flight invocations', () => {
  it('pendingInvokes tracks in-flight resolver invocations', async () => {
    const sim = createSimulator();
    sim.resolver.define('slow', async () => {
      await new Promise((r) => setTimeout(r, 80));
      return { ok: true };
    });

    expect(sim.pendingInvokes).toBe(0);
    const inflight = sim.invoke('slow');
    expect(sim.pendingInvokes).toBe(1);
    await inflight;
    expect(sim.pendingInvokes).toBe(0);
  });

  it('idle() resolves once fire-and-forget invocations complete', async () => {
    const sim = createSimulator();
    sim.resolver.define('slow', async () => {
      await new Promise((r) => setTimeout(r, 120));
      await sim.kvs.set('slow-done', true);
      return { ok: true };
    });

    void sim.invoke('slow'); // fire-and-forget, like a UI effect
    expect(sim.pendingInvokes).toBe(1);

    await sim.idle();
    expect(sim.pendingInvokes).toBe(0);
    expect(await sim.kvs.get('slow-done')).toBe(true);
  });

  it('idle() counts even when the resolver fails', async () => {
    const sim = createSimulator();
    sim.resolver.define('boom', async () => {
      await new Promise((r) => setTimeout(r, 60));
      throw new Error('resolver exploded');
    });

    const inflight = sim.invoke('boom').catch(() => 'caught');
    await sim.idle();
    expect(sim.pendingInvokes).toBe(0);
    expect(await inflight).toBe('caught');
  });

  it('idle() throws when an invocation outlives the timeout', async () => {
    const sim = createSimulator();
    sim.resolver.define('hang', async () => {
      await new Promise((r) => setTimeout(r, 700));
    });

    const inflight = sim.invoke('hang');
    await expect(sim.idle({ timeoutMs: 100 })).rejects.toThrow(
      /sim\.idle\(\) timed out after 100ms.*1 resolver invocation\(s\) still in flight/s
    );
    await inflight; // drain so nothing leaks past the test
  });

  it('stop() drains in-flight invocations before shutting down (the B7 crash shape)', async () => {
    const sim = createSimulator();
    let completed = false;
    sim.resolver.define('slowWrite', async () => {
      await new Promise((r) => setTimeout(r, 120));
      await sim.kvs.set('late-write', true);
      completed = true;
      return { ok: true };
    });

    // Fire-and-forget — exactly what a useEffect-triggered invoke looks like
    // when the test finishes before the effect's promise resolves.
    void sim.invoke('slowWrite');

    await sim.stop();

    expect(completed).toBe(true);
    expect(sim.pendingInvokes).toBe(0);
    expect(await sim.kvs.get('late-write')).toBe(true);
  });
});
