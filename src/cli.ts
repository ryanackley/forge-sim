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
    forge-sim --version        Show version
    forge-sim --help           Show this help

  Options:
    --port <port>              Vite dev server port (default: 5173)
    --ws-port <port>           WebSocket bridge port (default: 5174)
    --no-open                  Don't open browser automatically
    --module <key>             Specific UI module key to render (auto-detected if omitted)

  Examples:
    forge-sim dev              Start dev server for Forge app in current directory
    forge-sim dev ./my-app     Start dev server for Forge app in ./my-app
    forge-sim dev --port 3000  Use custom port
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
  });
} else {
  console.error(`Unknown command: ${command}`);
  console.error(`Run 'forge-sim --help' for usage.`);
  process.exit(1);
}
