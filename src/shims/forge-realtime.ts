/**
 * @forge/realtime shim — backend (resolver-side) API.
 *
 * Exports: publish, publishGlobal, signRealtimeToken, and the ProductContext
 * enums (Jira, Confluence, Bitbucket). The real package's index.d.ts is
 * exactly those three re-exports. These are used in Forge functions
 * (resolvers, triggers, consumers); there is no subscribe on the backend.
 */

import { getSimulator } from './globals.js';
import type { RealtimePayload, PublishOptions, PublishResult, TokenResult, RealtimeTokenPermission } from '../realtime.js';

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

/**
 * Docs signature: `signRealtimeToken(channelName, claims, permissions?)`.
 * `permissions` is `['subscribe']`, `['publish']` or both; omitted grants both.
 */
async function signRealtimeToken(
  channel: string,
  claims: Record<string, unknown>,
  permissions?: RealtimeTokenPermission[],
): Promise<TokenResult> {
  return getSimulator().realtime.signRealtimeToken(channel, claims, permissions);
}

export { publish, publishGlobal, signRealtimeToken };
export { Jira, Confluence, Bitbucket, type ProductContext } from './product-context.js';
