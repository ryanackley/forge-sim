/**
 * global.__forge_fetch__ — the backend I/O seam (Phase 2 of the bare-seam
 * migration; descriptor inventory in src/runtime/seam-registry.ts).
 *
 * Lesson 5 from the bridge consolidation: tests that drive our own stand-ins
 * prove nothing about the real path. Every test here loads the REAL published
 * package via createRequire (CJS resolution bypasses the vitest shim aliases)
 * and lets it hit the seam with its real wire shapes — the same code a
 * BUNDLED app would run.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { createSimulator, type ForgeSimulator } from '../simulator.js';

const require = createRequire(import.meta.url);

const APP_UUID = '12345678-1234-1234-1234-123456789abc';

const MANIFEST = `
modules:
  webtrigger:
    - key: hook
      function: wt
  trigger:
    - key: on-custom
      function: trig
      events:
        - avi:cloud:ecosystem::event/${APP_UUID}/my-event
  function:
    - key: wt
      handler: index.wt
    - key: trig
      handler: index.trig
app:
  id: ari:cloud:ecosystem::app/${APP_UUID}
  runtime:
    name: nodejs22.x
permissions:
  scopes: []
  external:
    fetch:
      backend:
        - remote: my-remote
        - remote: google-apis
providers:
  auth:
    - key: google
      name: Google
      type: oauth2
      clientId: cid
      scopes:
        - openid
      remotes:
        - google-apis
      bearerMethod: authorization-header
      actions:
        authorization:
          remote: google-account
          path: /o/oauth2/v2/auth
        exchange:
          remote: google-oauth
          path: /token
        refreshToken:
          remote: google-oauth
          path: /token
        revokeToken:
          remote: google-oauth
          path: /revoke
        retrieveProfile:
          remote: google-apis
          path: /userinfo/v2/me
          resolvers:
            id: id
            displayName: email
            avatarUrl: picture
remotes:
  - key: my-remote
    baseUrl: https://backend.example.com
  - key: google-apis
    baseUrl: https://api.example.com
  - key: google-account
    baseUrl: https://accounts.example.com
  - key: google-oauth
    baseUrl: https://oauth.example.com
`;

describe('__forge_fetch__ seam, driven by the real packages', () => {
  let sim: ForgeSimulator;

  beforeAll(async () => {
    sim = createSimulator();
    await sim.loadManifest(MANIFEST);
    // deploy() normally does this; the test loads the manifest without one.
    sim.webTriggerUrls.registerModules(sim.getManifest()!.webTriggers);
  });

  afterAll(async () => {
    await sim.stop();
  });

  // ── @forge/events: queue over /webhook/queue/* ───────────────────────────

  it('real Queue.push delivers to the consumer and honors the client-minted jobId', async () => {
    const received: unknown[] = [];
    sim.registerConsumer('jobs', async (event: any) => {
      received.push(event.body ?? event);
    });

    const { Queue } = require('@forge/events');
    const queue = new Queue({ key: 'jobs' });

    const { jobId } = await queue.push([{ body: { n: 1 } }, { body: { n: 2 } }]);
    expect(jobId).toMatch(/^[0-9a-f-]{36}$/);
    expect(received).toHaveLength(2);

    // Stats are looked up by the jobId the CLIENT minted — the seam honoring
    // it is what makes this find the job (events/out/queue.js:22).
    const stats = await queue.getStats(jobId);
    expect(stats).toEqual({ success: 2, inProgress: 0, failed: 0 });

    await expect(queue.cancel(jobId)).resolves.toBeUndefined();
  });

  it('real getStats on an unknown job surfaces JobDoesNotExistError from the 404', async () => {
    const { Queue } = require('@forge/events');
    const queue = new Queue({ key: 'jobs' });
    const err = await queue.getStats('00000000-0000-0000-0000-000000000000').then(
      () => null,
      (e: Error) => e,
    );
    expect(err?.constructor.name).toBe('JobDoesNotExistError');
    expect(err?.message).toMatch(/was not found for the queue jobs/);
  });

  it('real appEvents.publish fires the subscribed trigger', async () => {
    let fired: unknown = null;
    sim.resolver.define('trig', (event: any) => {
      fired = event;
      return 'ok';
    });

    const { appEvents } = require('@forge/events');
    const result = await appEvents.publish({ key: 'my-event' });
    expect(result).toEqual({ type: 'success', failedEvents: [] });
    expect(fired).toMatchObject({ eventType: `avi:cloud:ecosystem::event/${APP_UUID}/my-event` });
  });

  // ── @forge/object-store ──────────────────────────────────────────────────

  it('real objectStore roundtrip: upload URL → PUT → metadata → download → delete', async () => {
    const { objectStore } = require('@forge/object-store');
    const content = 'hello object store';
    const checksum = createHash('sha256').update(content).digest('base64');

    const { url: uploadUrl } = await objectStore.createUploadUrl({
      key: 'greeting',
      length: content.length,
      checksum,
      checksumType: 'SHA256',
    });
    const put = await fetch(uploadUrl, { method: 'PUT', body: content });
    expect(put.status).toBe(200);

    const ref = await objectStore.get('greeting');
    expect(ref).toMatchObject({ key: 'greeting', size: content.length });

    const { url: downloadUrl } = (await objectStore.createDownloadUrl('greeting'))!;
    const got = await fetch(downloadUrl);
    expect(await got.text()).toBe(content);

    await objectStore.delete('greeting');
    expect(await objectStore.get('greeting')).toBeUndefined();
  });

  // ── @forge/llm ───────────────────────────────────────────────────────────

  it('real llm chat, list and stream run against sim.llm mocks', async () => {
    const llm = require('@forge/llm');
    sim.llm.mockResponses({ content: 'mocked answer' }, { content: 'streamed answer' });

    const chat = await llm.chat({
      model: 'claude-sonnet-4-5',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(chat.choices[0].message.content).toEqual([{ type: 'text', text: 'mocked answer' }]);

    const { models } = await llm.list();
    expect(models.length).toBeGreaterThan(0);

    // Stream framing is newline-delimited JSON read off response.body — this
    // only works because the llm handler returns a NATIVE Response.
    const stream = await llm.stream({
      model: 'claude-sonnet-4-5',
      messages: [{ role: 'user', content: 'hi' }],
    });
    const chunks: any[] = [];
    for await (const chunk of stream) {
      chunks.push(typeof chunk === 'string' ? JSON.parse(chunk) : chunk);
    }
    expect(chunks).toHaveLength(1);
    expect(chunks[0].choices[0].message.content).toEqual([{ type: 'text', text: 'streamed answer' }]);
  });

  // ── @forge/realtime ──────────────────────────────────────────────────────

  it('real realtime: signRealtimeToken works; scoped publish outside a resolver reports Unauthorized', async () => {
    const realtime = require('@forge/realtime');

    const signed = await realtime.signRealtimeToken('room', { boardId: 1 }, ['subscribe']);
    expect(signed.errors).toBeUndefined();
    expect(signed.token).toBeTruthy();
    expect(typeof signed.expiresAt).toBe('number');

    // The sim's invocation-context gate answers through the TOP-LEVEL GraphQL
    // errors array, which the real package maps back to result.errors —
    // message preserved end to end.
    const denied = await realtime.publish('room', { hello: true });
    expect(denied).toMatchObject({
      eventId: null,
      eventTimestamp: null,
      errors: [{ message: 'Unauthorized request' }],
    });

    const global_ = await realtime.publishGlobal('room', { hello: true });
    expect(global_.errors).toBeUndefined(); // no subscribers → null ids, but a success result
  });

  // ── @forge/api: webTrigger URLs over stargate GraphQL ────────────────────

  it('real webTrigger.getUrl / queryUrls / deleteUrl roundtrip', async () => {
    const realApi = require('@forge/api');

    const url = await realApi.webTrigger.getUrl('hook');
    expect(url).toMatch(/\/x1\//);

    const urls = await realApi.webTrigger.queryUrls();
    expect(urls).toEqual([{ moduleKey: 'hook', url }]);

    await realApi.webTrigger.deleteUrl(url);
    expect(await realApi.webTrigger.queryUrls()).toEqual([]);
  });

  // ── @forge/api: invokeRemote over frc ────────────────────────────────────

  it('real invokeRemote reaches a mocked remote; an unknown key throws InvalidRemoteError', async () => {
    sim.mockProductRoutes('my-remote', { 'GET /ping': { pong: true } });

    const realApi = require('@forge/api');
    const res = await realApi.invokeRemote('my-remote', { path: '/ping' });
    expect(await res.json()).toEqual({ pong: true });

    // INVALID_REMOTE on the forge-proxy-error header is what the real package
    // converts to its typed error (api/out/api/endpoint.js:44-53). Upstream
    // sets the instance's .name to the error CODE, not the class name.
    const err = await realApi.invokeRemote('nope', { path: '/x' }).then(
      () => null,
      (e: Error) => e,
    );
    expect(err?.constructor.name).toBe('InvalidRemoteError');
    expect(err?.name).toBe('INVALID_REMOTE_ERR');
  });

  // ── @forge/api: withProvider over tpp ────────────────────────────────────

  it('real withProvider with no account fails CLIENT-side, like real Forge', async () => {
    const realApi = require('@forge/api');
    // withProvider is built entirely from runtime.externalAuth (the Phase 1
    // projection). With no stored account, the real package never reaches the
    // seam: its fetch slot is a thrower bound at construction
    // (api/out/api/fetch.js:104-111). Matching that exactly is parity.
    const provider = realApi.asUser().withProvider('google');
    expect(await provider.hasCredentials()).toBe(false);
    // The thrower is bound in place of fetch, so it throws SYNCHRONOUSLY.
    expect(() => provider.fetch('/userinfo/v2/me')).toThrow(
      /no credentials previously requested/,
    );
  });

  it('tpp with an account whose token is gone answers NEEDS_AUTHENTICATION_ERR on the header', async () => {
    // The wire case behind NeedsAuthenticationError: an account EXISTS in the
    // runtime metadata (so the real package sends the request), but the seam
    // finds no valid token. Driven at the seam directly because seeding a
    // half-expired account is an ExternalAuthStore implementation detail.
    const res = await (globalThis as any).__forge_fetch__(
      { type: 'tpp', provider: 'google', remote: 'google-apis', accountId: 'acc-1' },
      '/userinfo/v2/me',
    );
    expect(res.status).toBe(401);
    expect(res.headers.get('forge-proxy-error')).toBe('NEEDS_AUTHENTICATION_ERR');
  });

  it('real withProvider on an unconfigured provider fails at construction, like real Forge', () => {
    const realApi = require('@forge/api');
    expect(() => realApi.asUser().withProvider('github')).toThrow(/Bad provider or missing config/);
  });

  // ── The seam itself ──────────────────────────────────────────────────────

  it('answers with fetch-Response-shaped objects (single-read body, Headers)', async () => {
    const res = await (globalThis as any).__forge_fetch__(
      { type: 'fpp', provider: 'app', remote: 'jira' },
      '/rest/api/3/myself',
    );
    // The wrappers implement Response rather than extend it; the packages
    // duck-type (.ok/.status/.json()/.text()/headers.get), so assert that.
    expect(typeof res.ok).toBe('boolean');
    expect(typeof res.status).toBe('number');
    expect(typeof res.json).toBe('function');
    expect(typeof res.text).toBe('function');
    expect(res.headers.get('forge-proxy-error')).toBeNull();
    await res.text();
    await expect(res.text()).rejects.toThrow(); // single-read, like a real Response
  });

  it('rejects unknown descriptor types instead of resolving undefined', async () => {
    await expect(
      (globalThis as any).__forge_fetch__({ type: 'bogus' }, '/x'),
    ).rejects.toThrow(/unknown __forge_fetch__ descriptor type "bogus"/);
  });

  it('rejects invokeService (container services) with a named not-implemented error', async () => {
    const realApi = require('@forge/api');
    await expect(realApi.invokeService('svc', { path: '/x' })).rejects.toThrow(
      /container services are not yet implemented/,
    );
  });
});
