/**
 * Forge Sim Tools — HTTP + WebSocket server.
 *
 * Provides a browser-based dev tools UI for inspecting and controlling
 * the forge-sim environment. Like Chrome DevTools for your Forge app.
 *
 * Ports:
 *   :5173  Vite (app preview)
 *   :5174  WebSocket (bridge RPC)
 *   :5175  Forge Sim Tools (this server)
 */

import { type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ViteDevServer } from 'vite';
import type { ForgeSimulator } from '../simulator.js';
import type { ParsedManifest } from '../manifest.js';
import { createApiHandler } from './api.js';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

export interface ToolsServerOptions {
  /** Forge simulator instance */
  sim: ForgeSimulator;
  /** Parsed manifest */
  manifest: ParsedManifest;
  /** Vite dev server to attach middleware to */
  viteServer: ViteDevServer;
  /** App directory path */
  appDir?: string;
}

export interface ToolsServer {
  /** Broadcast a log entry to all connected clients */
  broadcastLog(entry: any): void;
  /** Broadcast a state change event */
  broadcastStateChange(type: string, data?: any): void;
  /** Broadcast TypeScript errors to all connected clients */
  broadcastTypeErrors(errors: any[], critical: any[], checking: boolean): void;
  /** Number of connected WebSocket clients */
  readonly clientCount: number;
  /** Close the server */
  close(): void;
}

/**
 * Attach Forge Sim Tools as middleware on the Vite dev server.
 * Routes under /__tools/ are handled by the tools UI and API.
 * WebSocket connections to /__tools/ws get upgraded to the tools WS.
 */
export function attachToolsToVite(options: ToolsServerOptions): ToolsServer {
  const { sim, manifest, viteServer, appDir } = options;
  const apiHandler = createApiHandler(sim, manifest);
  const clients = new Set<WebSocket>();
  let lastTypeErrors: { errors: any[]; critical: any[]; checking: boolean } | null = null;
  const serverSessionId = Math.random().toString(36).slice(2);

  const PREFIX = '/__tools';

  // ── Vite middleware for HTTP routes ───────────────────────────────────
  // Use unshift-like behavior: prepend to Vite's middleware stack
  // so our routes are checked BEFORE Vite's catch-all transforms.

  const toolsMiddleware = (req: any, res: any, next: any) => {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (!url.pathname.startsWith(PREFIX)) {
      return next();
    }

    // Strip prefix for internal routing
    const toolsPath = url.pathname.slice(PREFIX.length) || '/';

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // API routes
    if (toolsPath.startsWith('/api/')) {
      const apiUrl = new URL(toolsPath + url.search, 'http://localhost');
      apiHandler(req, res, apiUrl).catch((err: any) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });
      return;
    }

    // Serve the tools UI
    res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' });
    res.end(generateFallbackHTML(PREFIX));
  };

  // Prepend our middleware before Vite's by inserting at the front of the stack
  // viteServer.middlewares is a connect() instance — its .stack is an array
  const stack = (viteServer.middlewares as any).stack;
  if (Array.isArray(stack)) {
    stack.unshift({ route: '', handle: toolsMiddleware });
  } else {
    // Fallback: just use() it (will be after Vite's middleware)
    viteServer.middlewares.use(toolsMiddleware);
  }

  // ── WebSocket server (piggybacks on Vite's HTTP server) ──────────────

  const wss = new WebSocketServer({ noServer: true });

  // Hook into Vite's underlying HTTP server for WebSocket upgrades
  const httpServer = viteServer.httpServer;
  if (httpServer) {
    httpServer.on('upgrade', (request: any, socket: any, head: any) => {
      const url = new URL(request.url ?? '/', 'http://localhost');
      if (url.pathname === `${PREFIX}/ws`) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
      // Don't destroy — let Vite's HMR WebSocket handle its own upgrades
    });
  }

  wss.on('connection', (ws) => {
    clients.add(ws);

    ws.on('close', () => clients.delete(ws));
    ws.on('error', () => clients.delete(ws));

    // Send initial state snapshot
    ws.send(JSON.stringify({
      type: 'init',
      data: {
        sessionId: serverSessionId,
        manifest: {
          appName: manifest.raw.app?.name ?? 'Unknown',
          functions: manifest.functions.size,
          uiModules: manifest.uiModules.length,
          consumers: manifest.consumers.length,
          triggers: manifest.triggers.length,
          scheduledTriggers: manifest.scheduledTriggers.length,
        },
        functionCount: sim.functions.keys().length,
      },
    }));

    // Send cached type checker state if available
    if (lastTypeErrors) {
      ws.send(JSON.stringify({ type: 'typeErrors', data: lastTypeErrors }));
    }
  });

  function broadcast(message: any): void {
    const msg = JSON.stringify(message);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  return {
    broadcastLog(entry: any) {
      broadcast({ type: 'log', data: entry });
    },
    broadcastStateChange(type: string, data?: any) {
      broadcast({ type: 'stateChange', changeType: type, data });
    },
    broadcastTypeErrors(errors: any[], critical: any[], checking: boolean) {
      lastTypeErrors = { errors, critical, checking };
      broadcast({ type: 'typeErrors', data: lastTypeErrors });
    },
    get clientCount() { return clients.size; },
    close() {
      for (const client of clients) client.close();
      wss.close();
    },
  };
}

// ── Fallback UI ──────────────────────────────────────────────────────────

function generateFallbackHTML(prefix: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Forge Sim Tools</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #1e1e2e; --surface: #282838; --surface2: #313244;
    --text: #cdd6f4; --subtext: #a6adc8; --blue: #89b4fa;
    --green: #a6e3a1; --red: #f38ba8; --yellow: #f9e2af;
    --purple: #cba6f7; --border: #45475a; --font: 'SF Mono', 'Fira Code', monospace;
  }
  body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; height: 100vh; display: flex; flex-direction: column; }
  
  /* Header */
  .header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 8px 16px; display: flex; align-items: center; gap: 12px; }
  .header h1 { font-size: 14px; font-weight: 600; }
  .header .status { font-size: 12px; color: var(--subtext); }
  .header .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); display: inline-block; }
  
  /* Tabs */
  .tabs { background: var(--surface); border-bottom: 1px solid var(--border); display: flex; gap: 0; }
  .tab { padding: 8px 16px; font-size: 13px; cursor: pointer; border-bottom: 2px solid transparent; color: var(--subtext); transition: all 0.15s; }
  .tab:hover { color: var(--text); background: var(--surface2); }
  .tab.active { color: var(--blue); border-bottom-color: var(--blue); }
  
  /* Content */
  .content { flex: 1; overflow: auto; }
  .panel { display: none; height: 100%; }
  .panel.active { display: flex; flex-direction: column; }
  
  /* KVS Panel */
  .kvs-toolbar { padding: 8px 16px; background: var(--surface); border-bottom: 1px solid var(--border); display: flex; gap: 8px; align-items: center; }
  .kvs-toolbar input { background: var(--surface2); border: 1px solid var(--border); border-radius: 4px; padding: 6px 10px; color: var(--text); font-size: 13px; flex: 1; outline: none; }
  .kvs-toolbar input:focus { border-color: var(--blue); }
  .kvs-table { flex: 1; overflow: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: var(--surface); position: sticky; top: 0; text-align: left; padding: 8px 16px; font-weight: 600; color: var(--subtext); border-bottom: 1px solid var(--border); }
  td { padding: 8px 16px; border-bottom: 1px solid var(--border); font-family: var(--font); font-size: 12px; max-width: 500px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  tr:hover td { background: var(--surface2); }
  td.key { color: var(--blue); }
  td.type { color: var(--purple); font-size: 11px; }
  
  /* SQL Panel */
  .sql-layout { display: flex; flex: 1; overflow: hidden; }
  .sql-sidebar { width: 200px; background: var(--surface); border-right: 1px solid var(--border); overflow-y: auto; padding: 8px 0; }
  .sql-sidebar .table-item { padding: 6px 16px; font-size: 13px; cursor: pointer; color: var(--subtext); }
  .sql-sidebar .table-item:hover { background: var(--surface2); color: var(--text); }
  .sql-sidebar .table-item.active { color: var(--blue); background: var(--surface2); }
  .sql-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .sql-editor { padding: 8px 16px; background: var(--surface); border-bottom: 1px solid var(--border); display: flex; gap: 8px; }
  .sql-editor textarea { flex: 1; background: var(--surface2); border: 1px solid var(--border); border-radius: 4px; padding: 8px; color: var(--text); font-family: var(--font); font-size: 13px; resize: vertical; min-height: 60px; outline: none; }
  .sql-editor textarea:focus { border-color: var(--blue); }
  .sql-results { flex: 1; overflow: auto; }
  
  /* Logs Panel */
  .logs-toolbar { padding: 8px 16px; background: var(--surface); border-bottom: 1px solid var(--border); display: flex; gap: 8px; align-items: center; font-size: 13px; }
  .logs-toolbar label { color: var(--subtext); cursor: pointer; display: flex; align-items: center; gap: 4px; }
  .logs-toolbar input[type="checkbox"] { accent-color: var(--blue); }
  .log-list { flex: 1; overflow-y: auto; font-family: var(--font); font-size: 12px; padding: 0; }
  .log-entry { padding: 3px 16px; border-bottom: 1px solid var(--border); display: flex; gap: 12px; }
  .log-entry:hover { background: var(--surface2); }
  .log-time { color: var(--subtext); min-width: 80px; }
  .log-level { min-width: 70px; font-weight: 600; }
  .log-level.error { color: var(--red); }
  .log-level.warn { color: var(--yellow); }
  .log-level.invoke { color: var(--blue); }
  .log-level.trigger { color: var(--purple); }
  .log-level.info { color: var(--green); }
  .log-msg { flex: 1; white-space: pre-wrap; word-break: break-all; }
  
  /* Events Panel */
  .events-layout { padding: 16px; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; flex: 1; }
  .events-section { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
  .events-section h3 { font-size: 14px; margin-bottom: 12px; color: var(--subtext); }
  select, .btn { background: var(--surface2); border: 1px solid var(--border); border-radius: 4px; padding: 6px 12px; color: var(--text); font-size: 13px; cursor: pointer; outline: none; }
  select:focus, .btn:hover { border-color: var(--blue); }
  .btn-primary { background: var(--blue); color: var(--bg); border: none; font-weight: 600; }
  .btn-primary:hover { opacity: 0.9; }
  textarea.payload { width: 100%; background: var(--surface2); border: 1px solid var(--border); border-radius: 4px; padding: 8px; color: var(--text); font-family: var(--font); font-size: 12px; min-height: 80px; margin: 8px 0; outline: none; resize: vertical; }
  .result-box { background: var(--bg); border: 1px solid var(--border); border-radius: 4px; padding: 8px; font-family: var(--font); font-size: 12px; max-height: 200px; overflow: auto; white-space: pre-wrap; margin-top: 8px; }
  
  /* TypeScript Panel */
  .ts-toolbar { padding: 8px 16px; background: var(--surface); border-bottom: 1px solid var(--border); display: flex; gap: 12px; align-items: center; font-size: 13px; }
  .ts-status { font-weight: 600; }
  .ts-status.ok { color: var(--green); }
  .ts-status.error { color: var(--red); }
  .ts-status.checking { color: var(--yellow); }
  .ts-list { flex: 1; overflow-y: auto; font-family: var(--font); font-size: 12px; }
  .ts-error { padding: 6px 16px; border-bottom: 1px solid var(--border); cursor: pointer; }
  .ts-error:hover { background: var(--surface2); }
  .ts-error .ts-file { color: var(--blue); }
  .ts-error .ts-code { color: var(--purple); font-size: 11px; margin-left: 8px; }
  .ts-error .ts-msg { color: var(--text); margin-top: 2px; }
  .ts-error.critical { border-left: 3px solid var(--red); }
  .ts-error.non-critical { border-left: 3px solid var(--yellow); opacity: 0.7; }
  .ts-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; border-radius: 9px; font-size: 11px; font-weight: 700; padding: 0 5px; margin-left: 6px; }
  .ts-badge.error { background: var(--red); color: var(--bg); }
  .ts-badge.ok { background: var(--green); color: var(--bg); }

  /* Buttons */
  .btn-sm { padding: 4px 8px; font-size: 12px; }
  .empty { color: var(--subtext); text-align: center; padding: 40px; font-size: 14px; }
</style>
</head>
<body>

<div class="header">
  <span class="dot"></span>
  <h1>🔧 Forge Sim Tools</h1>
  <span class="status" id="status">connecting...</span>
</div>

<div class="tabs">
  <div class="tab active" data-panel="logs">Logs</div>
  <div class="tab" data-panel="kvs">KVS</div>
  <div class="tab" data-panel="sql">SQL</div>
  <div class="tab" data-panel="events">Events</div>
  <div class="tab" data-panel="typescript" id="tsTab">TypeScript</div>
</div>

<div class="content">
  <!-- Logs Panel -->
  <div class="panel active" id="panel-logs">
    <div class="logs-toolbar">
      <label><input type="checkbox" checked data-level="info"> info</label>
      <label><input type="checkbox" checked data-level="invoke"> invoke</label>
      <label><input type="checkbox" checked data-level="trigger"> trigger</label>
      <label><input type="checkbox" checked data-level="warn"> warn</label>
      <label><input type="checkbox" checked data-level="error"> error</label>
      <label><input type="checkbox" checked data-level="console.log"> console</label>
      <div style="flex:1"></div>
      <button class="btn btn-sm" onclick="clearLogs()">Clear</button>
      <button class="btn btn-sm" id="pauseBtn" onclick="togglePause()">⏸ Pause</button>
    </div>
    <div class="log-list" id="logList"></div>
  </div>

  <!-- KVS Panel -->
  <div class="panel" id="panel-kvs">
    <div class="kvs-toolbar">
      <input type="text" id="kvsSearch" placeholder="Search keys..." oninput="filterKVS()">
      <button class="btn btn-sm" onclick="refreshKVS()">↻ Refresh</button>
    </div>
    <div class="kvs-table">
      <table>
        <thead><tr><th>Key</th><th>Value</th><th>Type</th></tr></thead>
        <tbody id="kvsBody"></tbody>
      </table>
    </div>
  </div>

  <!-- SQL Panel -->
  <div class="panel" id="panel-sql">
    <div class="sql-layout">
      <div class="sql-sidebar" id="sqlSidebar"></div>
      <div class="sql-main">
        <div class="sql-editor">
          <textarea id="sqlQuery" placeholder="SELECT * FROM ..."></textarea>
          <button class="btn btn-primary" onclick="runSQL()" style="align-self:flex-end">▶ Run</button>
        </div>
        <div class="sql-results">
          <table>
            <thead id="sqlHead"></thead>
            <tbody id="sqlBody"></tbody>
          </table>
          <div class="empty" id="sqlEmpty">Run a query or click a table</div>
        </div>
      </div>
    </div>
  </div>

  <!-- TypeScript Panel -->
  <div class="panel" id="panel-typescript">
    <div class="ts-toolbar">
      <span class="ts-status" id="tsStatus">⏳ Waiting for first check...</span>
      <div style="flex:1"></div>
      <label><input type="checkbox" id="tsShowAll"> Show all errors</label>
    </div>
    <div class="ts-list" id="tsList">
      <div class="empty">Type checker initializing...</div>
    </div>
  </div>

  <!-- Events Panel -->
  <div class="panel" id="panel-events">
    <div class="events-layout">
      <div class="events-section">
        <h3>🎯 Fire Trigger</h3>
        <select id="triggerSelect"></select>
        <textarea class="payload" id="triggerPayload">{\n  \n}</textarea>
        <button class="btn btn-primary" onclick="fireTrigger()">Fire Trigger</button>
        <div class="result-box" id="triggerResult" style="display:none"></div>
      </div>
      <div class="events-section">
        <h3>⏰ Scheduled Triggers</h3>
        <div id="scheduledList"></div>
      </div>
      <div class="events-section">
        <h3>📨 Push to Queue</h3>
        <select id="queueSelect"></select>
        <textarea class="payload" id="queuePayload">{\n  "body": {}\n}</textarea>
        <button class="btn btn-primary" onclick="pushQueue()">Push Event</button>
        <div class="result-box" id="queueResult" style="display:none"></div>
      </div>
    </div>
  </div>
</div>

<script>
const API = '${prefix}';
const WS_URL = location.origin.replace('http','ws') + '${prefix}/ws';
let ws;
let paused = false;
let serverSessionId = null;
let logs = [];
let kvsData = [];
let enabledLevels = new Set(['info','invoke','trigger','warn','error','console.log','console.warn','console.error','scheduledTrigger']);

// ── WebSocket ──────────────────────────────────────────────────────

function connect() {
  ws = new WebSocket(WS_URL);
  ws.onopen = () => {
    document.getElementById('status').textContent = 'connected';
    document.querySelector('.dot').style.background = 'var(--green)';
  };
  ws.onclose = () => {
    document.getElementById('status').textContent = 'disconnected';
    document.querySelector('.dot').style.background = 'var(--red)';
    setTimeout(connect, 2000);
  };
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'log') addLog(msg.data);
    if (msg.type === 'stateChange') handleStateChange(msg);
    if (msg.type === 'init') updateStatus(msg.data);
    if (msg.type === 'typeErrors') updateTypeErrors(msg.data);
  };
}

function updateStatus(data) {
  // Detect server restart — reload if session changed
  if (data.sessionId) {
    if (serverSessionId && serverSessionId !== data.sessionId) {
      console.log('[forge-sim tools] Server restarted, reloading...');
      location.reload();
      return;
    }
    serverSessionId = data.sessionId;
  }

  const m = data.manifest;
  document.getElementById('status').textContent =
    m.appName + ' • ' + m.functions + ' functions • ' + data.functionCount + ' registered';
}

// ── Tabs ───────────────────────────────────────────────────────────

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.panel).classList.add('active');
    // Auto-refresh on tab switch
    if (tab.dataset.panel === 'kvs') refreshKVS();
    if (tab.dataset.panel === 'sql') refreshTables();
    if (tab.dataset.panel === 'events') refreshEvents();
  });
});

// ── Logs ───────────────────────────────────────────────────────────

document.querySelectorAll('.logs-toolbar input[type="checkbox"]').forEach(cb => {
  cb.addEventListener('change', () => {
    if (cb.checked) enabledLevels.add(cb.dataset.level);
    else enabledLevels.delete(cb.dataset.level);
    renderLogs();
  });
});

function addLog(entry) {
  logs.push(entry);
  if (logs.length > 5000) logs = logs.slice(-4000);
  if (!paused) renderLogs();
}

function renderLogs() {
  const list = document.getElementById('logList');
  const filtered = logs.filter(l => enabledLevels.has(l.level));
  const html = filtered.slice(-500).map(l => {
    const time = new Date(l.timestamp).toLocaleTimeString();
    const levelClass = l.level.includes('error') ? 'error' : l.level.includes('warn') ? 'warn' : l.level === 'invoke' ? 'invoke' : l.level.includes('trigger') ? 'trigger' : 'info';
    const data = l.data !== undefined ? ' ' + JSON.stringify(l.data) : '';
    return '<div class="log-entry"><span class="log-time">' + time + '</span><span class="log-level ' + levelClass + '">' + l.level + '</span><span class="log-msg">' + escapeHtml(l.message + data) + '</span></div>';
  }).join('');
  list.innerHTML = html;
  list.scrollTop = list.scrollHeight;
}

function clearLogs() { logs = []; renderLogs(); }
function togglePause() {
  paused = !paused;
  document.getElementById('pauseBtn').textContent = paused ? '▶ Resume' : '⏸ Pause';
  if (!paused) renderLogs();
}

// ── KVS ────────────────────────────────────────────────────────────

async function refreshKVS() {
  const res = await fetch(API + '/api/kvs');
  kvsData = await res.json();
  filterKVS();
}

function filterKVS() {
  const search = document.getElementById('kvsSearch').value.toLowerCase();
  const filtered = kvsData.filter(e => e.key.toLowerCase().includes(search));
  const body = document.getElementById('kvsBody');
  body.innerHTML = filtered.map(e => {
    const val = JSON.stringify(e.value);
    const type = Array.isArray(e.value) ? 'array' : typeof e.value;
    return '<tr><td class="key">' + escapeHtml(e.key) + '</td><td title="' + escapeHtml(val) + '">' + escapeHtml(val.substring(0, 200)) + '</td><td class="type">' + type + '</td></tr>';
  }).join('');
  if (filtered.length === 0) body.innerHTML = '<tr><td colspan="3" class="empty">No keys found</td></tr>';
}

// ── SQL ────────────────────────────────────────────────────────────

async function refreshTables() {
  try {
    const res = await fetch(API + '/api/sql/tables');
    const data = await res.json();
    if (data.error) { document.getElementById('sqlSidebar').innerHTML = '<div class="empty" style="padding:16px;font-size:12px">' + escapeHtml(data.error) + '</div>'; return; }
    document.getElementById('sqlSidebar').innerHTML = data.tables.map(t =>
      '<div class="table-item" onclick="queryTable(\\'' + t + '\\')">' + t + '</div>'
    ).join('');
  } catch(e) {
    document.getElementById('sqlSidebar').innerHTML = '<div class="empty" style="padding:16px;font-size:12px">SQL not available</div>';
  }
}

function queryTable(name) {
  document.getElementById('sqlQuery').value = 'SELECT * FROM ' + name + ' LIMIT 100';
  document.querySelectorAll('.table-item').forEach(el => el.classList.toggle('active', el.textContent === name));
  runSQL();
}

async function runSQL() {
  const query = document.getElementById('sqlQuery').value.trim();
  if (!query) return;
  try {
    const res = await fetch(API + '/api/sql/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    if (data.error) { showSQLError(data.error); return; }
    renderSQLResults(data.rows);
  } catch(e) { showSQLError(e.message); }
}

function renderSQLResults(rows) {
  document.getElementById('sqlEmpty').style.display = 'none';
  if (!rows || rows.length === 0) {
    document.getElementById('sqlHead').innerHTML = '';
    document.getElementById('sqlBody').innerHTML = '<tr><td class="empty">No results</td></tr>';
    return;
  }
  const cols = Object.keys(rows[0]);
  document.getElementById('sqlHead').innerHTML = '<tr>' + cols.map(c => '<th>' + escapeHtml(c) + '</th>').join('') + '</tr>';
  document.getElementById('sqlBody').innerHTML = rows.slice(0, 200).map(r =>
    '<tr>' + cols.map(c => '<td>' + escapeHtml(String(r[c] ?? 'NULL')) + '</td>').join('') + '</tr>'
  ).join('');
}

function showSQLError(msg) {
  document.getElementById('sqlEmpty').style.display = 'none';
  document.getElementById('sqlHead').innerHTML = '';
  document.getElementById('sqlBody').innerHTML = '<tr><td style="color:var(--red);padding:16px">' + escapeHtml(msg) + '</td></tr>';
}

// Handle Ctrl+Enter in SQL editor
document.getElementById('sqlQuery')?.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runSQL(); }
});

// ── Events ─────────────────────────────────────────────────────────

async function refreshEvents() {
  const res = await fetch(API + '/api/manifest');
  const data = await res.json();

  // Triggers
  const sel = document.getElementById('triggerSelect');
  sel.innerHTML = (data.triggers || []).map(t =>
    '<option value="' + t.events.join(',') + '">' + t.key + ' (' + t.events.join(', ') + ')</option>'
  ).join('') || '<option>No triggers defined</option>';

  // Scheduled
  const sched = document.getElementById('scheduledList');
  sched.innerHTML = (data.scheduledTriggers || []).map(st =>
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="flex:1;font-size:13px">' + st.key + ' <span style="color:var(--subtext)">(' + st.interval + ')</span></span><button class="btn btn-sm btn-primary" onclick="fireScheduled(\\'' + st.key + '\\')">Fire Now</button></div>'
  ).join('') || '<div class="empty">No scheduled triggers</div>';

  // Queues
  const qsel = document.getElementById('queueSelect');
  qsel.innerHTML = (data.consumers || []).map(c =>
    '<option value="' + c.queue + '">' + c.queue + ' → ' + c.functionKey + '</option>'
  ).join('') || '<option>No queues defined</option>';
}

async function fireTrigger() {
  const event = document.getElementById('triggerSelect').value;
  let payload;
  try { payload = JSON.parse(document.getElementById('triggerPayload').value); } catch { payload = {}; }
  const res = await fetch(API + '/api/trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: event.split(',')[0], data: payload }),
  });
  const result = await res.json();
  const el = document.getElementById('triggerResult');
  el.style.display = 'block';
  el.textContent = JSON.stringify(result, null, 2);
}

async function fireScheduled(key) {
  const res = await fetch(API + '/api/scheduled-trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
  });
  const result = await res.json();
  alert(result.statusCode === 204 ? '✅ Success (204)' : '⚠️ Status: ' + result.statusCode + '\\n' + JSON.stringify(result));
}

async function pushQueue() {
  const queue = document.getElementById('queueSelect').value;
  let payload;
  try { payload = JSON.parse(document.getElementById('queuePayload').value); } catch { payload = { body: {} }; }
  const res = await fetch(API + '/api/queue/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queue, ...payload }),
  });
  const result = await res.json();
  const el = document.getElementById('queueResult');
  el.style.display = 'block';
  el.textContent = JSON.stringify(result, null, 2);
}

// ── Helpers ────────────────────────────────────────────────────────

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── TypeScript ─────────────────────────────────────────────────

let tsErrors = { errors: [], critical: [], checking: true };
let tsShowAll = false;

document.getElementById('tsShowAll')?.addEventListener('change', (e) => {
  tsShowAll = e.target.checked;
  renderTypeErrors();
});

function updateTypeErrors(data) {
  tsErrors = data;
  renderTypeErrors();
  updateTsBadge();
}

function renderTypeErrors() {
  const statusEl = document.getElementById('tsStatus');
  const listEl = document.getElementById('tsList');

  if (tsErrors.checking) {
    statusEl.textContent = '⏳ Checking...';
    statusEl.className = 'ts-status checking';
    return;
  }

  const display = tsShowAll ? tsErrors.errors : tsErrors.critical;
  const criticalSet = new Set(tsErrors.critical.map(e => e.file + ':' + e.line + ':' + e.code));

  if (display.length === 0) {
    const total = tsErrors.errors.length;
    if (total === 0) {
      statusEl.textContent = '✅ No errors';
      statusEl.className = 'ts-status ok';
    } else {
      statusEl.textContent = '✅ No critical errors (' + total + ' non-critical hidden)';
      statusEl.className = 'ts-status ok';
    }
    listEl.innerHTML = '<div class="empty">' + (total === 0 ? 'All clear! No TypeScript errors.' : 'No deploy-breaking errors. Toggle "Show all" to see ' + total + ' non-critical issues.') + '</div>';
    return;
  }

  statusEl.textContent = '❌ ' + tsErrors.critical.length + ' critical error' + (tsErrors.critical.length !== 1 ? 's' : '') + (tsErrors.errors.length > tsErrors.critical.length ? ' (' + tsErrors.errors.length + ' total)' : '');
  statusEl.className = 'ts-status error';

  listEl.innerHTML = display.map(e => {
    const isCritical = criticalSet.has(e.file + ':' + e.line + ':' + e.code);
    return '<div class="ts-error ' + (isCritical ? 'critical' : 'non-critical') + '">'
      + '<div><span class="ts-file">' + escapeHtml(e.file) + ':' + e.line + ':' + e.column + '</span>'
      + '<span class="ts-code">' + e.code + '</span></div>'
      + '<div class="ts-msg">' + escapeHtml(e.message) + '</div></div>';
  }).join('');
}

function updateTsBadge() {
  const tab = document.getElementById('tsTab');
  // Remove existing badge
  const existing = tab.querySelector('.ts-badge');
  if (existing) existing.remove();

  if (tsErrors.checking) return;

  const count = tsErrors.critical.length;
  if (count > 0) {
    tab.insertAdjacentHTML('beforeend', '<span class="ts-badge error">' + count + '</span>');
  } else {
    tab.insertAdjacentHTML('beforeend', '<span class="ts-badge ok">✓</span>');
  }
}

// ── Init ───────────────────────────────────────────────────────────

connect();
// Load initial logs
fetch(API + '/api/logs').then(r => r.json()).then(data => { logs = data; renderLogs(); }).catch(() => {});
</script>
</body>
</html>`;
}
