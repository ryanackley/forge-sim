/**
 * Extract the app UUID from a Forge app ARI.
 *
 * Real Forge `app.id` in the manifest is the full ARI string:
 *   ari:cloud:ecosystem::app/d9022ad7-c220-4836-b1d1-7f9f2c633d3a
 *
 * Custom app event AVIs require just the UUID portion. Returns the substring
 * after the last `/`. If the input has no `/`, returns the whole string —
 * tolerant of legacy/test fixtures that use a short id.
 *
 * Lives outside src/shims/ on purpose: everything exported from a shim file IS
 * that @forge package's public surface, and real @forge/events has no such
 * export (enforced by shim-contract-surface.test.ts).
 */
export function extractAppIdUuid(appAri: string | undefined): string {
  if (!appAri) return 'unknown';
  const slash = appAri.lastIndexOf('/');
  return slash >= 0 ? appAri.slice(slash + 1) : appAri;
}
