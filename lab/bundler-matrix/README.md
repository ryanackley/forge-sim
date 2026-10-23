# bundler-matrix fixture generator

This package exists to (re)generate `src/__tests__/fixtures/bundler-matrix/`
— real output from every popular bundler, checked into the suite so
`bundler-matrix-fixtures.test.ts` can deploy it in CI without installing a
single bundler. The ~400 MB of webpack/Vite/Parcel/Rspack/Rollup dev
dependencies live here, outside the root install, and the fixtures are
unreproducible blobs without this directory: one tiny Forge app
(`app/src/`: resolver + kvs + product-API backend, a single-entry UI Kit
frontend, a two-entry `home`/`settings` resource sharing a module) built by
each config under `variants/`.

Variants: `forge-webpack` (replica of `@forge/bundler` 7.3.0's config, read
off the installed package — the same modules `bundler-spec-contract.test.ts`
asserts against), `rspack` (minified), `vite` (bare defaults + the Forge
docs' canonical multi-entry example + a deliberately off-standard ESM
backend, kept as the negative control for the CommonJS deploy warning),
`rollup` (single-file + code-split), `parcel` (zero-config: unquoted
attributes, importmaps, shared bundles), `esbuild-user` (minified IIFE
classic script + `splitting`), `tsc-unbundled` (the docs' "plain TypeScript"
layout: nothing bundled, `node_modules` inside `app.package.path`, nested
handler path). Canonical requirements come from Atlassian's packaging docs
(`manifest-reference/packaging/` and `/packaging/standard/`).

## Regenerate the fixtures

```bash
cd lab/bundler-matrix
npm install
node export-fixtures.mjs               # all variants
node export-fixtures.mjs vite rollup   # a subset
```

Then run the suite to verify: `npx vitest run src/__tests__/bundler-matrix-fixtures.test.ts`
(from the repo root). Re-run after bumping `@forge/react`/`@forge/bridge`
(their code is inlined in the fixtures) or a bundler here.

History: this directory began as the measurement lab for the shape-2
reliability arc — it also had a sim-driving runner and a jsdom-globals
experiment, both retired once the findings landed as contract tests and
fixes (see git history of `run.mjs` / `jsdom-preload.mjs` to revive them).
