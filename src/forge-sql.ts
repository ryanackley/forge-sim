/**
 * SimulatedForgeSQL — Real MySQL backend for Forge SQL simulation.
 *
 * Uses mysql-memory-server to spin up an ephemeral MySQL instance,
 * then intercepts __fetchProduct SQL calls and routes them to it.
 *
 * The @forge/sql package is used as-is — we just provide the backend
 * it expects (POST /api/v1/execute with { query, params, method }).
 */

import { createDB } from 'mysql-memory-server';
import mysql from 'mysql2/promise';

/**
 * The error body Forge SQL answers with, which the real `@forge/sql` turns
 * into a ForgeSQLAPIError (`code`, `message`, `suggestion`; everything else
 * on `context`): https://developer.atlassian.com/platform/forge/storage-reference/sql-handling-errors/
 *
 * A database failure is `SQL_EXECUTION_ERROR` with the native MySQL/TiDB
 * error under `debug` ("More details are present in the debug field"), so
 * an app branches on `error.code === errorCodes.SQL_EXECUTION_ERROR` and
 * then on `debug.code` (`ER_DUP_ENTRY`, `ER_PARSE_ERROR`, …), as the
 * documented examples do. The raw driver fields never reach the app.
 */
export interface ForgeSqlErrorBody {
  code: 'SQL_EXECUTION_ERROR' | 'QUERY_TIMED_OUT' | 'UNKNOWN_ERROR';
  message: string;
  suggestion?: string;
  debug?: { code: string; errno: number; sqlMessage: string; sqlState: string };
}

/** What the sim's own surfaces (`sim.sql.query`, MCP, the Tools API) throw: the same envelope, as an Error. */
export class ForgeSqlError extends Error {
  readonly code: ForgeSqlErrorBody['code'];
  readonly suggestion?: string;
  readonly debug?: ForgeSqlErrorBody['debug'];
  constructor(body: ForgeSqlErrorBody) {
    super(body.debug ? `${body.code}: ${body.debug.sqlMessage} (${body.debug.code})` : `${body.code}: ${body.message}`);
    this.name = 'ForgeSqlError';
    this.code = body.code;
    this.suggestion = body.suggestion;
    this.debug = body.debug;
  }
  /** The wire body, for surfaces that answer JSON. */
  toBody(): ForgeSqlErrorBody {
    return {
      code: this.code,
      message: this.debug ? 'Unknown SQL execution error' : this.message.replace(/^[A-Z_]+: /, ''),
      ...(this.suggestion ? { suggestion: this.suggestion } : {}),
      ...(this.debug ? { debug: this.debug } : {}),
    };
  }
}

const SUGGESTIONS: Record<string, string> = {
  ER_PARSE_ERROR: 'Check the SQL syntax at the position named in debug.sqlMessage.',
  ER_EMPTY_QUERY: 'The query is empty; pass a statement.',
  ER_DUP_ENTRY: 'A row with this unique key already exists; check first, or use INSERT ... ON DUPLICATE KEY UPDATE.',
  ER_NO_SUCH_TABLE: 'The table does not exist in this installation\'s schema; run your migrations first.',
  ER_BAD_FIELD_ERROR: 'The column does not exist; check the table definition.',
  ER_NO_REFERENCED_ROW_2: 'Forge SQL does not enforce foreign keys; this came from the local MySQL, which the sim configures not to enforce them either.',
};

/**
 * Map a mysql2 failure to Forge's envelope. A driver-level timeout is
 * `QUERY_TIMED_OUT` (Forge: "The provided query took more than 2 seconds to
 * execute"); everything else is `SQL_EXECUTION_ERROR` with the native error
 * under `debug`, exactly the shape the parse-error example documents.
 */
export function toForgeSqlError(err: unknown): ForgeSqlErrorBody {
  const e = (err ?? {}) as { code?: string; errno?: number; message?: string; sqlMessage?: string; sqlState?: string };
  if (e.code === 'PROTOCOL_SEQUENCE_TIMEOUT' || e.code === 'ETIMEDOUT') {
    return {
      code: 'QUERY_TIMED_OUT',
      message: 'The provided query took more than 2 seconds to execute',
      suggestion: 'Reduce the amount of data the query touches, or add an index; the query keeps running at the database.',
    };
  }
  if (typeof e.code !== 'string' || typeof e.errno !== 'number') {
    return { code: 'UNKNOWN_ERROR', message: e.message ?? String(err) };
  }
  return {
    code: 'SQL_EXECUTION_ERROR',
    message: 'Unknown SQL execution error',
    suggestion: SUGGESTIONS[e.code] ?? 'Use the debug.sqlMessage field to identify the issue reported by the database.',
    debug: {
      code: e.code,
      errno: e.errno,
      sqlMessage: e.sqlMessage ?? e.message ?? '',
      sqlState: e.sqlState ?? 'HY000',
    },
  };
}

export interface ForgeSQLOptions {
  /** MySQL version to use (default: '8.4.x') */
  mysqlVersion?: string;
  /** Database name (default: 'forge_app') */
  dbName?: string;
  /** Log level for mysql-memory-server */
  logLevel?: 'LOG' | 'WARN' | 'ERROR';
  /** Path to SQL file to execute on startup (for restoring state) */
  initSQLFilePath?: string;
}

interface MySQLMemoryDB {
  port: number;
  username: string;
  dbName: string;
  stop: () => Promise<void>;
}

export class SimulatedForgeSQL {
  private db: MySQLMemoryDB | null = null;
  private pool: mysql.Pool | null = null;
  private options: ForgeSQLOptions;
  private _starting: Promise<void> | null = null;

  constructor(options: ForgeSQLOptions = {}) {
    this.options = {
      mysqlVersion: options.mysqlVersion ?? '8.4.x',
      dbName: options.dbName ?? 'forge_app',
      logLevel: options.logLevel ?? 'ERROR',
    };
  }

  /**
   * Set the SQL file to execute on startup (for restoring persisted state).
   * Must be called before start().
   */
  setInitSQLFilePath(path: string): void {
    this.options.initSQLFilePath = path;
  }

  /**
   * Start the ephemeral MySQL server. Called lazily on first query,
   * or explicitly for eager initialization.
   */
  async start(): Promise<void> {
    if (this.pool) return;
    if (this._starting) return this._starting;

    this._starting = this._doStart();
    await this._starting;
    this._starting = null;
  }

  private async _doStart(): Promise<void> {
    const createOpts: any = {
      version: this.options.mysqlVersion,
      dbName: this.options.dbName,
      logLevel: this.options.logLevel,
    };
    if (this.options.initSQLFilePath) {
      createOpts.initSQLFilePath = this.options.initSQLFilePath;
    }
    this.db = await createDB(createOpts) as unknown as MySQLMemoryDB;

    this.pool = mysql.createPool({
      host: '127.0.0.1',
      port: this.db.port,
      user: this.db.username,
      password: '',
      database: this.db.dbName,
      waitForConnections: true,
      connectionLimit: 5,
      // Match TiDB/Forge behavior
      multipleStatements: false,
    });

    // Parity (spec SQL-015): Forge SQL runs on TiDB, which parses FOREIGN KEY
    // DDL but does NOT enforce the constraints (no referential checks, no
    // cascading deletes). MySQL enforces them by default, which would make
    // valid-in-Forge apps fail in the sim. Disable FK checks on every
    // connection as it opens — the listener goes on BEFORE the first query,
    // or the pool's first connection (the one most tests run on) keeps the
    // default and enforces them — and globally so later connections inherit it.
    (this.pool as unknown as NodeJS.EventEmitter).on('connection', (conn: mysql.PoolConnection) => {
      conn.query('SET FOREIGN_KEY_CHECKS = 0');
    });
    await this.pool.query('SET GLOBAL FOREIGN_KEY_CHECKS = 0');
  }

  /**
   * Ensure the server is running (lazy start).
   */
  private async ensureStarted(): Promise<mysql.Pool> {
    if (!this.pool) await this.start();
    return this.pool!;
  }

  /**
   * Handle a Forge SQL API request.
   * This is the function that gets wired into __fetchProduct.
   *
   * @param path - The API path (e.g., '/api/v1/execute' or '/api/v1/execute/ddl')
   * @param options - Fetch-like options with body containing { query, params, method }
   * @returns A Response-like object matching what @forge/sql expects
   */
  async handleRequest(
    path: string,
    options?: { method?: string; body?: string; headers?: Record<string, string> }
  ): Promise<FetchLikeResponse> {
    const pool = await this.ensureStarted();

    if (!options?.body) {
      return makeJsonResponse(400, { code: 'UNKNOWN_ERROR', message: 'Missing request body' });
    }

    let parsed: { query: string; params?: any[]; method?: string };
    try {
      parsed = JSON.parse(options.body);
    } catch {
      return makeJsonResponse(400, { code: 'UNKNOWN_ERROR', message: 'Invalid JSON body' });
    }

    const { query, params = [], method = 'all' } = parsed;

    try {
      // Use pool.query() when there are no params — pool.execute() uses the
      // prepared statement protocol which doesn't support some commands
      // (START TRANSACTION, COMMIT, etc.)
      const useExecute = params.length > 0;
      const [rawRows, fields] = useExecute
        ? await pool.execute(query, params)
        : await pool.query(query);

      // Determine if this is a SELECT or a mutation
      const isSelect = Array.isArray(rawRows);

      if (isSelect) {
        // SELECT — return rows
        const rows = rawRows as any[];
        const metadata = fields
          ? Object.fromEntries(
              (fields as mysql.FieldPacket[]).map((f) => [
                f.name,
                { type: mysqlTypeToString(f.type), name: f.name },
              ])
            )
          : {};
        return makeJsonResponse(200, { rows, metadata });
      } else {
        // INSERT/UPDATE/DELETE — return affected row info
        const result = rawRows as mysql.ResultSetHeader;
        return makeJsonResponse(200, {
          rows: {
            affectedRows: result.affectedRows,
            fieldCount: result.fieldCount ?? 0,
            info: result.info,
            insertId: result.insertId,
            serverStatus: result.serverStatus ?? 0,
            warningStatus: result.warningStatus ?? 0,
          },
          metadata: {},
        });
      }
    } catch (err) {
      // Forge's envelope, never the raw driver error (see ForgeSqlErrorBody).
      return makeJsonResponse(400, toForgeSqlError(err));
    }
  }

  /**
   * Create the fetch-like function that __fetchProduct returns for SQL requests.
   */
  createFetchFunction(): (path: string, options?: any) => Promise<FetchLikeResponse> {
    return (path: string, options?: any) => this.handleRequest(path, options);
  }

  /**
   * Execute a raw query directly (for testing/debugging).
   */
  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const pool = await this.ensureStarted();
    try {
      // The same protocol choice as handleRequest: the prepared-statement
      // protocol only when there are parameters to bind, so a statement
      // that protocol refuses (USE, PREPARE, START TRANSACTION) answers the
      // same way here as it does for the app.
      const [rows] = params && params.length > 0 ? await pool.execute(sql, params) : await pool.query(sql);
      return rows as T[];
    } catch (err) {
      // The sim's own surfaces report what the app would see.
      throw new ForgeSqlError(toForgeSqlError(err));
    }
  }

  /**
   * Stop the MySQL server and clean up.
   */
  async stop(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    if (this.db) {
      await this.db.stop();
      this.db = null;
    }
  }

  /**
   * Drop every table in the app database, leaving an empty schema.
   *
   * Used by `simulator.reset()` to clear SQL state without paying the cost
   * of stopping and restarting the MySQL server (which is expensive — the
   * binary takes seconds to spin up). FK checks are disabled during the
   * drop so tables with relationships can be removed in any order.
   *
   * No-op if the server hasn't been started. Safe to call repeatedly.
   */
  async reset(): Promise<void> {
    if (!this.pool) return;
    const dbName = this.options.dbName;
    const [rows] = await this.pool.query<any[]>(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = ?',
      [dbName],
    );
    if (!Array.isArray(rows) || rows.length === 0) return;

    const conn = await this.pool.getConnection();
    try {
      await conn.query('SET FOREIGN_KEY_CHECKS = 0');
      for (const row of rows) {
        const tableName = (row as any).TABLE_NAME ?? (row as any).table_name;
        if (typeof tableName !== 'string') continue;
        // Backtick-quote the identifier to handle reserved words / unusual names.
        await conn.query(`DROP TABLE IF EXISTS \`${tableName}\``);
      }
    } finally {
      // Note: FK checks stay disabled — that's the steady-state TiDB-parity
      // behavior (see _doStart), not just a drop-ordering convenience.
      conn.release();
    }
  }

  /**
   * Check if the server is running.
   */
  get isRunning(): boolean {
    return this.pool !== null;
  }

  /**
   * Get the port the MySQL server is listening on.
   */
  get port(): number | null {
    return this.db?.port ?? null;
  }

  /**
   * Get connection config for external tools (e.g., the sql-dump module).
   */
  getConnectionConfig(): { host: string; port: number; user: string; database: string } | null {
    if (!this.db?.port) return null;
    return { host: '127.0.0.1', port: this.db.port, user: 'root', database: 'forge_app' };
  }

  /**
   * Execute raw multi-statement SQL (for restoring dumps).
   * Creates a separate connection with multipleStatements enabled.
   */
  async executeMultiStatement(sql: string): Promise<void> {
    if (!this.db?.port) throw new Error('SQL server not running');
    const conn = await mysql.createConnection({
      host: '127.0.0.1',
      port: this.db.port,
      user: 'root',
      database: 'forge_app',
      multipleStatements: true,
    });
    try {
      await conn.query(sql);
    } finally {
      await conn.end();
    }
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────

export interface FetchLikeResponse {
  status: number;
  ok: boolean;
  text: () => Promise<string>;
  json: () => Promise<any>;
  headers: Record<string, string>;
}

function makeJsonResponse(status: number, body: any): FetchLikeResponse {
  const bodyStr = JSON.stringify(body);
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => bodyStr,
    json: async () => body,
    headers: { 'content-type': 'application/json' },
  };
}

/**
 * Convert mysql2 field type number to a human-readable string.
 * Matches the metadata format Forge SQL returns.
 */
function mysqlTypeToString(type: number | undefined): string {
  if (type === undefined) return 'UNKNOWN';
  // mysql2 field type constants (subset)
  const types: Record<number, string> = {
    0: 'DECIMAL',
    1: 'TINY',
    2: 'SHORT',
    3: 'LONG',
    4: 'FLOAT',
    5: 'DOUBLE',
    6: 'NULL',
    7: 'TIMESTAMP',
    8: 'LONGLONG',
    9: 'INT24',
    10: 'DATE',
    11: 'TIME',
    12: 'DATETIME',
    13: 'YEAR',
    15: 'VARCHAR',
    16: 'BIT',
    245: 'JSON',
    246: 'NEWDECIMAL',
    252: 'BLOB',
    253: 'VAR_STRING',
    254: 'STRING',
  };
  return types[type] ?? `TYPE_${type}`;
}
