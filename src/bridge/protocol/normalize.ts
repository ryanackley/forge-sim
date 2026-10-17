/**
 * Frame normalizers — the places where real `@forge/bridge`'s wire shape
 * differs from what a backend wants. Each one is a measured fact about the
 * installed package (file reference in the comment), not a guess.
 */

/**
 * Real `@forge/bridge` serializes request headers as `[...headers.entries()]`
 * — an array of [name, value] pairs — before crossing the bridge
 * (out/fetch/fetch.js, parseRequest). Backends take a record; spreading an
 * array into one yields numeric keys. Records and undefined pass through.
 */
export function normalizeBridgeHeaders(headers: unknown): Record<string, string> | undefined {
  if (headers == null) return undefined;
  if (Array.isArray(headers)) {
    const out: Record<string, string> = {};
    for (const pair of headers) {
      if (Array.isArray(pair) && pair.length >= 2) out[String(pair[0])] = String(pair[1]);
    }
    return out;
  }
  if (typeof headers === 'object') return headers as Record<string, string>;
  return undefined;
}

/**
 * Classify the `invokeType` marker real `@forge/bridge` puts on the SAME
 * 'invoke' command for endpoint calls (out/invoke-endpoint/invoke-endpoint.js):
 * `ui-remote-fetch` for invokeRemote, `ui-container-fetch` for invokeService.
 * Resolver invokes carry no marker. Anything else is treated as a resolver
 * call so a future marker degrades to today's behaviour instead of vanishing.
 */
export function parseInvokeType(invokeType: unknown): 'remote' | 'container' | null {
  if (typeof invokeType !== 'string') return null;
  const m = /^ui-(remote|container)-fetch$/.exec(invokeType);
  return m ? (m[1] as 'remote' | 'container') : null;
}

/**
 * `view.submit(payload)` / `view.close(payload)` send the BARE payload
 * (out/view/submit.js), while forge-sim's own older shim sent `{ payload }`.
 * Accept both; prefer the wrapped form only when it is unambiguous.
 */
export function unwrapViewPayload(data: unknown): unknown {
  if (data && typeof data === 'object' && 'payload' in (data as Record<string, unknown>)) {
    const keys = Object.keys(data as Record<string, unknown>);
    if (keys.length === 1) return (data as { payload: unknown }).payload;
  }
  return data;
}
