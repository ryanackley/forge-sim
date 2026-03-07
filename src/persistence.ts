/**
 * Persistence layer for forge-sim.
 *
 * Saves simulator state on shutdown and restores on startup.
 * State is stored in the app's .forge-sim-state/ directory:
 *   - kvs.json — KVS key-value dump
 *   - sql.dump — MySQL dump (via mysqldump npm package — pure JS, no binary needed)
 *
 * SQL restore uses mysql-memory-server's initSQLFilePath option so state
 * is loaded during MySQL boot — before app migrations run. The dump file
 * is wrapped with USE + foreign_key_checks to handle table dependencies.
 *
 * Usage:
 *   await saveState(sim, stateDir);   // on shutdown
 *   await loadState(sim, stateDir);   // on startup (KVS only — SQL via initSQLFilePath)
 */

import { mkdir, readFile, access } from 'node:fs/promises';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ForgeSimulator } from './simulator.js';

const KVS_FILE = 'kvs.json';
const SQL_FILE = 'sql.dump';

/**
 * Save simulator state to disk.
 * Wraps the SQL dump with USE + SET foreign_key_checks for safe restore.
 */
export async function saveState(sim: ForgeSimulator, stateDir: string): Promise<void> {
  // Use sync writes — this runs during SIGINT cleanup and async writes
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

      const rawDump = [result.dump.schema, result.dump.data]
        .filter(Boolean)
        .join('\n');

      if (rawDump.trim().length > 0) {
        // Wrap with USE database + foreign key safety for initSQLFilePath restore
        const wrappedDump = [
          `USE ${connConfig.database};`,
          `SET foreign_key_checks = 0;`,
          rawDump,
          `SET foreign_key_checks = 1;`,
        ].join('\n');

        writeFileSync(join(stateDir, SQL_FILE), wrappedDump);
        const tableCount = (rawDump.match(/CREATE TABLE/gi) || []).length;
        console.log(`  💾 Saved SQL dump (${tableCount} tables)`);
      }
    } catch (err: any) {
      console.error(`  ⚠️  Failed to save SQL state: ${err.message}`);
    }
  }
}

/**
 * Restore simulator state from disk (KVS only).
 * SQL restore happens via initSQLFilePath — call getSQLDumpPath() and
 * pass it to sim.sql.setInitSQLFilePath() BEFORE sql.start().
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
  // SQL restore is handled via initSQLFilePath (set before SQL server starts).
  // Just check if the file exists for the restored flag.
  const sqlPath = join(stateDir, SQL_FILE);
  try {
    await access(sqlPath);
    const dump = await readFile(sqlPath, 'utf-8');
    if (dump.trim().length > 0) {
      const tableCount = (dump.match(/CREATE TABLE/gi) || []).length;
      console.log(`  📂 SQL state found (${tableCount} tables) — restoring on SQL start`);
      restored = true;
    }
  } catch {
    // No SQL state file — that's fine
  }

  return restored;
}

/**
 * Get the SQL dump file path if it exists (for initSQLFilePath).
 */
export async function getSQLDumpPath(stateDir: string): Promise<string | undefined> {
  const sqlPath = join(stateDir, SQL_FILE);
  try {
    await access(sqlPath);
    return sqlPath;
  } catch {
    return undefined;
  }
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
