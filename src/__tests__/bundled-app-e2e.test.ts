/**
 * The migration's premise, proven end to end: a backend that BUNDLES every
 * `@forge/*` package into its output — "shape 2", the output `forge deploy`
 * itself produces — runs against the simulator through nothing but the three
 * globals the Forge runtime injects. No bare `@forge/*` specifier survives in
 * the app, so no module loader, alias or shim can be involved; if anything
 * here works, it works because the seams are complete.
 *
 * The app is manual-packaged (`app.package.bundler: manual@2026`), so
 * forge-sim imports the shipped output AS-IS, exactly as real Forge does —
 * this test exercises the real packages' own HTTP clients (kvs, events, api)
 * talking to `global.__forge_fetch__`, the reconciler and `@forge/bridge`
 * talking to `globalThis.__bridge`, and `@forge/resolver`'s dispatch closure
 * being detected rather than shimmed. Every slice of the migration is on the
 * path: 5a built the sim's own deploys the same way; this is the user-built
 * equivalent the plan parked under "After Phase 4".
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createSimulator, type ForgeSimulator } from '../simulator.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

const MANIFEST = `
app:
  id: ari:cloud:ecosystem::app/22222222-3333-4444-5555-666666666666
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
      title: Panel
      icon: https://example.com/i.svg
      resolver:
        function: main-fn
  consumer:
    - key: worker
      queue: jobs
      function: worker-fn
  trigger:
    - key: on-issue
      function: trigger-fn
      events:
        - avi:jira:created:issue
  webtrigger:
    - key: hook
      function: hook-fn
  function:
    - key: main-fn
      handler: index.handler
    - key: worker-fn
      handler: index.worker
    - key: trigger-fn
      handler: index.onIssue
    - key: hook-fn
      handler: index.hook
resources:
  - key: main
    bundler: manual@2026
    path: frontend
permissions:
  scopes:
    - storage:app
    - read:jira-work
`;

/** Every backend surface in one file, all four packages imported bare and then inlined. */
const BACKEND_SRC = `
import Resolver from '@forge/resolver';
import { kvs } from '@forge/kvs';
import { Queue } from '@forge/events';
import { requestJira, route } from '@forge/api';

const jobs = new Queue({ key: 'jobs' });
const resolver = new Resolver();

resolver.define('save', async ({ payload }) => {
  await kvs.set('saved:' + payload.id, { id: payload.id, by: 'bundled-backend' });
  return 'saved ' + payload.id;
});
resolver.define('enqueue', async ({ payload }) => {
  await jobs.push({ body: { id: payload.id } });
  return 'queued ' + payload.id;
});
resolver.define('issue', async ({ payload }) => {
  const res = await requestJira(route\`/rest/api/3/issue/\${payload.key}\`);
  const data = await res.json();
  return data.fields.summary;
});
resolver.define('summary', async () => {
  const saved = await kvs.get('saved:ui');
  return saved ? 'ui saved by ' + saved.by : 'nothing saved';
});
export const handler = resolver.getDefinitions();

export const worker = async (event) => {
  await kvs.set('processed:' + event.body.id, true);
};
export const onIssue = async (event) => {
  await kvs.set('triggered:' + event.issue.key, true);
  return { ok: true };
};
export const hook = async () => ({ statusCode: 200, body: JSON.stringify({ fromBundle: true }) });
`;

const FRONTEND_SRC = `
import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Text } from '@forge/react';
import { invoke } from '@forge/bridge';
const App = () => {
  const [text, setText] = useState('Loading...');
  useEffect(() => {
    invoke('save', { id: 'ui' }).then(() => invoke('summary')).then(setText);
  }, []);
  return <Text>{text}</Text>;
};
ForgeReconciler.render(<App />);
`;

async function bundle(src: string, out: string, opts: { platform: 'node' | 'browser' }): Promise<void> {
  const esbuild = await import('esbuild');
  await esbuild.build({
    entryPoints: [src],
    bundle: true,
    format: opts.platform === 'node' ? 'cjs' : 'esm',
    platform: opts.platform,
    jsx: 'automatic',
    outfile: out,
    nodePaths: [join(REPO_ROOT, 'node_modules')],
    logLevel: 'silent',
  });
}

let appDir: string;
let sim: ForgeSimulator;

beforeAll(async () => {
  appDir = await mkdtemp(join(tmpdir(), 'forge-sim-bundled-e2e-'));
  // No `type` field: the packaged backend is CommonJS, as compiled output is.
  await writeFile(join(appDir, 'package.json'), '{ "name": "bundled-e2e", "private": true }');
  await writeFile(join(appDir, 'manifest.yml'), MANIFEST);
  await mkdir(join(appDir, 'src'), { recursive: true });
  await mkdir(join(appDir, 'out'), { recursive: true });
  await mkdir(join(appDir, 'frontend'), { recursive: true });
  await writeFile(join(appDir, 'src', 'backend.js'), BACKEND_SRC);
  await writeFile(join(appDir, 'src', 'app.jsx'), FRONTEND_SRC);
  await bundle(join(appDir, 'src', 'backend.js'), join(appDir, 'out', 'index.js'), { platform: 'node' });
  await bundle(join(appDir, 'src', 'app.jsx'), join(appDir, 'frontend', 'index.js'), { platform: 'browser' });
  await writeFile(
    join(appDir, 'frontend', 'index.html'),
    '<!doctype html><html><body><script type="module" src="./index.js"></script></body></html>',
  );

  sim = createSimulator();
  sim.mockProductRoutes('jira', { '/rest/api/3/issue/E2E-1': { key: 'E2E-1', fields: { summary: 'From the mocked Jira' } } });
  await sim.deploy(appDir, { fireScheduledTriggers: false });
}, 60_000);

afterAll(async () => {
  await sim.stop();
  await rm(appDir, { recursive: true, force: true }).catch(() => {});
});

describe('a user-bundled (shape 2) app end to end', () => {
  it('ships no bare @forge/* specifier — backend or frontend', async () => {
    for (const f of ['out/index.js', 'frontend/index.js']) {
      const code = await readFile(join(appDir, f), 'utf8');
      expect(code, f).not.toMatch(/require\(\s*["']@forge\//);
      expect(code, f).not.toMatch(/^\s*(?:import|export)\b[^;]*?\bfrom\s*["']@forge\//m);
    }
  });

  it('deploys with no errors and registers every function', () => {
    const m = sim.getManifest()!;
    expect([...m.functions.keys()].sort()).toEqual(['hook-fn', 'main-fn', 'trigger-fn', 'worker-fn']);
  });

  it('inlined @forge/kvs writes through the seam into sim.kvs', async () => {
    expect(await sim.invoke('save', { id: 'a1' })).toBe('saved a1');
    expect(await sim.kvs.get('saved:a1')).toEqual({ id: 'a1', by: 'bundled-backend' });
  });

  it('inlined @forge/events pushes through the seam and the bundled consumer runs', async () => {
    expect(await sim.invoke('enqueue', { id: 'j1' })).toBe('queued j1');
    await expect.poll(() => sim.kvs.get('processed:j1'), { timeout: 5000 }).toBe(true);
  });

  it('inlined @forge/api requestJira(route`…`) hits the mocked product route', async () => {
    expect(await sim.invoke('issue', { key: 'E2E-1' })).toBe('From the mocked Jira');
  });

  it('a product trigger reaches the bundled handler', async () => {
    await sim.fireTrigger('avi:jira:created:issue', { issue: { key: 'E2E-9' } });
    expect(await sim.kvs.get('triggered:E2E-9')).toBe(true);
  });

  it('a web trigger reaches the bundled handler', async () => {
    const res = await sim.fireWebTrigger('hook');
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body as string)).toEqual({ fromBundle: true });
  });

  it('the prebuilt UI (inlined @forge/react + @forge/bridge) invokes the bundled resolver through globalThis.__bridge', async () => {
    const doc = await sim.ui.waitForContent('panel', 'ui saved by bundled-backend');
    expect(sim.ui.getTextContent(doc)).toContain('ui saved by bundled-backend');
    expect(await sim.kvs.get('saved:ui')).toEqual({ id: 'ui', by: 'bundled-backend' });
  }, 30_000);
});
