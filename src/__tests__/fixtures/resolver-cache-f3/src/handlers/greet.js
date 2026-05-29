// Transitive resolver handler — the test rewrites this file mid-flight
// to verify that forge_reset() + forge_deploy() picks up the new code.
export function greet(req) {
  return { message: 'hello v1' };
}
