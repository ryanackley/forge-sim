/**
 * Unit tests for SimulatedObjectStore (@forge/object-store parity).
 *
 * These go through the REAL HTTP path: pre-signed URLs are fetched with
 * global fetch against the store's ephemeral server — the same path the
 * real @forge/bridge objectStore client uses.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SimulatedObjectStore,
  computeChecksum,
  ObjectStoreError,
  MAX_OBJECT_SIZE,
  DEFAULT_OBJECT_TTL_SECONDS,
  type ChecksumType,
} from '../object-store.js';

const BODY = Buffer.from('hello object store, this is forge-sim');

function uploadBody(overrides: Record<string, unknown> = {}) {
  return {
    key: 'test-key',
    length: BODY.length,
    checksum: computeChecksum(BODY, 'SHA256'),
    checksumType: 'SHA256' as ChecksumType,
    ...overrides,
  };
}

describe('SimulatedObjectStore', () => {
  let store: SimulatedObjectStore;
  let fakeNow: number;

  beforeEach(() => {
    store = new SimulatedObjectStore();
    fakeNow = Date.now();
    store.now = () => fakeNow;
  });

  afterEach(() => {
    store.reset();
  });

  async function uploadObject(
    key = 'test-key',
    data: Buffer = BODY,
    extra: Record<string, unknown> = {},
  ): Promise<Response> {
    const { url } = await store.createUploadUrl({
      key,
      length: data.length,
      checksum: computeChecksum(data, 'SHA256'),
      checksumType: 'SHA256',
      ...extra,
    });
    return fetch(url, {
      method: 'PUT',
      body: new Uint8Array(data),
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  // ── Round trip ─────────────────────────────────────────────────────

  it('uploads and downloads an object end-to-end via pre-signed URLs', async () => {
    const putRes = await uploadObject();
    expect(putRes.status).toBe(200);

    const ref = await store.get('test-key');
    expect(ref).toBeDefined();
    expect(ref!.key).toBe('test-key');
    expect(ref!.size).toBe(BODY.length);
    expect(ref!.checksum).toBe(computeChecksum(BODY, 'SHA256'));
    expect(ref!.currentVersion).toBeDefined();
    expect(ref!.createdAt).toBeDefined();
    // ObjectReference exposes contentType? (per @forge/object-store 2.0.0's
    // types) but NOT checksumType/expiresAt.
    expect(ref!.contentType).toBe('text/plain');
    expect((ref as any).checksumType).toBeUndefined();
    expect((ref as any).expiresAt).toBeUndefined();

    const dl = await store.createDownloadUrl('test-key');
    expect(dl).toBeDefined();
    const getRes = await fetch(dl!.url);
    expect(getRes.status).toBe(200);
    expect(getRes.headers.get('content-type')).toBe('text/plain');
    expect(Buffer.from(await getRes.arrayBuffer())).toEqual(BODY);
  });

  it('defaults content type to application/octet-stream when PUT sends none', async () => {
    const { url } = await store.createUploadUrl(uploadBody());
    // Send an explicit octet-stream (undici always sets some content-type;
    // parity default is octet-stream anyway)
    const res = await fetch(url, {
      method: 'PUT',
      body: new Uint8Array(BODY),
      headers: { 'Content-Type': 'application/octet-stream' },
    });
    expect(res.status).toBe(200);
    const dl = await store.createDownloadUrl('test-key');
    const getRes = await fetch(dl!.url);
    expect(getRes.headers.get('content-type')).toBe('application/octet-stream');
  });

  // ── Checksums (OBJ-002) ────────────────────────────────────────────

  const types: ChecksumType[] = ['SHA1', 'SHA256', 'CRC32', 'CRC32C'];

  for (const type of types) {
    it(`accepts a correct ${type} checksum`, async () => {
      const { url } = await store.createUploadUrl(
        uploadBody({ checksum: computeChecksum(BODY, type), checksumType: type }),
      );
      const res = await fetch(url, { method: 'PUT', body: new Uint8Array(BODY) });
      expect(res.status).toBe(200);
      expect(await store.get('test-key')).toBeDefined();
    });

    it(`rejects a wrong ${type} checksum and stores nothing`, async () => {
      const wrong = computeChecksum(Buffer.from('different content'), type);
      const { url } = await store.createUploadUrl(
        uploadBody({ checksum: wrong, checksumType: type }),
      );
      const res = await fetch(url, { method: 'PUT', body: new Uint8Array(BODY) });
      expect(res.status).toBe(400);
      const err = await res.json();
      expect(err.code).toBe('CHECKSUM_MISMATCH');
      expect(await store.get('test-key')).toBeUndefined();
    });
  }

  it('rejects a length mismatch and stores nothing', async () => {
    const { url } = await store.createUploadUrl(uploadBody({ length: BODY.length + 5 }));
    const res = await fetch(url, { method: 'PUT', body: new Uint8Array(BODY) });
    expect(res.status).toBe(400);
    const err = await res.json();
    expect(err.code).toBe('LENGTH_MISMATCH');
    expect(await store.get('test-key')).toBeUndefined();
  });

  // ── URL expiry (OBJ-003) ───────────────────────────────────────────

  it('rejects expired upload URLs with 403', async () => {
    const { url } = await store.createUploadUrl(uploadBody());
    fakeNow += 61 * 60 * 1000; // past the 1h validity
    const res = await fetch(url, { method: 'PUT', body: new Uint8Array(BODY) });
    expect(res.status).toBe(403);
    expect(await store.get('test-key')).toBeUndefined();
  });

  it('rejects expired download URLs with 403', async () => {
    await uploadObject();
    const dl = await store.createDownloadUrl('test-key');
    fakeNow += 61 * 60 * 1000;
    const res = await fetch(dl!.url);
    expect(res.status).toBe(403);
  });

  it('rejects unknown tokens with 403', async () => {
    await uploadObject(); // ensures server is running
    const dl = await store.createDownloadUrl('test-key');
    const bogus = dl!.url.replace(/[^/]+$/, 'not-a-real-token');
    const res = await fetch(bogus);
    expect(res.status).toBe(403);
  });

  it('rejects using a download URL for PUT and vice versa', async () => {
    await uploadObject();
    const dl = await store.createDownloadUrl('test-key');
    const putOnDownload = await fetch(dl!.url, { method: 'PUT', body: 'x' });
    expect(putOnDownload.status).toBe(403);

    const { url: uploadUrl } = await store.createUploadUrl(uploadBody({ key: 'other' }));
    const getOnUpload = await fetch(uploadUrl);
    expect(getOnUpload.status).toBe(403);
  });

  // ── Range requests (OBJ-004) ───────────────────────────────────────

  describe('Range requests', () => {
    it('serves bytes=0-4 with 206 and Content-Range', async () => {
      await uploadObject();
      const dl = await store.createDownloadUrl('test-key');
      const res = await fetch(dl!.url, { headers: { Range: 'bytes=0-4' } });
      expect(res.status).toBe(206);
      expect(res.headers.get('content-range')).toBe(`bytes 0-4/${BODY.length}`);
      expect(Buffer.from(await res.arrayBuffer()).toString()).toBe('hello');
    });

    it('serves open-ended ranges (bytes=6-)', async () => {
      await uploadObject();
      const dl = await store.createDownloadUrl('test-key');
      const res = await fetch(dl!.url, { headers: { Range: 'bytes=6-' } });
      expect(res.status).toBe(206);
      expect(Buffer.from(await res.arrayBuffer())).toEqual(BODY.subarray(6));
    });

    it('serves suffix ranges (bytes=-9)', async () => {
      await uploadObject();
      const dl = await store.createDownloadUrl('test-key');
      const res = await fetch(dl!.url, { headers: { Range: 'bytes=-9' } });
      expect(res.status).toBe(206);
      expect(Buffer.from(await res.arrayBuffer()).toString()).toBe('forge-sim');
    });

    it('returns 416 for unsatisfiable ranges', async () => {
      await uploadObject();
      const dl = await store.createDownloadUrl('test-key');
      const res = await fetch(dl!.url, { headers: { Range: `bytes=${BODY.length + 10}-` } });
      expect(res.status).toBe(416);
      expect(res.headers.get('content-range')).toBe(`bytes */${BODY.length}`);
    });
  });

  // ── Overwrite semantics (OBJ-007) ──────────────────────────────────

  it('overwrites by default and bumps currentVersion, preserving createdAt', async () => {
    await uploadObject();
    const first = await store.get('test-key');
    fakeNow += 5_000;
    const newData = Buffer.from('replacement content');
    await uploadObject('test-key', newData);
    const second = await store.get('test-key');
    expect(second!.size).toBe(newData.length);
    expect(Number(second!.currentVersion)).toBeGreaterThan(Number(first!.currentVersion));
    expect(second!.createdAt).toBe(first!.createdAt);
    expect(second!.updatedAt).not.toBe(first!.updatedAt);
  });

  it('rejects createUploadUrl with overwrite:false when key is occupied', async () => {
    await uploadObject();
    await expect(store.createUploadUrl(uploadBody({ overwrite: false }))).rejects.toMatchObject({
      code: 'KEY_ALREADY_EXISTS',
    });
  });

  it('rejects at PUT time when object appeared after overwrite:false URL was issued', async () => {
    const { url } = await store.createUploadUrl(uploadBody({ overwrite: false }));
    // Object appears between URL creation and PUT
    await store.put('test-key', Buffer.from('sneaky'));
    const res = await fetch(url, { method: 'PUT', body: new Uint8Array(BODY) });
    expect(res.status).toBe(412);
    // Original object untouched
    expect((await store.download('test-key'))!.toString()).toBe('sneaky');
  });

  // ── Limits (OBJ-008 / OBJ-009) ─────────────────────────────────────

  it('rejects declared lengths over 1 GB', async () => {
    await expect(
      store.createUploadUrl(uploadBody({ length: MAX_OBJECT_SIZE + 1 })),
    ).rejects.toMatchObject({ code: 'OBJECT_TOO_LARGE' });
  });

  it('rejects createUploadUrl payloads over 1 kB', async () => {
    await expect(
      store.createUploadUrl(uploadBody({ key: 'k'.repeat(1100) })),
    ).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
  });

  it('validates checksumType', async () => {
    await expect(
      store.createUploadUrl(uploadBody({ checksumType: 'MD5' })),
    ).rejects.toMatchObject({ code: 'INVALID_CHECKSUM_TYPE' });
  });

  // ── Object TTL (OBJ-011) ───────────────────────────────────────────

  it('rejects ttlSeconds ≤ 1 and > 90 days', async () => {
    await expect(store.createUploadUrl(uploadBody({ ttlSeconds: 1 }))).rejects.toMatchObject({
      code: 'INVALID_TTL',
    });
    await expect(
      store.createUploadUrl(uploadBody({ ttlSeconds: 91 * 24 * 60 * 60 })),
    ).rejects.toMatchObject({ code: 'INVALID_TTL' });
  });

  it('expires objects after their TTL (default 90 days)', async () => {
    await uploadObject();
    fakeNow += (DEFAULT_OBJECT_TTL_SECONDS - 60) * 1000;
    expect(await store.get('test-key')).toBeDefined();
    fakeNow += 120 * 1000; // past the 90-day default
    expect(await store.get('test-key')).toBeUndefined();
    expect(await store.createDownloadUrl('test-key')).toBeUndefined();
  });

  it('honors a custom ttlSeconds', async () => {
    await uploadObject('short-lived', BODY, { ttlSeconds: 60 });
    expect(await store.get('short-lived')).toBeDefined();
    fakeNow += 61_000;
    expect(await store.get('short-lived')).toBeUndefined();
  });

  it('returns 404 when downloading an object that expired after URL creation', async () => {
    await uploadObject('fleeting', BODY, { ttlSeconds: 60 });
    const dl = await store.createDownloadUrl('fleeting');
    fakeNow += 61_000; // object gone, URL still valid (1h)
    const res = await fetch(dl!.url);
    expect(res.status).toBe(404);
  });

  // ── Absent-key semantics (OBJ-004 / OBJ-005 / OBJ-006) ─────────────

  it('returns undefined from createDownloadUrl / get for absent keys', async () => {
    expect(await store.createDownloadUrl('nope')).toBeUndefined();
    expect(await store.get('nope')).toBeUndefined();
  });

  it('delete resolves fine for absent keys and removes existing objects', async () => {
    await expect(store.delete('nope')).resolves.toBeUndefined();
    await uploadObject();
    await store.delete('test-key');
    expect(await store.get('test-key')).toBeUndefined();
  });

  // ── Public URL variants ────────────────────────────────────────────

  it('createPublicUploadUrl / createPublicDownloadUrl behave like the private ones', async () => {
    const { url } = await store.createPublicUploadUrl(uploadBody({ key: 'pub' }));
    const res = await fetch(url, { method: 'PUT', body: new Uint8Array(BODY) });
    expect(res.status).toBe(200);
    const dl = await store.createPublicDownloadUrl('pub');
    expect(dl).toBeDefined();
    const getRes = await fetch(dl!.url);
    expect(Buffer.from(await getRes.arrayBuffer())).toEqual(BODY);
  });

  // ── CDN bucket (cdn flag + createCDNUrl) ───────────────────────────

  describe('CDN bucket', () => {
    it('cdn flag stores into a separate namespace', async () => {
      await uploadObject('shared-key');
      await uploadObject('shared-key', Buffer.from('cdn content'), { cdn: true });
      const def = await store.get('shared-key');
      const cdn = await store.get('shared-key', { cdn: true });
      expect(def!.size).toBe(BODY.length);
      expect(cdn!.size).toBe('cdn content'.length);
      await store.delete('shared-key', { cdn: true });
      expect(await store.get('shared-key')).toBeDefined();
      expect(await store.get('shared-key', { cdn: true })).toBeUndefined();
    });

    it('createCDNUrl serves cdn-bucket objects only', async () => {
      await uploadObject('default-only');
      expect(await store.createCDNUrl('default-only')).toBeUndefined();

      await uploadObject('cdn-obj', Buffer.from('cdn bytes'), { cdn: true });
      const cdnUrl = await store.createCDNUrl('cdn-obj');
      expect(cdnUrl).toBeDefined();
      const res = await fetch(cdnUrl!.url);
      expect(await res.text()).toBe('cdn bytes');
    });

    it('validates createCDNUrl ttlSeconds (> 0, ≤ 29 days)', async () => {
      await uploadObject('cdn-obj', BODY, { cdn: true });
      await expect(store.createCDNUrl('cdn-obj', { ttlSeconds: 0 })).rejects.toMatchObject({
        code: 'INVALID_TTL',
      });
      await expect(
        store.createCDNUrl('cdn-obj', { ttlSeconds: 30 * 24 * 60 * 60 }),
      ).rejects.toMatchObject({ code: 'INVALID_TTL' });
    });

    it('honors createCDNUrl ttlSeconds for URL expiry', async () => {
      await uploadObject('cdn-obj', BODY, { cdn: true });
      const cdnUrl = await store.createCDNUrl('cdn-obj', { ttlSeconds: 60 });
      fakeNow += 61_000;
      const res = await fetch(cdnUrl!.url);
      expect(res.status).toBe(403);
    });
  });

  // ── Deprecated API (OBJ-013) ───────────────────────────────────────

  describe('deprecated put/download', () => {
    it('round-trips content', async () => {
      await store.put('legacy', Buffer.from('legacy content'));
      const buf = await store.download('legacy');
      expect(buf!.toString()).toBe('legacy content');
      // Visible to the modern API too
      expect(await store.get('legacy')).toBeDefined();
    });

    it('returns undefined for absent keys', async () => {
      expect(await store.download('nope')).toBeUndefined();
    });

    it('validates ttlSeconds', async () => {
      await expect(store.put('legacy', 'x', 1)).rejects.toMatchObject({ code: 'INVALID_TTL' });
      await expect(store.put('legacy', 'x', 91 * 24 * 60 * 60)).rejects.toMatchObject({
        code: 'INVALID_TTL',
      });
    });

    it('applies the ttl', async () => {
      await store.put('legacy', 'x', 60);
      fakeNow += 61_000;
      expect(await store.download('legacy')).toBeUndefined();
    });
  });

  // ── setBaseUrl (dev server integration) ────────────────────────────

  it('uses the configured base URL in pre-signed URLs', async () => {
    store.setBaseUrl('http://localhost:9999/');
    const { url } = await store.createUploadUrl(uploadBody());
    expect(url).toMatch(/^http:\/\/localhost:9999\/__object-store\/[A-Za-z0-9_-]+$/);
  });

  // ── Introspection ──────────────────────────────────────────────────

  it('listObjects returns metadata without buffers, filtered by bucket', async () => {
    await uploadObject('a');
    await uploadObject('b', Buffer.from('cdn'), { cdn: true });
    const all = store.listObjects();
    expect(all).toHaveLength(2);
    expect((all[0] as any).buffer).toBeUndefined();
    const cdnOnly = store.listObjects('cdn');
    expect(cdnOnly).toHaveLength(1);
    expect(cdnOnly[0].key).toBe('b');
  });

  it('seedObject + getObjectContent round-trip for test setup', () => {
    store.seedObject({ key: 'seeded', data: 'seeded bytes', contentType: 'text/plain' });
    const content = store.getObjectContent('seeded');
    expect(content!.buffer.toString()).toBe('seeded bytes');
    expect(content!.contentType).toBe('text/plain');
  });

  // ── Persistence ────────────────────────────────────────────────────

  it('dumpAll/restoreAll round-trips objects with metadata', async () => {
    await uploadObject('persist-me');
    await uploadObject('cdn-persist', Buffer.from('cdn data'), { cdn: true });
    const before = await store.get('persist-me');

    const dump = store.dumpAll();
    expect(JSON.parse(JSON.stringify(dump))).toEqual(dump); // JSON-safe

    const restored = new SimulatedObjectStore();
    restored.now = () => fakeNow;
    restored.restoreAll(dump);
    const after = await restored.get('persist-me');
    expect(after).toEqual(before);
    expect((await restored.download('persist-me'))!).toEqual(BODY);
    expect(await restored.get('cdn-persist', { cdn: true })).toBeDefined();
    restored.reset();
  });

  // ── reset ──────────────────────────────────────────────────────────

  it('reset clears objects and invalidates outstanding URLs', async () => {
    await uploadObject();
    const dl = await store.createDownloadUrl('test-key');
    store.reset();
    expect(await store.get('test-key')).toBeUndefined();
    // Server restarts lazily on next URL creation; the old URL's server is
    // closed — fetch should fail or 403 depending on timing.
    await expect(async () => {
      const res = await fetch(dl!.url, { signal: AbortSignal.timeout(2000) });
      if (res.status !== 403) throw new Error('connection refused');
    }).rejects.toThrow();
  });

  it('exposes ObjectStoreError with stable codes', async () => {
    try {
      await store.createUploadUrl(uploadBody({ checksumType: 'NOPE' }));
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ObjectStoreError);
      expect((err as ObjectStoreError).code).toBe('INVALID_CHECKSUM_TYPE');
    }
  });
});
