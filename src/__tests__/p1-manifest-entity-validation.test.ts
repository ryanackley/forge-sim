/**
 * P1 — Validation warnings for malformed app.storage.entities declarations.
 *
 * These tests cover the warning emissions added to manifest.ts. They use
 * a temp-yaml-on-disk approach because manifest parsing reads from a file.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseManifest } from '../manifest.js';

const BASE_MANIFEST = `app:
  id: ari:cloud:ecosystem::app/test
  name: Test
  runtime:
    name: nodejs22.x
modules:
  function:
    - key: noop
      handler: index.handler
`;

describe('P1 — manifest entity validation warnings', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'forge-sim-p1-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function parseWithStorage(storageYaml: string) {
    const path = join(dir, 'manifest.yml');
    // Splice the storage block into the app: section.
    const yaml = BASE_MANIFEST.replace(
      '  runtime:\n    name: nodejs22.x',
      `  runtime:\n    name: nodejs22.x\n${storageYaml}`,
    );
    await writeFile(path, yaml);
    return parseManifest(path);
  }

  it('entities not an array → error warning, no entities parsed', async () => {
    const parsed = await parseWithStorage('  storage:\n    entities: "not-an-array"');
    expect(parsed.entities.size).toBe(0);
    expect(parsed.warnings.some(w =>
      w.level === 'error' && /must be an array/.test(w.message)
    )).toBe(true);
  });

  it('entity missing name → error warning, entity skipped', async () => {
    const parsed = await parseWithStorage(
      '  storage:\n    entities:\n      - attributes:\n          foo: { type: string }',
    );
    expect(parsed.entities.size).toBe(0);
    expect(parsed.warnings.some(w =>
      w.level === 'error' && /missing a "name" string/.test(w.message)
    )).toBe(true);
  });

  it('duplicate entity names → error warning, second skipped', async () => {
    const parsed = await parseWithStorage(
      '  storage:\n    entities:\n' +
      '      - name: Task\n        attributes:\n          title: { type: string }\n' +
      '      - name: Task\n        attributes:\n          body: { type: string }\n',
    );
    expect(parsed.entities.size).toBe(1);
    // First definition wins
    expect(parsed.entities.get('Task')!.attributes).toHaveProperty('title');
    expect(parsed.entities.get('Task')!.attributes).not.toHaveProperty('body');
    expect(parsed.warnings.some(w =>
      w.level === 'error' && /duplicate entity name "Task"/.test(w.message)
    )).toBe(true);
  });

  it('entity missing attributes → error warning, entity skipped', async () => {
    const parsed = await parseWithStorage(
      '  storage:\n    entities:\n      - name: Bare\n',
    );
    expect(parsed.entities.size).toBe(0);
    expect(parsed.warnings.some(w =>
      w.level === 'error' && /missing the "attributes" map/.test(w.message)
    )).toBe(true);
  });

  it('attribute missing type → error warning, attribute skipped (entity kept)', async () => {
    const parsed = await parseWithStorage(
      '  storage:\n    entities:\n      - name: Task\n        attributes:\n' +
      '          good: { type: string }\n          bad: {}\n',
    );
    const task = parsed.entities.get('Task');
    expect(task).toBeDefined();
    expect(task!.attributes).toHaveProperty('good');
    expect(task!.attributes).not.toHaveProperty('bad');
    expect(parsed.warnings.some(w =>
      w.level === 'error' && /attribute "bad" is missing a "type"/.test(w.message)
    )).toBe(true);
  });

  it('unknown attribute type → warning (not error), attribute kept as-is', async () => {
    const parsed = await parseWithStorage(
      '  storage:\n    entities:\n      - name: Task\n        attributes:\n' +
      '          weird: { type: datetime }\n',
    );
    expect(parsed.entities.get('Task')!.attributes).toEqual({ weird: { type: 'datetime' } });
    expect(parsed.warnings.some(w =>
      w.level === 'warning' && /unknown type "datetime"/.test(w.message)
    )).toBe(true);
  });

  it('index missing name → error warning, index skipped', async () => {
    const parsed = await parseWithStorage(
      '  storage:\n    entities:\n      - name: Task\n        attributes:\n' +
      '          title: { type: string }\n        indexes:\n          - partition: [title]\n',
    );
    expect(parsed.entities.get('Task')!.indexes).toEqual([]);
    expect(parsed.warnings.some(w =>
      w.level === 'error' && /indexes\[0\] is missing a "name"/.test(w.message)
    )).toBe(true);
  });

  it('duplicate index names → error warning, second skipped', async () => {
    const parsed = await parseWithStorage(
      '  storage:\n    entities:\n      - name: Task\n        attributes:\n' +
      '          title: { type: string }\n' +
      '          status: { type: string }\n        indexes:\n' +
      '          - { name: by-x, partition: [title] }\n' +
      '          - { name: by-x, partition: [status] }\n',
    );
    expect(parsed.entities.get('Task')!.indexes).toHaveLength(1);
    expect(parsed.warnings.some(w =>
      w.level === 'error' && /duplicate index name "by-x"/.test(w.message)
    )).toBe(true);
  });

  it('index partition references undeclared attribute → warning, schema still registered', async () => {
    const parsed = await parseWithStorage(
      '  storage:\n    entities:\n      - name: Task\n        attributes:\n' +
      '          title: { type: string }\n        indexes:\n' +
      '          - { name: by-ghost, partition: [ghostAttr] }\n',
    );
    expect(parsed.entities.get('Task')!.indexes).toEqual([
      { name: 'by-ghost', partition: ['ghostAttr'], range: undefined },
    ]);
    expect(parsed.warnings.some(w =>
      w.level === 'warning' && /partitions on "ghostAttr".*Real Forge will reject/.test(w.message)
    )).toBe(true);
  });

  it('index range references undeclared attribute → warning, schema still registered', async () => {
    const parsed = await parseWithStorage(
      '  storage:\n    entities:\n      - name: Task\n        attributes:\n' +
      '          title: { type: string }\n        indexes:\n' +
      '          - { name: by-x, partition: [title], range: ghostAttr }\n',
    );
    expect(parsed.entities.get('Task')!.indexes[0].range).toBe('ghostAttr');
    expect(parsed.warnings.some(w =>
      w.level === 'warning' && /ranges on "ghostAttr".*Real Forge will reject/.test(w.message)
    )).toBe(true);
  });

  it('app.storage but no entities array → no error, no entities parsed', async () => {
    const parsed = await parseWithStorage('  storage: {}');
    expect(parsed.entities.size).toBe(0);
    // No warnings related to entities/storage
    expect(parsed.warnings.filter(w =>
      /entity|entities|app\.storage/i.test(w.message)
    )).toEqual([]);
  });

  it('completely missing storage section → no warnings, empty entities map', async () => {
    const path = join(dir, 'manifest.yml');
    await writeFile(path, BASE_MANIFEST);
    const parsed = await parseManifest(path);
    expect(parsed.entities.size).toBe(0);
    expect(parsed.warnings.filter(w =>
      /entity|entities|app\.storage/i.test(w.message)
    )).toEqual([]);
  });
});
