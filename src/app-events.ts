/**
 * Custom app events — publishing expands each key to the canonical AVI name
 * and fires matching triggers in the same app:
 *
 *   avi:cloud:ecosystem::event/<app-uuid>/<key>
 *
 * The `<app-uuid>` comes from `manifest.app.id` (`ari:cloud:ecosystem::app/<uuid>`).
 * Per Forge docs, publishing apps can't add custom payload — the trigger
 * handler receives only the platform-generated event metadata; the
 * per-subscriber `context`/`contextToken` fields are injected by
 * sim.fireTrigger, which knows each receiving trigger's module key.
 *
 * Shared by the @forge/events shim (appEvents.publish) and the
 * `__forge_fetch__` seam (`POST /forge/events/v1/app-events`, the wire path a
 * BUNDLED @forge/events takes — events/out/appEvents.js:15).
 *
 * @see https://developer.atlassian.com/platform/forge/events-reference/app-events/
 */

import type { ForgeSimulator } from './simulator.js';
import { extractAppIdUuid } from './app-ari.js';

export interface AppEventInput {
  key?: unknown;
}

export interface AppEventPublishFailure {
  event: AppEventInput;
  errorMessage: string;
}

export async function publishAppEventsViaTriggers(
  sim: ForgeSimulator,
  events: AppEventInput | AppEventInput[],
): Promise<{ failedEvents: AppEventPublishFailure[] }> {
  const manifest = sim.getManifest();
  const appUuid = extractAppIdUuid(manifest?.raw.app?.id);
  const cloudId = 'sim-cloud-001';

  const eventsArray = Array.isArray(events) ? events : [events];
  const failedEvents: AppEventPublishFailure[] = [];

  for (const evt of eventsArray) {
    if (!evt.key || typeof evt.key !== 'string') {
      failedEvents.push({ event: evt, errorMessage: 'Missing or invalid event key' });
      continue;
    }

    // Canonical Forge AVI format for custom app events.
    // NOTE: NOT `avi:forge:<...>` — that prefix is reserved for app lifecycle
    // events (avi:forge:installed:app, avi:forge:upgraded:app, etc).
    const fullEventName = `avi:cloud:ecosystem::event/${appUuid}/${evt.key}`;

    // Eval-10 F10: `name` is the event module's human-readable `name` from
    // `modules.event` in the manifest — not the raw key. Fall back to the
    // key when the module (or its name) is undeclared.
    const eventModules = (manifest?.raw.modules as Record<string, unknown> | undefined)?.event;
    const eventModule = Array.isArray(eventModules)
      ? (eventModules as Array<Record<string, unknown>>).find((m) => m?.key === evt.key)
      : undefined;
    const eventName = typeof eventModule?.name === 'string' && eventModule.name
      ? eventModule.name
      : evt.key;

    const eventPayload: Record<string, unknown> = {
      workspaceId: `ari:cloud:jira::site/${cloudId}`,
      eventType: fullEventName,
      name: eventName,
      environmentId: 'sim-environment-001',
      environmentType: 'DEVELOPMENT',
      environmentKey: 'default',
    };

    try {
      await sim.fireTrigger(fullEventName, eventPayload);
    } catch (err) {
      failedEvents.push({
        event: evt,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { failedEvents };
}
