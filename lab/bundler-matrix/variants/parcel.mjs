// Parcel 2, zero config, from the HTML entries — the bundler whose production
// optimizer emits unquoted script attributes, importmaps and multi-entry
// shared bundles. JSX stays on Parcel's auto-detected automatic runtime (no
// tsconfig in the lab), which is OFF the standard's createElement wording.
// Frontend only; the backend comes from the reference esbuild build.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const lab = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(lab, 'app', 'src');
const outDir = path.join(lab, 'build', 'parcel');
const parcel = path.join(lab, 'node_modules', '.bin', 'parcel');

function run(args) {
  const res = spawnSync(parcel, args, { cwd: lab, encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`parcel build failed:\n${res.stdout}\n${res.stderr}`);
}

run(['build', path.join(src, 'index.html'), '--dist-dir', path.join(outDir, 'frontend'), '--public-url', './', '--no-cache']);
run(['build', path.join(src, 'home.html'), path.join(src, 'settings.html'), '--dist-dir', path.join(outDir, 'frontend-multi'), '--public-url', './', '--no-cache']);

console.log('parcel: built');
