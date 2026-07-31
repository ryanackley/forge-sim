/**
 * Tests for the @forge/manifest validation gate.
 *
 * Policy (parity principle): a manifest that real `forge lint`/`forge deploy`
 * rejects must not load or deploy in forge-sim.
 * - deploy(appDir): full validation including file-existence checks; error-level
 *   findings are deploy failures.
 * - loadManifest(yaml string): same validation minus file-existence checks
 *   (no app dir exists); schema/shape errors still throw.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { ForgeSimulator } from '../simulator.js';
import {
  validateManifestContent,
  validateManifestFile,
  hasValidationErrors,
  PLACEHOLDER_APP_ID,
} from '../manifest-validation.js';

const VALID_MANIFEST = `
app:
  id: ${PLACEHOLDER_APP_ID}
  runtime:
    name: nodejs22.x
modules:
  webtrigger:
    - key: hook
      function: main
  function:
    - key: main
      handler: index.run
permissions:
  scopes:
    - storage:app
`;

describe('validateManifestContent (inline string mode)', () => {
  it('accepts a valid manifest (no error-level warnings)', async () => {
    const warnings = await validateManifestContent(VALID_MANIFEST);
    expect(hasValidationErrors(warnings)).toBe(false);
  });

  it('filters file-existence errors (handler file cannot exist for inline YAML)', async () => {
    // VALID_MANIFEST references index.run with no index.ts on disk anywhere —
    // if file-existence errors were not filtered, this would fail.
    const warnings = await validateManifestContent(VALID_MANIFEST);
    expect(warnings.every((w) => !/cannot find associated file/.test(w.message))).toBe(true);
  });

  it('rejects a manifest with no app id, with forge register / placeholder hint', async () => {
    const warnings = await validateManifestContent(`
app:
  runtime:
    name: nodejs22.x
modules:
  webtrigger:
    - key: hook
      function: main
  function:
    - key: main
      handler: index.run
`);
    expect(hasValidationErrors(warnings)).toBe(true);
    const idError = warnings.find((w) => /required property 'id'/.test(w.message));
    expect(idError).toBeDefined();
    expect(idError!.message).toContain('forge register');
    expect(idError!.message).toContain(PLACEHOLDER_APP_ID);
  });

  it('rejects a non-ARI app id, with pattern hint', async () => {
    const warnings = await validateManifestContent(
      VALID_MANIFEST.replace(PLACEHOLDER_APP_ID, 'my-cool-app')
    );
    expect(hasValidationErrors(warnings)).toBe(true);
    expect(warnings.some((w) => /must match pattern/.test(w.message))).toBe(true);
  });

  it('rejects a missing runtime, with remediation hint', async () => {
    const warnings = await validateManifestContent(`
app:
  id: ${PLACEHOLDER_APP_ID}
modules:
  webtrigger:
    - key: hook
      function: main
  function:
    - key: main
      handler: index.run
`);
    expect(hasValidationErrors(warnings)).toBe(true);
    const runtimeError = warnings.find((w) => /required property 'runtime'/.test(w.message));
    expect(runtimeError).toBeDefined();
    expect(runtimeError!.message).toContain('nodejs22.x');
  });

  it('rejects function-only manifests (functions are not modules)', async () => {
    const warnings = await validateManifestContent(`
app:
  id: ${PLACEHOLDER_APP_ID}
  runtime:
    name: nodejs22.x
modules:
  function:
    - key: main
      handler: index.run
`);
    expect(hasValidationErrors(warnings)).toBe(true);
    expect(warnings.some((w) => /at least 1 module/.test(w.message))).toBe(true);
  });

  it('includes line numbers when the validator provides them', async () => {
    const warnings = await validateManifestContent(
      VALID_MANIFEST.replace(PLACEHOLDER_APP_ID, 'not-an-ari')
    );
    const err = warnings.find((w) => w.level === 'error');
    expect(err).toBeDefined();
    expect(err!.message).toMatch(/manifest\.yml:\d+/);
  });
});

describe('sim.loadManifest validation gate', () => {
  let sim: ForgeSimulator;

  beforeEach(() => {
    sim = new ForgeSimulator();
  });

  it('loads a valid inline manifest', async () => {
    const manifest = await sim.loadManifest(VALID_MANIFEST);
    expect(manifest.webTriggers.length).toBe(1);
  });

  it('throws on an invalid inline manifest', async () => {
    await expect(
      sim.loadManifest(`
app:
  runtime:
    name: nodejs22.x
modules:
  webtrigger:
    - key: hook
      function: main
  function:
    - key: main
      handler: index.run
`)
    ).rejects.toThrow(/Manifest validation failed/);
  });

  it('respects { validate: false } opt-out', async () => {
    const manifest = await sim.loadManifest(
      `
modules:
  webtrigger:
    - key: hook
      function: main
  function:
    - key: main
      handler: index.run
`,
      { validate: false }
    );
    expect(manifest.webTriggers.length).toBe(1);
  });
});

describe('validateManifestFile + deploy gate (file mode)', () => {
  let appDir: string;

  beforeEach(async () => {
    appDir = await mkdtemp(join(tmpdir(), 'forge-sim-validate-test-'));
  });

  async function writeApp(manifest: string, files: Record<string, string> = {}) {
    await writeFile(join(appDir, 'manifest.yml'), manifest, 'utf8');
    await mkdir(join(appDir, 'src'), { recursive: true });
    for (const [rel, content] of Object.entries(files)) {
      await writeFile(join(appDir, rel), content, 'utf8');
    }
  }

  it('checks handler file existence in file mode', async () => {
    await writeApp(VALID_MANIFEST); // no src/index.ts
    const warnings = await validateManifestFile(join(appDir, 'manifest.yml'));
    expect(hasValidationErrors(warnings)).toBe(true);
    expect(warnings.some((w) => /cannot find associated file/.test(w.message))).toBe(true);
  });

  it('deploy() hard-fails on a manifest real Forge rejects', async () => {
    await writeApp(VALID_MANIFEST.replace(PLACEHOLDER_APP_ID, 'bad-id'), {
      'src/index.ts': 'export const run = () => ({ statusCode: 200 });',
    });
    const sim = new ForgeSimulator();
    const result = await sim.deploy(appDir, { throwOnError: false });
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => /must match pattern/.test(e.error))).toBe(true);
  });

  it('deploy() succeeds for a valid app', async () => {
    await writeApp(VALID_MANIFEST, {
      'src/index.ts': 'export const run = () => ({ statusCode: 200 });',
    });
    const sim = new ForgeSimulator();
    const result = await sim.deploy(appDir, { throwOnError: false });
    expect(result.errors).toEqual([]);
  });

  it('re-validates after a missing file is created (no stale caching)', async () => {
    await writeApp(VALID_MANIFEST); // missing src/index.ts
    const manifestPath = join(appDir, 'manifest.yml');
    const first = await validateManifestFile(manifestPath);
    expect(hasValidationErrors(first)).toBe(true);

    await writeFile(
      join(appDir, 'src/index.ts'),
      'export const run = () => ({ statusCode: 200 });',
      'utf8'
    );
    const second = await validateManifestFile(manifestPath);
    expect(hasValidationErrors(second)).toBe(false);
  });

  afterEach(async () => {
    await rm(appDir, { recursive: true, force: true }).catch(() => undefined);
  });
});
