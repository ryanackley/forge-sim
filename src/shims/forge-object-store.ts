/**
 * Shim for @forge/object-store
 *
 * Provides the `fos` singleton that Forge apps use:
 *   import fos from '@forge/object-store';
 *   const { url } = await fos.createUploadUrl({ key, length, checksum, checksumType });
 *   const ref = await fos.get(key);
 *
 * Delegates to the simulator's SimulatedObjectStore at call time. Pre-signed
 * URLs point at either the dev server (when `setBaseUrl` was called) or a
 * lazily-started ephemeral HTTP server (headless / MCP mode), so app code can
 * `fetch()` them for real.
 *
 * Manifest note: real Forge requires an `objectStore` module in the manifest
 * to enable Object Store. The exact module shape is undocumented (forge-spec
 * open question #9), so the sim is permissive — if the app uses
 * @forge/object-store without declaring `modules.objectStore`, we log a
 * one-time warning instead of failing.
 */

import { getSimulator } from './globals.js';
import type {
  UploadUrlBody,
  PresignedUrlResponse,
  ObjectReference,
  ObjectStoreOptions,
  CDNUrlOptions,
} from '../object-store.js';

let warnedMissingModule = false;

function store() {
  const sim = getSimulator();
  if (!warnedMissingModule) {
    const manifest = sim.getManifest();
    const modules = manifest?.raw?.modules as Record<string, unknown> | undefined;
    if (manifest && (!modules || !('objectStore' in modules))) {
      warnedMissingModule = true;
      console.warn(
        '[forge-sim] ⚠️ @forge/object-store used without an `objectStore` module in the manifest. ' +
        'Real Forge requires one to enable Object Store — deploying anyway.'
      );
    }
  }
  return sim.objectStore;
}

/** Lazy proxy — delegates to the simulator's Object Store at call time */
const fos = {
  createUploadUrl(body: UploadUrlBody): Promise<PresignedUrlResponse> {
    return store().createUploadUrl(body);
  },
  createDownloadUrl(key: string, options?: ObjectStoreOptions): Promise<PresignedUrlResponse | undefined> {
    return store().createDownloadUrl(key, options);
  },
  createPublicUploadUrl(body: UploadUrlBody): Promise<PresignedUrlResponse> {
    return store().createPublicUploadUrl(body);
  },
  createPublicDownloadUrl(key: string, options?: ObjectStoreOptions): Promise<PresignedUrlResponse | undefined> {
    return store().createPublicDownloadUrl(key, options);
  },
  createCDNUrl(key: string, options?: CDNUrlOptions): Promise<PresignedUrlResponse | undefined> {
    return store().createCDNUrl(key, options);
  },
  get(key: string, options?: ObjectStoreOptions): Promise<ObjectReference | undefined> {
    return store().get(key, options);
  },
  delete(key: string, options?: ObjectStoreOptions): Promise<void> {
    return store().delete(key, options);
  },
  /** @deprecated Use createUploadUrl + HTTP PUT instead (matches real @forge/object-store). */
  put(key: string, object: Buffer | Uint8Array | string, ttlSeconds?: number): Promise<void> {
    return store().put(key, object, ttlSeconds);
  },
  /** @deprecated Use createDownloadUrl + HTTP GET instead (matches real @forge/object-store). */
  download(key: string): Promise<Buffer | undefined> {
    return store().download(key);
  },
};

/**
 * Real @forge/object-store 2.0.0's runtime exports are exactly:
 * `objectStore` (the client instance), `errorCodes`, and default = objectStore.
 */
export const objectStore = fos;

export const errorCodes = {
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  APP_NOT_ENABLED: 'APP_NOT_ENABLED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

export { fos };
export type {
  UploadUrlBody,
  PresignedUrlResponse,
  ObjectReference,
  ObjectStoreOptions,
  CDNUrlOptions,
};

export default fos;
