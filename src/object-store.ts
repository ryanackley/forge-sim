/**
 * Simulated Forge Object Store (@forge/object-store).
 *
 * Implements the documented backend API:
 *   - createUploadUrl(body)        → pre-signed PUT URL (1h validity)
 *   - createDownloadUrl(key, opts) → pre-signed GET URL, undefined for absent keys
 *   - createPublicUploadUrl / createPublicDownloadUrl — same behavior in the sim
 *     (everything is localhost; separate methods kept for API parity)
 *   - createCDNUrl(key, opts)      → download URL against the cdn bucket
 *   - get(key, opts)               → ObjectReference | undefined
 *   - delete(key, opts)            → void (absent key resolves fine)
 *   - put / download               → deprecated helpers (kept for parity)
 *
 * Objects live in-memory in two bucket namespaces: 'default' and 'cdn'
 * (the `cdn` flag on upload selects the bucket). Pre-signed URLs point at
 * `${baseUrl}/__object-store/<token>` — in dev mode the dev server provides
 * baseUrl; headless, a private node:http server is lazily started on
 * 127.0.0.1:0 so real fetch()es work in tests and via MCP.
 *
 * Documented limits enforced (parity):
 *   - objects up to 1 GB (OBJ-008)
 *   - createUploadUrl serialized body ≤ 1 kB (OBJ-009)
 *   - pre-signed URLs valid for 1 hour (OBJ-003)
 *   - object TTL: > 1s, ≤ 90 days, default 90 days (OBJ-011)
 *   - CDN URL ttlSeconds: > 0, ≤ 29 days (2,505,600s)
 *   - overwrite defaults to TRUE; overwrite:false + occupied key rejects (OBJ-007)
 *   - checksum verified on upload: SHA1 | SHA256 | CRC32 | CRC32C (OBJ-002)
 *   - Range requests → 206 + Content-Range (OBJ-004)
 *
 * Out of scope (documented, deliberate):
 *   - OBJ-010 rate limits (strict-mode territory, like every other sim quota)
 *   - OBJ-012 multi-installation isolation (sim is single-install)
 *   - CDN caching semantics (cdn flag = separate bucket namespace only)
 */

import { createHash, randomBytes } from 'node:crypto';
import { crc32 } from 'node:zlib';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

// ── Constants (documented Forge limits) ─────────────────────────────────

export const MAX_OBJECT_SIZE = 1024 * 1024 * 1024; // 1 GB
export const MAX_UPLOAD_BODY_BYTES = 1024; // 1 kB serialized createUploadUrl payload
export const PRESIGNED_URL_TTL_MS = 60 * 60 * 1000; // 1 hour
export const DEFAULT_OBJECT_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days
export const MAX_OBJECT_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days
export const MAX_CDN_URL_TTL_SECONDS = 2_505_600; // 29 days

export type ChecksumType = 'SHA1' | 'SHA256' | 'CRC32' | 'CRC32C';

const CHECKSUM_TYPES: ChecksumType[] = ['SHA1', 'SHA256', 'CRC32', 'CRC32C'];

// ── Public API types (match @forge/object-store docs) ───────────────────

export interface UploadUrlBody {
  key: string;
  length: number;
  /** base64-encoded checksum of the object content */
  checksum: string;
  checksumType: ChecksumType;
  /** Object TTL in seconds. > 1s, ≤ 90 days. Default 90 days. */
  ttlSeconds?: number;
  /** Default TRUE per docs. false + occupied key → reject. */
  overwrite?: boolean;
  /** Upload into the CDN bucket namespace. */
  cdn?: boolean;
}

export interface PresignedUrlResponse {
  url: string;
}

/** Shape returned by fos.get() — matches the documented ObjectReference. */
/**
 * Matches @forge/object-store 2.0.0's ObjectReference type
 * ({key, checksum, size, createdAt?, currentVersion?, contentType?}).
 * `updatedAt` is a sim extra used by the tools UI / MCP introspection.
 */
export interface ObjectReference {
  key: string;
  checksum: string;
  size: number;
  createdAt?: string;
  updatedAt?: string;
  currentVersion?: string;
  contentType?: string;
}

export interface ObjectStoreOptions {
  cdn?: boolean;
}

export interface CDNUrlOptions {
  /** URL validity in seconds. > 0, ≤ 29 days. Default: 1 hour. */
  ttlSeconds?: number;
}

// ── Internal types ───────────────────────────────────────────────────────

type Bucket = 'default' | 'cdn';

interface StoredObject {
  key: string;
  bucket: Bucket;
  buffer: Buffer;
  /** base64 checksum as declared/verified at upload */
  checksum: string;
  checksumType: ChecksumType;
  contentType: string;
  size: number;
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
  currentVersion: number;
  expiresAt: number; // epoch ms
}

interface PresignedToken {
  kind: 'upload' | 'download';
  key: string;
  bucket: Bucket;
  urlExpiresAt: number; // epoch ms
  upload?: {
    length: number;
    checksum: string;
    checksumType: ChecksumType;
    overwrite: boolean;
    objectTtlSeconds: number;
  };
}

/** Serializable dump for persistence. Buffers are base64-encoded. */
export interface ObjectStoreDump {
  objects: Array<Omit<StoredObject, 'buffer'> & { data: string }>;
}

/** Error with a stable `code` for programmatic assertions. */
export class ObjectStoreError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ObjectStoreError';
    this.code = code;
  }
}

// ── Checksums ────────────────────────────────────────────────────────────

/** CRC32C (Castagnoli), reflected polynomial 0x82F63B78. */
const CRC32C_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0x82f63b78 : crc >>> 1;
    }
    table[i] = crc >>> 0;
  }
  return table;
})();

function crc32c(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32C_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function crcToBase64(value: number): string {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(value >>> 0, 0);
  return b.toString('base64');
}

/** Compute the base64 checksum of a buffer for a given checksum type. */
export function computeChecksum(buf: Buffer, type: ChecksumType): string {
  switch (type) {
    case 'SHA1':
      return createHash('sha1').update(buf).digest('base64');
    case 'SHA256':
      return createHash('sha256').update(buf).digest('base64');
    case 'CRC32':
      return crcToBase64(crc32(buf));
    case 'CRC32C':
      return crcToBase64(crc32c(buf));
  }
}

// ── Range header parsing ─────────────────────────────────────────────────

function parseRange(header: string, size: number): { start: number; end: number } | null {
  // bytes=start-end | bytes=start- | bytes=-suffix
  const m = header.match(/^bytes=(\d*)-(\d*)$/);
  if (!m) return null;
  const [, startStr, endStr] = m;
  if (startStr === '' && endStr === '') return null;
  let start: number;
  let end: number;
  if (startStr === '') {
    // suffix range: last N bytes
    const suffix = parseInt(endStr, 10);
    if (suffix === 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = parseInt(startStr, 10);
    end = endStr === '' ? size - 1 : Math.min(parseInt(endStr, 10), size - 1);
  }
  if (start > end || start >= size) return null;
  return { start, end };
}

// ── SimulatedObjectStore ─────────────────────────────────────────────────

export class SimulatedObjectStore {
  private objects = new Map<string, StoredObject>(); // "{bucket}:{key}"
  private tokens = new Map<string, PresignedToken>();

  private baseUrl: string | null = null;
  private ephemeralServer: Server | null = null;

  /** Injectable clock for expiry tests. */
  now: () => number = () => Date.now();

  // ── URL base management ────────────────────────────────────────────

  /**
   * Set the base URL used in pre-signed URLs (dev server calls this with
   * its own origin). Any already-running ephemeral server stays up so
   * previously issued URLs keep working; new URLs use the new base.
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  /**
   * Resolve the base URL for pre-signed URLs. Headless (no dev server),
   * lazily start a private node:http server so URLs are actually fetchable.
   */
  private async ensureBaseUrl(): Promise<string> {
    if (this.baseUrl) return this.baseUrl;
    if (!this.ephemeralServer) {
      const server = createServer(async (req, res) => {
        const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
        const handled = await this.handleRequest(req, res, pathname);
        if (!handled) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
        }
      });
      server.unref(); // don't hold the process open
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve());
      });
      this.ephemeralServer = server;
    }
    const addr = this.ephemeralServer.address();
    if (addr === null || typeof addr === 'string') {
      throw new ObjectStoreError('SERVER_ERROR', 'Object store server has no address');
    }
    return `http://127.0.0.1:${addr.port}`;
  }

  /** Close the ephemeral server (restarts lazily on next URL creation). */
  private closeEphemeralServer(): void {
    if (this.ephemeralServer) {
      this.ephemeralServer.close();
      this.ephemeralServer = null;
    }
  }

  // ── Key helpers ────────────────────────────────────────────────────

  private objKey(bucket: Bucket, key: string): string {
    return `${bucket}:${key}`;
  }

  private bucketOf(options?: ObjectStoreOptions): Bucket {
    return options?.cdn ? 'cdn' : 'default';
  }

  /** Get a live (non-expired) object, lazily removing expired ones. */
  private liveObject(bucket: Bucket, key: string): StoredObject | undefined {
    const obj = this.objects.get(this.objKey(bucket, key));
    if (!obj) return undefined;
    if (obj.expiresAt <= this.now()) {
      this.objects.delete(this.objKey(bucket, key));
      return undefined;
    }
    return obj;
  }

  private issueToken(token: PresignedToken): string {
    const id = randomBytes(24).toString('base64url');
    this.tokens.set(id, token);
    return id;
  }

  // ── Backend API (matches @forge/object-store) ──────────────────────

  async createUploadUrl(body: UploadUrlBody): Promise<PresignedUrlResponse> {
    // OBJ-009: serialized request payload ≤ 1 kB
    const serialized = JSON.stringify(body ?? {});
    if (Buffer.byteLength(serialized, 'utf-8') > MAX_UPLOAD_BODY_BYTES) {
      throw new ObjectStoreError(
        'PAYLOAD_TOO_LARGE',
        `createUploadUrl request payload exceeds ${MAX_UPLOAD_BODY_BYTES} bytes`,
      );
    }
    if (!body || typeof body.key !== 'string' || body.key.length === 0) {
      throw new ObjectStoreError('INVALID_KEY', 'Object key must be a non-empty string');
    }
    if (typeof body.length !== 'number' || !Number.isFinite(body.length) || body.length < 0) {
      throw new ObjectStoreError('INVALID_LENGTH', 'length must be a non-negative number');
    }
    // OBJ-008: objects up to 1 GB
    if (body.length > MAX_OBJECT_SIZE) {
      throw new ObjectStoreError(
        'OBJECT_TOO_LARGE',
        `Object length ${body.length} exceeds the 1 GB limit`,
      );
    }
    if (typeof body.checksum !== 'string' || body.checksum.length === 0) {
      throw new ObjectStoreError('INVALID_CHECKSUM', 'checksum must be a non-empty base64 string');
    }
    if (!CHECKSUM_TYPES.includes(body.checksumType)) {
      throw new ObjectStoreError(
        'INVALID_CHECKSUM_TYPE',
        `checksumType must be one of ${CHECKSUM_TYPES.join(', ')}`,
      );
    }
    let ttlSeconds = DEFAULT_OBJECT_TTL_SECONDS;
    if (body.ttlSeconds !== undefined) {
      if (typeof body.ttlSeconds !== 'number' || body.ttlSeconds <= 1) {
        throw new ObjectStoreError('INVALID_TTL', 'ttlSeconds must be greater than 1 second');
      }
      if (body.ttlSeconds > MAX_OBJECT_TTL_SECONDS) {
        throw new ObjectStoreError('INVALID_TTL', 'ttlSeconds must not exceed 90 days');
      }
      ttlSeconds = body.ttlSeconds;
    }
    const overwrite = body.overwrite ?? true; // docs: default TRUE
    const bucket: Bucket = body.cdn ? 'cdn' : 'default';

    // OBJ-007: overwrite=false + occupied key → reject at URL creation time
    if (!overwrite && this.liveObject(bucket, body.key)) {
      throw new ObjectStoreError(
        'KEY_ALREADY_EXISTS',
        `Object with key "${body.key}" already exists and overwrite is false`,
      );
    }

    const base = await this.ensureBaseUrl();
    const token = this.issueToken({
      kind: 'upload',
      key: body.key,
      bucket,
      urlExpiresAt: this.now() + PRESIGNED_URL_TTL_MS,
      upload: {
        length: body.length,
        checksum: body.checksum,
        checksumType: body.checksumType,
        overwrite,
        objectTtlSeconds: ttlSeconds,
      },
    });
    return { url: `${base}/__object-store/${token}` };
  }

  async createDownloadUrl(
    key: string,
    options?: ObjectStoreOptions,
  ): Promise<PresignedUrlResponse | undefined> {
    const bucket = this.bucketOf(options);
    if (!this.liveObject(bucket, key)) return undefined; // OBJ-004: absent → undefined
    const base = await this.ensureBaseUrl();
    const token = this.issueToken({
      kind: 'download',
      key,
      bucket,
      urlExpiresAt: this.now() + PRESIGNED_URL_TTL_MS,
    });
    return { url: `${base}/__object-store/${token}` };
  }

  /** Public variant — identical semantics in the sim (everything is localhost). */
  async createPublicUploadUrl(body: UploadUrlBody): Promise<PresignedUrlResponse> {
    return this.createUploadUrl(body);
  }

  /** Public variant — identical semantics in the sim (everything is localhost). */
  async createPublicDownloadUrl(
    key: string,
    options?: ObjectStoreOptions,
  ): Promise<PresignedUrlResponse | undefined> {
    return this.createDownloadUrl(key, options);
  }

  /** CDN URL — download URL against the cdn bucket namespace. */
  async createCDNUrl(
    key: string,
    options?: CDNUrlOptions,
  ): Promise<PresignedUrlResponse | undefined> {
    let ttlMs = PRESIGNED_URL_TTL_MS;
    if (options?.ttlSeconds !== undefined) {
      if (
        typeof options.ttlSeconds !== 'number' ||
        options.ttlSeconds <= 0 ||
        options.ttlSeconds > MAX_CDN_URL_TTL_SECONDS
      ) {
        throw new ObjectStoreError(
          'INVALID_TTL',
          `CDN URL ttlSeconds must be > 0 and ≤ ${MAX_CDN_URL_TTL_SECONDS} (29 days)`,
        );
      }
      ttlMs = options.ttlSeconds * 1000;
    }
    if (!this.liveObject('cdn', key)) return undefined;
    const base = await this.ensureBaseUrl();
    const token = this.issueToken({
      kind: 'download',
      key,
      bucket: 'cdn',
      urlExpiresAt: this.now() + ttlMs,
    });
    return { url: `${base}/__object-store/${token}` };
  }

  /** OBJ-005: metadata for an object, undefined when absent/expired. */
  async get(key: string, options?: ObjectStoreOptions): Promise<ObjectReference | undefined> {
    const obj = this.liveObject(this.bucketOf(options), key);
    if (!obj) return undefined;
    return {
      key: obj.key,
      checksum: obj.checksum,
      size: obj.size,
      createdAt: new Date(obj.createdAt).toISOString(),
      updatedAt: new Date(obj.updatedAt).toISOString(),
      currentVersion: String(obj.currentVersion),
      contentType: obj.contentType,
    };
  }

  /** OBJ-006: delete resolves fine for absent keys. */
  async delete(key: string, options?: ObjectStoreOptions): Promise<void> {
    this.objects.delete(this.objKey(this.bucketOf(options), key));
  }

  // ── Deprecated API (OBJ-013) ───────────────────────────────────────

  /**
   * @deprecated Kept for parity with @forge/object-store's deprecated put().
   * Stores directly into the default bucket with a computed SHA256 checksum.
   */
  async put(key: string, object: Buffer | Uint8Array | string, ttlSeconds?: number): Promise<void> {
    if (typeof key !== 'string' || key.length === 0) {
      throw new ObjectStoreError('INVALID_KEY', 'Object key must be a non-empty string');
    }
    const buffer = Buffer.isBuffer(object)
      ? object
      : typeof object === 'string'
        ? Buffer.from(object, 'utf-8')
        : Buffer.from(object);
    if (buffer.length > MAX_OBJECT_SIZE) {
      throw new ObjectStoreError('OBJECT_TOO_LARGE', 'Object exceeds the 1 GB limit');
    }
    let ttl = DEFAULT_OBJECT_TTL_SECONDS;
    if (ttlSeconds !== undefined) {
      if (typeof ttlSeconds !== 'number' || ttlSeconds <= 1 || ttlSeconds > MAX_OBJECT_TTL_SECONDS) {
        throw new ObjectStoreError(
          'INVALID_TTL',
          'ttlSeconds must be greater than 1 second and at most 90 days',
        );
      }
      ttl = ttlSeconds;
    }
    this.storeObject({
      key,
      bucket: 'default',
      buffer,
      checksum: computeChecksum(buffer, 'SHA256'),
      checksumType: 'SHA256',
      contentType: 'application/octet-stream',
      ttlSeconds: ttl,
    });
  }

  /**
   * @deprecated Kept for parity with @forge/object-store's deprecated download().
   */
  async download(key: string): Promise<Buffer | undefined> {
    const obj = this.liveObject('default', key);
    return obj ? Buffer.from(obj.buffer) : undefined;
  }

  // ── Internal store write ───────────────────────────────────────────

  private storeObject(params: {
    key: string;
    bucket: Bucket;
    buffer: Buffer;
    checksum: string;
    checksumType: ChecksumType;
    contentType: string;
    ttlSeconds: number;
  }): StoredObject {
    const now = this.now();
    const existing = this.liveObject(params.bucket, params.key);
    const obj: StoredObject = {
      key: params.key,
      bucket: params.bucket,
      buffer: params.buffer,
      checksum: params.checksum,
      checksumType: params.checksumType,
      contentType: params.contentType,
      size: params.buffer.length,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      // Per-object version: a fresh key starts at 1, overwrites increment.
      currentVersion: (existing?.currentVersion ?? 0) + 1,
      expiresAt: now + params.ttlSeconds * 1000,
    };
    this.objects.set(this.objKey(params.bucket, params.key), obj);
    return obj;
  }

  // ── HTTP handler for pre-signed URLs ───────────────────────────────

  /**
   * Handle a request to /__object-store/<token>. Returns true if the
   * request was handled, false if the path doesn't match (same contract
   * as the web-trigger handler).
   */
  async handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
    pathname: string,
  ): Promise<boolean> {
    const match = pathname.match(/^\/__object-store\/([^/]+)$/);
    if (!match) return false;

    const tokenId = match[1];

    // CORS preflight (Custom UI fetches from the browser)
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Range',
      });
      res.end();
      return true;
    }

    const token = this.tokens.get(tokenId);
    const fail = (status: number, code: string, message: string) => {
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({ code, message }));
    };

    // OBJ-003: expired or unknown pre-signed URL → 403
    if (!token || token.urlExpiresAt <= this.now()) {
      fail(403, 'URL_EXPIRED', 'Pre-signed URL is expired or invalid');
      return true;
    }

    if (req.method === 'PUT') {
      if (token.kind !== 'upload') {
        fail(403, 'WRONG_URL_KIND', 'This pre-signed URL does not permit uploads');
        return true;
      }
      const constraints = token.upload!;

      // Buffer the body
      const chunks: Buffer[] = [];
      let total = 0;
      let aborted = false;
      await new Promise<void>((resolve, reject) => {
        req.on('data', (chunk: Buffer) => {
          total += chunk.length;
          if (total > MAX_OBJECT_SIZE) {
            aborted = true;
            resolve();
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });
        req.on('end', () => resolve());
        req.on('error', reject);
      });
      if (aborted) {
        fail(413, 'OBJECT_TOO_LARGE', 'Object exceeds the 1 GB limit');
        return true;
      }
      const body = Buffer.concat(chunks);

      // Declared length must match — mismatch stores nothing (OBJ-002)
      if (body.length !== constraints.length) {
        fail(
          400,
          'LENGTH_MISMATCH',
          `Uploaded ${body.length} bytes but ${constraints.length} were declared`,
        );
        return true;
      }

      // Checksum must match — mismatch stores nothing (OBJ-002)
      const actual = computeChecksum(body, constraints.checksumType);
      if (actual !== constraints.checksum) {
        fail(
          400,
          'CHECKSUM_MISMATCH',
          `${constraints.checksumType} checksum mismatch: expected ${constraints.checksum}, got ${actual}`,
        );
        return true;
      }

      // Overwrite re-validated at PUT time (object may have appeared since)
      if (!constraints.overwrite && this.liveObject(token.bucket, token.key)) {
        fail(
          412,
          'KEY_ALREADY_EXISTS',
          `Object with key "${token.key}" already exists and overwrite is false`,
        );
        return true;
      }

      const contentType = (req.headers['content-type'] as string) || 'application/octet-stream';
      const obj = this.storeObject({
        key: token.key,
        bucket: token.bucket,
        buffer: body,
        checksum: constraints.checksum,
        checksumType: constraints.checksumType,
        contentType,
        ttlSeconds: constraints.objectTtlSeconds,
      });

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        ETag: `"${obj.checksum}"`,
      });
      res.end(JSON.stringify({ key: obj.key, checksum: obj.checksum, size: obj.size }));
      return true;
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      if (token.kind !== 'download') {
        fail(403, 'WRONG_URL_KIND', 'This pre-signed URL does not permit downloads');
        return true;
      }
      const obj = this.liveObject(token.bucket, token.key);
      if (!obj) {
        fail(404, 'OBJECT_NOT_FOUND', `Object "${token.key}" no longer exists`);
        return true;
      }

      const baseHeaders: Record<string, string> = {
        'Content-Type': obj.contentType,
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
        ETag: `"${obj.checksum}"`,
      };

      const rangeHeader = req.headers.range;
      if (rangeHeader) {
        const range = parseRange(String(rangeHeader), obj.size);
        if (!range) {
          res.writeHead(416, {
            ...baseHeaders,
            'Content-Range': `bytes */${obj.size}`,
          });
          res.end();
          return true;
        }
        const slice = obj.buffer.subarray(range.start, range.end + 1);
        res.writeHead(206, {
          ...baseHeaders,
          'Content-Range': `bytes ${range.start}-${range.end}/${obj.size}`,
          'Content-Length': String(slice.length),
        });
        res.end(req.method === 'HEAD' ? undefined : slice);
        return true;
      }

      res.writeHead(200, { ...baseHeaders, 'Content-Length': String(obj.size) });
      res.end(req.method === 'HEAD' ? undefined : obj.buffer);
      return true;
    }

    fail(405, 'METHOD_NOT_ALLOWED', `Method ${req.method} not allowed`);
    return true;
  }

  // ── Introspection (MCP / tools UI) ─────────────────────────────────

  /** List all live objects' metadata (optionally filtered by bucket). */
  listObjects(bucket?: Bucket): Array<Omit<StoredObject, 'buffer'> & { bucket: Bucket }> {
    const now = this.now();
    const out: Array<Omit<StoredObject, 'buffer'> & { bucket: Bucket }> = [];
    for (const obj of this.objects.values()) {
      if (obj.expiresAt <= now) continue;
      if (bucket && obj.bucket !== bucket) continue;
      const { buffer: _buffer, ...meta } = obj;
      out.push(meta);
    }
    return out;
  }

  /** Read raw object content (MCP / tools UI). */
  getObjectContent(
    key: string,
    options?: ObjectStoreOptions,
  ): { buffer: Buffer; contentType: string } | undefined {
    const obj = this.liveObject(this.bucketOf(options), key);
    if (!obj) return undefined;
    return { buffer: Buffer.from(obj.buffer), contentType: obj.contentType };
  }

  /** Seed an object directly (MCP / test setup). */
  seedObject(params: {
    key: string;
    data: Buffer | string;
    contentType?: string;
    cdn?: boolean;
    ttlSeconds?: number;
  }): ObjectReference {
    const buffer = Buffer.isBuffer(params.data) ? params.data : Buffer.from(params.data, 'utf-8');
    const obj = this.storeObject({
      key: params.key,
      bucket: params.cdn ? 'cdn' : 'default',
      buffer,
      checksum: computeChecksum(buffer, 'SHA256'),
      checksumType: 'SHA256',
      contentType: params.contentType ?? 'application/octet-stream',
      ttlSeconds: params.ttlSeconds ?? DEFAULT_OBJECT_TTL_SECONDS,
    });
    return {
      key: obj.key,
      checksum: obj.checksum,
      size: obj.size,
      createdAt: new Date(obj.createdAt).toISOString(),
      updatedAt: new Date(obj.updatedAt).toISOString(),
      currentVersion: String(obj.currentVersion),
      contentType: obj.contentType,
    };
  }

  // ── Persistence ────────────────────────────────────────────────────

  /** Dump full state for persistence. Tokens are ephemeral and excluded. */
  dumpAll(): ObjectStoreDump {
    return {
      objects: [...this.objects.values()].map(({ buffer, ...meta }) => ({
        ...meta,
        data: buffer.toString('base64'),
      })),
    };
  }

  /** Restore full state from a persistence dump. */
  restoreAll(dump: ObjectStoreDump): void {
    if (!dump?.objects) return;
    for (const entry of dump.objects) {
      const { data, ...meta } = entry;
      this.objects.set(this.objKey(entry.bucket, entry.key), {
        ...meta,
        buffer: Buffer.from(data, 'base64'),
      });
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────

  /** Clear all state and stop the ephemeral server (restarts lazily). */
  reset(): void {
    this.objects.clear();
    this.tokens.clear();
    this.closeEphemeralServer();
  }

  /** Stop the ephemeral server without clearing data. */
  stop(): void {
    this.closeEphemeralServer();
  }
}
