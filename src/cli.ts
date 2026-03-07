#!/usr/bin/env node
/**
 * forge-sim CLI
 *
 * Usage:
 *   forge-sim dev [appDir]     Start dev server with live preview
 *   forge-sim --help           Show help
 *   forge-sim --version        Show version
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'node:module';

// Register our module loader hooks BEFORE any dynamic imports.
// This intercepts @forge/* imports and redirects to our shims,
// so resolver/handler files can import @forge/events, @forge/api, etc.
//
// IMPORTANT: register() loads the hooks in a separate loader worker thread
// that does NOT have tsx's .ts resolution. We must always point to the
// compiled dist/loader/hooks.js, even when cli.ts itself runs from source.
const __cliDir = dirname(fileURLToPath(import.meta.url));
const __projectRoot = resolve(__cliDir, '..');
const __hooksPath = join(__projectRoot, 'dist', 'loader', 'hooks.js');
register(pathToFileURL(__hooksPath).href);

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const command = args[0];

if (command === '--version' || command === '-v') {
  const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));
  console.log(`forge-sim v${pkg.version}`);
  process.exit(0);
}

if (command === '--help' || command === '-h' || !command) {
  console.log(`
  🔥 forge-sim — Local Forge app development environment

  Usage:
    forge-sim dev [appDir]     Start dev server with live UIKit/Custom UI preview
    forge-sim auth             Add or manage Atlassian accounts (OAuth)
    forge-sim --version        Show version
    forge-sim --help           Show this help

  Dev Options:
    --port <port>              Vite dev server port (default: 5173)
    --ws-port <port>           WebSocket bridge port (default: 5174)
    --no-open                  Don't open browser automatically
    --module <key>             Specific UI module key to render (auto-detected if omitted)
    --clean                    Start fresh (wipe app state, keep credentials)

  Auth Options:
    --list                     List configured accounts
    --clear                    Remove all accounts (keeps OAuth app config)
    --clear-all                Remove everything (accounts + OAuth app config)
    --remove <id>              Remove a specific account
    --oauth                    Add account via OAuth (multi-user testing)
    --setup                    Configure OAuth app (client ID/secret)
    --local                    Store credentials per-app instead of global

  Examples:
    forge-sim dev              Start dev server for Forge app in current directory
    forge-sim dev ./my-app     Start dev server for Forge app in ./my-app
    forge-sim dev --clean      Reset app state but keep credentials
    forge-sim auth             Add Atlassian account via OAuth
    forge-sim auth --list      Show configured accounts
  `);
  process.exit(0);
}

if (command === 'dev') {
  // Parse options
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
} else if (command === 'auth') {
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
} else {
  console.error(`Unknown command: ${command}`);
  console.error(`Run 'forge-sim --help' for usage.`);
  process.exit(1);
}
