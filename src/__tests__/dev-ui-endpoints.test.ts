/**
 * The Tools API ui/* endpoints on the dev-mode deploy path (adversarial
 * 1019 F9).
 *
 * `forge-sim dev` once deployed through its own loader, which never called
 * sim.setAppDir(). sim.ui.render() resolves resources off that directory,
 * so `POST /__tools/api/ui/render` answered 500 "No app directory set.
 * Deploy an app first." for the whole session, even though dev mode had
 * just deployed the app, and `/api/ui/context` 404'd forever behind it.
 *
 * The dev path is now `devDeploy`, a wrapper over deploy(), which sets the
 * app dir. Headless render runs its own esbuild pass (independent of Vite),
 * so it works on the dev path exactly as it does under deploy().
 *
 * The other half of F9 is wording: a browser tab's render lives in the
 * browser's React tree and never reaches these endpoints. That is correct
 * behaviour, but "No UI rendered yet" reads like a lie to someone looking
 * at their rendered page — the messages now name the distinction.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { createSimulator, ForgeSimulator } from '../simulator.js';
import { createApiHandler } from '../tools/api.js';
import { devDeploy } from '../dev-command.js';
import { parseManifest } from '../manifest.js';

const FIXTURE = join(import.meta.dirname, 'fixtures/simple-panel');

describe('Tools API ui/* endpoints on the dev deploy path', () => {
  let sim: ForgeSimulator;
  let server: ReturnType<typeof createServer>;
  let url: string;

  beforeAll(async () => {
    sim = createSimulator();
    const manifest = await parseManifest(join(FIXTURE, 'manifest.yml'));
    // Exactly how `forge-sim dev` deploys.
    await devDeploy(sim, FIXTURE);

    const handler = createApiHandler(sim, manifest);
    server = createServer((req, res) => {
      const u = new URL(req.url ?? '/', 'http://localhost');
      void handler(req, res, u);
    });
    await new Promise<void>((res) => server.listen(0, '127.0.0.1', () => res()));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('bind failed');
    url = `http://127.0.0.1:${address.port}`;
  }, 60_000);

  afterAll(async () => {
    await new Promise<void>((res, rej) => server.close((e) => (e ? rej(e) : res())));
    await sim.stop();
  });

  it('the dev deploy path sets the app dir, like deploy() does', () => {
    expect(sim.getAppDir()).toBe(FIXTURE);
  });

  it('before any headless render, ui/state and ui/context name the headless/browser split', async () => {
    const state = await (await fetch(`${url}/api/ui/state`)).json();
    expect(state.rendered).toBe(false);
    expect(state.message).toContain('headless');
    expect(state.message).toContain('browser');

    const ctxRes = await fetch(`${url}/api/ui/context?module=simple-panel`);
    expect(ctxRes.status).toBe(404);
    const ctx = await ctxRes.json();
    expect(ctx.error).toContain('simple-panel');
    expect(ctx.error).toContain('browser');
  });

  it('POST /api/ui/render renders the module instead of 500-ing on a missing app dir', async () => {
    const res = await fetch(`${url}/api/ui/render`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ moduleKey: 'simple-panel', issueKey: 'PROJ-1' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rendered).toBe(true);
    expect(body.tree).toContain('Simple Panel Rendered');
    expect(body.context.extension.issueKey).toBe('PROJ-1');
  }, 60_000);

  it('ui/state and ui/context answer once a headless render has happened', async () => {
    const state = await (await fetch(`${url}/api/ui/state`)).json();
    expect(state.rendered).toBe(true);
    expect(state.tree).toContain('Simple Panel Rendered');

    const ctx = await (await fetch(`${url}/api/ui/context?module=simple-panel`)).json();
    expect(ctx.extension.type).toBe('jira:issuePanel');
    expect(ctx.extension.issueKey).toBe('PROJ-1');
  });
});
