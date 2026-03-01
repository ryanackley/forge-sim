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
import { ForgeSimulator } from './simulator.js';
import { setSimulator } from './shims/globals.js';
import { getLatestForgeDoc, resetBridge } from './ui/bridge.js';
import { findByType, findByTypeAndText, simulateEvent, prettyPrint, getTextContent } from './ui/doc-utils.js';

// ── Simulator Instance ──────────────────────────────────────────────────

const sim = new ForgeSimulator();
setSimulator(sim);

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
      resetBridge();
    }

    try {
      const result = await sim.deploy(appDir);
      const summary = {
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

      return {
        content: [{
          type: 'text' as const,
          text: result.errors.length > 0
            ? `⚠️ Deployed with ${result.errors.length} error(s):\n${JSON.stringify(summary, null, 2)}`
            : `✅ Deployed successfully:\n${JSON.stringify(summary, null, 2)}`,
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
  },
  async ({ functionKey, payload }) => {
    try {
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
  'forge.ui_state',
  'Get the current ForgeDoc UI tree. Shows what the Forge app UI looks like right now. Returns a pretty-printed component tree.',
  async () => {
    const doc = getLatestForgeDoc();
    if (!doc) {
      return {
        content: [{ type: 'text' as const, text: 'No UI rendered yet. Deploy an app with UI resources first, or invoke a resolver that triggers a render.' }],
      };
    }

    return {
      content: [{ type: 'text' as const, text: prettyPrint(doc) }],
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
    const doc = getLatestForgeDoc();
    if (!doc) {
      return {
        content: [{ type: 'text' as const, text: 'No UI rendered. Deploy an app with UI first.' }],
        isError: true,
      };
    }

    try {
      const node = findByTypeAndText(doc, componentType, matchText, nthMatch);
      const eventName = event ?? 'onClick';

      const consoleBefore = sim.getConsoleLogs().length;
      const result = simulateEvent(node, eventName, ...(eventArgs ?? []));

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
      const updatedDoc = getLatestForgeDoc();
      if (updatedDoc) {
        output.updatedUI = prettyPrint(updatedDoc);
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

server.tool(
  'forge.reset',
  'Reset the simulator — clears all state (KVS, queues, resolvers, logs, UI). Like a fresh install.',
  async () => {
    sim.reset();
    resetBridge();
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
    const doc = getLatestForgeDoc();
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
          ui: doc ? { rendered: true, tree: prettyPrint(doc) } : { rendered: false },
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
