#!/usr/bin/env node
/**
 * forge-sim CLI
 *
 * Usage:
 *   forge-sim dev [appDir]        Start dev server with live preview
 *   forge-sim deploy <appDir>     Deploy app to the daemon (AI/CLI mode)
 *   forge-sim invoke <fn> [json]  Invoke a resolver function
 *   forge-sim trigger <event>     Fire a product event trigger
 *   forge-sim kvs [get|set|list]  Key-Value Store operations
 *   forge-sim sql <query>         Execute a SQL query
 *   forge-sim ui                  Get current UI state
 *   forge-sim logs                Get simulator logs
 *   forge-sim status              Show daemon status
 *   forge-sim stop                Stop the daemon
 *   forge-sim reset               Reset all simulator state
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
    forge-sim trigger <event> [data] Fire a product event trigger
    forge-sim scheduled <key>        Fire a scheduled trigger by key
    forge-sim kvs list [--prefix x]  List KVS entries
    forge-sim kvs get <key>          Get a KVS value
    forge-sim kvs set <key> <json>   Set a KVS value
    forge-sim sql <query>            Execute a SQL query
    forge-sim ui                     Get current ForgeDoc UI tree
    forge-sim logs [--level x]       Get simulator logs
    forge-sim status                 Show daemon status
    forge-sim stop                   Stop the daemon
    forge-sim reset                  Reset all simulator state
    forge-sim serve [--port=N]       Start daemon in foreground
    forge-sim auth                   Add or manage Atlassian accounts (OAuth)
    forge-sim --version              Show version
    forge-sim --help                 Show this help

  Dev Options:
    --port <port>              Vite dev server port (default: 5173)
    --ws-port <port>           WebSocket bridge port (default: 5174)
    --no-open                  Don't open browser automatically
    --module <key>             Specific UI module key to render
    --clean                    Start fresh (wipe app state, keep credentials)

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
  let open = true;
  let moduleKey: string | undefined;
  let clean = false;

  for (let i = 0; i < restArgs.length; i++) {
    const arg = restArgs[i];
    if (arg === '--port' && restArgs[i + 1]) {
      port = parseInt(restArgs[++i], 10);
    } else if (arg === '--ws-port' && restArgs[i + 1]) {
      wsPort = parseInt(restArgs[++i], 10);
    } else if (arg === '--no-open') {
      open = false;
    } else if (arg === '--module' && restArgs[i + 1]) {
      moduleKey = restArgs[++i];
    } else if (arg === '--clean') {
      clean = true;
    } else if (!arg.startsWith('-')) {
      appDir = arg;
    }
  }

  const { devCommand } = await import('./dev-command.js');
  await devCommand({
    appDir: resolve(appDir),
    port,
    wsPort,
    open,
    moduleKey,
    clean,
  });
}

// ── Auth (existing) ─────────────────────────────────────────────────────

else if (command === 'auth') {
  const restArgs = args.slice(1);
  let list = false;
  let clear = false;
  let clearAll = false;
  let setup = false;
  let oauth = false;
  let remove: string | undefined;
  let local: string | undefined;

  for (let i = 0; i < restArgs.length; i++) {
    const arg = restArgs[i];
    if (arg === '--list') list = true;
    else if (arg === '--clear-all') clearAll = true;
    else if (arg === '--clear') clear = true;
    else if (arg === '--setup') setup = true;
    else if (arg === '--oauth') oauth = true;
    else if (arg === '--remove' && restArgs[i + 1]) remove = restArgs[++i];
    else if (arg === '--local') local = resolve('.');
  }

  const { authCommand } = await import('./auth/auth-command.js');
  await authCommand({ list, clear, clearAll, setup, oauth, remove, local });
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

    if (result.success) {
      console.log(`✅ Deployed${result.app?.name ? ` "${result.app.name}"` : ''}`);
      console.log(`   Functions: ${result.loadedFunctions?.join(', ') || 'none'}`);
      if (result.resolvers?.length) console.log(`   Resolvers: ${result.resolvers.map((r: any) => r.key).join(', ')}`);
      if (result.triggers?.length) console.log(`   Triggers:  ${result.triggers.map((t: any) => t.key).join(', ')}`);
      if (result.consumers?.length) console.log(`   Consumers: ${result.consumers.map((c: any) => c.key).join(', ')}`);
      if (result.uiModules?.length) console.log(`   UI:        ${result.uiModules.map((u: any) => u.key).join(', ')}`);
      if (result.errors?.length) {
        console.log(`   ⚠️  ${result.errors.length} error(s):`);
        result.errors.forEach((e: string) => console.log(`      - ${e}`));
      }
    } else {
      console.error(`❌ Deploy failed: ${result.error}`);
      process.exit(1);
    }
  } catch (err: any) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}

// ── Invoke ──────────────────────────────────────────────────────────────

else if (command === 'invoke') {
  const functionKey = args[1];
  if (!functionKey) {
    console.error('Usage: forge-sim invoke <functionKey> [payloadJSON]');
    process.exit(1);
  }

  let payload: Record<string, any> = {};
  const payloadStr = args[2];
  if (payloadStr) {
    try {
      payload = JSON.parse(payloadStr);
    } catch {
      // Check for --payload flag
      const payloadIdx = args.indexOf('--payload');
      if (payloadIdx !== -1 && args[payloadIdx + 1]) {
        payload = JSON.parse(args[payloadIdx + 1]);
      } else {
        console.error('Invalid JSON payload');
        process.exit(1);
      }
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
  const event = args[1];
  if (!event) {
    console.error('Usage: forge-sim trigger <event> [dataJSON]');
    process.exit(1);
  }

  let data: Record<string, any> = {};
  if (args[2]) {
    try { data = JSON.parse(args[2]); } catch {
      console.error('Invalid JSON data');
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
