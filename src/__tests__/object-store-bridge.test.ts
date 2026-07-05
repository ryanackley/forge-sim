/**
 * Object Store bridge e2e — the full client → resolver → pre-signed URL →
 * HTTP → store round-trip, exactly the way real @forge/bridge does it:
 *
 *   objectStore.upload({functionKey, objects})
 *     → SHA-256 each blob client-side
 *     → invoke(functionKey, { allObjectMetadata })
 *     → resolver calls fos.createUploadUrl() per file
 *     → client fetch() PUTs each blob to its pre-signed URL
 *     → SimulatedObjectStore validates length+checksum and stores it
 *
 * The bridge surface under test is our port of @forge/bridge 6.x's
 * object-store client (src/shims/forge-bridge.ts), running headless in
 * Node 22 (global Blob/fetch/crypto.subtle/atob/btoa). The pre-signed
 * URLs point at the store's lazily-started ephemeral HTTP server — real
 * sockets, no fetch mocking.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSimulator, ForgeSimulator } from '../simulator.js';
import { objectStore, createUploadPromises, BridgeAPIError } from '@forge/bridge';

const fixtureDir = new URL('./fixtures/object-store-app', import.meta.url).pathname;

describe('Object Store bridge surface (headless)', () => {
  let sim: ForgeSimulator;

  beforeEach(async () => {
    sim = createSimulator();
    await sim.deploy(fixtureDir);
    // Render installs the bridge + context (environmentType: DEVELOPMENT)
    await sim.ui.render('object-store-panel');
  });

  afterEach(async () => {
    await sim.reset();
  });

  it('upload → invoke → pre-signed PUT → object lands in the store', async () => {
    const content = 'hello from the bridge';
    const results = await objectStore.upload({
      functionKey: 'generateUploadUrls',
      objects: [{ data: btoa(content), mimeType: 'text/plain' }],
    });

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].key).toBe('uploads/file-0');
    expect(results[0].status).toBe(200);

    // The object is really in the store — verify content + metadata.
    const stored = sim.objectStore.getObjectContent('uploads/file-0');
    expect(stored?.buffer.toString('utf-8')).toBe(content);
    expect(stored?.contentType).toBe('text/plain');
    const ref = await sim.objectStore.get('uploads/file-0');
    expect(ref?.size).toBe(content.length);
  });

  it('uploads multiple objects, mapping blobs back via checksum', async () => {
    const results = await objectStore.upload({
      functionKey: 'generateUploadUrls',
      objects: [
        { data: btoa('first file'), mimeType: 'text/plain' },
        { data: btoa('{"second":true}'), mimeType: 'application/json' },
      ],
    });

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.success)).toBe(true);
    const keys = results.map((r) => r.key).sort();
    expect(keys).toEqual(['uploads/file-0', 'uploads/file-1']);
    expect(sim.objectStore.getObjectContent('uploads/file-1')?.buffer.toString('utf-8')).toBe('{"second":true}');
  });

  it('accepts Blob objects directly', async () => {
    const blob = new Blob(['blob body'], { type: 'text/plain' });
    const results = await objectStore.upload({
      functionKey: 'generateUploadUrls',
      objects: [blob],
    });
    expect(results[0].success).toBe(true);
    expect(sim.objectStore.getObjectContent('uploads/file-0')?.buffer.toString('utf-8')).toBe('blob body');
  });

  it('download → invoke → pre-signed GET → blob round-trips bytes', async () => {
    sim.objectStore.seedObject({ key: 'docs/readme.txt', data: 'download me', contentType: 'text/plain' });

    const results = await objectStore.download({
      functionKey: 'generateDownloadUrls',
      keys: ['docs/readme.txt'],
    });

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].key).toBe('docs/readme.txt');
    expect(results[0].status).toBe(200);
    const text = await results[0].blob!.text();
    expect(text).toBe('download me');
  });

  it('download of an absent key yields no result entry (resolver filters it)', async () => {
    const results = await objectStore.download({
      functionKey: 'generateDownloadUrls',
      keys: ['nope/missing'],
    });
    // createDownloadUrl returns undefined for absent keys, so the resolver's
    // URL map is empty → zero download results. Matches real Forge: the
    // resolver decides what to expose.
    expect(results).toHaveLength(0);
  });

  it('getMetadata invokes per key and returns metadata objects', async () => {
    sim.objectStore.seedObject({ key: 'meta/a.bin', data: Buffer.from([1, 2, 3]) });

    const results = await objectStore.getMetadata({
      functionKey: 'getObjectMetadata',
      keys: ['meta/a.bin', 'meta/missing'],
    });

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ key: 'meta/a.bin', size: 3 });
    expect(results[1]).toMatchObject({ key: 'meta/missing', error: 'Not found' });
  });

  it('delete invokes per key and removes objects from the store', async () => {
    sim.objectStore.seedObject({ key: 'del/one', data: 'x' });
    sim.objectStore.seedObject({ key: 'del/two', data: 'y' });

    await objectStore.delete({
      functionKey: 'deleteObject',
      keys: ['del/one', 'del/two'],
    });

    expect(await sim.objectStore.get('del/one')).toBeUndefined();
    expect(await sim.objectStore.get('del/two')).toBeUndefined();
  });

  it('createUploadPromises exposes per-item promise/index/type/size', async () => {
    const items = await createUploadPromises({
      functionKey: 'generateUploadUrls',
      objects: [{ data: btoa('item zero'), mimeType: 'text/plain' }],
    });

    expect(items).toHaveLength(1);
    expect(items[0].index).toBe(0);
    expect(items[0].objectType).toBe('text/plain');
    expect(items[0].objectSize).toBe('item zero'.length);
    const result = await items[0].promise;
    expect(result.success).toBe(true);
  });

  it('validates inputs with the exact real-bridge error messages', async () => {
    await expect(
      objectStore.upload({ functionKey: '', objects: [{ data: btoa('x') }] }),
    ).rejects.toThrow('functionKey is required to filter and generate presigned URLs');

    await expect(
      objectStore.upload({ functionKey: 'generateUploadUrls', objects: [] }),
    ).rejects.toThrow('objects array is required and must not be empty');

    await expect(
      objectStore.upload({ functionKey: 'generateUploadUrls', objects: [42 as any] }),
    ).rejects.toThrow('Invalid object type at index 0');

    await expect(
      objectStore.download({ functionKey: 'generateDownloadUrls', keys: [] }),
    ).rejects.toThrow('keys array is required and must not be empty');

    await expect(
      objectStore.delete({ functionKey: '', keys: ['k'] }),
    ).rejects.toThrow('functionKey is required to delete objects');

    // And they're BridgeAPIError instances, like the real thing.
    await expect(
      objectStore.getMetadata({ functionKey: '', keys: ['k'] }),
    ).rejects.toBeInstanceOf(BridgeAPIError);
  });

  it('useObjectStore-driven upload works end-to-end through the rendered panel', async () => {
    // The fixture's FilePicker onChange feeds SerializedFile[] into
    // useObjectStore().uploadObjects. Headless agents drive it the same
    // way: pass synthetic SerializedFile objects as event args.
    const doc = await sim.ui.waitForContent('object-store-panel', 'Last action: none');
    const picker = sim.ui.findFirstByType(doc, 'FilePicker');
    expect(picker).toBeTruthy();

    await sim.ui.interact(picker!, 'onChange', [
      { data: btoa('picked file'), name: 'notes.txt', size: 11, type: 'text/plain' },
    ]);

    await sim.ui.waitForContent('object-store-panel', 'Last action: uploaded 1');
    expect(sim.objectStore.getObjectContent('uploads/file-0')?.buffer.toString('utf-8')).toBe('picked file');
  });
});
