/**
 * Context propagation to bridge-invoked resolvers — 0.1.1 eval HIGH-1.
 *
 * The canonical Forge pattern: a resolver reads `context.extension.project.key`
 * (or `.issue`, `.content`). In real Forge that works whenever the resolver is
 * invoked from UI code via `invoke()` from @forge/bridge. In forge-sim 0.1.1 it
 * silently returned undefined on ALL three surfaces (in-process render, MCP
 * render, dev browser) because:
 *
 *   1. Headless: the render overlay FLATTENED extension fields to the top level
 *      of the resolver context (`context.project` — a field real Forge never
 *      delivers) instead of nesting them under `context.extension`.
 *   2. Dev server: the `invoke` RPC dropped context entirely — only moduleKey
 *      was forwarded.
 *
 * These tests are the eval's ctx-echo probe app, inverted into assertions.
 * The fixture's resolver echoes back its req.context; the frontend invokes it
 * on mount and renders the result.
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, beforeAll } from 'vitest';
import { createSimulator, ForgeSimulator } from '../simulator.js';
import { createDevServer } from '../dev-server.js';
import type { DevServer } from '../dev-server.js';
import { WebSocket } from 'ws';

const FIXTURE_DIR = new URL('./fixtures/ctx-echo', import.meta.url).pathname;

// ── Headless surface: sim.ui.render → bridge invoke → resolver ─────────

describe('UI bridge → resolver context propagation (headless)', () => {
  let sim: ForgeSimulator;

  beforeEach(async () => {
    sim = createSimulator();
    await sim.deploy(FIXTURE_DIR);
  });

  afterEach(async () => {
    await sim.stop();
  });

  it('resolver sees context.extension from an explicit extension option', async () => {
    // The eval's exact repro: render with { extension: { project: ... } },
    // resolver must see it NESTED under context.extension.
    await sim.ui.render('ctx-echo', {
      extension: { project: { key: 'EVAL' } },
    });

    const doc = await sim.ui.waitForContent('ctx-echo', 'EXT_PROJECT=EVAL');
    const text = sim.ui.getTextContent(doc);
    expect(text).toContain('EXT_PROJECT=EVAL');
    // Real Forge never delivers context.project / context.issue at the top
    // level — flattening extension fields is the inverse parity violation.
    expect(text).toContain('FLATTENED=clean');
  });

  it('resolver sees hydrated context.extension from the issueKey shortcut', async () => {
    sim.mockProductRoutes('jira', {
      'GET /rest/api/3/issue/PROJ-42': {
        id: '10042',
        key: 'PROJ-42',
        fields: {
          summary: 'Test issue',
          issuetype: { id: '10001', name: 'Task' },
          project: { id: '10000', key: 'PROJ', projectTypeKey: 'software' },
        },
      },
    });

    await sim.ui.render('ctx-echo', { issueKey: 'PROJ-42' });

    const doc = await sim.ui.waitForContent('ctx-echo', 'EXT_ISSUE=PROJ-42');
    const text = sim.ui.getTextContent(doc);
    expect(text).toContain('EXT_ISSUE=PROJ-42');
    expect(text).toContain('EXT_PROJECT=PROJ');
    expect(text).toContain('FLATTENED=clean');
  });

  it('resolver sees a default extension (with module type) when rendered with no options', async () => {
    await sim.ui.render('ctx-echo');

    // Even with no context options, the resolver's context.extension must be
    // an object (real Forge always delivers one), never null/undefined.
    const doc = await sim.ui.waitForContent('ctx-echo', 'EXT_TYPE=jira:issuePanel');
    const text = sim.ui.getTextContent(doc);
    expect(text).toContain('EXT_TYPE=jira:issuePanel');
    expect(text).toContain('FLATTENED=clean');
  });

  it('render overlay nests extension for resolver.invoke without flattened top-level fields', async () => {
    await sim.ui.render('ctx-echo', {
      extension: { project: { key: 'EVAL' }, issue: { key: 'EVAL-7' } },
    });

    // Direct look at what a resolver invoked under the render overlay sees.
    const result = await sim.invoke('echoContext', {}) as any;
    expect(result.ext?.project?.key).toBe('EVAL');
    expect(result.ext?.issue?.key).toBe('EVAL-7');
    expect(result.flattenedProject).toBeNull();
    expect(result.flattenedIssue).toBeNull();
  });
});

// ── Dev-server surface: WS invoke RPC → resolver ────────────────────────

describe('Dev-server invoke RPC context propagation', () => {
  const TEST_PORT = 15184;
  let sim: ForgeSimulator;
  let server: DevServer;
  let ws: WebSocket;

  function rpc(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = `test-${Date.now()}-${Math.random()}`;
      const timeout = setTimeout(() => reject(new Error(`RPC timeout: ${method}`)), 5000);
      const handler = (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.requestId === requestId) {
            ws.off('message', handler);
            clearTimeout(timeout);
            if (msg.error) reject(new Error(msg.error));
            else resolve(msg.result);
          }
        } catch {}
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({ type: 'rpc', requestId, method, params }));
    });
  }

  beforeAll(async () => {
    sim = createSimulator();
    await sim.deploy(FIXTURE_DIR);
    server = await createDevServer({ port: TEST_PORT, simulator: sim });
  });

  beforeEach(async () => {
    ws = new WebSocket(`ws://localhost:${server.port}`);
    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', reject);
    });
  });

  afterEach(() => {
    if (ws.readyState === WebSocket.OPEN) ws.close();
  });

  afterAll(async () => {
    server.close();
    await sim.stop();
  });

  it('invoke threads context from client contextOptions to the resolver', async () => {
    const result = await rpc('invoke', {
      functionKey: 'echoContext',
      payload: {},
      moduleKey: 'ctx-echo',
      contextOptions: { extension: { project: { key: 'DEVX' } } },
    });

    expect(result.ext?.project?.key).toBe('DEVX');
    expect(result.flattenedProject).toBeNull();
    expect(result.flattenedIssue).toBeNull();
  });

  it('invoke and getContext derive from the same context (frontend/resolver parity)', async () => {
    const contextOptions = { extension: { issue: { key: 'DEV-9' }, project: { key: 'DEV' } } };

    const frontendCtx = await rpc('getContext', { moduleKey: 'ctx-echo', contextOptions });
    const result = await rpc('invoke', {
      functionKey: 'echoContext',
      payload: {},
      moduleKey: 'ctx-echo',
      contextOptions,
    });

    // What useProductContext() sees and what the resolver sees must describe
    // the same placement — that's the parity requirement real Forge upholds.
    expect(frontendCtx.extension.issue.key).toBe('DEV-9');
    expect(result.ext?.issue?.key).toBe('DEV-9');
    expect(result.ext?.project?.key).toBe(frontendCtx.extension.project.key);
    expect(result.accountId).toBe(frontendCtx.accountId);
    expect(result.cloudId).toBe(frontendCtx.cloudId);
  });

  it('invoke without contextOptions still delivers a default extension object', async () => {
    const result = await rpc('invoke', {
      functionKey: 'echoContext',
      payload: {},
      moduleKey: 'ctx-echo',
    });

    // Fallback path (no client options, no startup context) — extension must
    // still be an object, never dropped.
    expect(result.ext).not.toBeNull();
    expect(typeof result.ext).toBe('object');
    expect(result.flattenedProject).toBeNull();
    expect(result.flattenedIssue).toBeNull();
  });
});
