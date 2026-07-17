/**
 * Dynamic-response web trigger handler — Forge convention: (request, context).
 * userPath routes exercise the failure branches:
 *   /boom      → handler throws (should become a 500 response, not an error)
 *   /bad-shape → returns a non-WTR-009 shape (500 response)
 */
export const run = async (request: any, context: any) => {
  if (request.userPath === '/boom') {
    throw new Error('handler exploded');
  }
  if (request.userPath === '/bad-shape') {
    return { nope: true } as any;
  }
  return {
    statusCode: 200,
    headers: { 'Content-Type': ['application/json'] },
    body: JSON.stringify({
      method: request.method,
      path: request.path,
      query: request.queryParameters,
      contentType: request.headers['content-type'] ?? null,
      echo: request.body ? JSON.parse(request.body) : null,
      hasContext: Boolean(context?.installContext),
    }),
  };
};
