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
 *   forge:ui_wait_for   — Wait for text to appear in a module's rendered tree (handles async useEffect chains)
 *   forge:ui_state      — Get the current ForgeDoc UI tree
 *   forge:ui_interact   — Interact with UI components (click, submit, etc.)
 *   forge:ui_fill_form  — Fill form fields by name (correct per-type event shapes) and optionally submit
 *   forge:kvs_get       — Get a value from KVS
 *   forge:kvs_list      — List/dump KVS contents
 *   forge:kvs_set       — Set a value in KVS (for test setup)
 *   forge:objectstore_list   — List Object Store objects (metadata)
 *   forge:objectstore_get    — Get object metadata + content (utf-8 or base64)
 *   forge:objectstore_put    — Seed an object directly (test setup)
 *   forge:objectstore_delete — Delete an object by key
 *   forge:objectstore_create_download_url — Pre-signed download URL (curl-able, Range-capable)
 *   forge:variables_set   — Set ephemeral env variables (take effect at next deploy)
 *   forge:variables_unset — Remove an ephemeral env variable
 *   forge:variables_list  — List all env variables (encrypted values masked)
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
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createSimulator } from './simulator.js';
import { buildEntityQueryWireBody, MCP_RANGE_OPERATORS, MCP_FILTER_OPERATORS } from './mcp-entity-query.js';
import {
  isStale,
  buildStalenessWarning,
  buildAutoRestartNotice,
  STALENESS_GRACE_MS,
  AUTO_RESTART_EXIT_DELAY_MS,
  shouldRunStalenessCheck,
  shouldWarnNow,
  shouldAutoRestartOnStale,
} from './staleness.js';
// UI access is now through sim.ui.* — no direct bridge/doc-utils imports
import { withCapture, type ConsoleLine } from './console-capture.js';
import { redirectStdoutConsoleToStderr } from './stdio-guard.js';

// ── Stdio hygiene (eval-7 F4) ───────────────────────────────────────────
//
// Over the stdio transport, stdout IS the JSON-RPC framing channel — any
// stray `console.log` corrupts the stream. Rebind log/info/debug to stderr
// before anything else runs. The HTTP transport doesn't use stdout for
// framing — leave it alone there. See stdio-guard.ts for the full story.
if (!process.argv.includes('--http')) {
  redirectStdoutConsoleToStderr();
}

// ── Simulator Instance ──────────────────────────────────────────────────

const sim = createSimulator();

// ── Stale-daemon self-check ─────────────────────────────────────────────
//
// The MCP server is a long-lived Node process — it loads dist/*.js ONCE at
// startup. If `forge-sim` is rebuilt (or upgraded via `npm install`) while
// the daemon is running, the daemon keeps the OLD compiled code in memory.
// Tool calls then fail with errors that don't match the current source —
// e.g. methods added in the new dist are "not a function" on the in-memory
// simulator instance.
//
// This trap has bit at least three times this week (logged in the project's
// memory). The fix: on every tool response, re-stat our own loaded
// `dist/mcp-server.js`. If its mtime is now newer than what we recorded at
// startup (plus a small grace period for filesystem clock skew), prepend a
// loud warning to the response. The warning carries our PID so the operator
// (or agent) can `kill` us — the MCP client respawns automatically with
// fresh code on the next tool call.
//
// Belt + suspenders: also expose a `forge.sim_info` tool returning the
// current state explicitly, so agents can sanity-check before debugging
// other classes of bug.

const MCP_SERVER_PATH = fileURLToPath(import.meta.url);
const DAEMON_PID = process.pid;
const DAEMON_START_TIME = Date.now();

// Only enable the staleness check when we're running from a non-node_modules
// location (i.e. from a forge-sim development checkout, not from an end-user's
// `npm install`). End-users don't rebuild the package mid-session — surfacing
// a "stale daemon" warning in their tool responses would be pure noise.
// Overridable via FORGE_SIM_STALE_CHECK=on|off; see staleness.ts.
const STALENESS_CHECK_ENABLED = shouldRunStalenessCheck(MCP_SERVER_PATH);

let loadedMtimeMs: number | null = null;
if (STALENESS_CHECK_ENABLED) {
  try {
    loadedMtimeMs = statSync(MCP_SERVER_PATH).mtimeMs;
  } catch {
    // Can't stat ourselves — disable the check rather than emit warnings
    // we can't ground in fact.
    loadedMtimeMs = null;
  }
}

/**
 * mtime of dist/mcp-server.js the last time we emitted a staleness warning
 * (or null if we haven't warned yet this daemon lifetime). Used by the
 * pure `shouldWarnNow()` decider in staleness.ts to suppress repeat
 * warnings at the same on-disk mtime — the agent only needs to be told
 * once per rebuild. Re-fires on a subsequent rebuild because that's a new
 * event worth surfacing.
 */
let lastWarnedMtimeMs: number | null = null;

function currentMtime(): number | null {
  try {
    return statSync(MCP_SERVER_PATH).mtimeMs;
  } catch {
    return null;
  }
}

function stalenessWarningText(): string | null {
  if (loadedMtimeMs === null) return null;
  const cur = currentMtime();
  if (cur === null) return null;
  if (!shouldWarnNow(loadedMtimeMs, cur, lastWarnedMtimeMs, STALENESS_GRACE_MS)) return null;
  // Record that we've warned about this exact mtime so the next call
  // suppresses. Belt-and-suspenders: re-check isStale here so a future
  // refactor of shouldWarnNow can't silently start emitting on
  // not-actually-stale states.
  if (!isStale(loadedMtimeMs, cur, STALENESS_GRACE_MS)) return null;
  lastWarnedMtimeMs = cur;
  return buildStalenessWarning(DAEMON_PID, loadedMtimeMs, cur);
}

// ── Auto-restart on stale dist (publish-gate F2) ────────────────────────
//
// The warn-only flow still required the operator/agent to `kill <pid>` and
// retry — a two-step recovery that publish-gate F2 flagged as the remaining
// friction. With auto-restart, a stale daemon answers the in-flight tool
// call (prepending a self-contained notice), then exits after the response
// flushes. The MCP client respawns a fresh daemon — running the rebuilt
// dist — on the very next tool call. Recovery cost drops to "re-deploy".
//
// FORGE_SIM_STALE_AUTORESTART=off restores warn-only mode (e.g. when you
// deliberately want to keep in-memory sim state alive across rebuilds).
const AUTO_RESTART_ENABLED = shouldAutoRestartOnStale();
let staleExitScheduled = false;

/**
 * If the daemon is stale and auto-restart is enabled: schedule process exit
 * (once) and return the notice to prepend to THIS response. Returns null
 * when not stale, when auto-restart is disabled, or when the staleness
 * check itself is off.
 */
function maybeScheduleStaleExit(): string | null {
  if (!AUTO_RESTART_ENABLED || loadedMtimeMs === null) return null;
  const cur = currentMtime();
  if (cur === null || !isStale(loadedMtimeMs, cur, STALENESS_GRACE_MS)) return null;
  if (!staleExitScheduled) {
    staleExitScheduled = true;
    console.error(
      `[forge-sim] stale daemon (pid=${DAEMON_PID}) auto-restarting in ${AUTO_RESTART_EXIT_DELAY_MS}ms — ` +
      `dist/mcp-server.js was rebuilt after this process started.`
    );
    setTimeout(() => process.exit(0), AUTO_RESTART_EXIT_DELAY_MS);
  }
  return buildAutoRestartNotice(DAEMON_PID, loadedMtimeMs, cur);
}

// ── MCP Server Setup ────────────────────────────────────────────────────

const server = new McpServer({
  name: 'forge-sim',
  version: '0.1.0',
});

// Wrap server.tool so every handler's response carries the staleness warning
// when applicable. Done by monkey-patching once before any tool registrations.
const originalServerTool = server.tool.bind(server) as any;
(server as any).tool = (...args: any[]) => {
  const handler = args[args.length - 1];
  if (typeof handler !== 'function') return originalServerTool(...args);
  const rest = args.slice(0, -1);
  const wrappedHandler = async (...handlerArgs: any[]) => {
    const result = await handler(...handlerArgs);
    // Auto-restart takes precedence over the warn-only message: when the
    // daemon is about to exit on its own, "run `kill <pid>`" would be wrong
    // advice, so the self-contained restart notice replaces the warning.
    // The notice intentionally repeats on every response in the (brief)
    // window before exit — each of those responses ran on stale code.
    const notice = maybeScheduleStaleExit() ?? stalenessWarningText();
    if (!notice) return result;
    // MCP tool responses are `{ content: [{ type: 'text', text: '...' }, ...] }`.
    // Prepend a synthetic text item so the warning is the first thing the
    // agent sees, with the original content immediately after.
    if (result && typeof result === 'object' && Array.isArray(result.content)) {
      return {
        ...result,
        content: [
          { type: 'text' as const, text: notice },
          ...result.content,
        ],
      };
    }
    return result;
  };
  return originalServerTool(...rest, wrappedHandler);
};

// ── Tools ───────────────────────────────────────────────────────────────

server.tool(
  'forge.sim_info',
  'Return daemon-process metadata: PID, start time, loaded mcp-server.js mtime, ' +
  'and whether the daemon is stale (dist/ has been rebuilt since startup). ' +
  'Use this to sanity-check before debugging confusing tool errors — most surprising ' +
  'MCP failures are stale-daemon symptoms, not real bugs.',
  {},
  async () => {
    const onDiskMtime = currentMtime();
    const stale = onDiskMtime !== null && loadedMtimeMs !== null
      && isStale(loadedMtimeMs, onDiskMtime, STALENESS_GRACE_MS);
    const info = {
      pid: DAEMON_PID,
      daemonStartedAt: new Date(DAEMON_START_TIME).toISOString(),
      mcpServerPath: MCP_SERVER_PATH,
      stalenessCheck: STALENESS_CHECK_ENABLED
        ? 'enabled (running from non-node_modules location — dev mode)'
        : 'disabled (running from node_modules — published-install mode; set FORGE_SIM_STALE_CHECK=on to force enable)',
      loadedMtime: loadedMtimeMs !== null ? new Date(loadedMtimeMs).toISOString() : null,
      currentOnDiskMtime: onDiskMtime !== null ? new Date(onDiskMtime).toISOString() : null,
      stale,
      autoRestart: AUTO_RESTART_ENABLED
        ? 'enabled — a stale daemon exits after responding; the MCP client respawns it fresh (set FORGE_SIM_STALE_AUTORESTART=off to disable)'
        : 'disabled via FORGE_SIM_STALE_AUTORESTART — stale daemons warn only; restart manually',
      restartHint: stale
        ? (AUTO_RESTART_ENABLED
            ? 'auto-restart armed — daemon exits after this response; call forge.deploy again, then retry'
            : `kill ${DAEMON_PID}  # MCP client respawns automatically`)
        : null,
    };
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(info, null, 2) }],
    };
  }
);

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
      // Continue-and-inform surface: never throw on deploy errors, always
      // run the type checker (once per MCP iteration is cheap). Errors and
      // typeErrors are reported in the summary below. (Eval-6 F3/F4)
      //
      // Eval-7 F4: capture everything deploy prints (⏰ firing banners,
      // app handler console output, 📡 auth notices) and return it IN the
      // response as a structured `console` array — over stdio there is no
      // legitimate stdout side-channel, and stderr is invisible to most
      // MCP clients. Deploy-time scheduled-trigger fires route their
      // handler output through sim's console log (fireScheduledTrigger
      // runs its own capture), so we merge our outer capture with the
      // sim-log delta; capture-stack semantics guarantee no line lands in
      // both.
      const consoleStart = sim.getConsoleLogs().length;
      const { result, console: deployConsole } = await withCapture(() =>
        sim.deploy(appDir, { throwOnError: false, typeCheck: true }),
      );
      const capturedLines: ConsoleLine[] = [
        ...deployConsole,
        ...sim.getConsoleLogs().slice(consoleStart),
      ].sort((a, b) => a.timestamp - b.timestamp);
      const typeErrors = result.typeErrors ?? [];
      const summary: Record<string, any> = {
        app: result.manifest.raw.app,
        loadedFunctions: result.loadedFunctions,
        loadedResources: result.loadedResources,
        // Shared summary fields from DeployResult — the in-process
        // `sim.deploy()` returns these same shapes, so MCP and vitest
        // assertions can't drift (publish-gate F3).
        resolvers: result.resolvers,
        triggers: result.triggers,
        consumers: result.consumers,
        webTriggers: result.webTriggers,
        scheduledTriggers: result.scheduledTriggers,
        uiModules: result.uiModules,
        errors: result.errors,
      };

      // Structured record of deploy-time scheduled-trigger fires (eval-7
      // F4) — key, function, statusCode, and error detail per fire. The
      // ⏰ banner used to be the only evidence these ran, and it went to
      // stdout where it corrupted the stdio framing.
      if (result.scheduledTriggerFires.length > 0) {
        summary.scheduledTriggerFires = result.scheduledTriggerFires;
      }

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

      // Connect auth credentials (env vars + .forge-sim) now that manifest
      // providers are loaded. Captured too — the 📡 "Connected to real
      // APIs" banner belongs in the response's console array, not on the
      // transport (eval-7 F4). `summary.auth` carries the structured form.
      const { result: authResult, console: authConsole } = await withCapture(() =>
        sim.loadAuthFromEnv().catch(() => ({ atlassian: { connected: false as const }, providers: [] })),
      );
      capturedLines.push(...authConsole);
      if (authResult.atlassian.connected || authResult.providers.length > 0) {
        summary.auth = authResult;
      }

      // Everything deploy + auth printed, in-band (eval-7 F4). Same shape
      // as forge.invoke's per-call console array.
      if (capturedLines.length > 0) {
        summary.console = capturedLines.map((l) => ({ level: l.level, message: l.message }));
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
    moduleKey: z.string().optional().describe('Scope resolver lookup to a specific module — required when multiple modules register the same function key'),
    context: z.record(z.string(), z.any()).optional().describe('Per-call context override (one-shot, does not mutate sticky setContext). Merged onto the base context. Fields match Forge req.context: accountId, cloudId, principal, license, ... Do NOT nest extension here — use the extension param.'),
    extension: z.record(z.string(), z.any()).optional().describe('Replaces req.context.extension wholesale for this invocation (placement data: issue, project, content, space, config, ...).'),
  },
  async ({ functionKey, payload, actionKey, moduleKey, context, extension }) => {
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

      const result = await sim.invoke(functionKey, payload ?? {}, { moduleKey, context, extension });

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
      // Any 2xx/3xx is success — a 200 with a body is just as valid as a 204
      // (eval paper cut: successful fires used to render with a ⚠️ prefix).
      const emoji = result.statusCode >= 400 ? '❌' : '✅';
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
  'forge.fire_web_trigger',
  'Fire a web trigger (webtrigger module) by key — simulates an HTTP request hitting its URL, exactly like the dev server\'s /__trigger/<key> endpoint. The handler is called with the Forge (request, context) convention. Returns the { statusCode, headers, body } response. Handler errors and malformed results come back as 500 responses (what a real webhook caller would see), not tool errors.',
  {
    triggerKey: z.string().describe('The webtrigger module key from the manifest'),
    method: z.string().optional().describe('HTTP method (default: GET)'),
    userPath: z.string().optional().describe('Extra path appended after the trigger URL (e.g. "/hooks/push")'),
    headers: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional().describe('Request headers'),
    queryParameters: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional().describe('Query parameters'),
    body: z.any().optional().describe('Request body — objects/arrays are JSON.stringified, strings pass through raw'),
  },
  async ({ triggerKey, method, userPath, headers, queryParameters, body }) => {
    try {
      const result = await sim.fireWebTrigger(triggerKey, { method, userPath, headers, queryParameters, body });
      const emoji = result.statusCode < 400 ? '✅' : '❌';
      return {
        content: [{
          type: 'text' as const,
          text: `${emoji} Web trigger "${triggerKey}" → ${result.statusCode}\n${JSON.stringify(result, null, 2)}`,
        }],
        isError: result.statusCode >= 500,
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `❌ Web trigger failed: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  'forge.ui_render',
  'Render a UI module by its manifest key. Loads the module bundle, builds the Forge context (with optional issue/content/space hydration), runs ForgeReconciler.render, and returns the resulting ForgeDoc. Use this when a module has no resolver to invoke (macros, custom field views) or when you want to inspect a module under a specific context. For inline-config macros, also returns the MacroConfig tree if the bundle calls ForgeReconciler.addConfig. NOTE: only the INITIAL reconcile is awaited — if the module uses `useEffect` + `invoke()` to fetch data after mount, the response will show the loading state (e.g. `<Text>Loading...</Text>`). Follow up with `forge.ui_wait_for` to settle the async chain before inspecting or interacting.',
  {
    moduleKey: z.string().describe('UI module key from the manifest (e.g. "issue-panel", "pet-card"). For sub-module shapes use suffixes: "<key>--view", "<key>--edit", "<key>--config".'),
    issueKey: z.string().optional().describe('Jira issue key to hydrate context (e.g. "PROJ-1") — also sets project from prefix.'),
    projectKey: z.string().optional().describe('Jira project key to hydrate context (e.g. "PROJ").'),
    contentId: z.string().optional().describe('Confluence content ID to hydrate context.'),
    spaceKey: z.string().optional().describe('Confluence space key to hydrate context.'),
    context: z.record(z.string(), z.any()).optional().describe('Raw context fields. Canonical ForgeContext fields (accountId, cloudId, locale, ...) are promoted to the top level; anything else is merged into extension. Do NOT nest extension here — use the extension param.'),
    extension: z.record(z.string(), z.any()).optional().describe('Replaces the extension object wholesale (placement data: issue, project, content, space, config, ...). Suppresses issueKey/contentId hydration.'),
    macroConfig: z.record(z.string(), z.any()).optional().describe('For macro modules: seed saved config so useConfig() resolves to these values on this render.'),
  },
  async ({ moduleKey, issueKey, projectKey, contentId, spaceKey, context, extension, macroConfig }) => {
    try {
      const renderOpts: Record<string, unknown> = {};
      if (issueKey) renderOpts.issueKey = issueKey;
      if (projectKey) renderOpts.projectKey = projectKey;
      if (contentId) renderOpts.contentId = contentId;
      if (spaceKey) renderOpts.spaceKey = spaceKey;
      if (context) renderOpts.context = context;
      if (extension) renderOpts.extension = extension;
      // Pass macroConfig through as a one-shot per-render override (matches
      // both this tool's description "on this render" and the in-process
      // `sim.ui.render(key, { macroConfig })` semantics). For sticky config
      // across multiple renders, use `forge.kvs_set` or a dedicated setter.
      if (macroConfig) renderOpts.macroConfig = macroConfig;

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
  'forge.ui_wait_for',
  'Wait for a text substring to appear in a UI module\'s rendered tree. Use this after `forge.ui_render` when the initial reconcile shows a loading state and the real content arrives via a `useEffect` -> `invoke()` chain (e.g. `<Text>Loading...</Text>` first, then `<Text>{data}</Text>` after the resolver resolves). Also use after `forge.ui_interact` when an interaction kicks off an async update (form submit -> reload, click -> fetch -> render). `forge.ui_render` only awaits the initial reconcile, so any state set by a post-mount effect will NOT be in its response — call this tool next to settle. Substring match only (no regex). On timeout, returns isError with the current pretty-printed tree so you can see what actually rendered.',
  {
    moduleKey: z.string().describe('UI module key — same value passed to `forge.ui_render`. Required: scopes the wait to one module so a global text match on an unrelated render does not resolve early.'),
    text: z.string().describe('Substring to wait for in the rendered tree. Matched against <String> nodes and a curated set of visible-text props (Tag.text, FormHeader.title, EmptyState.header, etc.). For composite/nested data (Select option labels, table cells), use `forge.ui_state` and inspect the props directly instead.'),
    timeoutMs: z.number().optional().describe('Max time to wait in ms. Default: 5000.'),
  },
  async ({ moduleKey, text, timeoutMs }) => {
    try {
      const doc = await sim.ui.waitForContent(moduleKey, text, timeoutMs);
      return {
        content: [{
          type: 'text' as const,
          text: `Found "${text}" in module "${moduleKey}":\n${sim.ui.prettyPrint(doc)}`,
        }],
      };
    } catch (err) {
      // sim.ui.waitForContent rejects with a rich Error on timeout: includes
      // current text content and hints (e.g. "did you forget setMacroConfig?").
      // Surface that to the agent and attach the current pretty-printed tree
      // so they don't need a follow-up ui_state call.
      const message = err instanceof Error ? err.message : String(err);
      const current = sim.ui.getForgeDoc(moduleKey);
      const tree = current ? sim.ui.prettyPrint(current) : '(no doc — module never rendered)';
      return {
        content: [{
          type: 'text' as const,
          text: `❌ ${message}\n\nCurrent tree for "${moduleKey}":\n${tree}`,
        }],
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
  'forge.ui_fill_form',
  'Fill form fields BY NAME and optionally submit — the reliable way to drive UIKit forms. ' +
  'Prefer this over `forge.ui_interact` for form input: it targets `name="..."` props directly ' +
  '(no positional nthMatch guessing), fires the exact event shape each field type expects ' +
  '(Select gets the react-select {label, value} option object, Checkbox/Toggle get target.checked), ' +
  'and settles pending effects before filling so a late useEffect cannot clobber the value. ' +
  'Handles Textfield, TextArea, Checkbox, CheckboxGroup, Radio, RadioGroup, Toggle, Select, ' +
  'DatePicker, TimePicker, UserPicker, Range. With `submit: true`, fires the <Form> onSubmit ' +
  'after filling (react-hook-form validation applies, same as production — a blocked submit ' +
  'leaves validation errors visible in the returned tree). Unknown field names error with the ' +
  'list of available fields.',
  {
    moduleKey: z.string().describe('UI module key — same value passed to `forge.ui_render`.'),
    values: z.record(z.string(), z.any()).optional().describe(
      'Map of field name → value. Select: pass the option value (or {label, value}); ' +
      'isMulti Select: an array. Checkbox/Toggle: boolean. Omit to submit the form\'s current state.'
    ),
    submit: z.boolean().optional().describe(
      'Fire the <Form> onSubmit after filling (default: false). Required if `values` is omitted.'
    ),
  },
  async ({ moduleKey, values, submit }) => {
    if (!values && !submit) {
      return {
        content: [{ type: 'text' as const, text: '❌ Nothing to do — provide `values` to fill, `submit: true` to submit, or both.' }],
        isError: true,
      };
    }
    const doc = sim.ui.getForgeDoc(moduleKey);
    if (!doc) {
      return {
        content: [{ type: 'text' as const, text: `❌ No rendered ForgeDoc for module "${moduleKey}". Call \`forge.ui_render\` first.` }],
        isError: true,
      };
    }

    try {
      // Settle pending effects first — filling mid-effect-flush simulates
      // typing faster than a browser could paint (a pending setValue effect
      // would clobber what we just set).
      await sim.ui.settle(moduleKey);

      const consoleBefore = sim.getConsoleLogs().length;
      let result: unknown;
      if (submit) {
        // submitForm fills each value (if given), flushes, then fires onSubmit.
        result = await sim.ui.submitForm(moduleKey, values);
      } else {
        for (const [name, value] of Object.entries(values!)) {
          sim.ui.fillField(moduleKey, name, value);
        }
      }
      // Let fill/submit re-renders and any kicked-off invokes flush.
      await sim.ui.settle(moduleKey);

      const newConsole = sim.getConsoleLogs().slice(consoleBefore);
      const output: Record<string, unknown> = {
        module: moduleKey,
        filled: values ? Object.keys(values) : [],
        submitted: submit === true,
      };
      if (submit) output.result = result;
      if (newConsole.length > 0) {
        output.console = newConsole.map((l) => `[${l.level}] ${l.message}`);
      }
      const updatedDoc = sim.ui.getForgeDoc(moduleKey);
      if (updatedDoc) output.updatedUI = sim.ui.prettyPrint(updatedDoc);

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
        .where('key', { condition: 'BEGINS_WITH', values: [prefix] })
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

// ── Object Store tools ──────────────────────────────────────────────────

const MCP_OBJECT_CONTENT_CAP = 64 * 1024; // 64 kB of content per response

function isTextualContentType(contentType: string): boolean {
  return /^text\/|[+/](json|xml)|^application\/(json|xml|javascript|x-www-form-urlencoded)/i.test(contentType);
}

server.tool(
  'forge.objectstore_list',
  'List all Object Store objects (metadata only). Optionally filter by bucket ("default" or "cdn").',
  {
    bucket: z.enum(['default', 'cdn']).optional().describe('Only show objects in this bucket'),
  },
  async ({ bucket }) => {
    const objects = sim.objectStore.listObjects(bucket);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          count: objects.length,
          objects: objects.map((o) => ({
            key: o.key,
            bucket: o.bucket,
            size: o.size,
            contentType: o.contentType,
            checksumType: o.checksumType,
            currentVersion: o.currentVersion,
            createdAt: new Date(o.createdAt).toISOString(),
            updatedAt: new Date(o.updatedAt).toISOString(),
            expiresAt: new Date(o.expiresAt).toISOString(),
          })),
        }, null, 2),
      }],
    };
  }
);

server.tool(
  'forge.objectstore_get',
  'Get an Object Store object — metadata plus content. Textual content types are returned as UTF-8, everything else as base64. Content is capped at 64 kB (truncated flag set if larger).',
  {
    key: z.string().describe('Object key'),
    cdn: z.boolean().optional().describe('Read from the CDN bucket instead of default'),
  },
  async ({ key, cdn }) => {
    const ref = await sim.objectStore.get(key, { cdn });
    const content = sim.objectStore.getObjectContent(key, { cdn });
    if (!ref || !content) {
      return {
        content: [{ type: 'text' as const, text: `Object "${key}" not found${cdn ? ' (cdn bucket)' : ''}` }],
        isError: true,
      };
    }
    const textual = isTextualContentType(content.contentType);
    const truncated = content.buffer.length > MCP_OBJECT_CONTENT_CAP;
    const slice = truncated ? content.buffer.subarray(0, MCP_OBJECT_CONTENT_CAP) : content.buffer;
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          ...ref,
          contentType: content.contentType,
          encoding: textual ? 'utf-8' : 'base64',
          truncated,
          data: textual ? slice.toString('utf-8') : slice.toString('base64'),
        }, null, 2),
      }],
    };
  }
);

server.tool(
  'forge.objectstore_put',
  'Seed an Object Store object directly (test setup). Bypasses the pre-signed URL flow.',
  {
    key: z.string().describe('Object key'),
    data: z.string().describe('Object content (UTF-8 text, or base64 with isBase64: true)'),
    isBase64: z.boolean().optional().describe('Treat data as base64-encoded binary (default: false)'),
    contentType: z.string().optional().describe('Content type (default: application/octet-stream)'),
    cdn: z.boolean().optional().describe('Store in the CDN bucket instead of default'),
    ttlSeconds: z.number().optional().describe('Object TTL in seconds (default: 90 days)'),
  },
  async ({ key, data, isBase64, contentType, cdn, ttlSeconds }) => {
    const buffer = isBase64 ? Buffer.from(data, 'base64') : Buffer.from(data, 'utf-8');
    const ref = sim.objectStore.seedObject({ key, data: buffer, contentType, cdn, ttlSeconds });
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ seeded: true, ...ref }, null, 2) }],
    };
  }
);

server.tool(
  'forge.objectstore_delete',
  'Delete an Object Store object by key. Deleting an absent key succeeds (matches Forge).',
  {
    key: z.string().describe('Object key to delete'),
    cdn: z.boolean().optional().describe('Delete from the CDN bucket instead of default'),
  },
  async ({ key, cdn }) => {
    await sim.objectStore.delete(key, { cdn });
    return {
      content: [{ type: 'text' as const, text: `✅ Deleted "${key}"${cdn ? ' (cdn bucket)' : ''}` }],
    };
  }
);

server.tool(
  'forge.objectstore_create_download_url',
  'Create a pre-signed download URL for an object (valid 1 hour). Useful for fetching a blob with curl, including Range requests.',
  {
    key: z.string().describe('Object key'),
    cdn: z.boolean().optional().describe('Use the CDN bucket instead of default'),
  },
  async ({ key, cdn }) => {
    const res = await sim.objectStore.createDownloadUrl(key, { cdn });
    if (!res) {
      return {
        content: [{ type: 'text' as const, text: `Object "${key}" not found${cdn ? ' (cdn bucket)' : ''} — no URL created` }],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ key, url: res.url, expiresIn: '1h' }, null, 2) }],
    };
  }
);

server.tool(
  'forge.variables_set',
  'Set environment variables (ephemeral — never written to disk). Like real Forge (`forge variables set`), values reach process.env at the NEXT deploy — set them before calling forge.deploy. Values: plain string, or { value, encrypt } (encrypt only masks the value in list output; the app still reads cleartext, matching Forge).',
  {
    variables: z.record(
      z.string(),
      z.union([
        z.string(),
        z.object({
          value: z.string().describe('Variable value'),
          encrypt: z.boolean().optional().describe('Mask this value in list surfaces (Forge --encrypt parity)'),
        }),
      ])
    ).describe('Map of KEY → value'),
  },
  async ({ variables }) => {
    try {
      sim.setVariables(variables as Record<string, any>);
      const keys = Object.keys(variables);
      return {
        content: [{
          type: 'text' as const,
          text: `✅ Set ${keys.length} variable(s): ${keys.join(', ')}\n⚠️ Like real Forge, variables take effect at the next deploy — call forge.deploy (reset:false preserves other state) if the app is already deployed.`,
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
  'forge.variables_unset',
  'Remove an ephemeral environment variable. Takes effect at the next deploy (Forge parity).',
  {
    key: z.string().describe('Variable key to remove'),
  },
  async ({ key }) => {
    const existed = sim.unsetVariable(key);
    return {
      content: [{
        type: 'text' as const,
        text: existed
          ? `✅ Unset "${key}" — takes effect at the next deploy.`
          : `Variable "${key}" was not set (only ephemeral variables can be unset here — file vars live in .forge-sim/variables.json).`,
      }],
    };
  }
);

server.tool(
  'forge.variables_list',
  'List all environment variables from every source (host FORGE_USER_VAR_*, .forge-sim/variables.json, ephemeral). Encrypted values are masked, mirroring `forge variables list`.',
  {},
  async () => {
    const entries = sim.listVariables();
    if (entries.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No environment variables set.' }] };
    }
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(entries, null, 2) }],
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
      operator: z.enum(MCP_RANGE_OPERATORS).describe('Range condition operator'),
      value: z.any().describe('Range value (or [min, max] array for BETWEEN)'),
    }).optional().describe('Range key condition'),
    filters: z.array(z.object({
      field: z.string().describe('Attribute name to filter on'),
      operator: z.enum(MCP_FILTER_OPERATORS).describe('Filter operator'),
      value: z.any().optional().describe('Filter value (omit for EXISTS/NOT_EXISTS)'),
    })).optional().describe('Post-query filters'),
    filterOperator: z.enum(['AND', 'OR']).optional().describe('How to combine filters (default: AND)'),
    sort: z.enum(['ASC', 'DESC']).optional().describe('Sort direction on range key (default: ASC)'),
    cursor: z.string().optional().describe('Pagination cursor from previous query'),
    limit: z.number().optional().describe('Max results to return (default: 20)'),
  },
  async ({ entityName, indexName, partition, range, filters, filterOperator, sort, cursor, limit }) => {
    try {
      const body = buildEntityQueryWireBody({ entityName, indexName, partition, range, filters, filterOperator, sort, cursor, limit });

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

Repeated calls MERGE: routes accumulate across calls for the same product, as if all were passed
in one call. Re-registering the same "METHOD /path" key updates that route's response in place.
Use forge.reset to wipe all mocks.

A route value is one of:
  • A bare JSON object → returned as the response body with 200 OK (the common case).
  • A tagged response object → controls status, body, and headers explicitly. Shape:
    { "__forgeSimMockResponse": true, "status": <number>, "body"?: <any>, "headers"?: { ... } }
    (Equivalent to \`mockResponse(status, body, headers)\` in the in-process API.)

Example:
  product: "jira"
  routes: {
    "GET /rest/api/3/version/10001": { "id": "10001", "name": "1.0.0", "releaseDate": "2026-04-03" },
    "GET /rest/api/3/project/10000": { "id": "10000", "key": "PROJ", "name": "My Project" },
    "GET /rest/api/3/search": { "issues": [{ "key": "PROJ-1", "fields": { "summary": "Fix bug" } }] },
    "PUT /rest/api/3/issue/FAIL-1": { "__forgeSimMockResponse": true, "status": 500, "body": { "error": "rate limited" } },
    "GET /rest/api/3/timeout": { "__forgeSimMockResponse": true, "status": 504 }
  }

Do NOT use \`__status\` / \`_status\` as a shortcut — those will throw a clear error pointing at the
tagged shape above. Real Jira/Confluence bodies frequently include a \`status\` field (e.g. issue
status), so the marker is required to disambiguate "this is the response shape" from "this is just
data that happens to have a status field".`,
  {
    product: z.string().describe('Product name: "jira", "confluence", "bitbucket", or a remote key from manifest.yml'),
    routes: z.record(z.string(), z.any()).describe('Route map: keys are "METHOD /path" patterns, values are JSON response bodies'),
  },
  async ({ product, routes }) => {
    try {
      sim.mockProductRoutes(product, routes);
      const routeKeys = Object.keys(routes);
      const total = sim.productApi.getMockRoutes(product).length;
      const totalNote = total > routeKeys.length
        ? ` (${total} total for "${product}" — calls merge)`
        : '';
      return {
        content: [{
          type: 'text' as const,
          text: `✅ Registered ${routeKeys.length} mock route(s) for "${product}"${totalNote}:\n${routeKeys.map(k => `  • ${k}`).join('\n')}`,
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
        content: [{ type: 'text' as const, text: `✅ Queued LLM ${desc}. Pending mocks: ${sim.llm.getPendingMockCount()}` }],
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
  'forge://manifest',
  { description: 'The currently deployed Forge app manifest', mimeType: 'application/json' },
  async () => {
    const manifest = sim.getManifest();
    if (!manifest) {
      return { contents: [{ uri: 'forge://manifest', text: 'No manifest loaded. Deploy an app first.' }] };
    }
    return {
      contents: [{
        uri: 'forge://manifest',
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
  'forge://functions',
  { description: 'List of registered resolver functions', mimeType: 'application/json' },
  async () => {
    const defs = sim.resolver.getDefinitions();
    return {
      contents: [{
        uri: 'forge://functions',
        text: JSON.stringify({ resolvers: defs, count: defs.length }, null, 2),
      }],
    };
  }
);

server.resource(
  'triggers',
  'forge://triggers',
  { description: 'Registered triggers and their events', mimeType: 'application/json' },
  async () => {
    const manifest = sim.getManifest();
    if (!manifest) {
      return { contents: [{ uri: 'forge://triggers', text: 'No manifest loaded.' }] };
    }
    return {
      contents: [{
        uri: 'forge://triggers',
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
  'forge://state',
  { description: 'Full simulator state snapshot (KVS, queue, UI)', mimeType: 'application/json' },
  async () => {
    const doc = sim.ui.getForgeDoc();
    const eventLog = sim.queue.getEventLog();

    return {
      contents: [{
        uri: 'forge://state',
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

    // Loopback only — the MCP HTTP endpoint executes SQL/KVS operations with
    // no auth, so it must never accept connections from other machines.
    httpServer.listen(port, '127.0.0.1', () => {
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
