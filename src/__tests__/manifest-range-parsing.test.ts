/**
 * Manifest parser — entity-index `range:` field accepts both scalar and
 * list-of-one shapes. Run-8 🟠 finding: the Atlassian docs YAML example
 * shows `range: [<attr>]` but forge-sim only accepted the scalar form.
 * Both forms now parse to the same internal representation; multi-element
 * arrays remain a hard error (real Forge only allows one range attribute).
 */
import { describe, it, expect } from 'vitest';
import { parseManifestContent } from '../manifest.js';

const BASE_MANIFEST = (rangeYaml: string) => `
app:
  id: ari:cloud:ecosystem::app/range-parser-test
  name: Range Parser Test
  runtime:
    name: nodejs22.x
  storage:
    entities:
      - name: Snapshot
        attributes:
          spaceKey:
            type: string
          takenAt:
            type: string
        indexes:
          - name: by-space
            partition:
              - spaceKey
            ${rangeYaml}
modules:
  function:
    - key: r
      handler: index.handler
`;

describe('manifest range parser — accept scalar AND list-of-one', () => {
  it('accepts scalar form: range: <attr>', () => {
    const manifest = parseManifestContent(BASE_MANIFEST('range: takenAt'));
    const errors = manifest.warnings.filter((w) => w.level === 'error');
    expect(errors).toEqual([]);
    expect(manifest.entities.get('Snapshot')!.indexes).toEqual([
      { name: 'by-space', partition: ['spaceKey'], range: 'takenAt' },
    ]);
  });

  it('accepts list-of-one form: range: [<attr>] (matches Atlassian docs YAML example)', () => {
    const yaml = `range:\n              - takenAt`;
    const manifest = parseManifestContent(BASE_MANIFEST(yaml));
    const errors = manifest.warnings.filter((w) => w.level === 'error');
    expect(errors).toEqual([]);
    // Normalises to the scalar internal shape — downstream code already
    // expects `range: string`, so callers don't have to handle both forms.
    expect(manifest.entities.get('Snapshot')!.indexes).toEqual([
      { name: 'by-space', partition: ['spaceKey'], range: 'takenAt' },
    ]);
  });

  it('accepts inline-array list-of-one: range: [<attr>]', () => {
    const manifest = parseManifestContent(BASE_MANIFEST('range: [takenAt]'));
    const errors = manifest.warnings.filter((w) => w.level === 'error');
    expect(errors).toEqual([]);
    expect(manifest.entities.get('Snapshot')!.indexes[0].range).toBe('takenAt');
  });

  it('omitted range still parses to undefined (existing behavior)', () => {
    const manifest = parseManifestContent(BASE_MANIFEST(''));
    const errors = manifest.warnings.filter((w) => w.level === 'error');
    expect(errors).toEqual([]);
    expect(manifest.entities.get('Snapshot')!.indexes[0].range).toBeUndefined();
  });
});

describe('manifest range parser — reject genuinely-bad shapes', () => {
  it('rejects multi-element array (real Forge only allows one range attr)', () => {
    const yaml = `range:\n              - takenAt\n              - createdAt`;
    const manifest = parseManifestContent(BASE_MANIFEST(yaml));
    const errors = manifest.warnings.filter((w) => w.level === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/may only have one attribute/);
    expect(errors[0].message).toContain('got 2');
    // The malformed index is dropped so downstream code never sees a
    // partially-valid range.
    expect(manifest.entities.get('Snapshot')!.indexes).toEqual([]);
  });

  it('rejects empty array', () => {
    const manifest = parseManifestContent(BASE_MANIFEST('range: []'));
    const errors = manifest.warnings.filter((w) => w.level === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/empty array/);
  });

  it('rejects non-string element inside list-of-one', () => {
    const manifest = parseManifestContent(BASE_MANIFEST('range: [42]'));
    const errors = manifest.warnings.filter((w) => w.level === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/must be an attribute name \(string\)/);
  });

  it('rejects object form: range: { foo: bar }', () => {
    const yaml = `range:\n              foo: bar`;
    const manifest = parseManifestContent(BASE_MANIFEST(yaml));
    const errors = manifest.warnings.filter((w) => w.level === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/string.*list-of-one/);
  });

  it('rejects number scalar: range: 42', () => {
    const manifest = parseManifestContent(BASE_MANIFEST('range: 42'));
    const errors = manifest.warnings.filter((w) => w.level === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/string.*list-of-one/);
  });

  it('still warns (not errors) when range references an undeclared attribute', () => {
    // Pre-existing soft warning shape; verify it still fires for both forms.
    const m1 = parseManifestContent(BASE_MANIFEST('range: ghost'));
    const m1Warnings = m1.warnings.filter((w) => w.level === 'warning');
    expect(m1Warnings.some((w) => w.message.includes('ranges on "ghost"'))).toBe(true);

    const m2 = parseManifestContent(BASE_MANIFEST('range: [ghost]'));
    const m2Warnings = m2.warnings.filter((w) => w.level === 'warning');
    expect(m2Warnings.some((w) => w.message.includes('ranges on "ghost"'))).toBe(true);
  });
});
