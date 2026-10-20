/**
 * Behaviors of the REAL `@forge/object-store` that apps depend on.
 *
 * Apps run the real package now — forge-sim serves its I/O at the
 * `__forge_fetch__` seam (`type: 'os'`) instead of aliasing the import
 * (bare-seam migration, phase 3c). `seam-fetch.test.ts` covers the wire side
 * (the seven JSON endpoints plus the upload → PUT → download roundtrip over
 * minted URLs); this file pins the module surface apps code against.
 *
 * Version pinned by VERIFIED_FORGE_VERSIONS (`@forge/object-store`).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import { createSimulator, type ForgeSimulator } from '../simulator.js';

// CJS require bypasses any vitest alias — this is the real published package.
const require = createRequire(import.meta.url);

describe('real @forge/object-store — module surface', () => {
  let sim: ForgeSimulator;
  let pkg: any;

  beforeAll(() => {
    sim = createSimulator();
    pkg = require('@forge/object-store');
  });

  afterAll(async () => {
    await sim.stop();
  });

  it('exports objectStore, errorCodes, and default === objectStore', () => {
    expect(pkg.objectStore).toBeDefined();
    expect(pkg.default).toBe(pkg.objectStore);
    expect(pkg.errorCodes).toMatchObject({
      UNKNOWN_ERROR: 'UNKNOWN_ERROR',
      APP_NOT_ENABLED: 'APP_NOT_ENABLED',
      RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    });
  });

  it('has no put/download (the parity lie the shim once told)', () => {
    // The shim carried deprecated put()/download() helpers that never existed
    // upstream — an app using them worked in the sim and crashed in Forge.
    // (The sim-direct API, sim.objectStore.put/download, keeps them as test
    // seeding helpers; the app-facing package is what must match Forge.)
    expect((pkg.objectStore as any).put).toBeUndefined();
    expect((pkg.objectStore as any).download).toBeUndefined();
    for (const name of [
      'get',
      'delete',
      'createUploadUrl',
      'createPublicUploadUrl',
      'createDownloadUrl',
      'createPublicDownloadUrl',
      'createCDNUrl',
    ]) {
      expect(typeof pkg.objectStore[name], `real objectStore missing ${name}`).toBe('function');
    }
  });

  it('get() on a missing key resolves undefined (404 → undefined, not a throw)', async () => {
    await expect(pkg.objectStore.get('no-such-key')).resolves.toBeUndefined();
  });

  it('surfaces the seam-reported error code for an invalid upload request', async () => {
    const err = await pkg.objectStore
      .createUploadUrl({ key: 'x', length: 1, checksum: 'bad', checksumType: 'NOPE' })
      .then(
        () => null,
        (e: Error) => e,
      );
    // ObjectStoreError codes cross the seam as {code, message} on a non-ok
    // response and come back out of the real client's error handling.
    expect(String(err)).toMatch(/INVALID_CHECKSUM_TYPE|checksumType/i);
  });
});
