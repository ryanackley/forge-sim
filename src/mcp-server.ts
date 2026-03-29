#!/usr/bin/env node
/**
 * forge-sim MCP Server
 *
 * Exposes the Forge simulator to AI agents via Model Context Protocol.
 * Runs over stdio transport.
 *
 * Tools:
 *   forge:deploy        — Deploy a Forge app from a directory
 *   forge:invoke        — Call a resolver function
 *   forge:fire_trigger  — Simulate a product event trigger
 *   forge:ui_state      — Get the current ForgeDoc UI tree
 *   forge:ui_interact   — Interact with UI components (click, submit, etc.)
 *   forge:kvs_get       — Get a value from KVS
 *   forge:kvs_list      — List/dump KVS contents
 *   forge:kvs_set       — Set a value in KVS (for test setup)
 *   forge:queue_push    — Push events to a queue
 *   forge:queue_state   — Inspect queue job state and event log
 *   forge:logs          — Get simulator + console logs
 *   forge:sql_execute   — Execute SQL queries (real MySQL)
 *   forge:sql_migrate   — Run idempotent database migrations
 *   forge:sql_schema    — Inspect database schema (tables, columns, indexes)
 *   forge:entity_get    — Get a Custom Entity by name + key
 *   forge:entity_set    — Create/update a Custom Entity
 *   forge:entity_delete — Delete a Custom Entity
 *   forge:entity_query  — Query entities with indexes, filters, sort, pagination
 *   forge:entity_list   — List all entities and schemas
 *   forge:reset         — Reset all simulator state
 *
 * Resources:
 *   forge://manifest    — Current deployed manifest
 *   forge://functions   — Registered functions/resolvers
 *   forge://triggers    — Registered triggers and events
 *   forge://state       — Full state snapshot (KVS + queue + UI)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { createServer } from 'node:http';
import { createSimulator } from './simulator.js';
import { typeCheck } from './type-checker.js';
// UI access is now through sim.ui.* — no direct bridge/doc-utils imports

// ── Simulator Instance ──────────────────────────────────────────────────

const sim = createSimulator();

// Pre-load any available credentials from env vars / .forge-sim at startup
sim.connectFromEnv().catch(() => {});

// ── MCP Server Setup ────────────────────────────────────────────────────

const server = new McpServer({
  name: 'forge-sim',
  version: '0.1.0',
});

// ── Tools ───────────────────────────────────────────────────────────────

server.tool(
  'forge.deploy',
  'Deploy a Forge app directory into the simulator. Reads manifest.yml, loads handlers, wires resolvers/consumers/triggers. The app code runs unmodified.',
  {
    appDir: z.string().describe('Path to the Forge app directory (must contain manifest.yml)'),
    reset: z.boolean().optional().describe('Reset simulator state before deploying (default: true)'),
  },
  async ({ appDir, reset }) => {
    if (reset !== false) {
      sim.reset();
      sim.ui.reset();
    }

    try {
      // Run type checking before deploy (non-blocking — errors reported alongside results)
      const typeErrors = typeCheck(appDir);

      const result = await sim.deploy(appDir);
      const summary: Record<string, any> = {
        app: result.manifest.raw.app,
        loadedFunctions: result.loadedFunctions,
        loadedResources: result.loadedResources,
        resolvers: sim.resolver.getDefinitions(),
        triggers: result.manifest.triggers.map((t) => ({
          key: t.key,
          events: t.events,
          function: t.functionKey,
        })),
        consumers: result.manifest.consumers.map((c) => ({
          key: c.key,
          queue: c.queue,
          function: c.functionKey,
        })),
        uiModules: result.manifest.uiModules.map((u) => ({
          key: u.key,
          type: u.type,
          resource: u.resourceKey,
          resolver: u.resolverFunctionKey,
        })),
        errors: result.errors,
      };

      // Include type errors if any were found
      if (typeErrors.length > 0) {
        summary.typeErrors = typeErrors;
      }

      // Connect auth credentials (env vars + .forge-sim) now that manifest providers are loaded
      const authResult = await sim.connectFromEnv(appDir).catch(() => ({ atlassian: { connected: false }, providers: [] }));
      if (authResult.atlassian.connected || authResult.providers.length > 0) {
        summary.auth = authResult;
      }

      const hasDeployErrors = result.errors.length > 0;
      const hasTypeErrors = typeErrors.length > 0;
      let statusLine: string;
      if (hasDeployErrors && hasTypeErrors) {
        statusLine = `⚠️ Deployed with ${result.errors.length} deploy error(s) and ${typeErrors.length} type error(s):`;
      } else if (hasDeployErrors) {
        statusLine = `⚠️ Deployed with ${result.errors.length} error(s):`;
      } else if (hasTypeErrors) {
        statusLine = `⚠️ Deployed successfully but found ${typeErrors.length} type error(s):`;
      } else {
        statusLine = `✅ Deployed successfully:`;
      }

      return {
        content: [{
          type: 'text' as const,
          text: `${statusLine}\n${JSON.stringify(summary, null, 2)}`,
        }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `❌ Deploy failed: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  'forge.invoke',
  'Invoke a resolver function by key with an optional payload. Returns the resolver result and any console output captured during execution.',
  {
    functionKey: z.string().describe('The resolver function key to invoke'),
    payload: z.record(z.string(), z.any()).optional().describe('Payload to pass to the resolver'),
    actionKey: z.string().optional().describe('If invoking a Rovo action, the action key — enables input validation against the action schema'),
  },
  async ({ functionKey, payload, actionKey }) => {
    try {
      // Validate action inputs if specified
      if (actionKey) {
        const validationErrors = sim.validateActionInputs(actionKey, payload ?? {});
        if (validationErrors.length > 0) {
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Input validation failed', validationErrors }, null, 2) }],
            isError: true,
          };
        }
      }

      const logsBefore = sim.getLogs().length;
      const consoleBefore = sim.getConsoleLogs().length;

      const result = await sim.invoke(functionKey, payload ?? {});

      const newLogs = sim.getLogs().slice(logsBefore);
      const newConsole = sim.getConsoleLogs().slice(consoleBefore);

      const output: any = { result };
      if (newConsole.length > 0) {
        output.console = newConsole.map((l) => `[${l.level}] ${l.message}`);
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
      };
    } catch (err) {
      const errOutput: any = { error: err instanceof Error ? err.message : String(err) };
      if ((err as any).capturedConsole?.length > 0) {
        errOutput.console = (err as any).capturedConsole.map((l: any) => `[${l.level}] ${l.message}`);
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(errOutput, null, 2) }],
        isError: true,
      };
    }
  }
);

server.tool(
  'forge.fire_trigger',
  'Simulate a product event trigger (e.g. "avi:jira:created:issue"). Fires all registered trigger handlers for the event and returns their results.',
  {
    event: z.string().describe('The event name (e.g. "avi:jira:created:issue")'),
    data: z.record(z.string(), z.any()).optional().describe('Event payload data'),
  },
  async ({ event, data }) => {
    try {
      const results = await sim.fireTrigger(event, data ?? {});
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ event, triggersMatched: results.length, results }, null, 2),
        }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `❌ Trigger failed: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  'forge.fire_scheduled_trigger',
  'Fire a scheduled trigger by key. Validates the response format per Forge docs: handler must return { statusCode, body?, headers?, statusText? }. Returns 424 if response format is invalid.',
  {
    triggerKey: z.string().describe('The scheduled trigger key from the manifest'),
  },
  async ({ triggerKey }) => {
    try {
      const result = await sim.fireScheduledTrigger(triggerKey);
      const emoji = result.statusCode === 204 ? '✅' : result.statusCode >= 400 ? '❌' : '⚠️';
      return {
        content: [{
          type: 'text' as const,
          text: `${emoji} Scheduled trigger "${triggerKey}" → ${result.statusCode}\n${JSON.stringify(result, null, 2)}`,
        }],
        isError: result.statusCode >= 400,
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `❌ Scheduled trigger failed: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  'forge.ui_state',
  'Get the current ForgeDoc UI tree. Shows what the Forge app UI looks like right now. Returns a pretty-printed component tree.',
  async () => {
    const doc = sim.ui.getForgeDoc();
    if (!doc) {
      return {
        content: [{ type: 'text' as const, text: 'No UI rendered yet. Deploy an app with UI resources first, or invoke a resolver that triggers a render.' }],
      };
    }

    return {
      content: [{ type: 'text' as const, text: sim.ui.prettyPrint(doc) }],
    };
  }
);

server.tool(
  'forge.ui_interact',
  'Interact with a UI component — simulate clicks, form submissions, etc. Find a component by type and optional text content, then fire an event on it.',
  {
    componentType: z.string().describe('Component type to find (e.g. "Button", "TextField", "Select")'),
    matchText: z.string().optional().describe('Text content to match within the component'),
    nthMatch: z.number().optional().describe('Which match to use if multiple (1-indexed, default: 1)'),
    event: z.string().optional().describe('Event to fire (default: "onClick")'),
    eventArgs: z.array(z.any()).optional().describe('Arguments to pass to the event handler'),
  },
  async ({ componentType, matchText, nthMatch, event, eventArgs }) => {
    const doc = sim.ui.getForgeDoc();
    if (!doc) {
      return {
        content: [{ type: 'text' as const, text: 'No UI rendered. Deploy an app with UI first.' }],
        isError: true,
      };
    }

    try {
      const node = sim.ui.findByTypeAndText(doc, componentType, matchText, nthMatch);
      const eventName = event ?? 'onClick';

      const consoleBefore = sim.getConsoleLogs().length;
      const result = sim.ui.interact(node, eventName, ...(eventArgs ?? []));

      // If the handler is async, await it
      const finalResult = result instanceof Promise ? await result : result;

      const newConsole = sim.getConsoleLogs().slice(consoleBefore);

      const output: any = {
        component: componentType,
        event: eventName,
        result: finalResult,
      };
      if (newConsole.length > 0) {
        output.console = newConsole.map((l) => `[${l.level}] ${l.message}`);
      }

      // Show updated UI if it changed
      const updatedDoc = sim.ui.getForgeDoc();
      if (updatedDoc) {
        output.updatedUI = sim.ui.prettyPrint(updatedDoc);
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `❌ ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  'forge.kvs_get',
  'Get a value from the simulated Key-Value Store by key.',
  {
    key: z.string().describe('The storage key to retrieve'),
  },
  async ({ key }) => {
    const value = await sim.kvs.get(key);
    return {
      content: [{
        type: 'text' as const,
        text: value === undefined
          ? `Key "${key}" not found`
          : JSON.stringify({ key, value }, null, 2),
      }],
    };
  }
);

server.tool(
  'forge.kvs_list',
  'List KVS contents. Optionally filter by key prefix. Shows all stored key-value pairs.',
  {
    prefix: z.string().optional().describe('Only show keys starting with this prefix'),
    limit: z.number().optional().describe('Max number of entries to return (default: 50)'),
  },
  async ({ prefix, limit }) => {
    if (prefix) {
      const result = await sim.kvs.query()
        .where('key', { beginsWith: prefix })
        .limit(limit ?? 50)
        .getMany();
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ count: result.results.length, entries: result.results, hasMore: !!result.nextCursor }, null, 2),
        }],
      };
    }

    const dump = sim.kvs.dump();
    const keys = Object.keys(dump);
    const limited = limit ? keys.slice(0, limit) : keys;
    const entries = limited.map((k) => ({ key: k, value: dump[k] }));

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ count: keys.length, showing: entries.length, entries }, null, 2),
      }],
    };
  }
);

server.tool(
  'forge.kvs_set',
  'Set a value in KVS. Useful for test setup or manually seeding data.',
  {
    key: z.string().describe('Storage key'),
    value: z.any().describe('Value to store (will be JSON-serialized)'),
  },
  async ({ key, value }) => {
    await sim.kvs.set(key, value);
    return {
      content: [{ type: 'text' as const, text: `✅ Set "${key}"` }],
    };
  }
);

server.tool(
  'forge.queue_push',
  'Push events to a queue for consumer processing.',
  {
    queueKey: z.string().describe('The queue key to push to'),
    events: z.array(z.object({
      body: z.record(z.string(), z.any()).describe('Event body'),
      delayInSeconds: z.number().optional(),
    })).describe('Events to push'),
  },
  async ({ queueKey, events }) => {
    try {
      const result = await sim.queue.push(queueKey, events);
      const job = sim.queue.getJob(result.jobId);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ jobId: result.jobId, stats: job?.stats }, null, 2),
        }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `❌ Queue push failed: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  'forge.queue_state',
  'Inspect queue state — processed events, job stats, event log.',
  {
    jobId: z.string().optional().describe('Get stats for a specific job'),
  },
  async ({ jobId }) => {
    if (jobId) {
      const job = sim.queue.getJob(jobId);
      if (!job) {
        return {
          content: [{ type: 'text' as const, text: `Job "${jobId}" not found` }],
          isError: true,
        };
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(job, null, 2) }],
      };
    }

    const eventLog = sim.queue.getEventLog();
    const summary = {
      totalEvents: eventLog.length,
      byQueue: {} as Record<string, { total: number; success: number; failed: number }>,
      recentEvents: eventLog.slice(-20).map((e) => ({
        queue: e.queueKey,
        jobId: e.jobId,
        status: e.event.status,
        body: e.event.body,
        error: e.event.error,
      })),
    };

    for (const e of eventLog) {
      const q = summary.byQueue[e.queueKey] ?? { total: 0, success: 0, failed: 0 };
      q.total++;
      if (e.event.status === 'success') q.success++;
      if (e.event.status === 'failed') q.failed++;
      summary.byQueue[e.queueKey] = q;
    }

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }],
    };
  }
);

server.tool(
  'forge.logs',
  'Get simulator logs including captured console.* output from Forge app code. Optionally filter by level.',
  {
    level: z.string().optional().describe('Filter by log level (e.g. "error", "console.log", "invoke", "trigger")'),
    limit: z.number().optional().describe('Max number of log entries (default: 100, from most recent)'),
    clear: z.boolean().optional().describe('Clear logs after reading'),
  },
  async ({ level, limit, clear }) => {
    let logs = sim.getLogs();
    const consoleLogs = sim.getConsoleLogs();

    if (level) {
      logs = logs.filter((l) => l.level === level || l.level.startsWith(level));
    }

    const maxEntries = limit ?? 100;
    const recentLogs = logs.slice(-maxEntries);

    const output = {
      totalEntries: logs.length,
      showing: recentLogs.length,
      consoleLinesTotal: consoleLogs.length,
      logs: recentLogs.map((l) => ({
        time: new Date(l.timestamp).toISOString(),
        level: l.level,
        message: l.message,
        ...(l.data !== undefined ? { data: l.data } : {}),
      })),
    };

    if (clear) {
      sim.clearLogs();
    }

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
    };
  }
);

// ── SQL Tools ───────────────────────────────────────────────────────────

server.tool(
  'forge.sql_execute',
  'Execute a SQL query against the simulated Forge SQL database (real MySQL). Supports SELECT, INSERT, UPDATE, DELETE, CREATE TABLE, ALTER TABLE, etc. Uses parameterized queries when params are provided.',
  {
    query: z.string().describe('SQL query to execute'),
    params: z.array(z.any()).optional().describe('Bind parameters for the query (use ? placeholders)'),
  },
  async ({ query, params }) => {
    try {
      // Ensure MySQL is running (lazy start on first use)
      await sim.sql.start();

      const fetchFn = sim.sql.createFetchFunction();
      const res = await fetchFn('/api/v1/execute', {
        method: 'POST',
        body: JSON.stringify({ query, params: params ?? [], method: 'all' }),
      });

      const data = await res.json();

      if (!res.ok) {
        return {
          content: [{ type: 'text' as const, text: `❌ SQL error: ${data.message ?? data.sqlMessage ?? JSON.stringify(data)}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `❌ SQL execution failed: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  'forge.sql_migrate',
  'Run database migrations (idempotent). Migrations that have already been applied are skipped. Uses the same __migrations table as @forge/sql migrationRunner.',
  {
    migrations: z.array(z.object({
      name: z.string().describe('Unique migration name (e.g. "001_create_users")'),
      statement: z.string().describe('DDL statement to execute (CREATE TABLE, ALTER TABLE, etc.)'),
    })).describe('Ordered list of migrations to apply'),
  },
  async ({ migrations }) => {
    try {
      await sim.sql.start();

      const fetchFn = sim.sql.createFetchFunction();

      // Create migrations table if it doesn't exist
      await fetchFn('/api/v1/execute/ddl', {
        method: 'POST',
        body: JSON.stringify({
          query: 'CREATE TABLE IF NOT EXISTS __migrations (id BIGINT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255) NOT NULL, migratedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)',
          params: [],
        }),
      });

      // Get already-applied migrations
      const listRes = await fetchFn('/api/v1/execute', {
        method: 'POST',
        body: JSON.stringify({ query: 'SELECT name FROM __migrations', params: [] }),
      });
      const listData = await listRes.json();
      const applied = new Set((listData.rows as any[]).map((r: any) => r.name));

      const results: { name: string; status: 'applied' | 'skipped' | 'error'; error?: string }[] = [];

      for (const migration of migrations) {
        if (applied.has(migration.name)) {
          results.push({ name: migration.name, status: 'skipped' });
          continue;
        }

        // Run the DDL
        const ddlRes = await fetchFn('/api/v1/execute/ddl', {
          method: 'POST',
          body: JSON.stringify({ query: migration.statement, params: [] }),
        });

        if (!ddlRes.ok) {
          const errData = await ddlRes.json();
          results.push({ name: migration.name, status: 'error', error: errData.message ?? errData.sqlMessage });
          break; // Stop on first error
        }

        // Record it
        await fetchFn('/api/v1/execute', {
          method: 'POST',
          body: JSON.stringify({
            query: 'INSERT INTO __migrations (name) VALUES (?)',
            params: [migration.name],
          }),
        });

        results.push({ name: migration.name, status: 'applied' });
      }

      const appliedCount = results.filter((r) => r.status === 'applied').length;
      const skippedCount = results.filter((r) => r.status === 'skipped').length;
      const errorCount = results.filter((r) => r.status === 'error').length;

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            summary: `${appliedCount} applied, ${skippedCount} skipped${errorCount ? `, ${errorCount} error` : ''}`,
            migrations: results,
          }, null, 2),
        }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `❌ Migration failed: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  'forge.sql_schema',
  'Inspect the database schema — list tables and their column definitions. Useful for understanding what data structures exist.',
  {
    table: z.string().optional().describe('Get detailed schema for a specific table. If omitted, lists all tables.'),
  },
  async ({ table }) => {
    try {
      await sim.sql.start();

      if (table) {
        const cols = await sim.sql.query<{
          Field: string; Type: string; Null: string; Key: string; Default: any; Extra: string;
        }>(`DESCRIBE \`${table}\``);

        const indexes = await sim.sql.query<{
          Key_name: string; Column_name: string; Non_unique: number; Seq_in_index: number;
        }>(`SHOW INDEX FROM \`${table}\``);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ table, columns: cols, indexes }, null, 2),
          }],
        };
      }

      // List all tables
      const tables = await sim.sql.query<Record<string, string>>('SHOW TABLES');
      const tableNames = tables.map((row) => Object.values(row)[0]);

      // Get column counts for each
      const schema: { name: string; columns: number }[] = [];
      for (const name of tableNames) {
        const cols = await sim.sql.query(`DESCRIBE \`${name}\``);
        schema.push({ name, columns: cols.length });
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ tables: schema, count: schema.length }, null, 2),
        }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `❌ Schema query failed: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  }
);

// ── Entity Store Tools ──────────────────────────────────────────────────

server.tool(
  'forge.entity_get',
  'Get a Custom Entity by entity name and key. Returns the entity value with metadata (createdAt, updatedAt).',
  {
    entityName: z.string().describe('Entity type name (as defined in manifest)'),
    key: z.string().describe('Entity key'),
  },
  async ({ entityName, key }) => {
    try {
      const res = await sim.kvs.handleRequest('/api/v1/entity/get', {
        method: 'POST',
        body: JSON.stringify({ entityName, key }),
      });
      const data = await res.json();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
        ...(res.ok ? {} : { isError: true }),
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `❌ ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  'forge.entity_set',
  'Create or update a Custom Entity. Supports key policies (FAIL_IF_EXISTS, OVERRIDE) and TTL.',
  {
    entityName: z.string().describe('Entity type name (as defined in manifest)'),
    key: z.string().describe('Entity key'),
    value: z.record(z.string(), z.any()).describe('Entity value (object with attributes)'),
    options: z.object({
      ifNotExists: z.boolean().optional().describe('If true, fail if key already exists (FAIL_IF_EXISTS policy)'),
      ttlSeconds: z.number().optional().describe('Time-to-live in seconds'),
    }).optional().describe('Write options'),
  },
  async ({ entityName, key, value, options }) => {
    try {
      const body: any = { entityName, key, value };
      if (options?.ifNotExists) {
        body.options = { keyPolicy: 'FAIL_IF_EXISTS' };
      } else if (options?.ttlSeconds) {
        body.options = { ttlSeconds: options.ttlSeconds };
      }

      const res = await sim.kvs.handleRequest('/api/v1/entity/set', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (res.ok) {
        return { content: [{ type: 'text' as const, text: `✅ Set ${entityName}:${key}` }] };
      }
      const data = await res.json();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
        isError: true,
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `❌ ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  'forge.entity_delete',
  'Delete a Custom Entity by entity name and key.',
  {
    entityName: z.string().describe('Entity type name'),
    key: z.string().describe('Entity key to delete'),
  },
  async ({ entityName, key }) => {
    try {
      const res = await sim.kvs.handleRequest('/api/v1/entity/delete', {
        method: 'POST',
        body: JSON.stringify({ entityName, key }),
      });
      if (res.ok) {
        return { content: [{ type: 'text' as const, text: `✅ Deleted ${entityName}:${key}` }] };
      }
      const data = await res.json();
      return {
        content: [{ type: 'text' as const, text: `❌ ${data.message}` }],
        isError: true,
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `❌ ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  'forge.entity_query',
  'Query Custom Entities using indexes, partition/range keys, filters, and sorting. Mirrors the @forge/kvs entity query builder.',
  {
    entityName: z.string().describe('Entity type name'),
    indexName: z.string().describe('Index to query (as defined in manifest)'),
    partition: z.array(z.any()).describe('Partition key values (must match index partition attributes in order)'),
    range: z.object({
      operator: z.enum(['BETWEEN', 'BEGINS_WITH', 'GREATER_THAN', 'LESS_THAN', 'EQUAL_TO']).describe('Range condition operator'),
      value: z.any().describe('Range value (or [min, max] array for BETWEEN)'),
    }).optional().describe('Range key condition'),
    filters: z.array(z.object({
      field: z.string().describe('Attribute name to filter on'),
      operator: z.enum(['EQUAL_TO', 'GREATER_THAN', 'LESS_THAN', 'BETWEEN', 'BEGINS_WITH', 'EXISTS', 'NOT_EXISTS', 'CONTAINS']).describe('Filter operator'),
      value: z.any().optional().describe('Filter value'),
    })).optional().describe('Post-query filters'),
    filterOperator: z.enum(['AND', 'OR']).optional().describe('How to combine filters (default: AND)'),
    sort: z.enum(['ASC', 'DESC']).optional().describe('Sort direction on range key (default: ASC)'),
    cursor: z.string().optional().describe('Pagination cursor from previous query'),
    limit: z.number().optional().describe('Max results to return (default: 25)'),
  },
  async ({ entityName, indexName, partition, range, filters, filterOperator, sort, cursor, limit }) => {
    try {
      const body: any = { entityName, indexName, partition };
      if (range) body.range = { condition: range.operator, value: range.operator === 'BETWEEN' ? undefined : range.value, values: range.operator === 'BETWEEN' ? range.value : undefined };
      if (filters) body.filters = filters.map(f => ({ field: f.field, condition: f.operator, value: f.value }));
      if (filterOperator) body.filterOperator = filterOperator;
      if (sort) body.sort = sort;
      if (cursor) body.cursor = cursor;
      if (limit) body.limit = limit;

      const res = await sim.kvs.handleRequest('/api/v1/entity/query', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
        ...(res.ok ? {} : { isError: true }),
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `❌ ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  'forge.entity_list',
  'List all Custom Entities, optionally filtered by entity name. Also shows registered entity schemas (from manifest).',
  {
    entityName: z.string().optional().describe('Filter to a specific entity type'),
    showSchemas: z.boolean().optional().describe('Include entity schema definitions (default: true)'),
  },
  async ({ entityName, showSchemas }) => {
    const allEntities = sim.kvs.dumpEntities();
    const schemas = sim.kvs.getEntitySchemas();

    const output: any = {};

    if (showSchemas !== false) {
      const schemaList: Record<string, any> = {};
      for (const [name, schema] of schemas) {
        if (entityName && name !== entityName) continue;
        schemaList[name] = schema;
      }
      output.schemas = schemaList;
    }

    if (entityName) {
      const entries = allEntities[entityName] ?? [];
      output.entities = { [entityName]: entries };
      output.count = entries.length;
    } else {
      output.entities = allEntities;
      output.count = Object.values(allEntities).reduce((sum, arr) => sum + arr.length, 0);
    }

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
    };
  }
);

server.tool(
  'forge.auth_status',
  'Show what authentication is available: Atlassian account info, third-party provider tokens, and external auth providers from the manifest.',
  async () => {
    const output: Record<string, any> = {};

    // Atlassian account
    const account = sim.productApi.connectedAccount;
    if (account) {
      output.atlassian = {
        connected: true,
        site: account.site,
        name: account.name,
        email: account.email,
        authType: account.authType,
        accountId: account.accountId,
      };
    } else {
      output.atlassian = { connected: false };
    }

    // External auth providers from manifest
    const providers = sim.externalAuth.listProviders();
    output.providers = providers.map((p) => {
      const token = sim.externalAuth.getToken(p.key);
      return {
        key: p.key,
        name: p.name,
        type: p.type,
        hasToken: !!token,
        hasSecret: sim.externalAuth.hasSecret(p.key),
      };
    });

    // Provider tokens not in manifest (set via env vars)
    const manifestProviderKeys = new Set(providers.map((p) => p.key));
    const envPrefix = 'FORGE_SIM_PROVIDER_';
    const envSuffix = '_TOKEN';
    for (const envKey of Object.keys(process.env)) {
      if (envKey.startsWith(envPrefix) && envKey.endsWith(envSuffix)) {
        const rawKey = envKey.slice(envPrefix.length, -envSuffix.length);
        const providerKey = rawKey.toLowerCase().replace(/_/g, '-');
        if (!manifestProviderKeys.has(providerKey)) {
          output.providers.push({
            key: providerKey,
            name: providerKey,
            type: 'env',
            hasToken: true,
            hasSecret: false,
          });
        }
      }
    }

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
    };
  }
);

server.tool(
  'forge.reset',
  'Reset the simulator — clears all state (KVS, queues, resolvers, logs, UI). Like a fresh install.',
  async () => {
    sim.reset();
    sim.ui.reset();
    return {
      content: [{ type: 'text' as const, text: '✅ Simulator reset. All state cleared.' }],
    };
  }
);

// ── Resources ───────────────────────────────────────────────────────────

server.resource(
  'manifest',
  'forge.//manifest',
  { description: 'The currently deployed Forge app manifest', mimeType: 'application/json' },
  async () => {
    const manifest = sim.getManifest();
    if (!manifest) {
      return { contents: [{ uri: 'forge.//manifest', text: 'No manifest loaded. Deploy an app first.' }] };
    }
    return {
      contents: [{
        uri: 'forge.//manifest',
        text: JSON.stringify({
          app: manifest.raw.app,
          functions: [...manifest.functions.entries()].map(([k, v]) => ({ key: k, handler: v.handler })),
          uiModules: manifest.uiModules,
          consumers: manifest.consumers,
          triggers: manifest.triggers,
          scheduledTriggers: manifest.scheduledTriggers,
          resources: [...manifest.resources.entries()].map(([k, v]) => ({ key: k, path: v.path })),
        }, null, 2),
      }],
    };
  }
);

server.resource(
  'functions',
  'forge.//functions',
  { description: 'List of registered resolver functions', mimeType: 'application/json' },
  async () => {
    const defs = sim.resolver.getDefinitions();
    return {
      contents: [{
        uri: 'forge.//functions',
        text: JSON.stringify({ resolvers: defs, count: defs.length }, null, 2),
      }],
    };
  }
);

server.resource(
  'triggers',
  'forge.//triggers',
  { description: 'Registered triggers and their events', mimeType: 'application/json' },
  async () => {
    const manifest = sim.getManifest();
    if (!manifest) {
      return { contents: [{ uri: 'forge.//triggers', text: 'No manifest loaded.' }] };
    }
    return {
      contents: [{
        uri: 'forge.//triggers',
        text: JSON.stringify({
          triggers: manifest.triggers,
          scheduledTriggers: manifest.scheduledTriggers,
        }, null, 2),
      }],
    };
  }
);

server.resource(
  'state',
  'forge.//state',
  { description: 'Full simulator state snapshot (KVS, queue, UI)', mimeType: 'application/json' },
  async () => {
    const doc = sim.ui.getForgeDoc();
    const eventLog = sim.queue.getEventLog();

    return {
      contents: [{
        uri: 'forge.//state',
        text: JSON.stringify({
          kvs: { entries: sim.kvs.dump(), size: sim.kvs.size },
          queue: {
            totalEvents: eventLog.length,
            events: eventLog.slice(-50).map((e) => ({
              queue: e.queueKey,
              status: e.event.status,
              body: e.event.body,
            })),
          },
          ui: doc ? { rendered: true, tree: sim.ui.prettyPrint(doc) } : { rendered: false },
          manifest: sim.getManifest()?.raw?.app ?? null,
        }, null, 2),
      }],
    };
  }
);

// ── Start ───────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const httpMode = args.includes('--http');
  const port = parseInt(args.find((a) => a.startsWith('--port='))?.split('=')[1] ?? '3100');

  if (httpMode) {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => 'forge-sim-session' });
    await server.connect(transport);

    const httpServer = createServer(async (req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${port}`);
      if (url.pathname === '/mcp') {
        await transport.handleRequest(req, res);
      } else {
        res.writeHead(404).end('Not found');
      }
    });

    httpServer.listen(port, () => {
      console.error(`[forge-sim] MCP server running on http://localhost:${port}/mcp`);
    });
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[forge-sim] MCP server running on stdio');
  }
}

main().catch((err) => {
  console.error('[forge-sim] Fatal error:', err);
  process.exit(1);
});
