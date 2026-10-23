// THE generator for src/__tests__/fixtures/bundler-matrix/: builds the same
// tiny Forge app with every bundler in variants/, assembles each output as a
// manual-packaged app (manifest.yml + package.json around the built out/ and
// frontend dirs), and copies the result into the test suite — minus source
// maps, node_modules (bundler-matrix-fixtures.test.ts recreates the
// tsc-unbundled symlink) and dangling sourceMappingURL comments. The suite
// never installs a bundler; this package holds them all.
//
//   npm install && node export-fixtures.mjs            # all variants
//   node export-fixtures.mjs vite rollup               # a subset
import { spawnSync } from 'node:child_process';
import { cp, rm, mkdir, readdir, stat, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const lab = path.dirname(fileURLToPath(import.meta.url));
const dest = path.resolve(lab, '..', '..', 'src', '__tests__', 'fixtures', 'bundler-matrix');

// pkgType/handler mirror what each bundler actually produced; `multi` adds
// the two-entry home/settings resource; backend 'ref' fills a frontend-only
// bundler with a reference esbuild backend. Vite's ESM backend is the
// negative control — the suite asserts the CommonJS deploy warning fires.
const VARIANTS = [
  { name: 'forge-webpack', pkgType: 'commonjs', backend: 'self', handler: 'index.handler', multi: true },
  { name: 'rspack', pkgType: 'commonjs', backend: 'self', handler: 'index.handler', multi: true },
  { name: 'vite', pkgType: 'module', backend: 'self', handler: 'index.handler', multi: true },
  { name: 'rollup', pkgType: 'commonjs', backend: 'self', handler: 'index.handler', multi: true },
  { name: 'parcel', pkgType: 'commonjs', backend: 'ref', handler: 'index.handler', multi: true },
  { name: 'esbuild-user', pkgType: 'commonjs', backend: 'self', handler: 'index.handler', multi: true },
  { name: 'tsc-unbundled', pkgType: 'commonjs', backend: 'self', handler: 'resolvers/main.handler', multi: false },
];

function manifestFor(v) {
  const multiModules = v.multi ? `
    - key: page-home
      resource: multi/home
      render: native
      title: Home
      icon: https://example.com/i.svg
      resolver:
        function: main-fn
    - key: page-settings
      resource: multi/settings
      render: native
      title: Settings
      icon: https://example.com/i.svg
      resolver:
        function: main-fn` : '';
  const multiResource = v.multi ? `
  - key: multi
    bundler: manual@2026
    path: frontend-multi
    entry:
      home: home.html
      settings: settings.html` : '';
  return `
app:
  id: ari:cloud:ecosystem::app/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee
  runtime:
    name: nodejs22.x
  package:
    bundler: manual@2026
    path: out
modules:
  jira:issuePanel:
    - key: panel
      resource: main
      render: native
      title: Matrix Panel
      icon: https://example.com/i.svg
      resolver:
        function: main-fn${multiModules}
  function:
    - key: main-fn
      handler: ${v.handler}
resources:
  - key: main
    bundler: manual@2026
    path: frontend${multiResource}
permissions:
  scopes:
    - storage:app
    - read:jira-work
`;
}

async function buildReferenceBackend(outFile) {
  const esbuild = await import('esbuild');
  await esbuild.build({
    entryPoints: [path.join(lab, 'app', 'src', 'backend.js')],
    bundle: true, platform: 'node', format: 'cjs', outfile: outFile, logLevel: 'silent',
  });
}

const SKIP = (p) => /\.map$/.test(p) || /\/node_modules(\/|$)/.test(p) || /\/\.forge-sim(\/|$)/.test(p);

const only = process.argv.slice(2);
for (const v of only.length ? VARIANTS.filter((x) => only.includes(x.name)) : VARIANTS) {
  const build = spawnSync('node', [path.join(lab, 'variants', `${v.name}.mjs`)], { cwd: lab, encoding: 'utf8', timeout: 300_000 });
  if (build.status !== 0) {
    console.error(`${v.name}: BUILD FAILED\n${(build.stderr || build.stdout).slice(-800)}`);
    process.exitCode = 1;
    continue;
  }
  const from = path.join(lab, 'build', v.name);
  if (v.backend === 'ref') await buildReferenceBackend(path.join(from, 'out', 'index.js'));
  await writeFile(path.join(from, 'manifest.yml'), manifestFor(v));
  await writeFile(path.join(from, 'package.json'),
    JSON.stringify({ name: `lab-${v.name}`, private: true, ...(v.pkgType === 'module' ? { type: 'module' } : {}) }));

  const to = path.join(dest, v.name);
  await rm(to, { recursive: true, force: true });
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from)) {
    if (SKIP(path.join(from, entry))) continue;
    await cp(path.join(from, entry), path.join(to, entry), { recursive: true, filter: (s) => !SKIP(s) });
  }
  // The .map files are not copied, so drop the comments that point at them —
  // otherwise every import under vitest logs a failed source-map read.
  for (const file of await readdir(to, { recursive: true })) {
    if (!file.endsWith('.js')) continue;
    const f = path.join(to, file);
    const code = await readFile(f, 'utf8');
    const stripped = code.replace(/^\/\/[#@] sourceMappingURL=(?!data:).*$\n?/gm, '');
    if (stripped !== code) await writeFile(f, stripped);
  }
  console.log(`exported ${v.name}`);
}
// tsc-unbundled keeps its deps in out/node_modules per the Forge docs; the
// fixture can't check a machine path in, so the test symlinks it. Keep the
// placeholder ignore so a locally created link never shows up in git.
await writeFile(path.join(dest, 'tsc-unbundled', 'out', '.gitignore'), 'node_modules\n');
await writeFile(path.join(dest, 'README.md'), `# bundler-matrix fixtures

Generated by \`lab/bundler-matrix/export-fixtures.mjs\` — do not hand-edit.
Each directory is one bundler's output for the same tiny Forge app
(\`lab/bundler-matrix/app/src\`), laid out as a manual-packaged app:
\`manifest.yml\`, \`package.json\`, \`out/\` (backend), \`frontend/\` (single-entry
UI Kit) and, where the bundler built one, \`frontend-multi/\` (home/settings).
Deployed and rendered by \`bundler-matrix-fixtures.test.ts\`.

Regenerate: \`cd lab/bundler-matrix && npm install && node export-fixtures.mjs\`.
`);
console.log('wrote README');
