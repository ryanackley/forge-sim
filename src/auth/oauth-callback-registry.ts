/**
 * OAuthCallbackRegistry
 *
 * Tracks in-flight OAuth flows keyed by their `state` parameter and dispatches
 * incoming callbacks to the right pending flow. Replaces the two duplicate
 * `waitForCallback` implementations (external-auth-store.ts + external-auth-command.ts),
 * each of which spun up its own throwaway HTTP server.
 *
 * The registry itself is pure data + dispatch logic — it does NOT bind any
 * port. The dev server (or the standalone-callback-host fallback) owns the
 * HTTP listener and forwards callbacks to `registry.handle({...})`.
 *
 * Pending flows are in-memory only — they live ~5 minutes between
 * `register()` and the callback firing. Persistent OAuth state (tokens,
 * provider secrets) lives on disk in the CredentialStore / providers.json,
 * untouched by this registry.
 */

import { randomBytes } from 'node:crypto';

// ── Constants ───────────────────────────────────────────────────────────

/** Mounted on the dev server's tools router; also used by the standalone fallback. */
export const OAUTH_CALLBACK_PATH = '/__tools/oauth/callback';

/** Default port (matches the dev server). */
export const OAUTH_CALLBACK_PORT = 5173;

/** 5 minutes — matches the prior `waitForCallback` implementations. */
export const OAUTH_DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

// ── Types ───────────────────────────────────────────────────────────────

/**
 * Caller-supplied closure that handles the authorization code (exchange,
 * token storage, side effects). If it throws, the registered promise rejects
 * and the callback page renders a failure card.
 */
export type OnCodeHandler = (code: string) => Promise<void>;

export interface PendingFlow {
  providerKey: string;
  onCode: OnCodeHandler;
  resolve: () => void;
  reject: (err: Error) => void;
  timeoutId: NodeJS.Timeout;
  createdAt: number;
}

export interface RegisterOptions {
  /** Provider key (e.g. "google", "github") — for log/UI context. */
  providerKey: string;
  /** Called when a matching callback arrives with a `code`. */
  onCode: OnCodeHandler;
  /**
   * Override the default 5-minute timeout. Useful in tests.
   */
  timeoutMs?: number;
  /**
   * Override the redirect URI host/port. Defaults to
   * `http://localhost:5173/__tools/oauth/callback`.
   * The standalone fallback may pass a different port if 5173 is taken.
   */
  redirectUri?: string;
}

export interface RegisterResult {
  /** Random state token — pass to the auth URL. */
  state: string;
  /** Full redirect URI the provider should call back to. */
  redirectUri: string;
  /** Resolves on success, rejects on error/timeout/cancel. */
  promise: Promise<void>;
}

export interface HandleParams {
  state: string;
  code?: string;
  error?: string;
}

export interface HandleResult {
  status: number;
  html: string;
}

// ── Registry ────────────────────────────────────────────────────────────

export class OAuthCallbackRegistry {
  private pending = new Map<string, PendingFlow>();

  /**
   * Register a new pending OAuth flow. Returns the state token to embed in
   * the auth URL, the redirect URI to send, and a promise that settles when
   * the callback fires (or rejects on timeout/error/cancel).
   */
  register(opts: RegisterOptions): RegisterResult {
    const state = randomBytes(16).toString('hex');
    const redirectUri = opts.redirectUri ??
      `http://localhost:${OAUTH_CALLBACK_PORT}${OAUTH_CALLBACK_PATH}`;
    const timeoutMs = opts.timeoutMs ?? OAUTH_DEFAULT_TIMEOUT_MS;

    let resolve!: () => void;
    let reject!: (err: Error) => void;
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    const timeoutId = setTimeout(() => {
      const flow = this.pending.get(state);
      if (flow) {
        this.pending.delete(state);
        flow.reject(new Error(
          `OAuth timeout — no callback received within ${Math.round(timeoutMs / 1000)}s for "${opts.providerKey}"`,
        ));
      }
    }, timeoutMs);
    // Don't keep the process alive solely on this timer.
    if (typeof timeoutId.unref === 'function') timeoutId.unref();

    this.pending.set(state, {
      providerKey: opts.providerKey,
      onCode: opts.onCode,
      resolve,
      reject,
      timeoutId,
      createdAt: Date.now(),
    });

    return { state, redirectUri, promise };
  }

  /**
   * Process a callback. Returns the HTTP status + HTML page to render in the
   * browser. Resolves/rejects the matching pending flow as a side effect.
   *
   * Behavior:
   * - Unknown `state` → 400 + invalid-callback page. Registry untouched.
   * - `error` param → 200 + failure card. Pending flow rejects.
   * - Valid `code` + `onCode` succeeds → 200 + success card. Pending flow resolves.
   * - Valid `code` + `onCode` throws → 200 + failure card. Pending flow rejects.
   */
  async handle(params: HandleParams): Promise<HandleResult> {
    const flow = this.pending.get(params.state);

    if (!flow) {
      return {
        status: 400,
        html: callbackHtml('❌ Invalid callback', 'State mismatch or missing code.'),
      };
    }

    // Provider returned an error param (user denied, scope issue, etc.).
    if (params.error) {
      this.cleanup(params.state);
      flow.reject(new Error(`OAuth error: ${params.error}`));
      return {
        status: 200,
        html: callbackHtml('❌ Authorization failed', escapeHtml(params.error)),
      };
    }

    if (!params.code) {
      // State matched but no code and no error — treat as malformed.
      this.cleanup(params.state);
      flow.reject(new Error('OAuth callback missing code parameter'));
      return {
        status: 400,
        html: callbackHtml('❌ Invalid callback', 'Missing authorization code.'),
      };
    }

    // Exchange + store via the caller's closure.
    try {
      await flow.onCode(params.code);
    } catch (err: any) {
      this.cleanup(params.state);
      flow.reject(err instanceof Error ? err : new Error(String(err)));
      return {
        status: 200,
        html: callbackHtml('❌ Authorization failed', escapeHtml(err?.message ?? String(err))),
      };
    }

    this.cleanup(params.state);
    flow.resolve();
    return {
      status: 200,
      html: callbackHtml('✅ Authorized!', 'You can close this tab.', { autoClose: true }),
    };
  }

  /**
   * Reject every pending flow. Used on dev-server shutdown.
   */
  cancelAll(reason = 'OAuth flow cancelled'): void {
    for (const [state, flow] of this.pending) {
      clearTimeout(flow.timeoutId);
      flow.reject(new Error(reason));
      this.pending.delete(state);
    }
  }

  /** Number of in-flight flows. Useful for tests + diagnostics. */
  size(): number {
    return this.pending.size;
  }

  /** List provider keys with in-flight flows. Diagnostics only. */
  listProviders(): string[] {
    return Array.from(this.pending.values()).map((f) => f.providerKey);
  }

  private cleanup(state: string): void {
    const flow = this.pending.get(state);
    if (flow) {
      clearTimeout(flow.timeoutId);
      this.pending.delete(state);
    }
  }
}

// ── Module singleton ────────────────────────────────────────────────────

let _registry: OAuthCallbackRegistry | undefined;

/**
 * The process-wide registry. Single instance shared by:
 *  - The dev server route at `/__tools/oauth/callback`
 *  - The standalone callback host (CLI fallback when dev isn't running)
 *  - Any flow initiator (ExternalAuthStore, the auth CLI command)
 */
export function getOAuthCallbackRegistry(): OAuthCallbackRegistry {
  if (!_registry) _registry = new OAuthCallbackRegistry();
  return _registry;
}

/** Test-only — reset the singleton between specs. */
export function _resetOAuthCallbackRegistryForTests(): void {
  if (_registry) _registry.cancelAll('Registry reset for tests');
  _registry = undefined;
}

// ── HTML helpers ────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface CallbackHtmlOptions {
  /** If true, include a script that auto-closes the tab (popup OAuth). */
  autoClose?: boolean;
}

export function callbackHtml(
  title: string,
  message: string,
  opts: CallbackHtmlOptions = {},
): string {
  const closeScript = opts.autoClose
    ? `<script>setTimeout(()=>{try{window.close()}catch(e){}},1500)</script>`
    : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>forge-sim</title>
<style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#1a1a2e;color:#e0e0e0}
.card{text-align:center;padding:2rem;border-radius:8px;background:#16213e;box-shadow:0 4px 12px rgba(0,0,0,.3)}
h1{margin:0 0 .5rem}</style></head>
<body><div class="card"><h1>${title}</h1><p>${message}</p></div>${closeScript}</body></html>`;
}
