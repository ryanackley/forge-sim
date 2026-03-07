/**
 * Forge Sim Tools — REST API handler.
 *
 * Wraps the ForgeSimulator in HTTP endpoints for the tools UI.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ForgeSimulator } from '../simulator.js';
import type { ParsedManifest } from '../manifest.js';

type ApiHandler = (req: IncomingMessage, res: ServerResponse, url: URL) => Promise<void>;

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

export function createApiHandler(sim: ForgeSimulator, manifest: ParsedManifest): ApiHandler {
  return async (req, res, url) => {
    const path = url.pathname;
    const method = req.method ?? 'GET';

    try {
      // ── Manifest ───────────────────────────────────────────────────
      if (path === '/api/manifest' && method === 'GET') {
        return json(res, {
          appName: manifest.raw.app?.name,
          appId: manifest.raw.app?.id,
          functions: [...manifest.functions.entries()].map(([key, fn]) => ({ key, handler: fn.handler })),
          uiModules: manifest.uiModules.map(m => ({ key: m.key, type: m.type, title: m.title, resolverFunctionKey: m.resolverFunctionKey, resourceKey: m.resourceKey })),
          consumers: manifest.consumers.map(c => ({ key: c.key, queue: c.queue, functionKey: c.functionKey })),
          triggers: manifest.triggers.map(t => ({ key: t.key, functionKey: t.functionKey, events: t.events })),
          scheduledTriggers: manifest.scheduledTriggers.map(s => ({ key: s.key, functionKey: s.functionKey, interval: s.interval })),
          resources: [...manifest.resources.entries()].map(([key, r]) => ({ key, path: r.path })),
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
        const entries = Object.entries(dump).map(([key, value]) => ({ key, value }));
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
        await sim.kvs.set(key, body.value);
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

      if (path === '/api/queue/push' && method === 'POST') {
        const body = await readBody(req);
        const { queue: queueKey, body: eventBody } = body;
        if (!queueKey) return json(res, { error: 'Missing queue key' }, 400);
        const q = sim.createQueue({ key: queueKey });
        const result = await q.push({ body: eventBody ?? {} });
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
        const { functionKey, payload } = body;
        if (!functionKey) return json(res, { error: 'Missing functionKey' }, 400);
        try {
          const result = await sim.invoke(functionKey, payload ?? {});
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
        const { key } = body;
        if (!key) return json(res, { error: 'Missing key' }, 400);
        try {
          const result = await sim.fireScheduledTrigger(key);
          return json(res, result);
        } catch (err: any) {
          return json(res, { error: err.message }, 500);
        }
      }

      // ── Entities ───────────────────────────────────────────────────
      // Entity store is accessed via the product API (storage:entities routes).
      // For the tools UI, we expose a simple list endpoint.
      if (path === '/api/entities' && method === 'GET') {
        return json(res, { message: 'Use KVS panel — entity store shares the same backing storage' });
      }

      // ── 404 ────────────────────────────────────────────────────────
      return json(res, { error: 'Not found', path }, 404);

    } catch (err: any) {
      return json(res, { error: err.message }, 500);
    }
  };
}
