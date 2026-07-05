/**
 * Tests for appEvents.publish() — custom app event pub/sub.
 *
 * In forge-sim, appEvents.publish({ key }) expands the key to the canonical
 * Forge AVI format `avi:cloud:ecosystem::event/<app-uuid>/<key>` and fires
 * matching triggers.
 *
 * @see https://developer.atlassian.com/platform/forge/events-reference/app-events/
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSimulator, ForgeSimulator } from '../simulator.js';

// Import the shim directly to test appEvents.publish()
import { appEvents, extractAppIdUuid } from '../shims/forge-events.js';

const TEST_APP_UUID = 'd9022ad7-c220-4836-b1d1-7f9f2c633d3a';
const TEST_APP_ARI = `ari:cloud:ecosystem::app/${TEST_APP_UUID}`;

describe('extractAppIdUuid', () => {
  it('extracts the UUID from a full app ARI', () => {
    expect(extractAppIdUuid(TEST_APP_ARI)).toBe(TEST_APP_UUID);
  });

  it('handles app.id without a slash (legacy/short id)', () => {
    expect(extractAppIdUuid('my-test-app')).toBe('my-test-app');
  });

  it('returns "unknown" for missing app.id', () => {
    expect(extractAppIdUuid(undefined)).toBe('unknown');
  });
});

describe('appEvents.publish()', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    sim = createSimulator();
  });

  it('fires a matching trigger using canonical AVI format with realistic app ARI', async () => {
    let receivedEvent: any;

    sim.loadManifest(`
app:
  id: ${TEST_APP_ARI}
  name: Test
modules:
  function:
    - key: onCustomEvent
      handler: index.onCustomEvent
  trigger:
    - key: custom-trigger
      function: onCustomEvent
      events:
        - avi:cloud:ecosystem::event/${TEST_APP_UUID}/issue-processed
`);

    sim.registerFunction('onCustomEvent', async (event: any, _context: any) => {
      receivedEvent = event;
      return { handled: true };
    }, 'trigger');

    const result = await appEvents.publish({ key: 'issue-processed' });

    expect(result.type).toBe('success');
    expect((result as any).failedEvents).toHaveLength(0);
    expect(receivedEvent).toBeDefined();

    const expectedEvent = `avi:cloud:ecosystem::event/${TEST_APP_UUID}/issue-processed`;
    expect(receivedEvent.event).toBe(expectedEvent);

    // Verify the platform-generated payload shape (no custom payload allowed)
    expect(receivedEvent.workspaceId).toMatch(/^ari:cloud:jira::site\//);
    expect(receivedEvent.eventType).toBe(expectedEvent);
    expect(receivedEvent.name).toBe('issue-processed');
    expect(receivedEvent.environmentId).toBeDefined();
    expect(receivedEvent.environmentType).toBe('DEVELOPMENT');
    expect(receivedEvent.environmentKey).toBe('default');
  });

  it('does NOT use the deprecated avi:forge: prefix', async () => {
    // Regression test for the bug where forge-sim built `avi:forge:<full-ari>:<key>`
    // (a malformed AVI that real Forge would reject). The canonical format is
    // `avi:cloud:ecosystem::event/<uuid>/<key>` per the Forge docs.
    let receivedEvent: any;

    sim.loadManifest(`
app:
  id: ${TEST_APP_ARI}
  name: Test
modules:
  function:
    - key: handler
      handler: index.handler
  trigger:
    - key: t1
      function: handler
      events:
        - avi:cloud:ecosystem::event/${TEST_APP_UUID}/my-event
    # An old-format trigger that should NOT match — encoded with the bug shape
    - key: t2
      function: handler
      events:
        - avi:forge:${TEST_APP_ARI}:my-event
`);

    let capturedEvents: any[] = [];
    sim.registerFunction('handler', async (event: any) => {
      capturedEvents.push(event);
      receivedEvent = event;
    }, 'trigger');

    await appEvents.publish({ key: 'my-event' });

    // Exactly one trigger fired — the canonical-format one
    expect(capturedEvents).toHaveLength(1);
    expect(receivedEvent.event).toBe(
      `avi:cloud:ecosystem::event/${TEST_APP_UUID}/my-event`,
    );
    // And critically, the event name does NOT start with avi:forge:
    expect(receivedEvent.event).not.toMatch(/^avi:forge:/);
  });

  it('handles multiple events in a single publish call', async () => {
    const multiAppUuid = '1623e379-f942-4517-9a20-830c24b54ec1';
    const receivedEvents: string[] = [];

    sim.loadManifest(`
app:
  id: ari:cloud:ecosystem::app/${multiAppUuid}
  name: Test
modules:
  function:
    - key: handler
      handler: index.handler
  trigger:
    - key: trigger-a
      function: handler
      events:
        - avi:cloud:ecosystem::event/${multiAppUuid}/event-a
    - key: trigger-b
      function: handler
      events:
        - avi:cloud:ecosystem::event/${multiAppUuid}/event-b
`);

    sim.registerFunction('handler', async (event: any) => {
      receivedEvents.push(event.event);
    }, 'trigger');

    const result = await appEvents.publish([
      { key: 'event-a' },
      { key: 'event-b' },
    ]);

    expect(result.type).toBe('success');
    expect((result as any).failedEvents).toHaveLength(0);
    expect(receivedEvents).toContain(`avi:cloud:ecosystem::event/${multiAppUuid}/event-a`);
    expect(receivedEvents).toContain(`avi:cloud:ecosystem::event/${multiAppUuid}/event-b`);
  });

  it('succeeds silently when no trigger matches the event key', async () => {
    sim.loadManifest(`
app:
  id: ari:cloud:ecosystem::app/no-match-uuid
  name: Test
modules:
  function:
    - key: handler
      handler: index.handler
`);

    const result = await appEvents.publish({ key: 'unregistered-event' });

    expect(result.type).toBe('success');
    expect((result as any).failedEvents).toHaveLength(0);
  });

  it('uses "unknown" as appId when manifest has no app.id', async () => {
    let receivedEvent: any;

    sim.loadManifest(`
app:
  name: NoId
modules:
  function:
    - key: handler
      handler: index.handler
  trigger:
    - key: t
      function: handler
      events:
        - avi:cloud:ecosystem::event/unknown/my-event
`);

    sim.registerFunction('handler', async (event: any) => {
      receivedEvent = event;
    }, 'trigger');

    const result = await appEvents.publish({ key: 'my-event' });

    expect(result.type).toBe('success');
    expect(receivedEvent?.event).toBe('avi:cloud:ecosystem::event/unknown/my-event');
  });

  it('tolerates a short app.id without slash (legacy fixtures)', async () => {
    let receivedEvent: any;

    sim.loadManifest(`
app:
  id: my-short-app
  name: Test
modules:
  function:
    - key: handler
      handler: index.handler
  trigger:
    - key: t
      function: handler
      events:
        - avi:cloud:ecosystem::event/my-short-app/my-event
`);

    sim.registerFunction('handler', async (event: any) => {
      receivedEvent = event;
    }, 'trigger');

    await appEvents.publish({ key: 'my-event' });

    expect(receivedEvent?.event).toBe('avi:cloud:ecosystem::event/my-short-app/my-event');
  });

  it('reports invalid events in failedEvents', async () => {
    sim.loadManifest(`
app:
  id: ${TEST_APP_ARI}
  name: Test
modules:
  function:
    - key: handler
      handler: index.handler
`);

    const result = await appEvents.publish([
      { key: '' },
      { key: 'valid-event' },
    ]);

    expect(result.type).toBe('success');
    expect((result as any).failedEvents).toHaveLength(1);
    expect((result as any).failedEvents[0].errorMessage).toContain('Missing or invalid');
  });
});
