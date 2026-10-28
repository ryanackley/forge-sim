/**
 * A failing statement answers with Forge's error envelope, never the raw
 * MySQL error, on every surface:
 * https://developer.atlassian.com/platform/forge/storage-reference/sql-handling-errors/
 *
 *   { code: 'SQL_EXECUTION_ERROR', message: 'Unknown SQL execution error',
 *     suggestion, debug: { code: 'ER_PARSE_ERROR', errno: 1064, sqlMessage, sqlState: '42000' } }
 *
 * The real @forge/sql turns that into a ForgeSQLAPIError whose `code` is
 * `errorCodes.SQL_EXECUTION_ERROR` and whose `context.debug` carries the
 * native error, which is what the documented `error.code === …` branches
 * test. `sim.sql.query()`, MCP and the Tools API report the same fields.
 *
 * Also here: foreign keys are off on the pool's FIRST connection, not only
 * on the ones opened after the first query.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSimulator, type ForgeSimulator } from '../simulator.js';
import { ForgeSqlError, toForgeSqlError } from '../forge-sql.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let sim: ForgeSimulator;
let sql: any;
let errorCodes: any;
let ForgeSQLAPIError: any;

beforeAll(async () => {
  sim = createSimulator();
  await sim.sql.start();
  const pkg = await import('@forge/sql');
  sql = pkg.sql;
  errorCodes = pkg.errorCodes;
  ForgeSQLAPIError = pkg.ForgeSQLAPIError;
}, 60_000);

afterAll(async () => {
  await sim.stop();
}, 30_000);

async function failure(run: () => Promise<unknown>): Promise<any> {
  try {
    await run();
  } catch (err) {
    return err;
  }
  throw new Error('expected the statement to fail');
}

describe('the real @forge/sql sees the documented envelope', () => {
  it('a parse error: SQL_EXECUTION_ERROR with the native ER_PARSE_ERROR under debug', async () => {
    const err = await failure(() => sql.executeRaw('SELEC 1'));
    expect(err).toBeInstanceOf(ForgeSQLAPIError);
    expect(err.code).toBe(errorCodes.SQL_EXECUTION_ERROR);
    expect(err.message).toBe('Unknown SQL execution error');
    expect(err.suggestion).toContain('syntax');
    expect(err.context.debug).toMatchObject({ code: 'ER_PARSE_ERROR', errno: 1064, sqlState: '42000' });
    expect(err.context.debug.sqlMessage).toMatch(/SELEC/);
    // Nothing of the raw driver error leaks to the top level.
    expect(err.context.errno).toBeUndefined();
    expect(err.context.sqlMessage).toBeUndefined();
  });

  it('an empty query mirrors ER_EMPTY_QUERY', async () => {
    const err = await failure(() => sql.executeRaw(''));
    expect(err.code).toBe('SQL_EXECUTION_ERROR');
    expect(err.context.debug.code).toBe('ER_EMPTY_QUERY');
  });

  it('a duplicate key: the documented errorCodes branch plus debug.code works', async () => {
    await sql.executeRaw('CREATE TABLE envelope_dup (id INT PRIMARY KEY)');
    await sql.prepare('INSERT INTO envelope_dup (id) VALUES (?)').bindParams(1).execute();
    const err = await failure(() => sql.prepare('INSERT INTO envelope_dup (id) VALUES (?)').bindParams(1).execute());
    // The branch Atlassian's example app writes.
    const handled = err.code === errorCodes.SQL_EXECUTION_ERROR && err.context.debug.code === 'ER_DUP_ENTRY';
    expect(handled).toBe(true);
    expect(err.suggestion).toContain('ON DUPLICATE KEY UPDATE');
  });

  it('a missing table names the table in debug.sqlMessage, not in message', async () => {
    const err = await failure(() => sql.executeRaw('SELECT * FROM envelope_missing'));
    expect(err.message).toBe('Unknown SQL execution error');
    expect(err.context.debug).toMatchObject({ code: 'ER_NO_SUCH_TABLE', errno: 1146 });
    expect(err.context.debug.sqlMessage).toContain('envelope_missing');
  });
});

describe('the mapper', () => {
  it('maps a driver timeout to QUERY_TIMED_OUT and anything without a MySQL code to UNKNOWN_ERROR', () => {
    expect(toForgeSqlError({ code: 'PROTOCOL_SEQUENCE_TIMEOUT', message: 'x' })).toMatchObject({ code: 'QUERY_TIMED_OUT' });
    expect(toForgeSqlError(new Error('socket hang up'))).toEqual({ code: 'UNKNOWN_ERROR', message: 'socket hang up' });
    expect(toForgeSqlError({ code: 'ER_X', errno: 9, sqlMessage: 'm', sqlState: 'S' })).toEqual({
      code: 'SQL_EXECUTION_ERROR',
      message: 'Unknown SQL execution error',
      suggestion: expect.stringContaining('debug.sqlMessage'),
      debug: { code: 'ER_X', errno: 9, sqlMessage: 'm', sqlState: 'S' },
    });
  });
});

describe("the sim's own surfaces report the same envelope", () => {
  it('sim.sql.query() throws a ForgeSqlError with code, suggestion and debug', async () => {
    const err = await failure(() => sim.sql.query('SELEC 1'));
    expect(err).toBeInstanceOf(ForgeSqlError);
    expect(err.code).toBe('SQL_EXECUTION_ERROR');
    expect(err.debug).toMatchObject({ code: 'ER_PARSE_ERROR', errno: 1064 });
    expect(err.message).toMatch(/^SQL_EXECUTION_ERROR: .*SELEC.*\(ER_PARSE_ERROR\)$/);
    expect(err.toBody()).toEqual({
      code: 'SQL_EXECUTION_ERROR',
      message: 'Unknown SQL execution error',
      suggestion: expect.any(String),
      debug: err.debug,
    });
  });

  it('sim.sql.query() uses the same protocol choice as the app path (no params: text protocol)', async () => {
    // START TRANSACTION is refused by the prepared-statement protocol; the
    // app path always ran it fine, the direct helper used to refuse it.
    await expect(sim.sql.query('START TRANSACTION')).resolves.toBeDefined();
    await expect(sim.sql.query('ROLLBACK')).resolves.toBeDefined();
  });

  it('MCP forge_sql_execute and the Tools API print the code, the native error and the suggestion', () => {
    const mcp = readFileSync(join(__dirname, '..', 'mcp-server.ts'), 'utf8');
    expect(mcp).toContain('SQL error ${data.code}');
    expect(mcp).toContain('data.debug.sqlMessage');
    const tools = readFileSync(join(__dirname, '..', 'tools', 'api.ts'), 'utf8');
    expect(tools).toContain("typeof err?.toBody === 'function' ? err.toBody() : {}");
  });
});

describe('foreign keys', () => {
  it('are not enforced on the first connection a fresh simulator opens', async () => {
    const fresh = createSimulator();
    try {
      const rows = await fresh.sql.query<{ fk: number }>('SELECT @@SESSION.foreign_key_checks AS fk');
      expect(Number(rows[0].fk)).toBe(0);
      await fresh.sql.query('CREATE TABLE fk_parent (id INT PRIMARY KEY)');
      await fresh.sql.query('CREATE TABLE fk_child (id INT PRIMARY KEY, parent_id INT, FOREIGN KEY (parent_id) REFERENCES fk_parent(id))');
      // An orphan insert is fine on TiDB, which parses but never enforces the constraint.
      await expect(fresh.sql.query('INSERT INTO fk_child (id, parent_id) VALUES (1, 999)')).resolves.toBeDefined();
    } finally {
      await fresh.stop();
    }
  }, 60_000);
});
