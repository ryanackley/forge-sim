/**
 * @forge/realtime shim — backend (resolver-side) API.
 *
 * Exports: publish, publishGlobal, signRealtimeToken
 * These are used in Forge functions (resolvers, triggers, consumers).
 */

import { getSimulator } from './globals.js';
import type { RealtimePayload, PublishOptions, PublishResult, TokenResult } from '../realtime.js';

async function publish(
  channel: string,
  payload: RealtimePayload,
  options?: PublishOptions,
): Promise<PublishResult> {
  return getSimulator().realtime.publish(channel, payload, options);
}

async function publishGlobal(
  channel: string,
  payload: RealtimePayload,
  options?: PublishOptions,
): Promise<PublishResult> {
  return getSimulator().realtime.publishGlobal(channel, payload, options);
}

async function signRealtimeToken(
  channel: string,
  claims: Record<string, unknown>,
): Promise<TokenResult> {
  return getSimulator().realtime.signRealtimeToken(channel, claims);
}

export { publish, publishGlobal, signRealtimeToken };
