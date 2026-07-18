/**
 * Eval-7 F4 — deploy output belongs IN the deploy response, not on stdout.
 *
 * Over the MCP stdio transport, stdout is the JSON-RPC framing channel.
 * Deploy used to print its ⏰ scheduled-trigger banners (and let app
 * handler output + the 📡 auth banner escape) straight to stdout, which
 * the eval's raw-stdio client rendered as `[non-json]` corruption — and
 * MCP clients that survive it still hide the lines from the agent.
 *
 * The fix has two halves, both pinned here:
 *   1. Structured, in-band data: `DeployResult.scheduledTriggerFires`
 *      records every deploy-time fire (key/function/statusCode/error), and
 *      the MCP deploy tool wraps `sim.deploy()` in withCapture so all
 *      printed lines come back in a `console` array (same merge pattern
 *      the tool uses — outer capture + sim console-log delta, no dupes
 *      thanks to capture-stack semantics).
 *   2. Transport hygiene: `redirectStdoutConsoleToStderr()` rebinds
 *      log/info/debug to stderr in stdio mode, WITHOUT delegating to
 *      console.error (which would double-capture under console-capture's
 *      passthrough patching).
 */

import { describe, it, expect, vi } from 'vitest';
import { resolve } from 'node:path';
import { createSimulator } from '../simulator.js';
import { withCapture } from '../console-capture.js';
import { redirectStdoutConsoleToStderr } from '../stdio-guard.js';

const FIXTURE = resolve(import.meta.dirname, 'fixtures/eval7-f4-sched');

describe('eval-7 F4 — DeployResult.scheduledTriggerFires', () => {
  it('records one entry per deploy-time fire, with statusCode and error detail', async () => {
    const sim = createSimulator();
    // Silence the ⏰/⚠️ banners in test output; the merge test below
    // asserts their presence explicitly.
    const { result } = await withCapture(() =>
      sim.deploy(FIXTURE, { throwOnError: false }),
    );

    expect(result.scheduledTriggerFires).toEqual([
      { key: 'ok-tick', function: 'fn-ok', statusCode: 204 },
      { key: 'bad-tick', function: 'fn-bad', statusCode: 500, error: 'status 500' },
    ]);

    // The failing fire still lands in errors too — scheduledTriggerFires
    // is the per-fire record, errors is the deploy verdict.
    expect(result.errors).toEqual([
      { functionKey: 'fn-bad', error: 'Scheduled trigger error: status 500' },
    ]);
  });

  it('is empty when fireScheduledTriggers is opted out (triggers still listed)', async () => {
    const sim = createSimulator();
    const { result } = await withCapture(() =>
      sim.deploy(FIXTURE, { throwOnError: false, fireScheduledTriggers: false }),
    );

    expect(result.scheduledTriggerFires).toEqual([]);
    expect(result.scheduledTriggers.map((st) => st.key)).toEqual(['ok-tick', 'bad-tick']);
    expect(result.errors).toEqual([]);
  });
});

describe('eval-7 F4 — capture merge (the MCP deploy tool pattern)', () => {
  it('outer capture + sim console delta covers banners AND handler output with no duplicates', async () => {
    const sim = createSimulator();
    const consoleStart = sim.getConsoleLogs().length;

    const { result, console: outer } = await withCapture(() =>
      sim.deploy(FIXTURE, { throwOnError: false }),
    );
    expect(result.errors).toHaveLength(1); // bad-tick, as above

    const merged = [...outer, ...sim.getConsoleLogs().slice(consoleStart)];

    // Deployer banners land in the OUTER capture (they print between the
    // nested fireScheduledTrigger captures)...
    expect(merged.some((l) => l.level === 'log' && l.message.includes('⏰ Firing scheduled trigger: ok-tick'))).toBe(true);
    expect(merged.some((l) => l.level === 'error' && l.message.includes('Scheduled trigger "bad-tick" failed'))).toBe(true);

    // ...while handler output lands in fireScheduledTrigger's inner
    // capture, which pushes to the sim console log.
    expect(merged.some((l) => l.level === 'log' && l.message === 'sched handler says hi')).toBe(true);

    // Capture-stack semantics: a line goes to exactly one buffer, so the
    // merge never duplicates.
    const keys = merged.map((l) => `${l.level}:${l.message}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('eval-7 F4 — stdio guard (redirectStdoutConsoleToStderr)', () => {
  it('routes console.log/info/debug to stderr, never stdout', () => {
    const restore = redirectStdoutConsoleToStderr();
    const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      console.log('framing-safe log');
      console.info('framing-safe info');
      console.debug('framing-safe debug');

      expect(out).not.toHaveBeenCalled();
      const written = err.mock.calls.map((c) => String(c[0])).join('');
      expect(written).toContain('framing-safe log');
      expect(written).toContain('framing-safe info');
      expect(written).toContain('framing-safe debug');
    } finally {
      out.mockRestore();
      err.mockRestore();
      restore();
    }
  });

  it('does not double-capture under console-capture (the log→error delegation trap)', async () => {
    const restore = redirectStdoutConsoleToStderr();
    // Suppress the passthrough writes during the capture.
    const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      const { console: lines } = await withCapture(async () => {
        console.log('once only');
      });
      expect(lines).toHaveLength(1);
      expect(lines[0].level).toBe('log');
      expect(lines[0].message).toBe('once only');
    } finally {
      err.mockRestore();
      restore();
    }
  });

  it('restore() puts the original bindings back', () => {
    const before = console.log;
    const restore = redirectStdoutConsoleToStderr();
    expect(console.log).not.toBe(before);
    restore();
    expect(console.log).toBe(before);
  });
});
