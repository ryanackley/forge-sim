// Bundler-matrix lab runner.
//
// For each variant: build the same tiny Forge app with that bundler, assemble
// a manual-packaged (shape 2) app dir around the output, deploy it into the
// simulator, exercise the backend seams (resolver + kvs + product API), the
// single-entry headless UI render and — where the variant builds one — the
// multi-entry resource (home/settings), and record every phase.
//
// Run from this directory, after `npm run build` at the repo root:
//   node --import ../../dist/loader/register.js run.mjs [variant ...]
//   LAB_DOM=jsdom node --import ../../dist/loader/register.js run.mjs
import './jsdom-preload.mjs';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile, readFile, readdir, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createSimulator } from '../../dist/index.js';

const lab = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.env.LAB_DOM === 'jsdom' ? 'jsdom' : 'stub';

const VARIANTS = [
  { name: 'forge-webpack', pkgType: 'commonjs', backend: 'self', backendFile: 'out/index.cjs', multi: true,
    blurb: 'webpack 5 with @forge/bundler 7.3.0’s exact config (replica): unminified CJS .cjs backend, classic-script frontend, publicPath auto, classic JSX; multi-entry with splitChunks all' },
  { name: 'rspack', pkgType: 'commonjs', backend: 'self', backendFile: 'out/index.js', multi: true,
    blurb: 'Rspack production defaults: MINIFIED CJS backend, minified classic-script frontend, publicPath auto, classic JSX; multi-entry with splitChunks all' },
  { name: 'vite', pkgType: 'module', backend: 'self', backendFile: 'out/index.js', multi: true,
    blurb: 'Vite: single = bare defaults (ABSOLUTE src, automatic JSX, modulepreload polyfill); multi = the CANONICAL Forge docs example (plugin-react classic JSX, base ./, StrictMode); backend = OFF-STANDARD ESM .js + type:module probe' },
  { name: 'rollup', pkgType: 'commonjs', backend: 'self', backendFile: 'out/index.js', multi: true,
    blurb: 'Rollup: CJS backend, single-file ESM frontend, code-split multi-entry (shared + lazy chunks under chunks/), classic JSX' },
  { name: 'parcel', pkgType: 'commonjs', backend: 'ref', backendFile: 'out/index.js', multi: true,
    blurb: 'Parcel 2 zero-config from the HTML entries (frontend only; reference esbuild backend); automatic JSX (off-standard wording)' },
  { name: 'esbuild-user', pkgType: 'commonjs', backend: 'self', backendFile: 'out/index.js', multi: true,
    blurb: 'user-run esbuild: minified CJS backend, minified IIFE classic-script single frontend, ESM `splitting` multi-entry; classic JSX' },
  { name: 'tsc-unbundled', pkgType: 'commonjs', backend: 'self', backendFile: 'out/resolvers/main.js',
    handler: 'resolvers/main.handler', multi: false,
    blurb: 'the docs’ "Plain TypeScript on the backend" shape: transpile-only CJS, NOTHING bundled, node_modules inside app.package.path, nested handler path' },
];

function manifestFor(v) {
  const handler = v.handler ?? 'index.handler';
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
      handler: ${handler}
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

// ── helpers ──────────────────────────────────────────────────────────────

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function buildReferenceBackend(outFile) {
  const esbuild = await import('esbuild');
  await esbuild.build({
    entryPoints: [path.join(lab, 'app', 'src', 'backend.js')],
    bundle: true, platform: 'node', format: 'cjs', outfile: outFile, logLevel: 'silent',
  });
}

function sniffFormat(code) {
  if (/^\s*(?:import|export)\b/m.test(code)) return 'esm';
  if (/\bmodule\.exports\b|\bexports\.[A-Za-z_$]/.test(code)) return 'cjs';
  return 'script (iife/classic)';
}

async function listJs(dir) {
  const out = [];
  if (!(await exists(dir))) return out;
  for (const entry of await readdir(dir, { recursive: true })) {
    if (entry.endsWith('.js') && !entry.includes('node_modules')) out.push(entry);
  }
  return out.sort();
}

async function scriptTags(htmlPath) {
  if (!(await exists(htmlPath))) return ['(missing)'];
  const html = await readFile(htmlPath, 'utf8');
  const tags = [...html.matchAll(/<script\b[^>]*>/gi)].map((m) => m[0]);
  return tags.length ? tags : ['(none)'];
}

async function inspectArtifacts(dir, v) {
  const notes = {};
  const backendPath = path.join(dir, v.backendFile);
  if (await exists(backendPath)) {
    const code = await readFile(backendPath, 'utf8');
    const bare = [...code.matchAll(/require\(\s*["'](@forge\/[\w-]+)["']\s*\)/g)].map((m) => m[1]);
    notes.backend = `${v.backendFile} · ${sniffFormat(code)} · ${(code.length / 1024).toFixed(0)} KB · pkg type ${v.pkgType}` +
      (bare.length ? ` · bare requires at runtime: ${[...new Set(bare)].join(', ')}` : ' · fully inlined');
  }
  notes.single = { files: await listJs(path.join(dir, 'frontend')), tags: await scriptTags(path.join(dir, 'frontend', 'index.html')) };
  if (v.multi) {
    notes.multi = {
      files: await listJs(path.join(dir, 'frontend-multi')),
      home: await scriptTags(path.join(dir, 'frontend-multi', 'home.html')),
      settings: await scriptTags(path.join(dir, 'frontend-multi', 'settings.html')),
    };
  }
  return notes;
}

async function phase(record, name, fn) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    record.phases[name] = { ok: true, ms: Date.now() - t0, ...(detail ? { detail } : {}) };
    return true;
  } catch (err) {
    record.phases[name] = { ok: false, ms: Date.now() - t0, error: String(err?.message ?? err).slice(0, 700) };
    return false;
  }
}

// ── per-variant run ──────────────────────────────────────────────────────

async function runVariant(v) {
  const dir = path.join(lab, 'build', v.name);
  const record = { variant: v.name, blurb: v.blurb, phases: {}, warnings: [] };

  const build = spawnSync('node', [path.join(lab, 'variants', `${v.name}.mjs`)], { cwd: lab, encoding: 'utf8', timeout: 300_000 });
  if (build.status !== 0) {
    record.phases.build = { ok: false, error: (build.stderr || build.stdout || 'unknown').slice(-900) };
    return record;
  }
  record.phases.build = { ok: true };

  if (v.backend === 'ref') await buildReferenceBackend(path.join(dir, v.backendFile));

  await writeFile(path.join(dir, 'manifest.yml'), manifestFor(v));
  await writeFile(path.join(dir, 'package.json'),
    JSON.stringify({ name: `lab-${v.name}`, private: true, ...(v.pkgType === 'module' ? { type: 'module' } : {}) }));
  await rm(path.join(dir, '.forge-sim'), { recursive: true, force: true });

  record.artifacts = await inspectArtifacts(dir, v);

  const realWarn = console.warn;
  console.warn = (...args) => {
    const line = args.map(String).join(' ');
    if (line.includes('[forge-sim]') && !line.includes('Runtime mismatch')) record.warnings.push(line.slice(0, 400));
    realWarn(...args);
  };

  const sim = createSimulator();
  try {
    sim.mockProductRoutes('jira', { '/rest/api/3/issue/LAB-1': { key: 'LAB-1', fields: { summary: 'From the mocked Jira' } } });

    const deployed = await phase(record, 'deploy', async () => { await sim.deploy(dir, { fireScheduledTriggers: false }); });
    if (!deployed) return record;

    await phase(record, 'resolver+kvs', async () => {
      const r = await sim.invoke('save', { id: 'a1' });
      if (r !== 'saved a1') throw new Error(`unexpected invoke result: ${JSON.stringify(r)}`);
      const stored = await sim.kvs.get('saved:a1');
      if (stored?.by !== 'matrix-backend') throw new Error(`kvs read-back wrong: ${JSON.stringify(stored)}`);
    });

    await phase(record, 'product-api', async () => {
      const r = await sim.invoke('issue', { key: 'LAB-1' });
      if (r !== 'From the mocked Jira') throw new Error(`unexpected: ${JSON.stringify(r)}`);
    });

    await phase(record, 'ui-single', async () => {
      const doc = await sim.ui.waitForContent('panel', 'ui saved by matrix-backend', 20_000);
      return `"${sim.ui.getTextContent(doc).slice(0, 80)}"`;
    });

    if (v.multi) {
      await phase(record, 'ui-home', async () => {
        const doc = await sim.ui.waitForContent('page-home', 'entry:home', 20_000);
        return `"${sim.ui.getTextContent(doc).slice(0, 80)}"`;
      });
      await phase(record, 'ui-settings', async () => {
        const doc = await sim.ui.waitForContent('page-settings', 'entry:settings', 20_000);
        return `"${sim.ui.getTextContent(doc).slice(0, 80)}"`;
      });
    }
  } finally {
    console.warn = realWarn;
    await sim.stop().catch(() => {});
  }
  return record;
}

// ── report ───────────────────────────────────────────────────────────────

const COLS = ['build', 'deploy', 'resolver+kvs', 'product-api', 'ui-single', 'ui-home', 'ui-settings'];
const cell = (p) => (p ? (p.ok ? '✅' : '❌') : '—');

function toMarkdown(results) {
  let md = `# Bundler matrix — results (${MODE} DOM)\n\n`;
  md += `Run: ${new Date().toISOString()} · node ${process.version} · headless environment: ${MODE}\n\n`;
  md += `| variant | ${COLS.join(' | ')} |\n|---|${COLS.map(() => '---').join('|')}|\n`;
  for (const r of results) md += `| ${r.variant} | ${COLS.map((c) => cell(r.phases[c])).join(' | ')} |\n`;
  md += '\n';
  for (const r of results) {
    md += `## ${r.variant}\n\n${r.blurb}\n\n`;
    const a = r.artifacts;
    if (a) {
      if (a.backend) md += `- backend: ${a.backend}\n`;
      md += `- single: files [${a.single.files.join(', ')}]\n`;
      for (const t of a.single.tags) md += `  - \`${t}\`\n`;
      if (a.multi) {
        md += `- multi: files [${a.multi.files.join(', ')}]\n`;
        md += `  - home.html:\n`; for (const t of a.multi.home) md += `    - \`${t}\`\n`;
        md += `  - settings.html:\n`; for (const t of a.multi.settings) md += `    - \`${t}\`\n`;
      }
    }
    for (const [name, p] of Object.entries(r.phases)) {
      if (!p.ok) md += `- ❌ **${name}**: ${p.error}\n`;
      else if (p.detail) md += `- ✅ ${name}: ${p.detail}\n`;
    }
    for (const w of r.warnings) md += `- ⚠️ ${w}\n`;
    md += '\n';
  }
  return md;
}

const only = process.argv.slice(2);
const selected = only.length ? VARIANTS.filter((v) => only.includes(v.name)) : VARIANTS;
const results = [];
for (const v of selected) {
  console.log(`\n═══ ${v.name} ═══`);
  results.push(await runVariant(v));
}

await mkdir(path.join(lab, 'build'), { recursive: true });
await writeFile(path.join(lab, `results-${MODE}.json`), JSON.stringify(results, null, 2));
await writeFile(path.join(lab, `RESULTS-${MODE}.md`), toMarkdown(results));
console.log('\n' + toMarkdown(results));
process.exit(0);
