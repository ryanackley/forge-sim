/**
 * Tests for appEvents.publish() — custom app event pub/sub.
 *
 * In forge-sim, appEvents.publish({ key }) expands the key to
 * `avi:forge:<appId>:<key>` and fires matching triggers.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createSimulator, ForgeSimulator } from '../simulator.js';

// Import the shim directly to test appEvents.publish()
import { appEvents } from '../shims/forge-events.js';

describe('appEvents.publish()', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    sim = createSimulator();
  });

  it('fires a matching trigger when key matches manifest event', async () => {
    let receivedEvent: any;

    sim.loadManifest(`
app:
  id: ari:cloud:ecosystem::app/my-test-app
  name: Test
modules:
  function:
    - key: onCustomEvent
      handler: index.onCustomEvent
  trigger:
    - key: custom-trigger
      function: onCustomEvent
      events:
        - avi:forge:ari:cloud:ecosystem::app/my-test-app:issue-processed
`);

    sim.registerFunction('onCustomEvent', async (event: any, _context: any) => {
      receivedEvent = event;
      return { handled: true };
    }, 'trigger');

    const result = await appEvents.publish({ key: 'issue-processed' });

    expect(result.type).toBe('success');
    expect(result.failedEvents).toHaveLength(0);
    expect(receivedEvent).toBeDefined();
    expect(receivedEvent.event).toBe('avi:forge:ari:cloud:ecosystem::app/my-test-app:issue-processed');

    // Verify the platform-generated payload shape (no custom payload allowed)
    expect(receivedEvent.workspaceId).toMatch(/^ari:cloud:jira::site\//);
    expect(receivedEvent.eventType).toBe('avi:forge:ari:cloud:ecosystem::app/my-test-app:issue-processed');
    expect(receivedEvent.name).toBe('issue-processed');
    expect(receivedEvent.environmentId).toBeDefined();
    expect(receivedEvent.environmentType).toBe('DEVELOPMENT');
    expect(receivedEvent.environmentKey).toBe('default');
  });

  it('handles multiple events in a single publish call', async () => {
    const receivedEvents: string[] = [];

    sim.loadManifest(`
app:
  id: ari:cloud:ecosystem::app/multi-test
  name: Test
modules:
  function:
    - key: handler
      handler: index.handler
  trigger:
    - key: trigger-a
      function: handler
      events:
        - avi:forge:ari:cloud:ecosystem::app/multi-test:event-a
    - key: trigger-b
      function: handler
      events:
        - avi:forge:ari:cloud:ecosystem::app/multi-test:event-b
`);

    sim.registerFunction('handler', async (event: any) => {
      receivedEvents.push(event.event);
    }, 'trigger');

    const result = await appEvents.publish([
      { key: 'event-a' },
      { key: 'event-b' },
    ]);

    expect(result.type).toBe('success');
    expect(result.failedEvents).toHaveLength(0);
    expect(receivedEvents).toContain('avi:forge:ari:cloud:ecosystem::app/multi-test:event-a');
    expect(receivedEvents).toContain('avi:forge:ari:cloud:ecosystem::app/multi-test:event-b');
  });

  it('succeeds silently when no trigger matches the event key', async () => {
    sim.loadManifest(`
app:
  id: ari:cloud:ecosystem::app/no-match
  name: Test
modules:
  function:
    - key: handler
      handler: index.handler
`);

    const result = await appEvents.publish({ key: 'unregistered-event' });

    expect(result.type).toBe('success');
    expect(result.failedEvents).toHaveLength(0);
  });

  it('uses "unknown" appId when manifest has no app.id', async () => {
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
        - avi:forge:unknown:my-event
`);

    sim.registerFunction('handler', async (event: any) => {
      receivedEvent = event;
    }, 'trigger');

    const result = await appEvents.publish({ key: 'my-event' });

    expect(result.type).toBe('success');
    expect(receivedEvent?.event).toBe('avi:forge:unknown:my-event');
  });

  it('reports invalid events in failedEvents', async () => {
    sim.loadManifest(`
app:
  id: ari:cloud:ecosystem::app/test
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
    expect(result.failedEvents).toHaveLength(1);
    expect(result.failedEvents[0].errorMessage).toContain('Missing or invalid');
  });
});
