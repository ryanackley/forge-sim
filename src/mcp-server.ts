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
 *   forge:ui_render     — Render a UI module by manifest key (loads bundle + builds context)
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
 *   forge:mock_routes   — Register mock HTTP responses for product APIs or remotes
 *   forge:mock_graphql  — Register mock GraphQL responses by operation name
 *   forge:llm_mock      — Register mock LLM responses for @forge/llm chat()
 *   forge:llm_history   — Get @forge/llm call history (prompts + responses)
 *   forge:realtime_publish — Publish an event to a realtime channel
 *   forge:realtime_state   — Inspect realtime subscriptions and event log
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
      await sim.reset();
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

      // Surface manifest validation warnings (missing app.runtime, unknown
      // module types, inline-config notes, etc.). The in-process deployer
      // already console.warn's these, but MCP callers don't see those logs
      // — adding them to the response keeps parity between surfaces.
      if (result.warnings.length > 0) {
        summary.warnings = result.warnings;
      }

      // Connect auth credentials (env vars + .forge-sim) now that manifest providers are loaded
      const authResult = await sim.loadAuthFromEnv().catch(() => ({ atlassian: { connected: false }, providers: [] }));
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
  'forge.ui_render',
  'Render a UI module by its manifest key. Loads the module bundle, builds the Forge context (with optional issue/content/space hydration), runs ForgeReconciler.render, and returns the resulting ForgeDoc. Use this when a module has no resolver to invoke (macros, custom field views) or when you want to inspect a module under a specific context. For inline-config macros, also returns the MacroConfig tree if the bundle calls ForgeReconciler.addConfig.',
  {
    moduleKey: z.string().describe('UI module key from the manifest (e.g. "issue-panel", "pet-card"). For sub-module shapes use suffixes: "<key>--view", "<key>--edit", "<key>--config".'),
    issueKey: z.string().optional().describe('Jira issue key to hydrate context (e.g. "PROJ-1") — also sets project from prefix.'),
    projectKey: z.string().optional().describe('Jira project key to hydrate context (e.g. "PROJ").'),
    contentId: z.string().optional().describe('Confluence content ID to hydrate context.'),
    spaceKey: z.string().optional().describe('Confluence space key to hydrate context.'),
    context: z.record(z.string(), z.any()).optional().describe('Raw context fields merged into extension (overrides defaults).'),
    macroConfig: z.record(z.string(), z.any()).optional().describe('For macro modules: seed saved config so useConfig() resolves to these values on this render.'),
  },
  async ({ moduleKey, issueKey, projectKey, contentId, spaceKey, context, macroConfig }) => {
    try {
      // Seed inline macro config if provided — useConfig() will see it.
      if (macroConfig) {
        sim.ui.setMacroConfig(moduleKey, macroConfig);
      }

      const renderOpts: Record<string, unknown> = {};
      if (issueKey) renderOpts.issueKey = issueKey;
      if (projectKey) renderOpts.projectKey = projectKey;
      if (contentId) renderOpts.contentId = contentId;
      if (spaceKey) renderOpts.spaceKey = spaceKey;
      if (context) renderOpts.context = context;

      const doc = await sim.ui.render(moduleKey, renderOpts);
      if (!doc) {
        return {
          content: [{ type: 'text' as const, text: `Module "${moduleKey}" rendered, but no ForgeDoc was produced. Check that the module bundle calls ForgeReconciler.render(<App />).` }],
          isError: true,
        };
      }

      const sections: string[] = [
        `Rendered "${moduleKey}":`,
        sim.ui.prettyPrint(doc),
      ];

      // For macro inline-config modules, surface the MacroConfig tree too —
      // it's a separate ForgeDoc emitted by ForgeReconciler.addConfig() and
      // wouldn't show up under the main view tree otherwise.
      const configDoc = sim.ui.getMacroConfigDoc(moduleKey);
      if (configDoc) {
        sections.push('', 'MacroConfig tree (inline addConfig):', sim.ui.prettyPrint(configDoc));
      }

      return {
        content: [{ type: 'text' as const, text: sections.join('\n') }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `❌ Render failed: ${err instanceof Error ? err.message : String(err)}` }],
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
        content: [{ type: 'text' as const, text: 'No UI rendered yet. Call `forge.ui_render` with a module key to render a UI module, or invoke a resolver that triggers a render.' }],
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
        content: [{ type: 'text' as const, text: 'No UI rendered. Call `forge.ui_render` with a module key first.' }],
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
  'Get simulator logs plus captured `console.*` output from Forge app code. ' +
  'The response has a dedicated `console` array (resolver/trigger/scheduled-trigger ' +
  'print output) and a `logs` array (simulator-level events plus the same console ' +
  'lines mirrored under `level=console.<log|warn|error|info|debug>` so existing ' +
  'level filters keep working).',
  {
    level: z.string().optional().describe('Filter `logs` by exact level or level prefix (e.g. "error", "console.log", "invoke", "trigger"). Does NOT filter the `console` array — that is always your captured console.* output.'),
    limit: z.number().optional().describe('Max entries to return for `logs` and `console` (default: 100, most recent)'),
    clear: z.boolean().optional().describe('Clear logs after reading'),
  },
  async ({ level, limit, clear }) => {
    const output = sim.buildLogsResponse({ level, limit });
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

    // LLM (Anthropic) API key status
    const llmKey = sim.llm.getApiKey();
    output.llm = {
      configured: !!llmKey,
      source: llmKey ? (process.env.ANTHROPIC_API_KEY ? 'env' : 'config') : null,
    };

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
    };
  }
);

server.tool(
  'forge.reset',
  'Reset the simulator — clears KVS, queues, resolvers, logs, UI, realtime, manifest, AND drops all SQL tables (the MySQL server itself stays running for speed). Use sim.stop() to shut down the SQL server.',
  async () => {
    await sim.reset();
    sim.ui.reset();
    return {
      content: [{ type: 'text' as const, text: '✅ Simulator reset. All state cleared (in-memory + SQL tables dropped).' }],
    };
  }
);

// ── Mock Tools ──────────────────────────────────────────────────────────

server.tool(
  'forge.mock_routes',
  `Register mock HTTP responses for product APIs (Jira, Confluence, Bitbucket) or remotes.
Route keys are "METHOD /path" (e.g. "GET /rest/api/3/version/10001"). Method defaults to GET if omitted.
Path matching is prefix-based, so "/rest/api/3/issue" matches "/rest/api/3/issue/TEST-1".
Values are the JSON response body. Use this to set up test fixtures before firing triggers or invoking resolvers.

Example:
  product: "jira"
  routes: {
    "GET /rest/api/3/version/10001": { "id": "10001", "name": "1.0.0", "releaseDate": "2026-04-03" },
    "GET /rest/api/3/project/10000": { "id": "10000", "key": "PROJ", "name": "My Project" },
    "GET /rest/api/3/search": { "issues": [{ "key": "PROJ-1", "fields": { "summary": "Fix bug", "issuetype": { "name": "Bug" }, "status": { "name": "Done" }, "assignee": { "displayName": "Ryan" } } }] },
    "POST /wiki/api/v2/pages": { "id": "12345", "title": "Release Notes" }
  }`,
  {
    product: z.string().describe('Product name: "jira", "confluence", "bitbucket", or a remote key from manifest.yml'),
    routes: z.record(z.string(), z.any()).describe('Route map: keys are "METHOD /path" patterns, values are JSON response bodies'),
  },
  async ({ product, routes }) => {
    try {
      sim.mockProductRoutes(product, routes);
      const routeKeys = Object.keys(routes);
      return {
        content: [{
          type: 'text' as const,
          text: `✅ Registered ${routeKeys.length} mock route(s) for "${product}":\n${routeKeys.map(k => `  • ${k}`).join('\n')}`,
        }],
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
  'forge.mock_graphql',
  `Register mock responses for Atlassian GraphQL (gateway) operations, keyed by operation name.
Values are the full response body (typically { data: { ... } }).
Use '*' as a catch-all for anonymous or unmatched operations.

Example:
  operations: {
    "GetIssue": { "data": { "issue": { "key": "TEST-1", "summary": "Fix login" } } },
    "SearchUsers": { "data": { "users": [{ "accountId": "abc", "displayName": "Ryan" }] } }
  }`,
  {
    operations: z.record(z.string(), z.any()).describe('Map of operation name → response body. Use "*" as a catch-all.'),
  },
  async ({ operations }) => {
    try {
      sim.mockGraphQL(operations);
      const opNames = Object.keys(operations);
      return {
        content: [{
          type: 'text' as const,
          text: `✅ Registered ${opNames.length} GraphQL mock(s):\n${opNames.map(k => `  • ${k}`).join('\n')}`,
        }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `❌ ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  }
);

// ── LLM Tools ────────────────────────────────────────────────────────────

server.tool(
  'forge.llm_mock',
  `Register a mock response for the next @forge/llm chat() call.
Responses are consumed in FIFO order. Queue multiple to script multi-turn agent loops.
If no mocks are queued and no ANTHROPIC_API_KEY is set, chat() will throw.

Example:
  content: "The answer is 42."
  tool_calls: [{ id: "call_1", type: "function", index: 0, function: { name: "get_data", arguments: { query: "issues" } } }]
  finish_reason: "tool_use"`,
  {
    content: z.union([z.string(), z.array(z.object({ type: z.literal('text'), text: z.string() }))]).describe('Response content — string or array of { type: "text", text: "..." }'),
    tool_calls: z.array(z.object({
      id: z.string(),
      type: z.literal('function'),
      index: z.number(),
      function: z.object({
        name: z.string(),
        arguments: z.union([z.record(z.string(), z.any()), z.string()]),
      }),
    })).optional().describe('Tool calls the mock response should include (for agent loop testing)'),
    finish_reason: z.string().optional().describe('Finish reason — auto-detected if omitted (end_turn for text, tool_use if tool_calls present)'),
  },
  async ({ content, tool_calls, finish_reason }) => {
    try {
      sim.llm.mockResponse({ content, tool_calls, finish_reason });
      const desc = tool_calls?.length
        ? `mock with ${tool_calls.length} tool call(s)`
        : `mock text response (${typeof content === 'string' ? content.slice(0, 60) : 'array'}${typeof content === 'string' && content.length > 60 ? '...' : ''})`;
      return {
        content: [{ type: 'text' as const, text: `✅ Queued LLM ${desc}. Queue depth: ${sim.llm.getHistory().length + 1}` }],
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
  'forge.llm_history',
  `Get @forge/llm call history — every chat() call with its prompt and response.
Useful for verifying agent loop behavior, tool call sequences, and model interactions.`,
  {},
  async () => {
    const history = sim.llm.getHistory();
    if (history.length === 0) {
      return {
        content: [{ type: 'text' as const, text: 'No LLM calls recorded yet.' }],
      };
    }
    const summary = history.map((entry, i) => {
      const msgCount = entry.prompt.messages.length;
      const toolCount = entry.prompt.tools?.length ?? 0;
      const choice = entry.response.choices[0];
      const finishReason = choice?.finish_reason ?? 'unknown';
      const hasToolCalls = !!choice?.message?.tool_calls?.length;
      return `#${i + 1}: ${entry.prompt.model} | ${msgCount} msgs${toolCount ? `, ${toolCount} tools` : ''} → ${finishReason}${hasToolCalls ? ` (${choice.message.tool_calls!.length} tool calls)` : ''}`;
    });
    return {
      content: [{
        type: 'text' as const,
        text: `LLM call history (${history.length} call${history.length !== 1 ? 's' : ''}):\n${summary.join('\n')}\n\n` +
          JSON.stringify(history, null, 2),
      }],
    };
  }
);

// ── Realtime Tools ───────────────────────────────────────────────────────

server.tool(
  'forge.realtime_publish',
  `Publish an event to a realtime channel, simulating what a resolver or bridge would do.
Useful for testing frontend subscriptions from the MCP side.

Example:
  channel: "progress-updates"
  payload: { "percent": 75, "status": "processing" }
  global: true`,
  {
    channel: z.string().describe('Channel name to publish to'),
    payload: z.union([z.string(), z.record(z.string(), z.any())]).describe('Event payload — string or JSON object'),
    global: z.boolean().optional().describe('If true, publish to global channel (publishGlobal). Default: false (scoped).'),
  },
  async ({ channel, payload, global: isGlobal }) => {
    try {
      const result = isGlobal
        ? await sim.realtime.publishGlobal(channel, payload)
        : await sim.realtime.publish(channel, payload);
      return {
        content: [{
          type: 'text' as const,
          text: result.eventId
            ? `✅ Published to "${channel}" (${isGlobal ? 'global' : 'scoped'}). eventId=${result.eventId}`
            : `⚠️ Published to "${channel}" but no subscribers. Event logged but not delivered.`,
        }],
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
  'forge.realtime_state',
  `Inspect realtime state — active subscriptions and published event log.
Shows which channels have subscribers and the history of published events.`,
  {},
  async () => {
    const subs = sim.realtime.getSubscriptions();
    const events = sim.realtime.getEventLog();
    const lines: string[] = [];

    lines.push(`Active subscriptions (${subs.length}):`);
    if (subs.length === 0) {
      lines.push('  (none)');
    } else {
      for (const s of subs) {
        lines.push(`  • ${s.channelKey} — ${s.subscriberCount} subscriber(s)`);
      }
    }

    lines.push('');
    lines.push(`Event log (${events.length} event${events.length !== 1 ? 's' : ''}):`);
    if (events.length === 0) {
      lines.push('  (none)');
    } else {
      const recent = events.slice(-20); // Last 20
      if (events.length > 20) lines.push(`  (showing last 20 of ${events.length})`);
      for (const e of recent) {
        const payloadPreview = typeof e.payload === 'string'
          ? e.payload.slice(0, 80)
          : JSON.stringify(e.payload).slice(0, 80);
        lines.push(`  ${e.eventId} | ${e.global ? 'global' : 'scoped'} "${e.channel}" | ${payloadPreview}`);
      }
    }

    return {
      content: [{ type: 'text' as const, text: lines.join('\n') }],
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
