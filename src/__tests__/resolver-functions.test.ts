/**
 * Apps run the real @forge/resolver, and the sim routes to its dispatch
 * closures the way the platform does: a module reaches its own resolver
 * function's closure and nothing else. The bundler tags every closure it
 * builds with the keys its Resolver was given (src/bundler.ts), which is
 * what lets the sim LIST definitions and settle a module-less invoke; the
 * package's own rules (chained define(), duplicate and non-function
 * definitions rejected, JSON-sanitised results) apply untouched.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createSimulator, type ForgeSimulator } from '../simulator.js';
import { bundledResolverDefinitions } from '../bundler.js';
import { linkNodeModules } from './helpers/scratch-app.js';

const FIXTURE = new URL('./fixtures/resolver-functions', import.meta.url).pathname;

describe('real @forge/resolver in a deployed app', () => {
  let sim: ForgeSimulator;

  beforeAll(async () => {
    sim = createSimulator();
    const result = await sim.deploy(FIXTURE);
    expect(result.errors).toEqual([]);
  });

  afterAll(() => {
    sim.ui.resetAll();
  });

  it('lists every definition key of every resolver function, and no function key', () => {
    expect(sim.resolver.getDefinitions()).toEqual(['getText', 'onlyA', 'onlyB', 'loose']);
    expect(sim.resolver.getDispatchKeys()).toEqual(['fn-a', 'fn-b', 'fn-loose']);
    expect(sim.functions.getType('fn-a')).toBe('resolver');
  });

  it('a module invokes its own resolver function, as the bridge does', async () => {
    await expect(sim.invoke('getText', { from: 'x' }, { moduleKey: 'panel-a' })).resolves.toBe('a:x');
    await expect(sim.invoke('getText', { from: 'x' }, { moduleKey: 'panel-b' })).resolves.toBe('b:x');
  });

  it('a rendered module routes its invoke to its own function', async () => {
    await sim.ui.render('panel-b');
    expect(sim.ui.getTextContent(await sim.ui.waitForContent('panel-b', 'b:ui'))).toContain('b:ui');
    await sim.ui.render('panel-a');
    expect(sim.ui.getTextContent(await sim.ui.waitForContent('panel-a', 'a:ui'))).toContain('a:ui');
    // While a module is rendered, a module-less sim.invoke() is attributed
    // to it (the in-process render path); the tests below want no module.
    sim.ui.resetAll();
  });

  it('a module-less invoke of a key two functions define is an error naming both', async () => {
    await expect(sim.invoke('getText', { from: 'x' })).rejects.toThrow(
      /"getText" is defined by more than one function: "fn-a", "fn-b".*moduleKey/,
    );
  });

  it('a module cannot reach a key only another module\'s function defines', async () => {
    await expect(sim.invoke('onlyB', {}, { moduleKey: 'panel-a' })).rejects.toThrow(/panel-a.*fn-a|fn-a.*panel-a/);
    await expect(sim.invoke('onlyA', {}, { moduleKey: 'panel-b' })).rejects.toThrow(/panel-b.*fn-b|fn-b.*panel-b/);
  });

  it('a key one function defines needs no module, whether or not a module names the function', async () => {
    await expect(sim.invoke('onlyB')).resolves.toBe(sim.getDefaultContext().accountId);
    await expect(sim.invoke('loose')).resolves.toBe('loose');
  });

  it('results are JSON-sanitised by the real package', async () => {
    const out = await sim.invoke('onlyA');
    expect(out).toStrictEqual({ when: '2026-01-02T03:04:05.000Z', nested: { n: 1 } });
  });

  it('a function key is not a definition key', async () => {
    await expect(sim.invoke('fn-a')).rejects.toThrow(/No resolver defined for "fn-a"/);
    await expect(sim.invoke('fn-a')).rejects.not.toThrow(/reading 'functionKey'/);
  });

  it('the bundler tagged each closure with its own keys', () => {
    const closure = sim.functions.getHandler('fn-a');
    expect([...(bundledResolverDefinitions(closure) ?? [])]).toEqual(['getText', 'onlyA']);
    expect(bundledResolverDefinitions(() => undefined)).toBeNull();
  });

  it('a redeploy replaces the closures and keeps the listing', async () => {
    await sim.deploy(FIXTURE);
    expect(sim.resolver.getDefinitions()).toEqual(['getText', 'onlyA', 'onlyB', 'loose']);
    await expect(sim.invoke('getText', { from: 'y' }, { moduleKey: 'panel-a' })).resolves.toBe('a:y');
  });
});

describe('the real package\'s own definition rules apply at deploy', () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'forge-sim-resolver-rules-'));
    linkNodeModules(dir);
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'resolver-rules', private: true, type: 'module' }));
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(join(dir, 'manifest.yml'), [
      'modules:',
      '  jira:issuePanel:',
      '    - key: panel-dup',
      '      icon: https://example.com/icon.svg',
      '      resource: frontend',
      '      resolver:',
      '        function: dup',
      '      render: native',
      '      title: Dup',
      '    - key: panel-notfn',
      '      icon: https://example.com/icon.svg',
      '      resource: frontend',
      '      resolver:',
      '        function: notfn',
      '      render: native',
      '      title: Not a function',
      '  function:',
      '    - key: dup',
      '      handler: dup.handler',
      '    - key: notfn',
      '      handler: notfn.handler',
      'resources:',
      '  - key: frontend',
      '    path: src/frontend.jsx',
      'app:',
      '  runtime:',
      '    name: nodejs22.x',
      '  id: ari:cloud:ecosystem::app/resolver-rules',
      '',
    ].join('\n'));
    await writeFile(join(dir, 'src', 'frontend.jsx'), [
      "import ForgeReconciler, { Text } from '@forge/react';",
      "import React from 'react';",
      'ForgeReconciler.render(<Text>never rendered</Text>);',
      '',
    ].join('\n'));
    await writeFile(join(dir, 'src', 'dup.js'), [
      "import Resolver from '@forge/resolver';",
      'const r = new Resolver();',
      "r.define('twice', async () => 1);",
      "r.define('twice', async () => 2);",
      'export const handler = r.getDefinitions();',
      '',
    ].join('\n'));
    await writeFile(join(dir, 'src', 'notfn.js'), [
      "import Resolver from '@forge/resolver';",
      'const r = new Resolver();',
      "r.define('later', 'not a function');",
      'export const handler = r.getDefinitions();',
      '',
    ].join('\n'));
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('a duplicate key and a non-function callback fail the function, as they do on Forge', async () => {
    const sim = createSimulator();
    const result = await sim.deploy(dir, { throwOnError: false });
    const byKey = Object.fromEntries(result.errors.map((e) => [e.functionKey, e.error]));
    expect(byKey.dup).toMatch(/Resolver definition 'twice' already exists/);
    expect(byKey.notfn).toMatch(/Resolver definition 'later' callback must be a 'function'/);
    expect(sim.resolver.getDefinitions()).toEqual([]);
  });
});
