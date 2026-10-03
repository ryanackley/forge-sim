/**
 * @forge/bridge/realtime shim — the subpath the Forge docs import the
 * ProductContext enums from (`import { Jira } from '@forge/bridge/realtime'`).
 * Mirrors the real package's `out/realtime/index.d.ts` exports.
 */

export { Jira, Confluence, Bitbucket, type ProductContext } from './product-context.js';
export { realtime } from './forge-bridge.js';
export type { PublishOptions, SubscriptionOptions, PublishResult } from '../realtime.js';
