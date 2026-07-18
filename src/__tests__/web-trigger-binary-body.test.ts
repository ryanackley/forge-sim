/**
 * Eval-7 F3 — web trigger binary body wire-faithfulness.
 *
 * Web trigger bodies are strings, and both forge-sim's HTTP surface and real
 * Forge UTF-8 encode them onto the wire. A handler that returns raw binary
 * via `buf.toString('latin1')` gets corrupted over HTTP (every byte ≥ 0x80
 * expands to two UTF-8 bytes) — but `sim.fireWebTrigger()` used to hand the
 * string back untouched, so an in-process test suite could green-light an
 * app that corrupts data over a real socket. The eval's repro: a 70-byte PNG
 * came back as 84 bytes from curl while the vitest suite passed.
 *
 * Fix: `executeWebTrigger` normalizes non-ASCII bodies with *binary*
 * content-types to a latin1 (byte-per-char) view of the actual wire bytes,
 * flags it via `bodyEncoding: 'latin1'`, and warns with the base64 fix. The
 * HTTP writer reconstructs the exact same wire bytes from the normalized
 * body, so the wire behavior is unchanged — the in-process surface just
 * stops lying about it. Text content-types stay untouched: HTTP clients
 * UTF-8-decode them back to the original string, so the handler's string is
 * already the faithful representation.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { createSimulator, type ForgeSimulator } from '../simulator.js';
import { createWebTriggerHandler, executeWebTrigger } from '../web-trigger.js';
import type { ManifestWebTrigger } from '../manifest.js';

// Fake-PNG payload: magic bytes + some high-bit bytes. 12 raw bytes, 4 of
// them ≥ 0x80 → UTF-8 wire form is 16 bytes.
const BINARY_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0xd8, 0xfe]);
const BINARY_LATIN1 = BINARY_BYTES.toString('latin1');
const BINARY_UTF8_WIRE = Buffer.from(BINARY_LATIN1, 'utf8');

const MANIFEST = `
modules:
  webtrigger:
    - key: bin-hook
      function: binHandler
  function:
    - key: binHandler
      handler: src/index.handler
app:
  id: ari:cloud:ecosystem::app/test
`;

async function simWithHandler(handler: (req: any, ctx: any) => any): Promise<ForgeSimulator> {
  const sim = createSimulator();
  await sim.loadManifest(MANIFEST);
  sim.resolver.define('binHandler', handler as any);
  return sim;
}

describe('eval-7 F3 — in-process surface (sim.fireWebTrigger)', () => {
  it('normalizes a binary-content-type body to the wire bytes and flags bodyEncoding', async () => {
    const sim = await simWithHandler(async () => ({
      statusCode: 200,
      headers: { 'Content-Type': ['image/png'] },
      body: BINARY_LATIN1,
    }));

    const res = await sim.fireWebTrigger('bin-hook');

    expect(res.statusCode).toBe(200);
    expect(res.bodyEncoding).toBe('latin1');
    // The body is now the byte-per-char view of what actually crosses the
    // wire: the handler's 12-char string, UTF-8 expanded to 17 bytes.
    expect(res.body).toBe(BINARY_UTF8_WIRE.toString('latin1'));
    expect(Buffer.from(res.body, 'latin1').equals(BINARY_UTF8_WIRE)).toBe(true);
    // The corruption is now VISIBLE in-process — sha/size checks fail here
    // exactly like they fail against curl (the eval's 70 → 84 byte repro).
    expect(Buffer.from(res.body, 'latin1').equals(BINARY_BYTES)).toBe(false);

    // Loud warning with the fix, captured into the sim's console log.
    const warns = sim.getConsoleLogs().filter((l) => l.level === 'warn');
    expect(warns.some((l) => /Base64-encode binary bodies/.test(l.message))).toBe(true);
    expect(warns.some((l) => l.message.includes(`${BINARY_LATIN1.length} chars → ${BINARY_UTF8_WIRE.length} bytes`))).toBe(true);
  });

  it('leaves text content-types untouched (UTF-8 text round-trips through HTTP)', async () => {
    const json = JSON.stringify({ place: 'café', emoji: '🌙' });
    const sim = await simWithHandler(async () => ({
      statusCode: 200,
      headers: { 'content-type': ['application/json; charset=utf-8'] },
      body: json,
    }));

    const res = await sim.fireWebTrigger('bin-hook');
    expect(res.body).toBe(json);
    expect(res.bodyEncoding).toBeUndefined();
    expect(sim.getConsoleLogs().filter((l) => l.level === 'warn')).toEqual([]);
  });

  it('leaves pure-ASCII bodies untouched regardless of content-type (base64 mode is byte-perfect)', async () => {
    const b64 = BINARY_BYTES.toString('base64');
    const sim = await simWithHandler(async () => ({
      statusCode: 200,
      headers: { 'content-type': ['application/octet-stream'] },
      body: b64,
    }));

    const res = await sim.fireWebTrigger('bin-hook');
    expect(res.body).toBe(b64);
    expect(res.bodyEncoding).toBeUndefined();
    expect(Buffer.from(res.body, 'base64').equals(BINARY_BYTES)).toBe(true);
  });

  it('missing content-type defaults to text/plain and stays untouched', async () => {
    const sim = await simWithHandler(async () => ({
      statusCode: 200,
      body: 'héllo', // default content-type is text/plain → text, not binary
    }));

    const res = await sim.fireWebTrigger('bin-hook');
    expect(res.body).toBe('héllo');
    expect(res.bodyEncoding).toBeUndefined();
  });
});

describe('eval-7 F3 — static output surface', () => {
  it('normalizes binary static outputs too (fix covers all surfaces)', async () => {
    const sim = createSimulator();
    const trigger: ManifestWebTrigger = {
      key: 'static-bin',
      functionKey: 'staticFn',
      responseType: 'static',
      outputs: [
        { key: 'img', statusCode: 200, contentType: 'image/png', body: BINARY_LATIN1 },
      ],
    } as any;
    sim.resolver.define('staticFn', (async () => ({ outputKey: 'img' })) as any);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const res = await executeWebTrigger(sim, trigger, { method: 'GET', path: '/', userPath: '', headers: {}, queryParameters: {}, body: '' });
      expect(res.statusCode).toBe(200);
      expect(res.bodyEncoding).toBe('latin1');
      expect(Buffer.from(res.body, 'latin1').equals(BINARY_UTF8_WIRE)).toBe(true);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Base64-encode binary bodies'));
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('eval-7 F3 — HTTP surface emits identical wire bytes', () => {
  let server: Server | undefined;

  afterEach(() => {
    server?.close();
    server = undefined;
  });

  async function serve(sim: ForgeSimulator, triggers: Array<{ key: string; functionKey: string }>): Promise<number> {
    const handler = createWebTriggerHandler({ triggers: triggers as ManifestWebTrigger[], simulator: sim });
    return new Promise((resolve) => {
      server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const handled = await handler(req, res, url.pathname);
        if (!handled) {
          res.writeHead(404);
          res.end('Not found');
        }
      });
      server.listen(0, '127.0.0.1', () => {
        resolve((server!.address() as { port: number }).port);
      });
    });
  }

  it('HTTP bytes match the in-process latin1 view (and the pre-fix wire behavior)', async () => {
    const sim = await simWithHandler(async () => ({
      statusCode: 200,
      headers: { 'content-type': ['image/png'] },
      body: BINARY_LATIN1,
    }));
    const port = await serve(sim, [{ key: 'bin-hook', functionKey: 'binHandler' }]);

    const httpRes = await fetch(`http://127.0.0.1:${port}/__trigger/bin-hook`);
    const httpBytes = Buffer.from(await httpRes.arrayBuffer());

    // Wire bytes are the UTF-8 expansion — unchanged from before the fix
    // (this is exactly what the eval's curl observed: 12 raw bytes → 17).
    expect(httpBytes.equals(BINARY_UTF8_WIRE)).toBe(true);

    // And the in-process surface reports the SAME bytes now.
    const inProc = await sim.fireWebTrigger('bin-hook');
    expect(Buffer.from(inProc.body, 'latin1').equals(httpBytes)).toBe(true);
  });

  it('text bodies round-trip through HTTP unchanged (no double-encoding)', async () => {
    const json = JSON.stringify({ place: 'café' });
    const sim = await simWithHandler(async () => ({
      statusCode: 200,
      headers: { 'content-type': ['application/json'] },
      body: json,
    }));
    const port = await serve(sim, [{ key: 'bin-hook', functionKey: 'binHandler' }]);

    const httpRes = await fetch(`http://127.0.0.1:${port}/__trigger/bin-hook`);
    expect(await httpRes.text()).toBe(json);
  });
});
