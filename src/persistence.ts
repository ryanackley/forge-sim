/**
 * Persistence layer for forge-sim.
 *
 * Saves simulator state on shutdown and restores on startup.
 * State is stored in the app's .forge-sim/state/ directory:
 *   - kvs.json      — KVS key-value dump
 *   - sql.dump      — MySQL dump (via mysqldump)
 *
 * Usage:
 *   await saveState(sim, stateDir);   // on shutdown
 *   await loadState(sim, stateDir);   // on startup (after SQL server is ready)
 */

import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import type { ForgeSimulator } from './simulator.js';

const execAsync = promisify(execCb);

const KVS_FILE = 'kvs.json';
const SQL_FILE = 'sql.dump';

/**
 * Save simulator state to disk.
 */
export async function saveState(sim: ForgeSimulator, stateDir: string): Promise<void> {
  await mkdir(stateDir, { recursive: true });

  // ── KVS ──────────────────────────────────────────────────────────────
  const kvsDump = sim.kvs.dump();
  const kvsEntryCount = Object.keys(kvsDump).length;
  if (kvsEntryCount > 0) {
    await writeFile(join(stateDir, KVS_FILE), JSON.stringify(kvsDump, null, 2));
    console.log(`  💾 Saved ${kvsEntryCount} KVS entries`);
  }

  // ── SQL ──────────────────────────────────────────────────────────────
  if (sim.sql.isRunning && sim.sql.port) {
    try {
      // Use mysqldump to export all tables
      // mysql-memory-server runs without auth by default
      const { stdout } = await execAsync(
        `mysqldump --host=127.0.0.1 --port=${sim.sql.port} --user=root --skip-lock-tables --no-tablespaces forge_app`,
        { maxBuffer: 50 * 1024 * 1024 } // 50MB max
      );

      if (stdout.trim().length > 0) {
        await writeFile(join(stateDir, SQL_FILE), stdout);
        // Count tables in the dump
        const tableCount = (stdout.match(/CREATE TABLE/g) || []).length;
        console.log(`  💾 Saved SQL dump (${tableCount} tables)`);
      }
    } catch (err: any) {
      // mysqldump might not be available — that's OK
      if (err.message?.includes('command not found') || err.message?.includes('ENOENT')) {
        console.log(`  ⚠️  mysqldump not found — skipping SQL state save`);
        console.log(`     Install MySQL client tools to enable SQL persistence`);
      } else {
        console.error(`  ⚠️  Failed to save SQL state: ${err.message}`);
      }
    }
  }
}

/**
 * Restore simulator state from disk.
 */
export async function loadState(sim: ForgeSimulator, stateDir: string): Promise<boolean> {
  let restored = false;

  // ── KVS ──────────────────────────────────────────────────────────────
  const kvsPath = join(stateDir, KVS_FILE);
  try {
    await access(kvsPath);
    const raw = await readFile(kvsPath, 'utf-8');
    const data = JSON.parse(raw);
    const keys = Object.keys(data);

    if (keys.length > 0) {
      sim.kvs.restore(data);
      console.log(`  📂 Restored ${keys.length} KVS entries`);
      restored = true;
    }
  } catch {
    // No KVS state file — that's fine
  }

  // ── SQL ──────────────────────────────────────────────────────────────
  const sqlPath = join(stateDir, SQL_FILE);
  try {
    await access(sqlPath);
    const dump = await readFile(sqlPath, 'utf-8');

    if (dump.trim().length > 0 && sim.sql.isRunning && sim.sql.port) {
      // Pipe the dump into mysql client via stdin
      const { spawn } = await import('node:child_process');
      await new Promise<void>((resolve, reject) => {
        const proc = spawn('mysql', [
          '--host=127.0.0.1',
          `--port=${sim.sql.port}`,
          '--user=root',
          'forge_app',
        ], { stdio: ['pipe', 'pipe', 'pipe'] });

        let stderr = '';
        proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
        proc.on('close', (code: number) => {
          if (code === 0) resolve();
          else reject(new Error(`mysql exited with ${code}: ${stderr}`));
        });
        proc.on('error', reject);
        proc.stdin.write(dump);
        proc.stdin.end();
      });

      const tableCount = (dump.match(/CREATE TABLE/g) || []).length;
      console.log(`  📂 Restored SQL dump (${tableCount} tables)`);
      restored = true;
    }
  } catch (err: any) {
    if (err.message?.includes('command not found') || err.message?.includes('ENOENT')) {
      console.log(`  ⚠️  mysql client not found — skipping SQL state restore`);
    } else if (err.code !== 'ENOENT') {
      console.error(`  ⚠️  Failed to restore SQL state: ${err.message}`);
    }
  }

  return restored;
}

/**
 * Check if persisted state exists.
 */
export async function hasPersistedState(stateDir: string): Promise<boolean> {
  try {
    const kvsPath = join(stateDir, KVS_FILE);
    await access(kvsPath);
    return true;
  } catch {
    try {
      const sqlPath = join(stateDir, SQL_FILE);
      await access(sqlPath);
      return true;
    } catch {
      return false;
    }
  }
}
