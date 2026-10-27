/**
 * Forge Sim Tools — REST API handler.
 *
 * Wraps the ForgeSimulator in HTTP endpoints for the tools UI.
 * Used by both `forge-sim dev` (Vite middleware) and `forge-sim serve` (standalone daemon).
 *
 * The manifest can be passed directly (dev mode, known at startup) or
 * resolved lazily from sim.getManifest() (daemon mode, set after deploy).
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ForgeSimulator } from '../simulator.js';
import type { ParsedManifest } from '../manifest.js';
import { getTriggerEventTemplateMap } from '../trigger-event-templates.js';
import { getOAuthCallbackRegistry } from '../auth/oauth-callback-registry.js';
import { applyMockFile, type MockFileSummary } from '../mock-file.js';
import {
  loadCredentials,
  saveCredentials,
  getDefaultAccount,
  setThirdPartyToken,
} from '../auth/credentials.js';

type ApiHandler = (req: IncomingMessage, res: ServerResponse, url: URL) => Promise<void>;

export interface CreateApiHandlerOptions {
  /** Push state-change events to connected browser tabs (Tools UI). */
  broadcastStateChange?: (type: string, data?: any) => void;
  /** App directory — required for persistent provider token storage. */
  appDir?: string;
  /**
   * Load stored credentials (`sim.loadAuthFromEnv()`) after every
   * `/api/deploy` and `/api/reset`, without the caller asking. `forge-sim dev`
   * passes `!offline` so a Tools-UI deploy or reset does not silently drop the
   * connection it booted with. The daemon passes
   * nothing: there a deploy connects only when its body says `connect: true`
   * (`forge-sim deploy --connect`). See src/auth/connect-policy.ts.
   *
   * Either way every deploy and reset first takes back what an earlier
   * connect loaded (`sim.unloadAuth()`), so the connection matches THIS
   * request's policy: one that did not ask to connect keeps none of the
   * stored credentials — no Atlassian account, provider token (refreshed or
   * not), provider secret or `auth --llm` key from an earlier `--connect` —
   * and one that connects reloads from the store after deploying. Not
   * gated by this: an ANTHROPIC_API_KEY in the process env, and an unmocked
   * remote, which `invokeRemote` reaches with or without credentials.
   */
  connectByDefault?: boolean;
  /**
   * Re-apply `<appDir>/.forge-sim/mocks.json` (`options.appDir`) after every
   * reset — `/api/reset` and a resetting `/api/deploy` — before deploying or
   * reconnecting. `forge-sim dev` passes true: it applies the file at boot
   * and on every save, and a reset that wiped those mocks and then
   * reconnected would send the routes the file still declares to the real
   * site. Defaults to `connectByDefault`: a handler that reconnects after a
   * reset must never do so with the file unapplied.
   */
  reapplyMockFile?: boolean;
}

type AuthSummary = import('../simulator.js').LoadAuthResult;
type UnloadSummary = import('../simulator.js').UnloadAuthResult;
/** What re-applying dev's mocks.json after a reset did (reported in the response). */
type MockFileOutcome = { applied: MockFileSummary } | { error: string };

/** The part of an unload worth telling the caller about, or undefined if nothing was dropped. */
function droppedConnection(dropped: UnloadSummary): UnloadSummary | undefined {
  return dropped.atlassian || dropped.providers.length > 0 || dropped.providerSecrets > 0 || dropped.llm
    ? dropped
    : undefined;
}

/** Connect per policy; a failed load is reported as offline, never thrown. */
async function loadStoredCredentials(sim: ForgeSimulator): Promise<AuthSummary> {
  return sim.loadAuthFromEnv().catch(
    (): AuthSummary => ({ atlassian: { connected: false }, providers: [] }),
  );
}

function json(res: ServerResponse, data: any, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => body += chunk);
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

/**
 * Create the REST API handler.
 *
 * @param sim - ForgeSimulator instance
 * @param manifestOrNull - If provided, used directly (dev mode). If null/undefined, resolved from sim.getManifest() per-request (daemon mode).
 */
export function createApiHandler(
  sim: ForgeSimulator,
  manifestOrNull?: ParsedManifest | null,
  options: CreateApiHandlerOptions = {},
): ApiHandler {
  /**
   * Re-apply dev's `.forge-sim/mocks.json` after a reset (options.reapplyMockFile).
   * Returns what happened for the response, or undefined when not asked / no file.
   * A broken file is reported, not thrown — same as dev boot.
   */
  const reapplyMockFile = (): MockFileOutcome | undefined => {
    const reapply = options.reapplyMockFile ?? options.connectByDefault === true;
    if (!reapply || !options.appDir) return undefined;
    try {
      const summary = applyMockFile(sim, options.appDir);
      return summary ? { applied: summary } : undefined;
    } catch (err: any) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  };

  return async (req, res, url) => {
    const path = url.pathname;
    const method = req.method ?? 'GET';
    const manifest = manifestOrNull ?? sim.getManifest();
    const triggerEventTemplates = manifest
      ? getTriggerEventTemplateMap(manifest.triggers.flatMap((trigger) => trigger.events))
      : {};

    try {
      // ── Health (daemon mode) ────────────────────────────────────────
      if (path === '/api/health' && method === 'GET') {
        return json(res, {
          status: 'ok',
          deployed: !!manifest,
          appName: manifest?.raw?.app?.name ?? null,
          uptime: process.uptime(),
        });
      }

      // ── Deploy (daemon mode) ───────────────────────────────────────
      if (path === '/api/deploy' && method === 'POST') {
        const body = await readBody(req);
        const { appDir, reset } = body;
        if (!appDir) return json(res, { error: 'Missing appDir' }, 400);
        if (body.connect !== undefined && typeof body.connect !== 'boolean') {
          return json(res, { error: `"connect" must be a boolean (true loads stored credentials; false stays offline).` }, 400);
        }
        // Explicit `connect` in the body wins (the CLI resolves --connect /
        // --offline / FORGE_SIM_CONNECT on its side — the daemon's env is
        // whatever spawned it); otherwise the handler's channel default.
        const shouldConnect = body.connect === true
          || (body.connect !== false && options.connectByDefault === true);

        // Every deploy first takes back whatever an earlier connect loaded,
        // BEFORE anything runs (deploy fires deploy-time triggers, which
        // therefore never see stored credentials): one that does not connect stays
        // that way — `--no-reset` included — and one that connects reloads
        // from the store after deploying, so its connection matches the
        // store rather than an earlier request. The unload is reported only
        // when it ends a connection the caller did not ask to keep.
        const dropped = sim.unloadAuth();
        const disconnected = shouldConnect ? undefined : droppedConnection(dropped);
        let mockFile: MockFileOutcome | undefined;
        if (reset !== false) {
          await sim.reset();
          sim.ui.reset();
          mockFile = reapplyMockFile();
        }

        let auth: AuthSummary | undefined;
        try {
          // Continue-and-inform surface: never throw on deploy errors,
          // always type-check (once per deploy request is cheap). Errors
          // and typeErrors come back in the response body. (Eval-6 F3/F4/F10)
          const result = await sim.deploy(appDir, { throwOnError: false, typeCheck: true });
          // Credentials load only when the policy says so.
          if (shouldConnect) auth = await loadStoredCredentials(sim);
          return json(res, {
            success: result.errors.length === 0,
            app: result.manifest.raw.app,
            loadedFunctions: result.loadedFunctions,
            loadedResources: result.loadedResources,
            resolvers: sim.resolver.getDefinitions(),
            triggers: result.triggers,
            triggerEventTemplates: getTriggerEventTemplateMap(result.manifest.triggers.flatMap((trigger) => trigger.events)),
            consumers: result.consumers,
            webTriggers: result.webTriggers,
            scheduledTriggers: result.scheduledTriggers,
            uiModules: result.uiModules,
            errors: result.errors,
            warnings: result.warnings,
            ...(result.typeErrors && result.typeErrors.length > 0 ? { typeErrors: result.typeErrors } : {}),
            ...(auth ? { auth } : {}),
            ...(disconnected ? { disconnected } : {}),
            ...(mockFile ? { mockFile } : {}),
          });
        } catch (err) {
          // A failed deploy ends in the same credential state as a
          // successful one, and says so the same way: a connecting deploy
          // still ends connected, as its policy says (dev must not go
          // offline on a broken deploy); one that does not connect still
          // reports what the unload above dropped (and what the reset
          // re-applied).
          if (shouldConnect && !auth) auth = await loadStoredCredentials(sim);
          return json(res, {
            error: err instanceof Error ? err.message : String(err),
            ...(auth ? { auth } : {}),
            ...(disconnected ? { disconnected } : {}),
            ...(mockFile ? { mockFile } : {}),
          }, 500);
        }
      }

      // ── Reset ──────────────────────────────────────────────────────
      if (path === '/api/reset' && method === 'POST') {
        // reset() drops the Atlassian connection with the rest of the
        // productApi state but keeps provider tokens and the LLM key; take
        // back everything an earlier connect loaded so the state matches the
        // channel's policy. A channel that connects by default (dev) then
        // re-applies its mocks.json and reconnects, so a Tools-UI reset
        // neither goes silently offline nor
        // leaves the file's routes unmocked while connected. reset() keeps
        // the app dir.
        const dropped = sim.unloadAuth();
        await sim.reset();
        sim.ui.reset();
        const mockFile = reapplyMockFile();
        let auth: AuthSummary | undefined;
        if (options.connectByDefault === true) {
          if (!sim.getAppDir() && options.appDir) sim.setAppDir(options.appDir);
          if (sim.getAppDir()) auth = await loadStoredCredentials(sim);
        }
        const disconnected = auth ? undefined : droppedConnection(dropped);
        return json(res, {
          success: true,
          message: 'Simulator reset. All state cleared (in-memory + SQL tables dropped).',
          ...(auth ? { auth } : {}),
          ...(disconnected ? { disconnected } : {}),
          ...(mockFile ? { mockFile } : {}),
        });
      }

      // ── Manifest ───────────────────────────────────────────────────
      if (path === '/api/manifest' && method === 'GET') {
        if (!manifest) return json(res, { error: 'No app deployed. Deploy an app first.' }, 404);
        return json(res, {
          appName: manifest.raw.app?.name,
          appId: manifest.raw.app?.id,
          functions: [...manifest.functions.entries()].map(([key, fn]) => ({ key, handler: fn.handler })),
          uiModules: manifest.uiModules.map(m => ({ key: m.key, type: m.type, title: m.title, resolverFunctionKey: m.resolverFunctionKey, resourceKey: m.resourceKey })),
          consumers: manifest.consumers.map(c => ({ key: c.key, queue: c.queue, functionKey: c.functionKey })),
          triggers: manifest.triggers.map(t => ({ key: t.key, functionKey: t.functionKey, events: t.events })),
          triggerEventTemplates,
          scheduledTriggers: manifest.scheduledTriggers.map(s => ({ key: s.key, functionKey: s.functionKey, interval: s.interval })),
          resources: [...manifest.resources.entries()].map(([key, r]) => ({
            key,
            path: r.path,
            ...(r.bundler !== undefined ? { bundler: r.bundler } : {}),
            ...(r.entry !== undefined ? { entry: r.entry } : {}),
          })),
          actions: manifest.actions.map(a => ({
            key: a.key,
            name: a.name,
            description: a.description,
            functionKey: a.functionKey,
            actionVerb: a.actionVerb,
            inputs: a.inputs,
          })),
        });
      }

      // ── Functions ──────────────────────────────────────────────────
      if (path === '/api/functions' && method === 'GET') {
        const registered = sim.functions.keys().map(key => ({
          key,
          type: sim.functions.getType(key),
        }));
        const resolverDefs = sim.resolver.getDefinitions();
        return json(res, { registered, resolverDefinitions: resolverDefs });
      }

      // ── KVS ────────────────────────────────────────────────────────
      if (path === '/api/kvs' && method === 'GET') {
        const dump = await sim.kvs.dump();
        // Eval-10 F6: the CLI sends ?prefix= but the handler never read it,
        // so `forge-sim kvs list --prefix foo:` silently returned everything.
        const prefix = url.searchParams.get('prefix');
        const entries = Object.entries(dump)
          .filter(([key]) => !prefix || key.startsWith(prefix))
          .map(([key, value]) => ({ key, value }));
        return json(res, entries);
      }

      if (path.startsWith('/api/kvs/') && method === 'GET') {
        const key = decodeURIComponent(path.slice('/api/kvs/'.length));
        const value = await sim.kvs.get(key);
        if (value === undefined) return json(res, { error: 'Key not found' }, 404);
        return json(res, { key, value });
      }

      if (path.startsWith('/api/kvs/') && method === 'PUT') {
        const key = decodeURIComponent(path.slice('/api/kvs/'.length));
        const body = await readBody(req);
        // The stored value rides in a `value` wrapper (same as the MCP
        // forge_kvs_set tool) — a raw body is NOT stored as-is. Adversarial
        // 1019 F8: a plain JSON body used to fall through as `undefined` and
        // die in the store as a 500 INVALID_VALUE with no hint.
        if (!body || typeof body !== 'object' || !('value' in body)) {
          return json(res, {
            error: `Missing "value". Send {"value": <data to store>} — the raw body is not stored as-is.`,
          }, 400);
        }
        try {
          await sim.kvs.set(key, body.value);
        } catch (err: any) {
          return json(res, { error: err.message }, 400);
        }
        return json(res, { success: true, key });
      }

      if (path.startsWith('/api/kvs/') && method === 'DELETE') {
        const key = decodeURIComponent(path.slice('/api/kvs/'.length));
        await sim.kvs.delete(key);
        return json(res, { success: true, key });
      }

      // ── SQL ────────────────────────────────────────────────────────
      if (path === '/api/sql/tables' && method === 'GET') {
        try {
          const rows = await sim.sql.query<{ [k: string]: string }>('SHOW TABLES');
          const tables = rows.map(r => Object.values(r)[0]);
          return json(res, { tables });
        } catch (err: any) {
          return json(res, { error: 'SQL not available: ' + err.message });
        }
      }

      if (path === '/api/sql/query' && method === 'POST') {
        const body = await readBody(req);
        const query = body.query?.trim();
        if (!query) return json(res, { error: 'No query provided' }, 400);
        try {
          const rows = await sim.sql.query(query);
          return json(res, { rows, rowCount: rows.length });
        } catch (err: any) {
          return json(res, { error: err.message }, 400);
        }
      }

      if (path === '/api/sql/schema' && method === 'GET') {
        try {
          const tables = await sim.sql.query<{ [k: string]: string }>('SHOW TABLES');
          const schema: Record<string, any[]> = {};
          for (const row of tables) {
            const tableName = Object.values(row)[0];
            const columns = await sim.sql.query(`DESCRIBE ${tableName}`);
            schema[tableName] = columns;
          }
          return json(res, schema);
        } catch (err: any) {
          return json(res, { error: err.message });
        }
      }

      // ── Queues ─────────────────────────────────────────────────────
      if (path === '/api/queues' && method === 'GET') {
        const stats = sim.queue.getStats();
        return json(res, stats);
      }

      // Canonical shape: { queueKey, events } — the same names as the MCP
      // forge_queue_push tool, and `events` mirrors the real @forge/events
      // push(event | event[]). The pre-unification HTTP names ({ queue,
      // body } — single event) stay accepted as legacy aliases so older
      // scripts and version-skewed daemon/CLI pairs keep working
      // (adversarial 1019 F8).
      if (path === '/api/queue/push' && method === 'POST') {
        const body = await readBody(req);
        const queueKey = body.queueKey ?? body.queue;
        if (!queueKey) {
          return json(res, {
            error: 'Missing queueKey. Send {"queueKey": "<key>", "events": [{"body": {...}, "delayInSeconds"?: n}]} (legacy {"queue": ..., "body": ...} also accepted).',
          }, 400);
        }
        const events = Array.isArray(body.events)
          ? body.events
          : { body: body.body ?? {} };
        const result = await sim.queue.push(queueKey, events);
        return json(res, result);
      }

      // ── Logs ───────────────────────────────────────────────────────
      if (path === '/api/logs' && method === 'GET') {
        const logs = sim.getLogs();
        return json(res, logs);
      }

      if (path === '/api/logs/console' && method === 'GET') {
        const logs = sim.getConsoleLogs();
        return json(res, logs);
      }

      // ── Invoke ─────────────────────────────────────────────────────
      if (path === '/api/invoke' && method === 'POST') {
        const body = await readBody(req);
        const { functionKey, payload, actionKey, moduleKey, context } = body;
        if (!functionKey) return json(res, { error: 'Missing functionKey' }, 400);

        // Validate action inputs if this is a Rovo action invocation
        if (actionKey) {
          const validationErrors = sim.validateActionInputs(actionKey, payload ?? {});
          if (validationErrors.length > 0) {
            return json(res, { error: 'Input validation failed', validationErrors }, 400);
          }
        }

        try {
          const result = await sim.invoke(functionKey, payload ?? {}, { moduleKey, context });
          return json(res, { success: true, result });
        } catch (err: any) {
          return json(res, { error: err.message }, 500);
        }
      }

      // ── Triggers ───────────────────────────────────────────────────
      if (path === '/api/trigger' && method === 'POST') {
        const body = await readBody(req);
        const { event, data } = body;
        if (!event) return json(res, { error: 'Missing event' }, 400);
        const results = await sim.fireTrigger(event, data ?? {});
        return json(res, { event, triggersMatched: results.length, results });
      }

      if (path === '/api/scheduled-trigger' && method === 'POST') {
        const body = await readBody(req);
        // Canonical name: triggerKey (same as the MCP tool; bare `key` is
        // overloaded across KVS/entity/module keys). Legacy `key` stays
        // accepted (adversarial 1019 F8 unification).
        const key = body.triggerKey ?? body.key;
        if (!key) return json(res, { error: 'Missing triggerKey. Send {"triggerKey": "<scheduled trigger key>"} (legacy "key" also accepted).' }, 400);
        try {
          const result = await sim.fireScheduledTrigger(key);
          return json(res, result);
        } catch (err: any) {
          return json(res, { error: err.message }, 500);
        }
      }

      // Fire a web trigger — simulates an HTTP request hitting its URL.
      // CLI-only users previously had no way to exercise a webhook: the
      // daemon 404'd on everything but /api/* while /__trigger/<key> only
      // exists on the dev Vite server (eval-6 F6). Setup problems (unknown
      // key, no manifest) are 404s; handler errors surface inside the
      // returned WebTriggerResponse as 5xx statusCodes — exactly what a
      // real webhook caller would see.
      if (path === '/api/webtrigger' && method === 'POST') {
        const body = await readBody(req);
        const { method: reqMethod, userPath, headers, queryParameters, body: reqBody } = body;
        // Canonical name: triggerKey (same as the MCP tool; bare `key` is
        // overloaded across KVS/entity/module keys). Legacy `key` stays
        // accepted (adversarial 1019 F8 unification).
        const key = body.triggerKey ?? body.key;
        if (!key) return json(res, { error: 'Missing triggerKey. Send {"triggerKey": "<webtrigger key>", "method"?, "userPath"?, "headers"?, "queryParameters"?, "body"?} (legacy "key" also accepted).' }, 400);
        try {
          const result = await sim.fireWebTrigger(key, {
            method: reqMethod,
            userPath,
            headers,
            queryParameters,
            body: reqBody,
          });
          return json(res, result);
        } catch (err: any) {
          const msg = err.message ?? String(err);
          const isSetupError = msg.includes('No web trigger') || msg.includes('No manifest');
          return json(res, { error: msg }, isSetupError ? 404 : 500);
        }
      }

      // ── UI State ──────────────────────────────────────────────────
      // These three endpoints track HEADLESS renders (sim.ui.*), which run
      // in this process. A module rendered in a browser tab lives in the
      // browser's own React tree and never reaches them — so say that,
      // rather than "no UI rendered yet" to someone looking at their
      // rendered page (adversarial 1019 F9).
      const HEADLESS_ONLY_HINT =
        'These endpoints track headless renders (POST /api/ui/render) run in the simulator process. ' +
        'A module open in a browser tab renders in the browser and does not populate them.';

      if (path === '/api/ui/state' && method === 'GET') {
        const doc = sim.ui.getForgeDoc();
        if (!doc) return json(res, { rendered: false, message: `No headless render yet. ${HEADLESS_ONLY_HINT}` });
        return json(res, { rendered: true, tree: sim.ui.prettyPrint(doc) });
      }

      if (path === '/api/ui/render' && method === 'POST') {
        const body = await readBody(req);
        const { moduleKey, context, issueKey, contentId, spaceKey, extension } = body;
        try {
          const doc = await sim.ui.render(moduleKey, { context, issueKey, contentId, spaceKey, extension });
          if (!doc) return json(res, { rendered: false, message: 'Render returned no UI.' });
          const forgeContext = sim.ui.getContext(moduleKey);
          return json(res, { rendered: true, tree: sim.ui.prettyPrint(doc), context: forgeContext });
        } catch (err: any) {
          return json(res, { error: err.message }, 500);
        }
      }

      // ── Context ────────────────────────────────────────────────────────
      if (path === '/api/ui/context' && method === 'GET') {
        const moduleKey = url.searchParams.get('module') ?? undefined;
        const ctx = sim.ui.getContext(moduleKey);
        if (!ctx) {
          return json(res, {
            error: `No context available${moduleKey ? ` for module "${moduleKey}"` : ''}. ${HEADLESS_ONLY_HINT}`,
          }, 404);
        }
        return json(res, ctx);
      }

      // ── Entities ───────────────────────────────────────────────────
      // Custom Entities live in their own store (not plain KVS keys), so
      // the tools UI needs a dedicated endpoint. Used to be a stub that
      // pointed at the KVS panel — which never showed entities (eval-4 F7).
      if (path === '/api/entities' && method === 'GET') {
        const schemas: Record<string, unknown> = {};
        for (const [name, schema] of sim.kvs.getEntitySchemas()) {
          schemas[name] = schema;
        }
        const grouped = sim.kvs.dumpEntities();
        const entities: Record<string, Array<{ key: string; value: any }>> = {};
        for (const [name, rows] of Object.entries(grouped)) {
          entities[name] = rows.map(({ key, value }) => ({ key, value }));
        }
        return json(res, { schemas, entities });
      }

      // Per-row entity operations (eval-9 E9-6: `forge-sim entity` CLI).
      // Path shape: /api/entities/<entityName>/<key>. Goes through the
      // public sim.kvs.entity() surface, so schema enforcement applies —
      // ENTITY_NOT_FOUND / VALIDATION_ERROR surface as error responses,
      // never silent writes.
      if (path.startsWith('/api/entities/')) {
        const parts = path.slice('/api/entities/'.length).split('/').map(decodeURIComponent);
        const [entityName, key] = parts;
        if (!entityName || !key || parts.length !== 2) {
          return json(res, { error: 'Expected /api/entities/<entityName>/<key>' }, 400);
        }
        if (method === 'GET') {
          const value = await sim.kvs.entity(entityName).get(key);
          if (value === undefined) return json(res, { error: 'Key not found' }, 404);
          return json(res, { entityName, key, value });
        }
        if (method === 'PUT') {
          const body = await readBody(req);
          if (!body || typeof body !== 'object' || !('value' in body)) {
            return json(res, {
              error: `Missing "value". Send {"value": <entity data>} — the raw body is not stored as-is.`,
            }, 400);
          }
          try {
            await sim.kvs.entity(entityName).set(key, body.value);
          } catch (err: any) {
            // Client errors get client statuses: unknown entity → 404,
            // schema violation (VALIDATION_ERROR etc.) → 400.
            const status = String(err.message).includes('ENTITY_NOT_FOUND') ? 404 : 400;
            return json(res, { error: err.message }, status);
          }
          return json(res, { success: true, entityName, key });
        }
        if (method === 'DELETE') {
          await sim.kvs.entity(entityName).delete(key);
          return json(res, { success: true, entityName, key });
        }
      }

      // ── Mocks ────────────────────────────────────────────────────

      if (path === '/api/mock/routes' && method === 'POST') {
        const body = await readBody(req);
        const { product, routes } = body;
        if (!product || !routes) return json(res, { error: 'product and routes are required' }, 400);
        sim.mockProductRoutes(product, routes);
        return json(res, { success: true, product, routeCount: Object.keys(routes).length });
      }

      if (path === '/api/mock/graphql' && method === 'POST') {
        const body = await readBody(req);
        const { operations } = body;
        if (!operations) return json(res, { error: 'operations is required' }, 400);
        sim.mockGraphQL(operations);
        return json(res, { success: true, operationCount: Object.keys(operations).length });
      }

      // ── External Auth Providers ────────────────────────────────────
      // List configured external auth providers + connection status.
      if (path === '/api/providers' && method === 'GET') {
        const providers = sim.externalAuth.listProviders().map((p) => {
          const hasSecret = sim.externalAuth.hasSecret(p.key);
          const connected = sim.externalAuth.hasCredentials(p.key);
          const account = sim.externalAuth.getAccount(p.key);
          return {
            key: p.key,
            name: p.name,
            scopes: p.scopes ?? [],
            hasSecret,
            connected,
            account: account ? { id: account.id, displayName: account.displayName } : undefined,
          };
        });
        return json(res, providers);
      }

      // Start OAuth flow for a provider — registers a pending flow and
      // returns { authUrl, state }. The browser popup opens authUrl,
      // bounces through /__tools/oauth/callback, and the registry runs
      // our onCode closure (exchange + persist + broadcast).
      const startMatch = path.match(/^\/api\/providers\/([^/]+)\/start$/);
      if (startMatch && method === 'POST') {
        const providerKey = decodeURIComponent(startMatch[1]);
        const provider = sim.externalAuth.getProvider(providerKey);
        if (!provider) return json(res, { error: `Unknown provider "${providerKey}"` }, 404);
        if (!sim.externalAuth.hasSecret(providerKey)) {
          // Client secrets load with the rest of the stored credentials
          // (loadAuthFromEnv), so on a channel that is not connecting,
          // "restart dev" alone does not help: say what does. Connected dev
          // reloads them on a Tools-UI reset.
          const how = options.connectByDefault === true
            ? 'then reset from the Tools UI (or restart dev).'
            : '— client secrets load only when the server connects: `forge-sim deploy --connect` on the daemon, ' +
              'or `forge-sim dev` without --offline (and without FORGE_SIM_CONNECT=0).';
          return json(res, {
            error: `No client secret for "${providerKey}". Set it via \`forge-sim auth --provider ${providerKey} --secret\` ${how}`,
          }, 400);
        }

        const { state, redirectUri, promise } = getOAuthCallbackRegistry().register({
          providerKey,
          onCode: async (code) => {
            const token = await sim.externalAuth.exchangeCode(providerKey, code, redirectUri);
            if (!token) {
              throw new Error('Token exchange returned no token.');
            }
            // Persist to disk under the default account, if appDir is wired.
            if (options.appDir) {
              try {
                const creds = await loadCredentials(options.appDir);
                const account = getDefaultAccount(creds);
                if (account) {
                  setThirdPartyToken(creds, account.id, providerKey, token);
                  await saveCredentials(creds, { local: options.appDir });
                }
              } catch (err: any) {
                console.warn(`[forge-sim] Token persisted in memory but failed to save to disk: ${err.message}`);
              }
            }
            // Push to connected Tools UI tabs so they re-render the panel.
            options.broadcastStateChange?.('providerConnected', { providerKey });
          },
        });

        // Don't await the promise here — the callback fires later. But we
        // do want to surface unhandled rejections so they don't crash the
        // process when the flow times out or the user aborts.
        promise.catch(() => { /* logged in the registry's onCode */ });

        const authUrl = sim.externalAuth.buildAuthorizationUrl(providerKey, redirectUri, state);
        if (!authUrl) {
          getOAuthCallbackRegistry().cancelAll('Auth URL build failed');
          return json(res, { error: 'Could not build authorization URL. Check manifest remotes.' }, 500);
        }
        return json(res, { authUrl, state, redirectUri });
      }

      // Disconnect — clear the stored token (in-memory + on-disk).
      const deleteMatch = path.match(/^\/api\/providers\/([^/]+)$/);
      if (deleteMatch && method === 'DELETE') {
        const providerKey = decodeURIComponent(deleteMatch[1]);
        if (!sim.externalAuth.getProvider(providerKey)) {
          return json(res, { error: `Unknown provider "${providerKey}"` }, 404);
        }
        sim.externalAuth.revokeToken(providerKey);
        if (options.appDir) {
          try {
            const creds = await loadCredentials(options.appDir);
            const account = getDefaultAccount(creds);
            if (account && creds.thirdParty[account.id]) {
              delete creds.thirdParty[account.id][providerKey];
              await saveCredentials(creds, { local: options.appDir });
            }
          } catch (err: any) {
            console.warn(`[forge-sim] Token cleared in memory but failed to update disk: ${err.message}`);
          }
        }
        options.broadcastStateChange?.('providerDisconnected', { providerKey });
        return json(res, { success: true });
      }

      // ── 404 ────────────────────────────────────────────────────────
      return json(res, { error: 'Not found', path }, 404);

    } catch (err: any) {
      return json(res, { error: err.message }, 500);
    }
  };
}
