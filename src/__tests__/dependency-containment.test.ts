/**
 * An app's dependencies resolve from the app only, as on `forge deploy`:
 * forge-sim's own node_modules are never a fallback. So
 *
 *   - a package the app imports but did not install is a build error that
 *     names the package and `npm install` (webpack: "Module not found")
 *   - that includes `@forge/*`: forge-sim's copies do not stand in
 *   - `@forge/resolver` is shimmed only when the app ships it
 *   - a UI Kit resource importing an uninstalled package fails to render
 *   - under manual packaging, a CommonJS require from inside
 *     `app.package.path` must resolve inside it, since that directory is
 *     all Forge uploads; a `node_modules` at the app root does not count
 *
 * Each scratch app gets its install the way `npm install` would, by linking
 * a node_modules to the repo's (helpers/scratch-app.ts).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSimulator, type ForgeSimulator } from '../simulator.js';
import { linkNodeModules, REPO_NODE_MODULES } from './helpers/scratch-app.js';

const SOURCE_MANIFEST = `
modules:
  webtrigger:
    - key: hook
      function: fn
  jira:issuePanel:
    - key: panel
      resource: main
      render: native
      title: Panel
      icon: https://example.com/icon.svg
      resolver:
        function: res
  function:
    - key: fn
      handler: index.hook
    - key: res
      handler: index.handler
resources:
  - key: main
    path: src/frontend/index.jsx
app:
  id: ari:cloud:ecosystem::app/dependency-containment
  runtime:
    name: nodejs22.x
permissions:
  scopes: []
`;

const MANUAL_MANIFEST = `
modules:
  webtrigger:
    - key: hook
      function: fn
  function:
    - key: fn
      handler: index.hook
app:
  id: ari:cloud:ecosystem::app/dependency-containment-manual
  runtime:
    name: nodejs22.x
  package:
    bundler: manual@2026
    path: out
permissions:
  scopes: []
`;

const BACKEND = (extra = '') => `
import Resolver from '@forge/resolver';
import { kvs } from '@forge/kvs';
${extra}
const resolver = new Resolver();
resolver.define('ping', async () => { await kvs.set('pinged', true); return 'pong'; });
export const handler = resolver.getDefinitions();
export const hook = async () => ({ statusCode: 200 });
`;

const FRONTEND = (extra = '') => `
import React from 'react';
import ForgeReconciler, { Text } from '@forge/react';
${extra}
ForgeReconciler.render(<Text>hi</Text>);
`;

let dir: string;
let sim: ForgeSimulator;

async function writeSourceApp(opts: { backendExtra?: string; frontendExtra?: string; install?: boolean } = {}) {
  await mkdir(join(dir, 'src', 'frontend'), { recursive: true });
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'containment', private: true, type: 'module' }));
  await writeFile(join(dir, 'manifest.yml'), SOURCE_MANIFEST);
  await writeFile(join(dir, 'src', 'index.js'), BACKEND(opts.backendExtra));
  await writeFile(join(dir, 'src', 'frontend', 'index.jsx'), FRONTEND(opts.frontendExtra));
  if (opts.install !== false) linkNodeModules(dir);
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'forge-sim-containment-'));
  sim = createSimulator();
});

afterEach(async () => {
  await sim.stop();
  await rm(dir, { recursive: true, force: true });
});

describe('source mode: the app resolves its own dependencies only', () => {
  it('an installed app deploys and runs', async () => {
    await writeSourceApp();
    await sim.deploy(dir, { fireScheduledTriggers: false });
    expect(await sim.invoke('ping')).toBe('pong');
  });

  it('an uninstalled package is a build error naming the package and npm install; nothing deploys', async () => {
    await writeSourceApp({ backendExtra: `import { z } from 'zod-is-not-installed-here'; void z;` });
    const result = await sim.deploy(dir, { fireScheduledTriggers: false, throwOnError: false });
    expect(result.loadedFunctions).toEqual([]);
    const own = result.errors.find((e) => e.functionKey === 'res')!;
    expect(own.error).toContain('Build failed in src/index.js');
    expect(own.error).toContain('Could not resolve "zod-is-not-installed-here": the app must declare and install it (npm install)');
    expect(own.error).toContain('forge deploy fails the same way');
    expect(own.error).not.toContain('mark it as external');
  });

  it("@forge/* is no exception: forge-sim's own copies never stand in for an install", async () => {
    await writeSourceApp({ install: false });
    const result = await sim.deploy(dir, { fireScheduledTriggers: false, throwOnError: false });
    expect(result.loadedFunctions).toEqual([]);
    const own = result.errors.find((e) => e.functionKey === 'res')!;
    expect(own.error).toMatch(/Could not resolve "@forge\/(resolver|kvs)"/);
  });

  it('@forge/resolver is shimmed only when the app ships it', async () => {
    // An install with everything but @forge/resolver.
    await writeSourceApp({ install: false });
    await mkdir(join(dir, 'node_modules', '@forge'), { recursive: true });
    for (const pkg of ['kvs', 'api', 'events', 'auth', 'egress', 'i18n', 'manifest', 'sql']) {
      await symlink(join(REPO_NODE_MODULES, '@forge', pkg), join(dir, 'node_modules', '@forge', pkg), 'dir');
    }
    const result = await sim.deploy(dir, { fireScheduledTriggers: false, throwOnError: false });
    const own = result.errors.find((e) => e.functionKey === 'res')!;
    expect(own.error).toContain('Could not resolve "@forge/resolver"');
  });

  it('a UI Kit resource importing an uninstalled package fails to render with the same build error', async () => {
    await writeSourceApp({ frontendExtra: `import pad from 'left-pad-is-not-installed-here'; void pad;` });
    await sim.deploy(dir, { fireScheduledTriggers: false });
    await expect(sim.ui.render('panel')).rejects.toThrow(/Could not resolve "left-pad-is-not-installed-here"/);
  });
});

describe('manual packaging: requires are contained to app.package.path', () => {
  const HANDLER = `
'use strict';
const z = require('zod');
exports.hook = async () => ({ statusCode: 200, body: typeof z.object });
`;

  async function writeManualApp(install: 'package' | 'app-root' | 'none') {
    await mkdir(join(dir, 'out'), { recursive: true });
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'containment-manual', private: true }));
    await writeFile(join(dir, 'manifest.yml'), MANUAL_MANIFEST);
    await writeFile(join(dir, 'out', 'index.js'), HANDLER);
    if (install === 'package') linkNodeModules(join(dir, 'out'));
    if (install === 'app-root') linkNodeModules(dir);
  }

  it('a dependency inside the package directory loads', async () => {
    await writeManualApp('package');
    await sim.deploy(dir, { fireScheduledTriggers: false });
    expect((await sim.fireWebTrigger('hook')).body).toBe('function');
  });

  it('a dependency only at the app root is outside the upload: Cannot find module', async () => {
    await writeManualApp('app-root');
    const result = await sim.deploy(dir, { fireScheduledTriggers: false, throwOnError: false });
    expect(result.loadedFunctions).toEqual([]);
    expect(result.errors).toEqual([
      { functionKey: 'fn', error: expect.stringContaining("Cannot find module 'zod'") },
    ]);
    expect(result.errors[0].error).toContain('manual packaging uploads only app.package.path');
    expect(result.errors[0].error).toContain(join(dir, 'out', 'node_modules'));
  });

  it('no install at all: Cannot find module, with no fallback to forge-sim', async () => {
    await writeManualApp('none');
    const result = await sim.deploy(dir, { fireScheduledTriggers: false, throwOnError: false });
    expect(result.errors).toEqual([
      { functionKey: 'fn', error: expect.stringContaining("Cannot find module 'zod'") },
    ]);
  });

  it('@forge/resolver is shimmed only when the package ships it', async () => {
    await mkdir(join(dir, 'out'), { recursive: true });
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'containment-manual', private: true }));
    await writeFile(join(dir, 'manifest.yml'), MANUAL_MANIFEST);
    await writeFile(join(dir, 'out', 'index.js'), `
'use strict';
const Resolver = require('@forge/resolver').default;
exports.hook = async () => ({ statusCode: 200, body: typeof Resolver });
`);
    const missing = await sim.deploy(dir, { fireScheduledTriggers: false, throwOnError: false });
    expect(missing.errors).toEqual([
      { functionKey: 'fn', error: expect.stringContaining("Cannot find module '@forge/resolver'") },
    ]);

    linkNodeModules(join(dir, 'out'));
    await sim.deploy(dir, { fireScheduledTriggers: false });
    expect((await sim.fireWebTrigger('hook')).body).toBe('function');
  });
});
