/**
 * forge-sim bridge protocol — environment-neutral, dependency-free.
 *
 * Everything that knows what real `@forge/bridge` sends through
 * `window.__bridge.callBridge` and what it expects back. Hosts
 * (`src/bridge/hosts/*`) implement `BridgeHost`; the dispatcher does the rest.
 *
 * Compiled by tsconfig.bridge-protocol.json with `lib: ["ES2022"]` and
 * `types: []` — no DOM, no Node — so an accidental environment dependency is
 * a build failure, not a convention.
 */
export type {
  BridgeHost,
  BridgeRequestInit,
  BridgeFetchResponse,
  BridgeNavigationLocation,
  BridgeSubscription,
} from './host.js';
export {
  BRIDGE_COMMANDS,
  type BridgeCommandSpec,
  isUnsupportedBridgeCommand,
  bridgeNotImplementedError,
  unknownBridgeCommandError,
} from './commands.js';
export { normalizeBridgeHeaders, parseInvokeType, unwrapViewPayload } from './normalize.js';
export { createBridgeDispatcher, type BridgeDispatcher, type CallBridge, type DispatcherOptions } from './dispatcher.js';
