/**
 * Static-response web trigger handler (WTR-011): returns an outputKey that
 * selects one of the manifest-configured outputs.
 *   ?state=down    → 'down' output (503)
 *   ?state=missing → unknown outputKey (500 with available list)
 *   default        → 'up' output (200)
 */
export const run = async (request: any) => {
  const state = request.queryParameters?.state?.[0] ?? 'up';
  if (state === 'missing') return { outputKey: 'nope' };
  return { outputKey: state === 'down' ? 'down' : 'up' };
};
