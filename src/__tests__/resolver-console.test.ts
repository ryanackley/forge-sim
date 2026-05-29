/**
 * F4 — Resolver `console.log` discoverability via MCP `forge.logs`.
 *
 * The capture mechanism itself works: every invocation path (resolver,
 * trigger, scheduledTrigger) wraps the handler in `withCapture()` and
 * mirrors captured lines into both `sim.consoleLogs` and the main log
 * stream as `level=console.<log|warn|error|info>` entries.
 *
 * Skill run #6 reported `consoleLinesTotal: 0` after editing a resolver
 * to add a console.log and redeploying — but that was actually F3
 * (transitive cache served the OLD bundle, so the console.log never ran).
 * With F3 fixed, console.log is reachable. This test pins that.
 *
 * The second gap is MCP-output ergonomics: today the response shows
 * `consoleLinesTotal: N` (a tease — a count with no listing), and the
 * lines themselves are mixed into the main `logs` array under the
 * obscure `console.log` level. The agent had to *guess* the filter
 * prefix. We surface a dedicated `console: [...]` array so users see
 * their print output without knowing any filter trick.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { createSimulator, type ForgeSimulator } from '../simulator.js';

const FIXTURE = join(import.meta.dirname, 'fixtures/resolver-console-f4');

describe('F4 — resolver console.* lines surface in getLogs', () => {
  let sim: ForgeSimulator;

  beforeAll(async () => {
    sim = createSimulator();
    await sim.deploy(FIXTURE);
  });

  afterAll(async () => {
    await sim.stop();
  });

  it('resolver console.log/warn/error/info all land in sim.getConsoleLogs()', async () => {
    sim.clearLogs();
    await sim.invoke('chatty');
    const console = sim.getConsoleLogs();
    expect(console).toHaveLength(4);
    expect(console[0]).toMatchObject({ level: 'log', message: expect.stringContaining('[chatty] hello') });
    expect(console[1]).toMatchObject({ level: 'warn' });
    expect(console[2]).toMatchObject({ level: 'error' });
    expect(console[3]).toMatchObject({ level: 'info' });
  });

  it('captured lines are mirrored to getLogs() under level "console.<kind>"', async () => {
    // Verifies the filter discovery: `forge.logs level=console.log` works
    // because we copy each captured line into the main log stream with
    // level=`console.${line.level}`.
    sim.clearLogs();
    await sim.invoke('chatty');
    const logs = sim.getLogs();
    const consoleLogs = logs.filter((l) => l.level.startsWith('console.'));
    expect(consoleLogs.map((l) => l.level)).toEqual([
      'console.log',
      'console.warn',
      'console.error',
      'console.info',
    ]);
  });

  it('captured lines from a thrown resolver still appear in consoleLogs', async () => {
    sim.clearLogs();
    await expect(sim.invoke('thrower')).rejects.toThrow(/intentional boom/);
    const console = sim.getConsoleLogs();
    // The error path attaches captured console to the thrown error; the
    // simulator unpacks `(err as any).capturedConsole` and pushes it.
    expect(console.map((l) => l.message)).toEqual(['[thrower] about to fail']);
  });
});

/**
 * F4 — MCP `forge.logs` response shape.
 *
 * The old shape teased a `consoleLinesTotal: N` count with no listing, and
 * left users to figure out the `level=console.log` filter trick to actually
 * see their print output. The new shape adds a dedicated top-level `console`
 * array carrying the captured lines directly. Filter-based discovery still
 * works because the simulator mirrors each captured line into `logs` under
 * `level=console.<kind>` from the capture site.
 */
describe('F4 — sim.buildLogsResponse (MCP forge.logs shape)', () => {
  let sim: ForgeSimulator;

  beforeAll(async () => {
    sim = createSimulator();
    await sim.deploy(FIXTURE);
  });

  afterAll(async () => {
    await sim.stop();
  });

  it('surfaces captured console.log/warn/error/info as a dedicated `console` array', async () => {
    sim.clearLogs();
    await sim.invoke('chatty');
    const response = sim.buildLogsResponse();
    expect(response.console).toHaveLength(4);
    expect(response.console[0]).toEqual({
      time: expect.any(String),
      level: 'log',
      message: '[chatty] hello from console.log',
    });
    expect(response.console[1].level).toBe('warn');
    expect(response.console[2].level).toBe('error');
    expect(response.console[3].level).toBe('info');
  });

  it('console array entries carry real timestamps, not synthesized ones', async () => {
    sim.clearLogs();
    const before = Date.now();
    await sim.invoke('chatty');
    const after = Date.now();
    const response = sim.buildLogsResponse();
    for (const line of response.console) {
      const t = Date.parse(line.time);
      expect(t).toBeGreaterThanOrEqual(before);
      expect(t).toBeLessThanOrEqual(after);
    }
  });

  it('legacy `level=console.log` filter still returns mirrored entries in `logs`', async () => {
    // Backwards-compat: the agent in run-6 reached for this filter; it must
    // keep working even though the dedicated `console` field exists now.
    sim.clearLogs();
    await sim.invoke('chatty');
    const response = sim.buildLogsResponse({ level: 'console.log' });
    expect(response.logs).toHaveLength(1);
    expect(response.logs[0]).toMatchObject({
      level: 'console.log',
      message: '[chatty] hello from console.log',
    });
  });

  it('level prefix filter `console` matches all four console.* levels', async () => {
    sim.clearLogs();
    await sim.invoke('chatty');
    const response = sim.buildLogsResponse({ level: 'console' });
    expect(response.logs.map((l) => l.level)).toEqual([
      'console.log',
      'console.warn',
      'console.error',
      'console.info',
    ]);
  });

  it('consoleLinesTotal reflects the full captured stream, not just the slice', async () => {
    sim.clearLogs();
    // Drive enough invokes to exceed the default limit of 100.
    for (let i = 0; i < 30; i++) await sim.invoke('chatty'); // 30 * 4 = 120 lines
    const response = sim.buildLogsResponse({ limit: 5 });
    expect(response.consoleLinesTotal).toBe(120);
    expect(response.console).toHaveLength(5);
  });

  it('omitted level returns the full log stream (including console.* mirrors)', async () => {
    sim.clearLogs();
    await sim.invoke('chatty');
    const response = sim.buildLogsResponse();
    const levels = new Set(response.logs.map((l) => l.level));
    // `invoke` start/end events + 4 console.* mirrors at minimum.
    expect(levels.has('invoke')).toBe(true);
    expect(levels.has('console.log')).toBe(true);
    expect(levels.has('console.warn')).toBe(true);
  });

  it('limit applies independently to `logs` and `console`', async () => {
    sim.clearLogs();
    for (let i = 0; i < 10; i++) await sim.invoke('chatty'); // 40 console lines + ~20 invoke entries
    const response = sim.buildLogsResponse({ limit: 3 });
    expect(response.console).toHaveLength(3);
    expect(response.logs).toHaveLength(3);
  });

  it('throwing resolver still gets its console lines into the response', async () => {
    sim.clearLogs();
    await expect(sim.invoke('thrower')).rejects.toThrow();
    const response = sim.buildLogsResponse();
    expect(response.console.map((l) => l.message)).toEqual(['[thrower] about to fail']);
  });
});
