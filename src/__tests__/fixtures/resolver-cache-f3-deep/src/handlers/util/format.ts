// Depth-3 helper — the deepest file in the import chain. F3 must
// surface edits here too, otherwise the iterate loop only "works"
// when you edit the top-level handler.
export function format(s: string): string {
  return `[v1] ${s}`;
}
