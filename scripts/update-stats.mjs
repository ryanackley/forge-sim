#!/usr/bin/env node
/**
 * Sync project stats (test counts, MCP tool count, etc.) into docs.
 *
 * Why: README/ROADMAP/CLAUDE.md/etc. cite hard numbers. Those numbers go stale.
 * This script reads the actual numbers from the source of truth and rewrites
 * marker blocks in markdown files.
 *
 * Usage:
 *   node scripts/update-stats.mjs            # update files in place
 *   node scripts/update-stats.mjs --check    # exit 1 if files would change (CI guard)
 *   node scripts/update-stats.mjs --print    # print computed stats and exit
 *
 * Add a marker block to any markdown file:
 *
 *   <!-- BEGIN:STATS -->
 *   ...generated content...
 *   <!-- END:STATS -->
 *
 * The block name maps to a generator below (STATS, MCP_TOOLS, etc.).
 *
 * Stats sources:
 *   - Core tests + files: `vitest run` from repo root
 *   - Renderer tests + files: `vitest run` from /renderer
 *   - MCP tool/resource count: parses src/mcp-server.ts
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

// ── Argument parsing ─────────────────────────────────────────────────────

const args = process.argv.slice(2);
const CHECK_MODE = args.includes('--check');
const PRINT_MODE = args.includes('--print');

// ── Stat collectors ──────────────────────────────────────────────────────

function runVitest(cwd) {
  // Use default reporter and parse the summary lines.
  const output = execSync('npx vitest run', {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });
  // Strip ANSI colors in case FORCE_COLOR is ignored
  const clean = output.replace(/\x1b\[[0-9;]*m/g, '');
  const filesMatch = clean.match(/Test Files\s+(\d+)\s+passed/);
  // Tests line may be "X passed (Y)" or "X passed | N todo (Y)"
  const testsMatch = clean.match(/Tests\s+(\d+)\s+passed/);
  if (!filesMatch || !testsMatch) {
    throw new Error(`Could not parse vitest output from ${cwd}:\n${clean.slice(-1000)}`);
  }
  return { tests: +testsMatch[1], files: +filesMatch[1] };
}

function countMcpSurface() {
  const src = readFileSync(join(REPO_ROOT, 'src/mcp-server.ts'), 'utf8');
  const tools = (src.match(/^\s*server\.tool\(/gm) || []).length;
  const resources = (src.match(/^\s*server\.resource\(/gm) || []).length;
  return { tools, resources };
}

function listMcpTools() {
  const src = readFileSync(join(REPO_ROOT, 'src/mcp-server.ts'), 'utf8');
  const names = [];
  // Match `server.tool(\n  'forge.xxx',` pattern
  const re = /server\.tool\(\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src)) !== null) names.push(m[1]);
  return names.sort();
}

// ── Generators (one per block name) ──────────────────────────────────────

function genStats(stats) {
  const total = stats.core.tests + stats.renderer.tests;
  const totalFiles = stats.core.files + stats.renderer.files;
  return [
    `**${total.toLocaleString()} tests** across **${totalFiles}** test files`,
    `(${stats.core.tests.toLocaleString()} core / ${stats.core.files} files`,
    `+ ${stats.renderer.tests.toLocaleString()} renderer / ${stats.renderer.files} files)`,
    ``,
    `**${stats.mcp.tools} MCP tools** + **${stats.mcp.resources} resources**`,
  ].join('\n');
}

function genStatsCompact(stats) {
  const total = stats.core.tests + stats.renderer.tests;
  return `${total.toLocaleString()} tests · ${stats.mcp.tools} MCP tools · ${stats.mcp.resources} MCP resources`;
}

function genMcpToolList(stats) {
  const tools = listMcpTools();
  return tools.map((name) => `- \`${name}\``).join('\n');
}

const GENERATORS = {
  STATS: genStats,
  STATS_COMPACT: genStatsCompact,
  MCP_TOOLS: genMcpToolList,
};

// ── File walker ──────────────────────────────────────────────────────────

const MARKDOWN_DIRS = ['', 'docs', 'proposals'];
const MARKDOWN_FILES_TOP = ['README.md', 'ROADMAP.md', 'CLAUDE.md', 'CHANGELOG.md'];

function findMarkdownFiles() {
  const files = [];
  for (const f of MARKDOWN_FILES_TOP) {
    try {
      statSync(join(REPO_ROOT, f));
      files.push(join(REPO_ROOT, f));
    } catch {/* missing, skip */}
  }
  for (const d of ['docs', 'proposals']) {
    try {
      const entries = readdirSync(join(REPO_ROOT, d));
      for (const e of entries) {
        if (e.endsWith('.md')) files.push(join(REPO_ROOT, d, e));
      }
    } catch {/* missing, skip */}
  }
  return files;
}

// Markers must start at column 0 so we don't accidentally match prose
// mentions of the syntax (e.g. CLAUDE.md teaching agents about marker blocks).
const MARKER_RE = /^<!--\s*BEGIN:([A-Z_]+)\s*-->[\s\S]*?^<!--\s*END:\1\s*-->/gm;

function rewriteFile(path, stats) {
  const original = readFileSync(path, 'utf8');
  let changed = false;
  const updated = original.replace(MARKER_RE, (full, name) => {
    const gen = GENERATORS[name];
    if (!gen) {
      console.warn(`  ⚠️  ${relative(REPO_ROOT, path)}: unknown marker BEGIN:${name}`);
      return full;
    }
    const body = gen(stats);
    const next = `<!-- BEGIN:${name} -->\n${body}\n<!-- END:${name} -->`;
    if (next !== full) changed = true;
    return next;
  });
  return { changed, original, updated };
}

// ── Main ─────────────────────────────────────────────────────────────────

function main() {
  console.log('📊 Computing stats...');

  const stats = {
    core: runVitest(REPO_ROOT),
    renderer: runVitest(join(REPO_ROOT, 'renderer')),
    mcp: countMcpSurface(),
  };

  const total = stats.core.tests + stats.renderer.tests;
  console.log(`  • Core:     ${stats.core.tests} tests / ${stats.core.files} files`);
  console.log(`  • Renderer: ${stats.renderer.tests} tests / ${stats.renderer.files} files`);
  console.log(`  • Total:    ${total} tests`);
  console.log(`  • MCP:      ${stats.mcp.tools} tools + ${stats.mcp.resources} resources`);

  if (PRINT_MODE) {
    console.log('\nFull stats object:');
    console.log(JSON.stringify(stats, null, 2));
    return;
  }

  console.log('\n📝 Scanning markdown files for marker blocks...');
  const files = findMarkdownFiles();
  let touched = 0;
  let wouldChange = 0;
  const drift = [];

  for (const f of files) {
    const { changed, original, updated } = rewriteFile(f, stats);
    if (!changed) continue;

    if (CHECK_MODE) {
      wouldChange++;
      drift.push(relative(REPO_ROOT, f));
    } else {
      writeFileSync(f, updated);
      touched++;
      console.log(`  ✓ ${relative(REPO_ROOT, f)}`);
    }
  }

  if (CHECK_MODE) {
    if (wouldChange > 0) {
      console.error(`\n❌ ${wouldChange} file(s) out of sync:`);
      for (const f of drift) console.error(`  - ${f}`);
      console.error('\nRun `node scripts/update-stats.mjs` and commit the changes.');
      process.exit(1);
    }
    console.log('\n✅ All marker blocks in sync.');
  } else {
    console.log(`\n✅ Updated ${touched} file(s).`);
  }
}

main();
