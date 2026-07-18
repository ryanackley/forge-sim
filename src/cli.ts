#!/usr/bin/env node
/**
 * forge-sim CLI
 *
 * Usage:
 *   forge-sim dev [appDir]        Start dev server with live preview
 *   forge-sim deploy <appDir>     Deploy app to the daemon (AI/CLI mode)
 *   forge-sim invoke <fn> [json]  Invoke a resolver function
 *   forge-sim trigger <event>     Fire a product event trigger
 *   forge-sim webtrigger <key>    Fire a web trigger (simulated HTTP request)
 *   forge-sim kvs [get|set|list]  Key-Value Store operations
 *   forge-sim entity [list|get|set|delete]  Custom Entity Store operations
 *   forge-sim sql <query>         Execute a SQL query
 *   forge-sim ui                  Get current UI state
 *   forge-sim logs                Get simulator logs
 *   forge-sim status              Show daemon status
 *   forge-sim stop                Stop the daemon
 *   forge-sim reset               Reset all simulator state
 *   forge-sim mock routes <p> <j> Mock product API routes
 *   forge-sim mock graphql <j>    Mock GraphQL operations
 *   forge-sim serve               Start daemon in foreground (for debugging)
 *   forge-sim auth                Manage Atlassian accounts
 *   forge-sim --help              Show help
 *   forge-sim --version           Show version
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'node:module';

// Register our module loader hooks BEFORE any dynamic imports.
const __cliDir = dirname(fileURLToPath(import.meta.url));
const __projectRoot = resolve(__cliDir, '..');
const __hooksPath = join(__projectRoot, 'dist', 'loader', 'hooks.js');
register(pathToFileURL(__hooksPath).href);

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const command = args[0];

// ── Version ─────────────────────────────────────────────────────────────

if (command === '--version' || command === '-v') {
  const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));
  console.log(`forge-sim v${pkg.version}`);
  process.exit(0);
}

// ── Help ────────────────────────────────────────────────────────────────

if (command === '--help' || command === '-h' || !command) {
  console.log(`
  🔥 forge-sim — Local Forge app development environment

  Usage:
    forge-sim dev [appDir]           Start dev server with live UIKit/Custom UI preview
    forge-sim deploy <appDir>        Deploy a Forge app to the simulator daemon
    forge-sim invoke <fn> [payload]  Call a resolver function (payload is JSON string)
    forge-sim trigger <event> [--data json]  Fire a product event trigger
    forge-sim webtrigger <key> [opts]  Fire a web trigger (--method/--data/--header/--query/--path)
    forge-sim scheduled <key>        Fire a scheduled trigger by key
    forge-sim kvs list [--prefix x]  List KVS entries
    forge-sim kvs get <key>          Get a KVS value
    forge-sim kvs set <key> <json>   Set a KVS value
    forge-sim entity list [name]     List Custom Entity schemas + rows
    forge-sim entity get <name> <key>        Get an entity row
    forge-sim entity set <name> <key> <json> Set an entity row (schema-validated)
    forge-sim entity delete <name> <key>     Delete an entity row
    forge-sim sql <query>            Execute a SQL query
    forge-sim ui                     Get current ForgeDoc UI tree
    forge-sim logs [--level x]       Get simulator logs
    forge-sim status                 Show daemon status
    forge-sim stop                   Stop the daemon
    forge-sim reset                  Reset all simulator state
    forge-sim mock routes <p> <json> Mock product API routes (jira/confluence/bitbucket/remote)
    forge-sim mock graphql <json>    Mock GraphQL operations
    forge-sim serve [--port=N]       Start daemon in foreground
    forge-sim auth                   Add or manage Atlassian accounts (OAuth)
    forge-sim --version              Show version
    forge-sim --help                 Show this help

  Dev Options:
    --port <port>              Vite dev server port (default: 5173, auto-falls-through to next free)
    --ws-port <port>           WebSocket bridge port (default: 5174, auto-falls-through; explicit value is strict)
    --no-open                  Don't open browser automatically
    --module <key>             Specific UI module key to render
    --clean                    Start fresh (wipe app state, keep credentials)
    --strict-mode              Enable React.StrictMode (off by default — breaks Atlaskit portals)
    --proxy <url>              Proxy mode: reverse-proxy an existing dev server, inject bridge shim
    --issue <key>              Set Jira issue context (e.g., PROJ-42)
    --project <key>            Set Jira project context (e.g., PROJ)
    --content <id>             Set Confluence content context (e.g., 12345)
    --space <key>              Set Confluence space context (e.g., SPACEKEY)
    --context '{"k":"v"}'      Set raw context JSON (merged into extension)

  Auth Options:
    --list                     List configured accounts
    --clear                    Remove all accounts (keeps OAuth app config)
    --clear-all                Remove everything (accounts + OAuth app config)

  The daemon starts automatically on first command and stops after 30 min idle.
  `);
  process.exit(0);
}

// ── Dev (existing) ──────────────────────────────────────────────────────

if (command === 'dev') {
  const restArgs = args.slice(1);
  let appDir = '.';
  let port = 5173;
  let wsPort = 5174;
  let wsPortExplicit = false;
  let open = true;
  let moduleKey: string | undefined;
  let clean = false;
  let strictMode = false;
  let proxy: string | undefined;
  let issueKey: string | undefined;
  let projectKey: string | undefined;
  let contentId: string | undefined;
  let spaceKey: string | undefined;
  let rawContext: Record<string, unknown> | undefined;

  for (let i = 0; i < restArgs.length; i++) {
    const arg = restArgs[i];
    if (arg === '--port' && restArgs[i + 1]) {
      port = parseInt(restArgs[++i], 10);
    } else if (arg === '--ws-port' && restArgs[i + 1]) {
      wsPort = parseInt(restArgs[++i], 10);
      wsPortExplicit = true;
    } else if (arg === '--no-open') {
      open = false;
    } else if (arg === '--module' && restArgs[i + 1]) {
      moduleKey = restArgs[++i];
    } else if (arg === '--clean') {
      clean = true;
    } else if (arg === '--strict-mode') {
      strictMode = true;
    } else if (arg === '--proxy' && restArgs[i + 1]) {
      proxy = restArgs[++i];
    } else if (arg === '--issue' && restArgs[i + 1]) {
      issueKey = restArgs[++i];
    } else if (arg === '--project' && restArgs[i + 1]) {
      projectKey = restArgs[++i];
    } else if (arg === '--content' && restArgs[i + 1]) {
      contentId = restArgs[++i];
    } else if (arg === '--space' && restArgs[i + 1]) {
      spaceKey = restArgs[++i];
    } else if (arg === '--context' && restArgs[i + 1]) {
      try {
        rawContext = JSON.parse(restArgs[++i]);
      } catch {
        console.error('Invalid JSON for --context');
        process.exit(1);
      }
    } else if (!arg.startsWith('-')) {
      appDir = arg;
    }
  }

  // Build render context from CLI flags (if any provided)
  const hasContextFlags = issueKey || projectKey || contentId || spaceKey || rawContext;
  const renderContext = hasContextFlags
    ? { issueKey, projectKey, contentId, spaceKey, context: rawContext }
    : undefined;

  const { devCommand } = await import('./dev-command.js');
  await devCommand({
    appDir: resolve(appDir),
    port,
    wsPort,
    wsPortExplicit,
    open,
    moduleKey,
    clean,
    strictMode,
    proxy,
    renderContext,
  });
}

// ── Auth (existing) ─────────────────────────────────────────────────────

else if (command === 'auth') {
  const restArgs = args.slice(1);
  let list = false;
  let clear = false;
  let clearAll = false;
  let llm = false;
  let remove: string | undefined;
  let local: string | undefined;
  let provider: string | undefined;
  let providers = false;
  let secret = false;

  for (let i = 0; i < restArgs.length; i++) {
    const arg = restArgs[i];
    if (arg === '--list') list = true;
    else if (arg === '--clear-all') clearAll = true;
    else if (arg === '--clear') clear = true;
    else if (arg === '--llm') llm = true;
    else if (arg === '--remove' && restArgs[i + 1]) remove = restArgs[++i];
    else if (arg === '--local') local = resolve('.');
    else if (arg === '--provider' && restArgs[i + 1]) provider = restArgs[++i];
    else if (arg === '--providers') providers = true;
    else if (arg === '--secret') secret = true;
    else if (arg === '--oauth' || arg === '--setup') {
      console.error(`  ❌ \`forge-sim auth ${arg}\` was removed — Atlassian OAuth is no longer supported.`);
      console.error(`     Use \`forge-sim auth\` to add an API token instead (30-second setup).`);
      process.exit(1);
    }
  }

  const { authCommand } = await import('./auth/auth-command.js');
  await authCommand({ list, clear, clearAll, llm, remove, local, provider, providers, secret });
}

// ── Deploy ──────────────────────────────────────────────────────────────

else if (command === 'deploy') {
  const appDir = resolve(args[1] ?? '.');
  const noReset = args.includes('--no-reset');
  const { daemonRequest } = await import('./daemon-client.js');

  try {
    const result = await daemonRequest('/api/deploy', {
      method: 'POST',
      body: { appDir, reset: !noReset },
    });

    if (result.error) {
      console.error(`❌ Deploy failed: ${result.error}`);
      process.exit(1);
    }

    const errCount = result.errors?.length ?? 0;
    const typeErrCount = result.typeErrors?.length ?? 0;
    if (errCount > 0) {
      console.log(`⚠️  Deployed${result.app?.name ? ` "${result.app.name}"` : ''} with ${errCount} error(s)`);
    } else {
      console.log(`✅ Deployed${result.app?.name ? ` "${result.app.name}"` : ''}`);
    }
    console.log(`   Functions: ${result.loadedFunctions?.join(', ') || 'none'}`);
    // /api/deploy returns resolvers as a plain string[] of keys (unlike
    // triggers/consumers/uiModules which are objects) — mapping `.key`
    // here printed "Resolvers: , , ," (eval-5 bonus find).
    if (result.resolvers?.length) console.log(`   Resolvers: ${result.resolvers.map((r: any) => typeof r === 'string' ? r : r.key).join(', ')}`);
    if (result.triggers?.length) console.log(`   Triggers:  ${result.triggers.map((t: any) => t.key).join(', ')}`);
    if (result.consumers?.length) console.log(`   Consumers: ${result.consumers.map((c: any) => c.key).join(', ')}`);
    // Scheduled + web triggers were missing from the summary (eval-6 F10).
    if (result.scheduledTriggers?.length) console.log(`   Scheduled: ${result.scheduledTriggers.map((s: any) => `${s.key} (${s.interval})`).join(', ')}`);
    if (result.webTriggers?.length) console.log(`   Web:       ${result.webTriggers.map((w: any) => w.key).join(', ')}`);
    if (result.uiModules?.length) console.log(`   UI:        ${result.uiModules.map((u: any) => u.key).join(', ')}`);
    if (errCount > 0) {
      console.log(`   ❌ ${errCount} error(s):`);
      // Errors are { functionKey, error } objects — printing them raw gave
      // "[object Object]" (eval-6 bonus find during the F3/F5 pass).
      result.errors.forEach((e: any) =>
        console.log(`      - ${typeof e === 'string' ? e : `${e.functionKey}: ${e.error}`}`)
      );
    }
    if (typeErrCount > 0) {
      console.log(`   ❌ ${typeErrCount} type error(s):`);
      result.typeErrors.forEach((e: any) =>
        console.log(`      - ${e.file}:${e.line}:${e.column} ${e.code}: ${e.message}`)
      );
    }
    // Deploy errors mean the app is not fully wired — exit non-zero so
    // scripts/CI notice (eval-6 F3: real `forge deploy` fails hard too).
    if (errCount > 0 || typeErrCount > 0) process.exit(1);
  } catch (err: any) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}

// ── Invoke ──────────────────────────────────────────────────────────────

else if (command === 'invoke') {
  // Accept the payload positionally OR via --payload. Pre-fix, a bad flag
  // value hit an unwrapped JSON.parse and crashed with a raw stack trace.
  let functionKey: string | undefined;
  let payloadStr: string | undefined;
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--payload' && args[i + 1] !== undefined) {
      payloadStr = args[++i];
    } else if (!arg.startsWith('-')) {
      if (!functionKey) functionKey = arg;
      else if (payloadStr === undefined) payloadStr = arg;
    }
  }
  if (!functionKey) {
    console.error(`Usage: forge-sim invoke <functionKey> [--payload '{"json":"payload"}']`);
    process.exit(1);
  }

  let payload: Record<string, any> = {};
  if (payloadStr !== undefined) {
    try {
      payload = JSON.parse(payloadStr);
    } catch (err: any) {
      console.error(`Invalid JSON payload: ${err.message}`);
      console.error(`Received: ${payloadStr}`);
      process.exit(1);
    }
  }

  const { daemonRequest } = await import('./daemon-client.js');
  try {
    const result = await daemonRequest('/api/invoke', {
      method: 'POST',
      body: { functionKey, payload },
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}

// ── Trigger ─────────────────────────────────────────────────────────────

else if (command === 'trigger') {
  // Accept the event data positionally OR via --data. Pre-fix, data was
  // positional-only: `forge-sim trigger <event> --data '{…}'` parsed the
  // literal string "--data" as the payload and died with "Invalid JSON
  // data" without echoing what it received (eval-6 F11).
  let event: string | undefined;
  let dataStr: string | undefined;
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--data' && args[i + 1] !== undefined) {
      dataStr = args[++i];
    } else if (!arg.startsWith('-')) {
      if (!event) event = arg;
      else if (dataStr === undefined) dataStr = arg;
    }
  }
  if (!event) {
    console.error(`Usage: forge-sim trigger <event> [--data '{"json":"payload"}']`);
    process.exit(1);
  }

  let data: Record<string, any> = {};
  if (dataStr !== undefined) {
    try { data = JSON.parse(dataStr); } catch (err: any) {
      console.error(`Invalid JSON data: ${err.message}`);
      console.error(`Received: ${dataStr}`);
      process.exit(1);
    }
  }

  const { daemonRequest } = await import('./daemon-client.js');
  try {
    const result = await daemonRequest('/api/trigger', {
      method: 'POST',
      body: { event, data },
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}

// ── Web Trigger ─────────────────────────────────────────────────────────

else if (command === 'webtrigger') {
  // CLI path for firing web triggers — previously only the dev server's
  // /__trigger/<key> URL existed; the daemon 404'd, so a CLI-only user
  // could not exercise their webhook at all (eval-6 F6).
  let key: string | undefined;
  let httpMethod: string | undefined;
  let userPath: string | undefined;
  let dataStr: string | undefined;
  const headers: Record<string, string | string[]> = {};
  const queryParameters: Record<string, string | string[]> = {};

  const appendMulti = (map: Record<string, string | string[]>, name: string, value: string) => {
    const existing = map[name];
    map[name] = existing === undefined ? value : ([] as string[]).concat(existing, value);
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--method' && args[i + 1]) {
      httpMethod = args[++i].toUpperCase();
    } else if (arg === '--path' && args[i + 1]) {
      userPath = args[++i];
    } else if (arg === '--data' && args[i + 1] !== undefined) {
      dataStr = args[++i];
    } else if (arg === '--header' && args[i + 1]) {
      const raw = args[++i];
      const sep = raw.indexOf(':');
      if (sep === -1) {
        console.error(`Invalid --header "${raw}" — expected "Name: value"`);
        process.exit(1);
      }
      appendMulti(headers, raw.slice(0, sep).trim(), raw.slice(sep + 1).trim());
    } else if (arg === '--query' && args[i + 1]) {
      const raw = args[++i];
      const sep = raw.indexOf('=');
      if (sep === -1) {
        console.error(`Invalid --query "${raw}" — expected "name=value"`);
        process.exit(1);
      }
      appendMulti(queryParameters, raw.slice(0, sep), raw.slice(sep + 1));
    } else if (!arg.startsWith('-') && !key) {
      key = arg;
    }
  }

  if (!key) {
    console.error('Usage: forge-sim webtrigger <key> [options]');
    console.error(`  --method <M>           HTTP method (default: GET, or POST when --data is given)`);
    console.error(`  --data '<body>'        Request body (JSON or raw string)`);
    console.error(`  --header 'Name: value' Add a request header (repeatable)`);
    console.error(`  --query 'name=value'   Add a query parameter (repeatable)`);
    console.error(`  --path '/extra/path'   Extra path appended after the trigger URL`);
    process.exit(1);
  }

  // Body: JSON if it parses, raw string otherwise (matches the MCP tool —
  // objects are JSON.stringified downstream, strings pass through raw).
  let body: any;
  if (dataStr !== undefined) {
    try { body = JSON.parse(dataStr); } catch { body = dataStr; }
    // curl semantics: a body implies POST unless --method says otherwise.
    if (!httpMethod) httpMethod = 'POST';
  }

  const { daemonRequest } = await import('./daemon-client.js');
  try {
    const result = await daemonRequest('/api/webtrigger', {
      method: 'POST',
      body: {
        key,
        method: httpMethod,
        userPath,
        headers: Object.keys(headers).length ? headers : undefined,
        queryParameters: Object.keys(queryParameters).length ? queryParameters : undefined,
        body,
      },
    });
    console.log(JSON.stringify(result, null, 2));
    // Handler failures come back as 5xx statusCodes in the response body —
    // exit non-zero so scripts notice, same as a failed curl -f.
    if (typeof result.statusCode === 'number' && result.statusCode >= 500) process.exit(1);
  } catch (err: any) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}

// ── Scheduled Trigger ───────────────────────────────────────────────────

else if (command === 'scheduled') {
  const key = args[1];
  if (!key) {
    console.error('Usage: forge-sim scheduled <triggerKey>');
    process.exit(1);
  }

  const { daemonRequest } = await import('./daemon-client.js');
  try {
    const result = await daemonRequest('/api/scheduled-trigger', {
      method: 'POST',
      body: { key },
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}

// ── KVS ─────────────────────────────────────────────────────────────────

else if (command === 'kvs') {
  const sub = args[1] ?? 'list';
  const { daemonRequest } = await import('./daemon-client.js');

  try {
    if (sub === 'list') {
      const prefix = args.includes('--prefix') ? args[args.indexOf('--prefix') + 1] : undefined;
      const result = await daemonRequest(`/api/kvs${prefix ? `?prefix=${encodeURIComponent(prefix)}` : ''}`);
      if (Array.isArray(result)) {
        if (result.length === 0) {
          console.log('(empty)');
        } else {
          for (const entry of result) {
            console.log(`${entry.key} = ${JSON.stringify(entry.value)}`);
          }
        }
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
    } else if (sub === 'get') {
      const key = args[2];
      if (!key) { console.error('Usage: forge-sim kvs get <key>'); process.exit(1); }
      const result = await daemonRequest(`/api/kvs/${encodeURIComponent(key)}`);
      console.log(JSON.stringify(result.value, null, 2));
    } else if (sub === 'set') {
      const key = args[2];
      const value = args[3];
      if (!key || !value) { console.error('Usage: forge-sim kvs set <key> <jsonValue>'); process.exit(1); }
      await daemonRequest(`/api/kvs/${encodeURIComponent(key)}`, {
        method: 'PUT',
        body: { value: JSON.parse(value) },
      });
      console.log(`✅ Set "${key}"`);
    } else {
      console.error(`Unknown kvs subcommand: ${sub}. Use list, get, or set.`);
      process.exit(1);
    }
  } catch (err: any) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}

// ── Custom Entities (eval-9 E9-6) ───────────────────────────────────────
// Custom Entities live in their own store, not plain KVS keys — `forge-sim
// kvs list` can never show them. Mirrors the kvs command shape; writes go
// through the schema-validated entity path (ENTITY_NOT_FOUND /
// VALIDATION_ERROR surface as CLI errors, never silent local-only data).

else if (command === 'entity') {
  const sub = args[1] ?? 'list';
  const { daemonRequest } = await import('./daemon-client.js');

  try {
    if (sub === 'list') {
      const filter = args[2];
      const result = await daemonRequest('/api/entities');
      const schemas = result.schemas ?? {};
      const entities = result.entities ?? {};
      const names = filter ? [filter] : [...new Set([...Object.keys(schemas), ...Object.keys(entities)])];
      if (names.length === 0) {
        console.log('(no entities — declare them under app.storage.entities and deploy)');
      }
      for (const name of names) {
        const rows: Array<{ key: string; value: any }> = entities[name] ?? [];
        const declared = schemas[name] ? '' : ' (no schema registered)';
        console.log(`${name}${declared} — ${rows.length} row${rows.length === 1 ? '' : 's'}`);
        for (const row of rows) {
          console.log(`  ${row.key} = ${JSON.stringify(row.value)}`);
        }
      }
    } else if (sub === 'get') {
      const [, , name, key] = args;
      if (!name || !key) { console.error('Usage: forge-sim entity get <entityName> <key>'); process.exit(1); }
      const result = await daemonRequest(`/api/entities/${encodeURIComponent(name)}/${encodeURIComponent(key)}`);
      console.log(JSON.stringify(result.value, null, 2));
    } else if (sub === 'set') {
      const [, , name, key, value] = args;
      if (!name || !key || !value) { console.error('Usage: forge-sim entity set <entityName> <key> <jsonValue>'); process.exit(1); }
      await daemonRequest(`/api/entities/${encodeURIComponent(name)}/${encodeURIComponent(key)}`, {
        method: 'PUT',
        body: { value: JSON.parse(value) },
      });
      console.log(`✅ Set ${name}/"${key}"`);
    } else if (sub === 'delete') {
      const [, , name, key] = args;
      if (!name || !key) { console.error('Usage: forge-sim entity delete <entityName> <key>'); process.exit(1); }
      await daemonRequest(`/api/entities/${encodeURIComponent(name)}/${encodeURIComponent(key)}`, { method: 'DELETE' });
      console.log(`✅ Deleted ${name}/"${key}"`);
    } else {
      console.error(`Unknown entity subcommand: ${sub}. Use list, get, set, or delete.`);
      process.exit(1);
    }
  } catch (err: any) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}

// ── SQL ─────────────────────────────────────────────────────────────────

else if (command === 'sql') {
  const query = args.slice(1).join(' ');
  if (!query) {
    console.error('Usage: forge-sim sql <query>');
    process.exit(1);
  }

  const { daemonRequest } = await import('./daemon-client.js');
  try {
    const result = await daemonRequest('/api/sql/query', {
      method: 'POST',
      body: { query },
      timeout: 30_000,
    });
    if (result.rows && result.rows.length > 0) {
      console.table(result.rows);
    } else {
      console.log(result.rowCount !== undefined ? `${result.rowCount} rows affected` : JSON.stringify(result, null, 2));
    }
  } catch (err: any) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}

// ── Render ──────────────────────────────────────────────────────────────

else if (command === 'render') {
  const moduleKey = args[1];
  if (!moduleKey) {
    console.error('Usage: forge-sim render <moduleKey> [options]');
    console.error('  --issue PROJ-42        Set Jira issue context');
    console.error('  --content 12345        Set Confluence content context');
    console.error('  --space SPACEKEY       Set Confluence space context');
    console.error('  --context \'{"k":"v"}\'   Set raw context JSON');
    process.exit(1);
  }

  const renderOpts: Record<string, any> = {};

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--issue' && args[i + 1]) {
      renderOpts.issueKey = args[++i];
    } else if (arg === '--content' && args[i + 1]) {
      renderOpts.contentId = args[++i];
    } else if (arg === '--space' && args[i + 1]) {
      renderOpts.spaceKey = args[++i];
    } else if (arg === '--context' && args[i + 1]) {
      try {
        renderOpts.context = JSON.parse(args[++i]);
      } catch {
        console.error('Invalid JSON for --context');
        process.exit(1);
      }
    }
  }

  const { daemonRequest } = await import('./daemon-client.js');
  try {
    const result = await daemonRequest('/api/ui/render', {
      method: 'POST',
      body: { moduleKey, ...renderOpts },
      timeout: 30_000,
    });

    if (result.rendered) {
      console.log(result.tree);
      if (result.context?.extension) {
        console.log('');
        console.log('Context:');
        console.log(`  Module:  ${result.context.moduleKey}`);
        console.log(`  Account: ${result.context.accountId}`);
        if (result.context.extension.issueKey) {
          console.log(`  Issue:   ${result.context.extension.issueKey}`);
        }
        if (result.context.extension.projectKey) {
          console.log(`  Project: ${result.context.extension.projectKey}`);
        }
        if (result.context.extension.contentId) {
          console.log(`  Content: ${result.context.extension.contentId}`);
        }
        if (result.context.extension.spaceKey) {
          console.log(`  Space:   ${result.context.extension.spaceKey}`);
        }
      }
    } else {
      console.log(result.message ?? 'No UI rendered.');
    }
  } catch (err: any) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}

// ── UI State ────────────────────────────────────────────────────────────

else if (command === 'ui') {
  const { daemonRequest } = await import('./daemon-client.js');
  try {
    const result = await daemonRequest('/api/ui/state');
    if (result.rendered) {
      console.log(result.tree);
    } else {
      console.log(result.message ?? 'No UI rendered.');
    }
  } catch (err: any) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}

// ── Logs ────────────────────────────────────────────────────────────────

else if (command === 'logs') {
  const { daemonRequest } = await import('./daemon-client.js');
  try {
    const logs = await daemonRequest('/api/logs');
    if (Array.isArray(logs) && logs.length === 0) {
      console.log('(no logs)');
    } else if (Array.isArray(logs)) {
      for (const entry of logs) {
        const time = new Date(entry.timestamp).toLocaleTimeString();
        const data = entry.data !== undefined ? ` ${JSON.stringify(entry.data)}` : '';
        console.log(`[${time}] ${entry.level}: ${entry.message}${data}`);
      }
    } else {
      console.log(JSON.stringify(logs, null, 2));
    }
  } catch (err: any) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}

// ── Status ──────────────────────────────────────────────────────────────

else if (command === 'status') {
  const { getDaemonStatus } = await import('./daemon-client.js');
  const status = await getDaemonStatus();

  if (!status) {
    console.log('Daemon: not running');
    process.exit(0);
  }

  if (!status.running) {
    console.log(`Daemon: stale PID file (PID ${status.pid} is dead)`);
    process.exit(1);
  }

  // Get detailed status from the daemon
  try {
    const res = await fetch(`http://127.0.0.1:${status.port}/`);
    const info = await res.json() as any;
    console.log(`Daemon: running`);
    console.log(`  PID:     ${info.pid}`);
    console.log(`  Port:    ${status.port}`);
    console.log(`  Uptime:  ${Math.round(info.uptime)}s`);
    console.log(`  Idle:    ${info.idleSeconds}s (timeout: ${info.idleTimeoutMinutes}m)`);
    console.log(`  App:     ${info.deployed ? info.appName ?? '(deployed, unnamed)' : '(none)'}`);
  } catch {
    console.log(`Daemon: running (PID ${status.pid}, port ${status.port})`);
  }
}

// ── Stop ────────────────────────────────────────────────────────────────

else if (command === 'stop') {
  const { stopDaemon, getDaemonStatus } = await import('./daemon-client.js');
  const status = await getDaemonStatus();

  if (!status?.running) {
    console.log('Daemon is not running.');
    process.exit(0);
  }

  const stopped = await stopDaemon();
  console.log(stopped ? `✅ Stopped daemon (PID ${status.pid})` : '❌ Failed to stop daemon');
}

// ── Reset ───────────────────────────────────────────────────────────────

else if (command === 'reset') {
  const { daemonRequest } = await import('./daemon-client.js');
  try {
    const result = await daemonRequest('/api/reset', { method: 'POST' });
    console.log(`✅ ${result.message}`);
  } catch (err: any) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}

// ── Mock Routes ─────────────────────────────────────────────────────────

else if (command === 'mock') {
  const subCommand = args[1]; // 'routes' or 'graphql'
  const { daemonRequest } = await import('./daemon-client.js');

  if (subCommand === 'routes') {
    // forge-sim mock routes <product> <routesJSON>
    const product = args[2];
    const routesJson = args[3];
    if (!product || !routesJson) {
      console.error('Usage: forge-sim mock routes <product> <routesJSON>');
      console.error('  product: jira, confluence, bitbucket, or a remote key');
      console.error('  routesJSON: JSON object mapping "METHOD /path" to response bodies');
      console.error('');
      console.error('Example:');
      console.error(`  forge-sim mock routes jira '{"GET /rest/api/3/version/10001": {"id":"10001","name":"1.0.0"}}'`);
      process.exit(1);
    }
    try {
      const routes = JSON.parse(routesJson);
      const result = await daemonRequest('/api/mock/routes', {
        method: 'POST',
        body: { product, routes },
      });
      console.log(`✅ Registered ${result.routeCount} mock route(s) for "${product}"`);
      for (const key of Object.keys(routes)) {
        console.log(`   • ${key}`);
      }
    } catch (err: any) {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    }
  } else if (subCommand === 'graphql') {
    // forge-sim mock graphql <operationsJSON>
    const opsJson = args[2];
    if (!opsJson) {
      console.error('Usage: forge-sim mock graphql <operationsJSON>');
      console.error('  operationsJSON: JSON object mapping operation names to response bodies');
      console.error('');
      console.error('Example:');
      console.error(`  forge-sim mock graphql '{"GetIssue": {"data":{"issue":{"key":"TEST-1"}}}}'`);
      process.exit(1);
    }
    try {
      const operations = JSON.parse(opsJson);
      const result = await daemonRequest('/api/mock/graphql', {
        method: 'POST',
        body: { operations },
      });
      console.log(`✅ Registered ${result.operationCount} GraphQL mock(s)`);
      for (const key of Object.keys(operations)) {
        console.log(`   • ${key}`);
      }
    } catch (err: any) {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    }
  } else {
    console.error('Usage: forge-sim mock <routes|graphql> ...');
    console.error('  forge-sim mock routes <product> <routesJSON>');
    console.error('  forge-sim mock graphql <operationsJSON>');
    process.exit(1);
  }
}

// ── Serve (foreground daemon, for debugging) ────────────────────────────

else if (command === 'serve') {
  // This just runs the daemon in the foreground instead of detached
  await import('./daemon.js');
}

// ── Unknown ─────────────────────────────────────────────────────────────

else {
  console.error(`Unknown command: ${command}`);
  console.error(`Run 'forge-sim --help' for usage.`);
  process.exit(1);
}
