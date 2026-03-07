/**
 * Persistence layer for forge-sim.
 *
 * Saves simulator state on shutdown and restores on startup.
 * State is stored in the app's .forge-sim-state/ directory:
 *   - kvs.json — KVS key-value dump
 *   - sql.dump — MySQL dump (via mysqldump npm package — pure JS, no binary needed)
 *
 * Usage:
 *   await saveState(sim, stateDir);   // on shutdown
 *   await loadState(sim, stateDir);   // on startup (after SQL server is ready)
 */

import { mkdir, readFile, access } from 'node:fs/promises';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ForgeSimulator } from './simulator.js';

const KVS_FILE = 'kvs.json';
const SQL_FILE = 'sql.dump';

/**
 * Save simulator state to disk.
 */
export async function saveState(sim: ForgeSimulator, stateDir: string): Promise<void> {
  // Use sync writes for KVS — this runs during SIGINT cleanup and async writes
  // can get lost if process.exit() fires before the event loop drains
  mkdirSync(stateDir, { recursive: true });

  // ── KVS ──────────────────────────────────────────────────────────────
  const kvsDump = sim.kvs.dump();
  const kvsEntryCount = Object.keys(kvsDump).length;
  if (kvsEntryCount > 0) {
    writeFileSync(join(stateDir, KVS_FILE), JSON.stringify(kvsDump, null, 2));
    console.log(`  💾 Saved ${kvsEntryCount} KVS entries`);
  }

  // ── SQL ──────────────────────────────────────────────────────────────
  const connConfig = sim.sql.getConnectionConfig();
  if (sim.sql.isRunning && connConfig) {
    try {
      const mod = await import('mysqldump');
      const mysqldump: any = mod.default?.default ?? mod.default;
      const result = await mysqldump({
        connection: {
          host: connConfig.host,
          port: connConfig.port,
          user: connConfig.user,
          password: '',
          database: connConfig.database,
        },
        dump: {
          schema: { table: { dropIfExist: true } },
          data: { format: false },
        },
      });

      const dumpSql = [result.dump.schema, result.dump.data]
        .filter(Boolean)
        .join('\n');

      if (dumpSql.trim().length > 0) {
        writeFileSync(join(stateDir, SQL_FILE), dumpSql);
        const tableCount = (dumpSql.match(/CREATE TABLE/gi) || []).length;
        console.log(`  💾 Saved SQL dump (${tableCount} tables)`);
      }
    } catch (err: any) {
      console.error(`  ⚠️  Failed to save SQL state: ${err.message}`);
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

    if (dump.trim().length > 0) {
      // Ensure SQL server is running before restore
      await sim.sql.start();
      await sim.sql.executeMultiStatement(dump);
      const tableCount = (dump.match(/CREATE TABLE/gi) || []).length;
      console.log(`  📂 Restored SQL dump (${tableCount} tables)`);
      restored = true;
    }
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
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
    await access(join(stateDir, KVS_FILE));
    return true;
  } catch {
    try {
      await access(join(stateDir, SQL_FILE));
      return true;
    } catch {
      return false;
    }
  }
}
