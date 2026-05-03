/**
 * Persistence layer for forge-sim.
 *
 * Saves simulator state on shutdown and restores on startup.
 * State is stored in the app's .forge-sim/state/ directory:
 *   - entities.json — KVS + Custom Entities + Secrets, with timestamps
 *   - sql.dump      — MySQL dump (via mysqldump npm package — pure JS, no binary needed)
 *
 * SQL restore uses mysql-memory-server's initSQLFilePath option so state
 * is loaded during MySQL boot — before app migrations run. The dump file
 * is wrapped with USE + foreign_key_checks to handle table dependencies.
 *
 * Usage:
 *   await saveState(sim, stateDir);   // on shutdown
 *   await loadState(sim, stateDir);   // on startup (KVS+entities; SQL via initSQLFilePath)
 */

import { readFile, access } from 'node:fs/promises';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ForgeSimulator } from './simulator.js';

const ENTITY_FILE = 'entities.json';
const SQL_FILE = 'sql.dump';

/**
 * Save simulator state to disk.
 * Wraps the SQL dump with USE + SET foreign_key_checks for safe restore.
 */
export async function saveState(sim: ForgeSimulator, stateDir: string): Promise<void> {
  // Use sync writes — this runs during SIGINT cleanup and async writes
  // can get lost if process.exit() fires before the event loop drains
  mkdirSync(stateDir, { recursive: true });

  // ── Persistent KVS state (plain KVS + Custom Entities + Secrets) ─────
  const dump = sim.kvs.dumpAll();
  const kvsCount = dump.kvs?.length ?? 0;
  const entityCount = dump.entities?.length ?? 0;
  const secretCount = dump.secrets?.length ?? 0;
  const total = kvsCount + entityCount + secretCount;

  if (total > 0) {
    writeFileSync(join(stateDir, ENTITY_FILE), JSON.stringify(dump, null, 2));
    const parts: string[] = [];
    if (kvsCount > 0) parts.push(`${kvsCount} KVS`);
    if (entityCount > 0) parts.push(`${entityCount} entities`);
    if (secretCount > 0) parts.push(`${secretCount} secrets`);
    console.log(`  💾 Saved ${parts.join(', ')}`);
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
 * Restore simulator state from disk (KVS + entities + secrets).
 * SQL restore happens via initSQLFilePath — call getSQLDumpPath() and
 * pass it to sim.sql.setInitSQLFilePath() BEFORE sql.start().
 */
export async function loadState(sim: ForgeSimulator, stateDir: string): Promise<boolean> {
  let restored = false;

  // ── Persistent KVS state (entities.json) ─────────────────────────────
  const entityPath = join(stateDir, ENTITY_FILE);
  try {
    await access(entityPath);
    const raw = await readFile(entityPath, 'utf-8');
    const dump = JSON.parse(raw);
    const kvsCount = dump.kvs?.length ?? 0;
    const entityCount = dump.entities?.length ?? 0;
    const secretCount = dump.secrets?.length ?? 0;
    const total = kvsCount + entityCount + secretCount;

    if (total > 0) {
      sim.kvs.restoreAll(dump);
      const parts: string[] = [];
      if (kvsCount > 0) parts.push(`${kvsCount} KVS`);
      if (entityCount > 0) parts.push(`${entityCount} entities`);
      if (secretCount > 0) parts.push(`${secretCount} secrets`);
      console.log(`  📂 Restored ${parts.join(', ')}`);
      restored = true;
    }
  } catch {
    // No entities.json — fresh install, nothing to restore.
  }

  // SQL restore is handled via initSQLFilePath — already configured
  // before deploy in dev-command.ts (step 4a). No action needed here.

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
  for (const file of [ENTITY_FILE, SQL_FILE]) {
    try {
      await access(join(stateDir, file));
      return true;
    } catch {
      // continue
    }
  }
  return false;
}
