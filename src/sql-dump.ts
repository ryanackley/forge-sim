/**
 * Minimal MySQL logical dump — replaces the `mysqldump` npm package.
 *
 * Why not the npm package? It was last published in June 2022 and pins an
 * ancient `mysql2` with known CVEs. We papered over that with an npm
 * `overrides` entry, but overrides only apply at the ROOT of the installing
 * project — they do NOT propagate to consumers. Every `npm install forge-sim`
 * still surfaced 3 criticals (eval 3 finding #3). The only real fix is to
 * not depend on it at all.
 *
 * What this produces (per base table, FK-safe because restore wraps the file
 * in SET foreign_key_checks = 0):
 *   DROP TABLE IF EXISTS `t`;
 *   CREATE TABLE `t` (...);            ← verbatim from SHOW CREATE TABLE
 *   INSERT INTO `t` (`a`, `b`) VALUES (...), (...);   ← chunked
 *
 * Notes:
 * - Temporal columns are read with `dateStrings: true` so DATETIME/DATE/
 *   TIMESTAMP round-trip as literals with no timezone math.
 * - JSON columns come back as parsed objects from mysql2 — re-serialized and
 *   escaped as strings.
 * - Binary columns (BLOB/BINARY/BIT) come back as Buffers — emitted as
 *   X'<hex>' literals.
 * - Generated columns are excluded from INSERTs (inserting into them errors).
 */

import mysql from 'mysql2/promise';

export interface SqlDumpConnection {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
}

/** Rows per INSERT statement — keeps statements well under packet limits. */
const INSERT_CHUNK_SIZE = 100;

/** Escape a single cell value into a SQL literal. */
export function escapeSqlValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (Buffer.isBuffer(value)) {
    return value.length === 0 ? "''" : `X'${value.toString('hex')}'`;
  }
  // JSON columns arrive as parsed objects/arrays from mysql2.
  if (typeof value === 'object') return mysql.escape(JSON.stringify(value));
  return mysql.escape(value as string | number | boolean | Date);
}

/**
 * Dump schema + data for every base table in the database as executable SQL.
 * Returns '' when the database has no tables.
 */
export async function dumpDatabase(config: SqlDumpConnection): Promise<string> {
  const conn = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password ?? '',
    database: config.database,
    // Temporal values as strings — dump/restore must not do timezone math.
    dateStrings: true,
  });

  try {
    const [tableRows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT table_name AS name FROM information_schema.tables
       WHERE table_schema = ? AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
      [config.database],
    );

    const parts: string[] = [];

    for (const row of tableRows) {
      const table = String(row.name ?? row.NAME);

      // ── Schema ─────────────────────────────────────────────────────────
      const [createRows] = await conn.query<mysql.RowDataPacket[]>(
        `SHOW CREATE TABLE \`${table}\``,
      );
      const createSql = createRows[0]?.['Create Table'];
      if (typeof createSql !== 'string') continue;
      parts.push(`DROP TABLE IF EXISTS \`${table}\`;`);
      parts.push(`${createSql};`);

      // ── Data ───────────────────────────────────────────────────────────
      // Skip generated columns — they can't be inserted into.
      const [colRows] = await conn.query<mysql.RowDataPacket[]>(
        `SHOW COLUMNS FROM \`${table}\``,
      );
      const columns = colRows
        .filter((c) => !/GENERATED/i.test(String(c.Extra ?? '')))
        .map((c) => String(c.Field));
      if (columns.length === 0) continue;

      const colList = columns.map((c) => `\`${c}\``).join(', ');
      const [dataRows] = await conn.query<mysql.RowDataPacket[]>(
        `SELECT ${colList} FROM \`${table}\``,
      );

      for (let i = 0; i < dataRows.length; i += INSERT_CHUNK_SIZE) {
        const chunk = dataRows.slice(i, i + INSERT_CHUNK_SIZE);
        const values = chunk
          .map((r) => `(${columns.map((c) => escapeSqlValue(r[c])).join(', ')})`)
          .join(',\n');
        parts.push(`INSERT INTO \`${table}\` (${colList}) VALUES\n${values};`);
      }
    }

    return parts.join('\n');
  } finally {
    await conn.end();
  }
}
