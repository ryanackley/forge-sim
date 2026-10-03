/**
 * Realtime channel-key builder — browser mirror.
 *
 * ⚠️ GENERATED MIRROR of `src/realtime-channel-key.ts`. Everything below the
 * header is copied verbatim from that file. Do NOT hand-edit this file: change
 * the canonical module, then run `node scripts/sync-channel-key-mirror.mjs`.
 *
 * This duplicate exists only to cross a build boundary. The renderer is a
 * separate build whose tsconfig is `"include": ["src"]` (meaning
 * `renderer/src`), so it cannot import from the parent `src/`.
 *
 * `src/__tests__/realtime-channel-key-parity.test.ts` imports BOTH files and
 * asserts identical output over a matrix of inputs, so divergence fails CI
 * instead of silently producing a dev-mode-vs-headless scoping mismatch
 * (issue #11).
 */

/** Separator between key segments. */
const SEP = ':';

/**
 * Escape a single key segment.
 *
 * Without this the key is ambiguous, because segments are joined with `:` but
 * module keys and channel names may themselves contain `:` (every Forge module
 * key does — `jira:issuePanel`). Pre-escaping, `scopedChannelKey('a', 'b:c')`
 * and `scopedChannelKey('a:b', 'c')` both produced `scoped:a:b:c`, so two
 * logically distinct channels collided into one subscriber bucket.
 *
 * Backslash is escaped first so the two rules cannot be played against each
 * other (`a\:b` must not decode the same as a literal separator).
 *
 * Note: ordinary inputs are unchanged by this — `jira:issuePanel` becomes
 * `jira\:issuePanel`, so keys stay greppable, and only genuinely ambiguous
 * inputs change shape.
 */
function escapeSegment(segment: string): string {
  return segment.replace(/\\/g, '\\\\').replace(/:/g, '\\:');
}

// ── Context overrides ───────────────────────────────────────────────────

/**
 * The complete set of `ProductContext` values accepted by `contextOverrides`,
 * exactly as declared in `@forge/bridge/out/realtime/productContext.d.ts`:
 * Jira { board, issue, project }, Confluence { content, space },
 * Bitbucket { repository, pullRequest }.
 */
export const PRODUCT_CONTEXTS = [
  'board',
  'issue',
  'project',
  'content',
  'space',
  'repository',
  'pullRequest',
] as const;

/** String form of a ProductContext enum value. */
export type ProductContextName = (typeof PRODUCT_CONTEXTS)[number];

export function isProductContextName(value: unknown): value is ProductContextName {
  return typeof value === 'string' && (PRODUCT_CONTEXTS as readonly string[]).includes(value);
}

/**
 * Validate a `contextOverrides` array. Returns an error message when any
 * entry is not a `ProductContext`, otherwise null. The real `@forge/bridge`
 * rejects this at the type level (`ProductContext[]`); at runtime we must not
 * silently fold an unknown string into channel identity and let two bogus
 * ends "meet".
 */
export function invalidContextOverrides(contextOverrides?: readonly unknown[]): string | null {
  if (contextOverrides === undefined) return null;
  if (!Array.isArray(contextOverrides)) {
    return `Invalid contextOverrides: expected an array of ProductContext values (${PRODUCT_CONTEXTS.join(' | ')})`;
  }
  for (const entry of contextOverrides) {
    if (!isProductContextName(entry)) {
      return `Invalid contextOverrides: ${JSON.stringify(entry)} is not a ProductContext (${PRODUCT_CONTEXTS.join(' | ')})`;
    }
  }
  return null;
}

/**
 * Build the `contextOverrides` segment.
 *
 * Forge requires the overrides to "match exactly in the `subscribe()` and
 * `publish()` calls in order for messages to be received" — a subscriber with
 * `[Jira.Project]` does NOT receive from a publisher with
 * `[Jira.Project, Jira.Issue]`.
 *
 * ⚠️ ASSUMPTION: set semantics. We dedupe and sort, so `[A, B]` and `[B, A]`
 * are treated as the same channel, on the reading that these are unordered
 * context *dimensions* rather than a sequence. The docs say "match exactly",
 * which could instead mean literal array equality. If Forge turns out to be
 * order-sensitive, delete the `.sort()` — getting this wrong in either
 * direction is a parity bug (too lax = we deliver where Forge drops; too
 * strict = we drop where Forge delivers).
 */
function overridesSegment(contextOverrides: readonly string[]): string {
  const signature = [...new Set(contextOverrides)].sort().join(',');
  return `ctx(${escapeSegment(signature)})`;
}

/** True when overrides were supplied as an explicitly empty array. */
export function isGlobalByEmptyOverrides(
  contextOverrides?: readonly string[],
): boolean {
  // Docs: "if it's provided as an empty array ... the channel will not be
  // secured by any Atlassian app context values, and will be equivalent to a
  // global channel." Note this is distinct from `undefined`, which means
  // "default app-context scoping" — hence the explicit length check rather
  // than a falsy test.
  return Array.isArray(contextOverrides) && contextOverrides.length === 0;
}

// ── Realtime tokens ─────────────────────────────────────────────────────
//
// Real Forge signs a JWT. forge-sim issues a self-describing fake token so
// both the Node backend and the browser bridge shim can validate it and fold
// its claims into channel identity without a shared secret. Format:
//
//   sim-rt-token:<channel>:<base64url(JSON body)>
//
// The channel is kept in clear text for log readability; the body is what
// gets parsed. base64url never contains `:`, so the body is everything after
// the LAST separator even when the channel name itself contains `:`.

export type RealtimeTokenPermission = 'subscribe' | 'publish';

export const REALTIME_TOKEN_PERMISSIONS: readonly RealtimeTokenPermission[] = ['subscribe', 'publish'];

export interface RealtimeTokenBody {
  channel: string;
  claims: Record<string, unknown>;
  permissions: RealtimeTokenPermission[];
  /** Expiry, epoch SECONDS (JWT `exp` convention, matches docs). */
  exp: number;
}

export const TOKEN_PREFIX = 'sim-rt-token:';

/** Error strings exactly as documented in "Error handling for Realtime methods". */
export const TOKEN_ERRORS = {
  invalid: 'Realtime token validation failed: INVALID_TOKEN',
  expired: 'Realtime token validation failed: TOKEN_EXPIRED',
  channelMismatch: 'Realtime token validation failed: CHANNEL_NAME_MISMATCH',
  missingPermission: 'Realtime token validation failed: MISSING_PERMISSION',
} as const;

function base64UrlEncode(text: string): string {
  // encodeURIComponent keeps btoa within Latin-1 for any Unicode input.
  return btoa(encodeURIComponent(text)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(encoded: string): string {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (encoded.length % 4)) % 4);
  return decodeURIComponent(atob(padded));
}

/**
 * Deterministic JSON for a claims object: keys sorted recursively so
 * `{a:1,b:2}` and `{b:2,a:1}` are the same claims. Docs: "the claims object
 * must match exactly between the publisher and subscriber".
 */
export function claimsSignature(claims: Record<string, unknown>): string {
  const sortKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.keys(value as Record<string, unknown>)
          .sort()
          .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
      );
    }
    return value;
  };
  return JSON.stringify(sortKeys(claims));
}

export function encodeRealtimeToken(body: RealtimeTokenBody): string {
  return `${TOKEN_PREFIX}${body.channel}:${base64UrlEncode(JSON.stringify(body))}`;
}

/** Parse a forge-sim token. Returns null for anything malformed. */
export function parseRealtimeToken(token: unknown): RealtimeTokenBody | null {
  if (typeof token !== 'string' || !token.startsWith(TOKEN_PREFIX)) return null;
  const cut = token.lastIndexOf(':');
  if (cut <= TOKEN_PREFIX.length - 1) return null;
  try {
    const body = JSON.parse(base64UrlDecode(token.slice(cut + 1)));
    if (
      !body || typeof body !== 'object' ||
      typeof body.channel !== 'string' ||
      !body.claims || typeof body.claims !== 'object' || Array.isArray(body.claims) ||
      !Array.isArray(body.permissions) ||
      !body.permissions.every((p: unknown) => (REALTIME_TOKEN_PERMISSIONS as readonly unknown[]).includes(p)) ||
      typeof body.exp !== 'number'
    ) {
      return null;
    }
    return body as RealtimeTokenBody;
  } catch {
    return null;
  }
}

/**
 * Pre-validate a token for an operation, in the documented order. Returns
 * the documented error message, or null when the token is good.
 */
export function validateRealtimeToken(
  token: unknown,
  channel: string,
  operation: RealtimeTokenPermission,
  nowSeconds: number = Date.now() / 1000,
): string | null {
  const body = parseRealtimeToken(token);
  if (!body) return TOKEN_ERRORS.invalid;
  if (body.exp <= nowSeconds) return TOKEN_ERRORS.expired;
  if (body.channel !== channel) return TOKEN_ERRORS.channelMismatch;
  if (!body.permissions.includes(operation)) return TOKEN_ERRORS.missingPermission;
  return null;
}

/** Build the token-claims segment. Docs: a subscription "will only receive
 *  events that have been published with a token containing the same channel
 *  context claims", "in addition to" the app-context scope. */
function tokenSegment(claims: Record<string, unknown>): string {
  return `tok(${escapeSegment(claimsSignature(claims))})`;
}

// ── Keys ────────────────────────────────────────────────────────────────

/**
 * Build the key for a module-scoped subscription or publish.
 *
 * Non-empty `contextOverrides` REPLACE the module scope. Docs: "Providing
 * `contextOverrides` will completely override the default channel context",
 * which lets you "create channels that exist across different modules or
 * pages" — the worked example is a project-scoped channel shared by issue
 * panels and boards. So the module key is dropped from the key whenever
 * overrides are present; two modules with identical overrides meet.
 *
 * Keys for the common case keep their historical three-segment shape
 * (`scoped:<module>:<channel>`) so they stay readable in logs and
 * `forge_realtime_state` output. The shapes are unambiguous because a
 * channel name can never introduce an unescaped separator.
 */
export function scopedChannelKey(
  moduleKey: string,
  channel: string,
  contextOverrides?: readonly string[],
  tokenClaims?: Record<string, unknown> | null,
): string {
  const parts = ['scoped'];
  if (contextOverrides && contextOverrides.length > 0) {
    parts.push(overridesSegment(contextOverrides));
  } else {
    parts.push(escapeSegment(moduleKey));
  }
  if (tokenClaims) parts.push(tokenSegment(tokenClaims));
  parts.push(escapeSegment(channel));
  return parts.join(SEP);
}

/** Build the key for a global (unscoped) subscription or publish. */
export function globalChannelKey(
  channel: string,
  tokenClaims?: Record<string, unknown> | null,
): string {
  const parts = ['global'];
  if (tokenClaims) parts.push(tokenSegment(tokenClaims));
  parts.push(escapeSegment(channel));
  return parts.join(SEP);
}

/**
 * Resolve a channel key from an optionally-known module key.
 *
 * - Explicitly empty `contextOverrides` → the global plane, per the docs.
 * - Non-empty overrides → scoped by the overrides alone (module irrelevant).
 * - Otherwise the module key is REQUIRED. Returns `null` when the caller
 *   could not determine which module it is running in. Callers must treat
 *   that as an error ("Unauthorized request"), never widen to the global
 *   plane: docs say `publishGlobal` events "can only be received by
 *   subscriptions created using the `subscribeGlobal` bridge API".
 */
export function channelKeyFor(
  moduleKey: string | null | undefined,
  channel: string,
  contextOverrides?: readonly string[],
  tokenClaims?: Record<string, unknown> | null,
): string | null {
  if (isGlobalByEmptyOverrides(contextOverrides)) {
    return globalChannelKey(channel, tokenClaims);
  }
  if (contextOverrides && contextOverrides.length > 0) {
    return scopedChannelKey(moduleKey ?? '', channel, contextOverrides, tokenClaims);
  }
  return moduleKey ? scopedChannelKey(moduleKey, channel, undefined, tokenClaims) : null;
}
