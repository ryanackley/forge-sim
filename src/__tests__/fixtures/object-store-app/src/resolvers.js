/**
 * Object Store resolver contract — the backend half of @forge/bridge's
 * objectStore.* client methods. These resolver shapes match what the real
 * bridge code sends/expects:
 *
 *   upload      → invoke(fn, { allObjectMetadata }) → { presignedUrl: { key, checksum } }
 *   download    → invoke(fn, { keys })              → { downloadUrl: key }
 *   getMetadata → invoke(fn, { key })               → metadata object (per key)
 *   delete      → invoke(fn, { key })               → anything (awaited per key)
 */
import Resolver from '@forge/resolver';
import fos from '@forge/object-store';

const resolver = new Resolver();

// Bridge upload contract: receives every file's { length, checksum, checksumType },
// returns a map of presignedUrl → { key, checksum } so the client can PUT each blob.
resolver.define('generateUploadUrls', async ({ payload }) => {
  const { allObjectMetadata } = payload;
  const result = {};
  for (let i = 0; i < allObjectMetadata.length; i++) {
    const meta = allObjectMetadata[i];
    const key = `uploads/file-${i}`;
    const { url } = await fos.createUploadUrl({
      key,
      length: meta.length,
      checksum: meta.checksum,
      checksumType: meta.checksumType,
    });
    result[url] = { key, checksum: meta.checksum };
  }
  return result;
});

// Bridge download contract: receives { keys }, returns downloadUrl → key.
resolver.define('generateDownloadUrls', async ({ payload }) => {
  const result = {};
  for (const key of payload.keys) {
    const res = await fos.createDownloadUrl(key);
    if (res) result[res.url] = key;
  }
  return result;
});

// Bridge getMetadata contract: invoked once per key with { key }.
resolver.define('getObjectMetadata', async ({ payload }) => {
  const ref = await fos.get(payload.key);
  return ref ?? { key: payload.key, error: 'Not found' };
});

// Bridge delete contract: invoked once per key with { key }.
resolver.define('deleteObject', async ({ payload }) => {
  await fos.delete(payload.key);
  return { deleted: payload.key };
});

export const handler = resolver.getDefinitions();
