// Transitive helper — the test rewrites this file mid-flight to verify a
// second dev deploy pass picks up the new code (F3 in the dev path).
export function greet() {
  return { message: 'dev v1' };
}
