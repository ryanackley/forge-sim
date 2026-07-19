/**
 * Eval-10 regression pins.
 *
 * F6:  `forge-sim kvs list --prefix` sent ?prefix= but the shared API handler
 *      never read it — the flag was documented and silently ignored.
 * F10: delivered app-event payloads carried `name` = raw key and omitted the
 *      `context`/`contextToken` fields real Forge app-event deliveries include.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { createSimulator, type ForgeSimulator } from '../simulator.js';
import { createApiHandler } from '../tools/api.js';
import { appEvents } from '../shims/forge-events.js';
import { parseManifestContent } from '../manifest.js';

async function startApiServer(): Promise<{
  sim: ForgeSimulator;
  server: ReturnType<typeof createServer>;
  url: string;
}> {
  const sim = createSimulator();
  const handler = createApiHandler(sim, null);

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    void handler(req, res, url);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Failed to bind test server');

  return { sim, server, url: `http://127.0.0.1:${address.port}` };
}

describe('eval-10 F6: /api/kvs honors ?prefix=', () => {
  const servers: Array<ReturnType<typeof createServer>> = [];

  afterAll(async () => {
    await Promise.all(
      servers.map(
        (server) =>
          new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
      ),
    );
  });

  it('filters keys by prefix', async () => {
    const { sim, server, url } = await startApiServer();
    servers.push(server);

    await sim.kvs.set('processed:1', { done: true });
    await sim.kvs.set('processed:2', { done: false });
    await sim.kvs.set('settings:theme', 'dark');

    const filtered = await (await fetch(`${url}/api/kvs?prefix=${encodeURIComponent('processed:')}`)).json();
    expect(filtered.map((e: any) => e.key).sort()).toEqual(['processed:1', 'processed:2']);

    // No prefix → everything.
    const all = await (await fetch(`${url}/api/kvs`)).json();
    expect(all).toHaveLength(3);

    // Prefix with no matches → empty list, not an error.
    const none = await (await fetch(`${url}/api/kvs?prefix=nope:`)).json();
    expect(none).toEqual([]);
  });
});

describe('eval-10 F10: app-event delivered payload shape', () => {
  const APP_UUID = 'd9022ad7-c220-4836-b1d1-7f9f2c633d3a';
  const MANIFEST = `
app:
  id: ari:cloud:ecosystem::app/${APP_UUID}
  name: Test
modules:
  event:
    - key: thing-created
      name: Thing Created
      allowedRecipients: ['*']
  function:
    - key: onThing
      handler: index.onThing
  trigger:
    - key: thing-listener
      function: onThing
      events:
        - avi:cloud:ecosystem::event/${APP_UUID}/thing-created
`;

  it('delivers name from the event module plus per-subscriber context/contextToken', async () => {
    const sim = createSimulator();
    await sim.loadManifest(MANIFEST);

    let received: any;
    sim.registerFunction('onThing', async (event: any) => {
      received = event;
    }, 'trigger');

    const result = await appEvents.publish({ key: 'thing-created' });
    expect(result.type).toBe('success');
    expect(received).toBeDefined();

    // `name` is the event module's human-readable name, not the raw key.
    expect(received.name).toBe('Thing Created');
    expect(received.eventType).toBe(`avi:cloud:ecosystem::event/${APP_UUID}/thing-created`);

    // Per-subscriber delivery context — moduleKey is the RECEIVING trigger's key.
    expect(received.context).toEqual({
      cloudId: 'sim-cloud-001',
      moduleKey: 'thing-listener',
      userAccess: { enabled: false },
    });
    expect(typeof received.contextToken).toBe('string');
  });

  it('falls back to the key as name when no event module is declared', async () => {
    const sim = createSimulator();
    await sim.loadManifest(`
app:
  id: ari:cloud:ecosystem::app/${APP_UUID}
  name: Test
modules:
  function:
    - key: onThing
      handler: index.onThing
  trigger:
    - key: t
      function: onThing
      events:
        - avi:cloud:ecosystem::event/${APP_UUID}/undeclared-event
`);

    let received: any;
    sim.registerFunction('onThing', async (event: any) => {
      received = event;
    }, 'trigger');

    await appEvents.publish({ key: 'undeclared-event' });
    expect(received.name).toBe('undeclared-event');
    // context/contextToken still injected by fireTrigger.
    expect(received.context?.moduleKey).toBe('t');
    expect(received.contextToken).toBeDefined();
  });

  it('does not inject app-event context into product event deliveries', async () => {
    const sim = createSimulator();
    await sim.loadManifest(`
app:
  id: ari:cloud:ecosystem::app/${APP_UUID}
  name: Test
modules:
  function:
    - key: onIssue
      handler: index.onIssue
  trigger:
    - key: issue-listener
      function: onIssue
      events:
        - avi:jira:created:issue
`);

    let received: any;
    sim.registerFunction('onIssue', async (event: any) => {
      received = event;
    }, 'trigger');

    await sim.fireTrigger('avi:jira:created:issue', { issue: { key: 'X-1' } } as any);
    // Product events get context as the second handler argument only.
    expect(received.context).toBeUndefined();
    expect(received.contextToken).toBeUndefined();
  });

  it('recognizes the event module type (no unknown-module warning)', () => {
    const parsed = parseManifestContent(MANIFEST);
    const unknownWarnings = parsed.warnings.filter((w) =>
      w.message.includes("Unknown module type 'event'"),
    );
    expect(unknownWarnings).toEqual([]);
  });
});
