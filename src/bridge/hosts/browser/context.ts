/**
 * Placement overrides from the page query string.
 *
 * Two forms, both of which the dev server and the modal URL builder emit:
 * the shorthands `issueKey` / `contentId` / `spaceKey`, and a full `context`
 * object as base64-encoded JSON (NOT URI-encoded JSON — `buildModalIframeURL`
 * and the dev server both btoa it).
 */
export function readContextOptionsFromUrl(): Record<string, any> | undefined {
  const params = new URLSearchParams(window.location.search);
  const result: Record<string, any> = {};
  let hasAny = false;

  for (const key of ['issueKey', 'contentId', 'spaceKey'] as const) {
    const value = params.get(key);
    if (value) { result[key] = value; hasAny = true; }
  }

  const contextB64 = params.get('context');
  if (contextB64) {
    try {
      Object.assign(result, JSON.parse(atob(contextB64)));
      hasAny = true;
    } catch {
      console.warn('[forge-sim] Failed to decode ?context param');
    }
  }
  return hasAny ? result : undefined;
}
