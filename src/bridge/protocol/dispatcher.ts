/**
 * The bridge dispatcher — `window.__bridge.callBridge` for any host.
 *
 * Owns the protocol end to end: which commands exist (commands.ts), what
 * each frame looks like on the wire, how to normalize it, and which typed
 * `BridgeHost` method answers it. A host never sees a frame.
 *
 * Frame shapes are measured from the installed `@forge/bridge` (file
 * references inline). `src/__tests__/bridge-protocol.test.ts` drives this
 * dispatcher with a recording host over every command and asserts the
 * typed call it produces.
 */

import type { BridgeHost, BridgeRequestInit } from './host.js';
import {
  BRIDGE_COMMANDS,
  bridgeNotImplementedError,
  isUnsupportedBridgeCommand,
  unknownBridgeCommandError,
} from './commands.js';
import { normalizeBridgeHeaders, parseInvokeType, unwrapViewPayload } from './normalize.js';

export type CallBridge = (cmd: string, data?: unknown) => Promise<unknown>;

export interface DispatcherOptions {
  /** Observe every call before it is routed (headless records these for tests). */
  onCall?: (cmd: string, data: unknown) => void;
}

/** `{ callBridge }` — the object installed as `window.__bridge`. */
export interface BridgeDispatcher {
  callBridge: CallBridge;
}

function requestInit(init: unknown): BridgeRequestInit {
  const i = (init ?? {}) as Record<string, unknown>;
  return {
    method: typeof i.method === 'string' ? i.method : undefined,
    headers: normalizeBridgeHeaders(i.headers),
    body: i.body,
  };
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

export function createBridgeDispatcher(host: BridgeHost, options: DispatcherOptions = {}): BridgeDispatcher {
  const route = async (cmd: string, data: unknown): Promise<unknown> => {
    const d = (data ?? {}) as Record<string, any>;
    switch (cmd) {
      // ── Reconciler (@forge/react) ──────────────────────────────────────
      case 'reconcile': {
        if (!d.forgeDoc) return undefined;
        const kind = d.forgeDoc.type === 'MacroConfig' ? 'macroConfig' : 'view';
        return host.reconcile(d.forgeDoc, kind);
      }
      case 'onError':
        return host.onError(d.error ?? data);

      // ── Resolver + HTTP ────────────────────────────────────────────────
      case 'invoke': {
        // Endpoint calls ride the same command, tagged by invokeType
        // (out/invoke-endpoint/invoke-endpoint.js); they carry no functionKey.
        const kind = parseInvokeType(d.invokeType);
        if (kind === 'container') {
          throw new Error(
            'invokeService is not yet implemented in forge-sim (Container services are ' +
              'an Atlassian developer preview, tracked as roadmap watch item #19).',
          );
        }
        if (kind === 'remote') return host.invokeRemote(str(d.path), requestInit(d));
        return host.invoke(d.functionKey, d.payload);
      }
      case 'fetchProduct':
        return host.fetchProduct(d.product, d.restPath, requestInit(d.fetchRequestInit));
      case 'fetchRemote': {
        // Path lives INSIDE fetchRequestInit (out/fetch/fetch.js); a top-level
        // path is accepted for callers that still send the older shape.
        const init = (d.fetchRequestInit ?? {}) as Record<string, unknown>;
        return host.fetchRemote(d.remoteKey, str(d.path) ?? str(init.path), requestInit(init));
      }

      // ── View ───────────────────────────────────────────────────────────
      case 'getContext':
        return host.getContext();
      case 'submit':
        return host.submit(unwrapViewPayload(data));
      case 'close':
        return host.close(unwrapViewPayload(data));
      case 'refresh':
        return host.refresh(data);
      case 'open':
        return host.open();
      case 'onClose':
        return host.onClose(data);
      case 'createHistory':
        return host.createHistory();
      case 'enableTheming':
        return host.enableTheming();
      case 'changeWindowTitle':
        // The title IS the frame (out/view/changeWindowTitle.js).
        return host.changeWindowTitle(str(data) ?? str(d.title));
      case 'emitReadyEvent':
        return host.emitReadyEvent();

      // ── Router (out/router/router.js) ──────────────────────────────────
      case 'navigate': {
        // router.navigate → { url | ...location, type: 'same-tab' }
        // router.open     → the same command with type: 'new-tab'
        const { type, ...location } = d;
        const target = location.url !== undefined ? location.url : location;
        return host.navigate(target, type === 'new-tab' ? 'new-tab' : 'same-tab');
      }
      case 'getUrl':
        // The location IS the frame; the package requires `.target` on it and
        // parses what we return with `new URL()`, so hosts return an absolute string.
        return host.getUrl(data as any);
      case 'reload':
        return host.reload();

      // ── Flags / modal ──────────────────────────────────────────────────
      case 'showFlag':
        return host.showFlag(d);
      case 'closeFlag':
        return host.closeFlag(d.id);
      case 'openModal':
        return host.openModal(data);

      // ── Cross-module events (out/events/events.js) ─────────────────────
      case 'emit':
        return host.emitEvent(d.event, d.payload, false);
      case 'emitPublic':
        return host.emitEvent(d.event, d.payload, true);
      case 'on':
        return host.onEvent(d.event, d.callback, false);
      case 'onPublic':
        return host.onEvent(d.event, d.callback, true);

      // ── Realtime (out/realtime/realtime.js) ────────────────────────────
      case 'publishRealtimeChannel':
        return host.publishRealtime(d.channelName, d.eventPayload, d.options, !!d.isGlobal);
      case 'subscribeRealtimeChannel':
        return host.subscribeRealtime(d.channelName, d.onEvent, d.options, !!d.isGlobal);

      // ── Telemetry / platform ───────────────────────────────────────────
      case 'trackObjectStoreAction':
        return host.trackObjectStoreAction(data);
      case 'getFrameId':
        return host.getFrameId();
      case 'initFeatureFlags':
        return host.initFeatureFlags(d.user, d.config);
      case 'isRovoEnabled':
        return host.isRovoEnabled();
      case 'emitFrontendCustomMetric':
        return host.emitFrontendCustomMetric(d.customMetricName ?? d.name, d.value);

      default:
        if (isUnsupportedBridgeCommand(cmd)) throw bridgeNotImplementedError(cmd);
        if (cmd in BRIDGE_COMMANDS) {
          // Listed, supported, and not routed above: a dispatcher bug, which
          // the protocol test catches by driving every registry entry.
          throw new Error(`[forge-sim] Bridge command "${cmd}" is registered but the dispatcher has no route for it.`);
        }
        throw unknownBridgeCommandError(cmd);
    }
  };

  const callBridge: CallBridge = (cmd, data) => {
    options.onCall?.(cmd, data);
    // Always a Promise: real @forge/bridge awaits every call, and a thrown
    // frame error must surface as a rejection, not a sync throw.
    try {
      return Promise.resolve(route(cmd, data));
    } catch (err) {
      return Promise.reject(err);
    }
  };

  return { callBridge };
}
