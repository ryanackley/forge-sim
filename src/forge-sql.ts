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

export interface ForgeSQLOptions {
  /** MySQL version to use (default: '8.4.x') */
  mysqlVersion?: string;
  /** Database name (default: 'forge_app') */
  dbName?: string;
  /** Log level for mysql-memory-server */
  logLevel?: 'LOG' | 'WARN' | 'ERROR';
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
    this.db = await createDB({
      version: this.options.mysqlVersion,
      dbName: this.options.dbName,
      logLevel: this.options.logLevel,
    }) as unknown as MySQLMemoryDB;

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
      return makeJsonResponse(400, { error: 'Missing request body' });
    }

    let parsed: { query: string; params?: any[]; method?: string };
    try {
      parsed = JSON.parse(options.body);
    } catch {
      return makeJsonResponse(400, { error: 'Invalid JSON body' });
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
    } catch (err: any) {
      // Return MySQL errors as structured responses (matches Forge behavior)
      return makeJsonResponse(400, {
        code: err.code ?? 'UNKNOWN_ERROR',
        errno: err.errno ?? -1,
        message: err.message,
        sqlMessage: err.sqlMessage ?? err.message,
        sqlState: err.sqlState ?? 'HY000',
      });
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
    const [rows] = await pool.execute(sql, params);
    return rows as T[];
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
