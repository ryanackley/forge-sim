# Bundler-matrix lab

One tiny Forge app (`app/src/`: resolver + kvs + product-API backend; a
single-entry UIKit frontend; a two-entry `home`/`settings` resource sharing a
module), built by each popular bundler (`variants/*.mjs`), with every output
deployed into forge-sim as a manual-packaged (shape 2) app and exercised end
to end: deploy → resolver+kvs → product API → single render → multi-entry
renders.

Variants: `forge-webpack` (replica of `@forge/bundler` 7.3.0's webpack
config), `rspack`, `vite` (bare defaults + the canonical Forge docs
multi-entry example + an off-standard ESM backend as a negative control:
the sim must warn), `rollup`
(single-file + code-split), `parcel`, `esbuild-user` (IIFE classic +
`splitting`), `tsc-unbundled` (the docs' "plain TypeScript" shape: nothing
bundled, `node_modules` inside the package dir, nested handler path).

Canonical requirements come from Atlassian's packaging docs
(`manifest-reference/packaging/` and `/packaging/standard/`); variants note
where they deliberately sit off-standard.

This is a **lab**, not part of the test suite: it measures, on real bundler
output, where shape-2 support stands — which failures are parity bugs, which
are the irreducible "browser bundle evaluated in Node" residue, and whether
that residue justifies new architecture.

## Run it

```bash
npm run build          # repo root — the runner drives dist/
cd lab/bundler-matrix
npm install
node --import ../../dist/loader/register.js run.mjs              # all variants, stub DOM
node --import ../../dist/loader/register.js run.mjs vite rollup  # a subset
LAB_DOM=jsdom node --import ../../dist/loader/register.js run.mjs  # jsdom globals instead of the stub
```

Results land in `RESULTS-<mode>.md` / `results-<mode>.json` (gitignored —
per-machine measurements, not fixtures). Lasting findings live where they
act: parity requirements in `bundler-spec-contract.test.ts`, real bundler
output as `src/__tests__/fixtures/bundler-matrix/` (regenerated via
`export-fixtures.mjs`), and open questions in `deferred-issues.md`.
