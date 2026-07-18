/**
 * In-process web trigger firing — eval bugs B4 and B5.
 *
 * B4: the deployer's catch-all step registered webtrigger functions as
 * 'generic' resolvers, so they showed up in the deploy summary's
 * `resolvers` list AND were invocable via `sim.invoke()` — which applies
 * the resolver { payload, context } convention. Web trigger handlers
 * expect (request, context), so the call "worked" but handed the handler
 * garbage. Real Forge has no bridge-invoke path to a web trigger.
 *
 * B5: there was no way to fire a web trigger without standing up the HTTP
 * dev server. `sim.fireWebTrigger()` (and the MCP forge.fire_web_trigger
 * tool) share the same executeWebTrigger core as the HTTP route, so the
 * surfaces cannot drift.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { join } from 'node:path';
import { ForgeSimulator, createSimulator } from '../simulator.js';
import type { DeployResult } from '../deployer.js';

const FIXTURE = join(import.meta.dirname, 'fixtures/webtrigger-app');

describe('B4 — web trigger functions are not resolvers', () => {
  let sim: ForgeSimulator;
  let result: DeployResult;

  beforeEach(async () => {
    sim = new ForgeSimulator();
    result = await sim.deploy(FIXTURE);
  });

  it('deploy summary lists web triggers in `webTriggers`, not `resolvers`', () => {
    expect(result.webTriggers).toEqual([
      { key: 'github-webhook', function: 'webhook' },
      { key: 'health-check', function: 'health' },
    ]);
    expect(result.resolvers).not.toContain('webhook');
    expect(result.resolvers).not.toContain('health');
  });

  it('registers web trigger functions with type "webTrigger"', () => {
    expect(sim.functions.getType('webhook')).toBe('webTrigger');
    expect(sim.functions.getType('health')).toBe('webTrigger');
  });

  it('sim.invoke() on a web trigger function throws with a pointer to fireWebTrigger', async () => {
    await expect(sim.invoke('webhook', { some: 'payload' })).rejects.toThrow(
      /web trigger handler.*\(request, context\).*fireWebTrigger\("github-webhook"\)/s
    );
  });
});

describe('eval-6 F13 — webtrigger hint survives a registry miss', () => {
  it('manifest-only load (no handlers registered) still gets the fireWebTrigger hint', async () => {
    // The eval's exact scenario: deploy loaded 0 functions, so the typed
    // registry had no idea "webhook" was a web trigger. The manifest still
    // knows the binding — the guard must consult it, not just the registry,
    // otherwise the caller gets the generic "No resolver defined" error.
    const sim = createSimulator();
    await sim.loadManifest(join(FIXTURE, 'manifest.yml'));

    // Precondition: typed registry genuinely empty for this key
    expect(sim.functions.getType('webhook')).toBeUndefined();

    await expect(sim.invoke('webhook', { some: 'payload' })).rejects.toThrow(
      /web trigger handler.*\(request, context\).*fireWebTrigger\("github-webhook"\)/s
    );
  });
});

describe('B5 — sim.fireWebTrigger()', () => {
  let sim: ForgeSimulator;

  beforeEach(async () => {
    sim = new ForgeSimulator();
    await sim.deploy(FIXTURE);
  });

  it('fires a dynamic web trigger with the full Forge request shape', async () => {
    const res = await sim.fireWebTrigger('github-webhook', {
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      queryParameters: { ref: ['main', 'dev'] },
      body: { action: 'opened' },
    });

    expect(res.statusCode).toBe(200);
    // Response header casing is the handler's — preserved verbatim (eval 3 #4)
    expect(res.headers['Content-Type']).toEqual(['application/json']);
    expect(res.headers['content-type']).toBeUndefined();

    const body = JSON.parse(res.body);
    expect(body.method).toBe('POST'); // method uppercased
    expect(body.path).toBe('/__trigger/github-webhook');
    expect(body.query.ref).toEqual(['main', 'dev']); // multi-value preserved
    expect(body.contentType).toEqual(['application/json']); // headers lowercased + arrayified
    expect(body.echo).toEqual({ action: 'opened' }); // object body JSON-stringified on the wire
    expect(body.hasContext).toBe(true); // (request, context) convention
  });

  it('bare fire defaults to GET with empty body', async () => {
    const res = await sim.fireWebTrigger('github-webhook');
    const body = JSON.parse(res.body);
    expect(res.statusCode).toBe(200);
    expect(body.method).toBe('GET');
    expect(body.echo).toBeNull();
  });

  it('userPath is appended to the trigger path', async () => {
    const res = await sim.fireWebTrigger('github-webhook', { userPath: '/hooks/push' });
    const body = JSON.parse(res.body);
    expect(body.path).toBe('/__trigger/github-webhook/hooks/push');
  });

  it('a throwing handler becomes a 500 response, not a thrown error (parity: webhook caller sees 500)', async () => {
    const res = await sim.fireWebTrigger('github-webhook', { userPath: '/boom' });
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.message).toBe('handler exploded');
  });

  it('a malformed handler result becomes a 500 response (WTR-009)', async () => {
    const res = await sim.fireWebTrigger('github-webhook', { userPath: '/bad-shape' });
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.error).toContain('invalid response');
    expect(body.received).toContain('nope');
  });

  it('static response mode resolves the configured output (WTR-011)', async () => {
    const up = await sim.fireWebTrigger('health-check');
    expect(up.statusCode).toBe(200);
    expect(up.body).toBe('{"status":"up"}');
    expect(up.headers['content-type']).toEqual(['application/json']);

    const down = await sim.fireWebTrigger('health-check', {
      queryParameters: { state: 'down' },
    });
    expect(down.statusCode).toBe(503);
    expect(down.body).toBe('{"status":"down"}');
  });

  it('static mode with an unknown outputKey is a 500 listing available outputs', async () => {
    const res = await sim.fireWebTrigger('health-check', {
      queryParameters: { state: 'missing' },
    });
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.error).toContain('unknown outputKey "nope"');
    expect(body.available).toEqual(['up', 'down']);
  });

  it('unknown trigger key throws listing available triggers (setup error, caller can fix)', async () => {
    await expect(sim.fireWebTrigger('nope')).rejects.toThrow(
      /No web trigger with key "nope".*Available: github-webhook, health-check/s
    );
  });

  it('throws before deploy — no manifest loaded', async () => {
    const fresh = createSimulator();
    await expect(fresh.fireWebTrigger('anything')).rejects.toThrow(/No manifest loaded/);
  });
});
